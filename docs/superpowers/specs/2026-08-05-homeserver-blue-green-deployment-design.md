# DevChat 홈서버 Blue/Green 배포 설계

## 목표

`dev` 브랜치의 빌드가 성공할 때마다 홈서버에 자동 배포한다. 새 DevChat 애플리케이션이 헬스체크를 통과할 때까지 현재 정상 애플리케이션이 계속 요청을 처리해야 한다. 배포가 실패하면 트래픽을 이전 애플리케이션으로 자동 복구해야 한다.

이 설계의 자동 롤백 범위는 배포가 진행되는 동안 발생한 실패까지다. 배포 워크플로가 끝난 뒤 발견되는 장애를 지속적으로 감시하거나 자동 롤백하는 기능은 포함하지 않는다.

## 저장소별 책임

### DevChat 저장소

DevChat 저장소는 다음을 담당한다.

- 백엔드 테스트와 이미지 빌드
- 두 애플리케이션 슬롯의 서비스 정의
- 홈서버 배포 스크립트
- GitHub Actions를 통한 이미지 발행과 SSH 배포
- 애플리케이션 헬스체크
- 브라우저 WebSocket 재연결 동작

DevChat 워크플로는 Docsa 애플리케이션을 재시작하거나 재생성 또는 배포하지 않는다.

### home-gateway 저장소

`home-gateway` 저장소는 다음을 담당한다.

- 외부 포트 80과 443
- TLS 인증서
- Nginx 설정
- Nginx에 마운트하는 DevChat 활성 upstream 선택 파일

DevChat 배포 스크립트는 DevChat upstream 선택 파일 하나만 원자적으로 갱신할 수 있다. 또한 기존 `gateway-nginx` 컨테이너의 설정을 검증하고 reload할 수 있다. Gateway Compose 프로젝트를 재배포하거나 Docsa 라우팅을 변경해서는 안 된다.

## 실행 구조

MySQL과 Redis는 각각 하나의 영속 서비스로 유지한다. DevChat에는 `devchat-app-blue`와 `devchat-app-green`이라는 애플리케이션 슬롯 두 개를 정의한다. 두 슬롯은 모두 `devchat_internal`과 외부 네트워크인 `devchat_proxy_net`에 참여하며 홈서버 포트를 공개하지 않는다.

평상시에는 활성 애플리케이션 슬롯 하나만 실행한다. 배포 중에는 활성 슬롯이 계속 요청을 처리하는 동안 비활성 슬롯을 새 불변 이미지로 실행한다. 비활성 슬롯이 정상 상태가 되면 Nginx 트래픽을 새 슬롯으로 전환한다. 기존 슬롯은 30초의 drain 시간이 지난 뒤 중지한다.

각 애플리케이션은 `JAVA_OPTS=-Xms256m -Xmx1g`를 기본 JVM 힙 설정으로 사용하고 컨테이너 메모리 한도를 `1536m`로 제한한다. 두 슬롯이 겹쳐 실행되는 동안 애플리케이션 컨테이너에는 최대 3GiB가 할당될 수 있으며, MySQL도 두 애플리케이션의 커넥션 풀을 수용해야 한다. 두 애플리케이션은 합계 최대 20개의 MySQL 연결을 요청할 수 있다.

## Compose 설계

`backend/infra/docker-compose.yml`에는 다음 서비스를 정의한다.

- 기존 영속 의존성인 `devchat-mysql`과 `devchat-redis`
- `blue` 프로필을 사용하는 `devchat-app-blue`
- `green` 프로필을 사용하는 `devchat-app-green`
- 두 애플리케이션 슬롯의 설정 차이를 방지하는 공통 설정 anchor
- 기존 내부 네트워크와 프록시 네트워크
- 기존 애플리케이션 헬스체크
- 슬롯별 `1536m` 컨테이너 메모리 한도와 기본 `-Xms256m -Xmx1g` JVM 힙 설정

두 슬롯은 서로 다른 컨테이너 이름을 사용하지만 동일한 컨테이너 포트 `8080`을 사용한다. 프로필을 사용하여 인자를 지정하지 않은 `docker compose up` 명령이 두 애플리케이션 슬롯을 모두 실행하지 못하게 한다.

배포 스크립트는 각 슬롯에 할당한 정확한 이미지를 기록하는 Compose override 파일 `/srv/devchat/deployment.images.yml`을 관리한다. 이 상태 파일은 CI에서 전송하거나 Git에 커밋하지 않는다. 비밀값을 보관하는 서버 전용 `/srv/devchat/.env` 역시 CI에서 전송하거나 Git에 커밋하지 않는다.

## Gateway 설계

Nginx `http` 블록에서 `/etc/nginx/conf.d/devchat-upstream.conf`를 include한다. DevChat HTTP와 WebSocket 프록시 위치는 고정된 `devchat-app` 서비스명 대신 `devchat_backend`라는 upstream을 사용한다.

Gateway Compose 파일은 호스트의 `/srv/gateway/nginx/conf.d` 디렉터리 전체를 Nginx의 `/etc/nginx/conf.d`에 읽기 전용으로 마운트한다. 단일 파일을 직접 bind mount하면 호스트에서 원자적으로 교체한 새 inode가 컨테이너에 반영되지 않을 수 있으므로 사용하지 않는다. 활성 애플리케이션이 존재할 때 파일 내용은 다음처럼 하나의 슬롯만 선택한다.

```nginx
upstream devchat_backend {
    server devchat-app-blue:8080;
    keepalive 32;
}
```

최초 Gateway 기동 시에는 아직 Blue 컨테이너가 없으므로 `server 127.0.0.1:65535;`를 사용하는 placeholder upstream 파일을 설치한다. 따라서 Gateway가 먼저 정상 기동할 수 있고 DevChat API만 일시적으로 502를 반환한다. 첫 DevChat 배포에서 Blue 헬스체크가 성공한 뒤 upstream을 Blue로 교체한다.

배포 사용자는 이 호스트 파일 하나를 교체하고 `docker exec gateway-nginx nginx -t`와 `docker exec gateway-nginx nginx -s reload`를 실행할 수 있어야 한다. 스크립트는 임시 파일을 작성한 다음 최종 경로로 이름을 바꾼다. 따라서 Nginx가 작성 중인 불완전한 설정을 읽지 않는다.

## CI/CD 워크플로

`.github/workflows/ci-cd.yml`은 세 개의 job으로 구성한다.

### 검증

`dev` 대상 Pull Request와 `dev` 브랜치 push에서 다음을 수행한다.

1. 저장소를 checkout한다.
2. Java 21, Gradle 캐시, Node.js 20과 npm 캐시를 설정한다.
3. 백엔드 테스트 전체와 프론트엔드 WebSocket 재연결 회귀 테스트를 실행한다.
4. 프론트엔드 운영 빌드를 검증한다.
5. `backend`를 build context로 사용하여 백엔드 Dockerfile을 빌드하되 이미지는 push하지 않는다.

이 job에는 `contents: read` 권한만 부여한다.

### 이미지 발행

검증에 성공한 `dev` push에서 다음을 수행한다.

1. `GITHUB_TOKEN`으로 GHCR에 로그인한다.
2. `backend`를 build context로 사용하여 `backend/Dockerfile`을 빌드한다.
3. `ghcr.io/lunarbae628/devchat-backend:dev`와 불변 태그 `ghcr.io/lunarbae628/devchat-backend:dev-<7자리 SHA>`를 모두 push한다.

이 job에는 `contents: read`와 `packages: write` 권한을 부여한다.

### 배포

이미지 발행에 성공한 `dev` push에서 다음을 수행한다.

1. GitHub secret으로 SSH를 설정한다.
2. `backend/infra/docker-compose.yml`과 `backend/infra/deploy.sh`를 SHA와 재실행 번호별 임시 release 디렉터리에 함께 복사한다.
3. 토큰을 출력하지 않고 홈서버에서 GHCR에 로그인한다.
4. 서버 배포 잠금을 얻은 뒤 임시 디렉터리를 정식 release 디렉터리로 바꾸고, 그 release의 Compose 파일과 스크립트로 불변 이미지 `dev-<7자리 SHA>`를 배포한다.
5. 배포가 완전히 성공한 경우에만 `/srv/devchat/current` 심볼릭 링크를 해당 release로 원자적으로 전환한다.
6. 배포 또는 롤백을 완료하지 못하면 워크플로를 실패 처리한다.

워크플로 concurrency는 `dev` 배포 대상을 기준으로 설정하며 실행 중인 배포를 취소하지 않는다. 서버 스크립트도 배타적 잠금을 사용하여 수동 배포와 CI 배포가 겹치지 않게 한다.

필요한 GitHub secret은 다음과 같다.

- `HOME_SERVER_HOST`
- `HOME_SERVER_PORT`
- `HOME_SERVER_USER`
- `HOME_SERVER_SSH_KEY`
- `HOME_SERVER_KNOWN_HOSTS`
- `GHCR_USERNAME`
- 백엔드 패키지 읽기 권한을 가진 `GHCR_READ_TOKEN`

사용하지 않는 수동 실행 입력값은 두지 않는다. `dev` push가 자동 배포를 시작한다. 이미지 태그를 입력받는 별도의 수동 롤백 워크플로는 이번 범위에 포함하지 않는다.

## 배포와 롤백 절차

홈서버 배포 스크립트는 `set -Eeuo pipefail`과 배타적 파일 잠금을 사용한다. CI는 파일 설치와 배포 전체에 같은 잠금을 유지하고, 수동 실행 시에는 스크립트가 직접 잠금을 얻는다.

1. 불변 이미지 인자, `/srv/devchat/.env`, Compose 파일, `devchat_proxy_net`, upstream 파일과 실행 중인 Gateway 컨테이너를 검증한다.
2. 이전 실행이 남긴 `/srv/devchat/deploy.transaction`이 있으면 복구 대상인 이전 슬롯의 실행·health 상태를 먼저 확인하고, 정상일 때만 저장된 upstream과 활성 색상을 복구한다. 이전 슬롯이 비정상이거나 복구를 확인하지 못하면 현재 트래픽과 두 슬롯, transaction을 유지한 채 중단한다.
3. `/srv/devchat/active_color`와 Gateway upstream이 일치하는지 확인한다. 파일이 모두 비어 있으면 최초 배포로 판단하고 Blue를 선택한다.
4. 비활성 슬롯을 선택하고 현재 upstream 내용과 슬롯 이미지 상태를 기록한다.
5. 정확한 새 이미지를 pull한다.
6. `deployment.images.yml`에서 비활성 슬롯의 이미지만 변경한다.
7. MySQL과 Redis를 재생성하지 않고 정상 상태만 확인한 후 비활성 애플리케이션 슬롯을 실행한다.
8. 제한 시간 동안 비활성 컨테이너의 Docker health 상태가 `healthy`가 되기를 기다린다. 실패하면 비활성 슬롯을 중지하고 이전 이미지 할당을 복구하며, 활성 슬롯과 upstream은 변경하지 않는다.
9. 전환 transaction을 기록한 뒤 새 upstream 파일을 생성하고 `nginx -t` 실행 후 Nginx를 reload한다. 둘 중 하나라도 실패하면 이전 upstream 파일을 복구하고 다시 검증·reload한 다음 비활성 슬롯을 중지한다. 복구 검증이 실패하면 트래픽이 어느 슬롯을 향하는지 단정할 수 없으므로 두 슬롯을 모두 유지한다.
10. 공용 Gateway를 통해 `https://api.devchat.o-r.kr/actuator/health`를 호출한다. smoke check가 실패하면 같은 방식으로 이전 upstream을 복구한다.
11. 새 활성 색상을 기록하고 transaction을 제거한 뒤, 일반 HTTP 요청이 마무리되도록 30초 기다리고 기존 슬롯을 graceful stop한다. 중지에 실패하면 3회까지 재시도하고, 계속 실패하면 새 슬롯과 트래픽은 유지하되 CI를 실패 처리해 운영자에게 정리 실패를 알린다.

최초 배포에는 복구할 이전 애플리케이션이 없다. 따라서 최초 배포가 실패하면 두 애플리케이션 슬롯을 모두 중지한 상태로 워크플로를 실패 처리하며, MySQL과 Redis는 계속 실행 중일 수 있다.

스크립트는 이미지를 자동 prune하지 않는다. 이전 이미지를 보존하면 운영자가 복구할 수 있고 롤백에 필요한 이미지를 실수로 제거하지 않는다.

첫 CI 배포가 성공한 뒤 수동 배포가 필요하면 `/srv/devchat/current/deploy.sh`를 사용하되, 같은 release의 Compose를 `COMPOSE_FILE=/srv/devchat/current/docker-compose.yml`로 지정한다. 스크립트가 자체 배포 잠금을 얻으므로 CI와 겹치면 즉시 실패한다.

## 레거시 배포 파일 정리

저장소 루트의 기존 `docker-compose.yml`은 EC2형 단일 배포와 Prometheus 컨테이너를 함께 정의하던 경로이며, 홈서버 Blue/Green 구조에서는 `backend/infra/docker-compose.yml`로 대체한다. 함께 사용되던 루트 `prometheus.yml`도 현재 Gateway·DevChat 배포 범위에서 참조되지 않아 제거한다. 모니터링을 다시 도입할 때는 애플리케이션 배포와 분리된 홈서버 관측 스택으로 구성한다.

## WebSocket 동작

Nginx reload는 기존 worker를 유지하지만 이전 애플리케이션을 중지하면 그 애플리케이션에 연결된 WebSocket 세션은 결국 종료된다. 프론트엔드는 최초 연결 성공 후에도 STOMP 자동 재연결 간격 5초를 유지해야 한다. 현재 연결 성공 시 `client.reconnectDelay`를 0으로 변경하는 코드는 제거한다.

재연결 후 기존 구독 hook은 현재 연결 상태 흐름을 통해 다시 구독해야 한다. 이 변경은 중단 시간을 줄이지만 클라이언트 연결이 끊긴 동안 발생한 메시지의 무손실 전달까지 보장하지는 않는다.

## 데이터베이스 호환성

구버전과 신버전 애플리케이션은 배포 중 잠시 겹쳐 실행되며 동일한 MySQL과 Redis를 사용한다. 따라서 이 파이프라인으로 배포하는 Flyway migration은 겹치는 동안 이전 애플리케이션과 호환되어야 한다.

컬럼 추가와 같은 확장 변경은 허용한다. 사용 중인 컬럼을 제거하거나 이름을 바꾸려면 단계적인 expand-and-contract 배포가 필요하며, 한 번의 blue/green 배포에서 처리할 수 없다.

## 최초 서버 준비

첫 자동 배포 전에 운영자가 다음 작업을 한 번 수행해야 한다.

1. `/srv/devchat`을 만들고 배포 사용자에게 접근 권한을 부여한다.
2. 검토한 운영값으로 `/srv/devchat/.env`를 생성한다.
3. 외부 네트워크 `devchat_proxy_net`을 생성한다.
4. Docker Engine과 Docker Compose v2를 설치한다.
5. 응답하지 않는 로컬 placeholder upstream 파일을 포함한 Gateway 파일을 `/srv/gateway`에 설치한다.
6. 유효한 TLS 인증서를 준비한 후 `gateway-nginx`를 실행한다.
7. 배포 절차에 필요한 최소한의 파일시스템 권한과 Docker 권한을 배포 사용자에게 부여한다.
8. 필요한 GitHub secret을 등록한다.

CI는 이러한 선행 조건이 없으면 명확한 오류와 함께 실패해야 한다. CI에서 `sudo`를 사용하거나 권한이 필요한 서버 디렉터리를 생성하지 않는다.

## 검증

로컬 및 CI에서 다음을 검증한다.

- GitHub Actions YAML 파싱
- 예제 환경변수와 Blue·Green 프로필을 사용한 `docker compose config`
- 배포 스크립트 shell 문법
- 백엔드 테스트
- `backend` context를 사용한 백엔드 Docker 이미지 빌드
- 재연결 변경을 포함한 프론트엔드 테스트 또는 빌드
- 명령어 stub을 사용하는 격리된 배포 스크립트 smoke test: 전환 전 실패, Nginx 검증 실패, 전환 후 smoke check 실패, 성공 경로

실제 홈서버 배포는 최초 서버 준비가 완료된 뒤에만 진행한다. 구현 단계에서는 실행 중인 Docsa 서비스를 변경하거나 포트 80과 443의 소유권을 가져오지 않고 로컬 파일을 준비하고 검증할 수 있다.
