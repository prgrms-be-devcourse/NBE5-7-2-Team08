#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: seed.sh <small|medium|high>" >&2
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
qa_mysql_unsafe --init-command="SET @target_rows = $target_rows" < "$QUERY_ANALYSIS_ROOT/sql/seed.sql"
"$SCRIPT_DIR/verify.sh" "$1"

echo "query-analysis $1 dataset seeded"
