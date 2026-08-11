# DevChat AI Permission Guard Design

## 목적

Logging Hook으로 실제 이벤트 형식을 확인한 뒤 `PreToolUse`에 최소한의 위험 명령 차단 규칙을 추가한다. 이 Guard는 유용한 안전장치일 뿐 완전한 보안 경계가 아니다.

## 정책

다음 작업은 Codex 실행을 무조건 차단하고 사람이 터미널에서 별도로 수행한다.

- `git reset --hard`, 강제 push와 광범위한 checkout 복구
- 저장소·홈·루트처럼 넓은 경로의 재귀 삭제
- `.env`, 개인키와 운영 자격증명 파일 쓰기
- 운영 환경 배포와 운영 데이터베이스 파괴 명령
- 범위가 드러나지 않는 `git add .`, `git add -A`

`PreToolUse` payload만으로 사용자가 해당 명령을 명시적으로 승인했는지 신뢰성 있게 판단할 수 없다. 따라서 “승인됐으면 허용”을 문자열 추측으로 구현하지 않는다. 필요한 운영 작업은 Guard 밖의 명시적인 수동 절차나 별도 승인 인터페이스로 수행한다.

## 동작

1. Logging Hook과 별도의 `PreToolUse` command handler로 실행한다.
2. Bash와 `apply_patch` 입력을 정규화하되 shell 명령을 실행하거나 재작성하지 않는다.
3. 차단 시 `permissionDecision: deny`와 짧은 이유를 반환한다.
4. 허용 시 stdout 없이 종료한다.
5. 여러 matching Hook은 동시에 시작될 수 있으므로 Logging Hook에는 차단 시도도 기록될 수 있다.

## 테스트

- 명확한 위험 명령은 차단한다.
- 유사하지만 안전한 조회 명령은 허용한다.
- 경로가 변수·glob·명령 치환으로 모호하면 안전하게 차단한다.
- 인용·공백 변형으로 규칙을 우회하지 못한다.
- 차단 응답이 현재 Codex Hook JSON 계약과 일치한다.

## 구현 순서

Logging Hook의 실제 턴 검증 후 별도 TDD 계획을 작성한다. RAG와 동시에 구현하지 않는다.
