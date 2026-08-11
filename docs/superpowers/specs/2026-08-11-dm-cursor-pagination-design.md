# DM 복합 커서 페이지네이션 설계

## 목표

현재 DM 이력 조회는 복합 인덱스로 첫 페이지의 데이터 조회 비용을 줄였지만 `Page` 계약 때문에 전체 count 쿼리를 실행하고, 깊은 페이지에서는 `OFFSET`만큼 인덱스 항목을 건너뛰어야 한다. 프론트엔드는 DM 응답의 전체 개수나 페이지 번호를 사용하지 않고 위로 스크롤할 때 과거 메시지를 추가하는 방식이므로, 기존 `/dm/history/{roomId}`를 `(sentAt, messageId)` 복합 커서 기반 조회로 교체한다.

이 작업은 다음 결과까지 검증한다.

- count 쿼리 제거
- 깊은 이력 조회 비용 감소
- 동일한 `sentAt`을 가진 메시지의 결정적 순서 유지
- 실시간 메시지가 추가되는 동안 다음 이력 조회의 중복·누락 방지
- SQL 개선이 실제 API 응답에서도 유지되는지 확인
- 읽기 인덱스 추가에 따른 DM·알림 쓰기 비용 기록

## 현재 상태와 선택 근거

현재 백엔드는 `Page<Long>`으로 메시지 ID를 조회한 뒤 선택된 메시지와 sender를 가져온다. High 데이터셋 100,000건에서 데이터 조회는 약 0.16–0.17ms지만 count는 약 7.46–7.53ms로 남아 있다. 현재 측정은 첫 페이지 `OFFSET 0` 기준이라 깊은 오프셋 비용도 별도 확인이 필요하다.

프론트엔드는 다음 정보만 사용한다.

- `response.data.content`
- 반환 개수가 20개인지 여부
- 다음 과거 메시지를 요청하기 위한 자체 `currentPage`

`totalElements`, `totalPages` 등 `Page` 메타데이터는 사용하지 않는다. 따라서 기존 `Page` 계약을 유지하는 하위 호환 API보다 현재 endpoint 자체를 커서 계약으로 교체하는 편이 단순하며 실제 UI 요구와 일치한다.

## 검토한 대안

### 선택: 기존 endpoint를 복합 커서 방식으로 교체

`GET /dm/history/{roomId}`는 첫 요청에서 커서를 생략하고, 다음 요청부터 마지막으로 받은 `(sentAt, messageId)`를 전달한다. 기존 endpoint의 외부 계약은 변경되지만 저장소 안의 프론트도 함께 변경하며 전체 개수에 의존하는 소비자는 없다.

장점:

- 기존 count와 offset 경로를 완전히 제거할 수 있다.
- API가 실제 무한 스크롤 요구만 표현한다.
- 같은 기능을 제공하는 두 endpoint를 유지하지 않는다.

### 제외: 커서 endpoint를 별도로 추가

기존 `/history`와 `/history/cursor`를 병행하면 하위 호환은 가능하지만 현재 소비자가 사용하지 않는 count 경로가 계속 남는다. 같은 DM 이력 기능의 구현과 테스트가 두 벌이 되므로 제외한다.

### 제외: `Slice`만 적용

`Slice`는 count를 제거하지만 페이지 번호와 `OFFSET`은 유지한다. 깊은 페이지 비용과 실시간 삽입에 따른 경계 이동을 해결하지 못하므로 최종 대안으로 선택하지 않는다.

## API 계약

### 요청

첫 페이지:

```http
GET /dm/history/{roomId}?size=20
```

다음 페이지:

```http
GET /dm/history/{roomId}?cursorSentAt=2026-08-11T00:00:00&cursorId=1234&size=20
```

- `size` 기본값은 20이며 1 이상 100 이하여야 한다.
- `cursorSentAt`과 `cursorId`는 둘 다 없거나 둘 다 있어야 한다.
- 둘 중 하나만 전달되면 잘못된 요청으로 처리한다.
- 커서에 메시지 ID만 사용하지 않는다. 현재 정렬 계약이 `sentAt DESC, id DESC`이므로 두 값을 함께 사용해야 한다.

### 응답

```json
{
  "content": [],
  "nextCursor": {
    "sentAt": "2026-08-11T00:00:00",
    "messageId": 1234
  },
  "hasNext": true
}
```

- `content`는 최신 메시지부터 과거 메시지 순서다.
- `nextCursor`는 반환된 마지막 메시지의 `(sentAt, messageId)`다.
- 다음 페이지가 없으면 `nextCursor`는 `null`, `hasNext`는 `false`다.
- 전체 개수와 전체 페이지 수는 반환하지 않는다.

## 백엔드 조회 구조

첫 페이지는 현재 복합 인덱스 순서대로 `size + 1`개의 ID를 조회한다.

```sql
SELECT id
FROM dm_message
WHERE room_id = :roomId
ORDER BY sent_at DESC, id DESC
LIMIT :sizePlusOne;
```

다음 페이지는 복합 커서보다 오래된 메시지만 조회한다.

```sql
SELECT id
FROM dm_message
WHERE room_id = :roomId
  AND (
    sent_at < :cursorSentAt
    OR (sent_at = :cursorSentAt AND id < :cursorId)
  )
ORDER BY sent_at DESC, id DESC
LIMIT :sizePlusOne;
```

`size + 1`번째 ID가 존재하면 `hasNext=true`로 판단하고 응답 데이터에서는 제거한다. 남은 ID에 대해서만 기존 `findAllWithSenderByIdIn` 조회를 실행하고 ID 목록 순서로 응답을 재조립한다. ID가 없으면 sender fetch를 실행하지 않는다.

별도의 count 쿼리는 실행하지 않는다. V5의 `(room_id, sent_at DESC, id DESC)` 인덱스를 그대로 사용하며 새 마이그레이션은 추가하지 않는다.

## 프론트엔드 변경

`chat-modal.jsx`의 `currentPage` 상태를 `nextCursor`로 교체한다.

- 최초 요청은 `size=20`만 전달한다.
- 응답의 `nextCursor`와 `hasNext`를 상태에 저장한다.
- 상단 스크롤 시 저장된 `cursorSentAt`, `cursorId`를 다음 요청에 전달한다.
- 새 WebSocket 메시지가 목록 앞쪽에 추가돼도 과거 이력 커서는 바꾸지 않는다.
- HTTP와 WebSocket 응답의 시간 필드는 백엔드 DTO 이름인 `sendAt`으로 통일한다. 현재 프론트의 `createdAt` 참조는 함께 수정한다.
- 기존 message ID 중복 제거는 네트워크 중복 응답에 대한 방어로 유지하되, 페이지 정합성을 대신하는 수단으로 간주하지 않는다.

## 검증 범위

테스트 수를 늘리는 대신 커서 전환의 핵심 위험만 검증한다.

### 자동 테스트

1. 동일한 `sentAt`이 있는 데이터에서 첫 페이지와 다음 페이지가 `sentAt DESC, id DESC` 순서를 유지하고 중복·누락이 없다.
2. 첫 페이지 조회 후 더 최신 메시지가 추가돼도 기존 커서의 다음 페이지 결과가 변하지 않는다.
3. `size + 1` 결과로 `hasNext`와 `nextCursor`를 계산하며 마지막 페이지에서는 둘이 각각 `false`, `null`이다.
4. DM 이력 한 페이지는 ID 조회와 sender fetch만 실행하고 count SQL은 실행하지 않는다.
5. 백엔드 전체 테스트와 프론트 빌드를 마지막에 한 번 실행한다.

Controller의 모든 파라미터 조합이나 브라우저 E2E, 여러 페이지 크기의 반복 테스트는 추가하지 않는다.

### SQL 측정

High 100,000건에서 워밍업 1회 후 각 쿼리를 두 번 저장한다.

- 현재 인덱스 기반 `OFFSET 0`
- 현재 인덱스 기반 `OFFSET 90000`
- 90,000번째 위치와 동일한 복합 커서 조회
- 기존 Page count

각 결과에서 사용 인덱스, 예상·실제 행 수, 정렬 여부, actual time과 loops를 기록한다.

### API 측정

API는 최초 A와 최종 C만 k6로 비교한다. A는 쿼리 최적화 전 `2af8f64`와 V5 이전 인덱스 상태이고, C는 현재 복합 커서 구현과 V5 인덱스 상태다. 부모 B와 C의 API 수치를 별도로 비교하지 않는다. B→C 커서 효과는 동일 High DB의 `OFFSET 90000`과 복합 커서 `EXPLAIN ANALYZE`로 격리한다.

동일한 인증 사용자, 방, 페이지 크기 20, JVM과 DB 데이터로 다음 두 경로를 측정한다.

- A `page=0`과 C 첫 페이지
- A `page=4500`, 즉 OFFSET 90000과 C의 동일 위치 복합 커서 페이지
- 워밍업을 제외한 p50, p95, 평균, 최솟값, 최댓값, HTTP 오류율과 응답 계약 오류율

각 버전은 한 번에 하나의 백엔드만 기동하며 1 VU가 경로별 50회 순차 호출하는 실행을 두 번 저장한다. 두 버전이 DB로 계산한 같은 20개 메시지 ID 집합을 반환하는지 사전 검증하고, C는 `hasNext`와 `nextCursor`도 확인한다. 동일 `sentAt` 내부 순서가 결정적이지 않은 A는 순서 대신 ID 집합을 비교한다.

A→C API 결과는 쿼리 구조, V5 인덱스, count 제거와 커서 전환이 합쳐진 최종 사용자 관점의 개선으로만 사용한다. 커서 단독 API 개선율로 표현하지 않는다. 깊은 비교는 사용자가 이전 페이지를 읽어 해당 커서를 이미 가진 상황의 다음 20건 비용이며, 임의 페이지 점프 비용이 아니다.

장시간 스트레스 테스트나 여러 VU 조합은 수행하지 않는다. 이 값은 Controller, 인증, JPA 변환과 JSON 직렬화를 포함하지만 동시 처리량이나 운영 SLO를 나타내지 않는다.

### 쓰기 비용

격리 DB에서 동일한 배치 insert를 인덱스 제거 전·후 각각 워밍업 1회와 저장 실행 2회로 비교한다.

- DM: V5 DM 복합 인덱스 유무
- 알림: V5 알림 복합 인덱스 유무

insert 시간과 인덱스 크기를 기록한다. 읽기 개선과 비교해 수용 가능한 비용인지 문서화하되, 쓰기 최적화 자체는 이번 범위에 포함하지 않는다. 측정 중 제거한 인덱스는 오류 시에도 복구하며 다음 검증에서 존재 여부를 다시 확인한다.

## 문서와 결과

- 쿼리 분석 README에 커서 실행과 측정 스크립트를 설명한다.
- `results/summary.md`에 깊은 OFFSET, 커서, A→C API와 쓰기 비용을 구분하고, API 전체 효과와 B→C SQL의 커서 효과가 섞이지 않도록 귀속 관계를 기록한다.
- 원본 로컬 측정 파일은 기존과 같이 Git에서 제외한다.
- PR에는 기존 병목, 실행 계획 변화, 커서 선택 근거, 남은 제약과 실제 측정 수치를 요약한다.
- 이력서에는 구현과 측정이 끝난 수치만 사용하며 SQL 데이터 조회 시간을 API 응답 시간으로 표현하지 않는다.

## 비목표

- 알림 API의 커서 전환
- DM 메시지 저장 방식 변경
- 새로운 인덱스 추가
- 장시간 또는 대규모 동시 사용자 부하 테스트
- 기존 단체채팅 커서 구현 변경
