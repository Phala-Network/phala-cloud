# Zep Graphiti MCP

Phala Cloud prebuilt template for running the Zep Graphiti MCP server with an internal Neo4j database.

## Source

- Upstream repository: https://github.com/HashWarlock/graphiti/tree/main/mcp_server
- Pinned upstream commit: `9ceeb5418605f91bb919151d388f786cfbea8c4a`
- Upstream license: Apache-2.0, verified from the upstream repository `LICENSE` file at the pinned commit.
- Runtime database image: `neo4j:5.26.0`

## Why This Wrapper Exists

The upstream `mcp_server/docker-compose.yml` builds `graphiti-mcp` from a local `Dockerfile` in the upstream repository. During Phala Cloud prebuilt deployment, the guest build can receive the compose file without that upstream build context, so Docker fails with `open Dockerfile: no such file or directory`.

This Phala-maintained wrapper keeps the deployment self-contained by embedding a Compose `dockerfile_inline` build. The inline Dockerfile fetches the pinned upstream archive, copies the MCP server files from `mcp_server`, installs the locked Python dependencies, and runs the SSE server. It does not depend on an external upstream pull request or a local user-provided Dockerfile.

## Services

- `graphiti-mcp`: Graphiti MCP server exposed on host port `8000`.
- `neo4j`: Neo4j `5.26.0` database on the internal Compose network only.

Neo4j is intentionally not exposed as a public port. The MCP service connects to it over the internal Docker network using `bolt://neo4j:7687`.

## Environment Variables

- `OPENAI_API_KEY` (required): OpenAI API key used by Graphiti for LLM and embedding operations. The compose config fails if this is omitted.
- `MODEL_NAME` (optional): OpenAI model used for LLM calls. Defaults to `gpt-4.1-mini`.
- `NEO4J_URI` (optional): Neo4j Bolt URI. Defaults to `bolt://neo4j:7687`.
- `NEO4J_USER` (optional): Neo4j username. Defaults to `neo4j`.
- `NEO4J_PASSWORD` (optional): Neo4j password. Defaults to `demodemo`.
- `SEMAPHORE_LIMIT` (optional): Episode processing concurrency. Defaults to `1` to reduce provider rate-limit pressure on small deployments.

Do not commit real API keys or secrets to this directory.

## Endpoint

After deploying on Phala Cloud, use the MCP SSE endpoint for port `8000`:

```text
https://APP_HOST/sse
```

Quick probe:

```bash
curl -iN "https://APP_HOST/sse"
```

An SSE response confirms that the MCP transport is reachable. The server initializes Graphiti and Neo4j before serving requests, so startup can take longer on the first boot while the image builds and Neo4j creates its data store.

## Local Validation

From the repository root:

```bash
OPENAI_API_KEY=dummy docker compose -f templates/prebuilt/zep-graphiti-mcp/docker-compose.yml config
python3 templates/validate.py
```

The first command validates compose interpolation and confirms `OPENAI_API_KEY` is wired as a required variable. The second validates the template catalog metadata.

## Update Path

1. Review upstream changes in https://github.com/HashWarlock/graphiti/tree/main/mcp_server.
2. Choose and record a new immutable upstream commit SHA.
3. Update `UPSTREAM_COMMIT` and the image tag in `docker-compose.yml`.
4. Re-check upstream environment variables, dependency lockfile behavior, and the Graphiti MCP launch command.
5. Run `OPENAI_API_KEY=dummy docker compose -f templates/prebuilt/zep-graphiti-mcp/docker-compose.yml config`.
6. Run `python3 templates/validate.py` from the repository root.
7. Smoke test `/sse` after deploying on Phala Cloud.

Keep this template self-contained. Do not replace the inline Dockerfile with an external `Dockerfile` path unless Phala Cloud deployment is also changed to provide that exact build context.
