# DevChat AI Permission Guard 설계

> **상태: 구현 및 자동 회귀 검증 완료.** 아래 `현행 확정사항`이 실행 기준이며, 이후 장문 섹션은 설계 근거와 상세 계약을 제공한다.

## 현행 확정사항

Logging Hook과 별도의 `PreToolUse` handler로 최소한의 위험 명령 차단 규칙을 적용했다. 이 Guard는 반복되는 실수를 줄이는 보조 통제이며 Codex 샌드박스나 운영체제 권한을 대체하는 보안 경계가 아니다.

다음 작업은 Codex 실행을 차단하고 사람이 터미널 또는 별도 승인 절차에서 수행한다.

- `git reset --hard`, 강제 push와 광범위한 checkout·restore
- 저장소, 홈, 루트처럼 넓은 경로의 재귀 삭제
- `.env`, 개인키와 운영 자격증명 파일 쓰기
- 운영 환경 배포와 운영 데이터베이스 파괴 명령
- 범위가 드러나지 않는 `git add .`, `git add -A`

`PreToolUse` payload만으로 과거 사용자 승인을 신뢰성 있게 판정할 수 없으므로 승인 여부를 명령 문자열에서 추측하지 않는다. 경로가 변수, glob 또는 명령 치환으로 모호하면 안전하게 차단한다. 필요한 운영 작업은 Guard 밖의 수동 절차나 별도 승인 인터페이스로 수행한다. 정책별 차단·허용 사례와 셸 인용 우회 회귀 테스트는 `.codex/hooks/tests/`에 있다.

동작 계약은 다음과 같다.

1. Logging Hook과 별도의 `PreToolUse` command handler로 실행한다.
2. Bash와 `apply_patch` 입력을 정규화하되 shell 명령을 실행하거나 재작성하지 않는다.
3. 차단 시 `permissionDecision: deny`와 정책 ID를 포함한 짧은 이유를 반환한다.
4. 허용 시 stdout 없이 종료한다.
5. 여러 matching Hook이 동시에 시작될 수 있으므로 Logging Hook에는 차단 시도도 기록될 수 있다.

자동 회귀 검증은 다음 명령으로 실행한다.

```bash
python3 -m unittest discover -s .codex/hooks/tests -p 'test_*.py' -v
```

---

이하 섹션은 정책 ID, 파일 구조, JSON 응답, 테스트와 완료 조건을 보존한 상세 설계다.

## 배경

Logging Hook은 AI가 어떤 도구를 실행했는지 추적하지만 위험한 실행을 막지는 않는다. DevChat은 배포 스크립트, 운영 Compose, 데이터베이스, 인증 정보와 같은 고위험 자산을 포함하므로 저장소 규칙을 위반하는 명령을 실행 전에 차단하는 별도 Guard가 필요하다.

이 Guard는 보안 샌드박스를 대체하지 않는다. 저장소에서 반복적으로 발생할 수 있는 명백한 실수와 승인 누락을 줄이는 보조 통제 수단이다.

## 선행 조건

- `2026-08-12-ai-workflow-logging-hooks-design.md`의 Logging Hook 구현과 테스트가 완료되어야 한다.
- Logging Hook과 Guard Hook은 별도 handler로 유지한다.
- Codex는 같은 이벤트의 matching hook을 함께 실행할 수 있으므로, 차단된 시도도 Logging Hook에 기록될 수 있다.

## 목표

- `PreToolUse`에서 명백하게 위험한 Bash 및 `apply_patch` 요청을 실행 전에 차단한다.
- 정책 ID와 차단 이유를 사용자에게 짧고 구체적으로 제공한다.
- 정책 자체를 자동 테스트하고 false positive 사례를 회귀 테스트로 관리한다.
- 프로젝트 파일에 저장된 승인 우회 토큰이나 범용 예외 기능은 제공하지 않는다.

## 제외 범위

- Codex 샌드박스와 운영체제 권한 모델 대체
- 모든 shell 우회 표현 탐지
- 네트워크 및 외부 서비스 접근의 완전한 통제
- `PermissionRequest` 자동 승인
- 위험 명령의 자동 재작성
- RAG 검색 및 컨텍스트 주입

## 초기 차단 정책

| 정책 ID | 차단 대상 |
| --- | --- |
| `GIT_DESTRUCTIVE` | `git reset --hard`, `git clean -fd`, 강제 push, 사용자 변경을 폐기하는 checkout 또는 restore |
| `RECURSIVE_DELETE` | 저장소 루트, 상위 디렉터리, 홈 디렉터리를 대상으로 한 재귀 삭제 |
| `SECRET_FILE_WRITE` | `.env`, 개인키, 인증서 키, credential 파일에 대한 `apply_patch` 쓰기 |
| `PRODUCTION_DEPLOY` | 명시적 사용자 요청 없이 운영 배포, 운영 Compose 재기동, 운영 컨테이너 제거 |
| `DATABASE_DESTRUCTIVE` | 운영 또는 대상 미확정 상태의 `DROP`, `TRUNCATE`, 전체 데이터 삭제 |
| `UNSCOPED_GIT_STAGE` | `git add .`, `git add -A`처럼 기존 사용자 변경을 함께 stage할 수 있는 명령 |

초기 버전은 allowlist 기반 범용 shell parser를 만들지 않는다. 위 정책에 해당하는 명확한 패턴만 차단한다. 명령을 안전하다고 증명할 수 없다는 이유만으로 모든 실행을 막지 않는다.

## 파일 구조

```text
.codex/hooks/
  guard_policy.py
  guard_pre_tool_use.py
  tests/
    test_guard_policy.py
    test_guard_pre_tool_use.py
.codex/hooks.json
ai/
  permission-guard-policy.md
```

`guard_policy.py`는 순수 함수로 정책 판정을 담당한다. `guard_pre_tool_use.py`는 Codex JSON 입출력만 담당한다.

## 입력 및 출력

Guard는 `tool_name`, `tool_input.command`, `cwd`를 사용한다. 차단 시 다음 형태를 stdout에 반환한다.

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "[GIT_DESTRUCTIVE] 기존 변경을 폐기할 수 있어 차단했습니다. 정확한 대상과 사용자 승인을 확인하세요."
  }
}
```

허용 시 stdout을 비우고 `0`으로 종료한다. `permissionDecision: ask`는 현재 지원되지 않으므로 사용하지 않는다.

## 승인 및 예외 처리

Guard에 영구 bypass 파일을 만들지 않는다. 차단된 작업이 실제로 필요하면 사용자가 정확한 대상과 의도를 확인한 뒤 Codex 밖에서 직접 실행하거나, 향후 별도 승인 인터페이스를 통해 수행한다. `PreToolUse` 입력에서 승인 여부를 추측해 자동 우회하지 않으며 이 과정은 사람의 명시적 판단으로 남긴다.

## 검증

- 각 정책은 차단 사례와 유사하지만 안전한 허용 사례를 함께 테스트한다.
- 파이프, 논리 연산자, 따옴표가 포함된 대표 명령을 테스트한다.
- `apply_patch`는 대상 경로를 추출해 비밀 파일 쓰기만 차단한다.
- 차단 이유에는 명령 원문이나 비밀 값 전체를 포함하지 않는다.
- Logging Hook 테스트와 Guard 테스트를 함께 실행해 설정 충돌이 없는지 확인한다.

## 완료 조건

- 여섯 초기 정책의 차단 및 허용 회귀 테스트가 통과한다.
- 실제 Codex `PreToolUse`에서는 안전한 명령이 실행되고 위험 명령은 실행 전에 차단되어야 한다. Hook을 새 환경에서 신뢰한 뒤 수동 smoke 검증으로 확인한다.
- 차단된 시도가 Logging Hook에 기록된다.
- 사용자가 정책 ID와 수정 방향을 확인할 수 있다.
- false positive가 발견되면 정책 수정 전에 재현 테스트가 추가된다.

## 이력서 표현 조건

테스트와 실제 차단 사례가 생기기 전에는 Permission Guard를 구축했다고 쓰지 않는다. 적용 후에도 완전한 보안 통제라고 표현하지 않는다.

사용 가능한 표현은 다음과 같다.

> Codex PreToolUse Guard를 적용해 사용자 변경 폐기, 비밀 파일 수정, 대상이 불명확한 운영 명령을 실행 전에 차단하고 정책별 회귀 테스트로 오탐을 관리했습니다.
