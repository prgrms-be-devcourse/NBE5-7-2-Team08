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
GATEWAY_UPSTREAM_FILE=${GATEWAY_UPSTREAM_FILE:-/srv/gateway/nginx/conf.d/devchat-upstream.conf}
PUBLIC_HEALTH_URL=${PUBLIC_HEALTH_URL:-https://api.devchat.o-r.kr/actuator/health}
DOCKER_BIN=${DOCKER_BIN:-docker}
CURL_BIN=${CURL_BIN:-curl}
SLEEP_BIN=${SLEEP_BIN:-sleep}
FLOCK_BIN=${FLOCK_BIN:-flock}
HEALTH_MAX_ATTEMPTS=${HEALTH_MAX_ATTEMPTS:-30}
HEALTH_INTERVAL_SECONDS=${HEALTH_INTERVAL_SECONDS:-5}
DRAIN_SECONDS=${DRAIN_SECONDS:-30}
DEPENDENCY_TIMEOUT_SECONDS=${DEPENDENCY_TIMEOUT_SECONDS:-180}
DEFAULT_IMAGE=ghcr.io/lunarbae628/devchat-backend:dev
STATE_BACKUP=""
UPSTREAM_BACKUP=""
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
  [ -z "$UPSTREAM_BACKUP" ] || rm -f "$UPSTREAM_BACKUP"
}
trap cleanup EXIT

[ -d "$DEPLOY_DIR" ] || fail "배포 디렉터리가 없습니다: $DEPLOY_DIR"
[ -f "$COMPOSE_FILE" ] || fail "Compose 파일이 없습니다: $COMPOSE_FILE"
[ -f "$ENV_FILE" ] || fail "운영 환경변수 파일이 없습니다: $ENV_FILE"
[ -f "$GATEWAY_UPSTREAM_FILE" ] || fail "Gateway upstream 파일이 없습니다: $GATEWAY_UPSTREAM_FILE"

exec 9>"$LOCK_FILE"
"$FLOCK_BIN" -n 9 || fail "다른 DevChat 배포가 실행 중입니다"

"$DOCKER_BIN" network inspect devchat_proxy_net >/dev/null 2>&1 || \
  fail "외부 Docker 네트워크 devchat_proxy_net이 없습니다"

GATEWAY_RUNNING=$("$DOCKER_BIN" inspect --format '{{.State.Running}}' gateway-nginx 2>/dev/null || true)
[ "$GATEWAY_RUNNING" = true ] || fail "gateway-nginx 컨테이너가 실행 중이 아닙니다"

if [ -f "$ACTIVE_COLOR_FILE" ]; then
  ACTIVE_COLOR=$(tr -d '[:space:]' < "$ACTIVE_COLOR_FILE")
  case "$ACTIVE_COLOR" in
    blue|green) ;;
    *) fail "active_color 값이 올바르지 않습니다: $ACTIVE_COLOR" ;;
  esac
else
  ACTIVE_COLOR=""
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
  local temp_file
  temp_file=$(mktemp "$(dirname "$GATEWAY_UPSTREAM_FILE")/.devchat-upstream.conf.restore.XXXXXX")
  cp "$UPSTREAM_BACKUP" "$temp_file"
  mv "$temp_file" "$GATEWAY_UPSTREAM_FILE"

  if "$DOCKER_BIN" exec gateway-nginx nginx -t >/dev/null 2>&1; then
    "$DOCKER_BIN" exec gateway-nginx nginx -s reload >/dev/null 2>&1 || \
      log "경고: 이전 upstream 복구 후 Nginx reload에 실패했습니다"
  else
    log "경고: 이전 upstream 파일을 복구했지만 Nginx 검증에 실패했습니다"
  fi
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
if ! compose up -d --wait --wait-timeout "$DEPENDENCY_TIMEOUT_SECONDS" devchat-mysql devchat-redis; then
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

UPSTREAM_BACKUP=$(mktemp "$DEPLOY_DIR/.devchat-upstream.conf.backup.XXXXXX")
cp "$GATEWAY_UPSTREAM_FILE" "$UPSTREAM_BACKUP"
write_upstream "$NEW_COLOR"

if ! "$DOCKER_BIN" exec gateway-nginx nginx -t; then
  restore_upstream
  rollback_slot
  fail "새 Gateway upstream 설정 검증에 실패했습니다"
fi

if ! "$DOCKER_BIN" exec gateway-nginx nginx -s reload; then
  restore_upstream
  rollback_slot
  fail "새 Gateway upstream reload에 실패했습니다"
fi

if ! "$CURL_BIN" --fail --silent --show-error --max-time 10 --output /dev/null "$PUBLIC_HEALTH_URL"; then
  restore_upstream
  rollback_slot
  fail "공용 Gateway를 통한 health check에 실패했습니다"
fi

ACTIVE_TEMP=$(mktemp "$DEPLOY_DIR/.active_color.tmp.XXXXXX")
printf '%s\n' "$NEW_COLOR" > "$ACTIVE_TEMP"
mv "$ACTIVE_TEMP" "$ACTIVE_COLOR_FILE"

if [ -n "$OLD_SERVICE" ]; then
  log "기존 $ACTIVE_COLOR 슬롯의 연결을 ${DRAIN_SECONDS}초 동안 drain합니다"
  "$SLEEP_BIN" "$DRAIN_SECONDS"
  if ! compose --profile "$ACTIVE_COLOR" stop "$OLD_SERVICE"; then
    log "경고: 새 슬롯 전환은 성공했지만 기존 $ACTIVE_COLOR 슬롯 중지에 실패했습니다"
  fi
fi

log "배포 완료: 활성 슬롯=$NEW_COLOR 이미지=$IMAGE"
