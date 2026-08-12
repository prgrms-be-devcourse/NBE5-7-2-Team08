import json
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]


def load_config():
    return json.loads((REPO_ROOT / ".codex" / "hooks.json").read_text(encoding="utf-8"))


class HookConfigTest(unittest.TestCase):
    def test_registers_required_events(self):
        config = load_config()

        self.assertEqual(
            set(config["hooks"]),
            {
                "UserPromptSubmit",
                "SubagentStart",
                "SubagentStop",
                "PermissionRequest",
                "PreToolUse",
                "PostToolUse",
                "Stop",
            },
        )

    def test_tool_hooks_only_match_shell_and_file_edits(self):
        config = load_config()

        self.assertEqual(
            config["hooks"]["PreToolUse"][0]["matcher"],
            "^(Bash|apply_patch|Edit|Write)$",
        )
        self.assertEqual(
            config["hooks"]["PostToolUse"][0]["matcher"],
            "^(Bash|apply_patch|Edit|Write)$",
        )
        self.assertEqual(
            config["hooks"]["PermissionRequest"][0]["matcher"],
            "^(Bash|apply_patch|Edit|Write)$",
        )

    def test_does_not_add_model_context(self):
        serialized = json.dumps(load_config())

        self.assertNotIn("additionalContext", serialized)
        self.assertNotIn("additionalContextLimit", serialized)


if __name__ == "__main__":
    unittest.main()
