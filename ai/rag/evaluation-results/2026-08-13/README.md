# 2026-08-13 RAG 평가 기록

- corpus commit: `915aaf9`
- corpus: active Markdown 9개, chunk 123개
- 환경: macOS-26.5.1 arm64, CPU, `sentence-transformers==5.1.2`
- 질문: `ai/rag/eval-questions.json` 9개 (기대 문서 6개, no-result 3개)
- 선택: `intfloat/multilingual-e5-small`, `dense_min_score: 0.88`

| model | mode | Recall@3 | MRR | no-result precision | p50 / p95 ms |
| --- | --- | ---: | ---: | ---: | ---: |
| multilingual-e5-small | sparse | 0.3333 | 0.3333 | 1.0000 | 0.03 / 0.08 |
| multilingual-e5-small | dense | 0.8333 | 0.6389 | 1.0000 | 11.36 / 12.24 |
| multilingual-e5-small | hybrid | 0.8333 | 0.7222 | 1.0000 | 11.68 / 12.69 |
| multilingual-e5-base | sparse | 0.3333 | 0.3333 | 1.0000 | 0.03 / 0.34 |
| multilingual-e5-base | dense | 0.3333 | 0.2222 | 1.0000 | 22.99 / 23.58 |
| multilingual-e5-base | hybrid | 0.5000 | 0.3889 | 1.0000 | 23.24 / 23.72 |

같은 질문·임계값에서 base는 검색 품질을 높이지 못했고 지연시간은 약 두 배였다. 따라서 small을 유지했다. 이 수치는 9개 질문과 현재 corpus에만 해당하며, 문서·질문이 바뀌면 다시 평가한다.
