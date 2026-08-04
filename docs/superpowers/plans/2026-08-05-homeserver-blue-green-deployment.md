# DevChat 홈서버 Blue/Green 배포 구현 계획

> **에이전트 작업자 필수 지침:** 이 계획을 작업 단위로 구현할 때 `superpowers:subagent-driven-development`(권장) 또는 `superpowers:executing-plans`를 사용한다. 각 단계는 추적 가능한 체크박스(`- [ ]`)로 표시한다.

**목표:** `dev` 브랜치 push가 검증과 GHCR 이미지 발행을 거쳐 홈서버에 자동으로 Blue/Green 배포되고, 배포 단계의 실패 시 기존 슬롯으로 자동 롤백되게 한다.

**구조:** DevChat Compose는 MySQL·Redis 단일 서비스와 Blue·Green 애플리케이션 슬롯을 정의한다. 홈서버 전용 스크립트가 비활성 슬롯을 새 SHA 이미지로 실행하고 검증한 뒤, 공용 Gateway의 DevChat upstream 파일만 원자적으로 교체하고 Nginx를 reload한다. CI는 Compose와 배포 스크립트만 전송하며 서버의 비밀 `.env`와 배포 상태 파일은 덮어쓰지 않는다.

**기술 스택:** GitHub Actions, GHCR, OpenSSH/SCP, Bash, Docker Compose v2, Nginx, Spring Boot 3/Java 21, React 19, STOMP WebSocket

## 전체 제약

- 자동 배포 트리거는 `dev` 브랜치 push다.
- Pull Request에서는 검증만 수행하고 GHCR 쓰기 권한을 부여하지 않는다.
- Docker build context는 항상 `backend`다.
- 배포 이미지는 `ghcr.io/lunarbae628/devchat-backend:dev-<7자리 SHA>` 불변 태그를 사용한다.
- 평상시에는 애플리케이션 슬롯 하나만 실행하고 배포 중에만 두 슬롯을 실행한다.
- 애플리케이션 기본 JVM 설정은 `-Xms256m -Xmx1g`, 슬롯별 컨테이너 메모리 한도는 `1536m`다.
- MySQL과 Redis는 배포 과정에서 재생성하지 않는다.
- `/srv/devchat/.env`, `/srv/devchat/deployment.images.yml`, `/srv/devchat/active_color`는 CI가 덮어쓰지 않는다.
- DevChat 배포는 Docsa 서비스와 Docsa upstream을 변경하지 않는다.
- 자동 롤백은 배포 워크플로가 실행되는 동안의 실패만 담당한다.
- 기존 미커밋 변경과 관계없는 파일은 수정하지 않는다.

---

## 파일 구성

### DevChat 저장소

- 수정: `backend/infra/docker-compose.yml` — Blue·Green 슬롯과 공통 애플리케이션 설정 정의
- 수정: `backend/infra/.env.example` — `JAVA_OPTS` 기본값과 더 이상 사용하지 않는 단일 이미지 변수 정리
- 생성: `backend/infra/deploy.sh` — 홈서버 배포, upstream 전환, 자동 롤백 담당
- 생성: `backend/infra/tests/compose_contract_test.sh` — Compose 서비스·프로필·메모리 계약 검증
- 생성: `backend/infra/tests/deploy_test.sh` — 명령어 stub을 이용한 배포 성공·실패 경로 검증
- 수정: `frontend/src/components/common/WebSocketContext.js` — 연결 성공 후에도 자동 재연결 유지
- 생성: `frontend/src/components/common/WebSocketContext.test.js` — 재연결 간격 회귀 테스트
- 수정: `.github/workflows/ci-cd.yml` — Verify, Publish, Deploy job 분리

### home-gateway 저장소

- 수정: `docker-compose.yml` — `nginx/conf.d` 디렉터리 읽기 전용 마운트
- 수정: `nginx/nginx.conf` — 동적 DevChat upstream include와 named upstream 사용
- 생성: `nginx/conf.d/devchat-upstream.conf` — 최초 기동용 placeholder upstream
- 수정: `.gitignore` — 임시 upstream 파일과 백업 파일 제외

---

### 작업 1: Blue/Green Compose 계약

**파일:**

- 생성: `backend/infra/tests/compose_contract_test.sh`
- 수정: `backend/infra/docker-compose.yml`
- 수정: `backend/infra/.env.example`

**인터페이스:**

- 입력: `backend/infra/.env.example`
- 제공 서비스: `devchat-mysql`, `devchat-redis`, `devchat-app-blue`, `devchat-app-green`
- 제공 프로필: `blue`, `green`
- 슬롯 이미지 override 키: `services.devchat-app-blue.image`, `services.devchat-app-green.image`

- [ ] **1단계: 실패하는 Compose 계약 테스트 작성**

`backend/infra/tests/compose_contract_test.sh`가 Compose JSON을 생성하고 다음 조건을 검사하게 한다.

```bash
#!/usr/bin/env bash
set -euo pipefail

INFRA_DIR=$(cd "$(dirname "$0")/.." && pwd)
CONFIG_JSON=$(docker compose \
  --env-file "$INFRA_DIR/.env.example" \
  --profile blue \
  --profile green \
  -f "$INFRA_DIR/docker-compose.yml" \
  config --format json)

python3 -c '
import json, sys
config = json.load(sys.stdin)
services = config["services"]
assert set(("devchat-mysql", "devchat-redis", "devchat-app-blue", "devchat-app-green")) <= set(services)
for color in ("blue", "green"):
    app = services[f"devchat-app-{color}"]
    assert app["container_name"] == f"devchat-app-{color}"
    assert app["mem_limit"] == 1610612736
    assert set(app["networks"]) == {"devchat_internal", "devchat_proxy_net"}
    assert app["environment"]["JAVA_OPTS"] == "-Xms256m -Xmx1g"
assert services["devchat-app-blue"]["profiles"] == ["blue"]
assert services["devchat-app-green"]["profiles"] == ["green"]
' <<<"$CONFIG_JSON"
```

- [ ] **2단계: 테스트가 현재 단일 서비스 구성에서 실패하는지 확인**

실행:

```bash
bash backend/infra/tests/compose_contract_test.sh
```

예상 결과: `devchat-app-blue` 또는 `devchat-app-green`이 없어 assertion 실패.

- [ ] **3단계: 공통 anchor와 두 슬롯을 최소 구현**

`backend/infra/docker-compose.yml`에 공통 설정을 두고 슬롯별로 이름과 프로필만 분리한다.

```yaml
x-devchat-app: &devchat-app
  restart: unless-stopped
  stop_grace_period: 40s
  mem_limit: 1536m
  environment:
    SPRING_PROFILES_ACTIVE: prod
    JAVA_OPTS: ${JAVA_OPTS:--Xms256m -Xmx1g}
    # 기존 DB, Redis, OAuth, JWT, AWS 환경변수를 그대로 유지
  depends_on:
    devchat-mysql:
      condition: service_healthy
    devchat-redis:
      condition: service_healthy
  networks:
    - devchat_internal
    - devchat_proxy_net
  healthcheck:
    test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:8080/actuator/health >/dev/null || exit 1"]
    interval: 15s
    timeout: 5s
    retries: 10
    start_period: 40s

services:
  devchat-app-blue:
    <<: *devchat-app
    image: ghcr.io/lunarbae628/devchat-backend:dev
    container_name: devchat-app-blue
    profiles: [blue]

  devchat-app-green:
    <<: *devchat-app
    image: ghcr.io/lunarbae628/devchat-backend:dev
    container_name: devchat-app-green
    profiles: [green]
```

`.env.example`의 `JAVA_OPTS`를 `-Xms256m -Xmx1g`로 바꾸고 단일 서비스용 `DEVCHAT_IMAGE`는 제거한다.

- [ ] **4단계: Compose 계약과 변수 치환 검증**

실행:

```bash
bash backend/infra/tests/compose_contract_test.sh
docker compose --env-file backend/infra/.env.example --profile blue --profile green -f backend/infra/docker-compose.yml config --quiet
```

예상 결과: 두 명령 모두 종료 코드 0.

- [ ] **5단계: 작업 범위 커밋**

```bash
git add backend/infra/docker-compose.yml backend/infra/.env.example backend/infra/tests/compose_contract_test.sh
git commit -m "feat: define blue-green backend slots"
```

---

### 작업 2: 배포 및 자동 롤백 스크립트

**파일:**

- 생성: `backend/infra/deploy.sh`
- 생성: `backend/infra/tests/deploy_test.sh`

**인터페이스:**

- 실행: `/srv/devchat/deploy.sh ghcr.io/lunarbae628/devchat-backend:dev-abcdef0`
- 필수 상태: `/srv/devchat/.env`, `/srv/gateway/nginx/conf.d/devchat-upstream.conf`, `devchat_proxy_net`, `gateway-nginx`
- 생성 상태: `/srv/devchat/deployment.images.yml`, `/srv/devchat/active_color`, `/srv/devchat/deploy.lock`
- 테스트용 환경변수: `DEPLOY_DIR`, `GATEWAY_UPSTREAM_FILE`, `DOCKER_BIN`, `CURL_BIN`, `SLEEP_BIN`, `FLOCK_BIN`, `HEALTH_MAX_ATTEMPTS`, `HEALTH_INTERVAL_SECONDS`, `DRAIN_SECONDS`, `PUBLIC_HEALTH_URL`

- [ ] **1단계: 실패 경로를 표현하는 shell 테스트 fixture 작성**

`backend/infra/tests/deploy_test.sh`는 임시 디렉터리에 `.env`, Compose 파일, placeholder upstream과 `docker`, `curl`, `sleep` stub을 만들고 명령 기록 파일을 검사한다.

```bash
run_scenario() {
  local scenario=$1
  local fixture
  fixture=$(mktemp -d)
  mkdir -p "$fixture/bin" "$fixture/devchat" "$fixture/gateway"
  : > "$fixture/devchat/.env"
  cp "$INFRA_DIR/docker-compose.yml" "$fixture/devchat/docker-compose.yml"
  printf 'upstream devchat_backend { server 127.0.0.1:65535; }\n' > "$fixture/gateway/devchat-upstream.conf"

  SCENARIO="$scenario" \
  COMMAND_LOG="$fixture/commands.log" \
  DEPLOY_DIR="$fixture/devchat" \
  GATEWAY_UPSTREAM_FILE="$fixture/gateway/devchat-upstream.conf" \
  DOCKER_BIN="$fixture/bin/docker" \
  CURL_BIN="$fixture/bin/curl" \
  SLEEP_BIN="$fixture/bin/sleep" \
  FLOCK_BIN="$fixture/bin/flock" \
  HEALTH_MAX_ATTEMPTS=2 \
  HEALTH_INTERVAL_SECONDS=0 \
  DRAIN_SECONDS=0 \
  bash "$INFRA_DIR/deploy.sh" "ghcr.io/lunarbae628/devchat-backend:dev-abcdef0"
}
```

다음 네 시나리오를 각각 독립 fixture로 검증한다.

```text
success              → active_color=blue, upstream=devchat-app-blue, public check 실행
container_unhealthy  → upstream placeholder 유지, 새 슬롯 중지, 종료 코드 비정상
nginx_test_failure   → upstream 이전 내용 복구, 새 슬롯 중지, 종료 코드 비정상
public_health_failure→ upstream 이전 내용으로 재전환·reload, 새 슬롯 중지, 종료 코드 비정상
```

- [ ] **2단계: 배포 스크립트가 없어 테스트가 실패하는지 확인**

실행:

```bash
bash backend/infra/tests/deploy_test.sh
```

예상 결과: `backend/infra/deploy.sh`가 없어 실패.

- [ ] **3단계: 선행 조건과 배포 잠금 구현**

`backend/infra/deploy.sh`의 시작부에서 입력과 서버 상태를 검증한다.

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

IMAGE=${1:?"배포할 불변 이미지가 필요합니다"}
case "$IMAGE" in
  ghcr.io/lunarbae628/devchat-backend:dev-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]) ;;
  *) echo "허용되지 않은 이미지 태그: $IMAGE" >&2; exit 2 ;;
esac

DEPLOY_DIR=${DEPLOY_DIR:-/srv/devchat}
GATEWAY_UPSTREAM_FILE=${GATEWAY_UPSTREAM_FILE:-/srv/gateway/nginx/conf.d/devchat-upstream.conf}
LOCK_FILE=${LOCK_FILE:-$DEPLOY_DIR/deploy.lock}
FLOCK_BIN=${FLOCK_BIN:-flock}
exec 9>"$LOCK_FILE"
"$FLOCK_BIN" -n 9 || { echo "다른 DevChat 배포가 실행 중입니다" >&2; exit 3; }
```

`.env`, Compose 파일, upstream 파일, 외부 네트워크와 Gateway 컨테이너가 없으면 변경 전에 종료한다.

- [ ] **4단계: 슬롯 이미지 상태와 컨테이너 헬스체크 구현**

슬롯별 이미지를 보존하는 override는 다음 형식으로 원자적으로 작성한다.

```yaml
services:
  devchat-app-blue:
    image: ghcr.io/lunarbae628/devchat-backend:dev-abcdef0
  devchat-app-green:
    image: ghcr.io/lunarbae628/devchat-backend:dev-1234567
```

`active_color`이 없으면 Blue를 새 슬롯으로 사용한다. 존재하면 반대 색상을 선택한다. MySQL과 Redis는 `up -d --wait`로 정상 상태만 확인하고, 새 슬롯은 정확한 profile과 서비스명을 지정해 `up -d --no-deps`로 실행한다. `docker inspect`의 `.State.Health.Status`가 제한 시간 안에 `healthy`가 아니면 이미지 상태를 복구하고 새 슬롯을 중지한다.

- [ ] **5단계: upstream 전환과 단계별 롤백 구현**

새 upstream 파일은 다음 형식으로 임시 파일에 쓴 뒤 `mv`로 교체한다.

```nginx
upstream devchat_backend {
    server devchat-app-green:8080;
    keepalive 32;
}
```

전환 후 아래 순서로 검증한다.

```bash
"$DOCKER_BIN" exec gateway-nginx nginx -t
"$DOCKER_BIN" exec gateway-nginx nginx -s reload
"$CURL_BIN" --fail --silent --show-error --max-time 10 "$PUBLIC_HEALTH_URL"
```

Nginx 검증·reload 또는 공용 health check가 실패하면 이전 upstream 파일을 복구하고 다시 `nginx -t`와 reload를 수행한다. 이전 활성 슬롯이 있으면 계속 실행한 채 새 슬롯만 중지한다. 성공 시 `active_color`을 원자적으로 갱신하고 drain 시간 후 이전 슬롯을 graceful stop한다.

- [ ] **6단계: 성공 및 네 가지 실패 경로 검증**

실행:

```bash
bash -n backend/infra/deploy.sh
bash backend/infra/tests/deploy_test.sh
```

예상 결과: shell 문법 검사와 모든 시나리오 통과.

- [ ] **7단계: 작업 범위 커밋**

```bash
git add backend/infra/deploy.sh backend/infra/tests/deploy_test.sh
git commit -m "feat: add blue-green deployment rollback"
```

---

### 작업 3: 공용 Gateway의 전환 가능한 DevChat upstream

**파일:**

- 수정: `/Users/moon/Desktop/Works/home-gateway/docker-compose.yml`
- 수정: `/Users/moon/Desktop/Works/home-gateway/nginx/nginx.conf`
- 생성: `/Users/moon/Desktop/Works/home-gateway/nginx/conf.d/devchat-upstream.conf`
- 수정: `/Users/moon/Desktop/Works/home-gateway/.gitignore`

**인터페이스:**

- Nginx include: `/etc/nginx/conf.d/devchat-upstream.conf`
- 호스트 상태 디렉터리: `/srv/gateway/nginx/conf.d`
- upstream 이름: `devchat_backend`
- 최초 대상: `127.0.0.1:65535`

- [ ] **1단계: 현재 Gateway가 동적 upstream 계약을 만족하지 않는지 확인**

실행:

```bash
rg -n "conf.d/devchat-upstream.conf|proxy_pass http://devchat_backend" /Users/moon/Desktop/Works/home-gateway/nginx/nginx.conf
```

예상 결과: 일치 항목이 없어 종료 코드 1.

- [ ] **2단계: placeholder upstream과 디렉터리 마운트 추가**

`nginx/conf.d/devchat-upstream.conf`를 다음 내용으로 생성한다.

```nginx
upstream devchat_backend {
    server 127.0.0.1:65535;
    keepalive 32;
}
```

Gateway Compose의 Nginx volume에 다음을 추가한다.

```yaml
- ./nginx/conf.d:/etc/nginx/conf.d:ro
```

`.gitignore`에는 배포 스크립트가 만드는 `nginx/conf.d/*.tmp.*`와 `nginx/conf.d/*.backup`을 추가하되 `devchat-upstream.conf`는 추적한다.

- [ ] **3단계: HTTP와 WebSocket 프록시를 named upstream으로 변경**

`nginx/nginx.conf`의 `http` 블록에 include를 추가한다.

```nginx
include /etc/nginx/conf.d/devchat-upstream.conf;
```

DevChat 서버 블록의 두 proxy 위치를 모두 다음 대상으로 변경한다.

```nginx
proxy_pass http://devchat_backend;
```

Docsa의 `proxy_pass`와 서버 블록은 변경하지 않는다.

- [ ] **4단계: Compose와 Nginx 설정 검증**

실행:

```bash
cd /Users/moon/Desktop/Works/home-gateway
docker compose --env-file .env.example config --quiet
docker run --rm \
  -v "$PWD/nginx/nginx.bootstrap.conf:/etc/nginx/nginx.conf:ro" \
  -v "$PWD/nginx/conf.d:/etc/nginx/conf.d:ro" \
  nginx:stable-alpine-slim nginx -t
```

예상 결과: Compose config와 Nginx bootstrap 문법 검사 종료 코드 0. 운영 TLS 설정은 인증서 설치 후 서버에서 별도로 `nginx -t`한다.

- [ ] **5단계: Gateway 저장소에 별도 커밋**

```bash
cd /Users/moon/Desktop/Works/home-gateway
git add .gitignore docker-compose.yml nginx/nginx.conf nginx/conf.d/devchat-upstream.conf
git commit -m "feat: support DevChat blue-green upstream"
```

---

### 작업 4: WebSocket 자동 재연결 유지

**파일:**

- 생성: `frontend/src/components/common/WebSocketContext.test.js`
- 수정: `frontend/src/components/common/WebSocketContext.js`

**인터페이스:**

- STOMP 재연결 간격: 항상 `5000ms`
- 기존 `WebSocketProvider`와 `useWebSocketContext` 공개 API는 변경하지 않음

- [ ] **1단계: 연결 성공 후 재연결 간격 회귀 테스트 작성**

`@stomp/stompjs`의 `Client`를 mock하고 전달된 설정과 생성된 client를 캡처한다.

```javascript
it("연결 성공 후에도 5초 자동 재연결을 유지한다", async () => {
  render(
    <WebSocketProvider>
      <div>child</div>
    </WebSocketProvider>,
  )

  expect(capturedConfig.reconnectDelay).toBe(5000)
  act(() => capturedConfig.onConnect())
  expect(mockClient.reconnectDelay).toBe(5000)
})
```

`safeRefreshToken`은 resolved Promise로 mock하고 cleanup 시 `deactivate`가 호출될 수 있게 client mock에 `active`, `activate`, `deactivate`를 제공한다.

- [ ] **2단계: 현재 코드에서 테스트 실패 확인**

실행:

```bash
cd frontend
CI=true npm test -- --runInBand --watchAll=false WebSocketContext.test.js
```

예상 결과: `onConnect`가 `reconnectDelay`를 0으로 바꿔 실패.

- [ ] **3단계: 재연결을 끄는 한 줄 제거**

`frontend/src/components/common/WebSocketContext.js`의 `onConnect`에서 다음 줄만 제거한다.

```javascript
client.reconnectDelay = 0
```

- [ ] **4단계: 테스트와 운영 빌드 검증**

실행:

```bash
cd frontend
CI=true npm test -- --runInBand --watchAll=false WebSocketContext.test.js
npm run build
```

예상 결과: 테스트와 빌드 성공.

- [ ] **5단계: 작업 범위 커밋**

```bash
git add frontend/src/components/common/WebSocketContext.js frontend/src/components/common/WebSocketContext.test.js
git commit -m "fix: keep websocket automatic reconnect enabled"
```

---

### 작업 5: Verify, Publish, Deploy GitHub Actions

**파일:**

- 수정: `.github/workflows/ci-cd.yml`

**인터페이스:**

- `verify`: PR와 push에서 테스트 및 Docker build
- `publish`: `dev` push에서 두 GHCR 태그 push, `image` output 제공
- `deploy`: Publish의 불변 `image` output을 홈서버 스크립트에 전달
- GitHub secrets: `HOME_SERVER_HOST`, `HOME_SERVER_PORT`, `HOME_SERVER_USER`, `HOME_SERVER_SSH_KEY`, `HOME_SERVER_KNOWN_HOSTS`, `GHCR_USERNAME`, `GHCR_READ_TOKEN`

- [ ] **1단계: 현재 워크플로 정적 계약 실패 확인**

실행:

```bash
rg -n '^  (verify|publish|deploy):' .github/workflows/ci-cd.yml
rg -n 'context: backend|dev-[<].*SHA' .github/workflows/ci-cd.yml
```

예상 결과: 분리된 세 job 또는 올바른 context가 없어 실패.

- [ ] **2단계: Verify job 구현**

다음 조건으로 `verify`를 구성한다.

```yaml
permissions:
  contents: read

steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-java@v4
    with:
      java-version: "21"
      distribution: temurin
  - uses: gradle/actions/setup-gradle@v4
  - run: ./gradlew clean test --no-daemon
    working-directory: backend
  - uses: docker/setup-buildx-action@v3
  - uses: docker/build-push-action@v6
    with:
      context: backend
      file: backend/Dockerfile
      push: false
      tags: devchat-backend:verify
      cache-from: type=gha
      cache-to: type=gha,mode=max
```

- [ ] **3단계: Publish job과 불변 output 구현**

`publish`는 `needs: verify`, `github.event_name == 'push'` 조건과 `packages: write` 권한을 가진다. 7자리 SHA를 계산한 뒤 Buildx로 `dev`와 `dev-<SHA>` 태그를 함께 push하고 불변 이미지 전체 문자열을 job output으로 제공한다.

```bash
SHORT_SHA=${GITHUB_SHA::7}
IMAGE="ghcr.io/lunarbae628/devchat-backend:dev-$SHORT_SHA"
echo "image=$IMAGE" >> "$GITHUB_OUTPUT"
echo "tags<<EOF" >> "$GITHUB_OUTPUT"
echo "ghcr.io/lunarbae628/devchat-backend:dev" >> "$GITHUB_OUTPUT"
echo "$IMAGE" >> "$GITHUB_OUTPUT"
echo "EOF" >> "$GITHUB_OUTPUT"
```

- [ ] **4단계: native OpenSSH Deploy job 구현**

`deploy`는 `needs: publish`와 서버 배포 전용 concurrency를 가진다. SSH 개인키와 known hosts는 secret을 환경변수로 전달해 파일 권한 `600`으로 저장한다. `/srv/devchat/.env` 존재 여부를 먼저 확인한 다음 두 인프라 파일만 SCP로 전송한다.

GHCR 로그인은 토큰을 SSH 표준입력으로 전달한다.

```bash
printf '%s' "$GHCR_READ_TOKEN" | ssh -p "$HOME_SERVER_PORT" \
  "$HOME_SERVER_USER@$HOME_SERVER_HOST" \
  "docker login ghcr.io --username '$GHCR_USERNAME' --password-stdin"
```

그 다음 Publish output을 인자로 배포한다.

```bash
ssh -p "$HOME_SERVER_PORT" "$HOME_SERVER_USER@$HOME_SERVER_HOST" \
  "/srv/devchat/deploy.sh '${{ needs.publish.outputs.image }}'"
```

- [ ] **5단계: YAML과 보안 계약 검증**

실행:

```bash
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/ci-cd.yml"); puts "workflow yaml ok"'
rg -n 'context: backend|file: backend/Dockerfile' .github/workflows/ci-cd.yml
! rg -n '/srv/docsa|EC2_|DOCKER_PASSWORD|workflow_dispatch:[[:space:]]*$' .github/workflows/ci-cd.yml
git diff --check -- .github/workflows/ci-cd.yml
```

예상 결과: YAML 파싱 성공, 두 Docker 경로 확인, 금지된 레거시 참조 없음, 공백 오류 없음.

- [ ] **6단계: 작업 범위 커밋**

```bash
git add .github/workflows/ci-cd.yml
git commit -m "ci: deploy backend to homeserver"
```

---

### 작업 6: 전체 회귀 검증과 운영 준비 확인

**파일:**

- 검증: 위 작업에서 변경한 모든 파일
- 참고: `docs/superpowers/specs/2026-08-05-homeserver-blue-green-deployment-design.md`

**인터페이스:** 없음. 이 작업은 배포 전 최종 품질 게이트다.

- [ ] **1단계: DevChat 정적·단위 검증 실행**

```bash
cd /Users/moon/Desktop/Works/devchat
bash backend/infra/tests/compose_contract_test.sh
bash -n backend/infra/deploy.sh
bash backend/infra/tests/deploy_test.sh
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/ci-cd.yml")'
git diff --check
```

예상 결과: 모든 명령 종료 코드 0.

- [ ] **2단계: 백엔드 전체 테스트와 이미지 빌드 실행**

```bash
cd /Users/moon/Desktop/Works/devchat/backend
./gradlew clean test --no-daemon
cd /Users/moon/Desktop/Works/devchat
docker build -f backend/Dockerfile -t devchat-backend:blue-green-verify backend
```

예상 결과: Docker/Testcontainers 사용이 가능한 상태에서 전체 테스트와 이미지 빌드 성공.

- [ ] **3단계: 프론트엔드 회귀 검증 실행**

```bash
cd /Users/moon/Desktop/Works/devchat/frontend
CI=true npm test -- --runInBand --watchAll=false WebSocketContext.test.js
npm run build
```

예상 결과: 테스트와 운영 빌드 성공.

- [ ] **4단계: Gateway 최종 검증**

```bash
cd /Users/moon/Desktop/Works/home-gateway
docker compose --env-file .env.example config --quiet
git diff --check
```

예상 결과: 종료 코드 0이며 Docsa proxy 대상은 기존 `docsa-app:8080` 그대로 유지.

- [ ] **5단계: 홈서버 선행 조건을 읽기 전용으로 점검**

다음 항목만 확인하고 이 단계에서 서버를 변경하지 않는다.

```bash
ssh homeserver '
  docker compose version &&
  test -d /srv/devchat &&
  test -f /srv/devchat/.env &&
  test -d /srv/gateway/nginx/conf.d &&
  docker network inspect devchat_proxy_net >/dev/null &&
  docker inspect gateway-nginx >/dev/null
'
```

예상 결과: 아직 bootstrap하지 않았다면 실패 항목을 최종 보고에 정확히 기록. 실제 디렉터리 생성, 운영 `.env` 작성, 네트워크 생성, Gateway 전환과 GitHub secret 등록은 사용자의 운영 승인과 값 제공 후 별도 수행.

- [ ] **6단계: 변경 범위와 저장소 상태 보고**

```bash
git -C /Users/moon/Desktop/Works/devchat status --short --branch
git -C /Users/moon/Desktop/Works/devchat log --oneline -6
git -C /Users/moon/Desktop/Works/home-gateway status --short --branch
git -C /Users/moon/Desktop/Works/home-gateway log --oneline -3
```

예상 결과: DevChat과 Gateway 변경 및 커밋이 저장소별로 분리되어 있고, 기존 사용자 변경은 손실되지 않음.
