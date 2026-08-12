# DevChat AI Workflow Logging Hooks Implementation Plan

## 현재 상태 요약

Codex Logging Hook, 테스트, 저장소 작업 규칙과 PR 판단 기록은 구현됐다. Permission Guard와 Hybrid RAG는 아래 별도 설계만 존재하며 아직 구현하지 않았다.

- [x] 민감정보 마스킹과 안정적인 SHA-256 유틸리티
- [x] Git 기준점과 세션별 JSONL append
- [x] 검증 명령 분류와 사실 기반 Markdown 요약
- [x] `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop` 설정 계약
- [x] `AGENTS.md`, AI 워크플로우와 PR 판단 기록
- [x] 하위 디렉터리 실행, 마스킹, 응답 본문 미저장과 Git ignore 검증
- [ ] 사용자가 원래 `devchat` 경로의 `/hooks`에서 정의를 신뢰한 뒤 실제 Codex 턴 한 건을 운영 검증

현재 전체 Hook 테스트 명령은 다음과 같다.

```bash
python3 -m unittest discover -s .codex/hooks/tests -p 'test_*.py' -v
```

아래 내용은 구현 당시의 제약, TDD 단계, 계약 예시와 스모크 테스트를 보존한 상세 실행 기록이다. 예시와 실제 구현이 다르면 현재 `.codex/hooks/` 코드와 테스트를 기준으로 판단한다.

## 상세 구현 계획 및 실행 기록

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DevChat에 Superpowers 기반 AI 작업 절차와 Codex Logging Hook을 적용해 작업 요청, 도구 실행, Git 기준점, 검증 명령을 로컬에서 추적하고 사람이 검토할 수 있는 요약을 생성한다.

**Architecture:** `.codex/hooks.json`은 `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`을 Python 표준 라이브러리 스크립트에 연결한다. Hook은 모델 컨텍스트를 추가하지 않고 마스킹된 메타데이터만 JSONL에 기록하며, `Stop`에서 Git 기준점과 검증 명령을 Markdown으로 기계적으로 요약한다.

**Tech Stack:** Codex Hooks, Python 3 표준 라이브러리, `unittest`, Git, JSONL, Markdown

## Global Constraints

- RAG, MCP 서버, 권한 Guard는 구현하지 않는다.
- 외부 Python 패키지를 추가하지 않는다.
- Hook은 `additionalContext` 또는 모델 가시 출력 없이 종료한다.
- 원본 프롬프트와 전체 도구 결과를 디스크에 저장하지 않는다.
- `ai/logs/*.jsonl`은 항상 Git에서 제외한다.
- 현재 DevChat의 DM 페이지네이션, 쿼리 분석, 프런트엔드 변경을 수정하거나 되돌리지 않는다.
- 현재 수정 중인 `.gitignore`는 기존 변경을 보존하고 AI 로그 제외 규칙만 추가한다.
- 기존 미커밋 파일은 `initial_dirty_files`로 기록하고 Hook 이후 변경으로 표현하지 않는다.
- 사용자가 별도로 요청하지 않는 한 commit, push, merge, rebase를 수행하지 않는다.

---

### Task 1: 민감정보 마스킹 모듈

**Files:**
- Create: `.codex/hooks/redact_ai_log.py`
- Create: `.codex/hooks/tests/test_redact_ai_log.py`

**Interfaces:**
- Produces: `redact_text(value: str) -> str`
- Produces: `sha256_text(value: str) -> str`
- Produces: `redacted_preview(value: str, limit: int = 500) -> str`

- [ ] **Step 1: 실패하는 마스킹 테스트 작성**

`test_redact_ai_log.py`에 다음 동작을 각각 독립 테스트로 작성한다.

```python
from redact_ai_log import redact_text, redacted_preview, sha256_text


def test_redacts_bearer_token():
    assert redact_text("Authorization: Bearer secret-token") == "Authorization: Bearer [REDACTED]"


def test_redacts_password_assignment():
    assert redact_text("DB_PASSWORD=secret") == "DB_PASSWORD=[REDACTED]"


def test_redacts_database_uri_credentials():
    value = "mysql://dev:secret@localhost:3306/devchat"
    assert redact_text(value) == "mysql://[REDACTED]@localhost:3306/devchat"


def test_redacts_email_address():
    assert redact_text("owner@example.com") == "[REDACTED_EMAIL]"


def test_redacts_private_key_body():
    value = "-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----"
    assert redact_text(value) == "[REDACTED_PRIVATE_KEY]"


def test_preview_truncates_after_redaction():
    value = "token=secret " + "x" * 600
    preview = redacted_preview(value, limit=40)
    assert "secret" not in preview
    assert len(preview) <= 41


def test_sha256_is_stable():
    assert sha256_text("same") == sha256_text("same")
    assert sha256_text("same") != sha256_text("different")
```

- [ ] **Step 2: 테스트가 예상대로 실패하는지 확인**

Run:

```bash
python3 -m unittest discover -s .codex/hooks/tests -p 'test_redact_ai_log.py' -v
```

Expected: `ModuleNotFoundError` 또는 함수 미정의로 FAIL.

- [ ] **Step 3: 최소 마스킹 구현 작성**

`redact_ai_log.py`는 `re`, `hashlib`만 사용한다. 마스킹 순서는 개인키, URI 자격증명, Bearer 및 Cookie, 키-값 형태, 이메일 순서로 고정한다. `redacted_preview`는 마스킹 후 개행을 공백으로 바꾸고 제한을 넘으면 `…`를 붙인다.

- [ ] **Step 4: 마스킹 테스트 통과 확인**

Run:

```bash
python3 -m unittest discover -s .codex/hooks/tests -p 'test_redact_ai_log.py' -v
```

Expected: 모든 테스트 PASS, 비밀 문자열이 assertion 출력에 나타나지 않음.

### Task 2: 공통 Git 기준점 및 JSONL 기록

**Files:**
- Create: `.codex/hooks/hook_common.py`
- Create: `.codex/hooks/log_ai_event.py`
- Create: `.codex/hooks/tests/test_log_ai_event.py`

**Interfaces:**
- Consumes: `redact_text`, `redacted_preview`, `sha256_text`
- Produces: `find_repo_root(cwd: str) -> pathlib.Path`
- Produces: `git_snapshot(repo_root: pathlib.Path) -> dict[str, object]`
- Produces: `normalize_event(payload: dict[str, object], repo_root: pathlib.Path) -> dict[str, object]`
- Produces: `append_event(repo_root: pathlib.Path, event: dict[str, object]) -> pathlib.Path`
- Produces: `main() -> int`

- [ ] **Step 1: 실패하는 이벤트 정규화 테스트 작성**

테스트는 임시 Git 저장소를 만들고 사용자 이름과 이메일을 로컬 설정한 뒤 초기 commit을 생성한다. 다음 동작을 검증한다.

```python
def test_user_prompt_stores_only_redacted_preview_and_digest():
    payload = {
        "session_id": "session-1",
        "turn_id": "turn-1",
        "cwd": "/tmp/repo",
        "hook_event_name": "UserPromptSubmit",
        "prompt": "PASSWORD=secret fix DM query",
    }
    event = normalize_event(payload, repo_root)
    assert event["prompt_preview"] == "PASSWORD=[REDACTED] fix DM query"
    assert event["prompt_length"] == len(payload["prompt"])
    assert event["prompt_sha256"] == sha256_text(payload["prompt"])
    assert "prompt" not in event
```

```python
def test_pre_tool_use_redacts_command_and_keeps_tool_identity():
    payload = {
        "session_id": "session-1",
        "turn_id": "turn-1",
        "hook_event_name": "PreToolUse",
        "tool_name": "Bash",
        "tool_use_id": "tool-1",
        "tool_input": {"command": "PASSWORD=secret ./gradlew test"},
    }
    event = normalize_event(payload, repo_root)
    assert event["tool_name"] == "Bash"
    assert event["tool_input_preview"] == "PASSWORD=[REDACTED] ./gradlew test"
```

```python
def test_first_append_records_preexisting_dirty_files_once():
    append_event(repo_root, first_event)
    append_event(repo_root, second_event)
    records = read_jsonl(repo_root / "ai/logs/session-1.jsonl")
    assert records[0]["event"] == "SessionBaseline"
    assert records[0]["initial_dirty_files"] == ["existing.txt"]
    assert sum(record["event"] == "SessionBaseline" for record in records) == 1
```

```python
def test_post_tool_use_stores_response_metadata_not_body():
    payload = {
        "session_id": "session-1",
        "turn_id": "turn-1",
        "hook_event_name": "PostToolUse",
        "tool_name": "Bash",
        "tool_use_id": "tool-1",
        "tool_response": {"exit_code": 0, "output": "sensitive output"},
    }
    event = normalize_event(payload, repo_root)
    assert event["success"] is True
    assert event["response_length"] > 0
    assert "tool_response" not in event
    assert "sensitive output" not in str(event)
```

- [ ] **Step 2: 이벤트 테스트가 예상대로 실패하는지 확인**

Run:

```bash
python3 -m unittest discover -s .codex/hooks/tests -p 'test_log_ai_event.py' -v
```

Expected: 모듈 또는 함수 미정의로 FAIL.

- [ ] **Step 3: Git 스냅샷과 이벤트 정규화 구현**

`git_snapshot`은 다음 명령만 실행한다.

```text
git rev-parse HEAD
git branch --show-current
git status --porcelain=v1
```

`dirty_files`는 status 코드가 아니라 경로만 정렬해 반환한다. Git 명령 실패 시 Hook 전체를 실패시키지 않고 `base_commit: null`, `branch: null`, `dirty_files: []`와 `git_error`를 기록한다.

- [ ] **Step 4: 동시 안전한 JSONL append 구현**

`append_event`는 `ai/logs/<safe_session_filename>.jsonl`을 만들고 `fcntl.flock(LOCK_EX)`로 잠근다. 잠금 안에서 파일이 비어 있는 경우에만 `SessionBaseline`을 먼저 기록한다. 최종 구현은 세션 ID를 안전한 48자 prefix와 원문 SHA-256 앞 16자리로 구성해 경로 이탈, 긴 파일명과 정규화 충돌을 막는다.

- [ ] **Step 5: stdin 실행 진입점 구현**

`main`은 stdin JSON 하나를 읽어 정규화하고 append한다. 성공 시 stdout을 비운 채 `0`으로 종료한다. 잘못된 JSON이나 파일 쓰기 실패는 비밀정보를 포함하지 않는 짧은 오류만 stderr에 출력하고 `1`로 종료한다.

- [ ] **Step 6: 이벤트 테스트 통과 확인**

Run:

```bash
python3 -m unittest discover -s .codex/hooks/tests -p 'test_log_ai_event.py' -v
```

Expected: 모든 테스트 PASS.

### Task 3: 검증 명령 판별과 Markdown 요약

**Files:**
- Create: `.codex/hooks/summarize_ai_log.py`
- Create: `.codex/hooks/tests/test_summarize_ai_log.py`

**Interfaces:**
- Consumes: JSONL records from `append_event`
- Produces: `is_verification_command(command: str) -> bool`
- Produces: `build_summary(records: list[dict[str, object]], current_snapshot: dict[str, object]) -> str`
- Produces: `write_summary(repo_root: pathlib.Path, payload: dict[str, object]) -> pathlib.Path`
- Produces: `main() -> int`

- [ ] **Step 1: 실패하는 검증 및 요약 테스트 작성**

다음 명령만 검증 명령으로 분류한다.

```python
def test_detects_verification_commands():
    commands = [
        "./gradlew test",
        "./gradlew compileJava",
        "npm test",
        "yarn build",
        "bash backend/perf/query-analysis/tests/query_analysis_contract_test.sh",
    ]
    assert all(is_verification_command(command) for command in commands)
    assert not is_verification_command("git status --short")
```

요약 테스트는 다음을 검증한다.

```python
def test_summary_separates_initial_and_current_dirty_files():
    summary = build_summary(records, current_snapshot)
    assert "기존 미커밋 파일" in summary
    assert "backend/existing.java" in summary
    assert "Hook 실행 후 추가된 파일" in summary
    assert ".codex/hooks.json" in summary
```

```python
def test_summary_lists_verification_result_and_review_placeholders():
    summary = build_summary(records, current_snapshot)
    assert "./gradlew test" in summary
    assert "성공" in summary
    assert "채택한 제안과 이유:" in summary
    assert "기각한 제안과 이유:" in summary
    assert "남은 리스크:" in summary
```

- [ ] **Step 2: 요약 테스트가 예상대로 실패하는지 확인**

Run:

```bash
python3 -m unittest discover -s .codex/hooks/tests -p 'test_summarize_ai_log.py' -v
```

Expected: 모듈 또는 함수 미정의로 FAIL.

- [ ] **Step 3: 검증 명령 판별 구현**

검증 명령은 shell 파싱이나 실행 없이 문자열 prefix 및 포함 패턴으로만 분류한다. 대상은 Gradle의 `test`, `check`, `build`, `compile`; Node의 `test`, `build`, `lint`; 저장소의 `tests/` 아래 shell 스크립트와 k6 실행이다.

- [ ] **Step 4: 사실 기반 Markdown 요약 구현**

요약은 이벤트를 해석해 새로운 성과를 만들지 않는다. 최초 `SessionBaseline`, Pre/Post 도구 호출의 `tool_use_id`, 현재 Git 스냅샷을 연결해 다음 순서로 출력한다.

```markdown
# AI 보조 작업 요약

## 기준점
## 기존 미커밋 파일
## Hook 실행 후 추가된 파일
## 검증 명령
## 실패한 도구 호출
## 사람의 판단 기록
```

- [ ] **Step 5: Stop Hook 진입점 구현**

`main`은 Stop payload의 `session_id`와 `turn_id`로 JSONL을 찾고 요약을 작성한다. Codex의 Stop Hook은 exit `0`에서 JSON을 요구하므로 stdout에는 다음만 출력한다.

```json
{"continue": true}
```

로그가 없더라도 빈 요약을 만들지 않고 정상 종료한다.

- [ ] **Step 6: 요약 테스트 통과 확인**

Run:

```bash
python3 -m unittest discover -s .codex/hooks/tests -p 'test_summarize_ai_log.py' -v
```

Expected: 모든 테스트 PASS.

### Task 4: Codex Hook 설정과 계약 테스트

**Files:**
- Create: `.codex/hooks.json`
- Create: `.codex/hooks/tests/test_hook_config.py`
- Modify: `.gitignore`
- Create: `ai/logs/.gitkeep`
- Create: `ai/summaries/.gitkeep`

**Interfaces:**
- Consumes: `log_ai_event.py`, `summarize_ai_log.py`
- Produces: project-local Codex Hook configuration

- [ ] **Step 1: 실패하는 Hook 설정 계약 테스트 작성**

테스트는 `.codex/hooks.json`을 파싱해 다음 계약을 검사한다.

```python
def test_hook_config_registers_required_events():
    config = load_config()
    assert set(config["hooks"]) == {
        "UserPromptSubmit",
        "PreToolUse",
        "PostToolUse",
        "Stop",
    }


def test_tool_hooks_only_match_shell_and_file_edits():
    config = load_config()
    assert config["hooks"]["PreToolUse"][0]["matcher"] == "^(Bash|apply_patch|Edit|Write)$"
    assert config["hooks"]["PostToolUse"][0]["matcher"] == "^(Bash|apply_patch|Edit|Write)$"


def test_hooks_do_not_add_model_context():
    config = load_config()
    serialized = json.dumps(config)
    assert "additionalContext" not in serialized
    assert "additionalContextLimit" not in serialized
```

- [ ] **Step 2: 설정 테스트가 파일 부재로 실패하는지 확인**

Run:

```bash
python3 -m unittest discover -s .codex/hooks/tests -p 'test_hook_config.py' -v
```

Expected: `.codex/hooks.json` 부재로 FAIL.

- [ ] **Step 3: 프로젝트 Hook 설정 작성**

각 command는 하위 디렉터리에서 실행해도 안정적으로 동작하도록 Git 루트를 기준으로 스크립트를 찾는다.

```json
{
  "description": "DevChat AI workflow logging hooks",
  "hooks": {
    "UserPromptSubmit": [{
      "hooks": [{
        "type": "command",
        "command": "/usr/bin/python3 \"$(git rev-parse --show-toplevel)/.codex/hooks/log_ai_event.py\"",
        "timeout": 5
      }]
    }],
    "PreToolUse": [{
      "matcher": "^(Bash|apply_patch|Edit|Write)$",
      "hooks": [{
        "type": "command",
        "command": "/usr/bin/python3 \"$(git rev-parse --show-toplevel)/.codex/hooks/log_ai_event.py\"",
        "timeout": 5
      }]
    }],
    "PostToolUse": [{
      "matcher": "^(Bash|apply_patch|Edit|Write)$",
      "hooks": [{
        "type": "command",
        "command": "/usr/bin/python3 \"$(git rev-parse --show-toplevel)/.codex/hooks/log_ai_event.py\"",
        "timeout": 5
      }]
    }],
    "Stop": [{
      "hooks": [{
        "type": "command",
        "command": "/usr/bin/python3 \"$(git rev-parse --show-toplevel)/.codex/hooks/summarize_ai_log.py\"",
        "timeout": 10
      }]
    }]
  }
}
```

- [ ] **Step 4: 로그 제외 및 디렉터리 추가**

현재 `.gitignore` 끝에 다음 한 줄만 추가한다.

```gitignore
/ai/logs/*.jsonl
```

`.gitkeep`은 유지되므로 디렉터리 구조는 Git에서 확인할 수 있다.

- [ ] **Step 5: 설정 계약 테스트 통과 확인**

Run:

```bash
python3 -m unittest discover -s .codex/hooks/tests -p 'test_hook_config.py' -v
```

Expected: 모든 테스트 PASS.

- [ ] **Step 6: 전체 Python 테스트 실행**

Run:

```bash
python3 -m unittest discover -s .codex/hooks/tests -p 'test_*.py' -v
```

Expected: 모든 테스트 PASS.

### Task 5: DevChat AI 작업 규칙과 PR 판단 기록

**Files:**
- Create: `AGENTS.md`
- Create: `ai/README.md`
- Create: `ai/ai-assisted-development-workflow.md`
- Modify: `.github/PULL_REQUEST_TEMPLATE.md`

**Interfaces:**
- Consumes: Superpowers 역할 매핑과 Hook 산출물
- Produces: 사람과 AI가 함께 따르는 저장소 작업 규칙

- [ ] **Step 1: DevChat 고위험 영역과 실행 규칙 작성**

`AGENTS.md`에는 다음을 포함한다.

- 고위험 변경의 계획 및 승인 게이트
- 구현과 리뷰 분리
- Reviewer의 읽기 전용 원칙
- JWT 및 Redis 토큰 상태
- WebSocket 인증 및 재연결
- `AFTER_COMMIT` 비동기 이벤트의 유실과 중복
- 친구 관계와 DM 생성의 트랜잭션 경계
- Flyway 호환성
- 프런트엔드 및 백엔드 API 계약
- Blue/Green 배포와 공개 헬스체크
- 성능 주장의 측정 조건과 원본 결과
- AI 사용 범위와 검증 결과를 PR에 기록하는 규칙

- [ ] **Step 2: 사용자용 워크플로우 문서 작성**

`ai/ai-assisted-development-workflow.md`는 다음 흐름을 설명한다.

```text
Research → Plan → Human Approval → Implementation → Review → Verification → PR Record
```

Superpowers를 직접 만든 시스템으로 표현하지 않고, 플러그인의 절차를 DevChat 규칙에 적용했다고 명시한다. Logging Hook이 관찰 도구이며 권한 Guard가 아니라는 한계를 포함한다.

- [ ] **Step 3: PR 템플릿에 판단 기록 추가**

기존 템플릿을 유지하고 `Reference`와 `Check List` 사이에 다음 섹션을 추가한다.

```markdown
## AI 보조 작업 기록

- 사용 범위:
- 채택한 제안과 이유:
- 기각한 제안과 이유:
- 실행한 검증:
- 남은 리스크:
```

AI를 사용하지 않은 PR에서는 해당 섹션을 삭제할 수 있다는 안내를 한 줄 추가한다.

- [ ] **Step 4: 문서 일관성 확인**

Run:

```bash
rg -n "추적 가능성|검증 재현성|동일한 코드|정확성 보장|개발 안정성 향상|Superpowers" AGENTS.md ai .github/PULL_REQUEST_TEMPLATE.md
```

Expected: `추적 가능성`과 `검증 재현성`은 실제 구조의 의미로만 등장하고, 동일 코드 재현, AI 정확성 보장, 근거 없는 안정성 향상 표현은 없음.

### Task 6: Hook 스모크 테스트와 최종 검증

**Files:**
- Verify only: `.codex/hooks/*.py`
- Verify only: `.codex/hooks.json`
- Verify only: `ai/logs/`
- Verify only: `ai/summaries/`

**Interfaces:**
- Consumes: completed Hook implementation and configuration
- Produces: local JSONL and Markdown evidence

- [ ] **Step 1: 샘플 UserPromptSubmit 실행**

Run:

```bash
printf '%s' '{"session_id":"smoke-session","turn_id":"smoke-turn","cwd":"/Users/moon/Desktop/Works/devchat","hook_event_name":"UserPromptSubmit","permission_mode":"default","model":"smoke","prompt":"PASSWORD=secret DM cursor review"}' | python3 .codex/hooks/log_ai_event.py
```

Expected: stdout이 비어 있고 `ai/logs/smoke-session.jsonl`에 마스킹된 preview와 baseline이 생성됨.

- [ ] **Step 2: 샘플 PreToolUse 및 PostToolUse 실행**

Run:

```bash
printf '%s' '{"session_id":"smoke-session","turn_id":"smoke-turn","cwd":"/Users/moon/Desktop/Works/devchat","hook_event_name":"PreToolUse","tool_name":"Bash","tool_use_id":"smoke-tool","tool_input":{"command":"./gradlew test"}}' | python3 .codex/hooks/log_ai_event.py
```

Run:

```bash
printf '%s' '{"session_id":"smoke-session","turn_id":"smoke-turn","cwd":"/Users/moon/Desktop/Works/devchat","hook_event_name":"PostToolUse","tool_name":"Bash","tool_use_id":"smoke-tool","tool_input":{"command":"./gradlew test"},"tool_response":{"exit_code":0,"output":"BUILD SUCCESSFUL"}}' | python3 .codex/hooks/log_ai_event.py
```

Expected: 같은 `tool_use_id`의 Pre/Post 레코드가 생성되고 전체 output 본문은 저장되지 않음.

- [ ] **Step 3: 샘플 Stop 실행**

Run:

```bash
printf '%s' '{"session_id":"smoke-session","turn_id":"smoke-turn","cwd":"/Users/moon/Desktop/Works/devchat","hook_event_name":"Stop","permission_mode":"default","model":"smoke","stop_hook_active":false,"last_assistant_message":"done"}' | python3 .codex/hooks/summarize_ai_log.py
```

Expected: stdout은 `{"continue": true}`이고 `ai/summaries/`에 요약 Markdown이 생성됨.

- [ ] **Step 4: 민감정보 및 Git 제외 확인**

Run:

```bash
rg -n "secret|BUILD SUCCESSFUL" ai/logs/smoke-session.jsonl
```

Expected: 검색 결과 없음.

Run:

```bash
git check-ignore ai/logs/smoke-session.jsonl
```

Expected: `ai/logs/smoke-session.jsonl` 출력.

- [ ] **Step 5: 전체 Hook 테스트 재실행**

Run:

```bash
python3 -m unittest discover -s .codex/hooks/tests -p 'test_*.py' -v
```

Expected: 모든 테스트 PASS.

- [ ] **Step 6: 기존 사용자 변경 보존 확인**

Run:

```bash
git status --short
```

Expected: 기존 DM 페이지네이션 및 쿼리 분석 변경이 그대로 존재하며, 새 AI 워크플로우 파일만 추가 또는 의도한 범위로 수정됨.

Run:

```bash
git diff -- .gitignore .github/PULL_REQUEST_TEMPLATE.md AGENTS.md ai .codex docs/superpowers/specs/2026-08-12-ai-workflow-logging-hooks-design.md docs/superpowers/plans/2026-08-12-ai-workflow-logging-hooks.md
```

Expected: AI 워크플로우에 직접 필요한 변경만 표시됨.
