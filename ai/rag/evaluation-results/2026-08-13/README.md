# 2026-08-13 RAG 평가 기록

- corpus: active Markdown 12개, chunk 144개
- 환경: macOS-26.5.1 arm64, CPU, `sentence-transformers==5.1.2`
- 질문: `ai/rag/eval-questions.json` 9개 (기대 문서 6개, no-result 3개)
- 측정: 모델별 index를 같은 final corpus에서 다시 생성했다. `p50_ms`·`p95_ms`는 매 질의 모델 로딩을 포함한 검색 시간이다.
- 선택: `intfloat/multilingual-e5-small`, `dense_min_score: 0.88`

| model | mode | Recall@3 | MRR | no-result precision | search p50 / p95 ms |
| --- | --- | ---: | ---: | ---: | ---: |
| multilingual-e5-small | sparse | 0.3333 | 0.3333 | 1.0000 | 0.03 / 0.08 |
| multilingual-e5-small | dense | 0.6667 | 0.5000 | 1.0000 | 516.50 / 587.50 |
| multilingual-e5-small | hybrid | 0.6667 | 0.5000 | 1.0000 | 516.12 / 587.70 |
| multilingual-e5-base | sparse | 0.3333 | 0.3333 | 1.0000 | 0.03 / 0.08 |
| multilingual-e5-base | dense | 0.1667 | 0.1667 | 1.0000 | 569.51 / 633.73 |
| multilingual-e5-base | hybrid | 0.3333 | 0.3333 | 1.0000 | 570.05 / 638.39 |

선택된 small/hybrid의 실제 Hook 요청은 별도 Python 프로세스로 래퍼부터 실행해 p50 3045.45 ms, p95 3067.43 ms를 기록했다. 이 수치는 search p50/p95와 다른 one-shot 요청 수명주기 측정이며, 이 환경의 30초 Hook timeout 안에 있다.

같은 final corpus·질문·임계값에서 base는 small보다 검색 품질을 높이지 못했고 검색 시간도 더 길었다. 따라서 small을 유지했다. 이 수치는 위 환경과 corpus에만 해당하며, 문서·질문이 바뀌면 final corpus로 다시 평가한다.
