# DM Cursor Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the cursor-pagination review gaps without changing DM room authorization or committing the fixes.

**Architecture:** Validate the requested page size in the service before `size + 1` arithmetic, restrict the isolated MySQL host port to loopback, strengthen the k6 cursor contract, and make the A-to-C measurement procedure executable from documentation. Existing cursor queries and measured results remain unchanged.

**Tech Stack:** Java 23, Spring Boot, JUnit 5, k6, Docker Compose, Bash, Markdown

## Global Constraints

- Do not implement DM room participant authorization in this plan.
- Accept DM history sizes from 1 through 100 inclusive; reject all other values with HTTP 400 semantics.
- Do not stage, commit, push, or create a PR.
- Do not touch `.DS_Store` files.
- Preserve the existing A-to-C measurements and B-to-C attribution boundary.

---

### Task 1: Bound DM history size

**Files:**
- Modify: `backend/src/test/java/project/backend/domain/dm/dmMessage/app/DmMessageServiceTest.java`
- Modify: `backend/src/main/java/project/backend/domain/dm/dmMessage/app/DmMessageService.java`
- Modify: `backend/src/main/java/project/backend/global/exception/errorcode/DmErrorCode.java`
- Modify: `docs/superpowers/specs/2026-08-11-dm-cursor-pagination-design.md`

**Interfaces:**
- Consumes: `DmMessageService.getDmMessages(..., int size, ...)`.
- Produces: `DME-003`/BAD_REQUEST for `size < 1` or `size > 100` before `size + 1` is evaluated.

- [x] Add a parameterized service test with literal invalid sizes `0`, `-1`, `101`, and `Integer.MAX_VALUE` expecting `DmException`.
- [x] Run the focused test and confirm it fails because invalid sizes are not rejected by the service contract.
- [x] Add `INVALID_HISTORY_SIZE` and the minimal `size < 1 || size > 100` guard.
- [x] Re-run the focused test and confirm it passes.
- [x] Document the inclusive `1..100` API contract.

### Task 2: Restrict and verify the measurement environment

**Files:**
- Modify: `backend/perf/query-analysis/tests/query_analysis_contract_test.sh`
- Modify: `backend/perf/query-analysis/docker-compose.yml`
- Modify: `backend/perf/query-analysis/scripts/measure_dm_api.js`
- Modify: `backend/perf/query-analysis/README.md`

**Interfaces:**
- Consumes: Compose JSON and A/C API responses.
- Produces: host port `127.0.0.1:${MYSQL_HOST_PORT:-3307}:3306` and a k6 contract requiring `nextCursor` to equal the last returned message.

- [x] Change the Compose contract test to require host IP `127.0.0.1`; run it and confirm failure against the current all-interface mapping.
- [x] Bind the measurement MySQL port to loopback and re-run the contract test.
- [x] Add an executable k6 contract fixture where an incorrect C `nextCursor` fails, then require the cursor to equal the last content item’s `sendAt` and `messageId`.
- [x] Document exact A archive/build/start, environment, index removal/restoration, expected-ID/cursor queries, and both saved runs without exposing a token.
- [x] Run `k6 inspect`, the query-analysis contract, shell syntax checks, and `git diff --check`.

### Task 3: Final regression verification

**Files:**
- No production file changes.

**Interfaces:**
- Consumes: the completed fixes.
- Produces: fresh backend, frontend, performance-contract, and repository-state evidence.

- [x] Run the backend DM service and repository tests.
- [x] Run the frontend production build.
- [x] Verify ignored runtime JSON, `.DS_Store` exclusion, no staged files, and no new commits.
