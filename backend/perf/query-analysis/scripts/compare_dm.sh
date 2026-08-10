#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: compare_dm.sh <small|medium|high>" >&2
  exit 2
fi

case "$1" in
  small|medium|high) scale=$1 ;;
  *)
    echo "scale must be small, medium, or high" >&2
    exit 2
    ;;
esac

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
source "$SCRIPT_DIR/lib.sh"

"$SCRIPT_DIR/verify.sh" "$scale"

index_exists() {
  qa_mysql_unsafe --batch --skip-column-names -e "
    SELECT EXISTS(
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = 'devchat_query_analysis'
        AND table_name = 'dm_message'
        AND index_name = 'idx_dm_message_room_sent_at_id_desc'
    );"
}

restore_index() {
  if [[ "$(index_exists)" == "0" ]]; then
    qa_mysql_unsafe -e "
      ALTER TABLE dm_message
      ADD INDEX idx_dm_message_room_sent_at_id_desc (room_id, sent_at DESC, id DESC);"
  fi
}

run_before() {
  qa_mysql_unsafe --batch --raw --skip-column-names \
    < "$QUERY_ANALYSIS_ROOT/sql/analyze-dm-before.sql"
}

qa_assert_target
[[ "$(index_exists)" == "1" ]]
trap restore_index EXIT

qa_mysql_unsafe -e "ALTER TABLE dm_message DROP INDEX idx_dm_message_room_sent_at_id_desc;"
run_before >/dev/null
run_before > "$QUERY_ANALYSIS_ROOT/results/$scale-dm-before-run-1.txt"
run_before > "$QUERY_ANALYSIS_ROOT/results/$scale-dm-before-run-2.txt"

restore_index
trap - EXIT
"$SCRIPT_DIR/analyze.sh" "$scale"

echo "query-analysis $scale DM before/after plans captured"
