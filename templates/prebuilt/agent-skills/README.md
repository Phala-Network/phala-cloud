# addyosmani/agent-skills on Phala Cloud

This template runs a CPU-safe verifier for `addyosmani/agent-skills` behind a public Caddy proxy. The app fetches the real upstream source tree, runs the upstream `scripts/validate-skills.js` validator, parses skill frontmatter and plugin manifests, and exposes deterministic JSON endpoints for smoke testing.

The default service does not run an AI coding agent, does not call model providers, does not require browser authentication, does not download model weights, and does not need credentials. The upstream project is a Markdown/plugin skill pack for AI coding agents rather than a long-running inference or orchestration server, so this template verifies the source artifact honestly instead of pretending to host an LLM.

## Metadata

- Template id: `agent-skills`
- Category: AI Agents & Developer Tools
- Upstream repo: `https://github.com/addyosmani/agent-skills`
- Upstream author: `addyosmani`
- Default upstream ref: `d187883b7d761265309cdcc0f202cc76b4b3fb06`
- Runtime: `node:22-alpine` plus `git` installed at container startup
- Icon source: upstream README image `https://addyosmani.com/assets/images/addys-agent-skills.jpg`

## Services

- `app`: internal Node HTTP verifier. It fetches the upstream source, runs `scripts/validate-skills.js`, parses `plugin.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, command files, agent personas, references, and every `skills/*/SKILL.md` file, then serves JSON on port `8000`.
- `proxy`: public Caddy reverse proxy. It is the only service with a host port mapping and exposes `8080:80`.

## Deploy

From this template directory:

```bash
docker compose config
docker compose up -d
```

On Phala Cloud, deploy the prebuilt template and open the public endpoint on port `8080`.

First start requires network access to fetch the upstream repository and install Alpine `git`/CA packages inside the container. No persistent volume is required.

## Environment Variables

The default template requires no credentials.

| Variable | Default | Required | Description |
| --- | --- | --- | --- |
| `AGENT_SKILLS_REPO` | `https://github.com/addyosmani/agent-skills.git` | No | Source repository fetched by the verifier. Override only for testing a fork. |
| `AGENT_SKILLS_REF` | `d187883b7d761265309cdcc0f202cc76b4b3fb06` | No | Git branch, tag, or commit fetched with `git fetch --depth 1`. The default is the upstream `main` commit inspected when this template was created. |
| `APP_PORT` | `8000` | No | Internal Node app port. Caddy proxies to this port; the host only exposes `8080:80`. |

Provider keys such as `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_API_KEY`, or editor/browser credentials are intentionally not required and are not consumed by the verifier. Add credentials only if you replace this verifier with an actual agent runtime that uses the skill pack with a provider-backed coding agent.

## Exposed Endpoints

The public HTTP API is available through Caddy on port `8080`.

- `/healthz`: returns HTTP 200 when the source checkout, upstream validator, and local skill inspection pass. Returns HTTP 503 with diagnostic details if checkout or validation fails.
- `/demo`: returns verifier details including resolved commit, upstream validator output tail, parsed plugin metadata, command file lists, agent persona files, reference files, skill counts, and sample skill frontmatter.
- `/v1/models`: returns an OpenAI-shaped model list with `agent-skills/no-llm-verifier`. It is metadata only; the template does not host or call a model.

## Smoke Verification

Run these checks after deployment to verify the service:

```bash
docker compose ps
curl -i http://localhost:8080/healthz
curl -fsS http://localhost:8080/demo | jq '.ok, .demo.counts, .provider_calls, .credentials_required'
curl -fsS http://localhost:8080/v1/models | jq '.data[0].id'
```

Expected results:

- `GET /healthz` returns `200 OK`.
- `/demo` reports `.ok` as `true`.
- `.demo.counts.skills` is `24` for the inspected upstream commit.
- `.provider_calls` is `false`.
- `.credentials_required` is `false`.
- `/v1/models` includes `agent-skills/no-llm-verifier`.

## Production Notes

- Use this template as a source verifier and compatibility smoke test for the upstream skill pack.
- To use the skills in production, install the upstream repo into a supported coding-agent environment such as Claude Code plugins, Cursor rules, Gemini CLI skills, Antigravity, OpenCode, Windsurf, GitHub Copilot instructions, or another agent that accepts Markdown instructions.
- The template intentionally avoids running an AI coding agent in the CVM because upstream `agent-skills` is not a provider-neutral server. Real agent execution usually requires editor integration, project workspace access, and model/provider credentials supplied at deployment time.
- The default ref is pinned for reproducibility. Override `AGENT_SKILLS_REF` to test a newer upstream branch, tag, or commit.
- Only Caddy publishes a host port: `8080:80`.
- The app service is internal and uses `expose`, not `ports`.
- The template does not use privileged mode, host networking, host IPC, Docker socket mounts, host bind mounts, external build contexts, `env_file`, or external credentials.

## Cleanup

```bash
docker compose down
```

No named volumes are created by this template.
