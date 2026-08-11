import json
import stat
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


HOOK_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HOOK_DIR))

from log_ai_event import append_event, normalize_event, safe_session_filename
from hook_common import git_snapshot
from redact_ai_log import sha256_text


def run_git(repo: Path, *args: str) -> None:
    subprocess.run(
        ["git", *args],
        cwd=repo,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )


class LogAiEventTest(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.repo = Path(self.temp_dir.name)
        run_git(self.repo, "init")
        run_git(self.repo, "config", "user.name", "Hook Test")
        run_git(self.repo, "config", "user.email", "hook@example.com")
        (self.repo / "tracked.txt").write_text("baseline\n", encoding="utf-8")
        run_git(self.repo, "add", "tracked.txt")
        run_git(self.repo, "commit", "-m", "baseline")

    def tearDown(self):
        self.temp_dir.cleanup()

    def read_jsonl(self, path: Path):
        return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]

    def test_user_prompt_stores_only_redacted_preview_and_digest(self):
        prompt = "PASSWORD=secret fix DM query"
        payload = {
            "session_id": "session-1",
            "turn_id": "turn-1",
            "cwd": str(self.repo),
            "hook_event_name": "UserPromptSubmit",
            "prompt": prompt,
        }

        event = normalize_event(payload, self.repo)

        self.assertEqual(event["prompt_preview"], "PASSWORD=[REDACTED] fix DM query")
        self.assertEqual(event["prompt_length"], len(prompt))
        self.assertEqual(event["prompt_sha256"], sha256_text(prompt))
        self.assertNotIn("prompt", event)

    def test_pre_tool_use_redacts_command_and_keeps_tool_identity(self):
        payload = {
            "session_id": "session-1",
            "turn_id": "turn-1",
            "hook_event_name": "PreToolUse",
            "tool_name": "Bash",
            "tool_use_id": "tool-1",
            "tool_input": {"command": "PASSWORD=secret ./gradlew test"},
        }

        event = normalize_event(payload, self.repo)

        self.assertEqual(event["tool_name"], "Bash")
        self.assertEqual(
            event["tool_input_preview"],
            "PASSWORD=[REDACTED] ./gradlew test",
        )

    def test_first_append_records_preexisting_dirty_files_once(self):
        (self.repo / "existing.txt").write_text("already dirty\n", encoding="utf-8")
        first_event = {
            "event": "UserPromptSubmit",
            "session_id": "session-1",
            "turn_id": "turn-1",
            "timestamp": "2026-08-12T00:00:00+00:00",
        }
        second_event = {
            "event": "PreToolUse",
            "session_id": "session-1",
            "turn_id": "turn-1",
        }

        path = append_event(self.repo, first_event)
        append_event(self.repo, second_event)
        records = self.read_jsonl(path)

        self.assertEqual(records[0]["event"], "SessionBaseline")
        self.assertEqual(records[0]["initial_dirty_files"], ["existing.txt"])
        self.assertEqual(records[0]["timestamp"], first_event["timestamp"])
        self.assertEqual(
            sum(record["event"] == "SessionBaseline" for record in records),
            1,
        )

    def test_post_tool_use_stores_response_metadata_not_body(self):
        payload = {
            "session_id": "session-1",
            "turn_id": "turn-1",
            "hook_event_name": "PostToolUse",
            "tool_name": "Bash",
            "tool_use_id": "tool-1",
            "tool_response": {"exit_code": 0, "output": "sensitive output"},
        }

        event = normalize_event(payload, self.repo)

        self.assertTrue(event["success"])
        self.assertGreater(event["response_length"], 0)
        self.assertNotIn("tool_response", event)
        self.assertNotIn("sensitive output", str(event))

    def test_session_id_cannot_escape_log_directory(self):
        event = {
            "event": "UserPromptSubmit",
            "session_id": "../../outside",
            "turn_id": "turn-1",
            "timestamp": "2026-08-12T00:00:00+00:00",
        }

        path = append_event(self.repo, event)

        self.assertEqual(path.parent, self.repo / "ai" / "logs")
        self.assertNotIn("/", path.name)
        self.assertLessEqual(len(path.name), 96)

    def test_distinct_unsafe_session_ids_do_not_collide(self):
        self.assertNotEqual(safe_session_filename("a/b"), safe_session_filename("a?b"))

    def test_log_file_is_owner_only(self):
        event = {
            "event": "UserPromptSubmit",
            "session_id": "private-session",
            "turn_id": "turn-1",
            "timestamp": "2026-08-12T00:00:00+00:00",
        }

        path = append_event(self.repo, event)

        self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)

    def test_git_snapshot_preserves_leading_dot_in_first_modified_path(self):
        hidden_dir = self.repo / ".github"
        hidden_dir.mkdir()
        hidden_file = hidden_dir / "fixture.md"
        hidden_file.write_text("original\n", encoding="utf-8")
        run_git(self.repo, "add", ".github/fixture.md")
        run_git(self.repo, "commit", "-m", "add hidden path")
        hidden_file.write_text("changed\n", encoding="utf-8")

        snapshot = git_snapshot(self.repo)

        self.assertEqual(snapshot["dirty_files"], [".github/fixture.md"])

    def test_git_snapshot_expands_untracked_directories(self):
        nested = self.repo / "new" / "nested.txt"
        nested.parent.mkdir()
        nested.write_text("new\n", encoding="utf-8")

        snapshot = git_snapshot(self.repo)

        self.assertEqual(snapshot["dirty_files"], ["new/nested.txt"])


if __name__ == "__main__":
    unittest.main()
