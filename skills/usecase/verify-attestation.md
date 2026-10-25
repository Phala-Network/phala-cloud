---
name: verify-attestation
description: |
  Verify Phala Private AI through ACI gateway attestation, pinned TLS,
  signed receipts, and attested upstream sessions using the TypeScript SDK
  or Private AI Proxy. Also covers where to verify a self-deployed Phala
  Cloud CVM's Intel TDX, GPU, OS, application, and key-custody evidence.
  Use when users ask whether a workload or inference response runs in a TEE.
---

# Verify TEE Attestation

Choose the evidence for the service you use. Hosted Private AI uses ACI: the gateway report attests the Phala gateway, and a response receipt cites its upstream's session. A self-deployed CVM has its own application quote and verification policy. Upstream evidence coverage varies by provider.

## Operations

| User says | Operation |
| --- | --- |
| "verify hosted inference", "verify the response signature" | **Verify a Hosted Response** |
| "show the attestation", "inspect the quote" | **Inspect Gateway Attestation** |
| "receipt", "which upstream served this?" | **Receipts and Sessions** |
| "coding agent", "proxy verification" | **Private AI Proxy** |
| "verify my CVM", "GPU quote", "OS image", "compose hash" | **Self-Deployed CVMs** |

The [ACI verification docs](https://docs.phala.com/phala-cloud/confidential-ai/verify/overview) and [ACI specification](https://github.com/Dstack-TEE/private-ai-gateway/blob/main/spec/aci.md) describe the hosted protocol. For CVMs, use the [Cloud attestation guides](https://docs.phala.com/phala-cloud/attestation/get-attestation).

## Verify a Hosted Response

Ordinary OpenAI SDK clients and cURL do not verify attestation, pin the gateway's TLS key, or verify response receipts. Use `connectAci()` from the official TypeScript SDK for Node.js/Bun applications, or **Private AI Proxy** for agent tools.

Install `@phala/aci-verifier` and `openai` in your project using its package manager. The runtime is ESM-only and requires Node.js 20.18.1+ or Bun 1.4.0+.

```typescript
import OpenAI from "openai";
import { connectAci } from "@phala/aci-verifier/runtime";

const apiKey = process.env.PHALA_AI_API_KEY;
if (!apiKey) throw new Error("PHALA_AI_API_KEY is required");

const aci = await connectAci({
  baseURL: "https://inference.phala.com/v1",
  serving: {
    requireVerified: true,
    requireReceipt: true,
  },
});

try {
  const client = new OpenAI({
    baseURL: aci.baseURL,
    apiKey,
    fetch: aci.fetch,
  });

  const response = await client.chat.completions.create({
    model: "z-ai/glm-5.3",
    messages: [{ role: "user", content: "Explain attestation." }],
  });

  const audit = await aci.verifyReceipt();
  if (!audit.transcript.verdict.verified) {
    throw new Error(audit.transcript.verdict.line);
  }

  console.log(response.choices[0].message.content);
} finally {
  await aci.close();
}
```

`connectAci()` verifies a fresh gateway report and creates a hostname-validated transport pinned to the attested TLS SPKI. Send requests through `aci.fetch`. Consume the complete response before calling `verifyReceipt()`, including every SSE frame when streaming. The SDK does not automatically audit each receipt; call it before accepting the result. Close the connection in `finally` and propagate verification failures.

The SDK does not check whether the gateway runs a production or development dstack OS image. For OS assurance, run an independent [dstack verifier](https://github.com/Dstack-TEE/dstack/tree/next/dstack/verifier) on the same quote, event log, and VM configuration and require `is_valid: true`. For reviewed-release enforcement, configure `policy.acceptedComposeHashes` from an independently obtained, authenticated allowlist. Copying a hash from the endpoint does not establish a reviewed release. See the [SDK guide](https://docs.phala.com/phala-cloud/confidential-ai/verify/typescript-sdk) for release policy and browser limits; browser JavaScript alone cannot enforce the runtime's TLS pin.

## Private AI Proxy

[Private AI Proxy](https://docs.phala.com/phala-cloud/confidential-ai/agents/private-ai-proxy) verifies the gateway and pins the channel before sending agent traffic, then audits each receipt after delivery.

After installing it, create a Phala profile and enter the API key at its hidden prompt:

```bash
pap profiles add --id work --name Phala \
  --url https://inference.phala.com --provider phala
pap start --profile work
pap status --json
```

Connect the intended agent using the proxy's documented workflow. Agent tools, MCP servers, browser automation, and telemetry remain separate trust boundaries.

## Inspect Gateway Attestation

The gateway report is public. These commands only inspect the document; they do not verify the quote, nonce binding, or channel:

```bash
NONCE=$(openssl rand -hex 32)
curl --fail-with-body -sS "https://inference.phala.com/v1/aci/attestation?nonce=$NONCE" \
  -o report.json

jq '{api_version, workload_keyset_digest,
     tee_type: .attestation.tee_type,
     report_data: .attestation.report_data,
     keyset: .attestation.workload_keyset,
     provenance: .attestation.source_provenance}' report.json
```

The nonce must be exactly 64 lowercase hex characters (32 random bytes). A report fetched without a nonce does not establish freshness.

| Field | Meaning |
| --- | --- |
| `api_version` | `aci/1`. |
| `workload_keyset_digest` | `sha256:` plus SHA-256 of the complete keyset in RFC 8785 JCS form. |
| `attestation.workload_keyset` | `subject`, `not_after`, `receipt_signing_keys`, `e2ee_public_keys`, and `tls_public_keys`. |
| `attestation.report_data` | SHA-256 of the nonce/keyset statement, bound into the hardware quote. |
| `attestation.evidence` | Quote, event log, VM configuration, app compose, key custody, and downstream TLS binding. |
| `attestation.source_provenance` | Workload-declared source/build labels; they require measured corroboration. |
| `service_capabilities` | Supported E2EE extension versions and `serving: "aggregator"`. |

The current receipt key has `algo: "ed25519"` and `key_id: "dstack-kms-receipt-ed25519-v1"`. Resolve its public key from a verified report.

### Gateway verification checks

A complete verification policy must include these checks, with an independent dstack verifier for OS assurance:

1. Verify `attestation.evidence.quote` against Intel DCAP collateral, check TCB/OS policy and private-key custody.
2. Recompute `workload_keyset_digest` from the complete `attestation.workload_keyset` using JCS and SHA-256. `jq` key sorting is not a general JCS implementation.
3. Hash this exact statement with the recomputed digest and your nonce, without whitespace and in this field order:

   ```text
   {"keyset_digest":"sha256:<hex>","nonce":"<64 lowercase hex>","purpose":"aci.report_data.v1"}
   ```

   Require that hash to equal `attestation.report_data` and the quote's first 32 report-data bytes, with the remaining 32 bytes zero. The nonce is part of this statement, rather than a separate half of the quote's report data.
4. Check `attestation.workload_keyset.not_after` is a future Unix timestamp under your policy; reject implausibly distant expiry.
5. Replay the event log to the quote's RTMR3 and confirm the measured `compose-hash` equals `sha256(app_compose)`. Apply an independently authenticated release allowlist when required. `source_provenance` alone is not a trust root.
6. Before releasing sensitive data, pin hostname-validated TLS to the SPKI listed for `inference.phala.com` in the attested keyset.

See [Verify Attestation](https://docs.phala.com/phala-cloud/confidential-ai/verify/verify-attestation) for the complete procedure. A valid gateway quote alone does not verify a particular response or every upstream's GPU.

## Receipts and Sessions

The response's `x-receipt-id` identifies its receipt. Fetch it after consuming the full response, using the same API key that made the request. A missing key returns `401` for a credential-bound receipt; a different key returns `404`.

The following commands inspect an existing receipt and session. They do not produce a verification verdict:

```bash
# Set RECEIPT_ID to the x-receipt-id header from your inference response.
curl --fail-with-body -sS "https://inference.phala.com/v1/aci/receipts/$RECEIPT_ID" \
  -H "Authorization: Bearer $PHALA_AI_API_KEY" -o receipt.json

jq '{receipt_id, workload_keyset_digest, key_id, endpoint,
     upstream: [.event_log[] | select(.type == "upstream.verified")]}' receipt.json

# Stop if the receipt does not cite a successful upstream session.
SESSION_ID=$(jq -er '.event_log[] | select(.type == "upstream.verified" and .result == "verified" and .required == true) | .session_id | select(type == "string" and test("^[0-9a-f]{64}$"))' receipt.json) && \
  curl --fail-with-body -sS "https://inference.phala.com/v1/aci/sessions/$SESSION_ID" \
    -o session.json
```

For verification, the client must:

1. Require the receipt's `workload_keyset_digest` to match the verified report, resolve `key_id` in `receipt_signing_keys`, and verify the Ed25519 signature over the JCS receipt with `signature` removed.
2. Match the `request.received` and `response.returned` events' `body_hash` values to the exact request and response bytes. SSE response hashes cover the complete in-order stream including framing and the terminating sentinel. E2EE request hashes follow the transport extension's restored-plaintext rules.
3. Require `upstream.verified` with `result: "verified"`, `required: true`, and a `session_id` for a successful request on this TEE-only endpoint.
4. Fetch the full session and recompute `session_id` as the bare SHA-256 hex digest of its complete JCS document. Check decoded `evidence.data` against `evidence.digest`, verify the upstream evidence and channel binding, and apply your claim policy. Require the receipt's `served_at` to fall within the session's `established_at`/`expires_at` interval.

A receipt event is an assertion by the attested gateway. Independently checking the cited session's evidence provides the upstream audit; a claim marked `unknown` is not a pass. GPU attestation alone does not prove that GPU's binding to the serving CPU TEE.

### Inspect current sessions

```bash
curl --fail-with-body -sS --get https://inference.phala.com/v1/aci/sessions \
  --data-urlencode 'model=z-ai/glm-5.3' | \
  jq '.sessions[] | {session_id, upstream_name, channel_binding, claims}'

curl --fail-with-body -sS 'https://inference.phala.com/v1/aci/sessions?upstream_name=chutes'
```

The list returns `{ "api_version": "aci/1", "sessions": [...] }`. The filter and record field are `upstream_name`, a route label such as `chutes` or `phala-267`. List entries omit `evidence.data`, so they cannot be used for a full content-address check. Fetch `/v1/aci/sessions/{session_id}` to verify the full document.

To restrict a request to sessions you have accepted, send `provider: {"aci_verified": true, "aci_session_ids": ["<verified session id>"]}`. A `412 session_not_accepted` means none of the pinned sessions can serve; verify current sessions before changing the pins. A `503 upstream_verification_failed` means required upstream verification or channel binding failed. Both refuse forwarding; do not weaken verification to retry. See [Attested Routing](https://docs.phala.com/phala-cloud/confidential-ai/confidential-model/attested-routing).

## Self-Deployed CVMs

Use this path for a workload deployed with `phala deploy`, including a custom GPU server. Its evidence and report-data layout are application-specific; the hosted gateway's ACI layout does not automatically apply.

```bash
# Inspect the CVM's bootstrap attestation.
phala cvms attestation my-app
phala cvms attestation my-app --json > attestation.json
```

The JSON includes `app_certificates[0].quote`. Reading a CLI status or extracting a quote is inspection, not independent verification of a fresh application exchange. For fresh evidence, generate a challenge-bound quote through your application's dstack SDK, as documented in [Get Attestation](https://docs.phala.com/phala-cloud/attestation/get-attestation).

Follow the supported guides for each layer:

| Layer | Verification |
| --- | --- |
| Intel TDX and OS image | Verify the quote and TCB against Intel roots, then compare OS measurements using [Verify the Platform](https://docs.phala.com/phala-cloud/attestation/verify-the-platform) and [dstack-verifier](https://github.com/Dstack-TEE/dstack/tree/next/dstack/verifier). Require `is_valid: true`. |
| Application/compose | Replay RTMR3 and compare the measured compose hash against the application you expect; apply governance policy where configured. See [Verify Your Application](https://docs.phala.com/phala-cloud/attestation/verify-your-application). |
| Key custody and network | Verify the KMS evidence and bind the actual client channel to the attested application. See [Chain of Trust](https://docs.phala.com/phala-cloud/attestation/chain-of-trust). |
| NVIDIA GPU, when used | Verify the NVIDIA evidence and freshness under the workload's supported verifier, including its CPU/channel binding. Use the [Phala GPU verifier source](https://github.com/Phala-Network/private-ml-sdk/tree/main/vllm-proxy/verifiers) for the matching deployment; decoding an NRAS JWT alone does not verify its signature. |
| Container source | Check image digests and their signed build provenance against your release policy; the existence of a provenance URL alone is not verification. |

`dcap-qvl` checks the Intel quote layer. It does not replace GPU verification, compose appraisal, KMS policy, or channel binding. Offline verification needs the appropriate trusted collateral, reference measurements, evidence, and verifier policy for the workload; a fetched JSON file alone is insufficient.
