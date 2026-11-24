#!/usr/bin/env python3
"""Bump Python SDK version in pyproject.toml."""

import json
import os
import re
import sys
import urllib.request


def parse_version(version: str) -> dict:
    m = re.match(r"^(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta|rc)\.(\d+))?$", version)
    if not m:
        raise ValueError(f"Invalid version format: {version}")
    return {
        "major": int(m.group(1)),
        "minor": int(m.group(2)),
        "patch": int(m.group(3)),
        "prerelease": m.group(4),
        "prerelease_version": int(m.group(5)) if m.group(5) else None,
    }


def bump_version(version: str, release_type: str, prerelease_tag: str = "") -> str:
    p = parse_version(version)

    if prerelease_tag:
        if p["prerelease"] == prerelease_tag:
            return f"{p['major']}.{p['minor']}.{p['patch']}-{prerelease_tag}.{p['prerelease_version'] + 1}"
        major, minor, patch = p["major"], p["minor"], p["patch"]
        if release_type == "major":
            major, minor, patch = major + 1, 0, 0
        elif release_type == "minor":
            minor, patch = minor + 1, 0
        elif release_type == "patch":
            patch += 1
        return f"{major}.{minor}.{patch}-{prerelease_tag}.1"

    if p["prerelease"]:
        return f"{p['major']}.{p['minor']}.{p['patch']}"

    if release_type == "major":
        return f"{p['major'] + 1}.0.0"
    elif release_type == "minor":
        return f"{p['major']}.{p['minor'] + 1}.0"
    elif release_type == "patch":
        return f"{p['major']}.{p['minor']}.{p['patch'] + 1}"
    raise ValueError(f"Invalid release type: {release_type}")


def check_version_exists(package_name: str, version: str) -> bool:
    """Check if a PEP 440 version exists on PyPI."""
    url = f"https://pypi.org/pypi/{package_name}/{version}/json"
    try:
        req = urllib.request.Request(url, method="HEAD")
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status == 200
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return False
        print(f"Warning: Unable to verify version existence (status {e.code})")
        return False
    except Exception as e:
        print(f"Warning: Network error checking version: {e}")
        return False


def to_pep440(version: str) -> str:
    """Convert semver-style version to PEP 440.

    Examples:
        1.0.0 -> 1.0.0
        1.0.0-alpha.1 -> 1.0.0a1
        1.0.0-beta.2 -> 1.0.0b2
        1.0.0-rc.3 -> 1.0.0rc3
    """
    m = re.match(r"^(\d+\.\d+\.\d+)(?:-(alpha|beta|rc)\.(\d+))?$", version)
    if not m:
        raise ValueError(f"Cannot convert to PEP 440: {version}")
    base = m.group(1)
    if not m.group(2):
        return base
    tag_map = {"alpha": "a", "beta": "b", "rc": "rc"}
    return f"{base}{tag_map[m.group(2)]}{m.group(3)}"


def main():
    if len(sys.argv) < 2:
        print("Usage: bump-python-version.py <release-type> [prerelease-tag]", file=sys.stderr)
        sys.exit(1)

    release_type = sys.argv[1]
    prerelease_tag = sys.argv[2] if len(sys.argv) > 2 else ""

    allowed_release_types = ["patch", "minor", "major"]
    allowed_prerelease_tags = ["beta", "alpha", "rc", ""]

    if release_type not in allowed_release_types:
        print(f"Invalid release type: {release_type}. Must be one of: {', '.join(allowed_release_types)}", file=sys.stderr)
        sys.exit(1)

    if prerelease_tag not in allowed_prerelease_tags:
        print(f"Invalid prerelease tag: {prerelease_tag}. Must be one of: {', '.join(allowed_prerelease_tags)}", file=sys.stderr)
        sys.exit(1)

    pyproject_path = os.path.join(os.path.dirname(__file__), "..", "python", "pyproject.toml")
    pyproject_path = os.path.normpath(pyproject_path)

    with open(pyproject_path) as f:
        content = f.read()

    # Extract current version
    m = re.search(r'^version\s*=\s*"([^"]+)"', content, re.MULTILINE)
    if not m:
        print("Could not find version in pyproject.toml", file=sys.stderr)
        sys.exit(1)

    old_version = m.group(1)

    # Convert PEP 440 version back to semver for bumping if needed
    old_semver = from_pep440(old_version)
    new_version = bump_version(old_semver, release_type, prerelease_tag)

    # Check for version conflicts on PyPI
    pep440_version = to_pep440(new_version)
    print(f"Checking if version {pep440_version} exists on PyPI...")
    if check_version_exists("phala-cloud", pep440_version):
        print(f"⚠️  Version {pep440_version} already exists on PyPI")
        if prerelease_tag:
            print("Auto-incrementing prerelease version...")
            p = parse_version(new_version)
            pre_ver = p["prerelease_version"] or 1
            for _ in range(10):
                candidate = f"{p['major']}.{p['minor']}.{p['patch']}-{prerelease_tag}.{pre_ver}"
                pep440_candidate = to_pep440(candidate)
                if not check_version_exists("phala-cloud", pep440_candidate):
                    new_version = candidate
                    pep440_version = pep440_candidate
                    print(f"✓ Using version: {pep440_version}")
                    break
                pre_ver += 1
            else:
                print("❌ Unable to find available prerelease version", file=sys.stderr)
                sys.exit(1)
        else:
            print(f"❌ Error: Version conflict. {pep440_version} already exists on PyPI.", file=sys.stderr)
            sys.exit(1)
    else:
        print(f"✓ Version {pep440_version} is available")

    # Write PEP 440 version to pyproject.toml
    new_content = content.replace(f'version = "{old_version}"', f'version = "{pep440_version}"')
    with open(pyproject_path, "w") as f:
        f.write(new_content)

    release_label = f"{release_type} ({prerelease_tag})" if prerelease_tag else release_type
    print(f"Bumped python from {old_version} to {pep440_version} [{release_label}]")

    # Output for GitHub Actions
    github_output = os.environ.get("GITHUB_OUTPUT")
    if github_output:
        with open(github_output, "a") as f:
            f.write(f"version={pep440_version}\n")


def from_pep440(version: str) -> str:
    """Convert PEP 440 version back to semver-style.

    Examples:
        1.0.0 -> 1.0.0
        1.0.0a1 -> 1.0.0-alpha.1
        1.0.0b2 -> 1.0.0-beta.2
        1.0.0rc3 -> 1.0.0-rc.3
    """
    m = re.match(r"^(\d+\.\d+\.\d+)(a|b|rc)(\d+)$", version)
    if not m:
        # Already semver or plain version
        return version
    base = m.group(1)
    tag_map = {"a": "alpha", "b": "beta", "rc": "rc"}
    return f"{base}-{tag_map[m.group(2)]}.{m.group(3)}"


if __name__ == "__main__":
    main()
