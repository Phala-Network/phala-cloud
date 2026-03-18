#!/usr/bin/env bash
# Bump Go SDK version in go/version.go.
# Usage: bump-go-version.sh <patch|minor|major> [prerelease-tag]
# Outputs: version=X.Y.Z (for GitHub Actions)
set -euo pipefail

RELEASE_TYPE="${1:?Usage: bump-go-version.sh <patch|minor|major> [prerelease-tag]}"
PRERELEASE_TAG="${2:-}"

VERSION_FILE="$(dirname "$0")/../go/version.go"
VERSION_FILE="$(cd "$(dirname "$VERSION_FILE")" && pwd)/$(basename "$VERSION_FILE")"

# Extract current version
CURRENT=$(grep 'sdkVersion\s*=' "$VERSION_FILE" | sed -E 's/.*"([^"]+)".*/\1/')
if [ -z "$CURRENT" ]; then
  echo "Could not find sdkVersion in $VERSION_FILE" >&2
  exit 1
fi
echo "Current version: $CURRENT"

# Parse semver (supports optional -prerelease.N suffix)
if [[ "$CURRENT" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)(-(alpha|beta|rc)\.([0-9]+))?$ ]]; then
  MAJOR="${BASH_REMATCH[1]}"
  MINOR="${BASH_REMATCH[2]}"
  PATCH="${BASH_REMATCH[3]}"
  CUR_PRE_TAG="${BASH_REMATCH[5]:-}"
  CUR_PRE_VER="${BASH_REMATCH[6]:-}"
else
  echo "Invalid version format: $CURRENT" >&2
  exit 1
fi

# Bump
if [ -n "$PRERELEASE_TAG" ]; then
  if [ "$CUR_PRE_TAG" = "$PRERELEASE_TAG" ] && [ -n "$CUR_PRE_VER" ]; then
    # Same prerelease tag: increment prerelease version
    NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}-${PRERELEASE_TAG}.$((CUR_PRE_VER + 1))"
  else
    # Different prerelease tag or no current prerelease: bump base then set prerelease
    case "$RELEASE_TYPE" in
      major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
      minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
      patch) PATCH=$((PATCH + 1)) ;;
      *) echo "Invalid release type: $RELEASE_TYPE" >&2; exit 1 ;;
    esac
    NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}-${PRERELEASE_TAG}.1"
  fi
elif [ -n "$CUR_PRE_TAG" ]; then
  # Currently prerelease, stable release: just drop the prerelease suffix
  NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"
else
  case "$RELEASE_TYPE" in
    major) NEW_VERSION="$((MAJOR + 1)).0.0" ;;
    minor) NEW_VERSION="${MAJOR}.$((MINOR + 1)).0" ;;
    patch) NEW_VERSION="${MAJOR}.${MINOR}.$((PATCH + 1))" ;;
    *) echo "Invalid release type: $RELEASE_TYPE" >&2; exit 1 ;;
  esac
fi

# Write new version
sed -i.bak -E "s/sdkVersion = \"[^\"]+\"/sdkVersion = \"${NEW_VERSION}\"/" "$VERSION_FILE"
rm -f "${VERSION_FILE}.bak"

LABEL="$RELEASE_TYPE"
[ -n "$PRERELEASE_TAG" ] && LABEL="${RELEASE_TYPE} (${PRERELEASE_TAG})"
echo "Bumped go from $CURRENT to $NEW_VERSION [$LABEL]"

# GitHub Actions output
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "version=${NEW_VERSION}" >> "$GITHUB_OUTPUT"
fi
