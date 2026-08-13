# AI 작업 종료 기록 흐름 정리

## 목적

자동 Stop summary 파일 대신, 테스트를 통과한 코드 변경마다 한 개의 지식 기록과 PR 본문 초안을 남기는 흐름으로 정리했다.

## 변경 사항

- Stop Hook과 Markdown summary 생성 구현·테스트를 제거했다.
- Logging Hook은 로컬 JSONL 이벤트 기록만 유지한다.
- `docs/knowledge/changes/`를 코드 변경 지식 기록의 고정 위치로 만들었다.
- Permission Guard 설계 문서를 구현 완료 상태로 갱신하고 RAG active corpus에 등록했다.
- PR 본문은 템플릿으로 작성하고, 원격에 이미 push된 HEAD만 `gh`로 draft PR을 게시하도록 저장소 규칙을 추가했다.

## 영향 범위

- 새 Codex 작업은 `ai/summaries/` Markdown 파일을 만들지 않는다.
- 기존 summary 파일은 삭제하지 않고 Git에서 제외한다.
- 지식 기록은 Git 추적 뒤 index를 다시 생성하면 RAG 검색 근거로 사용된다.

## 검증

- `python3 -m unittest discover -s .codex/hooks/tests -p 'test_*.py' -v`
- `python3 -m unittest discover -s .codex/rag/tests -p 'test_*.py' -v`

## 남은 리스크

- 새 지식 기록은 commit 전에는 Git 추적 문서만 색인하는 RAG 안전 규칙 때문에 검색되지 않는다.
- PR 생성은 commit·push를 대신하지 않으며, 원격 HEAD가 현재 로컬 HEAD와 같을 때만 가능하다.
