#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)

test -f "$ROOT/docker-compose.yml"
test -f "$ROOT/.env.example"
test -f "$ROOT/scripts/lib.sh"

config=$(docker compose \
  --project-name devchat-query-analysis \
  --env-file "$ROOT/.env.example" \
  -f "$ROOT/docker-compose.yml" \
  config --format json)

python3 -c '
import json
import sys

service = json.load(sys.stdin)["services"]["mysql"]
assert service["container_name"] == "devchat-query-analysis-mysql"
assert service["image"] == "mysql:8.4"
assert service["environment"]["MYSQL_DATABASE"] == "devchat_query_analysis"
assert service["volumes"]
assert service["ports"][0]["target"] == 3306
assert service["ports"][0]["published"] == "3307"
assert service["ports"][0]["host_ip"] == "127.0.0.1"
' <<<"$config"

echo "query-analysis Compose contract passed"

test -f "$ROOT/scripts/reset.sh"
test -f "$ROOT/scripts/seed.sh"
test -f "$ROOT/scripts/verify.sh"
test -f "$ROOT/sql/seed.sql"
grep -Fq "SELECT EXISTS(SELECT 1 FROM information_schema.statistics" "$ROOT/scripts/verify.sh"
test -f "$ROOT/sql/analyze.sql"
test -f "$ROOT/scripts/analyze.sh"
test -f "$ROOT/scripts/compare_dm.sh"
grep -Fq "## notification-all-select" "$ROOT/sql/analyze.sql"
grep -Fq "## dm-history-count" "$ROOT/sql/analyze.sql"
grep -Fq "## dm-history-fetch-senders" "$ROOT/sql/analyze.sql"
grep -Fq "## dm-history-offset-0" "$ROOT/sql/analyze.sql"
grep -Fq "## dm-history-offset-deep" "$ROOT/sql/analyze.sql"
grep -Fq "## dm-history-deep-cursor" "$ROOT/sql/analyze.sql"
grep -Fq "## chat-history-deep-cursor" "$ROOT/sql/analyze.sql"
test ! -e "$ROOT/scripts/measure_dm_api.sh"
test -f "$ROOT/scripts/measure_dm_api.js"
fixture_ids=1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20

MODE=before \
BASE_URL=http://127.0.0.1:1 \
AUTH_COOKIE=accessToken=contract-test \
ROOM_ID=1 \
EXPECTED_FIRST_IDS=$fixture_ids \
EXPECTED_DEEP_IDS=$fixture_ids \
k6 inspect --include-system-env-vars "$ROOT/scripts/measure_dm_api.js" >/dev/null

MODE=after \
BASE_URL=http://127.0.0.1:1 \
AUTH_COOKIE=accessToken=contract-test \
ROOM_ID=1 \
DEEP_CURSOR_SENT_AT=2026-01-01T00:00:00 \
DEEP_CURSOR_ID=5 \
EXPECTED_FIRST_IDS=$fixture_ids \
EXPECTED_DEEP_IDS=$fixture_ids \
k6 inspect --include-system-env-vars "$ROOT/scripts/measure_dm_api.js" >/dev/null

MODE=after \
BASE_URL=http://127.0.0.1:1 \
AUTH_COOKIE=accessToken=contract-test \
ROOM_ID=1 \
DEEP_CURSOR_SENT_AT=2026-01-01T00:00:00 \
DEEP_CURSOR_ID=5 \
EXPECTED_FIRST_IDS=$fixture_ids \
EXPECTED_DEEP_IDS=$fixture_ids \
k6 run --quiet "$ROOT/tests/dm_api_contract_test.js" >/dev/null
test -f "$ROOT/scripts/measure_write_cost.sh"
test -f "$ROOT/README.md"
test -f "$ROOT/results/summary.md"
grep -Fq "scripts/reset.sh" "$ROOT/README.md"
grep -Fq "actual rows" "$ROOT/README.md"
grep -Eq '선택: (없음|알림 전체|읽지 않은 알림|DM)' "$ROOT/results/summary.md"
git check-ignore -q "$ROOT/results/small-run-1.txt"
git check-ignore -q "$ROOT/results/high-api-a-run-1.json"
! git check-ignore -q "$ROOT/results/summary.md"

if "$ROOT/scripts/seed.sh" large; then
  echo "large must be rejected in first-phase analysis" >&2
  exit 1
fi

if "$ROOT/scripts/compare_dm.sh" large; then
  echo "compare_dm must reject unsupported scales" >&2
  exit 1
fi

if "$ROOT/scripts/reset.sh" unexpected; then
  echo "reset must reject arguments" >&2
  exit 1
fi

echo "query-analysis seed contract passed"
