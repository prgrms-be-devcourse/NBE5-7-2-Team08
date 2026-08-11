#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: measure_write_cost.sh <small|medium|high>" >&2
  exit 2
fi

case "$1" in
  small|medium|high) scale=$1 ;;
  *) echo "scale must be small, medium, or high" >&2; exit 2 ;;
esac

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
source "$SCRIPT_DIR/lib.sh"

results_file="$QUERY_ANALYSIS_ROOT/results/$scale-write-cost.txt"
dm_index=idx_dm_message_room_sent_at_id_desc
notification_index=idx_notification_receiver_is_read

index_exists() {
  local table_name=$1
  local index_name=$2
  qa_mysql_unsafe --batch --skip-column-names -e "
    SELECT EXISTS(
      SELECT 1 FROM information_schema.statistics
      WHERE table_schema = 'devchat_query_analysis'
        AND table_name = '$table_name'
        AND index_name = '$index_name'
    );"
}

restore_indexes() {
  if [[ "$(index_exists dm_message "$dm_index")" == "0" ]]; then
    qa_mysql_unsafe -e "ALTER TABLE dm_message ADD INDEX $dm_index (room_id, sent_at DESC, id DESC);"
  fi
  if [[ "$(index_exists notification "$notification_index")" == "0" ]]; then
    qa_mysql_unsafe -e "ALTER TABLE notification ADD INDEX $notification_index (receiver_member_id, is_read);"
  fi
}

cleanup_and_restore() {
  qa_mysql_unsafe -e "
    DELETE FROM dm_message WHERE content LIKE '__write_probe_dm_%';
    DELETE FROM notification WHERE reference_id < 0;" || true
  restore_indexes
}

run_insert_pair() {
  local phase=$1
  local run=$2
  qa_mysql_unsafe --batch --raw --skip-column-names -e "
    SET @started_at = NOW(6);
    INSERT INTO dm_message (content, sent_at, type, room_id, sender_id)
    WITH RECURSIVE seq AS (
      SELECT 0 AS n UNION ALL SELECT n + 1 FROM seq WHERE n < 999
    )
    SELECT CONCAT('__write_probe_dm_', n), TIMESTAMP('2030-01-01 00:00:00') + INTERVAL n MICROSECOND,
           'TEXT', 1, 1
    FROM seq;
    SELECT CONCAT('dm-$phase-run-$run-us=', TIMESTAMPDIFF(MICROSECOND, @started_at, NOW(6)));
    DELETE FROM dm_message WHERE content LIKE '__write_probe_dm_%';

    SET @started_at = NOW(6);
    INSERT INTO notification (created_at, is_read, reference_id, type, receiver_member_id, sender_member_id)
    WITH RECURSIVE seq AS (
      SELECT 0 AS n UNION ALL SELECT n + 1 FROM seq WHERE n < 999
    )
    SELECT TIMESTAMP('2030-01-01 00:00:00') + INTERVAL n MICROSECOND,
           MOD(n, 5) <> 0, -(n + 1), 'NEW_DM', 1, 2
    FROM seq;
    SELECT CONCAT('notification-$phase-run-$run-us=', TIMESTAMPDIFF(MICROSECOND, @started_at, NOW(6)));
    DELETE FROM notification WHERE reference_id < 0;"
}

record_index_sizes() {
  local phase=$1
  qa_mysql_unsafe --batch --raw --skip-column-names -e "
    ANALYZE TABLE dm_message, notification;
    SELECT CONCAT('dm-$phase-total-index-bytes=', index_length)
    FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'dm_message';
    SELECT CONCAT('notification-$phase-total-index-bytes=', index_length)
    FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'notification';"
}

qa_assert_target
"$SCRIPT_DIR/verify.sh" "$scale"
[[ "$(index_exists dm_message "$dm_index")" == "1" ]]
[[ "$(index_exists notification "$notification_index")" == "1" ]]
trap cleanup_and_restore EXIT

qa_mysql_unsafe -e "ALTER TABLE dm_message DROP INDEX $dm_index; ALTER TABLE notification DROP INDEX $notification_index;"
run_insert_pair before warmup >/dev/null
{
  run_insert_pair before 1
  run_insert_pair before 2
  record_index_sizes before
} > "$results_file"

restore_indexes
run_insert_pair after warmup >/dev/null
{
  run_insert_pair after 1
  run_insert_pair after 2
  record_index_sizes after
} >> "$results_file"

"$SCRIPT_DIR/verify.sh" "$scale" >/dev/null
trap - EXIT
echo "query-analysis $scale write costs captured"
