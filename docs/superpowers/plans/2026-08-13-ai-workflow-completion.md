# AI Workflow Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop per-turn Markdown summaries and make completed code changes produce a RAG-indexed knowledge record and a PR draft workflow.

**Architecture:** Keep JSONL as the only automatic Hook record. Remove the Stop summary handler and its implementation. Define a stable `docs/knowledge/changes/` location in repository rules; Codex creates one factual document per tested code change, registers it in the explicit RAG manifest, rebuilds the local index, and creates or posts a PR body only when the branch state permits it.

**Tech Stack:** Codex Hook JSON, Python `unittest`, Markdown, explicit RAG corpus manifest, `gh` CLI.

## Global Constraints

- Preserve existing `ai/summaries/*.md`; do not create new summaries.
- Keep JSONL local and Git-excluded.
- Keep `docs/local/`, `docs/superpowers/plans/`, draft documents, and superseded documents out of RAG.
- Do not commit or push unless the user explicitly requests it.
- Create a GitHub PR only when its current branch already exists on the remote; otherwise write a Git-excluded PR-body draft.

---

### Task 1: Stop automatic Markdown summary generation

**Files:**
- Modify: `.codex/hooks.json`
- Modify: `.codex/hooks/tests/test_hook_config.py`
- Delete: `.codex/hooks/summarize_ai_log.py`
- Delete: `.codex/hooks/tests/test_summarize_ai_log.py`
- Modify: `.gitignore`
- Modify: `ai/README.md`

- [ ] **Step 1: Write a failing Hook configuration assertion.**

```python
def test_does_not_register_stop_summary_generation(self):
    self.assertNotIn("Stop", load_config()["hooks"])
```

- [ ] **Step 2: Run the Hook configuration test and confirm the assertion fails because the Stop handler exists.**

Run: `python3 .codex/hooks/tests/test_hook_config.py -v`

- [ ] **Step 3: Remove the Stop handler, summary implementation and summary tests. Add `/ai/summaries/*.md` to `.gitignore`; update `ai/README.md` to describe JSONL-only automatic records.**

- [ ] **Step 4: Run all Hook tests.**

Run: `python3 -m unittest discover -s .codex/hooks/tests -p 'test_*.py' -v`

### Task 2: Make the current Permission Guard design an active RAG source

**Files:**
- Modify: `docs/superpowers/specs/2026-08-12-ai-permission-guard-design.md`
- Modify: `ai/rag/corpus.json`
- Modify: `ai/rag/README.md`

- [ ] **Step 1: Change the design document from implementation-planning language to current implemented behavior, including the tested policy set and its security boundary.**

- [ ] **Step 2: Mark the design as active in the explicit corpus and document that plans, local files, draft and superseded documents are excluded.**

- [ ] **Step 3: Rebuild the ignored local index and run a `@rag` smoke query for Permission Guard.**

### Task 3: Define the automatic completion workflow

**Files:**
- Modify: `AGENTS.md`
- Create: `docs/knowledge/README.md`
- Create: `docs/knowledge/changes/.gitkeep`
- Modify: `ai/rag/corpus.json`
- Modify: `ai/rag/README.md`

- [ ] **Step 1: Add the completion rule: after code changes and passing relevant tests, create one factual `docs/knowledge/changes/YYYY-MM-DD-<topic>.md` record, register it as active RAG context and rebuild the local index.**

- [ ] **Step 2: Define the document template and directory boundary in `docs/knowledge/README.md`.**

```markdown
# Knowledge Records

`changes/` contains one AI-generated factual record for each tested code change.
Each record has: 목적, 변경 사항, 영향 범위, 검증, 남은 리스크.
```

- [ ] **Step 3: Add the PR rule: render `.github/PULL_REQUEST_TEMPLATE.md`; if the current branch exists on the remote, publish it with `gh`; otherwise put the draft in Git-excluded `_workspace/`. Never commit or push without an explicit user request.**

- [ ] **Step 4: Register `docs/knowledge/changes/` as an active explicit corpus source and explain the index refresh in the RAG README.**

### Task 4: Review the completed scope

- [ ] **Step 1: Run the RAG and Hook suites.**

Run: `python3 -m unittest discover -s .codex/rag/tests -p 'test_*.py' -v`

Run: `python3 -m unittest discover -s .codex/hooks/tests -p 'test_*.py' -v`

- [ ] **Step 2: Run `git diff --check` and inspect `git status --short`; confirm existing summary files remain unmodified and untracked.**
