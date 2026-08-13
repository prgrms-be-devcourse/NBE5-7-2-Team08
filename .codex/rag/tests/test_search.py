import sys
import unittest
from pathlib import Path


RAG_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAG_DIR))

from index import ScoredChunk
from search import SearchResult, format_context, rrf_rank, search_hybrid


def scored(path: str, chunk_id: int, rank: int, score: float = 1.0) -> ScoredChunk:
    return ScoredChunk(
        chunk_id=chunk_id,
        path=path,
        heading="Heading",
        start_line=10,
        end_line=12,
        content=path,
        score=score,
        rank=rank,
    )


def result(path: str, start_line: int, end_line: int, content: str) -> SearchResult:
    return SearchResult(
        path=path,
        heading="Heading",
        start_line=start_line,
        end_line=end_line,
        content=content,
        rrf_score=1.0,
    )


class SearchTest(unittest.TestCase):
    def test_rrf_sorts_equal_rank_agreement_by_path(self) -> None:
        merged = rrf_rank(
            [scored("jwt.md", 1, 1), scored("other.md", 2, 2)],
            [scored("other.md", 2, 1), scored("jwt.md", 1, 2)],
        )

        self.assertEqual([item.path for item in merged], ["jwt.md", "other.md"])

    def test_hybrid_returns_no_result_when_all_dense_candidates_are_below_gate(self) -> None:
        results = search_hybrid(
            sparse=[],
            dense=[scored("guide.md", 1, 1, score=0.42)],
            dense_min_score=0.78,
        )

        self.assertEqual(results, [])

    def test_context_merges_adjacent_chunks_within_body_budget(self) -> None:
        context = format_context(
            [
                result("guide.md", 10, 12, "가" * 500),
                result("guide.md", 13, 15, "나" * 500),
            ],
            max_chars=1200,
        )

        self.assertIn("guide.md:10-15", context)
        self.assertIn("가" * 500 + "\n" + "나" * 500, context)

    def test_context_does_not_merge_a_later_result_with_an_earlier_line_range(self) -> None:
        context = format_context(
            [
                result("guide.md", 100, 102, "later section"),
                result("guide.md", 1, 3, "earlier section"),
            ]
        )

        self.assertIn("guide.md:100-102", context)
        self.assertIn("guide.md:1-3", context)


if __name__ == "__main__":
    unittest.main()
