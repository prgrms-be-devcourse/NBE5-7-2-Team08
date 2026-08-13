# DevChat 저장소 문맥 RAG

`@rag <질문>`으로 시작한 Codex 요청에만 승인 문서의 검색 근거를 첨부한다. 일반 질문은 RAG 검색과 모델 로딩을 하지 않는다.

## 최초 설정과 index 갱신

```bash
python3 -m venv .codex/rag/.venv
.codex/rag/.venv/bin/pip install -r .codex/rag/requirements.txt
.codex/rag/.venv/bin/python .codex/rag/build_index.py \
  --repo-root "$PWD" \
  --manifest ai/rag/corpus.json \
  --index ai/rag/index/devchat-context.sqlite3
```

최초 index 생성은 `intfloat/multilingual-e5-small`을 로컬 cache에 내려받는다. 이후 RAG는 로컬 CPU와 SQLite index만 사용하며 OpenAI Embeddings API나 모델 다운로드를 호출하지 않는다. 문서를 바꾸거나 `corpus.json`을 수정한 뒤에는 index를 다시 생성한다.

## 사용

```text
@rag Blue/Green 배포가 실패했을 때 롤백 절차를 참고해 줘
```

검색 결과는 최대 3개이며 각 결과에 파일과 줄 번호를 붙인다. 문서 본문은 최대 1,200자이므로 해당 요청의 Codex 입력 토큰은 늘 수 있다. 결과가 없거나 index가 없으면 RAG는 컨텍스트를 첨부하지 않고 요청을 막지 않는다.

## 평가

```bash
.codex/rag/.venv/bin/python ai/rag/eval.py \
  --mode hybrid \
  --index ai/rag/index/devchat-context.sqlite3 \
  --questions ai/rag/eval-questions.json \
  --output-dir ai/rag/evaluation-results/local \
  --model intfloat/multilingual-e5-small \
  --dense-min-score 0.88
```

기록된 소규모 평가에서 E5-base는 회수율 개선 없이 E5-small보다 검색 지연시간이 약 두 배여서 small을 선택했다. 질문 세트·문서 구성이 바뀌면 다시 비교해야 한다.

`ai/rag/corpus.json`의 `active` 문서만 검색한다. 원본 AI 로그, Git 제외 파일, 비밀 파일과 `draft`·`superseded` 문서는 색인하지 않는다. `docs/superpowers/plans/`와 `docs/local/`도 현재 실행 근거가 아니므로 색인하지 않는다.

테스트를 통과한 코드 변경은 `docs/knowledge/changes/`에 지식 기록으로 남긴다. 새 기록은 `corpus.json`에 `active`로 명시하고 Git에 추적된 뒤 index를 다시 생성해야 검색된다.

검색 근거는 참고자료일 뿐 현재 코드나 운영 상태를 보장하지 않는다. Hook은 보안 경계가 아니며 Permission Guard를 대체하지 않는다.
