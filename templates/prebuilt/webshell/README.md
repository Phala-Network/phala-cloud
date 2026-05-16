# Webshell on Phala Cloud

This template runs a browser-accessible `ttyd` shell on port `7681` in a Phala Cloud CVM.

## Upstream reference

The previous catalog entry pointed at the Dstack examples webshell at https://github.com/Dstack-TEE/dstack-examples/tree/main/webshell. This local Phala Cloud template keeps `ttyd` as the reference implementation, but it does not deploy the external compose file and does not depend on an unmerged upstream pull request.

The image is built from public Alpine packages using the inline Dockerfile in `docker-compose.yml`. Alpine v3.22 publishes `ttyd` from the community repository: https://pkgs.alpinelinux.org/package/v3.22/community/x86_64/ttyd.

## Security changes

- Requires HTTP basic auth through `WEBSHELL_PASSWORD`.
- Uses `WEBSHELL_USER` for the HTTP basic auth username, defaulting to `phala`.
- Does not provide or document a real default password.
- Runs the shell as the non-root `phala` user with UID/GID `1000`.
- Does not use `network_mode: host`.
- Does not bind mount `/` or any other host path.
- Drops Linux capabilities and enables `no-new-privileges`.

The shell starts in `/workspace` inside the container. Files created there live in the container filesystem for that deployment; no host filesystem is exposed.

## Environment variables

Required:

```env
WEBSHELL_PASSWORD=example-value-for-compose-check
```

Optional:

```env
WEBSHELL_USER=phala
```

Use a long random password. Do not commit real credentials.

## Deploy

From this directory:

Generate a long random value locally, then export WEBSHELL_PASSWORD before deployment.

```bash
docker compose config
docker compose up -d
```

On Phala Cloud, set `WEBSHELL_PASSWORD` in encrypted environment variables or secrets before deployment. Set `WEBSHELL_USER` only if you want a username other than `phala`.

## Probe expectations

- Published port: `7681`.
- An unauthenticated HTTP request should return an HTTP basic auth challenge, usually `401 Unauthorized`.
- A browser or probe using `WEBSHELL_USER` and `WEBSHELL_PASSWORD` should reach the `ttyd` terminal UI.
- The shell process should run as UID/GID `1000`, not as root.

Local probes:

```bash
curl -i http://127.0.0.1:7681/
curl -i -u "${WEBSHELL_USER:-phala}:${WEBSHELL_PASSWORD}" http://127.0.0.1:7681/
```

The first command is expected to be rejected by basic auth. The second command should return the `ttyd` web UI when the service is running.

## Update procedure

1. Review the current `ttyd` package in the Alpine package index and the `ttyd` upstream release notes at https://github.com/tsl0922/ttyd/releases.
2. Update the Alpine base image tag or package list in the inline Dockerfile when needed.
3. Keep `WEBSHELL_PASSWORD` required and keep `WEBSHELL_USER` optional with the `phala` default unless the product contract changes.
4. Do not reintroduce host networking, host bind mounts, root shell execution, or default credentials.
5. Run `WEBSHELL_PASSWORD=example-value-for-compose-check docker compose config` from this directory.
6. Run `python3 templates/validate.py` from the repository root.
