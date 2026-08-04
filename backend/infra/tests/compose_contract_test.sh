#!/usr/bin/env bash
set -euo pipefail

INFRA_DIR=$(cd "$(dirname "$0")/.." && pwd)

ruby - "$INFRA_DIR/docker-compose.yml" <<'RUBY'
require "yaml"

config = YAML.load_file(ARGV.fetch(0))
services = config.fetch("services")

%w[devchat-mysql devchat-redis devchat-app-blue devchat-app-green].each do |service|
  raise "서비스 누락: #{service}" unless services.key?(service)
end

%w[blue green].each do |color|
  app = services.fetch("devchat-app-#{color}")
  raise "#{color} 컨테이너 이름 오류" unless app.fetch("container_name") == "devchat-app-#{color}"
  raise "#{color} 프로필 오류" unless app.fetch("profiles") == [color]
  raise "#{color} 메모리 제한 오류" unless app.fetch("mem_limit") == "1536m"
  raise "#{color} JVM 설정 오류" unless app.fetch("environment").fetch("JAVA_OPTS") == "${JAVA_OPTS:--Xms256m -Xmx1g}"
  raise "#{color} 내부 네트워크 누락" unless app.fetch("networks").include?("devchat_internal")
  raise "#{color} 프록시 네트워크 누락" unless app.fetch("networks").include?("devchat_proxy_net")
end

puts "Compose Blue/Green 계약 통과"
RUBY
