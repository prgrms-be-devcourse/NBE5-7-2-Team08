# AI Token Usage Hook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 현재 Codex 세션의 실제 토큰 사용량을 기존 Hook 종료 요약에 사실값으로 연결한다.

**Architecture:** 토큰 파서는 Codex rollout의 `token_count` 레코드와 App Server의 `thread/tokenUsage/updated` 알림을 하나의 필드 구조로 정규화한다. `Stop` Hook은 전달받은 `transcript_path`에서 마지막 유효 레코드만 읽어 기존 세션 JSONL에 추가하고 요약한다. 포맷이 없거나 달라지면 숫자를 추정하지 않고 토큰 정보를 생략한다.

**Tech Stack:** Python 3 표준 라이브러리, Codex Hooks, JSONL, `unittest`

## Global Constraints

- A/B 비교, 절감률 계산과 토큰 절감 주장은 구현하지 않는다.
- transcript 전체 내용과 원문 메시지는 복사하지 않는다.
- 토큰 필드는 음이 아닌 정수일 때만 저장한다.
- App Server나 rollout 포맷이 예상과 다르면 Hook 종료를 실패시키지 않는다.
- 내부 계획·테스트 문서에는 `humanize-korean`을 적용하지 않는다.
- commit, push, merge와 rebase는 수행하지 않는다.

### Task 1: 토큰 사용량 정규화

**Files:**
- Create: `.codex/hooks/token_usage.py`
- Create: `.codex/hooks/tests/test_token_usage.py`

- [x] rollout과 App Server 샘플의 기대 필드, 잘못된 값과 마지막 레코드 선택 테스트를 작성하고 RED를 확인한다.
- [x] 두 입력 포맷을 `input_tokens`, `cached_input_tokens`, `cache_write_input_tokens`, `output_tokens`, `reasoning_output_tokens`, `total_tokens`, `model_context_window`으로 정규화한다.
- [x] transcript를 뒤에서 탐색해 마지막 유효 토큰 레코드만 반환한다.

### Task 2: Stop Hook과 요약 연결

**Files:**
- Modify: `.codex/hooks/summarize_ai_log.py`
- Modify: `.codex/hooks/tests/test_summarize_ai_log.py`
- Modify: `.codex/hooks/tests/test_hook_entrypoints.py`

- [x] `Stop` 입력의 `transcript_path`에서 토큰 사용량을 읽는 실패 테스트를 작성한다.
- [x] JSONL에는 `TokenUsageSnapshot` 메타데이터만 추가하고 Markdown 요약에 누적·최근 응답 토큰을 표시한다.
- [x] 토큰 정보가 없거나 잘못돼도 기존 요약 생성이 유지되는지 검증한다.

### Task 3: 문서와 전체 검증

**Files:**
- Modify: `ai/ai-assisted-development-workflow.md`
- Modify: `docs/superpowers/specs/2026-08-12-ai-workflow-logging-hooks-design.md`

- [x] 정확한 기록 범위와 transcript 포맷 의존 한계를 문서화한다.
- [x] 전체 Hook 테스트, JSON 설정, `git diff --check`와 Git 제외 상태를 검증한다.
