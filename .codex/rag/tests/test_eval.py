import importlib.util
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


REPO_ROOT = Path(__file__).resolve().parents[3]
EVAL_PATH = REPO_ROOT / "ai" / "rag" / "eval.py"
SPEC = importlib.util.spec_from_file_location("rag_eval", EVAL_PATH)
rag_eval = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(rag_eval)


class EvaluationCliTest(unittest.TestCase):
    def test_dense_mode_constructs_and_passes_the_embedder(self) -> None:
        embedder = object()
        with patch.object(rag_eval, "SentenceTransformerEmbedder", return_value=embedder), patch.object(
            rag_eval, "search_dense", return_value=[]
        ) as search_dense:
            rag_eval.evaluate(
                "dense",
                object(),
                [{"query": "없는 질문", "expected_paths": []}],
                "fake-model",
                0.78,
            )

        self.assertIs(search_dense.call_args.args[4], embedder)


if __name__ == "__main__":
    unittest.main()
