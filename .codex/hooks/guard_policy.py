"""Policy checks for DevChat Codex PreToolUse permission guard."""

import codecs
import re
import shlex
from pathlib import PurePosixPath
from typing import Optional, Tuple


PolicyViolation = Tuple[str, str]
PATCH_PATH_PATTERN = re.compile(
    r"^\*\*\* (?:Add|Update|Delete) File:\s*(.+?)\s*$", re.MULTILINE
)
SECRET_PATH_PATTERN = re.compile(
    r"(?:^|/)(?:\.env(?:\.[^/]+)?|[^/]*(?:credential|private)[^/]*|id_[a-z0-9_-]+|[^/]+\.(?:pem|key|p12))$",
    re.IGNORECASE,
)
DATABASE_CLIENT_PATTERN = re.compile(r"\b(?:psql|mysql|mariadb|mongosh|mongo)\b", re.IGNORECASE)
ANSI_C_QUOTE_PATTERN = re.compile(r"\$'((?:\\.|[^'\\])*)'")


def _violation(policy_id: str, reason: str) -> PolicyViolation:
    return policy_id, f"[{policy_id}] {reason}"


def _tokens(command: str) -> list[str]:
    command = ANSI_C_QUOTE_PATTERN.sub(_ansi_c_quote, command)
    try:
        return shlex.split(command)
    except ValueError:
        return command.split()


def _ansi_c_quote(match: re.Match[str]) -> str:
    try:
        value = codecs.decode(match.group(1), "unicode_escape")
    except UnicodeDecodeError:
        return match.group(0)
    return shlex.quote(value)


def _normalized_command(command: str) -> str:
    return " ".join(_tokens(command))


def _has_broad_recursive_delete(command: str, cwd: str) -> bool:
    cwd_path = PurePosixPath(cwd)
    parent_path = cwd_path.parent
    tokens = _tokens(command)
    for index, token in enumerate(tokens):
        if token != "rm":
            continue
        arguments = []
        for candidate in tokens[index + 1 :]:
            if candidate in {"&&", "||", "|", ";"}:
                break
            arguments.append(candidate)
        recursive = any(
            argument in {"-r", "-R", "--recursive"}
            or (argument.startswith("-") and "r" in argument.lower())
            for argument in arguments
        )
        if not recursive:
            continue
        targets = [argument for argument in arguments if not argument.startswith("-")]
        for target in targets:
            if target in {".", "./", "..", "../", "/", "~", "$HOME"}:
                return True
            if target.startswith(("$", "~/")) or "$(" in target or any(
                character in target for character in "*?["
            ):
                return True
            if PurePosixPath(target) == PurePosixPath("."):
                return True
            target_path = PurePosixPath(target)
            if target_path in {cwd_path, parent_path}:
                return True
    return False


def _git_destructive(command: str) -> bool:
    return any(
        pattern.search(command)
        for pattern in (
            re.compile(r"\bgit\s+reset\b[^;&|\n]*\s--hard\b", re.IGNORECASE),
            re.compile(r"\bgit\s+clean\b[^;&|\n]*-f[^;&|\n]*d\b", re.IGNORECASE),
            re.compile(r"\bgit\s+push\b[^;&|\n]*(?:--force(?:-with-lease)?\b|(?:^|\s)-f\b)", re.IGNORECASE),
            re.compile(r"\bgit\s+checkout\s+--\s+(?:\.|\*|/|\$[^\s]+)", re.IGNORECASE),
            re.compile(r"\bgit\s+restore\b[^;&|\n]*(?:^|\s)(?:\.|\*|/|\$[^\s]+)(?:\s|$)", re.IGNORECASE),
        )
    )


def _unscoped_stage(command: str) -> bool:
    return bool(
        re.search(
            r"\bgit\s+add\s+(?:(?:--all|-A)(?:\s|$)|(?:--\s+)?\.(?:\s|$))",
            command,
            re.IGNORECASE,
        )
    )


def _production_deploy(command: str) -> bool:
    return bool(
        re.search(r"(?:^|\s)(?:\./)?deploy(?:\.sh)?\s+(?:--environment\s+)?(?:prod|production)\b", command, re.IGNORECASE)
        or re.search(
            r"\bdocker\s+compose\b[^;&|\n]*(?:prod|production)[^;&|\n]*\b(?:up|restart|down|rm)\b",
            command,
            re.IGNORECASE,
        )
        or re.search(r"\bdocker\s+rm\s+(?:\S*prod\S*|\S*production\S*)", command, re.IGNORECASE)
    )


def _database_destructive(command: str) -> bool:
    if not DATABASE_CLIENT_PATTERN.search(command):
        return False
    normalized = command.upper()
    if re.search(r"\bDROP\s+(?:DATABASE|SCHEMA|TABLE)\b|\bTRUNCATE\b", normalized):
        return True
    delete = re.search(r"\bDELETE\s+FROM\b", normalized)
    return delete is not None and "WHERE" not in normalized[delete.end() :]


def _bash_violation(command: str, cwd: str) -> Optional[PolicyViolation]:
    normalized = _normalized_command(command)
    if _git_destructive(normalized):
        return _violation("GIT_DESTRUCTIVE", "기존 변경을 폐기할 수 있어 차단했습니다.")
    if _has_broad_recursive_delete(normalized, cwd):
        return _violation("RECURSIVE_DELETE", "넓거나 모호한 재귀 삭제를 차단했습니다.")
    if _production_deploy(normalized):
        return _violation("PRODUCTION_DEPLOY", "운영 배포 또는 운영 컨테이너 변경을 차단했습니다.")
    if _database_destructive(normalized):
        return _violation("DATABASE_DESTRUCTIVE", "운영 또는 대상 미확정 데이터 파괴를 차단했습니다.")
    if _unscoped_stage(normalized):
        return _violation("UNSCOPED_GIT_STAGE", "범위가 없는 Git stage를 차단했습니다.")
    return None


def _patch_violation(command: str) -> Optional[PolicyViolation]:
    for path in PATCH_PATH_PATTERN.findall(command):
        if SECRET_PATH_PATTERN.search(path.strip()):
            return _violation("SECRET_FILE_WRITE", "비밀 또는 자격증명 파일 수정을 차단했습니다.")
    return None


def evaluate(tool_name: str, command: str, cwd: str) -> Optional[PolicyViolation]:
    """Return the matching policy violation without running or rewriting input."""
    if tool_name == "Bash":
        return _bash_violation(command, cwd)
    if tool_name == "apply_patch":
        return _patch_violation(command)
    return None
