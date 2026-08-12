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
from log_ai_event import append_event, safe_session_filename
from token_usage import read_latest_token_usage


VERIFICATION_PATTERNS = (
    re.compile(r"^(?:\./|backend/)?gradlew\b.*\b(?:test|check|build|compile\w*)\b"),
    re.compile(r"^(?:npm|yarn|pnpm)(?:\s+run)?\s+(?:test|build|lint)\b"),
    re.compile(r"^bash\s+\S*tests/\S+\.sh\b"),
    re.compile(r"^k6\s+run\b"),
    re.compile(r"^python3?\s+-m\s+unittest\b"),
)
MAX_SUMMARY_AFFECTED_PATHS = 100


def is_verification_command(command: str) -> bool:
    normalized = command.strip()
    if any(operator in normalized for operator in ("&&", "||", ";", "|")):
        return False
    return any(pattern.search(normalized) for pattern in VERIFICATION_PATTERNS)


def _list_items(values: List[str]) -> List[str]:
    return [f"- {value}" for value in values] if values else ["- 없음"]


def _token_usage_lines(records: List[Dict[str, Any]]) -> List[str]:
    snapshot = next(
        (
            record
            for record in reversed(records)
            if record.get("event") == "TokenUsageSnapshot"
        ),
        None,
    )
    if snapshot is None:
        return ["- 정보 없음"]

    def format_breakdown(label: str, breakdown: Any) -> Optional[str]:
        if not isinstance(breakdown, dict):
            return None
        keys = (
            "total_tokens",
            "input_tokens",
            "cached_input_tokens",
            "output_tokens",
            "reasoning_output_tokens",
        )
        if any(
            not isinstance(breakdown.get(key), int)
            or isinstance(breakdown.get(key), bool)
            or breakdown[key] < 0
            for key in keys
        ):
            return None
        return (
            f"- {label}: 총 {breakdown['total_tokens']:,} / "
            f"입력 {breakdown['input_tokens']:,} / "
            f"캐시 입력 {breakdown['cached_input_tokens']:,} / "
            f"출력 {breakdown['output_tokens']:,} / "
            f"추론 출력 {breakdown['reasoning_output_tokens']:,}"
        )

    lines = [
        line
        for line in (
            format_breakdown("누적", snapshot.get("total")),
            format_breakdown("최근 응답", snapshot.get("last")),
        )
        if line is not None
    ]
    context_window = snapshot.get("model_context_window")
    if (
        isinstance(context_window, int)
        and not isinstance(context_window, bool)
        and context_window >= 0
    ):
        lines.append(f"- 모델 컨텍스트 윈도우: {context_window:,}")
    return lines or ["- 정보 없음"]


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
    permission_lines = []
    affected_paths = set()
    affected_paths_total = 0
    affected_paths_truncated_calls = 0
    subagents: Dict[str, Dict[str, Any]] = {}
    seen_verifications = set()
    for record in records:
        event_name = record.get("event")
        if event_name in {"SubagentStart", "SubagentStop"}:
            agent_id = str(record.get("agent_id", "unknown"))
            agent = subagents.setdefault(
                agent_id,
                {"agent_type": str(record.get("agent_type", "unknown"))},
            )
            agent["agent_type"] = str(record.get("agent_type", agent["agent_type"]))
            agent["started"] = agent.get("started", False) or event_name == "SubagentStart"
            agent["stopped"] = agent.get("stopped", False) or event_name == "SubagentStop"
            if event_name == "SubagentStop" and record.get("result_preview"):
                agent["result_preview"] = str(record["result_preview"])

        if event_name == "PermissionRequest":
            tool_name = str(record.get("tool_name", "unknown"))
            command = str(record.get("tool_input_preview", ""))
            reason = str(record.get("reason_preview", "사유 없음"))
            permission_lines.append(
                f"- `{tool_name}` `{command}` — {reason} (승인 결과 미확인)"
            )

        for path in record.get("affected_paths", []):
            affected_paths.add(str(path))
        if event_name == "PreToolUse":
            record_path_total = record.get("affected_paths_total")
            if isinstance(record_path_total, int):
                affected_paths_total = max(affected_paths_total, record_path_total)
            if record.get("affected_paths_truncated", False):
                affected_paths_truncated_calls += 1

        if event_name == "PostToolUse":
            command = str(record.get("tool_input_preview", ""))
            tool_use_id = str(record.get("tool_use_id", "unknown"))
            success = bool(record.get("success", False))
            if is_verification_command(command) and tool_use_id not in seen_verifications:
                result = "성공" if success else "실패"
                verification_lines.append(f"- `{command}` — {result}")
                seen_verifications.add(tool_use_id)
            if not success:
                exit_code = record.get("exit_code")
                exit_text = f" — exit {exit_code}" if isinstance(exit_code, int) else ""
                error_preview = str(record.get("error_preview", ""))
                error_text = f" — {error_preview}" if error_preview else ""
                failed_lines.append(
                    f"- `{tool_use_id}` `{command}`{exit_text}{error_text}"
                )

    subagent_lines = []
    for agent_id, agent in subagents.items():
        if agent.get("started") and agent.get("stopped"):
            status = "시작/종료"
        elif agent.get("started"):
            status = "시작됨, 종료 기록 없음"
        else:
            status = "종료됨, 시작 기록 없음"
        line = f"- `{agent['agent_type']}` (`{agent_id}`) — {status}"
        if agent.get("result_preview"):
            line += f": {agent['result_preview']}"
        subagent_lines.append(line)

    sorted_affected_paths = sorted(affected_paths)
    affected_path_lines = _list_items(
        sorted_affected_paths[:MAX_SUMMARY_AFFECTED_PATHS]
    )
    if len(sorted_affected_paths) > MAX_SUMMARY_AFFECTED_PATHS:
        affected_path_lines.append(
            "- 세션 요약은 서로 다른 경로 "
            f"{len(sorted_affected_paths)}개 중 {MAX_SUMMARY_AFFECTED_PATHS}개만 표시함"
        )
    if affected_paths_truncated_calls:
        affected_path_lines.append(
            f"- {affected_paths_truncated_calls}개 도구 호출에서 경로 제한 적용"
            f"(호출별 최대 100개, 한 호출 최대 {affected_paths_total}개 감지)"
        )

    lines = [
        "# AI 보조 작업 요약",
        "",
        "## 기준점",
        "",
        f"- 세션: `{baseline.get('session_id', 'unknown')}`",
        f"- 턴: `{baseline.get('turn_id', 'unknown')}`",
        f"- 모델: `{baseline.get('model', 'unknown')}`",
        f"- 권한 모드: `{baseline.get('permission_mode', 'unknown')}`",
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
        "## 도구가 대상으로 기록한 파일",
        "",
        *affected_path_lines,
        "",
        "## 서브에이전트 실행",
        "",
        *(subagent_lines or ["- 없음"]),
        "",
        "## 승인 요청",
        "",
        *(permission_lines or ["- 없음"]),
        "",
        "## 검증 명령",
        "",
        *(verification_lines or ["- 없음"]),
        "",
        "## 실패한 도구 호출",
        "",
        *(failed_lines or ["- 없음"]),
        "",
        "## 토큰 사용량",
        "",
        *_token_usage_lines(records),
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
    transcript_path = payload.get("transcript_path")
    usage = (
        read_latest_token_usage(
            Path(transcript_path),
            expected_thread_id=session_id,
            expected_turn_id=str(payload.get("turn_id", "unknown")),
        )
        if isinstance(transcript_path, str) and transcript_path
        else None
    )
    if usage is not None:
        latest_usage = next(
            (
                record
                for record in reversed(records)
                if record.get("event") == "TokenUsageSnapshot"
            ),
            None,
        )
        if latest_usage is None or any(
            latest_usage.get(key) != usage.get(key)
            for key in (
                "source",
                "total",
                "last",
                "model_context_window",
                "thread_id",
                "turn_id",
            )
        ):
            event = {
                "event": "TokenUsageSnapshot",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "session_id": session_id,
                "turn_id": str(payload.get("turn_id", "unknown")),
                **usage,
            }
            append_event(repo_root, event)
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
