"""Validated allowlist loading for the DevChat RAG corpus."""

import json
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, List, Optional


@dataclass(frozen=True)
class CorpusDocument:
    path: str
    status: str


def _is_tracked(repo_root: Path, path: str) -> bool:
    completed = subprocess.run(
        ["git", "ls-files", "--error-unmatch", "--", path],
        cwd=repo_root,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return completed.returncode == 0


def _active_document(repo_root: Path, item: Any) -> Optional[CorpusDocument]:
    if not isinstance(item, dict) or item.get("status") != "active":
        return None
    value = item.get("path")
    if not isinstance(value, str) or not value:
        return None

    path = Path(value)
    if path.is_absolute() or ".." in path.parts or path.suffix != ".md":
        return None
    if path.parts[:2] == ("ai", "logs"):
        return None

    try:
        resolved = (repo_root / path).resolve()
        resolved.relative_to(repo_root.resolve())
    except ValueError:
        return None

    normalized = path.as_posix()
    if not resolved.is_file() or not _is_tracked(repo_root, normalized):
        return None
    return CorpusDocument(path=normalized, status="active")


def load_active_documents(repo_root: Path, manifest_path: Path) -> List[CorpusDocument]:
    """Return the manifest's safe, tracked, active Markdown documents."""
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or not isinstance(payload.get("documents"), list):
        raise ValueError("invalid corpus manifest")

    documents = []
    for item in payload["documents"]:
        document = _active_document(repo_root, item)
        if document is not None:
            documents.append(document)
    return documents
