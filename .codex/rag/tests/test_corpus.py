import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


RAG_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAG_DIR))

from corpus import load_active_documents


def run_git(repo: Path, *args: str) -> None:
    subprocess.run(
        ["git", *args],
        cwd=repo,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )


class CorpusTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.repo = Path(self.temp_dir.name)
        run_git(self.repo, "init")
        run_git(self.repo, "config", "user.name", "RAG Test")
        run_git(self.repo, "config", "user.email", "rag@example.com")
        (self.repo / "AGENTS.md").write_text("# Rules\n", encoding="utf-8")
        (self.repo / "draft.md").write_text("# Draft\n", encoding="utf-8")
        (self.repo / "ai" / "logs").mkdir(parents=True)
        (self.repo / "ai" / "logs" / "session.jsonl").write_text("{}\n", encoding="utf-8")
        run_git(self.repo, "add", "AGENTS.md", "draft.md")
        run_git(self.repo, "commit", "-m", "baseline")
        self.manifest = self.repo / "corpus.json"

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_load_active_documents_filters_untracked_outside_and_non_active_paths(self) -> None:
        self.manifest.write_text(
            json.dumps(
                {
                    "documents": [
                        {"path": "AGENTS.md", "status": "active"},
                        {"path": "ai/logs/session.jsonl", "status": "active"},
                        {"path": "../secret.md", "status": "active"},
                        {"path": "draft.md", "status": "draft"},
                    ]
                }
            ),
            encoding="utf-8",
        )

        documents = load_active_documents(self.repo, self.manifest)

        self.assertEqual([document.path for document in documents], ["AGENTS.md"])

    def test_load_active_documents_rejects_excluded_directories_and_tracked_symlinks(self) -> None:
        (self.repo / "docs" / "superpowers" / "plans").mkdir(parents=True)
        (self.repo / "docs" / "local").mkdir(parents=True)
        (self.repo / "docs" / "superpowers" / "plans" / "plan.md").write_text("# Plan\n", encoding="utf-8")
        (self.repo / "docs" / "local" / "notes.md").write_text("# Notes\n", encoding="utf-8")
        (self.repo / "untracked.md").write_text("# Untracked\n", encoding="utf-8")
        (self.repo / "linked.md").symlink_to(self.repo / "untracked.md")
        run_git(self.repo, "add", "docs", "linked.md")
        run_git(self.repo, "commit", "-m", "add documents")
        self.manifest.write_text(
            json.dumps(
                {
                    "documents": [
                        {"path": "AGENTS.md", "status": "active"},
                        {"path": "docs/superpowers/plans/plan.md", "status": "active"},
                        {"path": "docs/local/notes.md", "status": "active"},
                        {"path": "linked.md", "status": "active"},
                    ]
                }
            ),
            encoding="utf-8",
        )

        documents = load_active_documents(self.repo, self.manifest)

        self.assertEqual([document.path for document in documents], ["AGENTS.md"])


if __name__ == "__main__":
    unittest.main()
