#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 0.2.0"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist/$VERSION"

if ! command -v zip >/dev/null 2>&1; then
  echo "zip command is required"
  exit 1
fi

mkdir -p "$DIST_DIR"
rm -f "$DIST_DIR"/terraform-provider-phala_"$VERSION"_*.zip
rm -f "$DIST_DIR"/terraform-provider-phala_"$VERSION"_SHA256SUMS

TARGETS=(
  "linux/amd64"
  "linux/arm64"
  "darwin/amd64"
  "darwin/arm64"
  "windows/amd64"
)

for target in "${TARGETS[@]}"; do
  GOOS="${target%/*}"
  GOARCH="${target#*/}"
  BIN_NAME="terraform-provider-phala_v${VERSION}"
  if [[ "$GOOS" == "windows" ]]; then
    BIN_NAME="${BIN_NAME}.exe"
  fi

  TMP_DIR="$(mktemp -d)"
  trap 'rm -rf "$TMP_DIR"' EXIT

  echo "Building ${GOOS}/${GOARCH}..."
  (
    cd "$ROOT_DIR"
    CGO_ENABLED=0 GOOS="$GOOS" GOARCH="$GOARCH" \
      go build -trimpath -ldflags "-s -w -X main.version=${VERSION}" \
      -o "$TMP_DIR/$BIN_NAME" ./main.go
  )

  ZIP_NAME="terraform-provider-phala_${VERSION}_${GOOS}_${GOARCH}.zip"
  (
    cd "$TMP_DIR"
    zip -q "$DIST_DIR/$ZIP_NAME" "$BIN_NAME"
  )

  rm -rf "$TMP_DIR"
  trap - EXIT
done

(
  cd "$DIST_DIR"
  shasum -a 256 terraform-provider-phala_"$VERSION"_*.zip > terraform-provider-phala_"$VERSION"_SHA256SUMS
)

echo "Release artifacts generated in: $DIST_DIR"
