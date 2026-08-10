# DevChat Query Plan Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 네 조회 경로를 격리된 MySQL 8.4에서 Small·Medium 데이터셋으로 재현하고, 실제 SQL 및 `EXPLAIN ANALYZE` 결과를 비교해 심화 분석 대상을 하나 선택한다.

**Architecture:** `backend/perf/query-analysis`는 운영 Compose와 별개의 Compose 프로젝트로 MySQL 8.4과 전용 볼륨을 실행한다. 마이그레이션 SQL은 빈 실험 DB에 읽기 전용으로 마운트하고, 셸 스크립트가 고정된 실험 컨테이너에만 데이터 생성·검증·분석 SQL 실행을 수행한다. 결과는 규모별 원본 실행 계획과 사람이 읽는 비교표로 저장한다.

**Tech Stack:** Docker Compose, MySQL 8.4, 프로젝트 Flyway SQL 마이그레이션, POSIX-compatible Bash, MySQL CLI.

> **완료 후 확장:** 아래 Task 1–4는 심화 대상을 고르기 위한 최초 Small·Medium 계획을 기록한다. 실행 결과 DM을 선택했고, 후속 작업으로 High(100,000행), V5 인덱스, `compare_dm.sh` 개선 전후 측정, DM ID Page + sender fetch, 알림 EntityGraph와 관련 통합 테스트를 추가했다. 현재 재현 명령과 최종 수치는 `backend/perf/query-analysis/README.md`와 `results/summary.md`를 기준으로 한다.

## Global Constraints

- 분석 DB는 `devchat_query_analysis`이고 Compose 프로젝트 이름은 `devchat-query-analysis`로 고정한다.
- 실험 컨테이너와 볼륨은 각각 `devchat-query-analysis-mysql`, `devchat_query_analysis_mysql_data`만 사용한다.
- 운영·홈서버·공용 개발 DB 주소를 인자로 받거나 참조하지 않는다.
- 1차 분석은 Small(대상 1,000행)과 Medium(대상 10,000행)만 생성한다. Large와 API 부하 테스트는 후보 선택 뒤 별도 작업이다.
- 알림 대상 수신자의 unread 비율은 20%로 고정하고, 각 도메인에는 동일 수의 대상 외 행을 생성한다.
- `NotificationRepository`는 목록 및 unread 목록 각각의 select와 count를, `DmMessageRepository`는 projection select와 count를 분석한다.
- 단체채팅은 `idx_chat_room_messageid_desc (room_id, message_id DESC)`를 가진 기준선으로만 분석한다. 운영 코드를 변경하지 않는다.
- 데이터 초기화는 Compose 프로젝트·컨테이너·DB 이름 검증이 모두 통과할 때만 수행한다.
- 사용자가 명시적으로 요청할 때까지 Git 스테이징·커밋·푸시는 하지 않는다.

---

## File Structure

- Create: `backend/perf/query-analysis/docker-compose.yml` — MySQL 8.4 전용 실험 환경과 마이그레이션 마운트.
- Create: `backend/perf/query-analysis/.env.example` — 실험 DB 전용 비밀값 예시와 고정 식별자.
- Create: `backend/perf/query-analysis/scripts/lib.sh` — Compose 호출, 식별자 검증, MySQL 실행을 제공하는 공통 함수.
- Create: `backend/perf/query-analysis/scripts/reset.sh` — 검증 후 전용 볼륨을 제거하고 DB 준비 완료까지 대기.
- Create: `backend/perf/query-analysis/scripts/seed.sh` — `small` 또는 `medium` 데이터를 멱등적으로 생성하고 분포를 검증.
- Create: `backend/perf/query-analysis/sql/seed.sql` — `@target_rows`를 받아 Member, 방, 알림, DM, 단체채팅 데이터를 만드는 SQL.
- Create: `backend/perf/query-analysis/sql/analyze.sql` — 네 경로의 select·count 및 깊은 커서 SQL에 대한 `EXPLAIN ANALYZE`.
- Create: `backend/perf/query-analysis/scripts/analyze.sh` — 준비 실행과 재실행을 수행하고 규모별 원본 결과 파일을 저장.
- Create: `backend/perf/query-analysis/scripts/verify.sh` — 컨테이너·스키마·행 수·비율·인덱스를 자동 확인.
- Create: `backend/perf/query-analysis/tests/query_analysis_contract_test.sh` — 안전장치와 출력 파일 계약을 검증.
- Create: `backend/perf/query-analysis/README.md` — 실행 명령, SQL과 Repository의 대응 관계, 해석 규칙, 심화 대상 선택 표.
- Create: `backend/perf/query-analysis/results/.gitkeep` — 생성 결과 디렉터리 유지용 빈 파일.
- Modify: `.gitignore` — `backend/perf/query-analysis/results/*.txt`와 로컬 `.env`만 무시하고 `.gitkeep`은 유지.

### Task 1: Isolated MySQL Environment

**Files:**
- Create: `backend/perf/query-analysis/docker-compose.yml`
- Create: `backend/perf/query-analysis/.env.example`
- Create: `backend/perf/query-analysis/scripts/lib.sh`
- Test: `backend/perf/query-analysis/tests/query_analysis_contract_test.sh`

**Interfaces:**
- Produces: `qa_compose`, `qa_assert_target`, `qa_mysql`, `qa_wait_for_mysql` shell functions exported by `scripts/lib.sh`.
- Consumes: migration files at `backend/src/main/resources/db/migration/V1__baseline.sql` through `V4__remove_indexed_and_created_at_column.sql`.

- [ ] **Step 1: Write the failing Compose contract test**

```bash
config=$(docker compose --project-name devchat-query-analysis \
  --env-file "$ROOT/.env" -f "$ROOT/docker-compose.yml" config --format json)

python3 -c '
import json, sys
service = json.load(sys.stdin)["services"]["mysql"]
assert service["container_name"] == "devchat-query-analysis-mysql"
assert service["image"] == "mysql:8.4"
assert service["environment"]["MYSQL_DATABASE"] == "devchat_query_analysis"
assert service["volumes"]
' <<<"$config"
```

- [ ] **Step 2: Run the contract test and confirm it fails because the experiment files do not exist**

Run: `bash backend/perf/query-analysis/tests/query_analysis_contract_test.sh`

Expected: non-zero exit because `docker-compose.yml` is absent.

- [ ] **Step 3: Add the minimal isolated Compose environment and helper library**

```yaml
services:
  mysql:
    image: mysql:8.4
    container_name: devchat-query-analysis-mysql
    environment:
      MYSQL_DATABASE: devchat_query_analysis
      MYSQL_USER: query_analysis
      MYSQL_PASSWORD: query_analysis_local_only
      MYSQL_ROOT_PASSWORD: query_analysis_root_local_only
    command: [--character-set-server=utf8mb4, --collation-server=utf8mb4_0900_ai_ci]
    volumes:
      - devchat_query_analysis_mysql_data:/var/lib/mysql
      - ../../src/main/resources/db/migration:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: [CMD-SHELL, mysqladmin ping -h 127.0.0.1 -uquery_analysis -pquery_analysis_local_only --silent]
      interval: 5s
      timeout: 3s
      retries: 20
volumes:
  devchat_query_analysis_mysql_data:
    name: devchat_query_analysis_mysql_data
```

```bash
qa_assert_target() {
  test "$(qa_compose config --format json | python3 -c 'import json,sys; print(json.load(sys.stdin)["services"]["mysql"]["container_name"])')" = "devchat-query-analysis-mysql"
  test "$(qa_mysql 'SELECT DATABASE();')" = "devchat_query_analysis"
}
```

Make every helper call `qa_assert_target` before destructive database commands. Do not accept a host, port, database, or Compose project name argument.

- [ ] **Step 4: Run the contract test and verify the rendered Compose configuration**

Run: `bash backend/perf/query-analysis/tests/query_analysis_contract_test.sh`

Expected: exit 0 and `query-analysis Compose contract passed`.

### Task 2: Reproducible Small and Medium Seed Data

**Files:**
- Create: `backend/perf/query-analysis/scripts/reset.sh`
- Create: `backend/perf/query-analysis/scripts/seed.sh`
- Create: `backend/perf/query-analysis/sql/seed.sql`
- Create: `backend/perf/query-analysis/scripts/verify.sh`
- Modify: `backend/perf/query-analysis/tests/query_analysis_contract_test.sh`

**Interfaces:**
- Consumes: `qa_compose`, `qa_assert_target`, `qa_mysql`, and `qa_wait_for_mysql` from `scripts/lib.sh`.
- Produces: `reset.sh` with no arguments; `seed.sh small|medium`; `verify.sh small|medium`.
- Dataset IDs: target receiver/member `1`, other receiver/member `2`, target DM room `1`, other DM room `2`, target chat room `1`, other chat room `2`.

- [ ] **Step 1: Extend the failing contract test for accepted scales and safe reset**

```bash
if "$ROOT/scripts/seed.sh" large; then
  echo "large must be rejected in first-phase analysis" >&2
  exit 1
fi

if "$ROOT/scripts/reset.sh" unexpected; then
  echo "reset must reject arguments" >&2
  exit 1
fi
```

- [ ] **Step 2: Run the test and confirm the missing scripts fail**

Run: `bash backend/perf/query-analysis/tests/query_analysis_contract_test.sh`

Expected: non-zero exit because `reset.sh` and `seed.sh` are absent.

- [ ] **Step 3: Implement reset, seed, and verification with fixed experiment identifiers**

`reset.sh` must run `qa_assert_target`, then only `qa_compose down --volumes`, `qa_compose up -d`, and `qa_wait_for_mysql`. It must never issue `DROP DATABASE` or call any Compose file outside its own directory.

`seed.sh` must map exactly `small -> 1000` and `medium -> 10000`, invoke `qa_mysql --init-command="SET @target_rows = <mapped value>" < sql/seed.sql`, and then call `verify.sh`.

`seed.sql` must use a cross-joined digits CTE to generate `@target_rows` rows without changing MySQL recursion limits. It must insert:

```sql
INSERT INTO notification (created_at, is_read, reference_id, type, receiver_member_id, sender_member_id)
SELECT TIMESTAMP('2026-01-01 00:00:00') + INTERVAL n SECOND,
       MOD(n, 5) <> 0, n, 'NEW_DM', 1, 2
FROM generated_numbers;
```

Repeat the same generated range for receiver `2`; generate target and other `dm_message` rows with `room_id` `1` and `2`; and generate target and other `chat_message` rows with `room_id` `1` and `2`. Seed the referenced `member`, `dm_room`, and `chat_room` records before child rows. Use `n / 10` seconds for message timestamps so duplicate timestamps exist while `id` remains a deterministic secondary ordering candidate.

`verify.sh` must assert these exact conditions with SQL: target and other counts equal the selected scale for all three data domains; target unread notification count equals `target_rows / 5`; `SHOW INDEX FROM chat_message` includes `idx_chat_room_messageid_desc`; and `SELECT COUNT(*) FROM flyway_schema_history` is not used because migrations are executed by MySQL init scripts rather than Flyway.

- [ ] **Step 4: Run Small and Medium data verification**

Run: `bash backend/perf/query-analysis/scripts/reset.sh && bash backend/perf/query-analysis/scripts/seed.sh small && bash backend/perf/query-analysis/scripts/reset.sh && bash backend/perf/query-analysis/scripts/seed.sh medium`

Expected: both scales exit 0; Small reports 1,000 target and 1,000 other rows per domain, Medium reports 10,000 each, and target unread counts are 200 and 2,000.

### Task 3: Query-Plan Capture

**Files:**
- Create: `backend/perf/query-analysis/sql/analyze.sql`
- Create: `backend/perf/query-analysis/scripts/analyze.sh`
- Modify: `backend/perf/query-analysis/tests/query_analysis_contract_test.sh`
- Create: `backend/perf/query-analysis/results/.gitkeep`

**Interfaces:**
- Consumes: seeded IDs and `qa_mysql` from Tasks 1–2.
- Produces: `results/<scale>-run-1.txt` and `results/<scale>-run-2.txt`, each containing labeled raw MySQL `EXPLAIN ANALYZE` output.

- [ ] **Step 1: Add a failing output contract test**

```bash
"$ROOT/scripts/analyze.sh" small
test -s "$ROOT/results/small-run-1.txt"
test -s "$ROOT/results/small-run-2.txt"
rg -q '^## notification-all-select$' "$ROOT/results/small-run-1.txt"
rg -q '^## dm-history-count$' "$ROOT/results/small-run-1.txt"
rg -q '^## chat-history-deep-cursor$' "$ROOT/results/small-run-1.txt"
```

- [ ] **Step 2: Run the test and confirm it fails because analysis files are absent**

Run: `bash backend/perf/query-analysis/tests/query_analysis_contract_test.sh`

Expected: non-zero exit because `analyze.sh` is absent.

- [ ] **Step 3: Implement the labeled SQL workload and capture script**

`analyze.sql` must include these labeled statements, using page size 20 and offset 0:

```sql
-- notification-all-select
EXPLAIN ANALYZE SELECT n.* FROM notification n
WHERE n.receiver_member_id = 1 LIMIT 20 OFFSET 0;

-- notification-all-count
EXPLAIN ANALYZE SELECT COUNT(*) FROM notification n
WHERE n.receiver_member_id = 1;

-- notification-unread-select
EXPLAIN ANALYZE SELECT n.* FROM notification n
WHERE n.receiver_member_id = 1 AND n.is_read = FALSE LIMIT 20 OFFSET 0;

-- notification-unread-count
EXPLAIN ANALYZE SELECT COUNT(*) FROM notification n
WHERE n.receiver_member_id = 1 AND n.is_read = FALSE;

-- dm-history-select
EXPLAIN ANALYZE SELECT m.room_id, m.sender_id, m.content, member.nickname, m.type, m.id, m.sent_at
FROM dm_message m JOIN member ON member.member_id = m.sender_id
WHERE m.room_id = 1 ORDER BY m.sent_at DESC LIMIT 20 OFFSET 0;

-- dm-history-count
EXPLAIN ANALYZE SELECT COUNT(*) FROM dm_message m WHERE m.room_id = 1;

-- chat-history-first-page
EXPLAIN ANALYZE SELECT m.* FROM chat_message m
WHERE m.room_id = 1 ORDER BY m.message_id DESC LIMIT 20 OFFSET 0;

-- chat-history-deep-cursor
EXPLAIN ANALYZE SELECT m.* FROM chat_message m
WHERE m.room_id = 1 AND m.message_id < 9000 ORDER BY m.message_id DESC LIMIT 20;
```

`analyze.sh` must accept only `small|medium`, require a successful `verify.sh`, delete only `results/<scale>-run-1.txt` and `results/<scale>-run-2.txt`, run the SQL once as warm-up without saving it, then save two complete labeled runs. It must fail if any required label is missing.

- [ ] **Step 4: Capture plans for both scales and verify raw output files**

Run: `bash backend/perf/query-analysis/scripts/analyze.sh small && bash backend/perf/query-analysis/scripts/reset.sh && bash backend/perf/query-analysis/scripts/seed.sh medium && bash backend/perf/query-analysis/scripts/analyze.sh medium`

Expected: four non-empty result files; every file includes all eight labels and MySQL `EXPLAIN ANALYZE` output.

### Task 4: Analysis Guide and Result Record

**Files:**
- Create: `backend/perf/query-analysis/README.md`
- Create: `backend/perf/query-analysis/results/summary.md`
- Modify: `.gitignore`
- Modify: `backend/perf/query-analysis/tests/query_analysis_contract_test.sh`

**Interfaces:**
- Consumes: raw output filenames from Task 3 and repository definitions in `NotificationRepository.java`, `DmMessageRepository.java`, and `ChatMessageRepository.java`.
- Produces: a repeatable operator guide and a checked-in template for the selection decision; raw `.txt` outputs remain untracked.

- [ ] **Step 1: Add a failing documentation contract test**

```bash
rg -q 'scripts/reset.sh' "$ROOT/README.md"
rg -q 'scripts/seed.sh small' "$ROOT/README.md"
rg -q 'actual rows' "$ROOT/README.md"
rg -q '선택: 없음|알림 전체|읽지 않은 알림|DM' "$ROOT/results/summary.md"
git check-ignore -q "$ROOT/results/small-run-1.txt"
! git check-ignore -q "$ROOT/results/summary.md"
```

- [ ] **Step 2: Run the test and confirm documentation and ignore rules are missing**

Run: `bash backend/perf/query-analysis/tests/query_analysis_contract_test.sh`

Expected: non-zero exit because the guide, summary template, and ignore entries are absent.

- [ ] **Step 3: Write the operator guide and selection template**

The README must provide these exact commands:

```bash
cd backend/perf/query-analysis
cp .env.example .env
./scripts/reset.sh
./scripts/seed.sh small
./scripts/analyze.sh small
./scripts/reset.sh
./scripts/seed.sh medium
./scripts/analyze.sh medium
```

Explain that `EXPLAIN ANALYZE` is a same-machine relative comparison, not an operating-production latency claim. For each query, record selected index, actual rows, loops, sort or temporary-table evidence, and elapsed time from both saved runs. The summary template must have one row for each of: notification all select/count, notification unread select/count, DM select/count, chat first page/deep cursor; it must separately state that chat is a comparison baseline; and it must finish with one of `선택: 없음`, `선택: 알림 전체`, `선택: 읽지 않은 알림`, or `선택: DM` plus evidence against the five selection criteria.

Add only these ignore rules:

```gitignore
backend/perf/query-analysis/.env
backend/perf/query-analysis/results/*.txt
```

- [ ] **Step 4: Run the complete first-phase workflow and contracts**

Run: `bash backend/perf/query-analysis/tests/query_analysis_contract_test.sh`

Expected: exit 0; the guide provides reproducible commands, generated raw output is ignored, and the decision template is tracked.

## Final Verification

- [ ] Run `git diff --check` and confirm no whitespace errors.
- [ ] Run `bash backend/perf/query-analysis/tests/query_analysis_contract_test.sh` after a clean reset and both scale analyses.
- [ ] Inspect `results/small-run-1.txt`, `results/small-run-2.txt`, `results/medium-run-1.txt`, and `results/medium-run-2.txt` for all eight labels.
- [ ] Fill `results/summary.md` with observed, not inferred, plan evidence and select at most one owned route for a later deep-analysis task.
- [ ] Do not stage, commit, or push unless the user explicitly asks.
