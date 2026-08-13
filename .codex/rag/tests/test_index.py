import sys
import tempfile
import unittest
from pathlib import Path


RAG_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAG_DIR))

from chunk_markdown import Chunk
from index import open_index, search_sparse, sync_chunks


def chunk(path: str, heading: str, start_line: int, end_line: int, content: str) -> Chunk:
    return Chunk(
        path=path,
        heading=heading,
        start_line=start_line,
        end_line=end_line,
        content=content,
        content_sha256=content,
    )


class IndexTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.index_path = Path(self.temp_dir.name) / "context.sqlite3"
        self.connection = open_index(self.index_path)

    def tearDown(self) -> None:
        self.connection.close()
        self.temp_dir.cleanup()

    def test_sparse_search_returns_exact_identifier_with_citation(self) -> None:
        sync_chunks(
            self.connection,
            [
                chunk("docs/auth.md", "JWT", 10, 14, "jwt_refresh_token rotation"),
                chunk("docs/other.md", "Other", 1, 2, "refresh process"),
            ],
            "fake-model",
        )

        results = search_sparse(self.connection, "jwt_refresh_token", limit=3)

        self.assertEqual(results[0].path, "docs/auth.md")
        self.assertEqual((results[0].start_line, results[0].end_line), (10, 14))

    def test_sparse_search_requires_every_query_term(self) -> None:
        sync_chunks(
            self.connection,
            [
                chunk("docs/auth.md", "JWT", 10, 14, "jwt refresh rotation"),
                chunk("docs/other.md", "Other", 1, 2, "refresh process"),
            ],
            "fake-model",
        )

        results = search_sparse(self.connection, "jwt absent_term", limit=3)

        self.assertEqual(results, [])

    def test_sync_removes_deleted_chunks_and_keeps_unchanged_chunk_id(self) -> None:
        original = chunk("docs/a.md", "A", 1, 2, "stable content")
        sync_chunks(self.connection, [original], "fake-model")
        first_id = self.connection.execute("SELECT id FROM chunks").fetchone()[0]

        sync_chunks(self.connection, [original], "fake-model")

        self.assertEqual(
            self.connection.execute("SELECT id FROM chunks").fetchone()[0], first_id
        )

        sync_chunks(self.connection, [], "fake-model")

        self.assertEqual(self.connection.execute("SELECT COUNT(*) FROM chunks").fetchone()[0], 0)


if __name__ == "__main__":
    unittest.main()
