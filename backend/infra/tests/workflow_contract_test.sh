#!/usr/bin/env bash
set -euo pipefail

REPO_DIR=$(cd "$(dirname "$0")/../../.." && pwd)
WORKFLOW="$REPO_DIR/.github/workflows/ci-cd.yml"

ruby - "$WORKFLOW" <<'RUBY'
require "yaml"

path = ARGV.fetch(0)
text = File.read(path)
config = YAML.load_file(path)
jobs = config.fetch("jobs")

%w[verify publish deploy].each do |job|
  raise "job 누락: #{job}" unless jobs.key?(job)
end

raise "verify에 packages 쓰기 권한이 있으면 안 됨" if jobs.fetch("verify").fetch("permissions", {}).key?("packages")
raise "publish에 packages: write 필요" unless jobs.fetch("publish").dig("permissions", "packages") == "write"
deploy = jobs.fetch("deploy")
raise "deploy에 packages: read 필요" unless deploy.dig("permissions", "packages") == "read"
raise "Docker context는 backend여야 함" unless text.scan(/^\s+context: backend$/).length == 2
raise "Dockerfile 경로 오류" unless text.scan(/^\s+file: backend\/Dockerfile$/).length == 2
raise "Docsa 배포 참조 금지" if text.include?("/srv/docsa")
raise "레거시 EC2 secret 참조 금지" if text.include?("EC2_")
raise "사용하지 않는 수동 입력 금지" if text.include?("workflow_dispatch")
raise "불변 이미지 output 누락" unless text.include?("needs.publish.outputs.image")
raise "홈서버 release 배포 스크립트 호출 누락" unless text.include?('"$release_dir/deploy.sh" "$image"')
raise "SHA별 release 디렉터리 누락" unless text.include?("/srv/devchat/releases/")
raise "release 임시 디렉터리 누락" unless text.include?(".incoming")
raise "배포 파일 설치 lock 누락" unless text.include?("flock -w 600 9")
raise "외부 lock 전달 누락" unless text.include?("DEPLOY_LOCK_HELD=true")
raise "release별 Compose 지정 누락" unless text.include?('COMPOSE_FILE="$release_dir/docker-compose.yml"')
raise "현재 release 전환 누락" unless text.include?("/srv/devchat/current")
raise "모니터링 설정 재귀 복사 누락" unless text.include?("scp -r -P")
%w[prometheus grafana loki promtail].each do |directory|
  raise "모니터링 설정 복사 누락: #{directory}" unless text.include?("backend/infra/#{directory}")
  raise "release 설정 검증 누락: #{directory}" unless text.include?("$incoming_dir/#{directory}")
end
raise "Node.js 설정 누락" unless text.include?("actions/setup-node@v4")
raise "프런트 의존성 설치 누락" unless text.include?("npm ci")
raise "WebSocket 재연결 테스트 누락" unless text.include?("WebSocketContext.test.js")
raise "프런트 빌드는 Cloudflare에 위임해야 함" if text.include?("npm run build")
raise "github.actor 사용 누락" unless text.include?("github.actor")
raise "github.token 사용 누락" unless text.include?("github.token")
raise "장기 GHCR username secret 사용 금지" if text.include?("secrets.GHCR_USERNAME")
raise "장기 GHCR token secret 사용 금지" if text.include?("secrets.GHCR_READ_TOKEN")
raise "GHCR 로그아웃 누락" unless text.include?("docker logout ghcr.io")
raise "GHCR 로그아웃은 항상 실행해야 함" unless text.include?("if: always()")

%w[
  backend/infra/tests/compose_contract_test.sh
  backend/infra/tests/deploy_test.sh
  backend/infra/tests/monitoring_contract_test.sh
  backend/infra/tests/workflow_contract_test.sh
].each do |test_script|
  raise "verify 실행 누락: #{test_script}" unless text.include?("bash #{test_script}")
end

%w[
  HOME_SERVER_HOST
  HOME_SERVER_PORT
  HOME_SERVER_USER
  HOME_SERVER_SSH_KEY
  HOME_SERVER_KNOWN_HOSTS
].each do |secret|
  raise "secret 참조 누락: #{secret}" unless text.include?("secrets.#{secret}")
end

puts "GitHub Actions 계약 통과"
RUBY
