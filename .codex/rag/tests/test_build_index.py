import sys
import unittest
from pathlib import Path
from unittest.mock import patch


RAG_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAG_DIR))

import build_index


class BuildIndexTest(unittest.TestCase):
    def test_parse_args_accepts_an_evaluation_model_override(self) -> None:
        with patch.object(
            sys,
            "argv",
            [
                "build_index.py",
                "--repo-root",
                "/repo",
                "--manifest",
                "corpus.json",
                "--index",
                "index.sqlite3",
                "--model",
                "intfloat/multilingual-e5-base",
            ],
        ):
            args = build_index.parse_args()

        self.assertEqual(args.model, "intfloat/multilingual-e5-base")


if __name__ == "__main__":
    unittest.main()
