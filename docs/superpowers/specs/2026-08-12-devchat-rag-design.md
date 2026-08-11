# DevChat Hybrid RAG Design

## 목표

사용자 요청이 들어올 때 DevChat의 현재 문서에서 관련 근거를 찾아 Codex에 짧은 컨텍스트로 제공한다. 검색 결과에는 파일과 줄 번호를 포함하며 관련도가 낮으면 아무 문서도 제공하지 않는다.

## 선행 조건과 문서 집합

`AGENTS.md`를 우선 인덱싱한다. 자동 glob 대신 `ai/rag/corpus.json`에 승인된 문서를 명시한다.

우선 문서 후보:

- `AGENTS.md`, 루트 및 구성요소 README
- 현재 상태가 승인된 설계·의사결정 문서
- 성능 실험의 조건과 결과 요약
- Blue/Green 배포·롤백 Runbook
- 구현이 확정된 알림 전달 신뢰성 문서

오래된 인증 토큰 문서는 제외한다. 구현 전 초안과 모든 계획 문서를 무조건 인덱싱하지 않는다. 문서는 `active`, `draft`, `superseded` 상태를 갖고 `active`만 기본 검색 대상이 된다.

## 검색 구조

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
- RRF는 점수 척도가 다른 두 순위를 순위 기반으로 합친다.
- RRF는 항상 순위를 만들기 때문에, 결합 전에 lexical 근거와 corpus 평가로 보정한 cosine threshold를 사용해 no-result를 판정한다.
- 동일 문서의 인접 chunk는 합치고 중복 인용을 제거한다.

## 임베딩 모델

기본 후보는 `intfloat/multilingual-e5-small`과 `intfloat/multilingual-e5-base`다. 같은 DevChat 질문 세트로 정확도, no-result 오탐과 지연시간을 비교한다. `base`가 실제 corpus에서 개선을 보일 때만 채택한다.

`BGE-M3`는 dense/sparse/long-context 기능이 강하지만 현재 FTS5와 기능이 겹치고 작은 chunk corpus에는 운영 복잡도가 크므로 초기 범위에서 제외한다.

모델은 로컬 CPU에서 실행하며 최초 다운로드 이후 OpenAI 임베딩 API 토큰을 사용하지 않는다. RAG 결과가 `additionalContext`로 들어갈 때만 Codex 입력 토큰이 증가한다.

## 출력 제한

- 최종 Top 3
- 전체 문서 본문 최대 1,200자, 인용 표기는 별도
- 관련도 미달이면 0개
- 각 결과에 `path:start_line-end_line` 필수
- 프롬프트 원문, 비밀 파일과 Git 제외 파일은 인덱싱하지 않음

## 평가

CLI는 `--mode sparse|dense|hybrid`를 제공하고 같은 질문으로 세 모드를 비교한다. 실제 Hook은 검증 후 `hybrid`를 사용한다.

평가 집합은 다음을 포함한다.

- 정확한 파일·설정 키를 요구하는 질문
- 한국어 의미 검색 질문
- 두 문서의 근거가 필요한 질문
- 답이 corpus에 없어 0개가 나와야 하는 음성 질문

고정된 `20개`, `Hit@3 0.80`을 먼저 성공 기준으로 선언하지 않는다. Recall@3, MRR, no-result precision, p50/p95 지연시간을 실제 baseline과 함께 보고한다. Hybrid는 핵심 exact lookup을 퇴행시키지 않으면서 sparse 또는 dense 단독의 누락을 줄일 때 채택한다.

## 구현 단계

1. corpus manifest와 chunk/line citation 계약
2. FTS5 sparse index와 평가 CLI
3. small/base 임베딩 index와 모델 비교
4. RRF, no-result gate와 인접 chunk 병합
5. 세 모드 평가 결과 기록
6. `UserPromptSubmit` Hook 연결과 1,200자 제한 검증

Logging Hook 실제 턴과 Permission Guard 설계를 먼저 검증한 뒤 별도 구현 계획을 작성한다.
