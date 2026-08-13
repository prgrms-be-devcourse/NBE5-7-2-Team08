# Hybrid RAG PR #7 리뷰 반영 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PR #7의 9개 미해결 리뷰를 TDD로 해결하고 검증 근거와 현재 문서를 최종 corpus에 맞춘다.

**Architecture:** build 단계와 runtime 단계의 모델 로딩 정책을 분리하고, 시스템 Python 래퍼로 optional runtime 실패를 흡수한다. corpus·chunk·context 계약을 테스트로 고정하고, 평가에서는 검색 품질과 실제 Hook 요청 지연시간을 분리 기록한다.

**Tech Stack:** Python 3, unittest, SQLite FTS5, sentence-transformers, Codex hooks.

## Global Constraints

- Runtime Hook은 모델 다운로드를 시도하지 않는다.
- `.venv` 또는 index가 없어도 Hook은 요청을 막지 않는다.
- `docs/superpowers/plans/`, `docs/local/` 및 심볼릭 링크 문서는 corpus에 포함하지 않는다.
- 커밋·푸시·PR 생성은 수행하지 않는다.

---

### Task 1: 모델 다운로드와 optional Hook runtime

**Files:**
- Modify: `.codex/rag/embedding.py`, `.codex/rag/build_index.py`, `.codex/hooks.json`
- Create: `.codex/rag/run_user_prompt_rag.py`
- Test: `.codex/rag/tests/test_embedding.py`, `.codex/rag/tests/test_user_prompt_rag.py`, `.codex/hooks/tests/test_hook_config.py`

- [ ] 모델 다운로드 허용 build와 오프라인 runtime의 failing test를 작성하고 실패를 확인한다.
- [ ] `.venv` 없는 Hook wrapper의 failing integration test를 작성하고 실패를 확인한다.
- [ ] 최소 구현 후 대상 테스트를 통과시킨다.

### Task 2: corpus와 chunk/context 경계

**Files:**
- Modify: `.codex/rag/corpus.py`, `.codex/rag/chunk_markdown.py`, `.codex/rag/search.py`
- Test: `.codex/rag/tests/test_corpus.py`, `.codex/rag/tests/test_chunk_markdown.py`, `.codex/rag/tests/test_search.py`

- [ ] 제외 디렉터리·symlink, 긴 문단, interleaved rank의 failing test를 작성하고 실패를 확인한다.
- [ ] 최소 구현 후 대상 테스트를 통과시킨다.

### Task 3: 최종 corpus 평가와 문서

**Files:**
- Modify: `ai/rag/eval.py`, `ai/rag/README.md`, `ai/rag/evaluation-results/2026-08-13/*`, `ai/ai-assisted-development-workflow.md`, 관련 current docs, `docs/knowledge/changes/`, `ai/rag/corpus.json`
- Test: `.codex/rag/tests/test_eval.py`

- [ ] 실제 Hook 요청 지연시간을 별도로 측정하는 failing test를 작성하고 실패를 확인한다.
- [ ] 평가 도구와 문서를 수정한다.
- [ ] 최종 manifest index 생성, 평가 재실행, 전체 회귀 테스트를 실행한다.
