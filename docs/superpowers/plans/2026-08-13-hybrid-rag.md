# DevChat Hybrid RAG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `@rag`로 시작한 Codex 요청에만 승인된 저장소 문서의 Hybrid 검색 근거를 자동 첨부한다.

> **실행 기록 (2026-08-13):** 계획의 Task 1~6을 완료했다. 실행 환경은 `/private/tmp`가 아닌 Git 제외 프로젝트 로컬 `.codex/rag/.venv`로 확정했다. 평가는 9개 질문(기대 문서 6, no-result 3)으로 축소해 수행했고, 결과는 `ai/rag/evaluation-results/2026-08-13/`에 기록했다. `multilingual-e5-small`과 threshold `0.88`을 채택했다.

**Architecture:** `ai/rag/corpus.json`의 `active` 문서만 제목 경계와 줄 번호를 유지한 chunk로 만들고 SQLite FTS5와 로컬 E5 임베딩 index에 저장한다. 검색은 sparse와 dense 후보를 RRF로 결합하고, 관련도 gate·인접 chunk 병합·1,200자 예산을 적용한다. 별도 `UserPromptSubmit` handler는 `@rag` 접두사를 확인한 경우에만 일회성 Python 프로세스에서 검색을 실행해 `additionalContext`를 반환한다.

**Tech Stack:** Python 3 표준 라이브러리, SQLite FTS5, `sentence-transformers==5.1.2`, `intfloat/multilingual-e5-small`, `intfloat/multilingual-e5-base`, Codex command hooks, `unittest`.

## Global Constraints

- `@rag`로 시작하지 않는 prompt는 모델 import·index 접근·추가 컨텍스트 반환을 하지 않고 exit 0으로 끝낸다.
- dense retrieval은 로컬 CPU에서만 실행한다. 모델 다운로드와 Python 패키지 설치는 명시적인 색인·평가 명령에서만 발생하며, OpenAI Embeddings API와 외부 vector DB는 사용하지 않는다.
- E5 문서는 `passage: `, 질문은 `query: ` 접두사를 붙여 `normalize_embeddings=True`로 임베딩한다.
- 색인 대상은 manifest에 명시되고 Git이 추적하는 저장소 내부 Markdown 파일뿐이다. `active` 이외의 상태, `ai/logs/`, 비밀 파일, Git 제외 파일, 원본 AI 로그는 거부한다.
- 검색 결과는 최대 3개이며, 인용 표기를 제외한 합계 본문은 1,200자를 넘지 않는다. 결과가 없거나 index·모델을 사용할 수 없으면 prompt를 막지 않고 stdout 없이 성공 종료한다.
- 결과마다 `path:start_line-end_line`을 포함한다. 검색 근거는 참고자료일 뿐 사실 보장이 아니며 Codex는 코드를 함께 확인한다.
- SQLite index와 Python bytecode는 로컬 생성물이다. `.DS_Store`, 기존 미추적 요약 파일, Logging Hook의 JSONL 형식과 Permission Guard 정책은 수정·stage·삭제하지 않는다.
- 기존 Logging `UserPromptSubmit` handler는 그대로 두고, RAG handler를 별도 matcher group으로 추가한다.
- 이 작업에서는 stage, commit, push, merge, rebase를 수행하지 않는다. 모델·패키지 다운로드처럼 네트워크를 쓰는 명령은 실행 직전에 사용자 승인을 받는다.

## File Structure

| Path | Responsibility |
| --- | --- |
| `.codex/rag/corpus.py` | manifest 검증, Git 추적·경로 경계 확인, active 문서 로드 |
| `.codex/rag/chunk_markdown.py` | Markdown heading 경계와 줄 번호를 보존한 최대 1,000자 chunk 생성 |
| `.codex/rag/embedding.py` | 지연 import한 E5 모델과 `query:`/`passage:` 임베딩 adapter |
| `.codex/rag/index.py` | `ScoredChunk` type, SQLite schema, FTS5 갱신, float32 embedding 저장·증분 재색인 |
| `.codex/rag/search.py` | `SearchResult` type, sparse/dense retrieval, RRF, no-result gate, 병합·컨텍스트 formatting |
| `.codex/rag/build_index.py` | manifest의 현재 모델로 runtime index를 명시적으로 생성하는 CLI |
| `.codex/rag/user_prompt_rag.py` | `UserPromptSubmit` stdin/stdout adapter; `@rag`에서만 search 호출 |
| `.codex/rag/tests/` | 외부 모델 다운로드 없이 fake embedder로 각 계약을 고정하는 unit test |
| `.codex/rag/requirements.txt` | 재현 가능한 `sentence-transformers==5.1.2` 의존성 |
| `ai/rag/corpus.json` | 모델 선택, 문서 상태와 승인 문서 allowlist |
| `ai/rag/eval-questions.json` | 기대 문서·no-result 사례를 포함한 고정 평가 질문 |
| `ai/rag/eval.py` | sparse/dense/hybrid를 같은 질문에 실행하고 지표·지연시간을 JSON/Markdown으로 기록 |
| `ai/rag/README.md` | 설치, 수동 색인, 평가, `@rag` 사용법과 한계 |
| `.codex/hooks.json` | 기존 logging group 뒤의 별도 RAG `UserPromptSubmit` handler |
| `.gitignore` | `/ai/rag/index/*.sqlite3`와 Python cache 제외 |

---

### Task 1: 승인 corpus와 line-aware Markdown chunk 계약

**Files:**
- Create: `ai/rag/corpus.json`
- Create: `.codex/rag/corpus.py`
- Create: `.codex/rag/chunk_markdown.py`
- Create: `.codex/rag/tests/test_corpus.py`
- Create: `.codex/rag/tests/test_chunk_markdown.py`

**Interfaces:**
- Produces: `CorpusDocument(path: str, status: str)` and `load_active_documents(repo_root: Path, manifest_path: Path) -> list[CorpusDocument]`.
- Produces: `Chunk(path: str, heading: str, start_line: int, end_line: int, content: str, content_sha256: str)` and `chunk_markdown(document: CorpusDocument, max_chars: int = 1000) -> list[Chunk]`.
- Consumes later: only validated, Git-tracked active Markdown documents and chunks with inclusive source line ranges.

- [ ] **Step 1: Write the failing manifest and chunk tests.**

```python
def test_load_active_documents_rejects_escape_untracked_and_log_paths(self):
    manifest.write_text(json.dumps({"documents": [
        {"path": "AGENTS.md", "status": "active"},
        {"path": "ai/logs/session.jsonl", "status": "active"},
        {"path": "../secret.md", "status": "active"},
        {"path": "draft.md", "status": "draft"},
    ]}), encoding="utf-8")
    self.assertEqual(
        [item.path for item in load_active_documents(repo, manifest)], ["AGENTS.md"]
    )

def test_chunk_markdown_keeps_heading_line_range_and_paragraph_boundaries(self):
    document = CorpusDocument("guide.md", "active")
    (repo / document.path).write_text("# 제목\n\n첫 문단\n\n## 세부\n둘째 문단\n")
    chunks = chunk_markdown(document, max_chars=20, repo_root=repo)
    self.assertEqual(
        [(chunk.heading, chunk.start_line, chunk.end_line) for chunk in chunks],
        [("제목", 1, 3), ("제목 > 세부", 5, 6)],
    )
```

- [ ] **Step 2: Run the two tests to verify they fail because the modules do not exist.**

Run: `python3 -m unittest .codex/rag/tests/test_corpus.py .codex/rag/tests/test_chunk_markdown.py -v`

Expected: import failure for `corpus` and `chunk_markdown`.

- [ ] **Step 3: Add the minimal manifest and validation implementation.**

Use this initial manifest. Only the listed `active` entries can be searched; `draft` and `superseded` entries exercise and document status filtering.

```json
{
  "embedding_model": "intfloat/multilingual-e5-small",
  "dense_min_score": 0.78,
  "documents": [
    {"path": "AGENTS.md", "status": "active"},
    {"path": "README.md", "status": "active"},
    {"path": "ai/ai-assisted-development-workflow.md", "status": "active"},
    {"path": "ai/permission-guard-policy.md", "status": "active"},
    {"path": "ai/permission-guard-case-study.md", "status": "active"},
    {"path": "docs/superpowers/specs/2026-08-05-homeserver-blue-green-deployment-design.md", "status": "active"},
    {"path": "docs/superpowers/specs/2026-08-08-query-plan-analysis-design.md", "status": "active"},
    {"path": "docs/superpowers/specs/2026-08-11-dm-cursor-pagination-design.md", "status": "active"},
    {"path": "docs/superpowers/specs/2026-08-12-ai-workflow-logging-hooks-design.md", "status": "active"},
    {"path": "docs/superpowers/specs/2026-08-12-notification-delivery-observability-design.md", "status": "draft"},
    {"path": "docs/superpowers/specs/2026-08-12-ai-permission-guard-design.md", "status": "superseded"}
  ]
}
```

Resolve every document path under `repo_root`, reject paths that leave it or do not end in `.md`, and call `git ls-files --error-unmatch -- <path>` before returning an active document. `chunk_markdown` must build a heading stack from `#`–`######`, split only at paragraph boundaries when the content exceeds 1,000 characters, and calculate `content_sha256` from its emitted `content`.

- [ ] **Step 4: Run the corpus and chunk tests again.**

Run: `python3 -m unittest .codex/rag/tests/test_corpus.py .codex/rag/tests/test_chunk_markdown.py -v`

Expected: PASS; a draft document, untracked file, log path, absolute path, and `..` path never become a chunk.

---

### Task 2: SQLite FTS5 sparse index and incremental index CLI

**Files:**
- Create: `.codex/rag/index.py`
- Create: `.codex/rag/build_index.py`
- Create: `.codex/rag/tests/test_index.py`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `list[Chunk]` from `chunk_markdown`.
- Produces: `ScoredChunk(chunk_id: int, path: str, heading: str, start_line: int, end_line: int, content: str, score: float, rank: int)`.
- Produces: `open_index(path: Path) -> sqlite3.Connection`, `sync_chunks(connection: sqlite3.Connection, chunks: list[Chunk], model_name: str) -> None`, `search_sparse(connection: sqlite3.Connection, query: str, limit: int) -> list[ScoredChunk]`.
- Produces: `build_index.py --repo-root PATH --manifest PATH --index PATH` with an index whose metadata model name equals the manifest’s `embedding_model`.

- [ ] **Step 1: Write the failing FTS and incremental-sync tests.**

```python
def test_sparse_search_returns_citation_and_exact_identifier_first(self):
    sync_chunks(conn, [
        chunk("docs/auth.md", "JWT", 10, 14, "jwt_refresh_token rotation"),
        chunk("docs/other.md", "Other", 1, 2, "refresh process"),
    ], "fake-model")
    results = search_sparse(conn, "jwt_refresh_token", limit=3)
    self.assertEqual(results[0].path, "docs/auth.md")
    self.assertEqual((results[0].start_line, results[0].end_line), (10, 14))

def test_sync_removes_deleted_chunks_and_skips_unchanged_content(self):
    original = chunk("docs/a.md", "A", 1, 2, "stable content")
    sync_chunks(conn, [original], "fake-model")
    first_id = conn.execute("SELECT id FROM chunks").fetchone()[0]
    sync_chunks(conn, [original], "fake-model")
    self.assertEqual(conn.execute("SELECT id FROM chunks").fetchone()[0], first_id)
    sync_chunks(conn, [], "fake-model")
    self.assertEqual(conn.execute("SELECT COUNT(*) FROM chunks").fetchone()[0], 0)
```

- [ ] **Step 2: Run the sparse-index test file and verify it fails.**

Run: `python3 -m unittest .codex/rag/tests/test_index.py -v`

Expected: import failure for `index`.

- [ ] **Step 3: Implement the SQLite schema and CLI.**

Create `chunks(id INTEGER PRIMARY KEY, path, heading, start_line, end_line, content, content_sha256, embedding BLOB, embedding_model)` and `metadata(key TEXT PRIMARY KEY, value TEXT NOT NULL)`. Create `chunks_fts` with `fts5(content, heading, content='chunks', content_rowid='id')` and maintain it whenever a chunk is inserted, changed, or removed. Store model name in `metadata`; `sync_chunks` must clear incompatible embeddings when `model_name` changes. Build a safe FTS expression from alphanumeric/Korean tokens only, returning an empty list for a blank query or an FTS syntax error.

`build_index.py` must refuse to create the directory implicitly outside the repository, use `ai/rag/index/devchat-context.sqlite3` only when that explicit path is supplied, and print a short count without document contents. Add `/ai/rag/index/*.sqlite3` and `/.codex/rag/__pycache__/` to `.gitignore`.

- [ ] **Step 4: Run the sparse tests and a local no-model smoke build.**

Run: `python3 -m unittest .codex/rag/tests/test_index.py -v`

Expected: PASS; the test database’s FTS rows agree with the chunk table.

Run: `python3 .codex/rag/build_index.py --help`

Expected: exit 0 and no model download. The actual index build happens only after Task 3’s dependency approval.

---

### Task 3: local E5 embedding adapter and dense vector storage

**Files:**
- Create: `.codex/rag/embedding.py`
- Create: `.codex/rag/requirements.txt`
- Create: `.codex/rag/tests/test_embedding.py`
- Modify: `.codex/rag/index.py`
- Modify: `.codex/rag/build_index.py`

**Interfaces:**
- Produces: `Embedder` protocol with `embed_passages(texts: list[str]) -> list[list[float]]` and `embed_query(text: str) -> list[float]`.
- Produces: `SentenceTransformerEmbedder(model_name: str)`; imports `sentence_transformers` only in its constructor and calls `SentenceTransformer(model_name, device="cpu")`.
- Produces: `pack_embedding(values: list[float]) -> bytes`, `unpack_embedding(value: bytes) -> list[float]`, and `load_dense_chunks(connection: sqlite3.Connection, model_name: str) -> list[ScoredChunk]`.

- [ ] **Step 1: Write failing adapter and storage tests with a fake SentenceTransformer.**

```python
def test_e5_adapter_uses_asymmetric_prefixes_and_normalized_embeddings(self):
    model = FakeSentenceTransformer([[0.6, 0.8], [1.0, 0.0]])
    adapter = SentenceTransformerEmbedder.from_model(model)
    self.assertEqual(adapter.embed_passages(["문서"]), [[0.6, 0.8]])
    self.assertEqual(adapter.embed_query("질문"), [1.0, 0.0])
    self.assertEqual(model.calls, [
        (["passage: 문서"], {"normalize_embeddings": True}),
        (["query: 질문"], {"normalize_embeddings": True}),
    ])

def test_float32_embedding_round_trip_and_model_mismatch(self):
    packed = pack_embedding([0.25, -0.5])
    self.assertEqual(unpack_embedding(packed), [0.25, -0.5])
    self.assertEqual(load_dense_chunks(conn, "other-model"), [])
```

- [ ] **Step 2: Run the embedding tests and verify they fail.**

Run: `python3 -m unittest .codex/rag/tests/test_embedding.py -v`

Expected: import failure for `embedding` and missing index functions.

- [ ] **Step 3: Add the adapter, pinned dependency, and index integration.**

Write exactly this requirements file:

```text
sentence-transformers==5.1.2
```

Use `array('f')` for float32 blobs and validate that every vector has the same non-zero dimension before writing it. `build_index.py` must construct the embedder only after corpus chunks have been validated, store passage embeddings with the manifest model name, and leave no partially committed index after an embedding error by wrapping the sync in a SQLite transaction.

- [ ] **Step 4: Run unit tests without downloading a model.**

Run: `python3 -m unittest .codex/rag/tests/test_embedding.py .codex/rag/tests/test_index.py -v`

Expected: PASS with only fake models; no `sentence_transformers` import is required for this test command.

- [ ] **Step 5: Request approval, then install and make the initial local index.**

After the user permits the network download, create a local virtual environment outside the repository and run:

```bash
python3 -m venv /private/tmp/devchat-rag-venv
/private/tmp/devchat-rag-venv/bin/pip install -r .codex/rag/requirements.txt
/private/tmp/devchat-rag-venv/bin/python .codex/rag/build_index.py \
  --repo-root "$PWD" \
  --manifest ai/rag/corpus.json \
  --index ai/rag/index/devchat-context.sqlite3
```

Expected: the first command downloads only Python packages; the build command downloads `intfloat/multilingual-e5-small` once into the local Hugging Face cache and writes an ignored SQLite index. Record its model name, document count, chunk count, and elapsed time without committing cache or index files.

---

### Task 4: Hybrid ranking, no-result behavior, and comparable evaluation

**Files:**
- Create: `.codex/rag/search.py`
- Create: `.codex/rag/tests/test_search.py`
- Create: `ai/rag/eval-questions.json`
- Create: `ai/rag/eval.py`
- Create: `.codex/rag/tests/test_eval.py`

**Interfaces:**
- Consumes: sparse `ScoredChunk`, dense cosine-scored `ScoredChunk`, and the active model name.
- Produces: `SearchResult(path: str, heading: str, start_line: int, end_line: int, content: str, rrf_score: float)`.
- Produces: `rrf_rank(sparse: list[ScoredChunk], dense: list[ScoredChunk], k: int = 60) -> list[ScoredChunk]`, `search_hybrid(query: str, sparse: list[ScoredChunk], dense: list[ScoredChunk], dense_min_score: float) -> list[SearchResult]`, and `format_context(results: list[SearchResult], max_chars: int = 1200) -> str`.
- Produces: `eval.py --mode sparse|dense|hybrid --index PATH --questions PATH --output-dir PATH` returning JSON and Markdown measurements with Recall@3, MRR, no-result precision, citation completeness, p50, and p95.

- [ ] **Step 1: Write the failing ranking, merge, budget, and metric tests.**

```python
def test_rrf_rewards_agreement_and_preserves_exact_sparse_hit(self):
    merged = rrf_rank(
        [scored("jwt.md", 1), scored("other.md", 2)],
        [scored("other.md", 1), scored("jwt.md", 2)],
    )
    self.assertEqual([item.path for item in merged], ["jwt.md", "other.md"])

def test_hybrid_returns_no_result_when_dense_and_sparse_gates_miss(self):
    results = search_hybrid(
        query="무관한 요리법", sparse=[], dense=[cosine("guide.md", 0.42)],
        dense_min_score=0.78,
    )
    self.assertEqual(results, [])

def test_format_context_merges_adjacent_chunks_and_never_exceeds_budget(self):
    context = format_context([result("guide.md", 10, 12, "가" * 600),
                              result("guide.md", 13, 15, "나" * 600)], max_chars=1200)
    self.assertIn("guide.md:10-15", context)
    self.assertLessEqual(document_body_char_count(context), 1200)

def test_evaluator_scores_expected_and_no_result_questions(self):
    metrics = evaluate_questions(fake_search, questions)
    self.assertEqual(metrics["citation_completeness"], 1.0)
    self.assertEqual(metrics["no_result_precision"], 1.0)
```

- [ ] **Step 2: Run the failing retrieval and evaluation tests.**

Run: `python3 -m unittest .codex/rag/tests/test_search.py .codex/rag/tests/test_eval.py -v`

Expected: import failure for `search` and `eval`.

- [ ] **Step 3: Implement deterministic retrieval rules.**

Calculate cosine only for vectors whose model name equals the selected index metadata. Dense candidates below the configured `dense_min_score` are discarded before RRF. A sparse hit requires at least one FTS candidate. RRF uses `1 / (60 + rank)` for one-based ranks, sums matching chunk IDs, sorts ties by path then start line, returns at most 3 results, and does not fabricate a result if both gates fail.

For adjacent chunks from the same path, merge only when the next `start_line <= previous.end_line + 1`; preserve the combined inclusive range. `format_context` must add results in ranked order only while complete result bodies fit inside 1,200 characters. Never truncate a body while retaining its original end-line citation.

Create 14 evaluation cases covering JWT/Redis, WebSocket, DM, notification delivery, Blue/Green, query-plan measurement, AI workflow, exact identifier lookup, Korean paraphrase retrieval, and three `expected_paths: []` no-result cases. Give each hit case one or more existing `active` manifest paths. Write both output files below the passed `--output-dir`; the output directory is explicit so evaluation never writes into `ai/logs`.

- [ ] **Step 4: Run the deterministic unit tests.**

Run: `python3 -m unittest .codex/rag/tests/test_search.py .codex/rag/tests/test_eval.py -v`

Expected: PASS; all fake citations contain non-empty path and inclusive line ranges.

- [ ] **Step 5: Compare small and base only after the initial model is available.**

With the approved virtual environment, run `eval.py` twice using isolated temporary indexes, once for `intfloat/multilingual-e5-small` and once for `intfloat/multilingual-e5-base`. For each model, run sparse, dense, and hybrid against the same 14 questions and save the six JSON/Markdown pairs under `ai/rag/evaluation-results/<UTC-date>/`. Select `multilingual-e5-base` only if its Hybrid results improve a measured retrieval metric or no-result precision without increasing incorrect citations; otherwise keep `multilingual-e5-small`. Set `dense_min_score` in `corpus.json` to the lowest threshold that preserves all three no-result cases in the selected model’s evaluation, rebuild `devchat-context.sqlite3`, and record the selected model, threshold, hardware, package version, corpus commit, metrics, and p50/p95 in the Markdown result.

---

### Task 5: `@rag`-only UserPromptSubmit adapter and Hook registration

**Files:**
- Create: `.codex/rag/user_prompt_rag.py`
- Create: `.codex/rag/tests/test_user_prompt_rag.py`
- Modify: `.codex/hooks.json`
- Modify: `.codex/hooks/tests/test_hook_config.py`

**Interfaces:**
- Produces: `extract_rag_query(prompt: str) -> str | None`, `build_hook_output(context: str) -> str`, and `main() -> int`.
- Consumes: stdin object with `hook_event_name`, `prompt`, and `cwd`; `search_hybrid` from `search.py` only after `extract_rag_query` succeeds.
- Produces: an empty stdout/exit 0 for non-`@rag`, no result, absent index, unavailable model, or a valid result JSON containing `hookSpecificOutput.hookEventName == "UserPromptSubmit"` and `additionalContext`.

- [ ] **Step 1: Write failing adapter and configuration tests.**

```python
def test_non_rag_prompt_returns_empty_stdout_without_search(self):
    result = invoke({"prompt": "DM 테스트를 고쳐줘", "cwd": str(repo)})
    self.assertEqual((result.returncode, result.stdout, result.stderr), (0, "", ""))

def test_rag_prompt_strips_marker_and_returns_limited_context(self):
    output = run_payload({"prompt": "@rag JWT 만료 정책", "cwd": str(repo)}, search=fake_search)
    self.assertEqual(fake_search.queries, ["JWT 만료 정책"])
    hook = json.loads(output)["hookSpecificOutput"]
    self.assertEqual(hook["hookEventName"], "UserPromptSubmit")
    self.assertIn("additionalContext", hook)

def test_user_prompt_submit_keeps_logging_and_adds_separate_rag_handler(self):
    groups = load_config()["hooks"]["UserPromptSubmit"]
    commands = [handler["command"] for group in groups for handler in group["hooks"]]
    self.assertTrue(any("log_ai_event.py" in command for command in commands))
    self.assertTrue(any("user_prompt_rag.py" in command for command in commands))
```

- [ ] **Step 2: Run the adapter and config tests to verify they fail.**

Run: `python3 -m unittest .codex/rag/tests/test_user_prompt_rag.py .codex/hooks/tests/test_hook_config.py -v`

Expected: missing adapter and missing second `UserPromptSubmit` handler assertion.

- [ ] **Step 3: Implement the lazy adapter and register it separately.**

`extract_rag_query` recognizes only a leading `@rag` followed by whitespace, trims the remaining query, and returns `None` for an empty query or all other prompts. `user_prompt_rag.py` must parse one JSON payload, discover the repo root from `cwd`, and perform all RAG imports after that check. Catch `OSError`, `ValueError`, `sqlite3.Error`, and missing optional-dependency errors; in each case return 0 with no stdout and no input/model path echoed to stderr.

Append this RAG group after the existing logging group without changing the logger command:

```json
{
  "hooks": [{
    "type": "command",
    "command": "/usr/bin/python3 \"$(git rev-parse --show-toplevel)/.codex/rag/user_prompt_rag.py\"",
    "timeout": 30
  }]
}
```

`build_hook_output` returns no JSON for blank context; otherwise it returns only the documented `hookSpecificOutput` object. The adapter does not record prompts or document content itself; existing Logging Hook remains the only event recorder.

- [ ] **Step 4: Run Hook and adapter regressions.**

Run: `python3 -m unittest .codex/rag/tests/test_user_prompt_rag.py .codex/hooks/tests/test_hook_config.py .codex/hooks/tests/test_hook_entrypoints.py -v`

Expected: PASS; the existing logging lifecycle test still sees empty stdout from its logging handler, and a non-`@rag` RAG adapter invocation never imports the embedding dependency.

---

### Task 6: operational documentation, end-to-end validation, and change review

**Files:**
- Create: `ai/rag/README.md`
- Modify: `ai/README.md`
- Modify: `docs/superpowers/specs/2026-08-12-devchat-rag-design.md` only if selected model or measured threshold differs from its current decision
- Verify only: all `.codex/rag/tests/test_*.py` and `.codex/hooks/tests/test_*.py`

**Interfaces:**
- Documents: explicit dependency installation, index rebuild, evaluation, `@rag` syntax, selected model, index freshness, token behavior, and failure behavior.
- Consumes: the selected model and measured threshold from Task 4.

- [ ] **Step 1: Write operational documentation before running the real Hook.**

Include these exact operational boundaries:

```markdown
- 일반 질문은 RAG 검색과 모델 로딩을 하지 않는다.
- `@rag <질문>`만 검색하며, 검색 본문은 최대 1,200자라서 해당 요청의 Codex 입력 토큰은 늘 수 있다.
- 모델·SQLite index는 로컬 생성물이다. index가 없거나 오래되면 `build_index.py`를 명시적으로 실행한다.
- 검색 근거는 파일·줄 번호가 있는 참고자료이며, 코드와 현재 상태를 별도로 확인한다.
- Hook은 보안 경계나 문서 정확성 보증이 아니다.
```

Add one `ai/README.md` bullet linking to `rag/README.md`. Document the exact virtual-environment commands, but do not include model cache files, index database, prompt text, or evaluation inputs containing secrets.

- [ ] **Step 2: Run complete deterministic tests.**

Run: `python3 -m unittest discover -s .codex/rag/tests -p 'test_*.py' -v`

Expected: PASS with no network access and no model download.

Run: `python3 -m unittest discover -s .codex/hooks/tests -p 'test_*.py' -v`

Expected: PASS; no existing Hook contract regresses.

- [ ] **Step 3: Run manual Hook smoke checks after the index exists.**

Run the RAG handler with a plain prompt and then with `@rag Blue/Green 롤백 절차`. Confirm the first returns empty stdout and the second returns valid `additionalContext` with an active-document citation. Repeat with a no-result query and confirm it returns empty stdout. Run only against the local working copy; do not deploy or contact production services.

- [ ] **Step 4: Review scope and record evidence.**

Run:

```bash
git status --short
git diff --check
git diff -- .codex/rag .codex/hooks.json .codex/hooks/tests .gitignore ai/rag ai/README.md docs/superpowers/specs/2026-08-12-devchat-rag-design.md docs/superpowers/plans/2026-08-13-hybrid-rag.md
```

Expected: only RAG implementation, its tests, Hook registration, ignore rules, RAG documentation, and the already approved design/plan documentation appear. Preserve pre-existing `.DS_Store` and `ai/summaries/` files; do not stage or commit anything.
