#!/usr/bin/env python3
"""Run conventionally associated tests for paths passed by pre-commit.

This is a filename-based selection, not transitive dependency analysis. Stage an
explicit regression test when the affected test is not adjacent to its source.
"""

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEST_FILE = re.compile(r"\.(?:test|spec)\.[cm]?[jt]sx?$")
GO_TEST = re.compile(r"(?m)^func\s+((?:Test|Example|Fuzz)(?:[A-Z0-9_][A-Za-z0-9_]*)?)\s*\(")


def select_js(root, project, filenames):
    base = root / project
    selected = set()
    for filename in filenames:
        path = root / filename
        if not path.is_file():
            continue
        if TEST_FILE.search(path.name):
            selected.add(path.relative_to(base).as_posix())
            continue
        stem = path.stem
        for candidate in path.parent.iterdir():
            if (candidate.is_file() and candidate.name.startswith(stem + ".")
                    and TEST_FILE.search(candidate.name)):
                selected.add(candidate.relative_to(base).as_posix())
    return sorted(selected)


def go_commands(root, filenames):
    base = root / "go"
    selected = set()
    for filename in filenames:
        path = root / filename
        if not path.is_file():
            continue
        if path.name.endswith("_test.go"):
            selected.add(path)
        elif path.suffix == ".go":
            candidate = path.with_name(path.stem + "_test.go")
            if candidate.is_file():
                selected.add(candidate)
    packages = {}
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
    return commands


def main(args):
    if not args or args[0] not in ("go", "js", "cli"):
        print("Usage: focused_tests.py {go|js|cli} STAGED_FILE...", file=sys.stderr)
        return 1
    project, *filenames = args
    try:
        if project == "go":
            commands = go_commands(ROOT, filenames)
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
            if project == "go":
                print(f"Selected Go test names: {command[4]}", flush=True)
            result = subprocess.run(command, cwd=ROOT / project, check=False)
            if result.returncode:
                return result.returncode
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
