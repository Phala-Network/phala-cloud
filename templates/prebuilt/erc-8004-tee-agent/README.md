# ERC-8004 TEE Agent

Phala Cloud prebuilt template for the ERC-8004 TEE Agent. The app provides an ERC-8004 agent dashboard, TEE attestation endpoints, AI chat, code execution, and TEE-backed signing.

## Source

- Upstream repository: https://github.com/Phala-Network/erc-8004-tee-agent
- Upstream commit: `3196a3c68571da28eef78d296ae0e65ff3d83569`
- Upstream license: MIT, copyright 2025 ERC-8004 TEE Agents Contributors

This template is maintained in the Phala Cloud prebuilt catalog. It does not clone source code when the container starts and it does not depend on an unmerged upstream PR. The inline Dockerfile fetches the pinned upstream archive during image build and installs the Python package. The template also applies three Phala deployment patches:

- Redact `AGENT_SALT` from startup and key-derivation logs.
- Move Phala domain and Trust Center URL construction into the container startup command so `DSTACK_APP_ID` and `DSTACK_GATEWAY_DOMAIN` are read from the container runtime environment, not interpolated while Compose is rendered.
- Generate Caddy's Basic Auth configuration from `ERC8004_AGENT_USERNAME` and `ERC8004_AGENT_PASSWORD_HASH` at proxy container startup so the password hash is read from the container runtime environment.

## Services

- `app`: ERC-8004 TEE Agent built from the pinned upstream commit.
- `proxy`: Caddy Basic Auth proxy exposed on public port `8000`.

The `app` service is only reachable on the internal Docker network. Public traffic goes through Caddy on port `8000` because the app includes chat, code-execution, and signing endpoints.

## Environment Variables

Required:

- `AGENT_SALT`: Secret salt used for deterministic TEE key derivation. Changing it changes the agent wallet.
- `REDPILL_API_KEY`: RedPill Confidential AI API key.
- `SUBGRAPH_API_KEY`: The Graph Gateway API key for ERC-8004 subgraph queries.
- `RPC_URL`: RPC endpoint for the selected chain.
- `CHAIN_NAME`: Chain selector. The pinned upstream source currently supports `eth-sepolia`.
- `ERC8004_AGENT_PASSWORD_HASH`: Caddy bcrypt password hash for Basic Auth.

Optional:

- `ERC8004_AGENT_USERNAME`: Basic Auth username. Defaults to `agent`.
- `AGENT_DOMAIN`: Public agent domain override. When unset, startup derives it from `DSTACK_APP_ID` and `DSTACK_GATEWAY_DOMAIN`, or uses `localhost:8000` for local compose checks.
- `TRUST_CENTER_URL`: Trust Center widget URL override. When unset, startup derives it from `DSTACK_APP_ID` when available.
- `ANTHROPIC_MODEL`: Chat model used through the Anthropic-compatible RedPill endpoint. Defaults to `openai/gpt-oss-120b`.
- `AI_MODEL`: Code-generation model used by the RedPill helper. Defaults to `phala/qwen-2.5-7b-instruct`.
- `AI_TEMPERATURE`: AI sampling temperature. Defaults to `0.3`.
- `AI_MAX_TOKENS`: AI response token limit. Defaults to `2000`.
- `CODE_EXECUTION_TIMEOUT`: Code execution timeout in seconds. Defaults to `30`.
- `REDPILL_API_URL`: RedPill API base URL. Defaults to `https://api.redpill.ai`.
- `ANTHROPIC_BASE_URL`: Anthropic-compatible API base URL. Defaults to `https://api.redpill.ai`.
- `CHAIN_ID`: Chain ID override. Defaults to `11155111`.
- `IDENTITY_REGISTRY_ADDRESS`: ERC-8004 identity registry override.
- `REPUTATION_REGISTRY_ADDRESS`: ERC-8004 reputation registry override.
- `SESSION_TIMEOUT_MINUTES`: Chat session timeout. Defaults to `60`.
- `MAX_SESSIONS`: Maximum in-memory chat sessions. Defaults to `100`.

Generate the Caddy bcrypt hash with Caddy:

```bash
docker run --rm caddy:2.8 caddy hash-password --plaintext 'replace-with-a-strong-password'
```

When exporting the hash in a shell, quote it so the `$` characters are preserved:

```bash
export ERC8004_AGENT_PASSWORD_HASH='$2a$14$...'
```

Use the same single-quote style in a local Compose `.env` file.

Do not commit real salts, API keys, RPC credentials, or password hashes.

## Runtime Domain

On Phala Cloud, the startup command computes:

```text
AGENT_DOMAIN=<DSTACK_APP_ID>-8000.<DSTACK_GATEWAY_DOMAIN>
TRUST_CENTER_URL=https://trust.phala.com/widget/app/<DSTACK_APP_ID>
```

The compose file intentionally does not render these values from `${DSTACK_APP_ID}` or `${DSTACK_GATEWAY_DOMAIN}`. Those variables are expected from the Phala/dstack container runtime. For local compose checks where they are absent, `AGENT_DOMAIN` falls back to `localhost:8000`.

Set `AGENT_DOMAIN` or `TRUST_CENTER_URL` in the Compose environment to override the runtime-derived values explicitly.

## Validate

From the repository root:

```bash
AGENT_SALT=dummy \
REDPILL_API_KEY=dummy \
SUBGRAPH_API_KEY=dummy \
RPC_URL=https://example.invalid \
CHAIN_NAME=eth-sepolia \
ERC8004_AGENT_PASSWORD_HASH='$2b$12$DaaKDdf3fI3DqD5Sg56fuuPDjBv2m4X3QiGHpGFMtGEAcw1FMm6tm' \
docker compose -f templates/prebuilt/erc-8004-tee-agent/docker-compose.yml config
```

## Update Procedure

1. Review upstream changes in https://github.com/Phala-Network/erc-8004-tee-agent.
2. Update `UPSTREAM_COMMIT` and the local image tag in `docker-compose.yml`.
3. Re-check upstream environment variables, exposed ports, dstack socket usage, and whether the local log-redaction patches are still needed.
4. Keep the app behind Caddy Basic Auth unless the upstream app removes or protects chat, code-execution, and signing endpoints.
5. Run `docker compose config` with dummy values from the repository root.
6. Run `python3 templates/validate.py` from the repository root.
7. Run `git diff --check` before opening a pull request.
