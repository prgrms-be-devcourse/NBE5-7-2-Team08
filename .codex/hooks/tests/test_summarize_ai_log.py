import fcntl
import json
import sys
import tempfile
import threading
import unittest
from pathlib import Path


HOOK_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HOOK_DIR))

from summarize_ai_log import build_summary, is_verification_command, read_records


class SummarizeAiLogTest(unittest.TestCase):
    def setUp(self):
        self.records = [
            {
                "event": "SessionBaseline",
                "session_id": "session-1",
                "turn_id": "turn-1",
                "base_commit": "abc123",
                "branch": "feat/hooks",
                "initial_dirty_files": ["backend/existing.java"],
            },
            {
                "event": "PreToolUse",
                "tool_name": "Bash",
                "tool_use_id": "tool-1",
                "tool_input_preview": "./gradlew test",
            },
            {
                "event": "PostToolUse",
                "tool_name": "Bash",
                "tool_use_id": "tool-1",
                "tool_input_preview": "./gradlew test",
                "success": True,
            },
        ]
        self.current_snapshot = {
            "base_commit": "abc123",
            "branch": "feat/hooks",
            "dirty_files": ["backend/existing.java", ".codex/hooks.json"],
        }

    def test_detects_verification_commands(self):
        commands = [
            "./gradlew test",
            "./gradlew compileJava",
            "npm test",
            "yarn build",
            "bash backend/perf/query-analysis/tests/query_analysis_contract_test.sh",
            "k6 run backend/perf/query-analysis/query.js",
            "python3 -m unittest discover -s .codex/hooks/tests",
        ]
        self.assertTrue(all(is_verification_command(command) for command in commands))
        self.assertFalse(is_verification_command("git status --short"))
        self.assertFalse(is_verification_command("rm -rf build && ./gradlew test"))

    def test_summary_separates_initial_and_new_dirty_files(self):
        summary = build_summary(self.records, self.current_snapshot)

        self.assertIn("기존 미커밋 파일", summary)
        self.assertIn("backend/existing.java", summary)
        self.assertIn("Hook 실행 후 추가된 파일", summary)
        self.assertIn(".codex/hooks.json", summary)

    def test_summary_lists_verification_result_and_review_placeholders(self):
        summary = build_summary(self.records, self.current_snapshot)

        self.assertIn("./gradlew test", summary)
        self.assertIn("성공", summary)
        self.assertIn("채택한 제안과 이유:", summary)
        self.assertIn("기각한 제안과 이유:", summary)
        self.assertIn("남은 리스크:", summary)

    def test_summary_lists_failed_tool_without_response_body(self):
        records = self.records + [
            {
                "event": "PostToolUse",
                "tool_name": "Bash",
                "tool_use_id": "tool-2",
                "tool_input_preview": "./gradlew compileJava",
                "success": False,
                "response_length": 100,
                "response_sha256": "digest-only",
            }
        ]

        summary = build_summary(records, self.current_snapshot)

        self.assertIn("tool-2", summary)
        self.assertIn("./gradlew compileJava", summary)
        self.assertNotIn("digest-only", summary)

    def test_log_reader_waits_for_exclusive_writer_lock(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "session.jsonl"
            path.write_text(json.dumps({"event": "SessionBaseline"}) + "\n", encoding="utf-8")
            finished = threading.Event()
            observed = []

            with path.open("a+", encoding="utf-8") as writer:
                fcntl.flock(writer.fileno(), fcntl.LOCK_EX)

                def read_in_thread():
                    observed.extend(read_records(path))
                    finished.set()

                thread = threading.Thread(target=read_in_thread)
                thread.start()
                self.assertFalse(finished.wait(0.1))
                fcntl.flock(writer.fileno(), fcntl.LOCK_UN)
                self.assertTrue(finished.wait(1))
                thread.join()

            self.assertEqual(observed, [{"event": "SessionBaseline"}])


if __name__ == "__main__":
    unittest.main()
