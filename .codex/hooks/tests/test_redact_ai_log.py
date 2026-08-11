import sys
import unittest
from pathlib import Path


HOOK_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HOOK_DIR))

from redact_ai_log import redact_text, redacted_preview, sha256_text


class RedactAiLogTest(unittest.TestCase):
    def test_redacts_bearer_token(self):
        self.assertEqual(
            redact_text("Authorization: Bearer secret-token"),
            "Authorization: [REDACTED]",
        )

    def test_redacts_password_assignment(self):
        self.assertEqual(redact_text("DB_PASSWORD=secret"), "DB_PASSWORD=[REDACTED]")

    def test_redacts_quoted_json_secret_value(self):
        value = '{"api_key":"secret","safe":"value"}'
        self.assertEqual(
            redact_text(value),
            '{"api_key":"[REDACTED]","safe":"value"}',
        )

    def test_redacts_entire_quoted_secret_with_spaces(self):
        self.assertEqual(
            redact_text('password="top secret phrase"'),
            'password="[REDACTED]"',
        )

    def test_redacts_cli_password_flag(self):
        self.assertEqual(
            redact_text("deploy --password topsecret --dry-run"),
            "deploy --password [REDACTED] --dry-run",
        )

    def test_redacts_basic_and_quoted_bearer_authorization(self):
        self.assertEqual(
            redact_text("Authorization: Basic dXNlcjpwYXNz"),
            "Authorization: [REDACTED]",
        )
        self.assertEqual(
            redact_text('Authorization: Bearer "token with spaces"'),
            "Authorization: [REDACTED]",
        )
        self.assertEqual(
            redact_text('Authorization: "Bearer bare-secret"'),
            "Authorization: [REDACTED]",
        )

    def test_redacts_entire_authorization_header_remainder(self):
        self.assertEqual(
            redact_text("Authorization: Bearer token unexpected-suffix"),
            "Authorization: [REDACTED]",
        )

    def test_redacts_multiline_quoted_secret(self):
        self.assertEqual(
            redact_text('password="first\nsecond"'),
            'password="[REDACTED]"',
        )

    def test_redacts_escaped_quote_inside_secret(self):
        self.assertEqual(
            redact_text('password="abc\\"secret-tail" safe=true'),
            'password="[REDACTED]" safe=true',
        )

    def test_redacts_adjacent_unquoted_and_quoted_shell_secret(self):
        self.assertEqual(
            redact_text('PASSWORD=abc"secret tail" safe=true'),
            "PASSWORD=[REDACTED] safe=true",
        )
        self.assertEqual(
            redact_text('deploy --password abc"secret tail" --dry-run'),
            "deploy --password [REDACTED] --dry-run",
        )

    def test_redacts_common_bare_tokens_and_jwt(self):
        value = (
            "sk-proj-abcdefgh123456 "
            "github_pat_abcdefgh123456 "
            "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature123"
        )
        self.assertEqual(
            redact_text(value),
            "[REDACTED_TOKEN] [REDACTED_TOKEN] [REDACTED_JWT]",
        )

    def test_redacts_database_uri_credentials(self):
        value = "mysql://dev:secret@localhost:3306/devchat"
        self.assertEqual(
            redact_text(value),
            "mysql://[REDACTED]@localhost:3306/devchat",
        )

    def test_redacts_email_address(self):
        self.assertEqual(redact_text("owner@example.com"), "[REDACTED_EMAIL]")

    def test_redacts_private_key_body(self):
        value = "-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----"
        self.assertEqual(redact_text(value), "[REDACTED_PRIVATE_KEY]")

    def test_preview_truncates_after_redaction(self):
        value = "token=secret " + "x" * 600
        preview = redacted_preview(value, limit=40)
        self.assertNotIn("secret", preview)
        self.assertLessEqual(len(preview), 41)

    def test_sha256_is_stable(self):
        self.assertEqual(sha256_text("same"), sha256_text("same"))
        self.assertNotEqual(sha256_text("same"), sha256_text("different"))


if __name__ == "__main__":
    unittest.main()
