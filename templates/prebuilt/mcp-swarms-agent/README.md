# Swarms Agent

Phala Cloud prebuilt template for the Swarms legal team agent.

This template is maintained in `Phala-Network/phala-cloud` so the Phala Cloud
catalog PR can ship without waiting for an upstream PR merge. It currently uses
the published upstream runtime image pinned by digest:

```text
0xii/swarms-template@sha256:68f8c1b8992c35de43452e062cfa7c3bdb25d754287284601444521eaa3bd5e6
```

The compose service requests `linux/amd64`. This is still an external upstream
image dependency.

## Upstream

- Repository: `https://github.com/The-Swarm-Corporation/Phala-Deployment-Template`
- Runtime image:
  `0xii/swarms-template@sha256:68f8c1b8992c35de43452e062cfa7c3bdb25d754287284601444521eaa3bd5e6`
- License: MIT. Preserve the upstream MIT license notice when copying,
  vendoring, or materially updating upstream application files.

## Why this uses the upstream image

Live smoke testing showed that the previous `dockerfile_inline` build, which
fetched upstream source and installed upstream's unpinned Python requirements,
now resolves a newer `swarms` package and fails immediately with:

```text
create_agents_from_yaml() got an unexpected keyword argument model
```

The previously tested upstream runtime image ran far enough to start the agents
and only failed on the dummy OpenAI key. This template therefore pins that
runtime image by digest while keeping the no-restart-loop command behavior.

## Environment Variables

- `OPENAI_API_KEY` (required): A real OpenAI-compatible API key. Dummy values
  are only useful for rendering compose config or testing failure behavior.
- `OPENAI_API_BASE` (optional): OpenAI-compatible API base URL. Defaults to
  `https://api.openai.com/v1`.
- `MODEL_NAME` (optional): Model name. Defaults to `gpt-4o-mini`.

## Runtime Behavior

The agent is a one-shot workload and does not expose a public HTTP service.
This compose file intentionally publishes no ports.

The command is:

```sh
python3 main.py; sleep infinity
```

With a dummy or invalid `OPENAI_API_KEY`, `main.py` is expected to log provider
authentication errors and exit. The container then remains running in
`sleep infinity` so the logs can be inspected instead of restarting every few
seconds. If `OPENAI_API_KEY` is missing, Docker Compose fails during config
rendering because the variable is marked required.

## Smoke Check

Render the compose file with dummy credentials:

```sh
OPENAI_API_KEY=dummy docker compose config
```

Expected result: compose renders successfully, the service uses the digest-pinned
`0xii/swarms-template` image on `linux/amd64`, `OPENAI_API_BASE` resolves to
`https://api.openai.com/v1`, `MODEL_NAME` resolves to `gpt-4o-mini`, and no
ports are published.

From the repository root, also run:

```sh
python3 templates/validate.py
```

## TODO / Update Path

1. Recover the exact dependency versions that work with the upstream app,
   especially the compatible `swarms` API version.
2. Replace this external upstream image dependency with either a
   Phala-maintained image pinned by digest or a build wrapper that pins upstream
   source plus all drifting Python dependencies.
3. Do not return to an unpinned `requirements.txt` rebuild; it has already
   drifted into the `create_agents_from_yaml()` API break above.
4. Keep the semicolon command behavior, or an equivalent wrapper, so invalid
   credentials do not cause a restart loop.
5. Re-run `OPENAI_API_KEY=dummy docker compose config` from this template
   directory and `python3 templates/validate.py` from the repository root.
6. Perform a live smoke test with real OpenAI-compatible credentials before
   publishing a replacement image or build wrapper.
