# DevChat 저장소 문맥 RAG 설계

> **상태: 구현 및 로컬 검증 완료.** 현행 기준은 아래 `현행 확정사항`의 Hybrid RAG다. 뒤의 `초기 FTS5-first 상세안`은 당시 고려한 계약과 변경 근거를 보존하지만 실행 기준은 아니다.

## 현행 확정사항

사용자 요청이 `@rag`로 시작할 때만 DevChat의 승인된 현재 문서에서 관련 근거를 찾아 Codex에 짧은 컨텍스트로 제공한다. 각 결과에는 파일과 줄 번호를 포함하고 관련도가 낮으면 아무 문서도 제공하지 않는다. `@rag`가 없는 요청에서는 검색, 임베딩 모델 로딩, 추가 컨텍스트 주입을 모두 수행하지 않는다.

### 문서 집합

`AGENTS.md`를 우선 인덱싱하고 자동 glob 대신 `ai/rag/corpus.json`에 승인 문서를 명시한다. 문서는 `active`, `draft`, `superseded` 상태를 가지며 `active`만 기본 검색 대상이다.

우선 후보는 다음과 같다.

- `AGENTS.md`, 루트 및 구성요소 README
- 현재 상태가 승인된 설계·의사결정 문서
- 성능 실험의 조건과 결과 요약
- Blue/Green 배포·롤백 Runbook
- 구현이 확정된 알림 전달 신뢰성 문서

오래된 인증 토큰 문서, 구현 전 초안, 비밀 파일, 원본 AI 로그와 Git 제외 파일은 인덱싱하지 않는다.

### Hybrid 검색 구조

```text
질문
 ├─ Sparse: SQLite FTS5 / BM25
 └─ Dense: multilingual E5 임베딩 / cosine similarity
          ↓
      RRF 순위 결합
          ↓
  낮은 관련도 제거 → 인접 chunk 병합 → Top 3
          ↓
  경로:시작줄-끝줄 + 본문 최대 1,200자
```

- Sparse는 클래스명, 설정 키와 오류 코드처럼 정확한 키워드에 강하다.
- Dense는 표현이 달라도 의미가 비슷한 문서를 찾는다.
- RRF는 점수 척도가 다른 두 결과를 순위 기반으로 결합한다.
- RRF 자체는 항상 순위를 만들므로 lexical 근거와 corpus 평가로 보정한 cosine threshold를 결합 전에 적용해 no-result를 판정한다.
- 동일 문서의 인접 chunk는 합치고 중복 인용을 제거한다.

임베딩 모델은 같은 9개 질문 세트에서 `intfloat/multilingual-e5-small`과 `intfloat/multilingual-e5-base`를 비교했다. `base`가 검색 품질을 개선하지 못하고 지연시간이 약 두 배여서 `small`을 선택했다. `dense_min_score`는 세 no-result 사례를 모두 통과한 0.88이다. `BGE-M3`는 FTS5와 기능이 겹치고 작은 문서 corpus에는 운영 복잡도가 커서 초기 범위에서 제외한다.

모델은 로컬 CPU에서 실행하며 최초 다운로드 이후 OpenAI 임베딩 API 토큰을 사용하지 않는다. `@rag` 요청마다 Hook이 Python 검색 프로세스를 시작하고 모델을 메모리에 로드한 뒤 검색을 마치면 종료한다. 검색 본문이 `additionalContext`로 들어갈 때만 Codex 입력 토큰이 증가한다.

### 출력과 평가

- 최종 Top 3
- 전체 문서 본문 최대 1,200자, 인용 표기는 별도
- 관련도 미달이면 결과 0개
- 각 결과에 `path:start_line-end_line` 필수

평가 CLI는 `--mode sparse|dense|hybrid` 세 모드를 같은 질문으로 비교한다. Recall@3, MRR, no-result precision, citation completeness와 p50/p95 지연시간을 기록한다. Hybrid는 exact lookup을 퇴행시키지 않으면서 sparse 또는 dense 단독의 누락을 줄일 때 채택한다. 고정된 `20개`, `Hit@3 >= 0.80`을 구현 전 성공 기준으로 선언하지 않는다.

### 구현 순서

1. corpus manifest와 chunk·line citation 계약
2. FTS5 sparse index와 평가 CLI
3. small/base 임베딩 index와 모델 비교
4. RRF, no-result gate와 인접 chunk 병합
5. 세 모드 평가 결과 기록
6. `@rag` 접두사 전용 `UserPromptSubmit` Hook 연결과 1,200자 제한 검증

Logging Hook 실제 턴과 Permission Guard 설계를 먼저 검증한 뒤 별도 구현 계획을 작성한다.

---

## 초기 FTS5-first 상세안과 변경 근거

아래 내용은 누락 방지를 위해 보존한 초기 상세안이다. allowlist, chunk 메타데이터, 파일 구조, 보안 경계와 검증 항목은 현행 설계에 재사용한다. 다만 다음 세 항목은 폐기됐다.

- FTS5만 먼저 구현하고 임베딩을 나중에 추가하는 순서
- 전체 컨텍스트를 최대 1,200토큰으로 제한하는 기준
- 평가 전에 `20개 질문`, `Hit@3 >= 0.80`을 고정 성공 기준으로 선언하는 방식

## 배경

DevChat에는 인증, WebSocket, 비동기 알림, DM, 배포, 성능 측정에 관한 설계와 결과 문서가 여러 위치에 존재한다. AI가 현재 코드만 탐색하면 과거 설계 결정, 이미 확인한 실패 사례, 성능 측정 조건을 놓치거나 오래된 문서를 근거로 사용할 수 있다.

이 설계는 DevChat의 검증된 문서를 로컬에서 색인하고, 사용자 요청과 관련된 근거만 Codex에 제공하는 저장소 문맥 RAG를 만든다. 생성 모델을 별도로 호출하지 않고 Codex가 generator 역할을 한다.

## 선행 조건

- Logging Hook 구현과 실제 작업 검증이 완료되어야 한다.
- Permission Guard 구현은 필수 선행 조건이 아니지만 먼저 적용하는 것을 권장한다.
- RAG Hook은 Logging Hook과 별도 `UserPromptSubmit` handler로 유지한다.

## 목표

- DevChat의 현재 유효한 설계 및 검증 문서를 로컬 색인한다.
- 사용자 요청마다 관련 문서 조각과 파일 및 줄 번호를 Codex 컨텍스트에 제공한다.
- 검색 결과의 크기를 제한해 불필요한 토큰 증가를 막는다.
- 오래된 문서, 비밀 파일, 원본 로그가 색인에 포함되지 않게 한다.
- 기준 질문 세트로 검색 품질을 측정하고 단순 `rg` 검색과 비교한다.

## 제외 범위

- 전체 소스 코드 임베딩
- 사용자 대화 및 `ai/logs/*.jsonl` 색인
- 외부 SaaS 벡터 데이터베이스
- OpenAI Embeddings API 또는 별도 생성 모델 호출
- 자동으로 문서를 수정하는 기능
- 검색 결과를 사실로 보장하는 기능

## 1차 검색 방식

Python 표준 라이브러리와 SQLite FTS5를 사용한 로컬 lexical retrieval을 적용한다. RAG는 벡터 검색만을 의미하지 않는다. 검색된 근거를 생성 모델의 컨텍스트에 주입하는 구조이므로 FTS5 기반 검색도 retrieval-augmented generation으로 설명할 수 있다.

임베딩과 hybrid retrieval은 FTS5 기준선의 한계가 측정된 뒤 별도 확장으로 판단한다. 이력서용 키워드를 위해 벡터 데이터베이스를 먼저 추가하지 않는다.

## 색인 대상

초기 allowlist는 다음과 같다.

- `AGENTS.md`
- `README.md`의 아키텍처 및 운영 섹션
- `ai/*.md`
- `docs/superpowers/specs/*.md`
- `docs/superpowers/plans/*.md`
- `backend/perf/**/README.md`
- `backend/perf/**/results/summary.md`
- `.github/PULL_REQUEST_TEMPLATE.md`

다음은 제외한다.

- `.env` 및 인증 정보
- `ai/logs/`
- raw 성능 결과
- Git에서 추적되지 않는 임시 파일
- `.DS_Store`
- `build`, `node_modules`, 생성 산출물

문서가 현재 유효한지는 allowlist와 Git 추적 여부로 우선 통제한다. 폐기된 문서는 front matter의 `rag_status: archived`로 제외할 수 있다.

## 청킹과 메타데이터

Markdown 제목 경계를 우선해 조각을 나눈다. 하나의 조각은 제목 경로와 본문을 포함하며 최대 2,000자로 제한한다. 긴 섹션은 문단 경계에서 나눈다.

각 조각은 다음 메타데이터를 갖는다.

```json
{
  "path": "docs/superpowers/specs/example.md",
  "heading": "문제 > 검증",
  "start_line": 42,
  "end_line": 67,
  "content_sha256": "...",
  "git_commit": "..."
}
```

색인 갱신 시 SHA-256이 같은 조각은 다시 쓰지 않고, 원본에서 사라진 조각은 삭제한다.

## 검색과 컨텍스트 주입

`UserPromptSubmit` Hook은 사용자 prompt를 검색 CLI에 전달한다. 검색기는 상위 3개 조각을 선택하고 중복 문서 및 인접 중복 조각을 제거한다. 전체 컨텍스트는 최대 1,200 토큰에 해당하는 보수적 문자 제한을 적용한다.

검색 결과가 없으면 stdout을 비우고 종료한다. 결과가 있으면 다음 형태로 반환한다.

```json
{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "DevChat 저장소 근거:\n1. docs/...md:42 ..."
  }
}
```

각 결과에는 `path:start_line`과 제목을 포함한다. Codex는 검색 근거와 현재 코드를 함께 확인하며, 검색 결과만으로 결론을 확정하지 않는다.

## 파일 구조

```text
.codex/rag/
  corpus.py
  chunk_markdown.py
  index.py
  search.py
  user_prompt_rag.py
  tests/
    test_corpus.py
    test_chunk_markdown.py
    test_index.py
    test_search.py
    test_user_prompt_rag.py
ai/rag/
  README.md
  eval-questions.json
  eval.py
  index/
    devchat-context.sqlite3
```

SQLite 색인은 로컬 생성물로 Git에서 제외한다. 평가 질문과 기대 근거 문서는 Git에 포함한다.

## 평가

최소 20개 질문을 다음 영역에 배분한다.

- JWT와 Redis 토큰 상태
- WebSocket 인증 및 재연결
- 친구 관계와 DM
- 비동기 알림 및 `AFTER_COMMIT`
- Blue/Green 배포와 헬스체크
- 쿼리 실행 계획과 성능 측정 조건
- AI 작업 규칙과 검증 절차

각 질문에는 기대 문서 경로를 지정한다. 다음 지표를 계산한다.

- `Hit@3`: 상위 3개 결과에 기대 문서가 포함된 비율
- `MRR`: 첫 기대 문서 순위의 역수 평균
- `Citation completeness`: 반환 결과에 경로와 줄 번호가 모두 있는 비율
- `Archived exclusion`: 폐기 문서가 결과에서 제외되는 비율

초기 성공 기준은 `Hit@3 >= 0.80`, citation completeness `1.00`, archived exclusion `1.00`이다. 단순 `rg` 키워드 검색도 같은 질문으로 실행해 기준선과 비교한다.

## 토큰 및 운영 제한

- 검색 자체는 로컬에서 실행되어 모델 토큰을 사용하지 않는다.
- `additionalContext`로 전달한 검색 결과는 입력 토큰을 사용한다.
- 결과는 최대 3개, 전체 1,200 토큰 상당으로 제한한다.
- 검색 지연과 결과 수를 Logging Hook에 메타데이터로 기록할 수 있지만 검색 본문은 중복 저장하지 않는다.
- 인덱스 갱신은 문서 변경 후 수동 명령으로 시작하고, 품질 검증 전 자동 background 갱신을 추가하지 않는다.

## 검증

- allowlist와 denylist가 비밀 파일 및 원본 로그를 제외하는지 테스트한다.
- Markdown 제목, 줄 번호, 긴 섹션 분할을 테스트한다.
- 변경, 삭제, archived 문서의 증분 색인 동작을 테스트한다.
- 검색 결과가 정해진 개수와 컨텍스트 제한을 넘지 않는지 테스트한다.
- 20개 평가 질문의 지표를 JSON 및 Markdown으로 저장한다.
- Hook을 끈 기준 작업과 켠 작업에서 제공된 근거의 차이를 비교한다.

## 완료 조건

- allowlist 문서가 로컬 SQLite FTS5에 색인된다.
- 사용자 요청에 상위 3개 근거와 파일 및 줄 번호가 자동 제공된다.
- 비밀 파일, 원본 로그, archived 문서가 검색되지 않는다.
- 평가 질문 20개에서 성공 기준을 충족한다.
- 컨텍스트 주입량과 검색 지연을 확인할 수 있다.
- 실제 DevChat 작업 한 건에서 검색 근거가 설계 판단에 사용된다.

## 이력서 표현 조건

단순 색인 구현만으로 품질 향상을 주장하지 않는다. 평가 기준과 실제 사용 사례가 생긴 뒤 다음처럼 표현한다.

> [초기안 기준 구현 및 평가를 실제로 완료한 뒤에만 사용] DevChat의 설계 및 성능 검증 문서를 SQLite FTS5로 색인하고 Codex UserPromptSubmit Hook과 연결해, 요청마다 관련 근거와 파일 위치를 제공하는 저장소 문맥 RAG를 구축했습니다. 20개 기준 질문으로 Hit@3와 근거 위치 완전성을 검증했습니다.
