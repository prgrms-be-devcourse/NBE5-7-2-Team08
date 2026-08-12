# DevChat AI 보조 개발 워크플로우와 Logging Hook 설계

> **상태: 구현 및 자동 테스트 완료, 실제 `/hooks` 신뢰 턴 운영 검증 전.** 이 문서에서 재현성은 같은 Git 기준점과 검증 명령으로 결과를 다시 확인하는 **검증 재현성**이며, 같은 프롬프트에서 같은 코드가 생성된다는 뜻이 아니다.

## 현행 구현 보강사항

- `UserPromptSubmit`은 마스킹된 요청 미리보기, 원문 길이와 SHA-256만 기록한다.
- `PreToolUse`는 Bash와 파일 수정 도구의 마스킹된 입력을 기록한다.
- `PostToolUse`는 성공 여부, 결과 길이와 SHA-256만 기록하고 본문을 저장하지 않는다.
- `Stop`은 시작·종료 Git 상태와 검증 명령을 Markdown으로 요약하고 유효한 JSON 응답을 반환한다.
- Python 표준 라이브러리만 사용하며 `additionalContext`를 반환하지 않아 Hook 자체가 모델 입력 토큰을 추가하지 않는다.
- 세션 ID는 길이가 제한된 안전 prefix와 원문 digest로 파일명을 만들어 경로 이탈과 이름 충돌을 막는다.
- 로그 디렉터리와 JSONL은 owner-only 권한으로 생성한다.
- 첫 이벤트에서만 commit, branch와 기존 미커밋 파일을 기록한다.
- 정규식 마스킹은 보안 경계가 아니므로 `ai/logs/*.jsonl`은 Git에서 제외한다.
- 프로젝트 Hook은 사용자가 원래 저장소 경로의 `/hooks`에서 정의를 검토하고 신뢰한 뒤 실행된다.

Logging Hook은 관찰 장치일 뿐 위험 명령을 차단하지 않는다. 기록만으로 AI 정확성, 오류 감소 또는 개발 안정성 향상을 주장하지 않는다.

---

이하 섹션은 배경, 역할 분리, 이벤트 계약, 파일 구조, 사용 흐름과 검증 조건을 보존한 상세 설계다.

## 배경

DevChat에는 Superpowers로 작성한 설계 및 구현 계획이 있지만, AI 작업 절차를 저장소 수준에서 일관되게 적용하는 규칙과 실행 기록이 없다. 현재는 작업 요청, 도구 실행, 테스트 결과, 사람의 채택 및 기각 판단을 하나의 작업 단위로 연결하기 어렵다.

이 설계는 Superpowers가 제공하는 분석, 계획, 구현, 리뷰, 검증 절차를 DevChat의 저장소 규칙으로 명시하고, Codex Hooks로 실제 도구 실행과 검증 근거를 로컬에 기록하는 것을 목표로 한다.

## 목표

- 고위험 변경은 분석, 계획, 사람 승인, 구현, 리뷰, 검증 순서로 수행한다.
- 구현과 리뷰 역할을 분리하고 Reviewer는 명시적 요청 없이 코드를 수정하지 않는다.
- Codex의 작업 요청과 `Bash`, `apply_patch` 실행을 세션 및 턴 단위로 추적한다.
- 작업 시작 commit, 시작 시점의 미커밋 파일, 변경 파일, 검증 명령을 Markdown 요약으로 연결한다.
- 원본 로그는 Git에서 제외하고 사람이 검토한 요약만 선택적으로 PR 근거로 사용한다.
- 기존 DM 페이지네이션 및 쿼리 분석 변경을 Hook 적용 이후 변경으로 잘못 귀속하지 않는다.

## 제외 범위

- RAG와 벡터 검색
- MCP 서버 구축
- 위험 명령을 차단하는 권한 Guard
- 외부 로그 수집 및 분석 서비스
- LLM을 호출하는 로그 요약
- 동일한 프롬프트에서 동일한 코드 결과를 재현한다는 주장

## Superpowers 역할 매핑

| 단계 | 적용 절차 |
| --- | --- |
| 구조 조사와 요구사항 구체화 | `brainstorming` |
| 버그 원인 분석 | `systematic-debugging` |
| 구현 계획 | `writing-plans` |
| 승인된 계획 구현 | `executing-plans` 또는 `subagent-driven-development` |
| 코드 검토 | `requesting-code-review` |
| 리뷰 의견 검증 | `receiving-code-review` |
| 완료 전 증거 확인 | `verification-before-completion` |

단순 조회, 오타 수정, 사용자가 지정한 일회성 명령에는 전체 절차를 강제하지 않는다. 인증, WebSocket, 비동기 이벤트, 데이터베이스 마이그레이션, 배포, 인프라, 성능 주장은 고위험 변경으로 취급한다.

## Hook 이벤트

프로젝트 루트의 `.codex/hooks.json`에서 다음 이벤트를 사용한다.

| 이벤트 | 기록 내용 |
| --- | --- |
| `UserPromptSubmit` | 마스킹된 요청 미리보기, 원문 길이, 원문 SHA-256 |
| `PreToolUse` | 도구 이름, 도구 호출 ID, 마스킹된 입력 요약 |
| `PostToolUse` | 도구 이름, 도구 호출 ID, 성공 여부, 결과 크기 및 SHA-256 |
| `Stop` | 기준 commit, 시작 및 종료 Git 상태, 검증 명령을 Markdown으로 요약 |

`PreToolUse`와 `PostToolUse`는 `Bash|apply_patch|Edit|Write`만 대상으로 한다. Hook은 모델에 `additionalContext`를 반환하지 않는다. 로컬 파일 기록만 수행해 Hook 자체가 모델 컨텍스트를 늘리지 않게 한다.

## 파일 구조

```text
.codex/
  hooks.json
  hooks/
    hook_common.py
    log_ai_event.py
    redact_ai_log.py
    summarize_ai_log.py
    tests/
      test_redact_ai_log.py
      test_log_ai_event.py
      test_summarize_ai_log.py
ai/
  README.md
  ai-assisted-development-workflow.md
  logs/
    .gitkeep
  summaries/
    .gitkeep
```

`hook_common.py`는 저장소 루트 탐색, JSONL 경로 계산, 안전한 JSON 직렬화와 Git 상태 수집을 담당한다. 각 실행 파일은 하나의 책임만 갖는다.

## 로그 식별자와 기준점

- 파일명은 세션 ID의 안전한 48자 prefix와 원문 SHA-256 앞 16자리를 결합해 사용한다.
- 각 레코드에 `session_id`, `turn_id`, `hook_event_name`, `timestamp`를 저장한다. 로그 디렉터리는 `0700`, JSONL은 `0600` 권한을 강제한다.
- 세션의 첫 이벤트에서 `base_commit`, `branch`, `initial_dirty_files`를 기록한다.
- 종료 요약은 최초 상태와 현재 상태를 함께 보여준다.
- 기존 미커밋 파일은 `initial_dirty_files`로 구분하며 Hook 적용 이후 생성된 것으로 표현하지 않는다.

## 민감정보 보호

Hook 입력은 디스크에 쓰기 전에 마스킹한다.

- 비밀번호, API 키, Access Token, Refresh Token
- `Authorization`, Cookie 및 세션 값
- 데이터베이스 연결 문자열
- 이메일 주소
- PEM 개인키 본문
- `.env` 값 형태

요청 원문은 저장하지 않는다. 마스킹된 미리보기와 원문 SHA-256 및 길이만 저장한다. 도구 결과도 본문 대신 성공 여부, 길이, SHA-256만 저장한다. 정규식 마스킹은 완전한 보안 경계가 아니므로 `ai/logs/*.jsonl`은 항상 Git에서 제외한다.

## 요약 문서

`Stop` Hook은 Python 표준 라이브러리만 사용해 다음 항목을 정리한다.

- 세션 및 턴 ID
- 기준 commit과 브랜치
- 시작 시점의 미커밋 파일
- 종료 시점의 변경 파일
- 실행한 검증 명령과 성공 여부
- 실패한 도구 호출
- 사람이 작성해야 하는 채택 및 기각 판단과 남은 리스크 입력란

요약 파일은 `ai/summaries/<date>-<branch>-<turn_id>.md`에 생성한다. Hook은 AI로 의미를 추론하지 않고 기록된 사실만 기계적으로 정리한다.

## 사용 흐름

1. 사용자가 `/hooks`에서 프로젝트 Hook 정의를 검토하고 신뢰한다.
2. 평소처럼 Codex에 작업을 요청한다.
3. 고위험 작업은 계획을 먼저 검토하고 승인한다.
4. Hook이 요청과 도구 실행을 로컬 JSONL에 자동 기록한다.
5. 작업 종료 시 Markdown 요약이 생성된다.
6. 사용자는 요약을 검토하고 PR에 채택 및 기각 판단과 남은 리스크를 작성한다.

## 검증

- 마스킹 테스트는 토큰, 비밀번호, 이메일, 연결 문자열과 개인키가 로그에 남지 않는지 확인한다.
- 이벤트 테스트는 세션 첫 이벤트에 Git 기준점이 한 번만 기록되는지 확인한다.
- 요약 테스트는 기존 미커밋 파일과 종료 시점 변경 파일을 구분하는지 확인한다.
- Hook 스모크 테스트는 샘플 JSON을 stdin으로 전달해 JSONL과 Markdown이 생성되는지 확인한다.
- 실제 Codex 작업에서는 `/hooks` 신뢰 후 Bash와 `apply_patch` 이벤트가 기록되는지 확인한다.

## 완료 조건

- DevChat에 AI 작업 규칙과 역할별 절차가 문서화된다.
- 네 종류의 Hook 이벤트가 로컬에서 실행된다.
- 원본 로그가 Git에서 제외된다.
- 민감정보 마스킹 테스트가 통과한다.
- 시작 commit, 기존 미커밋 파일, 변경 파일, 검증 명령을 연결한 요약이 생성된다.
- 실제 DevChat Codex 작업 한 건에서 Hook 로그와 요약을 확인한다.

최소 세 건의 PR 적용과 로그를 통한 원인 추적 사례 확보는 운영 검증 단계로 남긴다. 해당 근거가 생기기 전에는 이력서에서 개발 안정성 향상이나 오류 감소를 주장하지 않는다.
