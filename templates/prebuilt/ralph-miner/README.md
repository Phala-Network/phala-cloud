# RalphLabsAI/ralph Jupyter miner workspace on Phala Cloud

Deploy a Phala Cloud H200 TEE CVM that completes the upstream Ralph H100 miner
setup through step 2, then serves a prepared JupyterLab workspace for the miner
to continue interactively.

The template does not create wallets, write `.env`, verify registration, submit
baselines, generate patches, or run `scripts/miner_run.py`. Those are upstream
step 3 and later, and are intentionally left to the miner inside JupyterLab.

## Metadata

- Template id: `ralph-miner`
- Display name: `RalphLabsAI/ralph miner`
- Category: AI Research, Bittensor, TEE & Privacy, GPU
- Upstream repository: https://github.com/RalphLabsAI/ralph
- Upstream H100 guide: https://github.com/RalphLabsAI/ralph/blob/main/docs/h100_miner_setup.md
- Upstream recipe repository: https://github.com/RalphLabsAI/recipe
- Attestation shim: https://github.com/Dstack-TEE/dstack-examples/tree/main/tsm-shim
- Default GPU target: H200, `h200.small`
- Default disk size: `300G`

## What This Template Does

This template maps Phala deployment to the upstream H100 guide as follows:

| Upstream step | Who does it | Phala template behavior |
| --- | --- | --- |
| Step 1. Rent the box | Phala Cloud | User creates the Phala deployment. |
| Step 2. Bootstrap on the H100 | Template | Container starts JupyterLab, clones repos, creates venv, installs Ralph, and prepares data. |
| Step 3. Bittensor wallet + HF token | Miner | Miner opens JupyterLab and performs this manually. |
| Step 4+. Submit bundles and iterate | Miner | Miner performs this manually in JupyterLab terminal or notebooks. |

Runtime services:

- `tsm-shim`: runs `ghcr.io/dstack-tee/dstack-tsm-shim:latest` and exposes the
  dstack quote socket as configfs-tsm-compatible `/run/tsm/report/inblob` and
  `/run/tsm/report/outblob` FIFOs for later proof runs.
- `ralph-miner`: starts from
  `ghcr.io/kubeflow/kubeflow/notebook-servers/jupyter-pytorch-cuda:latest`,
  serves token-protected JupyterLab on port `8888`, and performs the upstream
  H100 guide's step 2:
  - clone `https://github.com/RalphLabsAI/ralph.git` to `/workspace/ralph`;
  - clone `https://github.com/RalphLabsAI/recipe.git` to `/workspace/recipe`;
  - create `/workspace/ralph/.venv`;
  - run `pip install -e '.[hub,chain,data]'` inside `/workspace/ralph`, which
    installs the Hugging Face, Bittensor chain, and data-preparation
    dependencies miners need for the next steps;
  - install JupyterLab and register the Ralph venv as the `Ralph (.venv)`
    notebook kernel;
  - run `python -m data.prepare --source fineweb-edu --out data/shards --shard-tokens 10000000 --total-tokens 1000000000 --eval-tokens 5000000` inside `/workspace/recipe`.

The `ralph-miner` service sets `RALPH_TSM_REPORT_PATH=/run/tsm/report` so later
Ralph proof runs can find the Phala/dstack TDX report path without requiring the
miner to set that variable manually. The compose file intentionally does not
define `healthcheck` or `security_opt` blocks.

The template installs the Bittensor/Ralph chain dependencies, but it does not
create, import, download, or copy wallet key material. The registered wallet
files remain a miner-owned Step 3 action inside JupyterLab.

Prepared paths:

| Path | Purpose |
| --- | --- |
| `/workspace/ralph` | Ralph repo cloned from upstream |
| `/workspace/recipe` | Recipe repo cloned from upstream |
| `/workspace/ralph/.venv` | Python virtual environment created by the template and registered as the `Ralph (.venv)` Jupyter kernel |
| `/workspace/recipe/data/shards` | FineWeb-Edu data output path |
| `/workspace/.bittensor/wallets` | Bittensor wallet directory mounted on a named volume and visible in JupyterLab |
| `/workspace/status` | Setup status files and local Jupyter log |
| `/run/tsm/report` | Phala/dstack TDX report path exposed by `tsm-shim`; also exported as `RALPH_TSM_REPORT_PATH` in `ralph-miner` |

## Template Inputs

The miner must provide only a Jupyter token at deployment time.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `JUPYTER_TOKEN` | Yes | unset | Long random token used to open the JupyterLab workspace on port `8888`. Generate one with `openssl rand -hex 32` or an equivalent password manager. |

Do not paste a wallet password, Hugging Face token, wallet archive, patch URL,
GitHub token, W&B key, validator bot token, or cloud-provider key into the
template form.

## Miner Flow After Startup

Open the Phala Cloud URL for port `8888` and enter the `JUPYTER_TOKEN` provided
at deployment time.

The workspace may become reachable before FineWeb-Edu data preparation finishes.
Check readiness from a JupyterLab terminal:

```bash
cat /workspace/status/ready
cat /workspace/PHALA_RALPH_READY.md
```

Then continue from upstream step 3. Example `.env` shape:

```bash
cd /workspace/ralph
cat > .env <<'EOF'
RALPH_CHAIN=bittensor
BT_NETWORK=finney
BT_NETUID=40
BT_WALLET=<your-miner-wallet>
BT_HOTKEY=default
BT_WALLET_PASSWORD=<password>

HF_TOKEN=<hf-write-token>
RALPH_HF_REPO=RalphLabsAI/proof-bundles
EOF
chmod 600 .env
```

Upload or copy the already-registered Bittensor wallet into the normal wallet
path visible from JupyterLab:

```text
/workspace/.bittensor/wallets/<BT_WALLET>/coldkey
/workspace/.bittensor/wallets/<BT_WALLET>/hotkeys/<BT_HOTKEY>
```

Use the JupyterLab file browser, JupyterLab terminal, or another
miner-controlled copy method to place the wallet files there. The template does
not generate wallet keys, does not import a wallet tarball, and does not ask for
wallet key material in the template form.

From there, follow the upstream H100 guide's registration check and
`scripts/miner_run.py` commands. Use the prepared venv:

```bash
cd /workspace/ralph
source .venv/bin/activate
set -a && source .env && set +a
```

The recipe repository uses `configs/h100_proxy.json`; the upstream H100 guide
contains snippets that mention both `configs/proxy_h100.json` and
`configs/h100_proxy.json`.

## Expected Logs

During startup:

```text
[ralph-phala] clone RalphLabsAI/ralph
[ralph-phala] clone RalphLabsAI/recipe
[ralph-phala] create-venv /workspace/ralph/.venv
[ralph-phala] jupyter-ready port=8888 token=provided-by-template-env
[ralph-phala] data-prepare fineweb-edu
[ralph-phala] workspace-ready /workspace/PHALA_RALPH_READY.md
```

## Verification

Run these checks from a `phala-cloud` worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/ralph-miner/docker-compose.yml config >/dev/null
```

The compose file intentionally escapes shell `$` as `$$` inside inline
`configs.*.content`, because Docker Compose interpolates inline config content
before Phala starts the CVM workload.

## Security Notes

- Use a long random `JUPYTER_TOKEN`; anyone with the public port `8888` URL and
  token can access the workspace.
- The startup log does not print the Jupyter token. Jupyter's own server log is
  redirected to `/workspace/status/jupyter.log` rather than container stdout.
- Keep wallet files, `BT_WALLET_PASSWORD`, `HF_TOKEN`, patches, and generated
  proof artifacts out of source control.
- Disable public logs for real proof runs because logs may include operational
  metadata.
- The template mounts `/var/run/dstack.sock` into `tsm-shim` so later Ralph proof
  runs can obtain a TDX quote through the Phala/dstack attestation path.

## Production Notes

The default image installs Ralph dependencies during container startup for
first-run convenience. For repeated production mining, replace the image with a
prebuilt digest-pinned Ralph Jupyter image in a follow-up PR so H200 time is not
spent on package installation.
