"""Deterministic retrieval quality metrics for the approved RAG question set."""

from typing import Callable, Dict, List, Sequence

from search import SearchResult


def evaluate_questions(
    search: Callable[[str], Sequence[SearchResult]],
    questions: Sequence[Dict[str, object]],
) -> Dict[str, float]:
    hit_questions = 0
    reciprocal_ranks: List[float] = []
    no_result_questions = 0
    correct_no_results = 0
    returned_results: List[SearchResult] = []

    for question in questions:
        query = question.get("query")
        expected_paths = question.get("expected_paths")
        if not isinstance(query, str) or not isinstance(expected_paths, list):
            raise ValueError("invalid evaluation question")
        expected = {path for path in expected_paths if isinstance(path, str)}
        results = list(search(query))
        returned_results.extend(results)
        if not expected:
            no_result_questions += 1
            if not results:
                correct_no_results += 1
            continue

        first_match = next(
            (index for index, result in enumerate(results[:3], start=1) if result.path in expected),
            None,
        )
        if first_match is not None:
            hit_questions += 1
            reciprocal_ranks.append(1.0 / first_match)
        else:
            reciprocal_ranks.append(0.0)

    positive_questions = len(questions) - no_result_questions
    complete_citations = sum(
        1
        for result in returned_results
        if result.path and result.start_line > 0 and result.end_line >= result.start_line
    )
    return {
        "recall_at_3": hit_questions / positive_questions if positive_questions else 0.0,
        "mrr": sum(reciprocal_ranks) / positive_questions if positive_questions else 0.0,
        "no_result_precision": correct_no_results / no_result_questions if no_result_questions else 0.0,
        "citation_completeness": complete_citations / len(returned_results) if returned_results else 1.0,
    }
