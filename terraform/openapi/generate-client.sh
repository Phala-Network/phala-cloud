#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SPEC_RAW="${ROOT_DIR}/openapi/phala-cloud-openapi.json"
SPEC_NORMALIZED="${ROOT_DIR}/openapi/phala-cloud-openapi.normalized.json"
GEN_OUT="${ROOT_DIR}/internal/phalaapi/client.gen.go"

curl -sS https://cloud-api.phala.network/openapi.json -o "${SPEC_RAW}"
jq -f "${ROOT_DIR}/openapi/normalize-openapi.jq" "${SPEC_RAW}" > "${SPEC_NORMALIZED}"

GOCACHE="${GOCACHE:-/tmp/phala-go-build}" \
GOMODCACHE="${GOMODCACHE:-/tmp/phala-go-modcache}" \
  go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@v2.4.1 \
  -generate types,client,skip-prune \
  -package phalaapi \
  -o "${GEN_OUT}" \
  "${SPEC_NORMALIZED}"

gofmt -w "${GEN_OUT}"
