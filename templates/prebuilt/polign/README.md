# polign_db

polign_db is a memory store and a vector database that encrypts everything before it leaves the process. This template runs it in a Phala Cloud CVM with encryption on, the keyring delivered through the encrypted environment, and a bearer token in front of the API.

[![Deploy on Phala Cloud](https://cloud.phala.com/deploy-button.svg)](https://cloud.phala.com/templates/polign)

## What runs

- `polign`: polign_db `v0.5.0` on `alpine:3.20`. On first start it downloads the Linux release from `dl.polign.com` (a redirect to the GitHub release at `github.com/Polign/polign`), checks the SHA-256 against the release's `checksums.txt`, and keeps the binaries on the volume so restarts do not download again. HTTP on 23000 inside the container. gRPC on `127.0.0.1:23001`, not reachable from outside.
- `proxy`: Caddy on public port `23000`. Every request needs `Authorization: Bearer <BEARER_TOKEN>`. `GET /healthz` is open so the endpoint can be probed.

Data lives on the CVM volume by default (`fs:/data/store`). Point `POLIGN_STORE` at an S3 or GCS bucket and the bucket becomes the database; see [Using your own bucket](#using-your-own-bucket).

Default size is 1 vCPU, 2 GB memory, 20 GB disk (`tdx.small`). Enough to try it, not a capacity plan.

## Deploy

1. Make the two secrets. Keep a copy of the keyring somewhere outside Phala Cloud; without it the data cannot be read.

```bash
printf '1=%s\n' "$(openssl rand -base64 32)"   # POLIGN_STORE_ENCRYPTION_KEYS
openssl rand -hex 32                            # BEARER_TOKEN
```

2. Create a CVM from the `polign` template and enter both values as encrypted environment variables. Leave the rest at defaults.
3. Expose port `23000`.
4. Deploy. The first start downloads about 85 MB, so give it a minute or two before the health check goes green.

No model, GPU, provider key, or external database is needed.

## Environment variables

Required:

| Variable | What it is |
| --- | --- |
| `POLIGN_STORE_ENCRYPTION_KEYS` | The keyring. One key per line as `<id>=<base64 of 32 random bytes>`, ids from 1 up. The container exits if this is empty. |
| `BEARER_TOKEN` | What clients send as `Authorization: Bearer <token>`. Anyone with it can read, write, and delete every collection. |

Optional:

| Variable | Default | What it is |
| --- | --- | --- |
| `POLIGN_VERSION` | `v0.5.0` | Release tag to download. Change it to upgrade; the data stays where it is. |
| `POLIGN_STORE` | `fs:/data/store` | Where the database lives: the volume, or `s3://bucket/prefix`, or `gcs://bucket/prefix`. Pick before the first write; a store cannot be converted later. |
| `POLIGN_DISK_CACHE_BYTES` | `4294967296` | Disk cache budget under `/data/cache`, used only with a bucket store. |

Only for a bucket store:

| Variable | Store | What it is |
| --- | --- | --- |
| `POLIGN_STORE_REGION` | S3 | The bucket's AWS region as AWS reports it, for example `us-west-2`. Not the Phala region. Ignored for GCS. |
| `POLIGN_STORE_ROLE_ARN` | S3 | Role polign assumes for every bucket request. Recommended. |
| `POLIGN_STORE_EXTERNAL_ID` | S3 | External id for the AssumeRole call. Encrypted. |
| `AWS_ACCESS_KEY_ID` | S3 | Access key of the bootstrap user, or of a user with the bucket policy if you skip the role. Encrypted. |
| `AWS_SECRET_ACCESS_KEY` | S3 | Its secret. Encrypted. |
| `GOOGLE_APPLICATION_CREDENTIALS_BASE64` | GCS | Base64 of a service-account key file. Decoded into RAM at start, never written to disk. Encrypted. |

The container checks these before downloading anything and exits with a message naming what is missing.

## Encryption

Unlike bucket-side encryption (SSE-S3 or SSE-KMS) where encryption is done by the storage service, polign_db in a CVM encrypts data inside the process itself. The encryption is performed with AES-256-GCM under keys read from `POLIGN_STORE_ENCRYPTION_KEYS`. Every object it writes, and every disk-cache entry, is ciphertext. The store only ever sees object names, sizes, and access patterns.

Phala Cloud decrypts the environment inside the CVM after attestation, so the keyring exists in plaintext only in protected memory. polign never fetches keys from a key service.

On first write polign puts a small `.encryption` marker in the store. After that, any process that opens the store without the keys stops at startup instead of reading garbage or writing plaintext.

To rotate, add a line `2=<new key>` to the variable and redeploy. New writes use the highest id; every id listed still decrypts. Never remove a key that has written to the store.

Format and rotation details: <https://polign.com/security.html#encryption> and <https://polign.com/operations.html#encryption-at-rest>.

## Using your own bucket

With a bucket store the CVM is disposable. Start a new one with the same `POLIGN_STORE` and keyring and it serves the same collections. The bucket, its versions, and its backups hold ciphertext only.

Some cloud credential has to go into the CVM for this. A Phala CVM has no instance role, and neither AWS nor Google accepts TDX attestation as an identity. The setups below keep that credential as weak as possible. Whatever it can reach is ciphertext, so a leaked credential can delete data but not read it.

Regions: Phala's region ids (`us-west` in `phala deploy --region us-west`) are Phala's own. `POLIGN_STORE_REGION` is the AWS region of the bucket (`us-west-2`), which you can look up with `aws s3api get-bucket-location --bucket BUCKET` (`null` means `us-east-1`). GCS interaction doesn't require a region.

### S3

Use a bootstrap IAM user whose only permission is `sts:AssumeRole` on one role, and give the role the bucket policy. polign assumes the role with `POLIGN_STORE_ROLE_ARN` and `POLIGN_STORE_EXTERNAL_ID` and signs every request with short-lived credentials. The access key on its own can do nothing on S3. To cut access, remove the user from the role's trust policy; nothing needs rotating. Each session shows up in CloudTrail as `AssumeRole` with session name `polign-store`.

If the whole environment leaks, the attacker has the key and the external id and can assume the role until you edit the trust policy. That is the limit of this setup.

1. Create the bucket. Block public access. Note its region.

2. Create a role, say `polign-phala`, with this trust policy. Make the external id with `openssl rand -hex 16`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::ACCOUNT:user/polign-phala-bootstrap" },
      "Action": "sts:AssumeRole",
      "Condition": { "StringEquals": { "sts:ExternalId": "EXTERNAL_ID" } }
    }
  ]
}
```

3. Attach this policy to the role. It is the minimum polign_db needs:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:AbortMultipartUpload",
        "s3:ListMultipartUploadParts"
      ],
      "Resource": "arn:aws:s3:::BUCKET/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:GetBucketLocation",
        "s3:ListBucketMultipartUploads"
      ],
      "Resource": "arn:aws:s3:::BUCKET"
    }
  ]
}
```

4. Create the user `polign-phala-bootstrap` with only this inline policy, and one access key:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": "arn:aws:iam::ACCOUNT:role/polign-phala"
    }
  ]
}
```

5. Deploy with these. The external id and the key pair go in as encrypted variables:

```bash
POLIGN_STORE=s3://BUCKET/polign
POLIGN_STORE_REGION=us-west-2
POLIGN_STORE_ROLE_ARN=arn:aws:iam::ACCOUNT:role/polign-phala
POLIGN_STORE_EXTERNAL_ID=EXTERNAL_ID
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```

6. Check the log for these two lines. After the first write the bucket has an `.encryption` object and a `.wal/` prefix, none of it readable:

```
store principal: this server's stores are opened by assuming arn:aws:iam::ACCOUNT:role/polign-phala
store encryption: on (write key id 1, 1 key(s) in the keyring); every object this server writes, and every disk-cache entry, is ciphertext
```

If you would rather skip the role, attach the policy from step 3 to the user directly and leave `POLIGN_STORE_ROLE_ARN` and `POLIGN_STORE_EXTERNAL_ID` empty. A bucket in another account works the same way: the role lives there and its trust policy names the user by ARN. See <https://polign.com/operations.html#cross-account-buckets>.

### GCS

Google's client libraries want a key file at the path in `GOOGLE_APPLICATION_CREDENTIALS`. The template takes the file base64-encoded in `GOOGLE_APPLICATION_CREDENTIALS_BASE64`, decodes it into `/dev/shm` (RAM inside the CVM), points polign at it, and drops the variable from polign's environment. The key never touches disk.

There is no role to assume here. polign-server opens its own store with the credential it is given, so the service account behind the key holds the bucket role directly. Grant it on the one bucket, not the project. To cut access, delete the key or disable the account; tokens already issued last up to an hour.

1. Create the bucket. Keep public access prevention on.

2. Create a service account and give it `roles/storage.objectAdmin` on the bucket. If you want it tighter, a custom role with `storage.objects.create`, `delete`, `get`, and `list` is enough.

```bash
gcloud iam service-accounts create polign-phala --project PROJECT
gcloud storage buckets add-iam-policy-binding gs://BUCKET \
  --member=serviceAccount:polign-phala@PROJECT.iam.gserviceaccount.com \
  --role=roles/storage.objectAdmin
```

3. Make one key, encode it, delete the file:

```bash
gcloud iam service-accounts keys create key.json \
  --iam-account=polign-phala@PROJECT.iam.gserviceaccount.com
base64 -w0 key.json    # macOS: base64 -i key.json
rm key.json
```

4. Deploy with these. The key goes in as an encrypted variable:

```bash
POLIGN_STORE=gcs://BUCKET/polign
GOOGLE_APPLICATION_CREDENTIALS_BASE64=<base64 output>
```

Azure Blob works in polign_db (`az://account/container/prefix` with `AZURE_STORAGE_CONNECTION_STRING`) but is not wired into this template.

## Try it

Replace `<app>` with the domain Phala Cloud gives you and `$TOKEN` with your bearer token.

```bash
curl https://<app>/healthz                                  # ok, no token needed
curl -i https://<app>/v1/collections/docs/vectors/a         # 401 without the token

curl -X PUT https://<app>/v1/collections/docs/vectors/a \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"values":[1,0,0],"metadata":{"label":"first"}}'

curl -X POST https://<app>/v1/collections/docs/query \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"values":[0.9,0.1,0],"k":5}'
```

A collection is created on the first write and takes its dimension from that vector. The Python SDK (`pip install polign`) sends the same header:

```python
from polign import Client

c = Client("https://<app>", api_key="<BEARER_TOKEN>")
c.put("docs", "a", [1.0, 0.0, 0.0], metadata={"label": "first"})
print(c.search("docs", [0.9, 0.1, 0.0], k=5))
```

To run it locally from the repo root:

```bash
printf 'POLIGN_STORE_ENCRYPTION_KEYS=1=%s\nBEARER_TOKEN=%s\n' "$(openssl rand -base64 32)" "$(openssl rand -hex 32)" > /tmp/polign.env
docker compose -f templates/prebuilt/polign/docker-compose.yml --env-file /tmp/polign.env up -d
curl http://127.0.0.1:23000/healthz
docker compose -f templates/prebuilt/polign/docker-compose.yml --env-file /tmp/polign.env down -v
```

## Day to day

- Upgrade: set `POLIGN_VERSION` to the new tag and redeploy. Release notes are at <https://github.com/Polign/polign/releases>.
- Rotate the token: redeploy with a new `BEARER_TOKEN`. Old one gets `401` from then on.
- Rotate the AWS key: add a second key to the bootstrap user, redeploy, delete the old one. To cut access now, edit the trust policy first.
- Rotate the GCS key: same, on the service account. To cut access now, delete the old key first.
- Backups: with a bucket, versioning or replication is enough, it copies ciphertext. With the volume store, snapshot the CVM disk. Either way keep the keyring somewhere the backup is not.
- Everything on the volume is under `/data`: the database in `/data/store` (volume store only), binaries in `/data/bin/<version>`, disk cache in `/data/cache` (bucket stores only). Deleting the volume deletes a volume-store database.
- Changing `POLIGN_STORE` starts an empty database in the new place. Data does not move.
- One shared token is the only auth here. polign_db has per-client API keys too (`polign-server -require-data-key`, keys from `polign-apikey`, both in `/data/bin`) if you need them; adapt the start command.
- Serving is cold-first with a hot tier in memory. Size memory to the data you query often, not the whole dataset.
- TLS ends at the Phala gateway. Caddy to polign is a private container network.

## Upstream

- Site and docs: <https://polign.com>
- Releases and checksums: <https://github.com/Polign/polign>
- Author: Polign. Binaries ship under the license in the release archive.
- Icon: `templates/icons/polign.svg`, the Polign mark from polign.com.
