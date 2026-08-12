# DevChat AI Permission Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Codex `PreToolUse`에서 승인 설계의 여섯 위험 작업을 실행 전에 차단한다.

**Architecture:** `guard_policy.py`는 Bash와 `apply_patch` 입력을 실행·재작성 없이 검사하는 순수 판정 함수다. `guard_pre_tool_use.py`는 stdin JSON을 받아 판정 결과만 Codex `permissionDecision: deny` 형식으로 내보내며, Logging handler와 별도 `PreToolUse` matcher group에 등록한다.

**Tech Stack:** Python 3 표준 라이브러리, `unittest`, Codex command hooks

## Global Constraints

- 정책 ID: `GIT_DESTRUCTIVE`, `RECURSIVE_DELETE`, `SECRET_FILE_WRITE`, `PRODUCTION_DEPLOY`, `DATABASE_DESTRUCTIVE`, `UNSCOPED_GIT_STAGE`.
- 차단 이유는 정책 ID를 포함하고 명령·비밀 원문을 노출하지 않는다.
- 허용 시 stdout 없이 exit 0; `ask`, 승인 문자열 추측, bypass 파일, 명령 재작성은 사용하지 않는다.
- RAG는 이 변경에 포함하지 않는다.
- `.DS_Store`는 수정·stage·삭제하지 않는다.

---

### Task 1: 정책 판정 순수 함수

**Files:**
- Create: `.codex/hooks/guard_policy.py`
- Test: `.codex/hooks/tests/test_guard_policy.py`

**Interfaces:**
- Produces: `evaluate(tool_name: str, command: str, cwd: str) -> tuple[str, str] | None`
- Produces: 정책 ID와 비밀·원문이 없는 짧은 이유, 또는 허용 시 `None`.

- [ ] **Step 1: 각 정책의 차단·안전 허용 테스트를 작성한다.**

```python
def test_git_reset_hard_is_denied_but_scoped_restore_is_allowed():
    self.assertEqual(evaluate("Bash", "git reset --hard", CWD)[0], "GIT_DESTRUCTIVE")
    self.assertIsNone(evaluate("Bash", "git restore --source=HEAD src/App.java", CWD))
```

`git clean -fd`, force push, `git checkout -- .`, `git restore .`; `rm -rf .`, 상위·home·변수 경로; `apply_patch`의 `.env`·개인키·credential; production deploy/compose/container 제거; SQL `DROP`·`TRUNCATE`·WHERE 없는 `DELETE`; `git add .`·`git add -A`를 각각 차단하고, 범위가 명시된 대응 명령을 허용한다. 파이프·논리 연산자·따옴표도 포함한다.

- [ ] **Step 2: 실패를 확인한다.**

Run: `python3 -m unittest .codex/hooks/tests/test_guard_policy.py -v`

Expected: FAIL because `guard_policy` is missing.

- [ ] **Step 3: 최소 판정 함수를 구현한다.**

```python
def evaluate(tool_name: str, command: str, cwd: str) -> tuple[str, str] | None:
    if tool_name == "Bash":
        return _bash_violation(command, cwd)
    if tool_name == "apply_patch":
        return _patch_violation(command)
    return None
```

문자열을 정규화만 하고 실행하지 않는다. 정책은 구체적인 위험 패턴만 검사하며, 모호한 삭제 경로와 운영·DB 대상은 차단한다.

- [ ] **Step 4: 정책 테스트 통과를 확인한다.**

Run: `python3 -m unittest .codex/hooks/tests/test_guard_policy.py -v`

Expected: PASS.

### Task 2: Codex entrypoint와 Hook 등록

**Files:**
- Create: `.codex/hooks/guard_pre_tool_use.py`
- Modify: `.codex/hooks.json`
- Modify: `.codex/hooks/tests/test_hook_config.py`
- Create: `.codex/hooks/tests/test_guard_pre_tool_use.py`
- Modify: `.codex/hooks/tests/test_hook_entrypoints.py`

**Interfaces:**
- Consumes: `evaluate(tool_name, command, cwd)`.
- Produces: deny 시 `{ "hookSpecificOutput": { "hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "[POLICY_ID] ..." } }`; 허용 시 빈 stdout/0.

- [ ] **Step 1: entrypoint·config 실패 테스트를 작성한다.**

```python
def test_dangerous_command_returns_pre_tool_use_deny():
    result = invoke({"tool_name": "Bash", "tool_input": {"command": "git reset --hard"}})
    self.assertEqual(result.returncode, 0)
    self.assertEqual(json.loads(result.stdout)["hookSpecificOutput"]["permissionDecision"], "deny")

def test_safe_command_exits_successfully_without_stdout():
    result = invoke({"tool_name": "Bash", "tool_input": {"command": "git status --short"}})
    self.assertEqual((result.returncode, result.stdout), (0, ""))
```

config 테스트는 기존 Logging `PreToolUse` group을 보존하고 별도 `^(Bash|apply_patch|Edit|Write)$` group에 guard handler가 등록됨을 확인한다.

- [ ] **Step 2: 실패를 확인한다.**

Run: `python3 -m unittest .codex/hooks/tests/test_guard_pre_tool_use.py .codex/hooks/tests/test_hook_config.py -v`

Expected: FAIL because guard entrypoint and second matcher group are absent.

- [ ] **Step 3: 최소 entrypoint와 등록을 구현한다.**

```python
violation = evaluate(tool_name, command, cwd)
if violation is not None:
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": f"[{policy_id}] {reason}"}}))
return 0
```

Malformed JSON은 입력 원문 없이 stderr에 오류 유형만 쓰고 non-zero로 종료한다. `.codex/hooks.json`의 기존 Logging group은 변경하지 않고 Guard group을 추가한다.

- [ ] **Step 4: entrypoint·config 테스트 통과를 확인한다.**

Run: `python3 -m unittest .codex/hooks/tests/test_guard_pre_tool_use.py .codex/hooks/tests/test_hook_config.py .codex/hooks/tests/test_hook_entrypoints.py -v`

Expected: PASS.

### Task 3: 정책 운영 문서와 전체 회귀

**Files:**
- Create: `ai/permission-guard-policy.md`
- Verify only: `.codex/hooks/tests/test_*.py`

- [ ] **Step 1: 운영 문서를 작성한다.**

여섯 정책, Guard가 보조 통제라는 범위, 무우회 원칙, `/hooks` 재검토, 안전·위험 실제 CLI 검증 절차와 “차단 시도도 병렬 Logging Hook에 기록될 수 있음”을 문서화한다.

- [ ] **Step 2: 전체 Hook 회귀를 실행한다.**

Run: `python3 -m unittest discover -s .codex/hooks/tests -p 'test_*.py' -v`

Expected: PASS.

- [ ] **Step 3: 변경 범위와 stage 제외를 확인한다.**

Run: `git status --short && git diff --check && git diff -- .codex ai/permission-guard-policy.md docs/superpowers/plans/2026-08-12-ai-permission-guard.md`

Expected: `.DS_Store`는 미추적으로만 남고 Guard·tests·config·문서 변경만 표시된다.
