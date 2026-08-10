#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: verify.sh <small|medium|high>" >&2
  exit 2
fi

case "$1" in
  small) target_rows=1000 ;;
  medium) target_rows=10000 ;;
  high) target_rows=100000 ;;
  *)
    echo "scale must be small, medium, or high" >&2
    exit 2
    ;;
esac

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
source "$SCRIPT_DIR/lib.sh"

qa_assert_target

assert_sql_value() {
  local expected=$1
  local sql=$2
  local actual
  actual=$(qa_mysql --skip-column-names --batch -e "$sql")
  if [[ "$actual" != "$expected" ]]; then
    echo "expected $expected, got $actual: $sql" >&2
    exit 1
  fi
}

assert_sql_value "$target_rows" "SELECT COUNT(*) FROM notification WHERE receiver_member_id = 1;"
assert_sql_value "$target_rows" "SELECT COUNT(*) FROM notification WHERE receiver_member_id = 2;"
assert_sql_value "$((target_rows / 5))" "SELECT COUNT(*) FROM notification WHERE receiver_member_id = 1 AND is_read = FALSE;"
assert_sql_value "$target_rows" "SELECT COUNT(*) FROM dm_message WHERE room_id = 1;"
assert_sql_value "$target_rows" "SELECT COUNT(*) FROM dm_message WHERE room_id = 2;"
assert_sql_value "$target_rows" "SELECT COUNT(*) FROM chat_message WHERE room_id = 1;"
assert_sql_value "$target_rows" "SELECT COUNT(*) FROM chat_message WHERE room_id = 2;"
assert_sql_value "1" "SELECT EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema = 'devchat_query_analysis' AND table_name = 'chat_message' AND index_name = 'idx_chat_room_messageid_desc');"
assert_sql_value "1" "SELECT EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema = 'devchat_query_analysis' AND table_name = 'dm_message' AND index_name = 'idx_dm_message_room_sent_at_id_desc');"
assert_sql_value "1" "SELECT EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema = 'devchat_query_analysis' AND table_name = 'notification' AND index_name = 'idx_notification_receiver_is_read');"

echo "query-analysis $1 dataset verified"
