# DevChat AI 작업 기록

DevChat에 적용한 AI 보조 개발 절차와 로컬 실행 기록의 위치를 설명한다.

- [`ai-assisted-development-workflow.md`](./ai-assisted-development-workflow.md): 작업 단계, 사람 승인과 역할 분리
- [`permission-guard-policy.md`](./permission-guard-policy.md): Codex `PreToolUse` Permission Guard의 차단 정책과 검증 방법
- [`permission-guard-case-study.md`](./permission-guard-case-study.md): 셸 인용 우회 재현과 Guard 보완 사례
- `logs/`: Codex Hook이 생성하는 로컬 JSONL. `*.jsonl`은 Git에서 제외한다.
- `summaries/`: Stop Hook이 생성하는 사실 기반 Markdown 요약. 사람이 검토한 문서만 선택적으로 사용한다.

Hook을 처음 사용하거나 설정이 변경되면 Codex의 `/hooks`에서 프로젝트 Hook 정의를 검토하고 신뢰해야 한다.
