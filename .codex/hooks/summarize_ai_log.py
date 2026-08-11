"""Build a factual Markdown summary from local Codex hook events."""

import fcntl
import json
import os
import re
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from hook_common import find_repo_root, git_snapshot
from log_ai_event import safe_session_filename


VERIFICATION_PATTERNS = (
    re.compile(r"^(?:\./|backend/)?gradlew\b.*\b(?:test|check|build|compile\w*)\b"),
    re.compile(r"^(?:npm|yarn|pnpm)(?:\s+run)?\s+(?:test|build|lint)\b"),
    re.compile(r"^bash\s+\S*tests/\S+\.sh\b"),
    re.compile(r"^k6\s+run\b"),
    re.compile(r"^python3?\s+-m\s+unittest\b"),
)


def is_verification_command(command: str) -> bool:
    normalized = command.strip()
    if any(operator in normalized for operator in ("&&", "||", ";", "|")):
        return False
    return any(pattern.search(normalized) for pattern in VERIFICATION_PATTERNS)


def _list_items(values: List[str]) -> List[str]:
    return [f"- {value}" for value in values] if values else ["- 없음"]


def build_summary(
    records: List[Dict[str, Any]], current_snapshot: Dict[str, Any]
) -> str:
    baseline = next(
        (record for record in records if record.get("event") == "SessionBaseline"),
        {},
    )
    initial_dirty = sorted(str(path) for path in baseline.get("initial_dirty_files", []))
    current_dirty = sorted(str(path) for path in current_snapshot.get("dirty_files", []))
    new_dirty = sorted(set(current_dirty) - set(initial_dirty))

    verification_lines = []
    failed_lines = []
    seen_verifications = set()
    for record in records:
        if record.get("event") != "PostToolUse":
            continue
        command = str(record.get("tool_input_preview", ""))
        tool_use_id = str(record.get("tool_use_id", "unknown"))
        success = bool(record.get("success", False))
        if is_verification_command(command) and tool_use_id not in seen_verifications:
            result = "성공" if success else "실패"
            verification_lines.append(f"- `{command}` — {result}")
            seen_verifications.add(tool_use_id)
        if not success:
            failed_lines.append(f"- `{tool_use_id}` `{command}`")

    lines = [
        "# AI 보조 작업 요약",
        "",
        "## 기준점",
        "",
        f"- 세션: `{baseline.get('session_id', 'unknown')}`",
        f"- 턴: `{baseline.get('turn_id', 'unknown')}`",
        f"- 브랜치: `{baseline.get('branch') or 'unknown'}`",
        f"- 기준 commit: `{baseline.get('base_commit') or 'unknown'}`",
        "",
        "## 기존 미커밋 파일",
        "",
        *_list_items(initial_dirty),
        "",
        "## Hook 실행 후 추가된 파일",
        "",
        *_list_items(new_dirty),
        "",
        "## 검증 명령",
        "",
        *(verification_lines or ["- 없음"]),
        "",
        "## 실패한 도구 호출",
        "",
        *(failed_lines or ["- 없음"]),
        "",
        "## 사람의 판단 기록",
        "",
        "- 채택한 제안과 이유:",
        "- 기각한 제안과 이유:",
        "- 남은 리스크:",
        "",
    ]
    return "\n".join(lines)


def read_records(log_path: Path) -> List[Dict[str, Any]]:
    with log_path.open("r", encoding="utf-8") as log_file:
        fcntl.flock(log_file.fileno(), fcntl.LOCK_SH)
        try:
            return [
                json.loads(line)
                for line in log_file
                if line.strip()
            ]
        finally:
            fcntl.flock(log_file.fileno(), fcntl.LOCK_UN)


def write_summary(repo_root: Path, payload: Dict[str, Any]) -> Optional[Path]:
    session_id = str(payload.get("session_id", "unknown"))
    log_path = repo_root / "ai" / "logs" / safe_session_filename(session_id)
    if not log_path.exists():
        return None

    records = read_records(log_path)
    snapshot = git_snapshot(repo_root)
    branch = re.sub(r"[^A-Za-z0-9._-]", "-", str(snapshot.get("branch") or "detached"))
    turn_id = re.sub(r"[^A-Za-z0-9._-]", "_", str(payload.get("turn_id", "unknown")))
    date = datetime.now(timezone.utc).date().isoformat()
    summary_dir = repo_root / "ai" / "summaries"
    summary_dir.mkdir(parents=True, exist_ok=True)
    path = summary_dir / f"{date}-{branch}-{turn_id}.md"
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=summary_dir,
            prefix=".summary-",
            delete=False,
        ) as temporary_file:
            temporary_path = Path(temporary_file.name)
            temporary_file.write(build_summary(records, snapshot))
            temporary_file.flush()
            os.fsync(temporary_file.fileno())
        os.chmod(temporary_path, 0o600)
        os.replace(temporary_path, path)
    finally:
        if temporary_path is not None and temporary_path.exists():
            temporary_path.unlink()
    return path


def main() -> int:
    try:
        payload = json.load(sys.stdin)
        if not isinstance(payload, dict):
            raise ValueError("payload must be an object")
        repo_root = find_repo_root(str(payload.get("cwd") or Path.cwd()))
        write_summary(repo_root, payload)
        print(json.dumps({"continue": True}))
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"AI summary hook failed: {type(error).__name__}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
