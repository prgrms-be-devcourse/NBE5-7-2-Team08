import json
import os
import subprocess
import sys
import unittest
from pathlib import Path


RAG_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAG_DIR))

from search import SearchResult
from user_prompt_rag import run_payload


class FakeSearch:
    def __init__(self) -> None:
        self.queries = []

    def __call__(self, query: str):
        self.queries.append(query)
        return [
            SearchResult(
                path="docs/auth.md",
                heading="JWT",
                start_line=10,
                end_line=12,
                content="JWT 만료 정책",
                rrf_score=1.0,
            )
        ]


class EmptySearch:
    def __call__(self, query: str):
        return []


class UserPromptRagTest(unittest.TestCase):
    def test_entrypoint_plain_prompt_has_no_stdout(self) -> None:
        result = subprocess.run(
            [sys.executable, str(RAG_DIR / "user_prompt_rag.py")],
            input=json.dumps({"prompt": "일반 질문", "cwd": str(RAG_DIR)}),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"},
        )

        self.assertEqual((result.returncode, result.stdout, result.stderr), (0, "", ""))

    def test_entrypoint_unavailable_runtime_has_no_stdout(self) -> None:
        result = subprocess.run(
            [sys.executable, str(RAG_DIR / "user_prompt_rag.py")],
            input=json.dumps({"prompt": "@rag JWT", "cwd": str(RAG_DIR.parents[1])}),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"},
        )

        self.assertEqual((result.returncode, result.stdout, result.stderr), (0, "", ""))

    def test_non_rag_prompt_skips_search_and_returns_empty_output(self) -> None:
        search = FakeSearch()

        output = run_payload({"prompt": "DM 테스트를 고쳐줘"}, search)

        self.assertEqual(output, "")
        self.assertEqual(search.queries, [])

    def test_rag_prompt_strips_marker_and_returns_user_prompt_context(self) -> None:
        search = FakeSearch()

        output = run_payload({"prompt": "@rag JWT 만료 정책"}, search)

        self.assertEqual(search.queries, ["JWT 만료 정책"])
        hook_output = json.loads(output)["hookSpecificOutput"]
        self.assertEqual(hook_output["hookEventName"], "UserPromptSubmit")
        self.assertIn("docs/auth.md:10-12", hook_output["additionalContext"])

    def test_rag_prompt_without_results_returns_empty_output(self) -> None:
        output = run_payload({"prompt": "@rag 존재하지 않는 문서"}, EmptySearch())

        self.assertEqual(output, "")


if __name__ == "__main__":
    unittest.main()
