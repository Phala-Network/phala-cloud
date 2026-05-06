---
name: agent-deploy
description: |
  Deploy a confidential AI agent to Phala Cloud — a Claude Code wrapper,
  Codex agent, MCP server, autonomous bot, anything with sealed API keys
  and tool calls. Use when users want to ship an agent with credentials
  sealed in a TEE and a verifiable Sign-RPC action log.
---

# Confidential AI Agent on Phala Cloud

`phala deploy` an agent CVM with sealed credentials and a verifiable action log.

## Operations

| User says | Operation |
|---|---|
| "deploy an agent", "ship my agent", "上线 agent" | **First Deploy** |
| "scaffold a new agent", "create agent project" | **Scaffold** |
| "seal the API key", "credentials leak", "secrets" | **Seal Secrets** |
| "verify agent identity", "RA-TLS", "TDX quote" | **Verify Identity** |
| "audit tool calls", "Sign-RPC log", "what did the agent do" | **Action Log** |
| "deploy 10 agents", "fleet", "many agents" | **Multi-Agent Fleet** |

This skill builds on `phala-cli/SKILL.md`. Install + login per that skill first.

---

## Scaffold

A confidential agent is a Docker container that:

1. Reads sealed credentials from env vars (decrypted only inside the CVM at boot)
2. Calls its tools (OpenAI, GitHub, Slack, etc.) from inside the TEE
3. Emits a Sign-RPC log of every tool call (signature chains to the TDX root)

### Step 1: Project layout

```bash
mkdir my-agent && cd my-agent
```

```
my-agent/
├── docker-compose.yml      # CVM definition
├── .env.example            # which sealed vars the agent expects
├── .env                    # local-only, gitignored (real secrets)
├── agent/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── main.py             # the agent loop
└── README.md
```

### Step 2: `docker-compose.yml`

```yaml
services:
  agent:
    image: ghcr.io/<your-org>/my-agent:latest   # publicly pullable, OR set DSTACK_DOCKER_USERNAME/PASSWORD
    restart: unless-stopped
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - GITHUB_TOKEN=${GITHUB_TOKEN}
      - AGENT_NAME=${AGENT_NAME:-my-agent}
    volumes:
      - /var/run/dstack.sock:/var/run/dstack.sock   # for Sign-RPC + KMS access
    ports:
      - "8080:8080"
```

The `dstack.sock` mount gives the container access to:
- `dstack-guest-agent` for Sign-RPC signing
- KMS to derive per-app keys
- Attestation quotes on demand

### Step 3: `.env.example`

```
OPENAI_API_KEY=sk-replace-me
GITHUB_TOKEN=ghp_replace-me
AGENT_NAME=my-agent
```

Commit this. Never commit the real `.env` — that goes to Phala via `-e`.

---

## Seal Secrets

The `phala deploy -e` flag seals env vars to the registered compose-hash. Stolen ciphertext is useless — keys only re-derive inside an attested CVM whose compose-hash matches.

### Step 1: Local `.env`

```
OPENAI_API_KEY=sk-real-value-here
GITHUB_TOKEN=ghp_real-value-here
AGENT_NAME=my-trading-agent
```

### Step 2: Pass at deploy

```bash
phala deploy -n my-agent -c docker-compose.yml -e .env --kms phala
```

Or inline:

```bash
phala deploy -n my-agent -c docker-compose.yml \
  -e OPENAI_API_KEY=sk-... \
  -e GITHUB_TOKEN=ghp-... \
  --kms phala
```

`--kms phala` (default) seals to Phala's managed KMS. For ETH multi-sig gating, use `--kms ethereum` with `--private-key` and `--rpc-url`.

---

## First Deploy

### Step 1: Authenticate

Per `SKILL.md`:

```bash
phala login
```

### Step 2: Pick instance type

Most agents fit a small CPU TEE:

```bash
phala instance-types
# pick tdx.small ($0.058/hr) for light agents
# tdx.medium for tool-heavy / memory-hungry agents
# h200.small ($3.50/hr) only if the agent runs local inference
```

### Step 3: Deploy

```bash
phala deploy -n my-agent -c docker-compose.yml -e .env -t tdx.medium --kms phala --wait
```

`--wait` blocks until the CVM is ready (essential in CI).

### Step 4: Link the directory

```bash
phala link
git add phala.toml   # safe to commit, contains no secrets
```

After `link`, all subsequent `phala` commands target this CVM without `-n`.

### Step 5: Verify

```bash
phala ps                       # containers running?
phala logs -f                  # agent output
phala cvms attestation         # TDX quote — proves the CVM is genuine
```

---

## Verify Identity

The CVM's identity is its compose-hash. Every Sign-RPC signature chains to the TDX root + this compose-hash.

### Pull the attestation

```bash
# Get the full cert chain + TDX quote
phala cvms attestation --json | jq '.app_certificates[0].quote'

# Or summary form
phala cvms attestation
```

The response shape:

```json
{
  "success": true,
  "is_online": true,
  "is_public": true,
  "app_certificates": [
    { "subject": {...}, "issuer": {...}, "quote": "0400...", "app_id": "..." },
    ...
  ]
}
```

The hex `quote` decodes into a TDX quote containing:
- `mrtd` — TDX measurement (the firmware identity)
- `rtmr0..3` — runtime measurements (kernel, initrd, compose hash)
- `report_data` — your app-specific binding

### Verify offline

For the full step-by-step verification flow (Intel TDX root + NVIDIA root + report-data binding + compose-hash + Sigstore provenance), follow `verify-attestation.md`.

The minimum check:

```bash
phala cvms attestation my-agent --json > attestation.json
QUOTE=$(jq -r '.app_certificates[0].quote' attestation.json)
curl -sX POST "https://cloud-api.phala.com/api/v1/attestations/verify" \
  -H "Content-Type: application/json" \
  -d "{\"hex\": \"$QUOTE\"}" | jq '.quote.verified'
# Expect: true
```

A passing quote + matching compose-hash = the running agent IS the build you registered.

---

## Action Log

Every tool call the agent makes can be signed via Sign-RPC inside the CVM. The signature chains to the per-app key derived from KMS.

### From inside the agent (Python)

```python
import socket, json

def sign_action(payload: dict) -> str:
    """Send to dstack-guest-agent over the Unix socket; receive signature."""
    s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    s.connect("/var/run/dstack.sock")
    s.sendall(json.dumps({"method": "sign", "params": payload}).encode())
    return json.loads(s.recv(4096))["signature"]

# Wrap every tool call
sig = sign_action({"tool": "github.create_issue", "args_hash": "0xab12..."})
```

### Read the log later

The signed log is emitted to stdout (or your sink). Stream it:

```bash
phala logs -f --since 1h | jq 'select(.sign_rpc)'
```

### Verify the log offline

Each entry includes a signature that anyone can verify against the per-app pubkey (derived from the compose-hash).

---

## Multi-Agent Fleet

Deploy N parallel agents, each with their own compose-hash + sealed creds. They attest each other via mutual RA-TLS.

### Step 1: Per-agent compose

Each agent gets a slightly different `docker-compose.yml` (different image, different env). Different compose = different `compose-hash` = different identity.

### Step 2: Deploy in a loop

```bash
for AGENT in researcher coder triager; do
  phala deploy -n $AGENT -c compose/$AGENT.yml -e env/$AGENT.env --wait
done
```

### Step 3: Mutual RA-TLS between them

Each agent CVM gets a public endpoint shaped like
`https://<app_id>-<port>.<gateway_base_domain>` — the exact gateway domain
is per-cluster (e.g. `dstack-pha-prod12.phala.network`). Get it live:

```bash
phala cvms get my-agent --json | jq -r '.endpoints[0].app'
```

Each cert carries the peer's TDX quote in an X.509 extension — TLS handshake
AND attestation in one handshake.

### Step 4: List the fleet

```bash
phala apps
# or
phala apps --search trading
```

---

## Common patterns

### Wrap an existing CLI agent (Claude Code, Codex)

The agent runs as a long-lived service that exposes a tool API on port 8080. The tool API:
1. Receives a task from a user
2. Resolves OpenAI / GitHub creds from sealed env
3. Calls Claude Code / Codex internally
4. Emits Sign-RPC log of every tool call

Compose example: a `claude-code` image + an `nginx` reverse proxy with TLS.

### MCP server

Deploy any MCP server image (e.g., `bluenexus/mcp-search`) with mutual RA-TLS. Clients verify the server's TDX quote before sending requests.

### Pre-launch script

Need to download model weights or warm a cache before the agent starts?

```bash
phala deploy ... --pre-launch-script ./bootstrap.sh
```

The script runs once inside the CVM after attestation, before containers start.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `manifest unknown` in serial logs | Image not pullable | Push to a public registry, OR set `DSTACK_DOCKER_USERNAME` + `DSTACK_DOCKER_PASSWORD` in `.env` |
| Container restarts immediately | Missing env var | Run `phala logs my-agent` — check for `KeyError` / `undefined` env |
| Agent can't reach `dstack.sock` | Volume not mounted | Add `- /var/run/dstack.sock:/var/run/dstack.sock` to compose |
| Sign-RPC returns 401 | KMS doesn't recognize compose-hash | Re-deploy — first deploy registers the hash |
| Tool calls failing intermittently | Outbound network blocked | Check serial logs (`phala logs --serial`) — `dstack-gateway` allowlist may need updating |

For deeper debugging, see **Debug a CVM** in `SKILL.md`.

---

## Reference: minimal end-to-end

```bash
# 1. Scaffold
mkdir my-agent && cd my-agent
# (write docker-compose.yml + .env)

# 2. Auth + deploy
phala login
phala deploy -n my-agent -c docker-compose.yml -e .env -t tdx.medium --kms phala --wait

# 3. Link + verify
phala link
phala cvms attestation --json > attestation.json
phala logs -f
```

Done — the agent is live, its credentials are sealed, every tool call is signed, and anyone can verify the binding offline.
