import json
import sys
import tempfile
import unittest
from pathlib import Path


HOOK_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HOOK_DIR))

from token_usage import normalize_token_usage_event, read_latest_token_usage


TOTAL_USAGE = {
    "input_tokens": 1200,
    "cached_input_tokens": 900,
    "cache_write_input_tokens": 10,
    "output_tokens": 200,
    "reasoning_output_tokens": 50,
    "total_tokens": 1400,
}
LAST_USAGE = {
    "input_tokens": 300,
    "cached_input_tokens": 240,
    "cache_write_input_tokens": 0,
    "output_tokens": 40,
    "reasoning_output_tokens": 10,
    "total_tokens": 340,
}


class TokenUsageTest(unittest.TestCase):
    def test_normalizes_rollout_token_count(self):
        record = {
            "type": "event_msg",
            "payload": {
                "type": "token_count",
                "info": {
                    "total_token_usage": TOTAL_USAGE,
                    "last_token_usage": LAST_USAGE,
                    "model_context_window": 258400,
                },
            },
        }

        usage = normalize_token_usage_event(record)

        self.assertEqual(usage["source"], "codex_rollout")
        self.assertEqual(usage["total"], TOTAL_USAGE)
        self.assertEqual(usage["last"], LAST_USAGE)
        self.assertEqual(usage["model_context_window"], 258400)

    def test_normalizes_app_server_notification(self):
        record = {
            "method": "thread/tokenUsage/updated",
            "params": {
                "threadId": "thread-1",
                "turnId": "turn-2",
                "tokenUsage": {
                    "total": {
                        "inputTokens": 1200,
                        "cachedInputTokens": 900,
                        "cacheWriteInputTokens": 10,
                        "outputTokens": 200,
                        "reasoningOutputTokens": 50,
                        "totalTokens": 1400,
                    },
                    "last": {
                        "inputTokens": 300,
                        "cachedInputTokens": 240,
                        "cacheWriteInputTokens": 0,
                        "outputTokens": 40,
                        "reasoningOutputTokens": 10,
                        "totalTokens": 340,
                    },
                    "modelContextWindow": 258400,
                },
            },
        }

        usage = normalize_token_usage_event(record)

        self.assertEqual(usage["source"], "codex_app_server")
        self.assertEqual(usage["thread_id"], "thread-1")
        self.assertEqual(usage["turn_id"], "turn-2")
        self.assertEqual(usage["total"], TOTAL_USAGE)
        self.assertEqual(usage["last"], LAST_USAGE)

    def test_rejects_incomplete_negative_or_boolean_usage(self):
        for invalid_total in (
            {**TOTAL_USAGE, "total_tokens": -1},
            {**TOTAL_USAGE, "input_tokens": True},
            {key: value for key, value in TOTAL_USAGE.items() if key != "output_tokens"},
        ):
            with self.subTest(total=invalid_total):
                record = {
                    "type": "event_msg",
                    "payload": {
                        "type": "token_count",
                        "info": {
                            "total_token_usage": invalid_total,
                            "last_token_usage": LAST_USAGE,
                        },
                    },
                }
                self.assertIsNone(normalize_token_usage_event(record))

    def test_rejects_invalid_optional_cache_write_value_but_defaults_when_absent(self):
        for invalid_value in (-1, True, "10"):
            with self.subTest(cache_write_input_tokens=invalid_value):
                record = {
                    "type": "event_msg",
                    "payload": {
                        "type": "token_count",
                        "info": {
                            "total_token_usage": {
                                **TOTAL_USAGE,
                                "cache_write_input_tokens": invalid_value,
                            },
                            "last_token_usage": LAST_USAGE,
                        },
                    },
                }
                self.assertIsNone(normalize_token_usage_event(record))

        without_cache_write = {
            key: value
            for key, value in TOTAL_USAGE.items()
            if key != "cache_write_input_tokens"
        }
        record = {
            "type": "event_msg",
            "payload": {
                "type": "token_count",
                "info": {
                    "total_token_usage": without_cache_write,
                    "last_token_usage": LAST_USAGE,
                },
            },
        }
        self.assertEqual(
            normalize_token_usage_event(record)["total"]["cache_write_input_tokens"],
            0,
        )

    def test_reads_last_valid_usage_without_using_later_malformed_record(self):
        older = {
            "type": "event_msg",
            "payload": {
                "type": "token_count",
                "info": {
                    "total_token_usage": {**TOTAL_USAGE, "total_tokens": 1000},
                    "last_token_usage": LAST_USAGE,
                },
            },
        }
        latest = {
            "type": "event_msg",
            "payload": {
                "type": "token_count",
                "info": {
                    "total_token_usage": TOTAL_USAGE,
                    "last_token_usage": LAST_USAGE,
                },
            },
        }
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "rollout.jsonl"
            path.write_text(
                "\n".join(
                    [
                        json.dumps(older),
                        json.dumps(latest),
                        "not-json",
                    ]
                )
                + "\n",
                encoding="utf-8",
            )

            usage = read_latest_token_usage(path)

        self.assertEqual(usage["total"]["total_tokens"], 1400)

    def test_missing_transcript_returns_none(self):
        self.assertIsNone(read_latest_token_usage(Path("/missing/rollout.jsonl")))

    def test_invalid_path_or_non_utf8_transcript_returns_none(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "invalid.jsonl"
            path.write_bytes(b"\xff\xfe\n")
            self.assertIsNone(read_latest_token_usage(path))
        self.assertIsNone(read_latest_token_usage(Path("invalid\0path")))

    def test_app_server_stream_skips_other_threads_and_turns(self):
        def notification(thread_id, turn_id, total_tokens):
            total = {**TOTAL_USAGE, "total_tokens": total_tokens}
            return {
                "method": "thread/tokenUsage/updated",
                "params": {
                    "threadId": thread_id,
                    "turnId": turn_id,
                    "tokenUsage": {
                        "total": {
                            "inputTokens": total["input_tokens"],
                            "cachedInputTokens": total["cached_input_tokens"],
                            "cacheWriteInputTokens": total["cache_write_input_tokens"],
                            "outputTokens": total["output_tokens"],
                            "reasoningOutputTokens": total["reasoning_output_tokens"],
                            "totalTokens": total["total_tokens"],
                        },
                        "last": {
                            "inputTokens": LAST_USAGE["input_tokens"],
                            "cachedInputTokens": LAST_USAGE["cached_input_tokens"],
                            "cacheWriteInputTokens": LAST_USAGE["cache_write_input_tokens"],
                            "outputTokens": LAST_USAGE["output_tokens"],
                            "reasoningOutputTokens": LAST_USAGE["reasoning_output_tokens"],
                            "totalTokens": LAST_USAGE["total_tokens"],
                        },
                    },
                },
            }

        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "notifications.jsonl"
            path.write_text(
                "\n".join(
                    json.dumps(record)
                    for record in (
                        notification("wanted", "turn-1", 111),
                        notification("wanted", "other-turn", 222),
                        notification("other", "turn-1", 333),
                    )
                )
                + "\n",
                encoding="utf-8",
            )

            usage = read_latest_token_usage(
                path,
                expected_thread_id="wanted",
                expected_turn_id="turn-1",
            )

        self.assertEqual(usage["thread_id"], "wanted")
        self.assertEqual(usage["turn_id"], "turn-1")
        self.assertEqual(usage["total"]["total_tokens"], 111)

    def test_reads_record_spanning_reverse_reader_chunk_boundary(self):
        record = {
            "type": "event_msg",
            "payload": {
                "type": "token_count",
                "info": {
                    "total_token_usage": TOTAL_USAGE,
                    "last_token_usage": LAST_USAGE,
                },
            },
            "padding": "x" * 9000,
        }
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "large-rollout.jsonl"
            path.write_text(json.dumps(record) + "\n", encoding="utf-8")

            usage = read_latest_token_usage(path)

        self.assertEqual(usage["total"]["total_tokens"], 1400)


if __name__ == "__main__":
    unittest.main()
