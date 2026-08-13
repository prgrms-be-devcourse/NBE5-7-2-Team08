"""Explicitly build the local SQLite RAG index from the approved corpus."""

import argparse
import json
from pathlib import Path

from chunk_markdown import chunk_markdown
from corpus import load_active_documents
from embedding import SentenceTransformerEmbedder
from index import open_index, store_embeddings, sync_chunks


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the DevChat local RAG index")
    parser.add_argument("--repo-root", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--index", type=Path, required=True)
    parser.add_argument("--model")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = args.repo_root.resolve()
    index_path = args.index.resolve()
    try:
        index_path.relative_to(repo_root)
    except ValueError:
        raise ValueError("index path must be inside the repository")

    manifest_path = (repo_root / args.manifest).resolve() if not args.manifest.is_absolute() else args.manifest
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    model_name = args.model or (manifest.get("embedding_model") if isinstance(manifest, dict) else None)
    if not isinstance(model_name, str) or not model_name:
        raise ValueError("manifest embedding_model is required")

    documents = load_active_documents(repo_root, manifest_path)
    chunks = [
        chunk
        for document in documents
        for chunk in chunk_markdown(document, repo_root=repo_root)
    ]
    index_path.parent.mkdir(parents=True, exist_ok=True)
    connection = open_index(index_path)
    try:
        embedder = SentenceTransformerEmbedder(model_name, allow_download=True)
        with connection:
            sync_chunks(connection, chunks, model_name)
            store_embeddings(
                connection,
                chunks,
                embedder.embed_passages([chunk.content for chunk in chunks]),
                model_name,
            )
    finally:
        connection.close()
    print("indexed {} documents and {} chunks".format(len(documents), len(chunks)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
