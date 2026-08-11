import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


HOOK_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HOOK_DIR))

from log_ai_event import safe_session_filename


REPO_ROOT = Path(__file__).resolve().parents[3]
CONFIG = json.loads((REPO_ROOT / ".codex" / "hooks.json").read_text(encoding="utf-8"))


def run_git(repo: Path, *args: str) -> None:
    subprocess.run(
        ["git", *args],
        cwd=repo,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )


class HookEntrypointsTest(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.repo = Path(self.temp_dir.name)
        run_git(self.repo, "init")
        run_git(self.repo, "config", "user.name", "Hook Test")
        run_git(self.repo, "config", "user.email", "hook@example.com")
        (self.repo / "tracked.txt").write_text("baseline\n", encoding="utf-8")
        run_git(self.repo, "add", "tracked.txt")
        run_git(self.repo, "commit", "-m", "baseline")
        self.env = {**os.environ, "PYTHONDONTWRITEBYTECODE": "1"}

    def tearDown(self):
        self.temp_dir.cleanup()

    def command_for(self, event_name: str) -> str:
        command = CONFIG["hooks"][event_name][0]["hooks"][0]["command"]
        return command.replace(
            '"$(git rev-parse --show-toplevel)/.codex/hooks/log_ai_event.py"',
            f'"{HOOK_DIR / "log_ai_event.py"}"',
        ).replace(
            '"$(git rev-parse --show-toplevel)/.codex/hooks/summarize_ai_log.py"',
            f'"{HOOK_DIR / "summarize_ai_log.py"}"',
        )

    def invoke(self, event_name: str, payload: dict):
        return subprocess.run(
            self.command_for(event_name),
            cwd=self.repo,
            shell=True,
            input=json.dumps(payload),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=self.env,
        )

    def test_configured_commands_record_and_summarize_without_raw_secrets(self):
        session_id = "entrypoint-session"
        common = {
            "session_id": session_id,
            "turn_id": "turn-1",
            "cwd": str(self.repo),
        }
        prompt = self.invoke(
            "UserPromptSubmit",
            {
                **common,
                "hook_event_name": "UserPromptSubmit",
                "prompt": 'password="top secret phrase" inspect notifications',
            },
        )
        pre = self.invoke(
            "PreToolUse",
            {
                **common,
                "hook_event_name": "PreToolUse",
                "tool_name": "Bash",
                "tool_use_id": "tool-1",
                "tool_input": {"command": "python3 -m unittest discover -s tests"},
            },
        )
        post = self.invoke(
            "PostToolUse",
            {
                **common,
                "hook_event_name": "PostToolUse",
                "tool_name": "Bash",
                "tool_use_id": "tool-1",
                "tool_input": {"command": "python3 -m unittest discover -s tests"},
                "tool_response": {"exit_code": 0, "output": "private response body"},
            },
        )
        stop = self.invoke(
            "Stop",
            {
                **common,
                "hook_event_name": "Stop",
                "stop_hook_active": False,
                "last_assistant_message": "done",
            },
        )

        self.assertEqual([prompt.returncode, pre.returncode, post.returncode, stop.returncode], [0, 0, 0, 0])
        self.assertEqual(prompt.stdout, "")
        self.assertEqual(pre.stdout, "")
        self.assertEqual(post.stdout, "")
        self.assertEqual(json.loads(stop.stdout), {"continue": True})

        log_path = self.repo / "ai" / "logs" / safe_session_filename(session_id)
        log_text = log_path.read_text(encoding="utf-8")
        self.assertNotIn("top secret phrase", log_text)
        self.assertNotIn("private response body", log_text)
        self.assertIn('password=\\"[REDACTED]\\"', log_text)
        summaries = list((self.repo / "ai" / "summaries").glob("*.md"))
        self.assertEqual(len(summaries), 1)
        self.assertIn("python3 -m unittest", summaries[0].read_text(encoding="utf-8"))

    def test_concurrent_appends_produce_one_baseline_and_valid_jsonl(self):
        session_id = "concurrent-session"
        processes = []
        for index in range(8):
            payload = {
                "session_id": session_id,
                "turn_id": "turn-1",
                "cwd": str(self.repo),
                "hook_event_name": "PreToolUse",
                "tool_name": "Bash",
                "tool_use_id": f"tool-{index}",
                "tool_input": {"command": "git status --short"},
            }
            processes.append(
                subprocess.Popen(
                    self.command_for("PreToolUse"),
                    cwd=self.repo,
                    shell=True,
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    env=self.env,
                )
            )
            processes[-1].stdin.write(json.dumps(payload))
            processes[-1].stdin.close()

        for process in processes:
            self.assertEqual(process.wait(timeout=5), 0)
            process.stdout.read()
            process.stderr.read()
            process.stdout.close()
            process.stderr.close()

        log_path = self.repo / "ai" / "logs" / safe_session_filename(session_id)
        records = [json.loads(line) for line in log_path.read_text(encoding="utf-8").splitlines()]
        self.assertEqual(len(records), 9)
        self.assertEqual(sum(record["event"] == "SessionBaseline" for record in records), 1)

    def test_malformed_payload_fails_without_echoing_input(self):
        result = subprocess.run(
            self.command_for("UserPromptSubmit"),
            cwd=self.repo,
            shell=True,
            input="not-json-secret",
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=self.env,
        )

        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stdout, "")
        self.assertNotIn("not-json-secret", result.stderr)


if __name__ == "__main__":
    unittest.main()
