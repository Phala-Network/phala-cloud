# Anyone Network Relay on Phala Cloud

This template runs an Anyone Network Anon relay in a Phala Cloud CVM. It is based on the upstream Anyone relay Docker project at https://github.com/rA3ka/anon-relay-docker.

## Why the Dockerfile is embedded

Phala Cloud prebuilt templates are deployed from the template directory. The upstream project expects a separate Dockerfile from its repository, so a template that points directly at the external repo is not self-contained when Phala deploys only this compose file.

This template embeds the Dockerfile with Compose `dockerfile_inline` and embeds the relay configuration with a Compose `configs` entry. At deploy time, Phala only needs this `docker-compose.yml`; it does not need to fetch any extra source files from the upstream repository. The image build still installs the Anyone package from the Anyone Debian repository.

## Services

- `anon-relay`: Anyone Anon relay built from the inline Dockerfile.

## Ports and reachability

- `9001`: Anyone/Tor-style ORPort.

Port `9001` is not an HTTP endpoint. Browser checks, HTTP health checks, and normal `curl http://...:9001` requests are expected to fail, hang up, or return non-HTTP output. A successful deployment should be evaluated as an ORPort listener and by relay logs, not by expecting an HTTP response.

On Phala Cloud, fetch the live endpoint from the deployed CVM JSON instead of assuming a global gateway domain:

```bash
phala cvms get <cvm-id-or-name> --json | jq '.endpoints'
```

Relay operators should verify public ORPort reachability with Anyone/Anon relay logs or Nyx after deployment. The smoke test below verifies that the container starts and opens the OR listener inside the CVM; long-running relay publication and reward eligibility should be monitored by the operator.

## Relay configuration

The template includes this `anonrc` configuration inline:

```text
AgreeToTerms 1
ControlPort 9051
SocksPort 9050
Log notice file /var/log/anon/notices.log
ExitRelay 0
ORPort 9001
Nickname MyRelayNickname
ContactInfo my@example.mail
```

Update `Nickname` and `ContactInfo` before operating a public relay if you need operator-specific identity metadata. Do not place secrets in this file.

The compose file defines named volumes for `/var/lib/anon` and `/var/log/anon` so relay identity material and logs survive container restarts inside the CVM. Preserve `/var/lib/anon` when upgrading an existing relay.

## Deploy

```bash
docker compose config
docker compose up -d
```

## Update procedure

1. Review upstream changes in https://github.com/rA3ka/anon-relay-docker.
2. Copy the relevant Dockerfile changes into the `dockerfile_inline` block in `docker-compose.yml`.
3. Keep the `anonrc` config inline under `configs.anonrc.content`.
4. Run `docker compose config` from this directory.
5. Run `python3 templates/validate.py` from the repository root.
6. Run `git diff --check` before opening a pull request.

Because this template intentionally avoids deploy-time source-file dependencies, do not replace the inline Dockerfile with a reference to an external Dockerfile path.

## Live smoke evidence

A Phala Cloud smoke run verified this self-contained prebuilt compose:

- Workspace/profile: `h4x's projects` / `hermes-admin-cvm-check`
- CVM: `cvm_3e21M3jX`
- App ID: `9a066588923dd1d0a6fcdccaf9afc1f338d4bbaa`
- VM UUID: `5326c335-18d9-40c4-a32f-322922804a39`
- Endpoint: `https://9a066588923dd1d0a6fcdccaf9afc1f338d4bbaa-9001.dstack-pha-prod7.phala.network`
- Runtime evidence: CVM reached `running`, one `anon-relay` container was running, and the logs showed `Opened OR listener connection (ready) on 0.0.0.0:9001` and `[::]:9001`.
- Public HTTPS probe: returned an empty reply on `9001`, which is expected for this non-HTTP ORPort.
- Cleanup: stopped, deleted, and verified as not found after delete

No secrets are required or included in this template.
