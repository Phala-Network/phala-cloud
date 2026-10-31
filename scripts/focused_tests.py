#!/usr/bin/env python3
"""Run conventionally associated tests for paths passed by pre-commit.

This is a filename-based selection, not transitive dependency analysis. Stage an
explicit regression test when the affected test is not adjacent to its source.
"""

import os
import re
import subprocess
import sys
from collections.abc import Sequence
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEST_FILE = re.compile(r"\.(?:test|spec)\.[cm]?[jt]sx?$")
GO_TEST = re.compile(r"(?m)^func\s+((?:Test|Example|Fuzz)(?:[A-Z0-9_][A-Za-z0-9_]*)?)\s*\(")


def indexed_files(root: Path, project: str) -> set[str]:
    output = subprocess.check_output(["git", "ls-files", "--cached", "-z", "--", project], cwd=root)
    return {os.fsdecode(name) for name in output.split(b"\0") if name}


def is_e2e(relative: Path) -> bool:
    """E2E tests need live services and never run from the commit hook."""
    return ".e2e.test." in relative.name or "e2e-full" in relative.parts


def select_js(root: Path, project: str, filenames: Sequence[str]) -> list[str]:
    base = root / project
    indexed = indexed_files(root, project)
    selected = set()
    for filename in filenames:
        path = root / filename
        if filename not in indexed or not path.is_file():
            continue
        if is_e2e(path.relative_to(base)):
            continue
        if TEST_FILE.search(path.name):
            selected.add(path.relative_to(base).as_posix())
            continue
        stem = path.stem
        for candidate in path.parent.iterdir():
            if (candidate.relative_to(root).as_posix() in indexed and candidate.is_file()
                    and candidate.name.startswith(stem + ".") and TEST_FILE.search(candidate.name)
                    and not is_e2e(candidate.relative_to(base))):
                selected.add(candidate.relative_to(base).as_posix())
    return sorted(selected)


# Source files whose behaviour is exercised by tests that do not share their stem.
# Derived from which test files call each source file's functions. The SDK is one
# root package, so this keeps the hook from running the whole suite locally.
_TRANSPORT_TESTS = (
    "client_test.go", "errors_test.go", "parity_auth_test.go", "parity_version_test.go",
    "redirect_security_test.go", "request_compat_test.go", "retry_test.go",
)
GO_RELATED_TESTS: dict[str, tuple[str, ...]] = {
    "client.go": _TRANSPORT_TESTS,
    "client_options.go": _TRANSPORT_TESTS,
    "request.go": _TRANSPORT_TESTS,
    "retry.go": _TRANSPORT_TESTS,
    "errors.go": _TRANSPORT_TESTS,
    "auth.go": ("parity_actions_test.go", "parity_auth_test.go"),
    "apps.go": ("placement_identifiers_test.go",),
    "compose_hash.go": ("compose_hash_vectors_test.go", "parity_hash_test.go"),
    "cvms.go": ("parity_confirm_test.go", "parity_provision_test.go", "parity_env_schema_test.go",
                "parity_actions_test.go", "placement_identifiers_test.go", "create_node_test.go"),
    "cvms_compose.go": ("parity_compose_read_test.go", "parity_env_schema_test.go", "cvms_config_test.go"),
    "cvms_config.go": ("parity_actions_test.go", "parity_arrays_test.go"),
    "cvms_watch.go": ("parity_watch_test.go", "parity_watch_timeout_test.go", "redirect_security_test.go"),
    "types_cvms.go": ("parity_arrays_test.go",),
    "types_kms.go": ("kms_contract_test.go", "nodes_test.go"),
}
GO_BUILD_FILES = ("go.mod", "go.sum")


def go_commands(
    root: Path, filenames: Sequence[str]
) -> tuple[list[tuple[list[str], list[str]]], list[str]]:
    """Return (commands, unmapped source files) for staged Go paths.

    Tests are chosen by name: the adjacent <stem>_test.go plus GO_RELATED_TESTS.
    Changes to go.mod/go.sum run build and vet instead of any tests.
    """
    base = root / "go"
    indexed = indexed_files(root, "go")
    selected: set[Path] = set()
    build_files: list[str] = []
    unmapped: list[str] = []
    for filename in filenames:
        path = root / filename
        if filename not in indexed or not path.is_file():
            continue
        relative = path.relative_to(base)
        if relative.parts[0] == "e2e":
            continue
        if relative.as_posix() in GO_BUILD_FILES:
            build_files.append(relative.as_posix())
        elif path.name.endswith("_test.go"):
            selected.add(path)
        elif path.suffix == ".go":
            related = [path.with_name(path.stem + "_test.go")]
            related += [path.with_name(name) for name in GO_RELATED_TESTS.get(path.name, ())]
            found = [c for c in related if c.relative_to(root).as_posix() in indexed and c.is_file()]
            selected.update(found)
            if not found:
                unmapped.append(relative.as_posix())
    packages: dict[str, tuple[list[str], set[str]]] = {}
    for path in sorted(selected):
        relative = path.relative_to(base)
        package = relative.parent.as_posix()
        files, names = packages.setdefault(package, ([], set()))
        files.append(relative.as_posix())
        names.update(GO_TEST.findall(path.read_text(encoding="utf-8")))
    commands = []
    for package, (files, names) in sorted(packages.items()):
        if not names:
            raise ValueError(f"No root Go tests found in: {', '.join(files)}")
        target = "." if package == "." else "./" + package
        pattern = "^(" + "|".join(re.escape(name) for name in sorted(names)) + ")$"
        commands.append((files, ["go", "test", target, "-run", pattern, "-count=1"]))
    if build_files:
        commands.append((build_files, ["go", "build", "./..."]))
        commands.append((build_files, ["go", "vet", "./..."]))
    return commands, unmapped


def run_tests(command: list[str], cwd: Path) -> int:
    return subprocess.run(command, cwd=cwd, check=False).returncode


def main(args: Sequence[str]) -> int:
    if not args or args[0] not in ("go", "js", "cli"):
        print("Usage: focused_tests.py {go|js|cli} STAGED_FILE...", file=sys.stderr)
        return 1
    project, *filenames = args
    try:
        if project == "go":
            commands, unmapped = go_commands(ROOT, filenames)
            for filename in unmapped:
                print(f"No Go tests mapped to go/{filename}; the full Go suite runs in CI.", flush=True)
            if unmapped and not commands:
                return 0
        else:
            files = select_js(ROOT, project, filenames)
            if project == "js":
                command = ["bun", "run", "vitest", "run", *files]
            else:
                command = ["bun", "test", *("./" + name for name in files)]
            commands = [(files, command)] if files else []
        if not commands:
            raise ValueError("No related tests selected. Stage a focused regression test for this change.")
        for files, command in commands:
            print("Selected test files:", flush=True)
            for filename in files:
                print(f"  {project}/{filename}", flush=True)
            if "-run" in command:
                print(f"Selected Go test names: {command[command.index('-run') + 1]}", flush=True)
            status = run_tests(command, ROOT / project)
            if status:
                return status
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
