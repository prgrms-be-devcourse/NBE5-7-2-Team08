"""Codex UserPromptSubmit adapter for explicit @rag requests."""

import json
import sqlite3
import subprocess
import sys
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from search import SearchResult, format_context


def extract_rag_query(prompt: Any) -> Optional[str]:
    if not isinstance(prompt, str) or not prompt.startswith("@rag"):
        return None
    remainder = prompt[4:]
    if not remainder or not remainder[0].isspace():
        return None
    query = remainder.strip()
    return query or None


def build_hook_output(context: str) -> str:
    if not context:
        return ""
    return json.dumps(
        {
            "hookSpecificOutput": {
                "hookEventName": "UserPromptSubmit",
                "additionalContext": context,
            }
        },
        ensure_ascii=False,
    )


def run_payload(
    payload: Dict[str, Any],
    search: Callable[[str], List[SearchResult]],
) -> str:
    query = extract_rag_query(payload.get("prompt"))
    if query is None:
        return ""
    return build_hook_output(format_context(search(query)))


def _repo_root(cwd: str) -> Path:
    completed = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        cwd=cwd,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return Path(completed.stdout.strip()).resolve()


def _runtime_search(repo_root: Path, query: str) -> List[SearchResult]:
    from embedding import SentenceTransformerEmbedder
    from index import open_index
    from search import search_index

    manifest = json.loads((repo_root / "ai" / "rag" / "corpus.json").read_text(encoding="utf-8"))
    model_name = manifest.get("embedding_model")
    dense_min_score = manifest.get("dense_min_score")
    if not isinstance(model_name, str) or not isinstance(dense_min_score, (int, float)):
        return []

    index_path = repo_root / "ai" / "rag" / "index" / "devchat-context.sqlite3"
    if not index_path.is_file():
        return []
    connection = open_index(index_path)
    try:
        return search_index(
            connection,
            query,
            model_name,
            float(dense_min_score),
            SentenceTransformerEmbedder(model_name),
        )
    finally:
        connection.close()


def main() -> int:
    try:
        payload = json.load(sys.stdin)
        if not isinstance(payload, dict):
            return 0
        query = extract_rag_query(payload.get("prompt"))
        if query is None:
            return 0
        repo_root = _repo_root(str(payload.get("cwd") or Path.cwd()))
        output = run_payload(payload, lambda value: _runtime_search(repo_root, value))
        if output:
            print(output)
    except (OSError, ValueError, json.JSONDecodeError, RuntimeError, sqlite3.Error):
        return 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
