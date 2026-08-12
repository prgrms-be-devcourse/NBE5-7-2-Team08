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

    def test_summary_lists_exact_token_snapshot_without_claiming_savings(self):
        records = self.records + [
            {
                "event": "TokenUsageSnapshot",
                "source": "codex_rollout",
                "total": {
                    "input_tokens": 1200,
                    "cached_input_tokens": 900,
                    "cache_write_input_tokens": 10,
                    "output_tokens": 200,
                    "reasoning_output_tokens": 50,
                    "total_tokens": 1400,
                },
                "last": {
                    "input_tokens": 300,
                    "cached_input_tokens": 240,
                    "cache_write_input_tokens": 0,
                    "output_tokens": 40,
                    "reasoning_output_tokens": 10,
                    "total_tokens": 340,
                },
                "model_context_window": 258400,
            }
        ]

        summary = build_summary(records, self.current_snapshot)

        self.assertIn("## 토큰 사용량", summary)
        self.assertIn("누적: 총 1,400", summary)
        self.assertIn("입력 1,200", summary)
        self.assertIn("캐시 입력 900", summary)
        self.assertIn("최근 응답: 총 340", summary)
        self.assertNotIn("절감", summary)

    def test_summary_rejects_boolean_or_negative_historical_token_values(self):
        for invalid_value in (True, -1):
            with self.subTest(total_tokens=invalid_value):
                records = self.records + [
                    {
                        "event": "TokenUsageSnapshot",
                        "total": {
                            "input_tokens": 10,
                            "cached_input_tokens": 5,
                            "output_tokens": 2,
                            "reasoning_output_tokens": 1,
                            "total_tokens": invalid_value,
                        },
                        "last": {},
                    }
                ]

                summary = build_summary(records, self.current_snapshot)

                self.assertIn("## 토큰 사용량\n\n- 정보 없음", summary)

    def test_summary_does_not_display_invalid_historical_context_window(self):
        for invalid_value in (True, -1):
            with self.subTest(model_context_window=invalid_value):
                records = self.records + [
                    {
                        "event": "TokenUsageSnapshot",
                        "total": {
                            "input_tokens": 10,
                            "cached_input_tokens": 5,
                            "output_tokens": 2,
                            "reasoning_output_tokens": 1,
                            "total_tokens": 12,
                        },
                        "last": {
                            "input_tokens": 4,
                            "cached_input_tokens": 2,
                            "output_tokens": 1,
                            "reasoning_output_tokens": 0,
                            "total_tokens": 5,
                        },
                        "model_context_window": invalid_value,
                    }
                ]

                summary = build_summary(records, self.current_snapshot)

                self.assertNotIn("모델 컨텍스트 윈도우:", summary)

    def test_summary_connects_subagents_permissions_paths_and_failure_details(self):
        records = self.records + [
            {
                "event": "SubagentStart",
                "agent_id": "agent-42",
                "agent_type": "reviewer",
            },
            {
                "event": "SubagentStop",
                "agent_id": "agent-42",
                "agent_type": "reviewer",
                "result_preview": "인증 경계의 회귀 가능성을 확인함",
            },
            {
                "event": "PermissionRequest",
                "tool_name": "Bash",
                "tool_input_preview": "git push origin feat/hooks",
                "reason_preview": "원격 저장소 변경 승인",
            },
            {
                "event": "PreToolUse",
                "tool_name": "apply_patch",
                "tool_use_id": "tool-2",
                "tool_input_preview": "patch",
                "affected_paths": ["AGENTS.md", ".codex/hooks.json"],
                "affected_paths_total": 121,
                "affected_paths_truncated": True,
            },
            {
                "event": "PostToolUse",
                "tool_name": "Bash",
                "tool_use_id": "tool-3",
                "tool_input_preview": "./gradlew test",
                "success": False,
                "exit_code": 1,
                "error_preview": "테스트 1건 실패",
            },
        ]

        summary = build_summary(records, self.current_snapshot)

        self.assertIn("## 서브에이전트 실행", summary)
        self.assertIn("reviewer", summary)
        self.assertIn("인증 경계의 회귀 가능성을 확인함", summary)
        self.assertIn("## 승인 요청", summary)
        self.assertIn("원격 저장소 변경 승인", summary)
        self.assertIn("승인 결과 미확인", summary)
        self.assertIn("## 도구가 대상으로 기록한 파일", summary)
        self.assertIn("AGENTS.md", summary)
        self.assertIn(".codex/hooks.json", summary)
        self.assertIn("1개 도구 호출에서 경로 제한 적용", summary)
        self.assertIn("한 호출 최대 121개 감지", summary)
        self.assertIn("exit 1", summary)
        self.assertIn("테스트 1건 실패", summary)

    def test_summary_bounds_paths_across_multiple_truncated_calls(self):
        records = self.records + [
            {
                "event": "PreToolUse",
                "tool_use_id": "tool-first",
                "affected_paths": [f"first/{index}.md" for index in range(100)],
                "affected_paths_total": 150,
                "affected_paths_truncated": True,
            },
            {
                "event": "PostToolUse",
                "tool_use_id": "tool-first",
                "affected_paths": [f"first/{index}.md" for index in range(100)],
                "affected_paths_total": 150,
                "affected_paths_truncated": True,
                "success": True,
            },
            {
                "event": "PreToolUse",
                "tool_use_id": "tool-second",
                "affected_paths": [f"second/{index}.md" for index in range(100)],
                "affected_paths_total": 175,
                "affected_paths_truncated": True,
            },
            {
                "event": "PostToolUse",
                "tool_use_id": "tool-second",
                "affected_paths": [f"second/{index}.md" for index in range(100)],
                "affected_paths_total": 175,
                "affected_paths_truncated": True,
                "success": True,
            },
        ]

        summary = build_summary(records, self.current_snapshot)
        path_section = summary.split("## 도구가 대상으로 기록한 파일", 1)[1].split(
            "## 서브에이전트 실행", 1
        )[0]

        self.assertEqual(path_section.count("\n- first/"), 100)
        self.assertNotIn("second/", path_section)
        self.assertIn("2개 도구 호출에서 경로 제한 적용", path_section)
        self.assertIn("한 호출 최대 175개 감지", path_section)

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
