"""Normalize exact token usage emitted by Codex without estimating values."""

import json
from pathlib import Path
from typing import Any, Dict, Iterator, Optional


TOKEN_FIELDS = {
    "input_tokens": ("input_tokens", "inputTokens"),
    "cached_input_tokens": ("cached_input_tokens", "cachedInputTokens"),
    "cache_write_input_tokens": (
        "cache_write_input_tokens",
        "cacheWriteInputTokens",
    ),
    "output_tokens": ("output_tokens", "outputTokens"),
    "reasoning_output_tokens": (
        "reasoning_output_tokens",
        "reasoningOutputTokens",
    ),
    "total_tokens": ("total_tokens", "totalTokens"),
}
def _non_negative_integer(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value >= 0


def _normalize_breakdown(value: Any) -> Optional[Dict[str, int]]:
    if not isinstance(value, dict):
        return None
    result = {}
    for output_key, input_keys in TOKEN_FIELDS.items():
        present_key = next((key for key in input_keys if key in value), None)
        field_value = (
            value[present_key]
            if present_key is not None
            else 0 if output_key == "cache_write_input_tokens" else None
        )
        if not _non_negative_integer(field_value):
            return None
        result[output_key] = field_value
    return result


def _optional_non_negative_integer(value: Any) -> Optional[int]:
    return value if _non_negative_integer(value) else None


def normalize_token_usage_event(record: Any) -> Optional[Dict[str, Any]]:
    """Return one stable token snapshot from a supported Codex event."""
    if not isinstance(record, dict):
        return None

    source = None
    total = None
    last = None
    context_window = None
    thread_id = None
    turn_id = None

    if record.get("type") == "event_msg":
        payload = record.get("payload")
        if not isinstance(payload, dict) or payload.get("type") != "token_count":
            return None
        info = payload.get("info")
        if not isinstance(info, dict):
            return None
        source = "codex_rollout"
        total = _normalize_breakdown(info.get("total_token_usage"))
        last = _normalize_breakdown(info.get("last_token_usage"))
        context_window = _optional_non_negative_integer(
            info.get("model_context_window")
        )
    elif record.get("method") == "thread/tokenUsage/updated":
        params = record.get("params")
        if not isinstance(params, dict):
            return None
        token_usage = params.get("tokenUsage")
        if not isinstance(token_usage, dict):
            return None
        source = "codex_app_server"
        total = _normalize_breakdown(token_usage.get("total"))
        last = _normalize_breakdown(token_usage.get("last"))
        context_window = _optional_non_negative_integer(
            token_usage.get("modelContextWindow")
        )
        thread_id = params.get("threadId")
        turn_id = params.get("turnId")
    else:
        return None

    if total is None or last is None:
        return None
    result: Dict[str, Any] = {
        "source": source,
        "total": total,
        "last": last,
    }
    if context_window is not None:
        result["model_context_window"] = context_window
    if isinstance(thread_id, str) and thread_id:
        result["thread_id"] = thread_id
    if isinstance(turn_id, str) and turn_id:
        result["turn_id"] = turn_id
    return result


def _reversed_lines(path: Path, chunk_size: int = 8192) -> Iterator[str]:
    with path.open("rb") as source:
        source.seek(0, 2)
        position = source.tell()
        remainder = b""
        while position > 0:
            read_size = min(chunk_size, position)
            position -= read_size
            source.seek(position)
            chunk = source.read(read_size) + remainder
            lines = chunk.split(b"\n")
            remainder = lines[0]
            for line in reversed(lines[1:]):
                if line:
                    yield line.decode("utf-8")
        if remainder:
            yield remainder.decode("utf-8")


def read_latest_token_usage(
    path: Path,
    expected_thread_id: Optional[str] = None,
    expected_turn_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Read backward and return the newest valid token snapshot, if present."""
    try:
        for line in _reversed_lines(path):
            try:
                record = json.loads(line)
            except (json.JSONDecodeError, UnicodeDecodeError):
                continue
            usage = normalize_token_usage_event(record)
            if usage is not None:
                if usage["source"] == "codex_app_server" and (
                    expected_thread_id is not None
                    and usage.get("thread_id") != expected_thread_id
                    or expected_turn_id is not None
                    and usage.get("turn_id") != expected_turn_id
                ):
                    continue
                return usage
    except (OSError, UnicodeDecodeError, ValueError):
        return None
    return None
