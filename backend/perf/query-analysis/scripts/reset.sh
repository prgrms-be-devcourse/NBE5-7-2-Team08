#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 0 ]]; then
  echo "usage: reset.sh" >&2
  exit 2
fi

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
source "$SCRIPT_DIR/lib.sh"

qa_assert_config

if qa_compose ps --status running --services | grep -qx mysql; then
  qa_assert_target
fi

qa_compose down --volumes
qa_compose up -d
qa_wait_for_mysql
qa_assert_target

echo "query-analysis database reset complete"
