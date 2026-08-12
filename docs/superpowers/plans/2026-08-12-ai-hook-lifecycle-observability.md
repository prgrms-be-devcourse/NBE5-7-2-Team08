# AI Hook Lifecycle Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 서브에이전트 경계, 승인 요청과 실패 원인을 민감정보 원문 없이 세션 로그와 종료 요약에서 추적한다.

**Architecture:** 기존 JSONL 로거가 세 이벤트를 추가로 정규화한다. 전체 transcript와 응답은 복사하지 않고 마스킹된 제한 미리보기, 길이, SHA-256과 구조화된 식별자만 저장한다. `Stop` 요약은 역할 실행, 승인 요청, 실패 도구를 사람이 검토할 수 있게 정리한다.

**Tech Stack:** Codex command hooks, Python 3 표준 라이브러리, `unittest`, JSONL, Markdown

## Global Constraints

- Hook은 `additionalContext`와 `systemMessage`를 반환하지 않는다.
- 모든 이벤트는 세션·턴 ID, 모델과 권한 모드를 공통 메타데이터로 기록한다.
- 서브에이전트 transcript 본문과 전체 도구 응답은 복사하지 않는다.
- 서브에이전트 결과 미리보기는 마스킹 후 300자, 실패 응답은 마스킹 후 500자로 제한한다.
- 대상 파일과 transcript 경로도 마스킹한다. 대상 경로는 한 건당 500자, 한 호출과 종료 요약은 각각 100건으로 제한하고 전체 개수와 제한 여부를 기록한다.
- PermissionRequest는 기록만 하고 `allow` 또는 `deny`를 반환하지 않는다.
- `SubagentStop`은 기록 후 `{"continue": true}`를 반환한다.
- 기존 미커밋 문서와 `.DS_Store`를 수정하거나 stage하지 않는다.

### Task 1: 이벤트 정규화와 출력 계약

**Files:**
- Modify: `.codex/hooks/tests/test_log_ai_event.py`
- Modify: `.codex/hooks/tests/test_hook_entrypoints.py`
- Modify: `.codex/hooks/log_ai_event.py`

- [x] SubagentStart, SubagentStop, PermissionRequest와 실패 응답의 기대 레코드를 테스트로 고정하고 RED를 확인한다.
- [x] 마스킹된 미리보기, 입력 길이·해시, agent 메타데이터, transcript 경로, affected paths와 exit code를 최소 구현한다.
- [x] SubagentStop JSON 출력과 나머지 이벤트의 빈 stdout을 검증한다.

### Task 2: Hook 설정과 종료 요약

**Files:**
- Modify: `.codex/hooks/tests/test_hook_config.py`
- Modify: `.codex/hooks/tests/test_summarize_ai_log.py`
- Modify: `.codex/hooks.json`
- Modify: `.codex/hooks/summarize_ai_log.py`

- [x] 세 이벤트 등록과 모델 컨텍스트 미추가 계약을 테스트로 고정하고 RED를 확인한다.
- [x] 요약의 서브에이전트, 승인 요청과 실패 도구 섹션을 테스트로 고정하고 RED를 확인한다.
- [x] 설정과 요약을 최소 구현하고 관련 테스트를 통과시킨다.

### Task 3: 문서와 전체 검증

**Files:**
- Modify: `ai/ai-assisted-development-workflow.md`
- Modify: `docs/superpowers/specs/2026-08-12-ai-workflow-logging-hooks-design.md`
- Modify: `docs/superpowers/plans/2026-08-12-ai-workflow-logging-hooks.md`

- [x] 실제 기록 필드, 보안 경계와 승인 결과 미확인 한계를 문서에 반영한다.
- [x] `humanize-korean` fast mode로 사람이 읽는 한국어 문장을 점검한다.
- [x] 전체 Hook 테스트, `git diff --check`와 Git 제외 상태를 검증한다.
