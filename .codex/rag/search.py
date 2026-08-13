"""Hybrid sparse and dense retrieval with cited, size-limited context."""

from dataclasses import dataclass, replace
from math import sqrt
from sqlite3 import Connection
from typing import Dict, List, Sequence

from embedding import Embedder
from index import ScoredChunk, load_dense_chunks, search_sparse


@dataclass(frozen=True)
class SearchResult:
    path: str
    heading: str
    start_line: int
    end_line: int
    content: str
    rrf_score: float


def rrf_rank(sparse: Sequence[ScoredChunk], dense: Sequence[ScoredChunk], k: int = 60) -> List[ScoredChunk]:
    candidates: Dict[int, ScoredChunk] = {}
    scores: Dict[int, float] = {}
    for result_set in (sparse, dense):
        for item in result_set:
            candidates.setdefault(item.chunk_id, item)
            scores[item.chunk_id] = scores.get(item.chunk_id, 0.0) + 1.0 / (k + item.rank)

    ranked = [replace(candidates[chunk_id], score=score, rank=0) for chunk_id, score in scores.items()]
    return sorted(ranked, key=lambda item: (-item.score, item.path, item.start_line))


def search_hybrid(
    sparse: Sequence[ScoredChunk],
    dense: Sequence[ScoredChunk],
    dense_min_score: float,
) -> List[SearchResult]:
    eligible_dense = [item for item in dense if item.score >= dense_min_score]
    if not sparse and not eligible_dense:
        return []
    return [
        SearchResult(
            path=item.path,
            heading=item.heading,
            start_line=item.start_line,
            end_line=item.end_line,
            content=item.content,
            rrf_score=item.score,
        )
        for item in rrf_rank(sparse, eligible_dense)[:3]
    ]


def _cosine(left: Sequence[float], right: Sequence[float]) -> float:
    if not left or len(left) != len(right):
        return 0.0
    denominator = sqrt(sum(value * value for value in left)) * sqrt(sum(value * value for value in right))
    return sum(a * b for a, b in zip(left, right)) / denominator if denominator else 0.0


def search_index(
    connection: Connection,
    query: str,
    model_name: str,
    dense_min_score: float,
    embedder: Embedder,
) -> List[SearchResult]:
    sparse = search_sparse(connection, query, limit=12)
    dense = _dense_candidates(connection, query, model_name, embedder)
    return search_hybrid(sparse, dense, dense_min_score)


def search_dense(
    connection: Connection,
    query: str,
    model_name: str,
    dense_min_score: float,
    embedder: Embedder,
) -> List[SearchResult]:
    dense = [item for item in _dense_candidates(connection, query, model_name, embedder) if item.score >= dense_min_score]
    return [
        SearchResult(item.path, item.heading, item.start_line, item.end_line, item.content, item.score)
        for item in dense[:3]
    ]


def _dense_candidates(
    connection: Connection,
    query: str,
    model_name: str,
    embedder: Embedder,
) -> List[ScoredChunk]:
    query_embedding = embedder.embed_query(query)
    dense = [
        replace(item, score=_cosine(query_embedding, item.embedding or []), rank=index)
        for index, item in enumerate(load_dense_chunks(connection, model_name), start=1)
    ]
    dense.sort(key=lambda item: (-item.score, item.path, item.start_line))
    return [replace(item, rank=index) for index, item in enumerate(dense, start=1)]


def _merge_adjacent(results: Sequence[SearchResult]) -> List[SearchResult]:
    merged: List[SearchResult] = []
    for result in results:
        candidate = result
        insert_at = None
        index = 0
        while index < len(merged):
            previous = merged[index]
            if previous.path != candidate.path or not (
                previous.end_line + 1 == candidate.start_line
                or candidate.end_line + 1 == previous.start_line
            ):
                index += 1
                continue
            if candidate.start_line < previous.start_line:
                earlier, later = candidate, previous
            else:
                earlier, later = previous, candidate
            candidate = SearchResult(
                path=previous.path,
                heading=previous.heading,
                start_line=earlier.start_line,
                end_line=max(previous.end_line, candidate.end_line),
                content=earlier.content + "\n" + later.content,
                rrf_score=previous.rrf_score,
            )
            insert_at = index if insert_at is None else min(insert_at, index)
            del merged[index]
        if insert_at is None:
            merged.append(candidate)
        else:
            merged.insert(insert_at, candidate)
    return merged


def format_context(results: Sequence[SearchResult], max_chars: int = 1200) -> str:
    if max_chars <= 0:
        return ""
    selected: List[SearchResult] = []
    used_chars = 0
    for result in _merge_adjacent(results):
        if len(result.content) <= max_chars - used_chars:
            selected.append(result)
            used_chars += len(result.content)
    if not selected:
        return ""

    lines = ["DevChat 저장소 근거:"]
    for index, result in enumerate(selected, start=1):
        lines.extend(
            [
                "{}. {}:{}-{} | {}".format(
                    index,
                    result.path,
                    result.start_line,
                    result.end_line,
                    result.heading,
                ),
                result.content,
            ]
        )
    return "\n".join(lines)
