import sys
import unittest
from pathlib import Path


HOOK_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HOOK_DIR))

from guard_policy import evaluate


CWD = "/workspace/devchat"


class GuardPolicyTest(unittest.TestCase):
    def assert_denied(self, command: str, policy_id: str) -> None:
        violation = evaluate("Bash", command, CWD)

        self.assertIsNotNone(violation)
        self.assertEqual(violation[0], policy_id)
        self.assertIn(policy_id, violation[1])
        self.assertNotIn(command, violation[1])

    def test_git_destructive_commands_are_denied_but_scoped_git_commands_are_allowed(self):
        for command in (
            "git reset --hard",
            "git clean -fd",
            "git push --force origin main",
            "git checkout -- .",
            "git restore .",
        ):
            with self.subTest(command=command):
                self.assert_denied(command, "GIT_DESTRUCTIVE")

        for command in (
            "git restore --source=HEAD src/App.java",
            "git checkout feat/logging-hooks",
            "git push origin feat/permission-guard",
        ):
            with self.subTest(command=command):
                self.assertIsNone(evaluate("Bash", command, CWD))

    def test_recursive_delete_of_broad_or_ambiguous_paths_is_denied_but_build_cleanup_is_allowed(self):
        for command in (
            "rm -rf .",
            "rm -rf ..",
            "rm -rf /",
            "rm -rf /workspace/devchat",
            "rm -rf /workspace",
            'rm -rf "$HOME"',
            'rm -rf "$TARGET"',
        ):
            with self.subTest(command=command):
                self.assert_denied(command, "RECURSIVE_DELETE")

        self.assertIsNone(evaluate("Bash", "rm -rf backend/build", CWD))

    def test_secret_patch_write_is_denied_but_non_secret_patch_is_allowed(self):
        for path in (".env", ".env.production", "deploy-key.pem", "credentials.json"):
            command = f"*** Update File: {path}\n@@\n-old\n+new\n"
            with self.subTest(path=path):
                violation = evaluate("apply_patch", command, CWD)
                self.assertIsNotNone(violation)
                self.assertEqual(violation[0], "SECRET_FILE_WRITE")
                self.assertIn("SECRET_FILE_WRITE", violation[1])
                self.assertNotIn(path, violation[1])

        safe_patch = "*** Update File: config/application.yml\n@@\n-old\n+new\n"
        self.assertIsNone(evaluate("apply_patch", safe_patch, CWD))

    def test_production_deploy_is_denied_but_non_production_deploy_is_allowed(self):
        for command in (
            "./deploy.sh production",
            "docker compose -f docker-compose.prod.yml up -d",
            "docker rm production-api",
        ):
            with self.subTest(command=command):
                self.assert_denied(command, "PRODUCTION_DEPLOY")

        for command in (
            "./deploy.sh staging",
            "docker compose -f docker-compose.dev.yml up -d",
            "docker rm dev-api",
        ):
            with self.subTest(command=command):
                self.assertIsNone(evaluate("Bash", command, CWD))

    def test_database_destructive_command_is_denied_but_scoped_query_is_allowed(self):
        for command in (
            'psql "$DATABASE_URL" -c "DROP TABLE users"',
            "mysql -e 'TRUNCATE TABLE audit_log'",
            "psql -c 'DELETE FROM audit_log'",
        ):
            with self.subTest(command=command):
                self.assert_denied(command, "DATABASE_DESTRUCTIVE")

        for command in (
            "psql -c 'SELECT * FROM users'",
            "psql -c 'DELETE FROM audit_log WHERE id = 1'",
        ):
            with self.subTest(command=command):
                self.assertIsNone(evaluate("Bash", command, CWD))

    def test_unscoped_stage_is_denied_but_selected_paths_are_allowed(self):
        for command in ("git add .", "git add -A"):
            with self.subTest(command=command):
                self.assert_denied(command, "UNSCOPED_GIT_STAGE")

        self.assertIsNone(
            evaluate("Bash", "git add .codex/hooks/guard_policy.py", CWD)
        )

    def test_risky_subcommands_in_operators_and_quotes_are_denied(self):
        self.assert_denied("git status && git reset --hard", "GIT_DESTRUCTIVE")
        self.assert_denied("printf safe | git add .", "UNSCOPED_GIT_STAGE")
        self.assert_denied("sh -c 'git clean -fd'", "GIT_DESTRUCTIVE")

    def test_shell_quoted_fragments_cannot_hide_git_options(self):
        for command, policy_id in (
            ("git reset --h''ard", "GIT_DESTRUCTIVE"),
            ("git push --fo''rce origin main", "GIT_DESTRUCTIVE"),
            ("git add -''A", "UNSCOPED_GIT_STAGE"),
            ("git reset --h$'ard'", "GIT_DESTRUCTIVE"),
            ("git push --fo$'rce' origin main", "GIT_DESTRUCTIVE"),
            ("git add -$'A'", "UNSCOPED_GIT_STAGE"),
            ("git reset --h$'\\x61'rd", "GIT_DESTRUCTIVE"),
        ):
            with self.subTest(command=command):
                self.assert_denied(command, policy_id)

    def test_other_tools_are_allowed(self):
        self.assertIsNone(evaluate("Read", "ignored", CWD))


if __name__ == "__main__":
    unittest.main()
