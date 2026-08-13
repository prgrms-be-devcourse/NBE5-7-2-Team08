# Hybrid RAG PR #7 리뷰 반영

## 목적

초기 RAG 설정과 optional Hook의 실패를 막고, 승인 문서 경계와 검색 결과가 현재 운영 규칙을 지키도록 보완했다.

## 변경 사항

- index 생성만 모델 다운로드를 허용하고 Hook runtime은 local cache 전용으로 유지했다.
- `.venv`가 없는 checkout에서도 RAG Hook이 빈 출력과 성공 종료를 반환하도록 경량 래퍼를 추가했다.
- corpus loader가 `docs/superpowers/plans/`, `docs/local/`과 symbolic link를 제외한다.
- 긴 단일 문단을 body 예산 이하로 나누고, 같은 줄 범위의 분할 조각에는 `content_offset` index identity를 부여해 모두 색인한다. 다른 문서의 rank가 사이에 있어도 source line이 인접한 chunk를 병합한다.
- 최종 manifest corpus로 평가를 다시 실행하고, 검색 시간과 실제 Hook 요청 지연시간을 구분해 기록한다.
- Stop Hook·자동 Markdown 요약이 제거된 현재 운영 문서에 맞춰 workflow 문서를 갱신했다.

## 영향 범위

- 첫 index 생성은 모델 cache가 비어 있으면 다운로드를 수행한다.
- runtime 환경이나 index가 준비되지 않은 요청은 RAG 컨텍스트 없이 계속 진행한다.
- 계획·로컬 문서와 symbolic link는 manifest에 `active`로 있어도 검색되지 않는다.

## 검증

- `.codex/rag/tests`와 `.codex/hooks/tests` 전체 회귀 테스트
- 최종 manifest 기반 index 생성과 sparse·dense·hybrid 평가
- 평가 질문별 실제 Hook wrapper 프로세스 지연시간 측정

최종 corpus 재생성 결과는 active Markdown 12개와 chunk 144개이며, 같은 줄 범위의 분할 조각도 모두 저장된다. 선택된 small/hybrid의 실제 Hook 요청 지연시간은 p50 3045.45 ms, p95 3067.43 ms였다.

## 남은 리스크

- 실제 Hook 지연시간은 로컬 CPU, 모델 cache와 corpus 상태에 따라 달라진다.
- 검색 근거는 참고자료이며 현재 코드·운영 상태는 요청 처리 중 별도로 확인해야 한다.
