#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: analyze.sh <small|medium|high>" >&2
  exit 2
fi

case "$1" in
  small)
    scale=small
    chat_cursor=900
    ;;
  medium)
    scale=medium
    chat_cursor=9000
    ;;
  high)
    scale=high
    chat_cursor=90000
    ;;
  *)
    echo "scale must be small, medium, or high" >&2
    exit 2
    ;;
esac

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
source "$SCRIPT_DIR/lib.sh"

"$SCRIPT_DIR/verify.sh" "$scale"

results_dir="$QUERY_ANALYSIS_ROOT/results"
run_one="$results_dir/$scale-run-1.txt"
run_two="$results_dir/$scale-run-2.txt"
mkdir -p "$results_dir"
rm -f "$run_one" "$run_two"

run_analysis() {
  sed "s/__DM_MESSAGE_IDS__/$dm_message_ids/" "$QUERY_ANALYSIS_ROOT/sql/analyze.sql" | qa_mysql_unsafe \
    --batch \
    --raw \
    --skip-column-names \
    --init-command="SET @chat_cursor = $chat_cursor"
}

qa_assert_target
dm_message_ids=$(qa_mysql_unsafe --batch --skip-column-names -e "
  SELECT GROUP_CONCAT(id ORDER BY sent_at DESC, id DESC)
  FROM (
    SELECT id, sent_at
    FROM dm_message
    WHERE room_id = 1
    ORDER BY sent_at DESC, id DESC
    LIMIT 20
  ) latest_messages;")
[[ "$dm_message_ids" =~ ^[0-9]+(,[0-9]+){19}$ ]]
run_analysis >/dev/null
run_analysis > "$run_one"
run_analysis > "$run_two"

for label in \
  notification-all-select \
  notification-all-count \
  notification-unread-select \
  notification-unread-count \
  dm-history-select \
  dm-history-fetch-senders \
  dm-history-count \
  chat-history-first-page \
  chat-history-deep-cursor; do
  grep -Fxq "## $label" "$run_one"
  grep -Fxq "## $label" "$run_two"
done

echo "query-analysis $scale plans captured"
