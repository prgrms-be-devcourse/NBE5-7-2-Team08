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
