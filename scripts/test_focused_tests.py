import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import focused_tests


class FocusedTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        subprocess.run(["git", "init", "-q", str(self.root)], check=True)

    def put(self, name: str, content: str = "", tracked: bool = True) -> Path:
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
        if tracked:
            subprocess.run(["git", "add", "--", name], cwd=self.root, check=True)
        return path

    def test_js_adjacent_dotted_and_explicit_tests_deduplicated(self) -> None:
        self.put("js/src/client.ts")
        self.put("js/src/client.test.ts")
        self.put("js/src/client.extend.type.test.ts")
        self.put("js/src/clientele.test.ts")
        self.put("js/tests/regression.spec.ts")
        selected = focused_tests.select_js(self.root, "js", [
            "js/src/client.ts", "js/src/client.test.ts", "js/tests/regression.spec.ts",
            "js/src/deleted.ts",
        ])
        self.assertEqual(selected, ["src/client.extend.type.test.ts", "src/client.test.ts", "tests/regression.spec.ts"])

    def test_js_never_selects_e2e_tests(self) -> None:
        self.put("js/src/actions/get_current_user.ts")
        self.put("js/src/actions/get_current_user.test.ts")
        self.put("js/src/actions/get_current_user.e2e.test.ts")
        self.put("cli/test/e2e-full/nodes-list.test.ts")
        self.put("cli/test/nodes.test.ts")
        self.assertEqual(focused_tests.select_js(self.root, "js", ["js/src/actions/get_current_user.ts"]),
                         ["src/actions/get_current_user.test.ts"])
        self.assertEqual(focused_tests.select_js(self.root, "js", ["js/src/actions/get_current_user.e2e.test.ts"]), [])
        self.assertEqual(focused_tests.select_js(self.root, "cli", [
            "cli/test/e2e-full/nodes-list.test.ts", "cli/test/nodes.test.ts"]), ["test/nodes.test.ts"])

    def test_untracked_adjacent_tests_are_not_selected(self) -> None:
        self.put("js/src/client.ts")
        self.put("js/src/client.test.ts", tracked=False)
        self.put("go/client.go")
        self.put("go/client_test.go", "func TestFuture(t *testing.T) {}\n", tracked=False)
        self.assertEqual(focused_tests.select_js(self.root, "js", ["js/src/client.ts"]), [])
        self.assertEqual(focused_tests.go_commands(self.root, ["go/client.go"]), [])

    def test_go_names_by_package_and_safe_arguments(self) -> None:
        self.put("go/a/source file.go")
        self.put("go/a/source file_test.go", "func TestOne(t *testing.T) {}\nfunc ExampleTwo() {}\nfunc FuzzThree(f *testing.F) {}\n")
        self.put("go/b/other_test.go", "func TestOther(t *testing.T) {}\n")
        commands = focused_tests.go_commands(self.root, ["go/a/source file.go", "go/b/other_test.go"])
        self.assertEqual(commands, [
            (["a/source file_test.go"], ["go", "test", "./a", "-run", "^(ExampleTwo|FuzzThree|TestOne)$", "-count=1"]),
            (["b/other_test.go"], ["go", "test", "./b", "-run", "^(TestOther)$", "-count=1"]),
        ])

    def test_no_fallback_and_exit_status(self) -> None:
        self.put("js/src/unmapped.ts")
        with patch.object(focused_tests, "ROOT", self.root), patch("focused_tests.run_tests") as run:
            self.assertEqual(focused_tests.main(["js", "js/src/unmapped.ts"]), 1)
            run.assert_not_called()
        self.put("js/src/unmapped.test.ts")
        with patch.object(focused_tests, "ROOT", self.root), patch("focused_tests.run_tests") as run:
            run.return_value = 7
            self.assertEqual(focused_tests.main(["js", "js/src/unmapped.ts"]), 7)
            self.assertEqual(run.call_args.args[0], ["bun", "run", "vitest", "run", "src/unmapped.test.ts"])

    def test_no_arguments_and_deleted_paths_never_run_tests(self) -> None:
        with patch.object(focused_tests, "ROOT", self.root), patch("focused_tests.run_tests") as run:
            for args in ([], ["go"], ["js"], ["cli"], ["go", "go/deleted_test.go"], ["cli", "cli/src/deleted.ts"]):
                self.assertEqual(focused_tests.main(args), 1)
            run.assert_not_called()

    def test_unmapped_source_uses_explicit_regression(self) -> None:
        self.put("js/src/unmapped.ts")
        self.put("js/tests/regression.spec.ts")
        self.assertEqual(focused_tests.select_js(self.root, "js", [
            "js/src/unmapped.ts", "js/tests/regression.spec.ts",
        ]), ["tests/regression.spec.ts"])

    def test_go_file_without_root_tests_fails(self) -> None:
        self.put("go/empty_test.go", "func helper() {}\n")
        with patch.object(focused_tests, "ROOT", self.root), patch("focused_tests.run_tests") as run:
            self.assertEqual(focused_tests.main(["go", "go/empty_test.go"]), 1)
            run.assert_not_called()

    def test_run_tests_passes_argv_and_preserves_status(self) -> None:
        command = ["bun", "test", "./test/a space.test.ts"]
        with patch("focused_tests.subprocess.run") as run:
            run.return_value.returncode = 23
            self.assertEqual(focused_tests.run_tests(command, self.root), 23)
            run.assert_called_once_with(command, cwd=self.root, check=False)

    def test_cli_uses_bun_runner_and_explicit_files(self) -> None:
        self.put("cli/test/create-client.parity.test.ts")
        with patch.object(focused_tests, "ROOT", self.root), patch("focused_tests.run_tests") as run:
            run.return_value = 0
            self.assertEqual(focused_tests.main(["cli", "cli/test/create-client.parity.test.ts"]), 0)
            self.assertEqual(run.call_args.args[0], ["bun", "test", "./test/create-client.parity.test.ts"])


if __name__ == "__main__":
    unittest.main()
