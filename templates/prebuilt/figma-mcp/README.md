# Figma MCP

Deploy a protected Figma Context MCP server on Phala Cloud.

This template gives AI coding tools and agents access to Figma file context through MCP. It runs the Figma MCP server behind Caddy and mounts the TEE attestation socket for workloads that need runtime attestation.

## Services

- `app`: Figma Context MCP server on internal port `3333`.
- `proxy`: Caddy reverse proxy exposed through Phala Cloud.

## Ports

- `18080`: Public MCP endpoint handled by Caddy.

## Required environment variables

- `BEARER_TOKEN`: Token required from MCP clients calling this deployment.
- `FIGMA_API_KEY`: Figma personal access token used by the MCP server.

## Mounted sockets

- `/var/run/tappd.sock`: TEE attestation socket mounted into the app container.

## MCP client configuration

```json
{
  "mcpServers": {
    "figma": {
      "type": "streamablehttp",
      "url": "https://<your-app-domain>",
      "headers": {
        "Authorization": "Bearer YOUR_BEARER_TOKEN"
      }
    }
  }
}
```

## Verify

```bash
curl -i https://<your-app-domain>
curl -i -H "Authorization: Bearer YOUR_BEARER_TOKEN" https://<your-app-domain>
```

The public endpoint should require `BEARER_TOKEN` and then proxy authorized requests to the app service. Confirm your Figma token has access to the files you expect agents to inspect.

When a client connects successfully but cannot read a file, check Figma token permissions first, then confirm the file URL or file key supplied to the MCP tool.
