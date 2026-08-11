# DevChat AI Workflow Logging Hooks Design

## 목표

Superpowers의 `조사 → 계획 → 승인 → 구현 → 리뷰 → 검증` 절차를 DevChat 규칙에 적용하고, Codex의 요청·도구 실행·Git 기준점·검증 명령을 로컬에서 연결한다.

여기서 재현성은 같은 Git 기준점과 검증 명령으로 결과를 다시 확인하는 **검증 재현성**이다. 같은 프롬프트로 같은 코드가 생성된다는 의미가 아니다.

## 구성

- `UserPromptSubmit`: 마스킹된 요청 미리보기, 원문 길이와 SHA-256
- `PreToolUse`: Bash와 파일 수정 도구의 마스킹된 입력
- `PostToolUse`: 성공 여부, 결과 길이와 SHA-256
- `Stop`: 시작·종료 Git 상태와 검증 명령의 Markdown 요약

Python 표준 라이브러리만 사용한다. Hook은 `additionalContext`를 반환하지 않아 모델 입력 토큰을 추가하지 않는다.

## 데이터 경계

- 원본 프롬프트와 전체 도구 결과를 저장하지 않는다.
- 비밀번호, 토큰, Cookie, URI 자격증명, 이메일과 개인키를 기록 전에 마스킹한다.
- 정규식 마스킹은 보안 경계가 아니므로 `ai/logs/*.jsonl`은 Git에서 제외한다.
- 세션 ID는 길이가 제한된 안전 prefix와 원문 digest로 파일명을 만들어 경로 이탈과 이름 충돌을 막는다.
- 로그 디렉터리와 JSONL은 각각 owner-only 권한으로 생성한다.
- 첫 이벤트에서만 commit, branch와 기존 미커밋 파일을 기록한다.

## 한계

- Logging Hook은 관찰 도구이며 위험 명령을 차단하지 않는다.
- 기록만으로 AI 정확성, 오류 감소나 개발 안정성 향상을 주장하지 않는다.
- 프로젝트 Hook은 사용자가 `/hooks`에서 정의를 검토하고 신뢰한 뒤 실행된다.

## 완료 조건

- 마스킹, 이벤트 정규화, Git 기준점, 요약과 설정 계약 테스트가 통과한다.
- 하위 디렉터리에서도 Git 루트의 Hook을 실행할 수 있다.
- 스모크 로그에 비밀 원문과 전체 도구 결과가 남지 않는다.
- JSONL이 Git에서 제외되고 Stop 출력이 유효한 JSON이다.
