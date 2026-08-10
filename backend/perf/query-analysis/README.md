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
```

`reset.sh`는 Compose 설정의 컨테이너 이름을 확인하고, 이미 실행 중인 경우에는 연결된 DB 이름도 확인한 뒤에만 전용 볼륨을 초기화한다. `seed.sh`, `verify.sh`, `analyze.sh`는 `small`, `medium`, `high`를 받는다. `compare_dm.sh`는 현재 High 데이터셋에서 DM 개선 인덱스만 임시 제거해 개선 전 계획을 두 번 수집하고, 인덱스를 복구한 뒤 개선 후 계획을 다시 수집한다. 종료 중 오류가 발생해도 trap으로 인덱스를 복구한다.

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
5. 같은 분석을 두 번 실행해 `results/<scale>-run-1.txt`, `results/<scale>-run-2.txt`에 저장한다.
6. 두 결과 파일에 필수 SQL label 9개가 모두 있는지 확인한다.

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

## SQL 파일과 결과

| 파일 | 설명 |
|---|---|
| `sql/seed.sql` | `@target_rows`를 받아 기준 Member와 방, 알림, DM, 단체채팅 데이터를 생성한다. |
| `sql/analyze.sql` | 개선 후 알림, DM, 단체채팅 조회의 select·count·sender fetch 실행 계획을 수집한다. |
| `sql/analyze-dm-before.sql` | V5 DM 인덱스를 제거한 상태에서 기존 조인·정렬 조회와 count 실행 계획을 수집한다. |
| `results/<scale>-run-1.txt`, `run-2.txt` | 개선 후 원본 실행 계획이다. 로컬 환경별 결과라 Git에서 무시한다. |
| `results/<scale>-dm-before-run-1.txt`, `run-2.txt` | DM 개선 전 원본 실행 계획이다. 로컬 환경별 결과라 Git에서 무시한다. |
| `results/summary.md` | 두 번의 실행에서 공통으로 관찰된 실행 계획과 측정 범위를 사람이 읽을 수 있게 정리한다. |

## 수집 대상

| SQL label | Repository 경로 | 확인할 내용 |
|---|---|---|
| notification all select/count | `NotificationRepository.getNotifications` | `receiver_member_id` 인덱스 범위와 Page count |
| notification unread select/count | `NotificationRepository.getNotReadNotification` | 읽음 여부 필터에 따른 검사 행 수 |
| DM history ID select/sender fetch/count | `DmMessageRepository.findMessageIdsByRoomId`, `findAllWithSenderByIdIn` | 결정적 ID Page, 해당 20건 sender fetch, Page count |
| chat first page/deep cursor | `ChatMessageRepository` | 기존 `(room_id, message_id DESC)` 기준선 |

각 `analyze.sh` 실행은 준비 실행 1회와 저장 실행 2회를 수행한다. 원본은 `results/<scale>-run-1.txt`, `results/<scale>-run-2.txt`에 저장되며 로컬 환경별 값이므로 Git에서 무시한다.

## 해석 규칙

`EXPLAIN ANALYZE` 시간은 같은 로컬 장비에서 쿼리 구조와 데이터 규모 변화를 비교하는 값일 뿐, 운영 API 지연 시간 주장이 아니다. 각 SQL에 대해 사용 인덱스, actual rows, loops, sort 또는 temporary table 유무, 실행 시간을 두 저장 실행에서 함께 기록한다.

DM은 페이지 데이터를 가져오는 `ID select + sender fetch`와 전체 개수를 구하는 `count`를 별도로 기록한다. `Page` 요청 전체 시간을 주장할 때 count를 제외하지 않는다. 알림 SQL 수 역시 개선 전·후 모두 목록 조회와 count를 포함한 같은 범위로 비교한다.

심화 대상은 본인이 구현한 알림 또는 DM 경로 중에서만 선택한다. 데이터 증가에 따라 검사 행·정렬 비용·실행 시간이 재현 가능하게 증가하고, 원인을 실행 계획으로 설명할 수 있으며, 조회 계약을 보존한 채 동일 조건 재측정이 가능한 경우에만 선택한다. 단체채팅은 기존 구현의 비교 기준선이다.
