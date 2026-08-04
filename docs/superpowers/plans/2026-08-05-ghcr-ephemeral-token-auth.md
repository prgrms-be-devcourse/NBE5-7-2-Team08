# GHCR 임시 토큰 인증 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**목표:** 홈서버의 GHCR pull 인증을 별도 장기 PAT에서 GitHub Actions 실행별 `GITHUB_TOKEN`으로 교체하고, 배포 종료 후 임시 자격 증명을 제거한다.

**구조:** Deploy job에 `packages: read` 권한을 추가하고 `github.actor`와 `github.token`을 기존 SSH 기반 Docker 로그인에 전달한다. 성공·실패와 관계없이 실행되는 로그아웃 단계를 추가하며, 정적 계약 테스트가 장기 GHCR secret의 재도입을 막는다.

**기술 스택:** GitHub Actions YAML, Ruby YAML 계약 테스트, OpenSSH, Docker CLI

## 전역 제약

- `GHCR_USERNAME`, `GHCR_READ_TOKEN` 저장소 secret을 사용하지 않는다.
- Deploy job의 패키지 권한은 읽기 전용인 `packages: read`로 제한한다.
- 토큰은 명령 인자가 아닌 표준입력으로 `docker login`에 전달한다.
- 로그아웃은 앞선 단계의 성공·실패와 관계없이 실행한다.
- 기존 Blue/Green 배포, SSH host key 검증, 불변 이미지 태그 흐름은 변경하지 않는다.
- 새 커밋 메시지는 한글로 작성한다.

---

### 작업 1: 실행별 GHCR 인증으로 교체

**파일:**

- 수정: `backend/infra/tests/workflow_contract_test.sh`
- 수정: `.github/workflows/ci-cd.yml`
- 수정: `docs/superpowers/plans/2026-08-05-homeserver-blue-green-deployment.md`

**인터페이스:**

- 입력: GitHub Actions 기본 컨텍스트 `github.actor`, `github.token`
- 권한: Deploy job `contents: read`, `packages: read`
- 출력: 홈서버의 일시적인 `ghcr.io` 로그인과 항상 실행되는 로그아웃

- [ ] **1단계: 장기 PAT 사용을 금지하는 실패 계약 작성**

`backend/infra/tests/workflow_contract_test.sh`의 Deploy job 검증에 다음 계약을 추가하고, 기존 `GHCR_USERNAME`, `GHCR_READ_TOKEN` secret 필수 검증은 제거한다.

```ruby
deploy = jobs.fetch("deploy")
raise "deploy에 packages: read 필요" unless deploy.dig("permissions", "packages") == "read"
raise "github.actor 사용 누락" unless text.include?("github.actor")
raise "github.token 사용 누락" unless text.include?("github.token")
raise "장기 GHCR username secret 사용 금지" if text.include?("secrets.GHCR_USERNAME")
raise "장기 GHCR token secret 사용 금지" if text.include?("secrets.GHCR_READ_TOKEN")
raise "GHCR 로그아웃 누락" unless text.include?("docker logout ghcr.io")
raise "GHCR 로그아웃은 항상 실행해야 함" unless text.include?("if: always()")
```

- [ ] **2단계: 계약이 현재 워크플로에서 올바르게 실패하는지 확인**

실행:

```bash
bash backend/infra/tests/workflow_contract_test.sh
```

예상 결과: `deploy에 packages: read 필요` 오류로 실패한다.

- [ ] **3단계: Deploy job을 최소 수정**

`.github/workflows/ci-cd.yml`에서 Deploy job 권한과 로그인 환경변수를 다음처럼 변경한다.

```yaml
permissions:
  contents: read
  packages: read
```

```yaml
env:
  GHCR_USERNAME: ${{ github.actor }}
  GHCR_READ_TOKEN: ${{ github.token }}
```

Deploy 단계 다음에 로그아웃 단계를 추가한다.

```yaml
- name: Log out home server from GHCR
  if: always()
  run: |
    ssh -p "$HOME_SERVER_PORT" \
      -o BatchMode=yes \
      -o IdentitiesOnly=yes \
      "$HOME_SERVER_USER@$HOME_SERVER_HOST" \
      'docker logout ghcr.io >/dev/null 2>&1 || true'
```

- [ ] **4단계: 기존 구현 계획의 secret 목록 갱신**

`docs/superpowers/plans/2026-08-05-homeserver-blue-green-deployment.md`에서 `GHCR_USERNAME`, `GHCR_READ_TOKEN`을 필요한 저장소 secret 목록에서 제거하고, Deploy job이 `github.actor`, `github.token`을 사용한다는 설명으로 교체한다.

- [ ] **5단계: 계약과 YAML 검증**

실행:

```bash
bash backend/infra/tests/workflow_contract_test.sh
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/ci-cd.yml"); puts "workflow YAML parse 통과"'
git diff --check
```

예상 결과: 모든 명령이 성공한다.

- [ ] **6단계: 한글 커밋 생성**

```bash
git add .github/workflows/ci-cd.yml \
  backend/infra/tests/workflow_contract_test.sh \
  docs/superpowers/plans/2026-08-05-homeserver-blue-green-deployment.md
git commit -m "GHCR 인증을 실행별 임시 토큰으로 변경"
```
