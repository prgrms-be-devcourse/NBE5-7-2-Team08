#!/usr/bin/env bash
set -Eeuo pipefail

IMAGE=${1:?"배포할 불변 이미지가 필요합니다"}
if [[ ! "$IMAGE" =~ ^ghcr\.io/lunarbae628/devchat-backend:dev-[0-9a-f]{7}$ ]]; then
  echo "허용되지 않은 이미지 태그: $IMAGE" >&2
  exit 2
fi

DEPLOY_DIR=${DEPLOY_DIR:-/srv/devchat}
COMPOSE_FILE=${COMPOSE_FILE:-$DEPLOY_DIR/docker-compose.yml}
ENV_FILE=${ENV_FILE:-$DEPLOY_DIR/.env}
IMAGE_STATE_FILE=${IMAGE_STATE_FILE:-$DEPLOY_DIR/deployment.images.yml}
ACTIVE_COLOR_FILE=${ACTIVE_COLOR_FILE:-$DEPLOY_DIR/active_color}
LOCK_FILE=${LOCK_FILE:-$DEPLOY_DIR/deploy.lock}
TRANSACTION_DIR=${TRANSACTION_DIR:-$DEPLOY_DIR/deploy.transaction}
GATEWAY_UPSTREAM_FILE=${GATEWAY_UPSTREAM_FILE:-/srv/gateway/nginx/conf.d/devchat-upstream.conf}
PUBLIC_HEALTH_URL=${PUBLIC_HEALTH_URL:-https://api.devchat.o-r.kr/actuator/health}
DOCKER_BIN=${DOCKER_BIN:-docker}
CURL_BIN=${CURL_BIN:-curl}
SLEEP_BIN=${SLEEP_BIN:-sleep}
FLOCK_BIN=${FLOCK_BIN:-flock}
DEPLOY_LOCK_HELD=${DEPLOY_LOCK_HELD:-false}
HEALTH_MAX_ATTEMPTS=${HEALTH_MAX_ATTEMPTS:-30}
HEALTH_INTERVAL_SECONDS=${HEALTH_INTERVAL_SECONDS:-5}
PUBLIC_HEALTH_MAX_ATTEMPTS=${PUBLIC_HEALTH_MAX_ATTEMPTS:-10}
PUBLIC_HEALTH_RETRY_INTERVAL_SECONDS=${PUBLIC_HEALTH_RETRY_INTERVAL_SECONDS:-1}
DRAIN_SECONDS=${DRAIN_SECONDS:-30}
DEPENDENCY_TIMEOUT_SECONDS=${DEPENDENCY_TIMEOUT_SECONDS:-180}
STOP_MAX_ATTEMPTS=${STOP_MAX_ATTEMPTS:-3}
STOP_RETRY_INTERVAL_SECONDS=${STOP_RETRY_INTERVAL_SECONDS:-5}
DEFAULT_IMAGE=ghcr.io/lunarbae628/devchat-backend:dev
STATE_BACKUP=""
HAD_IMAGE_STATE=false

log() {
  printf '[devchat-deploy] %s\n' "$*"
}

fail() {
  log "실패: $*" >&2
  exit 1
}

cleanup() {
  [ -z "$STATE_BACKUP" ] || rm -f "$STATE_BACKUP"
}
trap cleanup EXIT

[ -d "$DEPLOY_DIR" ] || fail "배포 디렉터리가 없습니다: $DEPLOY_DIR"
[ -f "$COMPOSE_FILE" ] || fail "Compose 파일이 없습니다: $COMPOSE_FILE"
[ -f "$ENV_FILE" ] || fail "운영 환경변수 파일이 없습니다: $ENV_FILE"
[ -f "$GATEWAY_UPSTREAM_FILE" ] || fail "Gateway upstream 파일이 없습니다: $GATEWAY_UPSTREAM_FILE"

case "$DEPLOY_LOCK_HELD" in
  true|false) ;;
  *) fail "DEPLOY_LOCK_HELD 값은 true 또는 false여야 합니다" ;;
esac
if [ "$DEPLOY_LOCK_HELD" = false ]; then
  exec 9>"$LOCK_FILE"
  "$FLOCK_BIN" -n 9 || fail "다른 DevChat 배포가 실행 중입니다"
fi

"$DOCKER_BIN" network inspect devchat_proxy_net >/dev/null 2>&1 || \
  fail "외부 Docker 네트워크 devchat_proxy_net이 없습니다"

GATEWAY_RUNNING=$("$DOCKER_BIN" inspect --format '{{.State.Running}}' gateway-nginx 2>/dev/null || true)
[ "$GATEWAY_RUNNING" = true ] || fail "gateway-nginx 컨테이너가 실행 중이 아닙니다"

container_image() {
  local container=$1
  local image
  image=$("$DOCKER_BIN" inspect --format '{{.Config.Image}}' "$container" 2>/dev/null || true)
  if [ -n "$image" ]; then
    printf '%s\n' "$image"
  else
    printf '%s\n' "$DEFAULT_IMAGE"
  fi
}

write_image_state() {
  local blue_image=$1
  local green_image=$2
  local temp_file
  temp_file=$(mktemp "$DEPLOY_DIR/.deployment.images.yml.tmp.XXXXXX")
  cat > "$temp_file" <<EOF
services:
  devchat-app-blue:
    image: $blue_image
  devchat-app-green:
    image: $green_image
EOF
  mv "$temp_file" "$IMAGE_STATE_FILE"
}

compose() {
  "$DOCKER_BIN" compose \
    --env-file "$ENV_FILE" \
    -f "$COMPOSE_FILE" \
    -f "$IMAGE_STATE_FILE" \
    "$@"
}

write_active_color() {
  local color=$1
  local temp_file
  if [ -z "$color" ]; then
    rm -f "$ACTIVE_COLOR_FILE"
    return
  fi
  temp_file=$(mktemp "$DEPLOY_DIR/.active_color.tmp.XXXXXX")
  printf '%s\n' "$color" > "$temp_file"
  mv "$temp_file" "$ACTIVE_COLOR_FILE"
}

gateway_reload() {
  "$DOCKER_BIN" exec gateway-nginx nginx -t >/dev/null 2>&1 &&
    "$DOCKER_BIN" exec gateway-nginx nginx -s reload >/dev/null 2>&1
}

restore_file_atomically() {
  local source_file=$1
  local target_file=$2
  local temp_file
  temp_file=$(mktemp "$(dirname "$target_file")/.devchat-upstream.conf.restore.XXXXXX")
  cp "$source_file" "$temp_file"
  mv "$temp_file" "$target_file"
}

recover_interrupted_transaction() {
  local old_color
  local new_color
  local old_running
  local old_health

  [ -d "$TRANSACTION_DIR" ] || return 0
  [ -f "$TRANSACTION_DIR/old_color" ] || fail "중단된 배포의 old_color 상태가 없습니다"
  [ -f "$TRANSACTION_DIR/new_color" ] || fail "중단된 배포의 new_color 상태가 없습니다"
  [ -f "$TRANSACTION_DIR/upstream" ] || fail "중단된 배포의 upstream 백업이 없습니다"

  old_color=$(tr -d '[:space:]' < "$TRANSACTION_DIR/old_color")
  new_color=$(tr -d '[:space:]' < "$TRANSACTION_DIR/new_color")
  case "$old_color" in
    ""|blue|green) ;;
    *) fail "중단된 배포의 old_color 값이 올바르지 않습니다: $old_color" ;;
  esac
  case "$new_color" in
    blue|green) ;;
    *) fail "중단된 배포의 new_color 값이 올바르지 않습니다: $new_color" ;;
  esac

  if [ -n "$old_color" ]; then
    old_running=$("$DOCKER_BIN" inspect --format '{{.State.Running}}' "devchat-app-$old_color" 2>/dev/null || true)
    old_health=$("$DOCKER_BIN" inspect --format '{{.State.Health.Status}}' "devchat-app-$old_color" 2>/dev/null || true)
    if [ "$old_running" != true ] || [ "$old_health" != healthy ]; then
      fail "중단된 배포의 이전 $old_color 슬롯이 healthy 상태가 아니므로 현재 트래픽과 두 슬롯을 유지합니다"
    fi
  fi

  log "중단된 배포를 발견해 이전 upstream으로 복구합니다"
  restore_file_atomically "$TRANSACTION_DIR/upstream" "$GATEWAY_UPSTREAM_FILE"
  gateway_reload || fail "중단된 배포의 이전 upstream을 reload하지 못했습니다"
  write_active_color "$old_color"

  if [ -f "$IMAGE_STATE_FILE" ]; then
    compose --profile "$new_color" stop "devchat-app-$new_color" >/dev/null 2>&1 || true
  fi
  rm -rf "$TRANSACTION_DIR"
}

prepare_transaction() {
  local temp_dir
  [ ! -e "$TRANSACTION_DIR" ] || fail "미복구 배포 transaction이 이미 존재합니다"
  temp_dir=$(mktemp -d "$DEPLOY_DIR/.deploy.transaction.tmp.XXXXXX")
  printf '%s\n' "$ACTIVE_COLOR" > "$temp_dir/old_color"
  printf '%s\n' "$NEW_COLOR" > "$temp_dir/new_color"
  cp "$GATEWAY_UPSTREAM_FILE" "$temp_dir/upstream"
  mv "$temp_dir" "$TRANSACTION_DIR"
}

recover_interrupted_transaction

if [ -f "$ACTIVE_COLOR_FILE" ]; then
  ACTIVE_COLOR=$(tr -d '[:space:]' < "$ACTIVE_COLOR_FILE")
  case "$ACTIVE_COLOR" in
    blue|green) ;;
    *) fail "active_color 값이 올바르지 않습니다: $ACTIVE_COLOR" ;;
  esac
else
  ACTIVE_COLOR=""
fi

UPSTREAM_SERVICE=$(sed -n 's/.*server \(devchat-app-[a-z]*\):8080;.*/\1/p' "$GATEWAY_UPSTREAM_FILE" | head -1)
case "$UPSTREAM_SERVICE" in
  devchat-app-blue) UPSTREAM_COLOR=blue ;;
  devchat-app-green) UPSTREAM_COLOR=green ;;
  "") UPSTREAM_COLOR="" ;;
  *) fail "Gateway upstream 서비스명이 올바르지 않습니다: $UPSTREAM_SERVICE" ;;
esac
if [ "$ACTIVE_COLOR" != "$UPSTREAM_COLOR" ]; then
  fail "active_color($ACTIVE_COLOR)과 Gateway upstream($UPSTREAM_COLOR)이 일치하지 않습니다"
fi

if [ -n "$ACTIVE_COLOR" ]; then
  ACTIVE_HEALTH=$("$DOCKER_BIN" inspect --format '{{.State.Health.Status}}' "devchat-app-$ACTIVE_COLOR" 2>/dev/null || true)
  [ "$ACTIVE_HEALTH" = healthy ] || fail "활성 $ACTIVE_COLOR 슬롯이 healthy 상태가 아닙니다"
fi

if [ "$ACTIVE_COLOR" = blue ]; then
  NEW_COLOR=green
elif [ "$ACTIVE_COLOR" = green ]; then
  NEW_COLOR=blue
else
  NEW_COLOR=blue
fi

NEW_SERVICE="devchat-app-$NEW_COLOR"
NEW_CONTAINER="$NEW_SERVICE"
OLD_SERVICE=""
if [ -n "$ACTIVE_COLOR" ]; then
  OLD_SERVICE="devchat-app-$ACTIVE_COLOR"
fi

rollback_slot() {
  log "$NEW_COLOR 슬롯을 중지하고 이미지 상태를 복구합니다"
  compose --profile "$NEW_COLOR" stop "$NEW_SERVICE" >/dev/null 2>&1 || true
  if [ "$HAD_IMAGE_STATE" = true ]; then
    mv "$STATE_BACKUP" "$IMAGE_STATE_FILE"
    STATE_BACKUP=""
  else
    rm -f "$IMAGE_STATE_FILE"
  fi
}

write_upstream() {
  local color=$1
  local temp_file
  temp_file=$(mktemp "$(dirname "$GATEWAY_UPSTREAM_FILE")/.devchat-upstream.conf.tmp.XXXXXX")
  cat > "$temp_file" <<EOF
upstream devchat_backend {
    server devchat-app-$color:8080;
    keepalive 32;
}
EOF
  mv "$temp_file" "$GATEWAY_UPSTREAM_FILE"
}

restore_upstream() {
  restore_file_atomically "$TRANSACTION_DIR/upstream" "$GATEWAY_UPSTREAM_FILE"
  if ! gateway_reload; then
    log "이전 upstream 파일을 복구했지만 Nginx 검증 또는 reload에 실패했습니다"
    return 1
  fi
  rm -rf "$TRANSACTION_DIR"
}

BLUE_IMAGE=$(container_image devchat-app-blue)
GREEN_IMAGE=$(container_image devchat-app-green)

if [ -f "$IMAGE_STATE_FILE" ]; then
  HAD_IMAGE_STATE=true
  STATE_BACKUP=$(mktemp "$DEPLOY_DIR/.deployment.images.yml.backup.XXXXXX")
  cp "$IMAGE_STATE_FILE" "$STATE_BACKUP"
fi

if [ "$NEW_COLOR" = blue ]; then
  BLUE_IMAGE=$IMAGE
else
  GREEN_IMAGE=$IMAGE
fi
write_image_state "$BLUE_IMAGE" "$GREEN_IMAGE"

log "새 이미지 pull: $IMAGE"
if ! "$DOCKER_BIN" pull "$IMAGE"; then
  rollback_slot
  fail "이미지 pull에 실패했습니다"
fi

log "MySQL과 Redis 상태를 확인합니다"
if ! compose up -d --no-recreate --wait --wait-timeout "$DEPENDENCY_TIMEOUT_SECONDS" devchat-mysql devchat-redis; then
  rollback_slot
  fail "MySQL 또는 Redis가 정상 상태가 아닙니다"
fi

log "$NEW_COLOR 슬롯을 시작합니다"
if ! compose --profile "$NEW_COLOR" up -d --no-deps "$NEW_SERVICE"; then
  rollback_slot
  fail "$NEW_COLOR 슬롯을 시작하지 못했습니다"
fi

NEW_HEALTHY=false
attempt=1
while [ "$attempt" -le "$HEALTH_MAX_ATTEMPTS" ]; do
  HEALTH_STATUS=$("$DOCKER_BIN" inspect --format '{{.State.Health.Status}}' "$NEW_CONTAINER" 2>/dev/null || true)
  if [ "$HEALTH_STATUS" = healthy ]; then
    NEW_HEALTHY=true
    break
  fi
  "$SLEEP_BIN" "$HEALTH_INTERVAL_SECONDS"
  attempt=$((attempt + 1))
done

if [ "$NEW_HEALTHY" != true ]; then
  rollback_slot
  fail "$NEW_COLOR 슬롯이 제한 시간 안에 healthy 상태가 되지 않았습니다"
fi

prepare_transaction
write_upstream "$NEW_COLOR"

if ! "$DOCKER_BIN" exec gateway-nginx nginx -t; then
  if ! restore_upstream; then
    fail "이전 upstream 복구를 확인할 수 없어 두 슬롯을 실행 상태로 유지합니다"
  fi
  rollback_slot
  fail "새 Gateway upstream 설정 검증에 실패했습니다"
fi

if ! "$DOCKER_BIN" exec gateway-nginx nginx -s reload; then
  if ! restore_upstream; then
    fail "이전 upstream 복구를 확인할 수 없어 두 슬롯을 실행 상태로 유지합니다"
  fi
  rollback_slot
  fail "새 Gateway upstream reload에 실패했습니다"
fi

PUBLIC_HEALTHY=false
attempt=1
while [ "$attempt" -le "$PUBLIC_HEALTH_MAX_ATTEMPTS" ]; do
  if "$CURL_BIN" --fail --silent --show-error --max-time 10 --output /dev/null "$PUBLIC_HEALTH_URL"; then
    PUBLIC_HEALTHY=true
    break
  fi
  if [ "$attempt" -lt "$PUBLIC_HEALTH_MAX_ATTEMPTS" ]; then
    "$SLEEP_BIN" "$PUBLIC_HEALTH_RETRY_INTERVAL_SECONDS"
  fi
  attempt=$((attempt + 1))
done

if [ "$PUBLIC_HEALTHY" != true ]; then
  if ! restore_upstream; then
    fail "이전 upstream 복구를 확인할 수 없어 두 슬롯을 실행 상태로 유지합니다"
  fi
  rollback_slot
  fail "공용 Gateway를 통한 health check에 실패했습니다"
fi

write_active_color "$NEW_COLOR"
rm -rf "$TRANSACTION_DIR"

if [ -n "$OLD_SERVICE" ]; then
  log "기존 $ACTIVE_COLOR 슬롯의 연결을 ${DRAIN_SECONDS}초 동안 drain합니다"
  "$SLEEP_BIN" "$DRAIN_SECONDS"
  OLD_STOPPED=false
  stop_attempt=1
  while [ "$stop_attempt" -le "$STOP_MAX_ATTEMPTS" ]; do
    if compose --profile "$ACTIVE_COLOR" stop "$OLD_SERVICE"; then
      OLD_STOPPED=true
      break
    fi
    if [ "$stop_attempt" -lt "$STOP_MAX_ATTEMPTS" ]; then
      log "기존 $ACTIVE_COLOR 슬롯 중지 실패, 재시도합니다 ($stop_attempt/$STOP_MAX_ATTEMPTS)"
      "$SLEEP_BIN" "$STOP_RETRY_INTERVAL_SECONDS"
    fi
    stop_attempt=$((stop_attempt + 1))
  done
  if [ "$OLD_STOPPED" != true ]; then
    fail "새 $NEW_COLOR 슬롯 전환은 완료됐지만 기존 $ACTIVE_COLOR 슬롯을 중지하지 못했습니다"
  fi
fi

log "배포 완료: 활성 슬롯=$NEW_COLOR 이미지=$IMAGE"
