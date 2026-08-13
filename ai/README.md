# DevChat AI 작업 기록

DevChat에 적용한 AI 보조 개발 절차와 로컬 실행 기록의 위치를 설명한다.

- [`ai-assisted-development-workflow.md`](./ai-assisted-development-workflow.md): 작업 단계, 사람 승인과 역할 분리
- [`permission-guard-policy.md`](./permission-guard-policy.md): Codex `PreToolUse` Permission Guard의 차단 정책과 검증 방법
- [`permission-guard-case-study.md`](./permission-guard-case-study.md): 셸 인용 우회 재현과 Guard 보완 사례
- [`rag/README.md`](./rag/README.md): `@rag` 전용 저장소 문맥 검색의 설정과 사용 방법
- [`../docs/knowledge/README.md`](../docs/knowledge/README.md): 테스트를 통과한 코드 변경의 RAG 대상 지식 기록
- `logs/`: Codex Hook이 생성하는 로컬 JSONL. `*.jsonl`은 Git에서 제외한다.
- `summaries/`: 이전 Stop Hook이 생성한 로컬 Markdown 요약 보관 위치. 새 요약은 생성하지 않고 `*.md`는 Git에서 제외한다.

Hook을 처음 사용하거나 설정이 변경되면 Codex의 `/hooks`에서 프로젝트 Hook 정의를 검토하고 신뢰해야 한다.
