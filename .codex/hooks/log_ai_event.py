"""Record redacted Codex hook events in a local JSONL file."""

import fcntl
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple

from hook_common import find_repo_root, git_snapshot, stable_json
from redact_ai_log import redacted_preview, sha256_text


SAFE_SESSION_PATTERN = re.compile(r"[^A-Za-z0-9._-]")
PATCH_PATH_PATTERN = re.compile(
    r"^\*\*\* (?:Add|Update|Delete) File:\s*(.+?)\s*$",
    re.MULTILINE,
)
MAX_AFFECTED_PATHS = 100
PATH_PREVIEW_LIMIT = 500


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


def _tool_input_text(tool_input: Any) -> str:
    if isinstance(tool_input, dict) and isinstance(tool_input.get("command"), str):
        return tool_input["command"]
    return stable_json(tool_input)


def _affected_paths(tool_input: Any) -> Tuple[List[str], int]:
    paths = []
    if isinstance(tool_input, dict):
        for key in ("path", "file_path"):
            value = tool_input.get(key)
            if isinstance(value, str) and value.strip():
                paths.append(value.strip())
        command = tool_input.get("command")
        if isinstance(command, str):
            paths.extend(PATCH_PATH_PATTERN.findall(command))
    unique_paths = sorted(set(paths))
    safe_paths = [
        redacted_preview(path, limit=PATH_PREVIEW_LIMIT)
        for path in unique_paths[:MAX_AFFECTED_PATHS]
    ]
    return safe_paths, len(unique_paths)


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
        "model": str(payload.get("model", "unknown")),
        "permission_mode": str(payload.get("permission_mode", "unknown")),
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

    if event_name in {"PreToolUse", "PostToolUse", "PermissionRequest"}:
        tool_input = payload.get("tool_input", {})
        input_text = _tool_input_text(tool_input)
        event.update(
            {
                "tool_name": str(payload.get("tool_name", "unknown")),
                "tool_input_preview": redacted_preview(input_text),
                "tool_input_length": len(input_text),
                "tool_input_sha256": sha256_text(input_text),
            }
        )
        if event_name != "PermissionRequest":
            event["tool_use_id"] = str(payload.get("tool_use_id", "unknown"))
        affected_paths, affected_paths_total = _affected_paths(tool_input)
        if affected_paths:
            event.update(
                {
                    "affected_paths": affected_paths,
                    "affected_paths_total": affected_paths_total,
                    "affected_paths_truncated": (
                        affected_paths_total > len(affected_paths)
                    ),
                }
            )

    if event_name == "PermissionRequest":
        tool_input = payload.get("tool_input", {})
        description = tool_input.get("description") if isinstance(tool_input, dict) else None
        if isinstance(description, str) and description:
            event["reason_preview"] = redacted_preview(description, limit=300)

    if event_name in {"SubagentStart", "SubagentStop"}:
        event.update(
            {
                "agent_id": str(payload.get("agent_id", "unknown")),
                "agent_type": str(payload.get("agent_type", "unknown")),
            }
        )

    if event_name == "SubagentStop":
        result = str(payload.get("last_assistant_message") or "")
        transcript_path = payload.get("agent_transcript_path")
        event.update(
            {
                "stop_hook_active": bool(payload.get("stop_hook_active", False)),
                "transcript_available": isinstance(transcript_path, str) and bool(transcript_path),
                "result_preview": redacted_preview(result, limit=300),
                "result_length": len(result),
                "result_sha256": sha256_text(result),
            }
        )
        if isinstance(transcript_path, str) and transcript_path:
            event["agent_transcript_path"] = redacted_preview(
                transcript_path,
                limit=PATH_PREVIEW_LIMIT,
            )

    if event_name == "PostToolUse":
        response = payload.get("tool_response")
        response_text = stable_json(response)
        success = _response_succeeded(response)
        event.update(
            {
                "success": success,
                "response_length": len(response_text),
                "response_sha256": sha256_text(response_text),
            }
        )
        if isinstance(response, dict) and isinstance(response.get("exit_code"), int):
            event["exit_code"] = response["exit_code"]
        if not success:
            event["error_preview"] = redacted_preview(response_text, limit=500)

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
                "model": str(event.get("model", "unknown")),
                "permission_mode": str(event.get("permission_mode", "unknown")),
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
        if str(payload.get("hook_event_name")) == "SubagentStop":
            print(json.dumps({"continue": True}))
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"AI logging hook failed: {type(error).__name__}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
