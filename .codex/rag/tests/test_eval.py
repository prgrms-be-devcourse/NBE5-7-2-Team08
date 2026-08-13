import importlib.util
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
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

    def test_measures_each_actual_hook_request_including_process_startup(self) -> None:
        repo_root = Path("/repo")
        with patch.object(
            rag_eval.subprocess,
            "run",
            return_value=SimpleNamespace(returncode=0, stdout="", stderr=""),
        ) as run, patch.object(rag_eval.time, "perf_counter", side_effect=[1.0, 1.012]):
            metrics = rag_eval.measure_hook_request_latencies(
                repo_root,
                [{"query": "JWT 정책", "expected_paths": []}],
                Path("/python"),
            )

        self.assertAlmostEqual(metrics["hook_p50_ms"], 12.0)
        self.assertAlmostEqual(metrics["hook_p95_ms"], 12.0)
        self.assertEqual(
            run.call_args.args[0],
            ["/python", "/repo/.codex/rag/run_user_prompt_rag.py"],
        )
        self.assertEqual(run.call_args.kwargs["input"], '{"prompt": "@rag JWT 정책", "cwd": "/repo"}')
        self.assertEqual(run.call_args.kwargs["cwd"], repo_root)


if __name__ == "__main__":
    unittest.main()
