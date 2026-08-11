# Query-plan analysis

이 디렉터리는 DevChat 조회 경로의 SQL 실행 계획을 같은 로컬 MySQL 8.4 조건에서 재현한다. 운영·홈서버·공용 개발 DB에는 연결하지 않으며, Compose 프로젝트 `devchat-query-analysis`와 DB `devchat_query_analysis`만 사용한다.

## 실행

```bash
cd backend/perf/query-analysis
cp .env.example .env
./scripts/reset.sh
./scripts/seed.sh small
./scripts/analyze.sh small
./scripts/reset.sh
./scripts/seed.sh medium
./scripts/analyze.sh medium
./scripts/reset.sh
./scripts/seed.sh high
./scripts/compare_dm.sh high
./scripts/analyze.sh high
./scripts/measure_write_cost.sh high
```

`reset.sh`는 Compose 설정의 컨테이너 이름을 확인하고, 이미 실행 중인 경우에는 연결된 DB 이름도 확인한 뒤에만 전용 볼륨을 초기화한다. 측정용 MySQL은 `127.0.0.1`에만 `MYSQL_HOST_PORT`를 열며 기본값은 `3307`이다. `seed.sh`, `verify.sh`, `analyze.sh`는 `small`, `medium`, `high`를 받는다. 인덱스를 임시 제거하는 스크립트는 종료 중 오류가 발생해도 trap으로 복구한다.

## 실행 흐름

```text
reset.sh → seed.sh → verify.sh → analyze.sh
                              └→ compare_dm.sh → analyze.sh
```

- 일반 실행 계획을 수집할 때는 `reset → seed → analyze` 순서로 실행한다. `seed.sh`와 `analyze.sh`가 내부에서 `verify.sh`를 호출하므로 보통 `verify.sh`를 따로 실행할 필요는 없다.
- DM 개선 전·후를 비교할 때는 `reset → seed → compare_dm` 순서로 실행한다.
- `seed.sh`는 기존 데이터를 삭제하지 않는다. 같은 DB에 다시 실행하면 고정 ID가 중복되어 실패하므로, 데이터 규모를 바꾸거나 다시 생성할 때는 먼저 `reset.sh`를 실행한다.

| 규모 | 대상 행 수 | 사용 목적 |
|---|---:|---|
| `small` | 도메인별 대상 1,000건 + 비교 대상 1,000건 | 쿼리와 데이터 분포 확인 |
| `medium` | 도메인별 대상 10,000건 + 비교 대상 10,000건 | 데이터 증가에 따른 실행 계획 비교 |
| `high` | 도메인별 대상 100,000건 + 비교 대상 100,000건 | 선택한 병목의 개선 전·후 심화 측정 |

## 스크립트 설명

### `scripts/lib.sh`

다른 스크립트가 공통으로 사용하는 Compose와 MySQL 함수 모음이다. 직접 실행하지 않고 `source`로 불러온다.

- `.env`가 있으면 해당 파일을 사용하고, 없으면 로컬 실험용 기본값인 `.env.example`을 사용한다.
- Compose 프로젝트는 `devchat-query-analysis`, 컨테이너는 `devchat-query-analysis-mysql`, DB는 `devchat_query_analysis`로 고정한다.
- `qa_assert_config`는 Compose 설정의 컨테이너 이름을 확인한다.
- `qa_assert_target`은 설정뿐 아니라 현재 연결된 DB 이름도 확인한다.
- `qa_mysql`은 대상 검증 후 SQL을 실행하는 공개용 함수다.
- `qa_mysql_unsafe`는 중복 검증을 피해야 하는 내부 단계에서만 사용한다. 사용자가 실행하는 공개 스크립트는 외부 DB 주소나 DB 이름을 인자로 받지 않는다.
- `qa_wait_for_mysql`은 DB가 준비될 때까지 2초 간격으로 최대 30회 확인한다.

### `scripts/reset.sh`

실험용 MySQL과 전용 볼륨을 초기화하고 빈 DB에 V1부터 V5까지의 마이그레이션을 다시 적용한다.

```bash
./scripts/reset.sh
```

- 인자를 받지 않는다. 인자가 있으면 실행을 거부한다.
- 실행 중인 컨테이너가 있으면 DB 이름이 `devchat_query_analysis`인지 먼저 확인한다.
- `docker compose down --volumes`로 **실험용 볼륨의 데이터를 모두 삭제**한 뒤 컨테이너를 다시 생성한다.
- MySQL 준비 완료와 연결된 DB 이름까지 확인한 뒤 성공한다.
- 운영 Compose, 홈서버 DB 또는 프로젝트의 일반 로컬 DB는 대상으로 삼지 않는다.

### `scripts/seed.sh`

선택한 규모에 맞춰 알림, DM, 단체채팅 데이터를 생성한 뒤 행 수와 인덱스를 검증한다.

```bash
./scripts/seed.sh small
./scripts/seed.sh medium
./scripts/seed.sh high
```

- `small`, `medium`, `high` 중 하나만 받는다.
- 대상과 비교 대상에 같은 수의 행을 생성해 `room_id` 또는 수신자 인덱스의 선택도를 확인할 수 있게 한다.
- 대상 알림은 unread 비율을 20%로 고정한다.
- DM과 단체채팅 시간은 10개 행마다 같도록 생성해 동일한 시간 값이 있는 정렬 조건을 재현한다.
- 데이터 생성이 끝나면 같은 규모의 `verify.sh`를 자동 실행한다.
- 데이터 삭제나 upsert를 하지 않으므로 초기화되지 않은 DB에 재실행하면 중복 키로 실패한다.

### `scripts/verify.sh`

현재 DB가 요청한 데이터 규모와 스키마 조건을 만족하는지 읽기 전용 SQL로 확인한다.

```bash
./scripts/verify.sh medium
```

다음 조건이 하나라도 맞지 않으면 즉시 실패한다.

- 대상과 비교 대상의 알림, DM, 단체채팅 행 수가 선택한 규모와 일치하는가
- 대상 수신자의 unread 알림이 전체의 20%인가
- 단체채팅 기준선 인덱스 `idx_chat_room_messageid_desc`가 존재하는가
- V5의 DM 인덱스 `idx_dm_message_room_sent_at_id_desc`가 존재하는가
- V5의 알림 인덱스 `idx_notification_receiver_is_read`가 존재하는가

이 스크립트는 데이터를 추가·수정·삭제하지 않는다. 데이터 생성 후 검증하거나 측정 전 현재 상태를 확인할 때 사용할 수 있다.

### `scripts/analyze.sh`

현재 스키마, 즉 V5 인덱스와 개선된 DM 조회 구조를 기준으로 네 조회 경로의 `EXPLAIN ANALYZE`를 수집한다.

```bash
./scripts/analyze.sh high
```

실행 순서는 다음과 같다.

1. 같은 규모의 `verify.sh`를 실행한다.
2. 대상 DM 방에서 `sent_at DESC, id DESC` 기준 실제 최신 메시지 ID 20개를 조회한다.
3. 조회한 ID를 `sql/analyze.sql`의 `__DM_MESSAGE_IDS__` 자리에 넣어 실제 두 번째 sender fetch 쿼리를 구성한다.
4. 전체 분석 SQL을 한 번 실행해 워밍업하되 결과는 저장하지 않는다.
5. DM 대상 행의 90% 위치 바로 앞 복합 커서를 구해 `OFFSET 0`, 깊은 OFFSET, 동일 위치 커서를 비교한다.
6. 같은 분석을 두 번 실행해 `results/<scale>-run-1.txt`, `results/<scale>-run-2.txt`에 저장한다.
7. 두 결과 파일에 필수 SQL label 11개가 모두 있는지 확인한다.

같은 규모로 다시 실행하면 해당 규모의 `run-1`, `run-2` 파일만 덮어쓴다. 다른 규모의 결과나 `summary.md`는 삭제하지 않는다.

### `scripts/compare_dm.sh`

같은 데이터셋에서 DM 개선 인덱스 적용 전·후 실행 계획을 비교한다.

```bash
./scripts/compare_dm.sh high
```

실행 순서는 다음과 같다.

1. `verify.sh`로 데이터 규모와 V5 인덱스 존재 여부를 확인한다.
2. 격리된 실험 DB에서 `idx_dm_message_room_sent_at_id_desc`만 임시 제거한다.
3. 기존 조인·정렬 쿼리를 한 번 워밍업한다.
4. 기존 쿼리 계획을 두 번 수집해 `results/<scale>-dm-before-run-1.txt`, `results/<scale>-dm-before-run-2.txt`에 저장한다.
5. DM 인덱스를 원래 정의대로 복구한다.
6. `analyze.sh`를 호출해 개선 후 ID Page, sender fetch, count 계획을 다시 수집한다.

일반 오류나 인터럽트가 발생하면 shell `trap`이 인덱스 복구를 시도한다. 다만 프로세스 강제 종료(`SIGKILL`), Docker 비정상 종료 또는 장비 전원 종료에서는 trap이 실행되지 않을 수 있다. 다음 실행에서 `verify.sh`가 인덱스 누락을 감지하며, 이 경우 `reset.sh`로 V5까지 다시 적용할 수 있다.

### `scripts/measure_dm_api.js`

k6로 인증, Controller, JPA 조회, DTO 변환, JSON 직렬화를 포함한 DM API 왕복 시간을 A와 C에서 비교한다. A는 쿼리 최적화 전 커밋 `2af8f64`, C는 복합 커서 구현이 반영된 현재 작업 트리다. 부모 B의 API는 다시 측정하지 않는다. B에서 C로 바뀐 커서 자체의 효과는 아래 API 수치가 아니라 동일 High DB의 `OFFSET 90000`과 복합 커서 `EXPLAIN ANALYZE`로 분리한다.

백엔드는 한 번에 하나만 `devchat_query_analysis`에 연결하고 `ddl-auto=none`으로 기동한다. A는 `git archive 2af8f64`로 임시 디렉터리에 추출해 현재 checkout이나 worktree를 바꾸지 않고 빌드한다. A 측정에서는 V5 이전 스키마를 재현하도록 두 V5 인덱스를 제거하고, C 측정 전에 원래 정의로 복구한다. 데이터, 포트, JWT 사용자, JVM, 페이지 크기는 같게 유지한다.

#### A→C 재현 절차

다음 명령은 `backend/perf/query-analysis`에서 실행한다. Docker 대상과 DB 이름은 기존 스크립트와 같은 전용 환경으로 고정한다.

```bash
./scripts/reset.sh
./scripts/seed.sh high

qa_mysql=(docker exec devchat-query-analysis-mysql mysql \
  -uquery_analysis -pquery_analysis_local_only \
  -Ddevchat_query_analysis --batch --raw --skip-column-names)

FIRST_IDS=$("${qa_mysql[@]}" -e "
  SELECT GROUP_CONCAT(id ORDER BY sent_at DESC, id DESC)
  FROM (SELECT id, sent_at FROM dm_message WHERE room_id = 1
        ORDER BY sent_at DESC, id DESC LIMIT 20) first_page;")
DEEP_IDS=$("${qa_mysql[@]}" -e "
  SELECT GROUP_CONCAT(id ORDER BY sent_at DESC, id DESC)
  FROM (SELECT id, sent_at FROM dm_message WHERE room_id = 1
        ORDER BY sent_at DESC, id DESC LIMIT 20 OFFSET 90000) deep_page;")
read -r CURSOR_SENT_AT CURSOR_ID <<< "$("${qa_mysql[@]}" -e "
  SELECT DATE_FORMAT(sent_at, '%Y-%m-%dT%H:%i:%s'), id
  FROM dm_message WHERE room_id = 1
  ORDER BY sent_at DESC, id DESC LIMIT 1 OFFSET 89999;")"
```

측정용 JWT는 기본 로컬 secret과 High seed의 member 1 정보로 메모리에만 만든다. 명령은 토큰을 출력하거나 파일에 저장하지 않는다.

```bash
jwt_secret=local-development-only-jwt-secret-change-me
jwt_header=$(printf '%s' '{"alg":"HS256","typ":"JWT"}' \
  | openssl base64 -A | tr '+/' '-_' | tr -d '=')
jwt_now=$(date +%s)
jwt_exp=$((jwt_now + 3600))
jwt_payload=$(printf \
  '{"iat":%s,"exp":%s,"username":"target","id":"1","nickname":"target","profileImg":"default.png"}' \
  "$jwt_now" "$jwt_exp" | openssl base64 -A | tr '+/' '-_' | tr -d '=')
jwt_unsigned="$jwt_header.$jwt_payload"
jwt_signature=$(printf '%s' "$jwt_unsigned" \
  | openssl dgst -sha256 -hmac "$jwt_secret" -binary \
  | openssl base64 -A | tr '+/' '-_' | tr -d '=')
ACCESS_TOKEN="$jwt_unsigned.$jwt_signature"
```

A는 현재 checkout을 바꾸지 않고 임시 디렉터리에서 빌드한다. V5 이전 스키마 상태를 만든 뒤 같은 터미널에서 서버를 백그라운드로 기동한다.

```bash
A_DIR=$(mktemp -d /tmp/devchat-api-before.XXXXXX)
git -C ../../.. archive 2af8f64 | tar -x -C "$A_DIR"
(cd "$A_DIR/backend" && ./gradlew bootJar)

"${qa_mysql[@]}" -e "
  ALTER TABLE dm_message DROP INDEX idx_dm_message_room_sent_at_id_desc;
  ALTER TABLE notification DROP INDEX idx_notification_receiver_is_read;"

DB_URL='jdbc:mysql://127.0.0.1:3307/devchat_query_analysis?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Seoul' \
DB_USERNAME=query_analysis DB_PASSWORD=query_analysis_local_only \
SPRING_JPA_HIBERNATE_DDL_AUTO=none \
SPRING_JPA_PROPERTIES_HIBERNATE_SHOW_SQL=false \
ENCRYPT_SECRET=local-query-analysis-encryption-key \
OAUTH_GITHUB_CLIENT_ID=query-analysis-dummy \
OAUTH_GITHUB_SECRET=query-analysis-dummy \
java -jar "$A_DIR/backend/build/libs/backend-0.0.1-SNAPSHOT.jar" \
  --server.port=18080 --spring.task.scheduling.enabled=false \
  > /tmp/devchat-api-a.log 2>&1 &
API_PID=$!
until curl --silent --fail http://127.0.0.1:18080/actuator/health >/dev/null; do sleep 1; done
```

A 측정은 동일 조건에서 두 번 실행한다. 완료 후 A를 종료하고 V5 인덱스를 복구한다.

```bash
MODE=before \
BASE_URL=http://127.0.0.1:18080 \
AUTH_COOKIE="accessToken=$ACCESS_TOKEN" \
ROOM_ID=1 \
EXPECTED_FIRST_IDS="$FIRST_IDS" \
EXPECTED_DEEP_IDS="$DEEP_IDS" \
k6 run --summary-export results/high-api-a-run-1.json scripts/measure_dm_api.js
MODE=before \
BASE_URL=http://127.0.0.1:18080 \
AUTH_COOKIE="accessToken=$ACCESS_TOKEN" \
ROOM_ID=1 \
EXPECTED_FIRST_IDS="$FIRST_IDS" \
EXPECTED_DEEP_IDS="$DEEP_IDS" \
k6 run --summary-export results/high-api-a-run-2.json scripts/measure_dm_api.js
kill "$API_PID"
wait "$API_PID" 2>/dev/null || true

"${qa_mysql[@]}" -e "
  ALTER TABLE dm_message
    ADD INDEX idx_dm_message_room_sent_at_id_desc (room_id, sent_at DESC, id DESC);
  ALTER TABLE notification
    ADD INDEX idx_notification_receiver_is_read (receiver_member_id, is_read);"

(cd ../.. && ./gradlew bootJar)
DB_URL='jdbc:mysql://127.0.0.1:3307/devchat_query_analysis?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Seoul' \
DB_USERNAME=query_analysis DB_PASSWORD=query_analysis_local_only \
SPRING_JPA_HIBERNATE_DDL_AUTO=none \
SPRING_JPA_PROPERTIES_HIBERNATE_SHOW_SQL=false \
ENCRYPT_SECRET=local-query-analysis-encryption-key \
OAUTH_GITHUB_CLIENT_ID=query-analysis-dummy \
OAUTH_GITHUB_SECRET=query-analysis-dummy \
java -jar ../../build/libs/backend-0.0.1-SNAPSHOT.jar \
  --server.port=18080 --spring.task.scheduling.enabled=false \
  > /tmp/devchat-api-c.log 2>&1 &
API_PID=$!
until curl --silent --fail http://127.0.0.1:18080/actuator/health >/dev/null; do sleep 1; done

MODE=after \
BASE_URL=http://127.0.0.1:18080 \
AUTH_COOKIE="accessToken=$ACCESS_TOKEN" \
ROOM_ID=1 \
DEEP_CURSOR_SENT_AT="$CURSOR_SENT_AT" \
DEEP_CURSOR_ID="$CURSOR_ID" \
EXPECTED_FIRST_IDS="$FIRST_IDS" \
EXPECTED_DEEP_IDS="$DEEP_IDS" \
k6 run --summary-export results/high-api-c-run-1.json scripts/measure_dm_api.js
MODE=after \
BASE_URL=http://127.0.0.1:18080 \
AUTH_COOKIE="accessToken=$ACCESS_TOKEN" \
ROOM_ID=1 \
DEEP_CURSOR_SENT_AT="$CURSOR_SENT_AT" \
DEEP_CURSOR_ID="$CURSOR_ID" \
EXPECTED_FIRST_IDS="$FIRST_IDS" \
EXPECTED_DEEP_IDS="$DEEP_IDS" \
k6 run --summary-export results/high-api-c-run-2.json scripts/measure_dm_api.js

kill "$API_PID"
wait "$API_PID" 2>/dev/null || true
./scripts/verify.sh high
case "$A_DIR" in
  /tmp/devchat-api-before.*) rm -rf -- "$A_DIR" ;;
  *) printf '임시 디렉터리 경로를 확인하세요: %s\n' "$A_DIR" >&2 ;;
esac
```

A와 C의 k6 명령은 각각 `run-1`, `run-2`로 두 번 실행한다. 중간에 실패하거나 인터럽트했다면 서버를 종료한 뒤 두 V5 인덱스가 존재하는지 `./scripts/verify.sh high`로 확인하고, 누락 시 위 `ADD INDEX` 문으로 복구한다.

- A의 첫 페이지는 `page=0&size=20`, 깊은 페이지는 `page=4500&size=20`, 즉 `OFFSET 90000`이다.
- C의 첫 페이지는 `size=20`, 깊은 페이지는 OFFSET 90000 바로 앞 행의 `(sentAt, messageId)`를 전달한다.
- 한 번의 실행은 setup에서 각 경로를 한 번 워밍업한 뒤, 1 VU가 첫 페이지와 깊은 페이지를 각각 50회 순차 호출한다. 같은 실행을 버전별로 두 번 저장한다.
- `EXPECTED_FIRST_IDS`와 `EXPECTED_DEEP_IDS`는 같은 DB에서 구한 20개 ID의 쉼표 구분 목록이다. A는 동일 `sentAt` 내부 순서가 결정적이지 않으므로 순서가 아닌 ID 집합을 비교하고, C는 `hasNext`와 `nextCursor`도 검증한다.
- `dm_history_first_duration`과 `dm_history_deep_duration`만 워밍업을 제외한 p50, p95, 평균, 최솟값, 최댓값에 사용한다. `dm_history_failed`와 `dm_history_contract_failed`는 각각 HTTP 오류와 응답 계약 오류를 기록한다.
- A→C API 비교는 쿼리 구조, V5 인덱스, count 제거, 커서 전환이 합쳐진 최종 사용자 관점의 변화다. 이 값으로 커서 전환 단독 개선율을 주장하지 않는다.
- 깊은 비교는 사용자가 앞 페이지를 읽어 해당 커서를 이미 가진 상황의 다음 20건 조회다. 임의 페이지 점프 비용을 비교하지 않는다.
- 1 VU의 짧은 순차 실험이므로 동시 처리량, 장시간 안정성 또는 운영 SLO로 해석하지 않는다.

### `scripts/measure_write_cost.sh`

V5 DM·알림 인덱스가 1,000건 배치 insert에 주는 비용을 격리 DB에서 비교한다.

```bash
./scripts/measure_write_cost.sh high
```

1. 두 V5 인덱스를 제거하고 DM·알림 insert를 각각 한 번 워밍업한다.
2. 인덱스 없는 insert 시간을 각각 두 번 기록한다.
3. 인덱스를 복구하고 같은 워밍업과 저장 실행을 반복한다.
4. 행을 원복한 뒤 `information_schema.tables.index_length`로 테이블 전체 인덱스 할당량을 기록한다.
5. 마지막 `verify.sh`로 행 수와 인덱스 존재를 재검증한다.

결과는 `results/<scale>-write-cost.txt`에 저장되며 Git에서 제외된다. `index_length`는 개별 인덱스의 논리 크기가 아니라 InnoDB가 테이블 인덱스 전체에 할당한 근사 바이트다. 제거 전·후에 V5 인덱스 외 조건과 행 수를 같게 유지해 차이를 참고값으로 사용한다.

## SQL 파일과 결과

| 파일 | 설명 |
|---|---|
| `sql/seed.sql` | `@target_rows`를 받아 기준 Member와 방, 알림, DM, 단체채팅 데이터를 생성한다. |
| `sql/analyze.sql` | 개선 후 알림, DM, 단체채팅 조회의 select·count·sender fetch 실행 계획을 수집한다. |
| `sql/analyze-dm-before.sql` | V5 DM 인덱스를 제거한 상태에서 기존 조인·정렬 조회와 count 실행 계획을 수집한다. |
| `results/<scale>-run-1.txt`, `run-2.txt` | 개선 후 원본 실행 계획이다. 로컬 환경별 결과라 Git에서 무시한다. |
| `results/<scale>-dm-before-run-1.txt`, `run-2.txt` | DM 개선 전 원본 실행 계획이다. 로컬 환경별 결과라 Git에서 무시한다. |
| `results/<scale>-write-cost.txt` | DM·알림 V5 인덱스 전·후 1,000건 insert 시간과 전체 index length다. Git에서 무시한다. |
| `results/high-api-{a,c}-run-{1,2}.json` | A/C k6 원본 summary다. 로컬 환경별 결과라 Git에서 무시한다. |
| `results/summary.md` | 두 번의 실행에서 공통으로 관찰된 실행 계획과 측정 범위를 사람이 읽을 수 있게 정리한다. |

## 수집 대상

| SQL label | Repository 경로 | 확인할 내용 |
|---|---|---|
| notification all select/count | `NotificationRepository.getNotifications` | `receiver_member_id` 인덱스 범위와 Page count |
| notification unread select/count | `NotificationRepository.getNotReadNotification` | 읽음 여부 필터에 따른 검사 행 수 |
| DM history offset/cursor/fetch/count | `DmMessageRepository.findLatestMessageIdsByRoomId`, `findMessageIdsBeforeCursor`, `findAllWithSenderByIdIn` | 첫 페이지, 깊은 OFFSET, 동일 위치 복합 커서, sender fetch, 제거 전 count 기준선 |
| chat first page/deep cursor | `ChatMessageRepository` | 기존 `(room_id, message_id DESC)` 기준선 |

각 `analyze.sh` 실행은 준비 실행 1회와 저장 실행 2회를 수행한다. 원본은 `results/<scale>-run-1.txt`, `results/<scale>-run-2.txt`에 저장되며 로컬 환경별 값이므로 Git에서 무시한다.

## 해석 규칙

`EXPLAIN ANALYZE` 시간은 같은 로컬 장비에서 쿼리 구조와 데이터 규모 변화를 비교하는 값일 뿐, 운영 API 지연 시간 주장이 아니다. 각 SQL에 대해 사용 인덱스, actual rows, loops, sort 또는 temporary table 유무, 실행 시간을 두 저장 실행에서 함께 기록한다.

DM 커서 API는 `ID select + sender fetch` 두 쿼리만 실행한다. `dm-history-count`는 기존 `Page` 계약의 제거된 비용을 비교하기 위한 SQL 기준선이며 현재 API가 실행하는 쿼리가 아니다. API 왕복 시간은 SQL `EXPLAIN ANALYZE` 시간과 별도로 기록한다. A→C API 수치는 최종 통합 효과이고 B→C SQL 수치가 커서 전환의 쿼리 단계 효과라는 귀속 관계를 유지한다.

심화 대상은 본인이 구현한 알림 또는 DM 경로 중에서만 선택한다. 데이터 증가에 따라 검사 행·정렬 비용·실행 시간이 재현 가능하게 증가하고, 원인을 실행 계획으로 설명할 수 있으며, 조회 계약을 보존한 채 동일 조건 재측정이 가능한 경우에만 선택한다. 단체채팅은 기존 구현의 비교 기준선이다.
