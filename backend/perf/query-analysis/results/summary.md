# 1차 실행 계획 비교

환경: Docker Desktop local MySQL 8.4, `devchat_query_analysis`, 페이지 크기 20, 대상 외 행 수는 대상 행 수와 동일하다. 각 값은 준비 실행 뒤 저장한 두 실행에서 관찰했다.

| 경로 | Small (1,000 대상 행) | Medium (10,000 대상 행) | 관찰 |
|---|---|---|---|
| 알림 전체 select | `receiver_member_id` index, 20행 반환, 약 0.05ms | 같은 index, 20행 반환, 약 0.37–0.41ms | 정렬 없이 제한 행만 반환 |
| 알림 전체 count | covering index 1,000행, 약 0.08–0.11ms | covering index 10,000행, 약 0.87–0.88ms | Page count가 대상 범위를 모두 검사 |
| 읽지 않은 알림 select | receiver index 100행 검사 후 20행, 약 0.04ms | 같은 100행 검사 후 20행, 약 0.35ms | 20% unread 분포에서 첫 페이지는 100행 검사 |
| 읽지 않은 알림 count | receiver index 1,000행 검사·200행 필터, 약 0.38–0.40ms | 10,000행 검사·2,000행 필터, 약 3.77–3.90ms | `is_read`가 인덱스에 없어 규모에 비례해 필터 범위 증가 |
| DM select | room index 1,000행 후 sort, 약 0.82–0.87ms | room index 10,000행 후 sort, 약 9.00–9.23ms | `sent_at DESC` sort가 전체 대상 방 행을 소비 |
| DM count | covering room index 1,000행, 약 0.09–0.10ms | covering room index 10,000행, 약 0.78ms | Page count가 대상 범위를 모두 검사 |
| 단체채팅 첫 페이지 | `(room_id, message_id DESC)` index, 20행, 약 0.01ms | 같은 index, 20행, 약 0.01ms | 비교 기준선; 기존 팀 구현 |
| 단체채팅 깊은 커서 | primary range scan, 20행, 약 0.01ms | primary range scan, 20행, 약 0.01ms | 비교 기준선; 운영 변경 대상 아님 |

## 심화 대상 선택

선택: DM

근거:

1. 기존 `DmMessageRepository.findMessagesByRoomId` 경로에서 재현됐다.
2. 대상 행이 1,000에서 10,000으로 늘 때 정렬 입력과 실제 처리 행이 1,000에서 10,000으로 증가했고, select 실행 시간도 약 0.8ms에서 약 9ms로 증가했다.
3. `room_id` 단일 인덱스 조회 뒤 `Sort: m.sent_at DESC`가 발생한다는 실행 계획으로 원인을 설명할 수 있다.
4. `(room_id, sent_at, id)` 계열 인덱스와 결정적 정렬을 별도 마이그레이션으로 적용한 뒤 같은 스크립트로 재측정할 수 있다.
5. 후속 단계에서 동점 `sent_at` 경계 테스트를 먼저 추가한 뒤 기존 DM endpoint를 복합 커서 계약으로 전환했다.

읽지 않은 알림 count도 대상 범위를 전부 필터링하는 현상이 관측됐지만, 이번 심화 분석에서는 정렬 비용이 더 명확하게 증가한 DM 하나만 다룬다.

## 적용 후 검증

### DM 이력

- V5에 `(room_id, sent_at DESC, id DESC)` 인덱스를 추가하고, 조회를 **ID Page 조회 + 해당 20건 sender fetch 조회**로 분리했다.
- `compare_dm.sh high`로 같은 High 데이터셋과 워밍업 조건에서 개선 인덱스를 제거·복구하며 전후를 각각 두 번 측정했다.
- 기존 데이터 조회는 100,000행 조인과 정렬을 수행해 79.2–82.4ms였다. 개선 후 데이터 조회는 ID Page 0.131–0.138ms와 실제 최신 ID 20건의 sender fetch 0.031–0.032ms로 분리됐다.
- `Page` count는 기존 6.77–6.83ms, 개선 후 7.46–7.53ms로 남아 있다. 따라서 개선 후 전체 Page DB 작업을 0.17ms라고 표현하지 않고, **데이터 조회 비용만** 약 0.16–0.17ms라고 구분한다.
- `DmMessageRepositoryIntegrationTest`는 MySQL 8.4에서 결정적 정렬, 전체 개수, 페이지 경계 중복·누락 방지, sender fetch를 검증한다. `DmMessageServiceTest`는 두 번째 조회 결과의 순서와 무관하게 ID Page 순서로 응답을 재조립하는 것을 검증한다.

### 알림

- V5에 `(receiver_member_id, is_read)` 인덱스를 추가했다. Medium unread count는 수신자 10,000건 전체 필터링 약 3.8ms에서 unread 2,000건 covering index 조회 약 0.19ms로 바뀌었다.
- `NotificationRepository`의 두 목록 조회에 `sender`, `receiver` EntityGraph를 적용했다.
- 서로 다른 sender 20명을 가진 알림 페이지에서 목록과 count를 모두 포함하면 fetch 없는 DTO 변환은 23개 SQL, EntityGraph 경로는 2개 SQL임을 `NotificationRepositoryQueryCountIntegrationTest`가 검증한다.

## DM 복합 커서 전환 검증

환경: Docker Desktop local MySQL 8.4.9, High 대상 방 100,000건, 페이지 크기 20. `sent_at`은 10개 메시지마다 같으며, 워밍업 1회 뒤 저장 실행 2회를 비교했다.

| 조회 | 실행 1 | 실행 2 | actual rows / 계획 |
|---|---:|---:|---|
| `OFFSET 0` | 0.131–0.132ms | 0.136–0.138ms | V5 covering index에서 20행 |
| `OFFSET 90000` | 7.51ms | 8.14ms | 같은 index에서 90,020행을 소비 |
| 동일 위치 복합 커서 | 0.0767–0.0794ms | 0.0783–0.0814ms | V5 covering range scan에서 20행 |
| 기존 Page count 기준선 | 7.27ms | 7.82ms | room index에서 100,000행 집계 |

- 커서는 OFFSET 90000이 반환하는 첫 행과 같은 위치가 되도록 직전 메시지 `(2026-01-01 00:16:40, 14711)`를 사용했다.
- 커서 조회는 정렬이나 temporary table 없이 `(room_id, sent_at DESC, id DESC)`를 range scan했다.
- 현재 Repository는 `List<Long>`의 `size+1` 조회와 sender fetch만 사용하므로 위 count SQL을 실행하지 않는다.
- MySQL 통합 테스트는 동일 `sent_at` 경계와 첫 페이지 뒤 최신 메시지 삽입 상황에서 중복·누락이 없음을 검증한다. Hibernate statistics로 한 페이지가 ID와 sender의 2개 쿼리만 실행되는 것도 확인한다.

## A→C API 비교

동일 High DB와 인증 사용자, 방, Java 23.0.2, 로컬 dev 프로필, `size=20`에서 k6 1 VU로 측정했다. A는 쿼리 최적화 전 `2af8f64`와 V5 이전 인덱스 상태이고, C는 현재 복합 커서 구현과 V5 인덱스 상태다. 각 실행은 첫 페이지와 깊은 위치를 한 번씩 워밍업한 뒤 두 경로를 각각 50회 순차 호출했으며, 버전별로 두 번 저장했다.

| 버전·경로 | p50 | p95 | 평균 | 최솟값 | 최댓값 |
|---|---:|---:|---:|---:|---:|
| A 첫 페이지 | 83.257–84.055ms | 87.280–87.350ms | 83.158–84.149ms | 79.220–79.790ms | 88.042–89.215ms |
| C 첫 페이지 | 6.913–7.223ms | 9.075–9.753ms | 7.043–7.509ms | 4.588–5.555ms | 10.300–11.241ms |
| A `page=4500` | 92.416–94.432ms | 97.250–97.632ms | 92.850–94.381ms | 88.870–90.295ms | 98.206–99.221ms |
| C 동일 위치 커서 | 7.475–7.508ms | 9.793–9.917ms | 7.543–7.600ms | 4.806–5.997ms | 10.762–10.977ms |

- 첫 페이지는 A→C에서 p50 91.3–91.8%, p95 88.8–89.6% 감소했다.
- 깊은 위치는 A→C에서 p50 91.9–92.0%, p95 89.8–90.0% 감소했다.
- A와 C 모두 두 실행 합계 200개 측정 요청에서 HTTP 오류와 응답 계약 오류가 각각 0건이었다. setup의 버전별 워밍업 4건은 커스텀 지연 지표와 오류율에서 제외했다.
- 두 버전 모두 첫 페이지와 깊은 위치에서 DB로 계산한 동일한 20개 메시지 ID 집합을 반환했다. A는 동일 `sentAt` 내부 순서가 결정적이지 않아 집합을 비교했고, C는 `hasNext=true`와 `nextCursor`도 확인했다.

이 API 차이는 JWT 인증부터 JSON 직렬화까지 포함한 **A→C 전체 개선 효과**다. 쿼리 구조 분리, V5 인덱스, count 제거와 커서 전환의 효과가 합쳐져 있으므로 이를 커서 단독 API 개선율로 표현하지 않는다. 커서 전환 자체의 B→C 근거는 위 `OFFSET 90000` 90,020행·7.51–8.14ms와 동일 위치 커서 20행·0.0767–0.0814ms의 `EXPLAIN ANALYZE` 비교다.

깊은 커서 값은 OFFSET 90000 바로 앞 행에서 구했다. 이는 사용자가 이전 페이지를 읽어 커서를 이미 보유한 상태의 다음 20건 비용을 비교한 것이며, 임의의 4,500페이지로 직접 이동하는 기능을 제공하거나 그 이동 비용을 측정한 것은 아니다. 1 VU의 짧은 로컬 순차 실험이므로 동시 사용자 처리량, 장시간 안정성 또는 운영 SLO를 나타내지 않는다.

## V5 인덱스 쓰기 비용

High DB에서 V5 DM·알림 인덱스만 제거한 상태와 복구한 상태를 비교했다. 각 상태에서 DM과 알림 1,000건 batch insert를 한 번 워밍업하고 두 번 저장했으며, 매 실행 뒤 측정 행을 삭제했다.

| 대상 | V5 인덱스 없음 | V5 인덱스 있음 | 관찰 |
|---|---:|---:|---|
| DM 1,000건 insert | 5.900–7.124ms | 6.356–7.269ms | 대응 실행 기준 약 2.0–7.7% 증가 |
| 알림 1,000건 insert | 4.835–5.991ms | 4.829–5.370ms | 이번 2회 표본에서는 일관된 증가가 관찰되지 않음 |

`information_schema.tables.index_length`의 전체 할당량은 DM이 9,469,952B에서 16,285,696B로 6,815,744B 증가했고, 알림은 11,567,104B에서 17,350,656B로 5,783,552B 증가했다. 이는 개별 인덱스의 정밀 논리 크기가 아니라 InnoDB 할당 페이지 기반 근사치다.

읽기 측면에서 깊은 DM 조회는 90,020행 소비를 20행으로 줄이고 기존 100,000행 count를 요청 경로에서 제거했다. 짧은 쓰기 표본과 약 6.5MiB/5.5MiB의 로컬 인덱스 공간 증가는 이 읽기 개선에 비해 수용 가능한 범위로 판단하되, 실제 운영 쓰기 처리량은 별도 부하 조건에서 재검증해야 한다.
