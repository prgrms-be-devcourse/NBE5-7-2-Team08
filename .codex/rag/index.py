"""SQLite FTS5 storage for line-cited DevChat RAG chunks."""

import array
import re
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from chunk_markdown import Chunk


TOKEN_PATTERN = re.compile(r"[0-9A-Za-z가-힣_]+")


@dataclass(frozen=True)
class ScoredChunk:
    chunk_id: int
    path: str
    heading: str
    start_line: int
    end_line: int
    content: str
    score: float
    rank: int
    embedding: Optional[List[float]] = None


def open_index(path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(str(path))
    connection.row_factory = sqlite3.Row
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS chunks (
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
        CREATE TABLE IF NOT EXISTS metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts
        USING fts5(content, heading, content='chunks', content_rowid='id');
        """
    )
    return connection


def _existing_chunks(connection: sqlite3.Connection) -> Dict[Tuple[str, int, int], sqlite3.Row]:
    rows = connection.execute(
        "SELECT id, path, start_line, end_line, heading, content_sha256 FROM chunks"
    ).fetchall()
    return {(row["path"], row["start_line"], row["end_line"]): row for row in rows}


def _rebuild_fts(connection: sqlite3.Connection) -> None:
    connection.execute("INSERT INTO chunks_fts(chunks_fts) VALUES('rebuild')")


def sync_chunks(connection: sqlite3.Connection, chunks: List[Chunk], model_name: str) -> None:
    """Synchronize source chunks while preserving unchanged row identifiers."""
    existing = _existing_chunks(connection)
    incoming = {(chunk.path, chunk.start_line, chunk.end_line): chunk for chunk in chunks}
    selected_model = connection.execute(
        "SELECT value FROM metadata WHERE key = 'embedding_model'"
    ).fetchone()

    if selected_model is not None and selected_model["value"] != model_name:
        connection.execute("UPDATE chunks SET embedding = NULL, embedding_model = NULL")
    connection.execute(
        "INSERT OR REPLACE INTO metadata(key, value) VALUES('embedding_model', ?)",
        (model_name,),
    )

    for key, row in existing.items():
        if key not in incoming:
            connection.execute("DELETE FROM chunks WHERE id = ?", (row["id"],))

    for key, chunk in incoming.items():
        row = existing.get(key)
        if row is None:
            connection.execute(
                """
                INSERT INTO chunks(path, heading, start_line, end_line, content, content_sha256)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    chunk.path,
                    chunk.heading,
                    chunk.start_line,
                    chunk.end_line,
                    chunk.content,
                    chunk.content_sha256,
                ),
            )
        elif row["heading"] != chunk.heading or row["content_sha256"] != chunk.content_sha256:
            connection.execute(
                """
                UPDATE chunks
                SET heading = ?, content = ?, content_sha256 = ?, embedding = NULL, embedding_model = NULL
                WHERE id = ?
                """,
                (chunk.heading, chunk.content, chunk.content_sha256, row["id"]),
            )
    _rebuild_fts(connection)


def pack_embedding(values: List[float]) -> bytes:
    if not values:
        raise ValueError("embedding must not be empty")
    return array.array("f", values).tobytes()


def unpack_embedding(value: bytes) -> List[float]:
    values = array.array("f")
    values.frombytes(value)
    return list(values)


def store_embeddings(
    connection: sqlite3.Connection,
    chunks: List[Chunk],
    embeddings: List[List[float]],
    model_name: str,
) -> None:
    if len(chunks) != len(embeddings) or not embeddings:
        raise ValueError("chunk and embedding counts must match")
    dimension = len(embeddings[0])
    if dimension == 0 or any(len(embedding) != dimension for embedding in embeddings):
        raise ValueError("embedding dimensions must match")

    for chunk, embedding in zip(chunks, embeddings):
        row = connection.execute(
            "SELECT id FROM chunks WHERE path = ? AND start_line = ? AND end_line = ?",
            (chunk.path, chunk.start_line, chunk.end_line),
        ).fetchone()
        if row is None:
            raise ValueError("chunk was not indexed")
        connection.execute(
            "UPDATE chunks SET embedding = ?, embedding_model = ? WHERE id = ?",
            (pack_embedding(embedding), model_name, row["id"]),
        )


def load_dense_chunks(connection: sqlite3.Connection, model_name: str) -> List[ScoredChunk]:
    rows = connection.execute(
        """
        SELECT id, path, heading, start_line, end_line, content, embedding
        FROM chunks
        WHERE embedding_model = ? AND embedding IS NOT NULL
        ORDER BY path, start_line
        """,
        (model_name,),
    ).fetchall()
    return [
        ScoredChunk(
            chunk_id=row["id"],
            path=row["path"],
            heading=row["heading"],
            start_line=row["start_line"],
            end_line=row["end_line"],
            content=row["content"],
            score=0.0,
            rank=index,
            embedding=unpack_embedding(row["embedding"]),
        )
        for index, row in enumerate(rows, start=1)
    ]


def _fts_query(query: str) -> str:
    tokens = TOKEN_PATTERN.findall(query)
    return " AND ".join('"{}"'.format(token) for token in tokens)


def search_sparse(connection: sqlite3.Connection, query: str, limit: int) -> List[ScoredChunk]:
    expression = _fts_query(query)
    if not expression or limit <= 0:
        return []
    try:
        rows = connection.execute(
            """
            SELECT chunks.id, chunks.path, chunks.heading, chunks.start_line, chunks.end_line,
                   chunks.content, bm25(chunks_fts) AS score
            FROM chunks_fts
            JOIN chunks ON chunks.id = chunks_fts.rowid
            WHERE chunks_fts MATCH ?
            ORDER BY score, chunks.path, chunks.start_line
            LIMIT ?
            """,
            (expression, limit),
        ).fetchall()
    except sqlite3.Error:
        return []
    return [
        ScoredChunk(
            chunk_id=row["id"],
            path=row["path"],
            heading=row["heading"],
            start_line=row["start_line"],
            end_line=row["end_line"],
            content=row["content"],
            score=float(row["score"]),
            rank=index,
        )
        for index, row in enumerate(rows, start=1)
    ]
