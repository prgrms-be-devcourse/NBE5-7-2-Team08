import json
import os
import subprocess
import sys
import unittest
from pathlib import Path


HOOK_DIR = Path(__file__).resolve().parents[1]
ENTRYPOINT = HOOK_DIR / "guard_pre_tool_use.py"


class GuardPreToolUseTest(unittest.TestCase):
    def invoke(self, payload: dict) -> subprocess.CompletedProcess:
        return subprocess.run(
            [sys.executable, str(ENTRYPOINT)],
            input=json.dumps(payload),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"},
        )

    def test_dangerous_command_returns_policy_deny_without_command_text(self):
        command = "git reset --hard"
        result = self.invoke(
            {
                "cwd": "/workspace/devchat",
                "hook_event_name": "PreToolUse",
                "tool_name": "Bash",
                "tool_input": {"command": command},
            }
        )

        self.assertEqual(result.returncode, 0)
        output = json.loads(result.stdout)
        decision = output["hookSpecificOutput"]
        self.assertEqual(decision["hookEventName"], "PreToolUse")
        self.assertEqual(decision["permissionDecision"], "deny")
        self.assertIn("GIT_DESTRUCTIVE", decision["permissionDecisionReason"])
        self.assertNotIn(command, decision["permissionDecisionReason"])
        self.assertEqual(result.stderr, "")

    def test_safe_command_succeeds_without_stdout(self):
        result = self.invoke(
            {
                "cwd": "/workspace/devchat",
                "hook_event_name": "PreToolUse",
                "tool_name": "Bash",
                "tool_input": {"command": "git status --short"},
            }
        )

        self.assertEqual((result.returncode, result.stdout, result.stderr), (0, "", ""))

    def test_malformed_payload_fails_without_echoing_input(self):
        result = subprocess.run(
            [sys.executable, str(ENTRYPOINT)],
            input="malformed-secret",
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )

        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stdout, "")
        self.assertIn("Permission guard failed", result.stderr)
        self.assertNotIn("malformed-secret", result.stderr)


if __name__ == "__main__":
    unittest.main()
