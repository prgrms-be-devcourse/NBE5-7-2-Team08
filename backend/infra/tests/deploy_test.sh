#!/usr/bin/env bash
set -euo pipefail

INFRA_DIR=$(cd "$(dirname "$0")/.." && pwd)
TEST_ROOT=$(mktemp -d)

cleanup() {
  rm -rf "$TEST_ROOT"
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

assert_contains() {
  local file=$1
  local expected=$2
  grep -Fq -- "$expected" "$file" || fail "$file 에 '$expected' 없음"
}

assert_not_exists() {
  local path=$1
  [ ! -e "$path" ] || fail "$path 가 없어야 함"
}

create_fixture() {
  local scenario=$1
  local active_color=${2:-}
  local fixture
  fixture=$(mktemp -d "$TEST_ROOT/fixture.XXXXXX")

  mkdir -p "$fixture/bin" "$fixture/devchat" "$fixture/gateway"
  : > "$fixture/devchat/.env"
  cp "$INFRA_DIR/docker-compose.yml" "$fixture/devchat/docker-compose.yml"
  : > "$fixture/commands.log"

  if [ -n "$active_color" ]; then
    printf '%s\n' "$active_color" > "$fixture/devchat/active_color"
    printf 'upstream devchat_backend { server devchat-app-%s:8080; keepalive 32; }\n' \
      "$active_color" > "$fixture/gateway/devchat-upstream.conf"
  else
    printf 'upstream devchat_backend { server 127.0.0.1:65535; keepalive 32; }\n' \
      > "$fixture/gateway/devchat-upstream.conf"
  fi

  cat > "$fixture/bin/docker" <<'STUB'
#!/usr/bin/env bash
set -u
printf 'docker %s\n' "$*" >> "${COMMAND_LOG:?}"

case "$*" in
  "network inspect devchat_proxy_net") exit 0 ;;
  "inspect --format {{.State.Running}} gateway-nginx") echo true; exit 0 ;;
  "inspect --format {{.State.Running}} devchat-app-blue"|\
  "inspect --format {{.State.Running}} devchat-app-green") echo true; exit 0 ;;
  "inspect --format {{.Config.Image}} devchat-app-blue")
    echo ghcr.io/lunarbae628/devchat-backend:dev-oldblue; exit 0 ;;
  "inspect --format {{.Config.Image}} devchat-app-green")
    echo ghcr.io/lunarbae628/devchat-backend:dev-oldgreen; exit 0 ;;
  "inspect --format {{.State.Health.Status}} devchat-app-blue"|\
  "inspect --format {{.State.Health.Status}} devchat-app-green")
    if [ "${SCENARIO:?}" = "container_unhealthy" ]; then
      echo unhealthy
    elif [ "${SCENARIO:?}" = "old_unhealthy_recovery" ] && \
      [ "$*" = "inspect --format {{.State.Health.Status}} devchat-app-blue" ]; then
      echo unhealthy
    else
      echo healthy
    fi
    exit 0
    ;;
  "exec gateway-nginx nginx -t")
    NGINX_TEST_COUNT=$(grep -Fc 'docker exec gateway-nginx nginx -t' "${COMMAND_LOG:?}")
    if [ "${SCENARIO:?}" = "nginx_test_failure" ] && [ "$NGINX_TEST_COUNT" -eq 1 ]; then
      exit 1
    fi
    if [ "${SCENARIO:?}" = "rollback_nginx_test_failure" ] && [ "$NGINX_TEST_COUNT" -ge 2 ]; then
      exit 1
    fi
    exit 0
    ;;
  "exec gateway-nginx nginx -s reload")
    NGINX_RELOAD_COUNT=$(grep -Fc 'docker exec gateway-nginx nginx -s reload' "${COMMAND_LOG:?}")
    if [ "${SCENARIO:?}" = "rollback_nginx_reload_failure" ] && [ "$NGINX_RELOAD_COUNT" -ge 2 ]; then
      exit 1
    fi
    exit 0
    ;;
  pull*)
    if [ "${SCENARIO:?}" = "pull_failure" ]; then
      exit 1
    fi
    exit 0
    ;;
  compose*)
    if [ "${SCENARIO:?}" = "old_slot_stop_failure" ] && \
      printf '%s' "$*" | grep -Fq -- "stop devchat-app-blue"; then
      exit 1
    fi
    exit 0
    ;;
esac

echo "지원하지 않는 docker 호출: $*" >&2
exit 64
STUB

  cat > "$fixture/bin/curl" <<'STUB'
#!/usr/bin/env bash
printf 'curl %s\n' "$*" >> "${COMMAND_LOG:?}"
case "${SCENARIO:?}" in
  public_health_reload_race)
    CURL_COUNT=$(grep -Fc 'curl ' "${COMMAND_LOG:?}")
    [ "$CURL_COUNT" -gt 1 ]
    ;;
  public_health_failure|rollback_nginx_test_failure|rollback_nginx_reload_failure) exit 1 ;;
  *) exit 0 ;;
esac
STUB

  cat > "$fixture/bin/sleep" <<'STUB'
#!/usr/bin/env bash
printf 'sleep %s\n' "$*" >> "${COMMAND_LOG:?}"
STUB

  cat > "$fixture/bin/flock" <<'STUB'
#!/usr/bin/env bash
printf 'flock %s\n' "$*" >> "${COMMAND_LOG:?}"
[ "${SCENARIO:?}" != "lock_failure" ]
STUB

  chmod +x "$fixture/bin/docker" "$fixture/bin/curl" "$fixture/bin/sleep" "$fixture/bin/flock"
  printf '%s\n' "$fixture"
}

run_deploy() {
  local fixture=$1
  local scenario=$2

  SCENARIO="$scenario" \
  COMMAND_LOG="$fixture/commands.log" \
  DEPLOY_DIR="$fixture/devchat" \
  GATEWAY_UPSTREAM_FILE="$fixture/gateway/devchat-upstream.conf" \
  DOCKER_BIN="$fixture/bin/docker" \
  CURL_BIN="$fixture/bin/curl" \
  SLEEP_BIN="$fixture/bin/sleep" \
  FLOCK_BIN="$fixture/bin/flock" \
  DEPLOY_LOCK_HELD="${DEPLOY_LOCK_HELD_OVERRIDE:-false}" \
  HEALTH_MAX_ATTEMPTS=2 \
  HEALTH_INTERVAL_SECONDS=0 \
  PUBLIC_HEALTH_MAX_ATTEMPTS=3 \
  PUBLIC_HEALTH_RETRY_INTERVAL_SECONDS=1 \
  DRAIN_SECONDS=0 \
  PUBLIC_HEALTH_URL=https://api.devchat.o-r.kr/actuator/health \
  bash "$INFRA_DIR/deploy.sh" ghcr.io/lunarbae628/devchat-backend:dev-abcdef0
}

test_first_deploy_success() {
  local fixture
  fixture=$(create_fixture success)

  run_deploy "$fixture" success || fail "최초 배포가 성공해야 함"

  [ "$(cat "$fixture/devchat/active_color")" = blue ] || fail "최초 활성 색상은 blue여야 함"
  assert_contains "$fixture/gateway/devchat-upstream.conf" "server devchat-app-blue:8080;"
  assert_contains "$fixture/commands.log" "docker pull ghcr.io/lunarbae628/devchat-backend:dev-abcdef0"
  assert_contains "$fixture/commands.log" "up -d --no-recreate --wait"
  assert_contains "$fixture/commands.log" "docker exec gateway-nginx nginx -s reload"
  assert_contains "$fixture/commands.log" "curl --fail"
}

test_unhealthy_container_keeps_current_upstream() {
  local fixture
  fixture=$(create_fixture container_unhealthy)

  if run_deploy "$fixture" container_unhealthy; then
    fail "비정상 컨테이너 배포는 실패해야 함"
  fi

  assert_not_exists "$fixture/devchat/active_color"
  assert_contains "$fixture/gateway/devchat-upstream.conf" "server 127.0.0.1:65535;"
  assert_contains "$fixture/commands.log" "stop devchat-app-blue"
}

test_nginx_validation_failure_rolls_back() {
  local fixture
  fixture=$(create_fixture nginx_test_failure blue)

  if run_deploy "$fixture" nginx_test_failure; then
    fail "Nginx 검증 실패 배포는 실패해야 함"
  fi

  [ "$(cat "$fixture/devchat/active_color")" = blue ] || fail "활성 색상 blue를 유지해야 함"
  assert_contains "$fixture/gateway/devchat-upstream.conf" "server devchat-app-blue:8080;"
  assert_contains "$fixture/commands.log" "stop devchat-app-green"
}

test_public_health_failure_rolls_back() {
  local fixture
  fixture=$(create_fixture public_health_failure blue)

  if run_deploy "$fixture" public_health_failure; then
    fail "공용 health 실패 배포는 실패해야 함"
  fi

  [ "$(cat "$fixture/devchat/active_color")" = blue ] || fail "활성 색상 blue를 유지해야 함"
  assert_contains "$fixture/gateway/devchat-upstream.conf" "server devchat-app-blue:8080;"
  assert_contains "$fixture/commands.log" "stop devchat-app-green"
  [ "$(grep -Fc 'docker exec gateway-nginx nginx -s reload' "$fixture/commands.log")" -eq 2 ] || \
    fail "전환과 롤백 reload가 각각 필요함"
}

test_public_health_retries_after_nginx_reload() {
  local fixture
  fixture=$(create_fixture public_health_reload_race)

  run_deploy "$fixture" public_health_reload_race || \
    fail "Nginx reload 직후 첫 health 실패는 재시도해야 함"

  [ "$(grep -Fc 'curl --fail' "$fixture/commands.log")" -eq 2 ] || \
    fail "공용 health를 성공할 때까지 재시도해야 함"
  assert_contains "$fixture/commands.log" "sleep 1"
  [ "$(cat "$fixture/devchat/active_color")" = blue ] || fail "재시도 성공 후 blue가 활성화되어야 함"
}

test_failed_rollback_keeps_both_slots_running() {
  local scenario=$1
  local fixture
  fixture=$(create_fixture "$scenario" blue)

  if run_deploy "$fixture" "$scenario"; then
    fail "Nginx 복구 실패 배포는 실패해야 함: $scenario"
  fi

  [ "$(cat "$fixture/devchat/active_color")" = blue ] || fail "기존 활성 색상은 변경하지 않아야 함"
  if grep -Fq -- "stop devchat-app-green" "$fixture/commands.log"; then
    fail "트래픽 복구가 확인되지 않으면 green 슬롯을 중지하면 안 됨: $scenario"
  fi
}

test_second_deploy_switches_to_green_and_stops_blue() {
  local fixture
  fixture=$(create_fixture success blue)

  run_deploy "$fixture" success || fail "두 번째 배포가 성공해야 함"

  [ "$(cat "$fixture/devchat/active_color")" = green ] || fail "활성 색상은 green이어야 함"
  assert_contains "$fixture/gateway/devchat-upstream.conf" "server devchat-app-green:8080;"
  assert_contains "$fixture/commands.log" "stop devchat-app-blue"
}

test_interrupted_switch_is_recovered_before_deploy() {
  local fixture
  fixture=$(create_fixture pull_failure green)
  mkdir "$fixture/devchat/deploy.transaction"
  printf '%s\n' blue > "$fixture/devchat/deploy.transaction/old_color"
  printf '%s\n' green > "$fixture/devchat/deploy.transaction/new_color"
  printf 'upstream devchat_backend { server devchat-app-blue:8080; keepalive 32; }\n' \
    > "$fixture/devchat/deploy.transaction/upstream"

  if run_deploy "$fixture" pull_failure; then
    fail "이미지 pull 실패 배포는 실패해야 함"
  fi

  [ "$(cat "$fixture/devchat/active_color")" = blue ] || fail "중단된 전환은 blue로 복구해야 함"
  assert_contains "$fixture/gateway/devchat-upstream.conf" "server devchat-app-blue:8080;"
  assert_not_exists "$fixture/devchat/deploy.transaction"
  assert_contains "$fixture/commands.log" "docker exec gateway-nginx nginx -s reload"
}

test_interrupted_switch_keeps_current_traffic_when_old_is_unhealthy() {
  local fixture
  fixture=$(create_fixture old_unhealthy_recovery green)
  mkdir "$fixture/devchat/deploy.transaction"
  printf '%s\n' blue > "$fixture/devchat/deploy.transaction/old_color"
  printf '%s\n' green > "$fixture/devchat/deploy.transaction/new_color"
  printf 'upstream devchat_backend { server devchat-app-blue:8080; keepalive 32; }\n' \
    > "$fixture/devchat/deploy.transaction/upstream"

  if run_deploy "$fixture" old_unhealthy_recovery; then
    fail "이전 슬롯이 비정상이면 중단 배포 복구를 진행하면 안 됨"
  fi

  [ "$(cat "$fixture/devchat/active_color")" = green ] || fail "현재 활성 green을 유지해야 함"
  assert_contains "$fixture/gateway/devchat-upstream.conf" "server devchat-app-green:8080;"
  [ -d "$fixture/devchat/deploy.transaction" ] || fail "수동 복구를 위해 transaction을 유지해야 함"
  if grep -Fq -- "nginx -s reload" "$fixture/commands.log"; then
    fail "비정상인 이전 슬롯으로 트래픽을 전환하면 안 됨"
  fi
  if grep -Fq -- "stop devchat-app-green" "$fixture/commands.log"; then
    fail "현재 트래픽을 처리하는 green 슬롯을 중지하면 안 됨"
  fi
}

test_old_slot_stop_failure_is_reported() {
  local fixture
  fixture=$(create_fixture old_slot_stop_failure blue)

  if run_deploy "$fixture" old_slot_stop_failure; then
    fail "이전 슬롯 정리 실패를 성공으로 보고하면 안 됨"
  fi

  [ "$(cat "$fixture/devchat/active_color")" = green ] || fail "새 활성 green은 유지해야 함"
  assert_contains "$fixture/gateway/devchat-upstream.conf" "server devchat-app-green:8080;"
  [ "$(grep -Fc 'stop devchat-app-blue' "$fixture/commands.log")" -eq 3 ] || \
    fail "기존 blue 슬롯 중지를 3회 시도해야 함"
}

test_active_color_upstream_mismatch_stops_before_pull() {
  local fixture
  fixture=$(create_fixture success blue)
  printf 'upstream devchat_backend { server devchat-app-green:8080; keepalive 32; }\n' \
    > "$fixture/gateway/devchat-upstream.conf"

  if run_deploy "$fixture" success; then
    fail "활성 색상과 upstream 불일치 상태에서는 배포를 시작하면 안 됨"
  fi

  if grep -Fq -- "docker pull" "$fixture/commands.log"; then
    fail "상태 불일치 검증 전에 이미지를 pull하면 안 됨"
  fi
}

test_external_lock_holder_skips_internal_flock() {
  local fixture
  fixture=$(create_fixture lock_failure)

  DEPLOY_LOCK_HELD_OVERRIDE=true run_deploy "$fixture" lock_failure || \
    fail "외부 lock 보유 상태에서는 내부 flock 없이 배포해야 함"

  if grep -Fq -- "flock " "$fixture/commands.log"; then
    fail "외부 lock 보유 상태에서 flock을 다시 획득하면 안 됨"
  fi
}

test_first_deploy_success
test_unhealthy_container_keeps_current_upstream
test_nginx_validation_failure_rolls_back
test_public_health_failure_rolls_back
test_public_health_retries_after_nginx_reload
test_failed_rollback_keeps_both_slots_running rollback_nginx_test_failure
test_failed_rollback_keeps_both_slots_running rollback_nginx_reload_failure
test_second_deploy_switches_to_green_and_stops_blue
test_interrupted_switch_is_recovered_before_deploy
test_interrupted_switch_keeps_current_traffic_when_old_is_unhealthy
test_old_slot_stop_failure_is_reported
test_active_color_upstream_mismatch_stops_before_pull
test_external_lock_holder_skips_internal_flock

echo "배포 스크립트 테스트 통과"
