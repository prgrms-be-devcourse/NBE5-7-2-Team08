# DM API A-to-C Measurement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the post-change curl smoke check with a reproducible k6 comparison between the original DM API and the final composite-cursor API, while attributing cursor-specific gains only to the existing B-to-C SQL comparison.

**Architecture:** A single k6 scenario runs first-page and deep-history requests sequentially with one VU. It supports the original `Page/OFFSET` contract and the final composite-cursor contract through an explicit mode, validates that both versions return the same logical message sets, and records custom metrics that exclude setup warmups. Branch startup and schema preparation remain explicit README steps so the measurement does not hide destructive database reset or index changes.

**Tech Stack:** k6, Bash contract tests, Spring Boot, MySQL 8.4, Markdown

## Global Constraints

- Work in `/Users/moon/Desktop/Works/devchat`; do not create a worktree.
- Do not stage, commit, push, or create a PR.
- Do not touch or include `.DS_Store` files.
- API comparison is A (`2af8f64`) to C (current working tree), not B to C.
- Cursor-specific attribution remains B (`refactor/dm-notification-query-optimization`) to C through `EXPLAIN ANALYZE`.
- Use one VU, 50 measured iterations per path, one warmup request per path, and two saved runs per version.
- Do not describe SQL execution time as end-to-end API latency.

---

### Task 1: Lock the k6 measurement contract

**Files:**
- Modify: `backend/perf/query-analysis/tests/query_analysis_contract_test.sh`
- Delete: `backend/perf/query-analysis/scripts/measure_dm_api.sh`
- Create: `backend/perf/query-analysis/scripts/measure_dm_api.js`

**Interfaces:**
- Consumes: `MODE`, `BASE_URL`, `AUTH_COOKIE`, `ROOM_ID`, cursor values, and expected ID sets from environment variables.
- Produces: k6 custom duration and failure metrics for first-page and deep-history requests.

- [ ] **Step 1: Change the contract test first**

Require `measure_dm_api.js`, its A/C modes, `iterations: 50`, the original `page=4500` request, the final cursor request, contract validation, and the absence of the old shell script.

- [ ] **Step 2: Run the contract test and verify RED**

Run: `bash backend/perf/query-analysis/tests/query_analysis_contract_test.sh`

Expected: failure because `scripts/measure_dm_api.js` does not exist.

- [ ] **Step 3: Implement the minimal k6 scenario**

Add one setup warmup per path, 50 sequential iterations, response-shape selection for A and C, exact logical message-set validation, and custom p(50)/p(95)-capable duration metrics. Delete the curl/awk shell script.

- [ ] **Step 4: Run syntax and contract verification**

Run: `k6 inspect backend/perf/query-analysis/scripts/measure_dm_api.js`

Run: `bash backend/perf/query-analysis/tests/query_analysis_contract_test.sh`

Expected: both pass.

### Task 2: Measure the original and final APIs

**Files:**
- Create at runtime only: ignored `backend/perf/query-analysis/results/high-api-*.json`

**Interfaces:**
- Consumes: the same High seed data and logical message ID sets for A and C.
- Produces: two saved k6 summaries for A and two for C.

- [ ] **Step 1: Prepare the isolated High database**

Run the existing reset and High seed scripts. For A, remove only the V5 DM/notification indexes to reproduce its historical schema; restore them before C. Verify the exact database and indexes at each boundary.

- [ ] **Step 2: Export and start A without changing the checkout**

Use `git archive 2af8f64` into a temporary directory, start that backend against the isolated database with `ddl-auto=none`, and wait for health readiness.

- [ ] **Step 3: Run A twice**

Execute k6 in `MODE=before`, one VU and 50 iterations, saving two JSON summaries. Validate HTTP status, page shape, size, and logical ID sets.

- [ ] **Step 4: Stop A, restore V5 indexes, and start C**

Start the current backend against the same isolated High database and configuration.

- [ ] **Step 5: Run C twice**

Execute k6 in `MODE=after` using the cursor immediately before OFFSET 90000, saving two JSON summaries. Validate `hasNext`, `nextCursor`, size, and the same logical ID sets used for A.

- [ ] **Step 6: Stop the backend and verify database restoration**

Confirm both V5 indexes exist and the High row counts remain intact.

### Task 3: Document evidence and attribution

**Files:**
- Modify: `backend/perf/query-analysis/README.md`
- Modify: `backend/perf/query-analysis/results/summary.md`
- Modify: `docs/superpowers/specs/2026-08-11-dm-cursor-pagination-design.md`

**Interfaces:**
- Consumes: saved A/C k6 summaries and existing B/C SQL results.
- Produces: a reproducible measurement guide and claims suitable for a PR or resume without attribution leakage.

- [ ] **Step 1: Replace curl documentation**

Document environment variables, A/C request contracts, two-run commands, same-logical-position validation, and custom metrics. Explicitly say this is a short sequential comparison, not a throughput or SLO test.

- [ ] **Step 2: Record measured results**

Replace the post-change-only curl table with A/C k6 p50, p95, average, min, max, and error/contract failure rates from both saved runs.

- [ ] **Step 3: State attribution boundaries**

Document that A-to-C API values represent the combined final user-visible improvement; B-to-C `EXPLAIN ANALYZE` isolates the composite cursor effect; A-to-B evidence belongs to the parent query-optimization work. State that the deep comparison assumes the client already holds the cursor and does not measure random page jumping.

- [ ] **Step 4: Verify final artifacts**

Run the contract test, `k6 inspect`, shell syntax checks, `git diff --check`, and inspect `git status --short`. Do not stage or commit.
