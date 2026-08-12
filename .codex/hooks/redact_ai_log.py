"""Redaction helpers for local AI workflow logs."""

import hashlib
import re


PRIVATE_KEY_PATTERN = re.compile(
    r"-----BEGIN(?: [A-Z0-9]+)? PRIVATE KEY-----.*?"
    r"-----END(?: [A-Z0-9]+)? PRIVATE KEY-----",
    re.DOTALL,
)
URI_CREDENTIAL_PATTERN = re.compile(
    r"([a-zA-Z][a-zA-Z0-9+.-]*://)[^\s/:@]+:[^\s/@]+@"
)
AUTHORIZATION_PATTERN = re.compile(r"(?im)(Authorization\s*:\s*)[^\r\n]+")
COOKIE_PATTERN = re.compile(r"(?i)(Cookie\s*:\s*)[^\r\n]+")
SECRET_KEY = (
    r"[A-Z0-9_.-]*(?:password|passwd|pwd|api[_-]?key|access[_-]?token|"
    r"refresh[_-]?token|token|secret)[A-Z0-9_.-]*"
)
SHELL_VALUE = r'''(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;}\]])+'''
KEY_VALUE_PATTERN = re.compile(
    rf"(?i)([\"']?{SECRET_KEY}[\"']?\s*[=:]\s*)({SHELL_VALUE})",
    re.DOTALL,
)
CLI_SECRET_PATTERN = re.compile(
    r"(?i)(--(?:password|passwd|pwd|api[-_]?key|access[-_]?token|"
    rf"refresh[-_]?token|token|secret)(?:\s+|=))({SHELL_VALUE})",
    re.DOTALL,
)
COMMON_TOKEN_PATTERN = re.compile(
    r"\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{8,}|"
    r"github_pat_[A-Za-z0-9_]{8,}|gh[pousr]_[A-Za-z0-9]{8,})\b"
)
JWT_PATTERN = re.compile(
    r"\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b"
)
EMAIL_PATTERN = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)


def _redact_value(match: re.Match) -> str:
    prefix = match.group(1)
    value = match.group(2)
    if len(value) >= 2 and value[0] in {"\"", "'"} and value[-1] == value[0]:
        return f"{prefix}{value[0]}[REDACTED]{value[0]}"
    return f"{prefix}[REDACTED]"


def redact_text(value: str) -> str:
    """Mask common credentials and personal identifiers in text."""
    redacted = PRIVATE_KEY_PATTERN.sub("[REDACTED_PRIVATE_KEY]", value)
    redacted = URI_CREDENTIAL_PATTERN.sub(r"\1[REDACTED]@", redacted)
    redacted = AUTHORIZATION_PATTERN.sub(r"\1[REDACTED]", redacted)
    redacted = COOKIE_PATTERN.sub(r"\1[REDACTED]", redacted)
    redacted = CLI_SECRET_PATTERN.sub(_redact_value, redacted)
    redacted = KEY_VALUE_PATTERN.sub(_redact_value, redacted)
    redacted = COMMON_TOKEN_PATTERN.sub("[REDACTED_TOKEN]", redacted)
    redacted = JWT_PATTERN.sub("[REDACTED_JWT]", redacted)
    return EMAIL_PATTERN.sub("[REDACTED_EMAIL]", redacted)


def sha256_text(value: str) -> str:
    """Return a stable SHA-256 digest without retaining the source text."""
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def redacted_preview(value: str, limit: int = 500) -> str:
    """Return a single-line, redacted preview capped at ``limit`` characters."""
    preview = " ".join(redact_text(value).splitlines())
    if len(preview) <= limit:
        return preview
    return preview[:limit] + "…"
