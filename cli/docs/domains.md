# phala domains

Manage custom domains of your apps. Domains belong to the workspace; each one is bound to an app and served on an HTTPS port (443 unless you say otherwise).

Typical flow: `check` the DNS, `add` the domain, publish the DNS records it prints, then `verify`. To serve the domain from your own compose file with dstack-ingress, run `setup` as well.

## Usage

    phala domains <subcommand> [args] [options]

Commands that need an app take `--app-id`, and fall back to `app_id` in `phala.toml` (see `phala link`).

## Subcommands

### domains ls

List the custom domains of the workspace. Values are never truncated.

#### Usage

    phala domains ls [options]

#### Options

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--app-id <id>` | | | Only list domains bound to this app |
| `--page <n>` | | 1 | Page number |
| `--page-size <n>` | | server default | Items per page (1-100) |
| `--json` | `-j` | false | Output in JSON format |

#### Examples

    $ phala domains ls
    DOMAIN           APP                                              PORT  DNS       ROUTING
    app.example.com  demo (50b0e827cc6c53f4010b57e588a18c5ef9388cc1)  443   verified  ok
    api.example.com  demo (50b0e827cc6c53f4010b57e588a18c5ef9388cc1)  8443  pending   -

    $ phala domains ls --app-id 50b0e827cc6c53f4010b57e588a18c5ef9388cc1 --json

DNS is `verified`, `pending` (not checked yet) or `error` (the last check failed; see `inspect`).

---

### domains inspect

Show the DNS records to publish, the DNS error, the routing status and the app's DNS guide (CNAME target, whether a TXT record is needed, whether dstack-ingress is configured). A domain bound to several apps is shown once per app.

#### Usage

    phala domains inspect <domain> [options]

#### Options

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--app-id <id>` | | | Only show the binding to this app |
| `--json` | `-j` | false | Output in JSON format |

---

### domains check

Check a domain's DNS against what the app expects, without adding it. Prints each record with its actual and expected value.

#### Usage

    phala domains check <domain> --app-id <id> [options]

#### Options

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--app-id <id>` | | `phala.toml` | App to check the domain for |
| `--port <n>` | | 443 | External HTTPS port the domain is served on |
| `--json` | `-j` | false | Output in JSON format |

The command exits 0 whether or not the DNS is ready. Read `is_valid` in the JSON output to gate a script.

---

### domains add

Add a custom domain to an app and print the DNS records you still have to publish.

#### Usage

    phala domains add <domain> --app-id <id> [options]

#### Options

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--app-id <id>` | | `phala.toml` | App to add the domain to |
| `--port <n>` | | 443 | External HTTPS port the domain is served on |
| `--json` | `-j` | false | Output in JSON format |

A domain registered by another workspace is refused with the server's message.

---

### domains verify

Re-check the DNS records of a domain you added. The app is found from the domain; pass `--app-id` when the domain is bound to more than one app.

#### Usage

    phala domains verify <domain> [options]

#### Options

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--app-id <id>` | | | Required when the domain is bound to more than one app |
| `--json` | `-j` | false | Output in JSON format |

---

### domains rm

Remove a custom domain from an app.

#### Usage

    phala domains rm <domain> [options]

#### Options

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--app-id <id>` | | | Required when the domain is bound to more than one app |
| `--yes` | `-y` | false | Skip the confirmation prompt |
| `--json` | `-j` | false | Output in JSON format |

The command asks for confirmation in a terminal. Without a terminal (CI, pipes, `--json`) it refuses unless you pass `--yes`.

---

### domains setup

Add the dstack-ingress sidecar for a domain to your local compose file. The server works out the service, and the CLI inserts it as text, so comments, anchors and formatting in your file are kept. It shows a diff, the environment variables the ingress needs and any warnings, and writes the file only after you confirm.

#### Usage

    phala domains setup <domain> --app-id <id> [options]

#### Options

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--app-id <id>` | | `phala.toml` | App the domain belongs to |
| `--port <n>` | | 443 | External HTTPS port the domain is served on |
| `--dns-provider <name>` | | cloudflare | DNS provider the ingress uses for certificates |
| `--compose <file>` | `-c` | `compose_file` in `phala.toml`, then `docker-compose.yml` | Compose file to edit |
| `--yes` | `-y` | false | Write without asking |
| `--json` | `-j` | false | Output in JSON format |

If the compose already has the ingress for this domain, nothing changes. Without a terminal and without `--yes`, the command prints the diff, leaves the file alone and exits non-zero.

#### Examples

    $ phala domains setup app.example.com --app-id 50b0e827cc6c53f4010b57e588a18c5ef9388cc1
    Changes to docker-compose.yml:

    --- a/docker-compose.yml
    +++ b/docker-compose.yml
    @@ -4,3 +4,14 @@
         image: nginx # web
         ports:
           - "8080:80"
    +  dstack-ingress:
    +    image: dstacktee/dstack-ingress:latest
    +    ports:
    +      - 443:443
    +    environment:
    +      - DOMAIN=app.example.com
    +      - GATEWAY_DOMAIN=dstack.example.net
    +    volumes:
    +      - cert-data:/etc/letsencrypt
    +volumes:
    +  cert-data:

    Environment variables the ingress needs:
      - CLOUDFLARE_API_TOKEN

    ? Write these changes to docker-compose.yml? (Y/n)

After the file is written, set the environment variables (in your `.env` file or with `phala envs`) and run `phala deploy`.

## Errors

| Situation | Message |
|-----------|---------|
| Unknown app or domain (404) | `App or domain not found` |
| Domain registered elsewhere (409, `add`) | The server's message |
| Lookup limit with a browser challenge (429) | The account hit the domain lookup limit; wait the stated seconds or use the dashboard |
| Lookup limit without a challenge (429) | Wait the stated seconds and try again |

`check`, `add` and `verify` share one rate limit.
