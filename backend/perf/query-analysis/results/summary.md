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
5. 다음 단계에서는 동점 `sent_at`의 페이지 경계 정합성을 먼저 테스트하고, 현재 `Page` API 계약을 유지한 인덱스 개선부터 평가한다. 커서 전환은 프론트엔드 계약 변경이므로 이 단계에서 자동으로 포함하지 않는다.

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
