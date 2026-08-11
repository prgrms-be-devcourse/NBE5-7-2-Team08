"""Record redacted Codex hook events in a local JSONL file."""

import fcntl
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

from hook_common import find_repo_root, git_snapshot, stable_json
from redact_ai_log import redacted_preview, sha256_text


SAFE_SESSION_PATTERN = re.compile(r"[^A-Za-z0-9._-]")


def _timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def _response_succeeded(response: Any) -> bool:
    if not isinstance(response, dict):
        return True
    if isinstance(response.get("exit_code"), int):
        return response["exit_code"] == 0
    if "isError" in response:
        return not bool(response["isError"])
    return "error" not in response


def safe_session_filename(session_id: str) -> str:
    safe_prefix = SAFE_SESSION_PATTERN.sub("_", session_id)[:48].strip("._")
    if not safe_prefix:
        safe_prefix = "session"
    return f"{safe_prefix}-{sha256_text(session_id)[:16]}.jsonl"


def normalize_event(payload: Dict[str, Any], repo_root: Path) -> Dict[str, Any]:
    event_name = str(payload.get("hook_event_name", "Unknown"))
    event = {
        "event": event_name,
        "timestamp": _timestamp(),
        "session_id": str(payload.get("session_id", "unknown")),
        "turn_id": str(payload.get("turn_id", "unknown")),
    }

    if event_name == "UserPromptSubmit":
        prompt = str(payload.get("prompt", ""))
        event.update(
            {
                "prompt_preview": redacted_preview(prompt),
                "prompt_length": len(prompt),
                "prompt_sha256": sha256_text(prompt),
            }
        )

    if event_name in {"PreToolUse", "PostToolUse"}:
        tool_input = payload.get("tool_input", {})
        if isinstance(tool_input, dict) and isinstance(tool_input.get("command"), str):
            input_text = tool_input["command"]
        else:
            input_text = stable_json(tool_input)
        event.update(
            {
                "tool_name": str(payload.get("tool_name", "unknown")),
                "tool_use_id": str(payload.get("tool_use_id", "unknown")),
                "tool_input_preview": redacted_preview(input_text),
            }
        )

    if event_name == "PostToolUse":
        response = payload.get("tool_response")
        response_text = stable_json(response)
        event.update(
            {
                "success": _response_succeeded(response),
                "response_length": len(response_text),
                "response_sha256": sha256_text(response_text),
            }
        )

    return event


def append_event(repo_root: Path, event: Dict[str, Any]) -> Path:
    session_id = str(event.get("session_id", "unknown"))
    log_dir = repo_root / "ai" / "logs"
    snapshot = git_snapshot(repo_root)
    log_dir.mkdir(parents=True, mode=0o700, exist_ok=True)
    os.chmod(log_dir, 0o700)
    path = log_dir / safe_session_filename(session_id)

    file_descriptor = os.open(path, os.O_RDWR | os.O_CREAT | os.O_APPEND, 0o600)
    os.chmod(path, 0o600)
    with os.fdopen(file_descriptor, "a+", encoding="utf-8") as log_file:
        fcntl.flock(log_file.fileno(), fcntl.LOCK_EX)
        log_file.seek(0, 2)
        if log_file.tell() == 0:
            baseline = {
                "event": "SessionBaseline",
                "timestamp": str(event.get("timestamp") or _timestamp()),
                "session_id": str(event.get("session_id", "unknown")),
                "turn_id": str(event.get("turn_id", "unknown")),
                "base_commit": snapshot["base_commit"],
                "branch": snapshot["branch"],
                "initial_dirty_files": snapshot["dirty_files"],
            }
            if "git_error" in snapshot:
                baseline["git_error"] = snapshot["git_error"]
            log_file.write(stable_json(baseline) + "\n")
        log_file.write(stable_json(event) + "\n")
        log_file.flush()
        fcntl.flock(log_file.fileno(), fcntl.LOCK_UN)

    return path


def main() -> int:
    try:
        payload = json.load(sys.stdin)
        if not isinstance(payload, dict):
            raise ValueError("payload must be an object")
        repo_root = find_repo_root(str(payload.get("cwd") or Path.cwd()))
        append_event(repo_root, normalize_event(payload, repo_root))
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"AI logging hook failed: {type(error).__name__}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
