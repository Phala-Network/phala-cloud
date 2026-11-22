import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "../../client";
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
      { url: `${endpoint}${draftPath}`, method: "DELETE" },
    ]);
  });

  it("preserves every 465 registration field and submits both phase 2 headers to draft apply", async () => {
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
    const prepared = await applyCvmDraft(client, { id: cvmId, baseComposeHash: baseHash, prepareOnly: true });
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
    expect(requests[0]).toMatchObject({
      url: `${endpoint}${draftPath}/apply`,
      method: "POST",
      body: { base_compose_hash: baseHash },
    });
    expect(requests[0]?.headers.get("X-Prepare-Only")).toBe("true");
    expect(requests[0]?.headers.has("X-Compose-Hash")).toBe(false);

    expect(await applyCvmDraft(client, {
      id: cvmId,
      baseComposeHash: baseHash,
      composeHash: previewHash,
      transactionHash: "already-registered",
    })).toEqual({
      requiresOnChainHash: false,
      status: "awaiting_finality",
      correlationId: finalityWait.correlation_id,
      finalityWait: futureFinalityWait,
    });
    expect(requests[1]).toMatchObject({
      url: `${endpoint}${draftPath}/apply`,
      method: "POST",
      body: { base_compose_hash: baseHash },
    });
    expect(requests[1]?.headers.get("X-Compose-Hash")).toBe(previewHash);
    expect(requests[1]?.headers.get("X-Transaction-Hash")).toBe("already-registered");
    expect(requests[1]?.headers.has("X-Prepare-Only")).toBe(false);
  });

  it("preserves legacy no-op responses and rejects an incomplete commit before sending it", async () => {
    const { client, requests } = setupHttp(Response.json({ status: "no_change" }, { status: 202 }));
    expect(await applyCvmDraft(client, { id: cvmId })).toEqual({
      requiresOnChainHash: false,
      status: "no_change",
      correlationId: "",
    });
    const malformed = { id: cvmId, composeHash: previewHash };
    // @ts-expect-error An incomplete commit is invalid at both the type and HTTP boundaries.
    await expect(safeApplyCvmDraft(client, malformed)).resolves.toMatchObject({ success: false });
    expect(requests).toHaveLength(1);
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
    const accepted = { correlationId: finalityWait.correlation_id, finalityWait };
    const request = { id: cvmId, composeHash: previewHash, transactionHash: "already-registered" };
    await expect(confirmCvmPatch(client, request)).resolves.toEqual(accepted);
    await expect(commitCvmUpdate(client, { ...request, token: "token" })).resolves.toEqual({
      ...accepted,
      status: "awaiting_finality",
    });
  });
});

it("retains future finality stages in CVM details independently of the runtime status", async () => {
  const { client } = setupHttp(Response.json({
    id: cvmId,
    name: "my-cvm",
    status: "running",
    resource: { memory_in_mb: 4096 },
    gateway: {},
    finality_wait: futureFinalityWait,
  }));
  const result = await getCvmInfo(client.withVersion("2026-11-11"), { id: cvmId });
  expect(result.status).toBe("running");
  expect(result.finality_wait).toEqual(futureFinalityWait);
});

it("keeps a patch correlation ID with future, missing, or malformed finality data", async () => {
  const wire = { status: "awaiting_finality", correlation_id: finalityWait.correlation_id };
  const { client } = setupHttp(
    Response.json({ ...wire, finality_wait: futureFinalityWait }, { status: 202 }),
    Response.json(wire, { status: 202 }),
    Response.json({ ...wire, finality_wait: { stage: 3 } }, { status: 202 }),
  );
  const request = { id: cvmId, ...patch };
  const accepted = { requiresOnChainHash: false, correlationId: finalityWait.correlation_id };
  expect(await patchCvm(client, request)).toEqual({ ...accepted, finalityWait: futureFinalityWait });
  expect(await patchCvm(client, request)).toEqual(accepted);
  expect(await patchCvm(client, request)).toEqual(accepted);
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

it("preserves future finality stages and routes for existing compose and script updates", async () => {
  const wire = {
    status: "awaiting_finality",
    correlation_id: finalityWait.correlation_id,
    finality_wait: futureFinalityWait,
  };
  const withMessage = { ...wire, message: "Update accepted." };
  const { client, requests } = setupHttp(
    Response.json(wire, { status: 202 }),
    ...Array.from({ length: 3 }, () => Response.json(withMessage, { status: 202 })),
  );
  const request = { id: cvmId, compose_hash: previewHash, transaction_hash: "a1".repeat(32) };
  expect(await commitCvmComposeFileUpdate(client, { ...request, encrypted_env: undefined, env_keys: undefined })).toEqual(wire);
  expect(await updateDockerCompose(client, { ...request, docker_compose_file: "services: {}" })).toEqual(withMessage);
  expect(await updatePreLaunchScript(client, { ...request, pre_launch_script: "true" })).toEqual(withMessage);
  expect(await upgradePreLaunchScript(client, request)).toEqual(withMessage);
  expect(requests).toMatchObject([
    { url: `${endpoint}/cvms/${cvmId}/compose_file`, method: "PATCH", body: { transaction_hash: request.transaction_hash } },
    { url: `${endpoint}/cvms/${cvmId}/docker-compose`, method: "PATCH" },
    { url: `${endpoint}/cvms/${cvmId}/pre-launch-script`, method: "PATCH" },
    { url: `${endpoint}/cvms/${cvmId}/pre-launch-script/upgrade-to-latest-official`, method: "POST" },
  ]);
});
