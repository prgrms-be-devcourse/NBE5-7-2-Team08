# Hybrid RAG 추가

## 목적

`@rag` 요청에서만 승인된 저장소 문서를 검색 근거로 제공하도록 Hybrid RAG를 추가했다.

## 변경 사항

- Markdown 문서를 heading과 줄 번호 경계를 보존한 chunk로 만들고 SQLite FTS5 index에 저장한다.
- 로컬 `multilingual-e5-small` 임베딩과 FTS5 후보를 RRF로 결합하고, 관련도 gate·인접 chunk 병합·1,200자 본문 제한을 적용한다.
- `UserPromptSubmit` Hook은 `@rag` 접두사가 없으면 검색·모델 로딩·추가 컨텍스트 반환 없이 종료한다.
- corpus manifest의 `active`이면서 Git 추적된 Markdown 문서만 색인하고, Permission Guard 설계 문서를 active 근거로 등록했다.

## 영향 범위

- `@rag` 요청은 최대 3개의 파일·줄 번호 인용을 포함한 추가 컨텍스트를 받을 수 있다.
- 일반 Codex 요청은 RAG 실행 비용이나 추가 컨텍스트의 영향을 받지 않는다.
- SQLite index와 Python 가상환경은 로컬 생성물로 Git에서 제외한다.

## 검증

- `python3 -m unittest discover -s .codex/rag/tests -p 'test_*.py' -v`
- `python3 -m unittest discover -s .codex/hooks/tests -p 'test_*.py' -v`

## 남은 리스크

- 로컬 모델·index가 없거나 검색 결과가 관련도 gate를 넘지 못하면 컨텍스트를 제공하지 않는다.
- 검색 근거는 참고자료이며 현재 코드와 운영 상태는 요청 처리 중 별도로 확인해야 한다.
