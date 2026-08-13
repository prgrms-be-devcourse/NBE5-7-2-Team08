"""Run a repeatable local retrieval evaluation against an existing RAG index."""

import argparse
import json
import platform
import sys
import time
from pathlib import Path
from typing import Callable, Dict, List, Sequence


REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / ".codex" / "rag"))

from embedding import SentenceTransformerEmbedder
from evaluation import evaluate_questions
from index import ScoredChunk, open_index, search_sparse
from search import SearchResult, search_dense, search_index


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate the local DevChat RAG index")
    parser.add_argument("--mode", choices=("sparse", "dense", "hybrid"), required=True)
    parser.add_argument("--index", type=Path, required=True)
    parser.add_argument("--questions", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--dense-min-score", type=float, required=True)
    return parser.parse_args()


def _as_result(chunk: ScoredChunk) -> SearchResult:
    return SearchResult(
        path=chunk.path,
        heading=chunk.heading,
        start_line=chunk.start_line,
        end_line=chunk.end_line,
        content=chunk.content,
        rrf_score=chunk.score,
    )


def _percentile(values: Sequence[float], percentile: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, int((len(ordered) - 1) * percentile))
    return ordered[index]


def evaluate(
    mode: str,
    connection: object,
    questions: Sequence[Dict[str, object]],
    model_name: str,
    dense_min_score: float,
) -> Dict[str, float]:
    embedder = SentenceTransformerEmbedder(model_name) if mode in ("dense", "hybrid") else None
    latencies_ms: List[float] = []

    def search(query: str) -> List[SearchResult]:
        started = time.perf_counter()
        try:
            if mode == "sparse":
                return [_as_result(item) for item in search_sparse(connection, query, limit=3)]
            if mode == "dense":
                return search_dense(connection, query, model_name, dense_min_score, embedder)
            return search_index(connection, query, model_name, dense_min_score, embedder)
        finally:
            latencies_ms.append((time.perf_counter() - started) * 1000)

    metrics = evaluate_questions(search, questions)
    metrics["p50_ms"] = _percentile(latencies_ms, 0.50)
    metrics["p95_ms"] = _percentile(latencies_ms, 0.95)
    return metrics


def main() -> int:
    args = parse_args()
    questions = json.loads(args.questions.read_text(encoding="utf-8"))
    if not isinstance(questions, list):
        raise ValueError("questions must be a JSON list")

    connection = open_index(args.index)
    try:
        metrics = evaluate(
            args.mode,
            connection,
            questions,
            args.model,
            args.dense_min_score,
        )
    finally:
        connection.close()

    result = {
        "mode": args.mode,
        "model": args.model,
        "dense_min_score": args.dense_min_score,
        "index": str(args.index),
        "question_count": len(questions),
        "platform": platform.platform(),
        "metrics": metrics,
    }
    args.output_dir.mkdir(parents=True, exist_ok=True)
    json_path = args.output_dir / (args.mode + ".json")
    markdown_path = args.output_dir / (args.mode + ".md")
    json_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    markdown_path.write_text(
        "# RAG {} evaluation\n\n".format(args.mode)
        + "- model: `{}`\n".format(args.model)
        + "- dense_min_score: {}\n".format(args.dense_min_score)
        + "- questions: {}\n".format(len(questions))
        + "- platform: {}\n\n".format(result["platform"])
        + "| metric | value |\n| --- | ---: |\n"
        + "".join("| {} | {:.4f} |\n".format(name, value) for name, value in metrics.items()),
        encoding="utf-8",
    )
    print(json_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
