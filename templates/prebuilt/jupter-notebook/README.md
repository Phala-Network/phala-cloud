# Jupyter Notebook MCP

Deploy a JupyterLab workspace with a companion Jupyter MCP server on Phala Cloud.

This template starts a persistent JupyterLab notebook and an MCP server that connects to that notebook. It is useful for private data analysis, notebook-driven experiments, and AI-assisted Python workflows inside a CVM.

## Services

- `jupyter-notebook`: JupyterLab on port `8888` with a persistent home directory.
- `jupyter-mcp-server`: MCP server on port `8000` connected to the notebook service.

## Ports

- `8888`: JupyterLab web UI.
- `8000`: Jupyter MCP server.

## Environment variables

The compose file sets these defaults:

- `JUPYTER_TOKEN`: Token used to access JupyterLab.
- `TOKEN`: Token used by the MCP server when connecting to Jupyter.
- `SERVER_URL`: Internal Jupyter service URL, defaulting to `http://jupyter-notebook:8888`.
- `NOTEBOOK_PATH`: Notebook path used by the MCP server, defaulting to `notebook.ipynb`.

Update the tokens before sharing the deployment URL.

## Persistent data

- `jupyter_data`: Mounted at `/home/jovyan` for notebooks and workspace files.

## Mounted sockets

- `/var/run/tappd.sock`: TEE attestation socket.
- `/tmp`: Shared temporary directory used by both services.

## Deploy

1. Deploy the template on Phala Cloud.
2. Open `https://<your-app-domain>` for JupyterLab.
3. Configure your MCP client to point at the MCP server endpoint if exposed by your deployment.

## Verify

```bash
curl -I https://<your-app-domain>
```

JupyterLab may take extra time on first boot because the container installs `jupyter-collaboration` before starting the server.
