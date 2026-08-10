#!/usr/bin/env bash
set -euo pipefail

QUERY_ANALYSIS_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
QUERY_ANALYSIS_COMPOSE_FILE="$QUERY_ANALYSIS_ROOT/docker-compose.yml"
QUERY_ANALYSIS_ENV_FILE="$QUERY_ANALYSIS_ROOT/.env"

if [[ ! -f "$QUERY_ANALYSIS_ENV_FILE" ]]; then
  QUERY_ANALYSIS_ENV_FILE="$QUERY_ANALYSIS_ROOT/.env.example"
fi

qa_compose() {
  docker compose \
    --project-name devchat-query-analysis \
    --env-file "$QUERY_ANALYSIS_ENV_FILE" \
    -f "$QUERY_ANALYSIS_COMPOSE_FILE" \
    "$@"
}

qa_mysql_unsafe() {
  qa_compose exec -T mysql mysql \
    -uquery_analysis \
    -pquery_analysis_local_only \
    --database=devchat_query_analysis \
    "$@"
}

qa_assert_config() {
  local container_name
  container_name=$(qa_compose config --format json | python3 -c 'import json,sys; print(json.load(sys.stdin)["services"]["mysql"]["container_name"])')
  [[ "$container_name" == "devchat-query-analysis-mysql" ]]
}

qa_assert_target() {
  qa_assert_config
  [[ "$(qa_mysql_unsafe --skip-column-names --batch -e 'SELECT DATABASE();')" == "devchat_query_analysis" ]]
}

qa_mysql() {
  qa_assert_target
  qa_mysql_unsafe "$@"
}

qa_wait_for_mysql() {
  local attempt
  for attempt in {1..30}; do
    if qa_mysql_unsafe --skip-column-names --batch -e 'SELECT 1;' >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done

  echo "query-analysis MySQL did not become ready" >&2
  return 1
}
