# iptv-org/iptv on Phala Cloud

This template runs a CPU-safe HTTP verifier for `iptv-org/iptv`, the public IPTV playlist and metadata project. It starts one small Node.js service, installs the real `@iptv-org/sdk` package at container startup, loads public `iptv-org` API JSON through that SDK, and exposes JSON endpoints for health checks, deterministic search demos, upstream metadata, and OpenAI-compatible model-list smoke checks.

It does not fetch live video streams, proxy playlist entries, rebroadcast channels, transcode media, call LLM providers, download model weights, use browser authentication, or require credentials.

## Metadata

- Template id: `iptv`
- Display name: `iptv-org/iptv`
- Category: AI Apps & Workflows
- Upstream repository: https://github.com/iptv-org/iptv
- Upstream API docs: https://github.com/iptv-org/api
- Upstream SDK package: https://www.npmjs.com/package/@iptv-org/sdk
- Default SDK version: `1.5.0`
- Upstream license: The repository metadata reports `Unlicense`; the README also links a CC0 license badge.
- Icon source: `https://iptv-org.github.io/icon.svg` from the public `iptv-org` GitHub Pages app, saved as `templates/icons/iptv.svg`
- Phala prebuilt source: https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/iptv

## What This Template Runs

The compose file starts one public HTTP service:

- `app`: A `node:22-bookworm-slim` container running an inline Node.js HTTP server on port `8080`.

At startup, the service runs:

```bash
npm install --omit=dev --no-audit --no-fund "@iptv-org/sdk@${IPTV_SDK_VERSION}"
```

Then it follows the upstream SDK quick-start path:

```js
const client = new sdk.Client({ dataDir: '/tmp/iptv-org-sdk-data' })
await client.load()
const data = client.getData()
client.searchChannels(query)
```

`client.load()` downloads public JSON metadata from `https://iptv-org.github.io/api`, including channels, countries, streams, guides, categories, and related lookup data. The demo uses the SDK's local processed data and search index. It never opens the stream URLs contained in the metadata.

## Difference From Full IPTV Playback

The upstream `iptv-org/iptv` repository is not a server application. Its README says to paste playlist URLs into a compatible media player, lists `https://iptv-org.github.io/iptv/index.m3u` as the main playlist, points API users to `iptv-org/api`, and explains that no video files are stored in the repository.

This Phala template is therefore a verifier and metadata demo, not an IPTV player, CDN, media proxy, or channel rebroadcaster. It is useful for checking that a Phala CVM can install and use the real upstream SDK and query the upstream public metadata set on a small CPU-only instance.

## Deploy On Phala Cloud

1. Deploy the `iptv` prebuilt template.
2. Keep the default resource profile for the verifier: 1 vCPU, 1 GiB memory, 10 GiB disk.
3. Leave the environment variables at their defaults unless you are intentionally testing another SDK release or default search query.
4. Open the generated public endpoint for port `8080`.
5. Visit `https://<your-app-domain>/healthz`.

The first startup downloads the npm package and public API JSON data. No private repositories, media-provider accounts, model registries, paid provider APIs, host bind mounts, Docker socket access, host networking, external build contexts, `env_file`, privileged mode, or secrets are required.

## Environment Variables

No credentials are required for the default verifier.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `IPTV_SDK_VERSION` | No | `1.5.0` | Version of the real `@iptv-org/sdk` npm package installed at container startup. |
| `IPTV_DEMO_QUERY` | No | `news` | Default channel search query used by `GET /demo` when no `q` parameter is supplied. |

If you replace this verifier with a custom playback or playlist-serving application, add only the variables that deployment requires and store secrets through Phala Cloud configuration. Never commit real API keys, stream-provider credentials, tokens, OTPs, passwords, or private keys.

## Endpoints

The public endpoint serves JSON on port `8080`:

- `GET /healthz`: Readiness and SDK load status. Returns HTTP `200` only after the SDK data load succeeds.
- `GET /demo`: Searches channels with the SDK's local search index. Optional query parameters: `q` and `limit` from 1 to 20.
- `GET /v1/models`: OpenAI-compatible model-list shape containing `iptv-org/sdk-metadata-demo`. This is a compatibility smoke endpoint only; it is not an LLM or media model.
- `GET /upstream`: Upstream facts, inspected runtime docs, playlist/API URLs, icon source, package version, counts, and caveats.
- `GET /`: Basic service status and endpoint list.

`/demo` returns channel summaries and redacted stream metadata such as title, quality, protocol, and whether special headers are required. It intentionally does not return full stream URLs and does not request the remote video streams.

## Smoke Verification

Use these commands to verify the Compose file and running HTTP endpoints from the parent monorepo worktree.

From the parent monorepo worktree:

```bash
docker compose -f templates/prebuilt/iptv/docker-compose.yml config >/dev/null
docker compose -f templates/prebuilt/iptv/docker-compose.yml up -d

curl -fsS http://localhost:8080/healthz
curl -fsS 'http://localhost:8080/demo?q=news&limit=5'
curl -fsS http://localhost:8080/v1/models
curl -fsS http://localhost:8080/upstream

docker compose -f templates/prebuilt/iptv/docker-compose.yml down
```

With `jq` available, the important checks are:

```bash
curl -fsS http://localhost:8080/healthz | jq '.ok, .status, .counts.channels, .counts.streams'
curl -fsS 'http://localhost:8080/demo?q=news&limit=5' | jq '.result_count, .safety.stream_fetches_performed, .channels[0].id'
curl -fsS http://localhost:8080/v1/models | jq '.data[0].id, .data[0].metadata.ready'
curl -fsS http://localhost:8080/upstream | jq '.sdk_package, .playlist_url, .caveats[0]'
```

Expected results:

- `/healthz` returns HTTP `200`, `"ok": true`, and non-zero channel/stream counts after startup.
- `/demo` returns search results for the query and `"stream_fetches_performed": false`.
- `/v1/models` includes `iptv-org/sdk-metadata-demo`.
- `/upstream` reports `@iptv-org/sdk`, the upstream playlist URL, and verifier caveats.

## Validation

Expected template-factory validation from the parent monorepo worktree:

```bash
python3 templates/validate.py
git diff --check origin/main...HEAD
docker compose -f templates/prebuilt/iptv/docker-compose.yml config >/dev/null
```

## Resource Notes

The default resource profile is intentionally small:

- 1 vCPU
- 1 GiB memory
- 10 GiB disk

The verifier downloads a small npm package plus public JSON metadata and stores runtime cache data under `/tmp` inside the container. It does not create named volumes.

## Security Notes

- The default HTTP verifier is unauthenticated and returns public metadata only.
- The compose file uses one public base image and inline Compose configs only.
- The compose file does not use host bind mounts, named volumes, `env_file`, real secrets, privileged mode, host networking, host IPC, external build contexts, Docker socket access, or GPU device requests.
- The `/v1/models` endpoint is a compatibility stub. It does not indicate that a model server, LLM gateway, or media service is running.
- The verifier does not fetch live stream URLs. If you build a production player or proxy, review copyright, geo-restriction, rate-limit, caching, logging, and access-control requirements before exposing it publicly.

## Production Notes

To build production usage around `iptv-org/iptv` instead of this verifier:

- Follow the upstream README and API documentation for playlist/API data usage.
- Pin npm package versions and any source refs you consume.
- Cache public metadata responsibly and respect upstream update cadence.
- Do not assume stream URLs are stable, globally reachable, legal to rebroadcast, or free of geo-restrictions.
- Use a dedicated player, playlist manager, or API layer for real users; this template is only a metadata verifier.
- Add authentication and rate limits before exposing custom search, playlist generation, or proxying features.
- Store any required downstream credentials as Phala Cloud secrets or required environment variables with placeholders.

## Upstream Attribution

`iptv-org/iptv` is developed by the `iptv-org` community: https://github.com/iptv-org/iptv.

The upstream README describes the project as a collection of publicly available IPTV channels from all over the world, documents the main playlist at `https://iptv-org.github.io/iptv/index.m3u`, points API users to `iptv-org/api`, and states that no video files are stored in the repository. This Phala Cloud prebuilt template preserves upstream attribution in the template metadata and README while routing deployable assets through the Phala prebuilt template path: https://github.com/Phala-Network/phala-cloud/tree/main/templates/prebuilt/iptv.
