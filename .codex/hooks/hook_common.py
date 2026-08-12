"""Shared filesystem and Git helpers for DevChat Codex hooks."""

import json
import subprocess
from pathlib import Path
from typing import Any, Dict


def find_repo_root(cwd: str) -> Path:
    completed = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        cwd=cwd,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return Path(completed.stdout.strip()).resolve()


def _git(repo_root: Path, *args: str) -> str:
    completed = subprocess.run(
        ["git", *args],
        cwd=repo_root,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return completed.stdout.rstrip("\r\n")


def git_snapshot(repo_root: Path) -> Dict[str, Any]:
    try:
        base_commit = _git(repo_root, "rev-parse", "HEAD") or None
        branch = _git(repo_root, "branch", "--show-current") or None
        status = _git(
            repo_root,
            "status",
            "--porcelain=v1",
            "--untracked-files=all",
        )
        dirty_files = []
        for line in status.splitlines():
            path = line[3:] if len(line) >= 4 else line
            if " -> " in path:
                path = path.split(" -> ", 1)[1]
            dirty_files.append(path.strip('"'))
        return {
            "base_commit": base_commit,
            "branch": branch,
            "dirty_files": sorted(dirty_files),
        }
    except (OSError, subprocess.SubprocessError) as error:
        return {
            "base_commit": None,
            "branch": None,
            "dirty_files": [],
            "git_error": type(error).__name__,
        }


def stable_json(value: Any) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
