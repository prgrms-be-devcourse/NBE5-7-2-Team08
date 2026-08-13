import sys
import tempfile
import unittest
from pathlib import Path


RAG_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAG_DIR))

from chunk_markdown import chunk_markdown
from corpus import CorpusDocument


class ChunkMarkdownTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.repo = Path(self.temp_dir.name)

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_chunk_markdown_keeps_heading_and_inclusive_line_ranges(self) -> None:
        document = CorpusDocument(path="guide.md", status="active")
        (self.repo / document.path).write_text(
            "# 제목\n\n첫 문단\n\n## 세부\n둘째 문단\n",
            encoding="utf-8",
        )

        chunks = chunk_markdown(document, repo_root=self.repo, max_chars=20)

        self.assertEqual(
            [(chunk.heading, chunk.start_line, chunk.end_line) for chunk in chunks],
            [("제목", 1, 3), ("제목 > 세부", 5, 6)],
        )
        self.assertEqual([chunk.content for chunk in chunks], ["# 제목\n\n첫 문단", "## 세부\n둘째 문단"])

    def test_chunk_markdown_splits_a_single_long_paragraph_within_the_limit(self) -> None:
        document = CorpusDocument(path="guide.md", status="active")
        (self.repo / document.path).write_text("# 제목\n\n" + "가" * 30 + "\n", encoding="utf-8")

        chunks = chunk_markdown(document, repo_root=self.repo, max_chars=12)

        self.assertTrue(chunks)
        self.assertTrue(all(len(chunk.content) <= 12 for chunk in chunks))


if __name__ == "__main__":
    unittest.main()
