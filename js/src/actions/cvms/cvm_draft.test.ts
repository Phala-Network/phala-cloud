import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "../../index";
import { commitCvmComposeFileUpdate } from "./commit_cvm_compose_file_update";
import { commitCvmUpdate } from "./commit_cvm_update";
import { confirmCvmPatch } from "./confirm_cvm_patch";
import {
  applyCvmDraft,
  discardCvmDraft,
  getCvmDraft,
  listCvmDrafts,
  safeApplyCvmDraft,
  safeGetCvmDraft,
  safeStageCvmDraft,
  stageCvmDraft,
  undoCvmDraftEntry,
} from "./cvm_draft";
import { getCvmInfo } from "./get_cvm_info";
import { patchCvm } from "./patch_cvm";
import { updateCvmEnvs } from "./update_cvm_envs";
import { updateDockerCompose } from "./update_docker_compose";
import { updatePreLaunchScript } from "./update_prelaunch_script";
import { upgradePreLaunchScript } from "./upgrade_prelaunch_script";

const endpoint = "https://example.test/api/v1";
const cvmId = "cvm-v2gxZbWd";
const draftPath = `/cvms/${cvmId}/draft`;
const baseHash = "11".repeat(32);
const previewHash = "22".repeat(32);
const patch = { public_logs: false, compose: { requirements: { health_check: null } } };
const entry = {
  id: "2e34f0a8d1f14a3b88b30333d4fb9be7",
  user_id: "user-a1b2c3",
  username: "alice",
  staged_at: "2026-11-23T01:14:09Z",
  patch,
  diff: "-  health_check: true\n",
};
const draft = {
  base_compose_hash: baseHash,
  current_compose_hash: baseHash,
  preview_compose_hash: previewHash,
  patch,
  entries: [entry],
};

const finalityWait = {
  operation: "update",
  correlation_id: "update-correlation-id",
  phase: "awaiting_finality",
  stage: "submitted",
  transaction: null,
  finality: {
    block_tag: "finalized",
    policy_block_number: 39133700,
    blocks_remaining: null,
    eta_seconds: null,
  },
} as const;

const futureFinalityWait = { ...finalityWait, stage: "verified" };
const draftChanged = { error_code: "ERR-03-054", message: "Draft entries changed." };

function setupHttp(...responses: Response[]) {
  const requests: Array<{ url: string; method: string; headers: Headers; body: unknown }> = [];
  vi.stubGlobal("fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
    const response = responses.shift();
    if (!response) throw new Error(`Unexpected request: ${url}`);
    const headers = new Headers(init?.headers);
    requests.push({
      url: String(url),
      method: init?.method ?? "GET",
      headers,
      body: typeof init?.body === "string" && headers.get("Content-Type")?.includes("application/json")
        ? JSON.parse(init.body)
        : init?.body,
    });
    return response;
  });
  return {
    client: createClient({ baseURL: endpoint, apiKey: "test-key" }),
    requests,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("CVM drafts", () => {
  it("stages a CVM patch and returns the entry ID and diff", async () => {
    const { client, requests } = setupHttp(Response.json(draft));
    expect(await stageCvmDraft(client, { id: cvmId, ...patch })).toEqual(draft);
    expect(requests[0]).toMatchObject({ url: `${endpoint}${draftPath}`, method: "PATCH", body: patch });
  });

  it("rejects prepareOnly when staging; only draft apply prepares a commit", async () => {
    const { client, requests } = setupHttp();
    const request = { id: cvmId, ...patch, prepareOnly: true };
    // @ts-expect-error Staging does not accept apply options.
    const result = await safeStageCvmDraft(client, request);
    expect(result).toMatchObject({ success: false, error: { issues: [{ path: ["prepareOnly"] }] } });
    expect(requests).toHaveLength(0);
  });

  it("reads the draft and preserves a draft-not-found error", async () => {
    const { client, requests } = setupHttp(
      Response.json(draft),
      Response.json({ error_code: "ERR-03-052", message: "No draft exists." }, { status: 404 }),
    );
    expect(await getCvmDraft(client, { id: cvmId })).toEqual(draft);
    await expect(safeGetCvmDraft(client, { id: cvmId })).resolves.toMatchObject({
      success: false,
      error: { status: 404, detail: { error_code: "ERR-03-052" } },
    });
    expect(requests).toMatchObject([
      { url: `${endpoint}${draftPath}`, method: "GET" },
      { url: `${endpoint}${draftPath}`, method: "GET" },
    ]);
  });

  it("lists staged and active drafts, including older rows without finality data", async () => {
    const staged = {
      cvm_id: cvmId,
      vm_uuid: "b07ff7f6b59247efade23ea47bef6c69",
      name: "my-cvm",
      app_id: null,
      state: "staged",
      corrupt: false,
      entry_count: 1,
      base_compose_hash: baseHash,
      preview_compose_hash: previewHash,
    };
    const active = {
      ...staged,
      cvm_id: "cvm-oaYWryXa",
      vm_uuid: "b28ff7f6b59247efade23ea47bef6c69",
      state: "applying",
      finality_wait: { ...finalityWait, phase: "applying" },
    };
    const unreadable = {
      ...staged,
      cvm_id: "cvm-wjAPwlzx",
      vm_uuid: "b35ff7f6b59247efade23ea47bef6c69",
      corrupt: true,
      entry_count: null,
      base_compose_hash: null,
      preview_compose_hash: null,
      finality_wait: null,
    };
    const { client, requests } = setupHttp(Response.json({ items: [staged, active, unreadable] }));
    expect(await listCvmDrafts(client)).toEqual({ items: [staged, active, unreadable] });
    expect(requests[0]).toMatchObject({ url: `${endpoint}/cvms/drafts`, method: "GET" });
  });

  it("returns the remaining draft after undo and no value for 204", async () => {
    const { client, requests } = setupHttp(
      Response.json(draft),
      new Response(null, { status: 204 }),
      new Response(null, { status: 204 }),
    );
    const latestEntryId = "396e9acd491a45ff92461b577d4b4202";
    expect(await undoCvmDraftEntry(client, { id: cvmId, entryId: latestEntryId })).toEqual(draft);
    expect(await undoCvmDraftEntry(client, { id: cvmId, entryId: entry.id })).toBeUndefined();
    expect(await discardCvmDraft(client, { id: cvmId })).toBeUndefined();
    expect(requests).toMatchObject([
      { url: `${endpoint}${draftPath}/entries/${latestEntryId}`, method: "DELETE" },
      { url: `${endpoint}${draftPath}/entries/${entry.id}`, method: "DELETE" },
      { url: `${endpoint}${draftPath}`, method: "DELETE", body: undefined },
    ]);
  });

  it("sends reviewed entry IDs when discarding and preserves conflicts on a versioned client", async () => {
    const { client, requests } = setupHttp(
      new Response(null, { status: 204 }),
      Response.json(draftChanged, { status: 409 }),
    );
    const versioned = client.withVersion("2026-06-23");

    await expect(
      versioned.safeDiscardCvmDraft({ id: cvmId, expectedEntryIds: ["entry-b", "entry-a"] }),
    ).resolves.toEqual({ success: true, data: undefined });
    await expect(
      versioned.discardCvmDraft({ id: cvmId, expectedEntryIds: [] }),
    ).rejects.toMatchObject({ status: 409, detail: draftChanged });
    expect(requests).toMatchObject([
      { url: `${endpoint}${draftPath}`, method: "DELETE" },
      { url: `${endpoint}${draftPath}`, method: "DELETE" },
    ]);
    expect(requests.map(({ body }) => body)).toEqual([
      { expected_entry_ids: ["entry-b", "entry-a"] },
      { expected_entry_ids: [] },
    ]);
    expect(requests.map(({ headers }) => headers.get("X-Phala-Version"))).toEqual([
      "2026-06-23",
      "2026-06-23",
    ]);
  });

  it("preserves registration fields and sends reviewed entry IDs in both apply phases", async () => {
    const expectedEntryIds = ["f0e34f0a8d1f14a3b88b30333d4fb9be", "096e9acd491a45ff92461b577d4b4202"];
    const appId = "35".repeat(20);
    const deviceId = "dd".repeat(32);
    const kmsInfo = {
      id: "kms-v88aZ1",
      slug: "base",
      url: "https://kms.example.test",
      version: "0.6.5",
      chain_id: 8453,
      kms_contract_address: `0x${"aa".repeat(20)}`,
      gateway_app_id: "bb".repeat(20),
    };
    const onchainStatus = { compose_hash_allowed: false, device_id_allowed: true, is_allowed: false };
    const { client, requests } = setupHttp(
      Response.json(
        {
          error_code: "ERR-01-005",
          message: "Compose hash registration required",
          details: [
            { field: "compose_hash", value: previewHash },
            { field: "app_id", value: appId },
            { field: "device_id", value: deviceId },
            { field: "kms_info", value: kmsInfo },
            { field: "commit_token", value: "commit-token" },
            { field: "commit_url", value: "https://example.test/commit" },
            { field: "api_commit_url", value: "https://example.test/api/v1/commit" },
            { field: "onchain_status", value: onchainStatus },
          ],
        },
        { status: 465 },
      ),
      Response.json(
        { status: "awaiting_finality", correlation_id: finalityWait.correlation_id, finality_wait: futureFinalityWait },
        { status: 202 },
      ),
    );
    const prepared = await applyCvmDraft(client, {
      id: cvmId,
      baseComposeHash: baseHash,
      expectedEntryIds,
      prepareOnly: true,
    });
    expect(prepared).toMatchObject({
      requiresOnChainHash: true,
      composeHash: previewHash,
      appId,
      deviceId,
      kmsInfo,
      commitToken: "commit-token",
      commitUrl: "https://example.test/commit",
      apiCommitUrl: "https://example.test/api/v1/commit",
      onchainStatus,
    });
    expect(requests[0]).toMatchObject({ url: `${endpoint}${draftPath}/apply`, method: "POST" });
    expect(requests[0]?.body).toEqual({
      base_compose_hash: baseHash,
      expected_entry_ids: ["f0e34f0a8d1f14a3b88b30333d4fb9be", "096e9acd491a45ff92461b577d4b4202"],
    });
    expect(requests[0]?.headers.get("X-Prepare-Only")).toBe("true");
    expect(requests[0]?.headers.has("X-Compose-Hash")).toBe(false);

    expect(await applyCvmDraft(client, {
      id: cvmId,
      baseComposeHash: baseHash,
      expectedEntryIds,
      composeHash: previewHash,
      transactionHash: "already-registered",
    })).toEqual({
      requiresOnChainHash: false,
      status: "awaiting_finality",
      correlationId: finalityWait.correlation_id,
      finalityWait: futureFinalityWait,
    });
    expect(requests[1]).toMatchObject({ url: `${endpoint}${draftPath}/apply`, method: "POST" });
    expect(requests[1]?.body).toEqual({
      base_compose_hash: baseHash,
      expected_entry_ids: ["f0e34f0a8d1f14a3b88b30333d4fb9be", "096e9acd491a45ff92461b577d4b4202"],
    });
    expect(requests[1]?.headers.get("X-Compose-Hash")).toBe(previewHash);
    expect(requests[1]?.headers.get("X-Transaction-Hash")).toBe("already-registered");
    expect(requests[1]?.headers.has("X-Prepare-Only")).toBe(false);
  });

  it("sends an empty reviewed list on apply and preserves conflicts as safe errors", async () => {
    const { client, requests } = setupHttp(Response.json(draftChanged, { status: 409 }));
    const versioned = client.withVersion("2026-06-23");

    await expect(
      versioned.safeApplyCvmDraft({ id: cvmId, expectedEntryIds: [] }),
    ).resolves.toMatchObject({ success: false, error: { status: 409, detail: draftChanged } });
    expect(requests).toMatchObject([{ url: `${endpoint}${draftPath}/apply`, method: "POST" }]);
    expect(requests[0]?.body).toEqual({ expected_entry_ids: [] });
    expect(requests[0]?.headers.get("X-Phala-Version")).toBe("2026-06-23");
  });

  it("preserves legacy no-op responses and rejects an incomplete commit before sending it", async () => {
    const noChange = { status: "no_change" };
    const { client, requests } = setupHttp(
      Response.json(noChange, { status: 202 }),
      Response.json(noChange, { status: 202 }),
    );
    expect(await applyCvmDraft(client, { id: cvmId })).toEqual({
      requiresOnChainHash: false,
      status: "no_change",
      correlationId: "",
    });
    await applyCvmDraft(client, { id: cvmId, baseComposeHash: baseHash });
    const malformed = { id: cvmId, composeHash: previewHash };
    // @ts-expect-error An incomplete commit is invalid at both the type and HTTP boundaries.
    await expect(safeApplyCvmDraft(client, malformed)).resolves.toMatchObject({ success: false });
    expect(requests.map(({ body }) => body)).toEqual([undefined, { base_compose_hash: baseHash }]);
  });

  it("preserves finality on direct and token-based commits", async () => {
    const wire = {
      status: "awaiting_finality",
      correlation_id: finalityWait.correlation_id,
      finality_wait: finalityWait,
    };
    const { client } = setupHttp(
      Response.json(wire, { status: 202 }),
      Response.json(wire, { status: 202 }),
    );
    const accepted = { correlationId: finalityWait.correlation_id, finalityWait, status: wire.status };
    const request = { id: cvmId, composeHash: previewHash, transactionHash: "already-registered" };
    await expect(confirmCvmPatch(client, request)).resolves.toEqual(accepted);
    await expect(commitCvmUpdate(client, { ...request, token: "token" })).resolves.toEqual(accepted);
  });
});

it.each(["running", "awaiting_finality", "create_failed"])(
  "preserves the read-side CVM status %s independently of finality metadata",
  async (status) => {
    const { client } = setupHttp(Response.json({
      id: cvmId,
      name: "my-cvm",
      status,
      resource: { memory_in_mb: 4096 },
      gateway: {},
      finality_wait: futureFinalityWait,
    }));
    const result = await getCvmInfo(client.withVersion("2026-11-11"), { id: cvmId });
    expect(result.status).toBe(status);
    expect(result.finality_wait).toEqual(futureFinalityWait);
  },
);

it("keeps a patch correlation ID with future, missing, or malformed finality data", async () => {
  const wire = { status: "awaiting_finality", correlation_id: finalityWait.correlation_id };
  const { client } = setupHttp(
    Response.json({ ...wire, finality_wait: futureFinalityWait }, { status: 202 }),
    Response.json(wire, { status: 202 }),
    Response.json({ ...wire, finality_wait: { stage: 3 } }, { status: 202 }),
  );
  const request = { id: cvmId, ...patch };
  const accepted = { requiresOnChainHash: false, correlationId: finalityWait.correlation_id, status: wire.status };
  expect(await patchCvm(client, request)).toEqual({ ...accepted, finalityWait: futureFinalityWait });
  expect(await patchCvm(client, request)).toEqual(accepted);
  expect(await patchCvm(client, request)).toEqual(accepted);
});

it("returns accepted updates when the response has no operation ID to track", async () => {
  const wire = { status: "in_progress", message: "Update accepted.", finality_wait: finalityWait };
  const { client } = setupHttp(
    Response.json(wire, { status: 202 }),
    Response.json({ ...wire, correlation_id: null }, { status: 202 }),
    Response.json(wire, { status: 202 }),
  );
  const request = { id: cvmId, composeHash: previewHash, transactionHash: "already-registered" };
  const accepted = { correlationId: "", finalityWait, status: wire.status };
  await expect(confirmCvmPatch(client, request)).resolves.toEqual(accepted);
  await expect(commitCvmUpdate(client, { ...request, token: "token" })).resolves.toEqual(accepted);
  await expect(patchCvm(client, { id: cvmId, ...patch })).resolves.toEqual({
    ...accepted, requiresOnChainHash: false,
  });
});

it("keeps the default compose commit result when a 2xx response lacks a usable correlation ID", async () => {
  const response = { status: "awaiting_finality", finality_wait: futureFinalityWait };
  const { client } = setupHttp(
    Response.json(response, { status: 202 }),
    Response.json({ ...response, correlation_id: "" }, { status: 202 }),
    Response.json({ ...response, correlation_id: "  " }, { status: 202 }),
  );
  const request = { id: cvmId, compose_hash: previewHash, encrypted_env: undefined, env_keys: undefined };
  for (let attempt = 0; attempt < 3; attempt++) {
    await expect(commitCvmComposeFileUpdate(client, request)).resolves.toBeUndefined();
  }
});

it("opts into replacement confirmation for an official script upgrade without reusing a stale ID", async () => {
  const replacementRequired = (correlationId: string) => ({
    error_code: "ERR-03-067",
    message: "Confirm that you want to replace the pending CVM update.",
    details: [
      { field: "correlation_id", value: correlationId },
      { field: "stage", value: "safe" },
    ],
  });
  const original = replacementRequired("Pending-Operation-A");
  const changed = replacementRequired("Pending-Operation-B");
  const accepted = {
    status: "in_progress",
    message: "Update accepted.",
    correlation_id: finalityWait.correlation_id,
    finality_wait: finalityWait,
  };
  const { client, requests } = setupHttp(
    Response.json(original, { status: 412 }),
    Response.json(changed, { status: 412 }),
    Response.json(accepted, { status: 202 }),
  );
  const request = { id: cvmId, compose_hash: previewHash, transaction_hash: "already-registered" };
  await expect(client.safeUpgradePreLaunchScript({ ...request, confirmFinalityReplacement: "none" }))
    .resolves.toMatchObject({ success: false, error: { status: 412, errorCode: "ERR-03-067", detail: original } });
  await expect(client.upgradePreLaunchScript({ ...request, confirmFinalityReplacement: "Pending-Operation-A" }))
    .rejects.toMatchObject({ status: 412, errorCode: "ERR-03-067", detail: changed });
  await expect(client.upgradePreLaunchScript({ ...request, confirmFinalityReplacement: "Pending-Operation-B" }))
    .resolves.toEqual(accepted);
  expect(requests.map(({ headers, body }) => ({
    confirmation: headers.get("X-Confirm-Finality-Replacement"),
    composeHash: headers.get("X-Compose-Hash"),
    transactionHash: headers.get("X-Transaction-Hash"),
    body,
  }))).toEqual(["none", "Pending-Operation-A", "Pending-Operation-B"].map((confirmation) => ({
    confirmation,
    composeHash: previewHash,
    transactionHash: "already-registered",
    body: undefined,
  })));
});

// PATCH /envs HTTP 202 bodies captured from the integrated ASGI run.
const capturedEnvWait = {
  message: "CVM update accepted. It will apply after the KMS honors the on-chain change.",
  correlation_id: "8884fa5816c2ed4c69d57b60ca964893",
  status: "in_progress",
  finality_wait: {
    operation: "update",
    correlation_id: "8884fa5816c2ed4c69d57b60ca964893",
    phase: "awaiting_finality",
    stage: "submitted",
    stages: ["submitted", "finalized", "applying"],
    transaction: {
      hash: "0x1111111111111111111111111111111111111111111111111111111111111111",
      block_number: 100,
      chain_id: 1,
    },
    finality: {
      block_tag: "finalized",
      policy_block_number: 99,
      blocks_remaining: 1,
      eta_seconds: null,
    },
  },
  allowed_envs_changed: true,
};
const capturedEnvNoChange = {
  message: "Environment unchanged",
  correlation_id: "",
  status: "no_change",
  allowed_envs_changed: false,
};

it.each([capturedEnvWait, capturedEnvNoChange])(
  "preserves the captured HTTP 202 envs response with status $status",
  async (wire) => {
    const { client } = setupHttp(Response.json(wire, { status: 202 }));
    await expect(updateCvmEnvs(client, { id: cvmId, encrypted_env: "abcd" })).resolves.toEqual(wire);
  },
);

it.each(["in_progress", "future_status", "awaiting_finality"])(
  "preserves the HTTP 202 envelope and finality metadata for update status %s",
  async (status) => {
    const wire = {
      status,
      message: "Update accepted.",
      correlation_id: finalityWait.correlation_id,
      finality_wait: futureFinalityWait,
    };
    const envResult = { ...wire, allowed_envs_changed: true };
    const { client, requests } = setupHttp(
      ...Array.from({ length: 4 }, () => Response.json(wire, { status: 202 })),
      Response.json(envResult, { status: 202 }),
    );
    const request = { id: cvmId, compose_hash: previewHash, transaction_hash: "a1".repeat(32) };
    expect(await commitCvmComposeFileUpdate(client, { ...request, encrypted_env: undefined, env_keys: undefined })).toEqual(wire);
    expect(await updateDockerCompose(client, { ...request, docker_compose_file: "services: {}" })).toEqual(wire);
    expect(await updatePreLaunchScript(client, { ...request, pre_launch_script: "true" })).toEqual(wire);
    expect(await upgradePreLaunchScript(client, request)).toEqual(wire);
    const envUpdate = await updateCvmEnvs(client, { ...request, encrypted_env: "abcd" });
    expect(envUpdate).toEqual({ ...envResult, status: "in_progress" });
    // Existing clients narrow by status to read the acceptance correlation ID.
    if (envUpdate.status !== "in_progress") throw new Error("Expected an accepted environment update");
    expect(envUpdate.correlation_id).toBe(finalityWait.correlation_id);
    expect(requests).toMatchObject([
      { url: `${endpoint}/cvms/${cvmId}/compose_file`, method: "PATCH", body: { transaction_hash: request.transaction_hash } },
      { url: `${endpoint}/cvms/${cvmId}/docker-compose`, method: "PATCH" },
      { url: `${endpoint}/cvms/${cvmId}/pre-launch-script`, method: "PATCH" },
      { url: `${endpoint}/cvms/${cvmId}/pre-launch-script/upgrade-to-latest-official`, method: "POST" },
      { url: `${endpoint}/cvms/${cvmId}/envs`, method: "PATCH", body: { encrypted_env: "abcd", compose_hash: request.compose_hash, transaction_hash: request.transaction_hash } },
    ]);
  },
);
