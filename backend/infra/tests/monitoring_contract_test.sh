#!/usr/bin/env bash
set -euo pipefail

INFRA_DIR=$(cd "$(dirname "$0")/.." && pwd)
CONFIG_JSON=$(docker compose \
  --env-file "$INFRA_DIR/.env.example" \
  --profile blue \
  -f "$INFRA_DIR/docker-compose.yml" \
  config --format json)

python3 -c '
import json
import pathlib
import sys

infra = pathlib.Path(sys.argv[1])
config = json.load(sys.stdin)
services = config["services"]

required = {
    "devchat-prometheus",
    "devchat-grafana",
    "devchat-loki",
    "devchat-promtail",
}
assert required <= set(services), f"모니터링 서비스 누락: {required - set(services)}"

prometheus = services["devchat-prometheus"]
assert "--storage.tsdb.retention.time=15d" in prometheus["command"]
assert set(prometheus["networks"]) == {"devchat_monitoring", "devchat_proxy_net"}
assert "ports" not in prometheus

grafana = services["devchat-grafana"]
assert grafana["environment"]["GF_SERVER_SERVE_FROM_SUB_PATH"] == "true"
assert grafana["environment"]["GF_SERVER_ROOT_URL"] == "https://api.devchat.o-r.kr/grafana/"
assert set(grafana["networks"]) == {"devchat_monitoring", "devchat_proxy_net"}

for name in ("devchat-loki", "devchat-promtail"):
    assert set(services[name]["networks"]) == {"devchat_monitoring"}

prometheus_config = (infra / "prometheus/prometheus.yml").read_text()
assert "gateway-nginx:8081" in prometheus_config
assert "metrics_path: /metrics/devchat" in prometheus_config

loki_config = (infra / "loki/config.yml").read_text()
assert "retention_period: 168h" in loki_config
assert "retention_enabled: true" in loki_config

promtail_config = (infra / "promtail/config.yml").read_text()
assert "__meta_docker_container_label_com_docker_compose_project" in promtail_config
assert "regex: devchat" in promtail_config
assert "action: keep" in promtail_config

datasources = (infra / "grafana/provisioning/datasources/datasources.yml").read_text()
assert "http://devchat-prometheus:9090" in datasources
assert "http://devchat-loki:3100" in datasources

print("DevChat 모니터링 계약 통과")
' "$INFRA_DIR" <<<"$CONFIG_JSON"
