"""Run the optional RAG runtime only when its virtual environment exists."""

import os
import subprocess
import sys
from pathlib import Path


def _repo_root() -> Path:
    completed = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
    )
    return Path(completed.stdout.strip())


def main() -> int:
    try:
        repo_root = _repo_root()
        rag_dir = repo_root / ".codex" / "rag"
        interpreter = rag_dir / ".venv" / "bin" / "python"
        entrypoint = rag_dir / "user_prompt_rag.py"
        if not interpreter.is_file() or not os.access(interpreter, os.X_OK) or not entrypoint.is_file():
            return 0
        subprocess.run(
            [str(interpreter), str(entrypoint)],
            stdin=sys.stdin.buffer,
            stdout=sys.stdout.buffer,
            stderr=subprocess.DEVNULL,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
