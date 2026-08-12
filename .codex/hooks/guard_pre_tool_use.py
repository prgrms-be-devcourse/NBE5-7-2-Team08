"""Codex stdin/stdout adapter for the DevChat PreToolUse permission guard."""

import json
import sys
from pathlib import Path
from typing import Any, Dict

from guard_policy import evaluate


def _command(payload: Dict[str, Any]) -> str:
    tool_input = payload.get("tool_input")
    if not isinstance(tool_input, dict):
        return ""
    command = tool_input.get("command")
    return command if isinstance(command, str) else ""


def main() -> int:
    try:
        payload = json.load(sys.stdin)
        if not isinstance(payload, dict):
            raise ValueError("payload must be an object")
        violation = evaluate(
            str(payload.get("tool_name", "")),
            _command(payload),
            str(payload.get("cwd") or Path.cwd()),
        )
        if violation is not None:
            policy_id, reason = violation
            print(
                json.dumps(
                    {
                        "hookSpecificOutput": {
                            "hookEventName": "PreToolUse",
                            "permissionDecision": "deny",
                            "permissionDecisionReason": reason,
                        }
                    },
                    ensure_ascii=False,
                )
            )
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"Permission guard failed: {type(error).__name__}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
