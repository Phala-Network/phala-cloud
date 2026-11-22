# phala api

Make authenticated HTTP requests to the Phala Cloud API with automatic credential handling.

## Usage

    phala api <endpoint> [options]

## Arguments

| Name       | Required | Description                              |
| ---------- | -------- | ---------------------------------------- |
| `endpoint` | Yes      | API endpoint path (e.g., `/api/v1/cvms`) |

## Options

| Flag                  | Short | Default | Description                                                                                 |
| --------------------- | ----- | ------- | ------------------------------------------------------------------------------------------- |
| `--method <method>`   | `-X`  | GET     | HTTP method (GET, POST, PUT, DELETE, PATCH, etc.)                                           |
| `--query <param>`     | `-f`  |         | Query parameter: `key=value` (use `key=@file` for file). Repeatable                         |
| `--field <field>`     | `-F`  |         | Body field: `key=value` (string) or `key:=value` (typed JSON). Supports `@file`. Repeatable |
| `--multipart`         |       | false   | Send `-F` fields as multipart/form-data; in this mode `key=@path` attaches a file           |
| `--header <header>`   | `-H`  |         | HTTP header `key:value`. Repeatable                                                         |
| `--data <data>`       | `-d`  |         | Request body (cURL-style). Repeatable                                                       |
| `--input <file>`      |       |         | Read body from file (use `-` for stdin)                                                     |
| `--include`           | `-i`  | false   | Print response headers                                                                      |
| `--jq <expression>`   | `-q`  |         | Filter output with jq expression                                                            |
| `--silent`            |       | false   | Suppress response body                                                                      |
| `--api-token <token>` |       |         | Override API token                                                                          |

## Flag Semantics

- **`-f` (query)**: Always appended to the URL as query parameters, regardless of HTTP method.
- **`-F` (body field)**: Sent as JSON by default. Supports `key=value` for strings and `key:=value` for typed JSON (numbers, booleans, null, arrays, objects).
- **`--multipart`**: Sends the `-F` fields as multipart/form-data. `key=@path` attaches the file with its original filename; `key=value` adds a text field. Without `--multipart`, the existing `key=@path` behavior still reads the file content into the JSON field.
- **`-d` (data)**: Raw request body. If the value is valid JSON, it is sent as JSON automatically.
- **`--input`**: Read body from a file.

`-f` can be combined with any body option (`-F`, `-d`, `--input`).
`-F`, `-d`, and `--input` are mutually exclusive. `--multipart` requires at least one `-F` field and cannot be combined with `-d` or `--input`.

## Environment Variables

- `PHALA_CLOUD_API_KEY`: Override API key
- `PHALA_CLOUD_API_PREFIX`: Override API base URL
- `PHALA_CLOUD_REQUESTS_PER_MINUTE`: Pace request starts for each credential (default: `180`; must be a positive integer)

## Examples

List CVMs:

    $ phala api /api/v1/cvms

Extract CVM names with jq:

    $ phala api /api/v1/cvms -q '.[].name'

GET with query parameters:

    $ phala api /api/v1/cvms -f status=active -f page=2

POST with body fields (string and typed):

    $ phala api /api/v1/cvms -X POST -F name=my-app -F vcpu:=2 -F memory:=4096

POST with cURL-style -d:

    $ phala api /api/v1/endpoint -X POST -d '{"name":"test"}'

POST from file:

    $ phala api /api/v1/cvms -X POST --input request.json

POST from stdin:

    $ echo '{"name":"test"}' | phala api /api/v1/cvms -X POST --input -

Query params + body combined:

    $ phala api /api/v1/cvms -X POST -f page=1 -F name=my-app -F vcpu:=2

Body field from file (read into the JSON body):

    $ phala api /api/v1/endpoint -X POST -F config:=@settings.json

Upload a file as multipart/form-data:

    $ phala api /admin/changelog/images -X POST --multipart -F file=@cover.png

Upload a file with additional text fields:

    $ phala api /admin/changelog/images -X POST --multipart -F file=@cover.png -F alt="Release cover"

Delete CVM:

    $ phala api /api/v1/cvms/123 -X DELETE

Include response headers:

    $ phala api /api/v1/status -i

Add custom headers:

    $ phala api /api/v1/cvms -H "X-Custom-Header:value"

Filter nested JSON with jq:

    $ phala api /api/v1/cvms -q '.[].status | select(.state == "running")'
