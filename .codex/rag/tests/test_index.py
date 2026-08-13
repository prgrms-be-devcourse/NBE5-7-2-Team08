import sys
import sqlite3
import tempfile
import unittest
from pathlib import Path


RAG_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAG_DIR))

from chunk_markdown import Chunk
from index import open_index, search_sparse, sync_chunks


def chunk(
    path: str,
    heading: str,
    start_line: int,
    end_line: int,
    content: str,
    content_offset: int = 0,
) -> Chunk:
    return Chunk(
        path=path,
        heading=heading,
        start_line=start_line,
        end_line=end_line,
        content=content,
        content_sha256=content,
        content_offset=content_offset,
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

    def test_sync_indexes_each_same_line_range_fragment(self) -> None:
        first = chunk("docs/a.md", "A", 1, 1, "first fragment", content_offset=0)
        second = chunk("docs/a.md", "A", 1, 1, "second fragment", content_offset=14)

        sync_chunks(self.connection, [first, second], "fake-model")

        self.assertEqual(
            [result.content for result in search_sparse(self.connection, "fragment", limit=3)],
            ["first fragment", "second fragment"],
        )

    def test_open_index_migrates_the_previous_line_range_unique_key(self) -> None:
        self.connection.close()
        self.index_path.unlink()
        legacy = sqlite3.connect(self.index_path)
        legacy.executescript(
            """
            CREATE TABLE chunks (
                id INTEGER PRIMARY KEY,
                path TEXT NOT NULL,
                heading TEXT NOT NULL,
                start_line INTEGER NOT NULL,
                end_line INTEGER NOT NULL,
                content TEXT NOT NULL,
                content_sha256 TEXT NOT NULL,
                embedding BLOB,
                embedding_model TEXT,
                UNIQUE(path, start_line, end_line)
            );
            INSERT INTO chunks(path, heading, start_line, end_line, content, content_sha256)
            VALUES ('docs/a.md', 'A', 1, 1, 'legacy fragment', 'hash');
            """
        )
        legacy.close()
        self.connection = open_index(self.index_path)

        columns = [row["name"] for row in self.connection.execute("PRAGMA table_info(chunks)")]
        self.assertIn("content_offset", columns)
        self.assertEqual(
            self.connection.execute("SELECT content_offset FROM chunks").fetchone()[0],
            0,
        )

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
