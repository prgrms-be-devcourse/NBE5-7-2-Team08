# DevChat AI Workflow Logging Hooks Implementation Plan

## 범위

Codex Logging Hook, 테스트, 저장소 작업 규칙과 PR 판단 기록을 구현한다. Permission Guard와 RAG 구현은 별도 계획으로 남긴다.

## 작업

- [x] 민감정보 마스킹과 안정적인 SHA-256 유틸리티를 테스트 우선으로 구현한다.
- [x] Git 기준점과 세션별 JSONL append를 테스트 우선으로 구현한다.
- [x] 검증 명령 분류와 사실 기반 Markdown 요약을 테스트 우선으로 구현한다.
- [x] `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop` 설정 계약을 검증한다.
- [x] `AGENTS.md`, AI 워크플로우와 PR 판단 기록을 추가한다.
- [x] 하위 디렉터리 실행, 마스킹, 응답 본문 미저장과 Git ignore를 스모크 테스트한다.
- [ ] 사용자가 `/hooks`에서 프로젝트 Hook을 신뢰한 뒤 실제 Codex 턴 한 건을 확인한다.

## 검증 명령

```bash
python3 -m unittest discover -s .codex/hooks/tests -p 'test_*.py' -v
```

백엔드 전체 테스트는 구현 전 기준 확인 중 테스트 컨테이너 종료 후 스케줄러 재접속으로 종료되지 않았다. Hook은 백엔드 코드를 변경하지 않으므로 전용 Python 테스트와 스모크 테스트를 완료 기준으로 사용한다.
