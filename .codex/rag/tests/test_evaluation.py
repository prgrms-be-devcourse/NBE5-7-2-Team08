import sys
import unittest
from pathlib import Path


RAG_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAG_DIR))

from evaluation import evaluate_questions
from search import SearchResult


class EvaluationTest(unittest.TestCase):
    def test_evaluator_reports_hit_mrr_no_result_and_citation_metrics(self) -> None:
        questions = [
            {"query": "known", "expected_paths": ["docs/a.md"]},
            {"query": "none", "expected_paths": []},
        ]

        def search(query: str):
            if query == "known":
                return [SearchResult("docs/a.md", "A", 1, 2, "content", 1.0)]
            return []

        metrics = evaluate_questions(search, questions)

        self.assertEqual(metrics["recall_at_3"], 1.0)
        self.assertEqual(metrics["mrr"], 1.0)
        self.assertEqual(metrics["no_result_precision"], 1.0)
        self.assertEqual(metrics["citation_completeness"], 1.0)


if __name__ == "__main__":
    unittest.main()
