"""Markdown chunks that retain their source file and inclusive line range."""

import hashlib
import re
from dataclasses import dataclass
from pathlib import Path
from typing import List, Sequence, Tuple

from corpus import CorpusDocument


HEADING_PATTERN = re.compile(r"^(#{1,6})\s+(.*?)\s*$")


@dataclass(frozen=True)
class Chunk:
    path: str
    heading: str
    start_line: int
    end_line: int
    content: str
    content_sha256: str


def _content_hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def _trimmed_end(lines: Sequence[str], start: int, end: int) -> int:
    while end > start and not lines[end - 1].strip():
        end -= 1
    return end


def _heading_path(lines: Sequence[str], index: int, headings: List[str]) -> str:
    match = HEADING_PATTERN.match(lines[index])
    if match is None:
        return ""
    level = len(match.group(1))
    headings[level - 1 :] = [match.group(2)]
    return " > ".join(part for part in headings if part)


def _make_chunk(document: CorpusDocument, heading: str, lines: Sequence[str], start: int, end: int) -> Chunk:
    content = "\n".join(lines[start:end])
    return Chunk(
        path=document.path,
        heading=heading,
        start_line=start + 1,
        end_line=end,
        content=content,
        content_sha256=_content_hash(content),
    )


def _split_oversized_chunk(chunk: Chunk, max_chars: int) -> List[Chunk]:
    if len(chunk.content) <= max_chars:
        return [chunk]
    return [
        Chunk(
            path=chunk.path,
            heading=chunk.heading,
            start_line=chunk.start_line,
            end_line=chunk.end_line,
            content=chunk.content[index : index + max_chars],
            content_sha256=_content_hash(chunk.content[index : index + max_chars]),
        )
        for index in range(0, len(chunk.content), max_chars)
    ]


def _split_section(
    document: CorpusDocument,
    heading: str,
    lines: Sequence[str],
    start: int,
    end: int,
    max_chars: int,
) -> List[Chunk]:
    if len("\n".join(lines[start:end])) <= max_chars:
        return [_make_chunk(document, heading, lines, start, end)]

    chunks = []
    chunk_start = start
    cursor = start
    while cursor < end:
        next_cursor = cursor + 1
        while next_cursor < end and lines[next_cursor].strip():
            next_cursor += 1
        paragraph_end = _trimmed_end(lines, cursor, next_cursor)
        candidate_end = paragraph_end
        if candidate_end > chunk_start and len("\n".join(lines[chunk_start:candidate_end])) > max_chars:
            chunks.append(_make_chunk(document, heading, lines, chunk_start, cursor))
            chunk_start = cursor
        cursor = next_cursor + 1 if next_cursor < end else end

    if chunk_start < end:
        chunks.append(_make_chunk(document, heading, lines, chunk_start, _trimmed_end(lines, chunk_start, end)))
    return [
        split
        for chunk in chunks
        if chunk.content
        for split in _split_oversized_chunk(chunk, max_chars)
    ]


def chunk_markdown(document: CorpusDocument, repo_root: Path, max_chars: int = 1000) -> List[Chunk]:
    """Split a tracked Markdown file at headings, preserving source line ranges."""
    if max_chars <= 0:
        raise ValueError("max_chars must be positive")
    lines = (repo_root / document.path).read_text(encoding="utf-8").splitlines()
    if not lines:
        return []

    section_starts = [index for index, line in enumerate(lines) if HEADING_PATTERN.match(line)]
    if not section_starts:
        section_starts = [0]

    chunks = []
    headings: List[str] = []
    for position, start in enumerate(section_starts):
        end = section_starts[position + 1] if position + 1 < len(section_starts) else len(lines)
        end = _trimmed_end(lines, start, end)
        if end <= start:
            continue
        heading = _heading_path(lines, start, headings) if HEADING_PATTERN.match(lines[start]) else ""
        chunks.extend(_split_section(document, heading, lines, start, end, max_chars))
    return chunks
