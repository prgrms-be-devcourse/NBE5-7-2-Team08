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
  "inspect --format {{.Config.Image}} devchat-app-blue")
    echo ghcr.io/lunarbae628/devchat-backend:dev-oldblue; exit 0 ;;
  "inspect --format {{.Config.Image}} devchat-app-green")
    echo ghcr.io/lunarbae628/devchat-backend:dev-oldgreen; exit 0 ;;
  "inspect --format {{.State.Health.Status}} devchat-app-blue"|\
  "inspect --format {{.State.Health.Status}} devchat-app-green")
    if [ "${SCENARIO:?}" = "container_unhealthy" ]; then
      echo unhealthy
    else
      echo healthy
    fi
    exit 0
    ;;
  "exec gateway-nginx nginx -t")
    if [ "${SCENARIO:?}" = "nginx_test_failure" ]; then
      exit 1
    fi
    exit 0
    ;;
  "exec gateway-nginx nginx -s reload") exit 0 ;;
  pull*) exit 0 ;;
  compose*) exit 0 ;;
esac

echo "지원하지 않는 docker 호출: $*" >&2
exit 64
STUB

  cat > "$fixture/bin/curl" <<'STUB'
#!/usr/bin/env bash
printf 'curl %s\n' "$*" >> "${COMMAND_LOG:?}"
[ "${SCENARIO:?}" != "public_health_failure" ]
STUB

  cat > "$fixture/bin/sleep" <<'STUB'
#!/usr/bin/env bash
printf 'sleep %s\n' "$*" >> "${COMMAND_LOG:?}"
STUB

  cat > "$fixture/bin/flock" <<'STUB'
#!/usr/bin/env bash
exit 0
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
  HEALTH_MAX_ATTEMPTS=2 \
  HEALTH_INTERVAL_SECONDS=0 \
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

test_second_deploy_switches_to_green_and_stops_blue() {
  local fixture
  fixture=$(create_fixture success blue)

  run_deploy "$fixture" success || fail "두 번째 배포가 성공해야 함"

  [ "$(cat "$fixture/devchat/active_color")" = green ] || fail "활성 색상은 green이어야 함"
  assert_contains "$fixture/gateway/devchat-upstream.conf" "server devchat-app-green:8080;"
  assert_contains "$fixture/commands.log" "stop devchat-app-blue"
}

test_first_deploy_success
test_unhealthy_container_keeps_current_upstream
test_nginx_validation_failure_rolls_back
test_public_health_failure_rolls_back
test_second_deploy_switches_to_green_and_stops_blue

echo "배포 스크립트 테스트 통과"
