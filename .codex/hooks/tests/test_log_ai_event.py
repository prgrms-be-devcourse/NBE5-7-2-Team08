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
            "model": "gpt-5.6-sol",
            "permission_mode": "default",
            "prompt": prompt,
        }

        event = normalize_event(payload, self.repo)

        self.assertEqual(event["prompt_preview"], "PASSWORD=[REDACTED] fix DM query")
        self.assertEqual(event["prompt_length"], len(prompt))
        self.assertEqual(event["prompt_sha256"], sha256_text(prompt))
        self.assertEqual(event["model"], "gpt-5.6-sol")
        self.assertEqual(event["permission_mode"], "default")
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
            "model": "gpt-5.6-sol",
            "permission_mode": "default",
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
        self.assertEqual(records[0]["model"], "gpt-5.6-sol")
        self.assertEqual(records[0]["permission_mode"], "default")
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

    def test_subagent_start_records_role_and_permission_mode(self):
        payload = {
            "session_id": "session-1",
            "turn_id": "turn-1",
            "hook_event_name": "SubagentStart",
            "agent_id": "agent-42",
            "agent_type": "reviewer",
            "permission_mode": "default",
        }

        event = normalize_event(payload, self.repo)

        self.assertEqual(event["agent_id"], "agent-42")
        self.assertEqual(event["agent_type"], "reviewer")
        self.assertEqual(event["permission_mode"], "default")

    def test_subagent_stop_records_bounded_result_and_transcript_metadata(self):
        payload = {
            "session_id": "session-1",
            "turn_id": "turn-1",
            "hook_event_name": "SubagentStop",
            "agent_id": "agent-42",
            "agent_type": "reviewer",
            "agent_transcript_path": "/private/tmp/agent-42.jsonl",
            "stop_hook_active": False,
            "last_assistant_message": "PASSWORD=secret " + "검토 결과 " * 100,
        }

        event = normalize_event(payload, self.repo)

        self.assertEqual(event["agent_id"], "agent-42")
        self.assertEqual(event["agent_type"], "reviewer")
        self.assertEqual(event["agent_transcript_path"], "/private/tmp/agent-42.jsonl")
        self.assertFalse(event["stop_hook_active"])
        self.assertLessEqual(len(event["result_preview"]), 301)
        self.assertNotIn("secret", event["result_preview"])
        self.assertGreater(event["result_length"], 300)
        self.assertEqual(
            event["result_sha256"],
            sha256_text(payload["last_assistant_message"]),
        )
        self.assertNotIn("last_assistant_message", event)

    def test_permission_request_records_redacted_input_and_reason_without_decision(self):
        payload = {
            "session_id": "session-1",
            "turn_id": "turn-1",
            "hook_event_name": "PermissionRequest",
            "tool_name": "Bash",
            "tool_input": {
                "command": "PASSWORD=secret git push origin feat/hooks",
                "description": "원격 저장소 변경 승인",
            },
        }

        event = normalize_event(payload, self.repo)

        self.assertEqual(event["tool_name"], "Bash")
        self.assertEqual(
            event["tool_input_preview"],
            "PASSWORD=[REDACTED] git push origin feat/hooks",
        )
        self.assertEqual(event["reason_preview"], "원격 저장소 변경 승인")
        self.assertEqual(
            event["tool_input_sha256"],
            sha256_text(payload["tool_input"]["command"]),
        )
        self.assertNotIn("decision", event)

    def test_file_edit_records_affected_paths(self):
        payload = {
            "session_id": "session-1",
            "turn_id": "turn-1",
            "hook_event_name": "PreToolUse",
            "tool_name": "apply_patch",
            "tool_use_id": "tool-2",
            "tool_input": {
                "command": "*** Begin Patch\n*** Update File: AGENTS.md\n*** Add File: ai/note.md\n*** End Patch"
            },
        }

        event = normalize_event(payload, self.repo)

        self.assertEqual(event["affected_paths"], ["AGENTS.md", "ai/note.md"])
        self.assertGreater(event["tool_input_length"], 0)
        self.assertEqual(
            event["tool_input_sha256"],
            sha256_text(payload["tool_input"]["command"]),
        )

    def test_path_metadata_is_redacted_and_bounded(self):
        patch_lines = [
            f"*** Update File: docs/file-{index}.md"
            for index in range(120)
        ]
        patch_lines.append(
            "*** Update File: 000-password=topsecret/" + "x" * 600 + ".md"
        )
        payload = {
            "session_id": "session-1",
            "turn_id": "turn-1",
            "hook_event_name": "PreToolUse",
            "tool_name": "apply_patch",
            "tool_use_id": "tool-2",
            "tool_input": {"command": "\n".join(patch_lines)},
        }

        event = normalize_event(payload, self.repo)

        self.assertEqual(event["affected_paths_total"], 121)
        self.assertTrue(event["affected_paths_truncated"])
        self.assertEqual(len(event["affected_paths"]), 100)
        self.assertTrue(all(len(path) <= 501 for path in event["affected_paths"]))
        self.assertNotIn("topsecret", str(event["affected_paths"]))

    def test_subagent_transcript_path_is_redacted_and_bounded(self):
        payload = {
            "session_id": "session-1",
            "turn_id": "turn-1",
            "hook_event_name": "SubagentStop",
            "agent_id": "agent-42",
            "agent_type": "reviewer",
            "agent_transcript_path": (
                "/private/tmp/password=topsecret/" + "x" * 600 + ".jsonl"
            ),
        }

        event = normalize_event(payload, self.repo)

        self.assertNotIn("topsecret", event["agent_transcript_path"])
        self.assertLessEqual(len(event["agent_transcript_path"]), 501)

    def test_failed_tool_records_exit_code_and_bounded_redacted_error(self):
        payload = {
            "session_id": "session-1",
            "turn_id": "turn-1",
            "hook_event_name": "PostToolUse",
            "tool_name": "Bash",
            "tool_use_id": "tool-3",
            "tool_input": {"command": "./gradlew test"},
            "tool_response": {
                "exit_code": 1,
                "output": "PASSWORD=secret " + "failure " * 200,
            },
        }

        event = normalize_event(payload, self.repo)

        self.assertFalse(event["success"])
        self.assertEqual(event["exit_code"], 1)
        self.assertLessEqual(len(event["error_preview"]), 501)
        self.assertNotIn("secret", event["error_preview"])

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
