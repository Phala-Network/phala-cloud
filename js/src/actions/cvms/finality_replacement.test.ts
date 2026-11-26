import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "../../index";
import { readFinalityReplacementRequired } from "../../types/cvm_finality";
import { commitCvmComposeFileUpdate } from "./commit_cvm_compose_file_update";
import { commitCvmUpdate } from "./commit_cvm_update";
import { confirmCvmPatch } from "./confirm_cvm_patch";
import { applyCvmDraft } from "./cvm_draft";
import { patchCvm, safePatchCvm } from "./patch_cvm";
import { updateCvmEnvs } from "./update_cvm_envs";
import { updateDockerCompose } from "./update_docker_compose";
import { updatePreLaunchScript } from "./update_prelaunch_script";
import { upgradePreLaunchScript } from "./upgrade_prelaunch_script";

const endpoint = "https://example.test/api/v1";
const cvmId = "cvm-v2gxZbWd";
const HEADER = "X-Confirm-Finality-Replacement";

const replacementRequired = (correlationId: string, stage = "safe") => ({
  error_code: "ERR-03-067",
  message: "Confirm that you want to replace the pending CVM update.",
  details: [
    { field: "correlation_id", value: correlationId },
    { field: "stage", value: stage },
  ],
});
const accepted = {
  status: "in_progress",
  message: "Update accepted.",
  correlation_id: "new-update",
  allowed_envs_changed: false,
};

function setupHttp(...responses: Response[]) {
  const requests: Array<{ url: string; method: string; headers: Headers }> = [];
  vi.stubGlobal("fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
    const response = responses.shift();
    if (!response) throw new Error(`Unexpected request: ${url}`);
    requests.push({
      url: String(url),
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
    });
    return response;
  });
  return { client: createClient({ baseURL: endpoint, apiKey: "test-key" }), requests };
}

afterEach(() => vi.unstubAllGlobals());

describe("readFinalityReplacementRequired", () => {
  it("reads the waiting update from an ERR-03-067 error and ignores other errors", async () => {
    const { client } = setupHttp(
      Response.json(replacementRequired("waiting-1", "finalized"), { status: 412 }),
      Response.json({ error_code: "ERR-03-001", message: "Other" }, { status: 412 }),
    );
    const first = await safePatchCvm(client, { id: cvmId, public_logs: true });
    expect(first.success ? undefined : readFinalityReplacementRequired(first.error)).toEqual({
      correlationId: "waiting-1",
      stage: "finalized",
    });
    const second = await safePatchCvm(client, { id: cvmId, public_logs: true });
    expect(second.success ? undefined : readFinalityReplacementRequired(second.error)).toBe(
      undefined,
    );
    expect(readFinalityReplacementRequired(new Error("boom"))).toBe(undefined);
  });
});

describe("PATCH /cvms/{id}", () => {
  it("omits the header by default, sends none, then retries with the waiting ID", async () => {
    const { client, requests } = setupHttp(
      Response.json(accepted, { status: 202 }),
      Response.json(replacementRequired("waiting-1"), { status: 412 }),
      Response.json(accepted, { status: 202 }),
    );
    await patchCvm(client, { id: cvmId, public_logs: true });
    const rejected = patchCvm(client, {
      id: cvmId,
      public_logs: true,
      confirmFinalityReplacement: "none",
    });
    await expect(rejected).rejects.toMatchObject({ status: 412, errorCode: "ERR-03-067" });
    const error = await rejected.catch((e: unknown) => e);
    const waiting = readFinalityReplacementRequired(error);
    expect(waiting).toEqual({ correlationId: "waiting-1", stage: "safe" });
    await patchCvm(client, {
      id: cvmId,
      public_logs: true,
      confirmFinalityReplacement: waiting?.correlationId,
    });
    expect(requests.map((r) => r.headers.get(HEADER))).toEqual([null, "none", "waiting-1"]);
  });

  it("does not put the option into the request body", async () => {
    let body: unknown;
    vi.stubGlobal("fetch", async (_url: RequestInfo | URL, init?: RequestInit) => {
      body = JSON.parse(String(init?.body));
      return Response.json(accepted, { status: 202 });
    });
    const client = createClient({ baseURL: endpoint, apiKey: "test-key" });
    await patchCvm(client, { id: cvmId, public_logs: true, confirmFinalityReplacement: "none" });
    expect(body).toEqual({ public_logs: true });
  });
});

describe("other update actions", () => {
  const hash = "22".repeat(32);
  const calls: Array<[string, string, (c: ReturnType<typeof createClient>, v?: string) => Promise<unknown>]> = [
    ["updateCvmEnvs", `/cvms/${cvmId}/envs`, (c, v) =>
      updateCvmEnvs(c, { id: cvmId, encrypted_env: "ab", confirmFinalityReplacement: v })],
    ["updateDockerCompose", `/cvms/${cvmId}/docker-compose`, (c, v) =>
      updateDockerCompose(c, { id: cvmId, docker_compose_file: "services: {}", confirmFinalityReplacement: v })],
    ["updatePreLaunchScript", `/cvms/${cvmId}/pre-launch-script`, (c, v) =>
      updatePreLaunchScript(c, { id: cvmId, pre_launch_script: "echo", confirmFinalityReplacement: v })],
    ["commitCvmComposeFileUpdate", `/cvms/${cvmId}/compose_file`, (c, v) =>
      commitCvmComposeFileUpdate(c, { id: cvmId, compose_hash: hash, confirmFinalityReplacement: v })],
    ["applyCvmDraft", `/cvms/${cvmId}/draft/apply`, (c, v) =>
      applyCvmDraft(c, { id: cvmId, confirmFinalityReplacement: v })],
    ["commitCvmUpdate", `/cvms/${cvmId}/commit-update`, (c, v) =>
      commitCvmUpdate(c, { id: cvmId, token: "t", composeHash: hash, transactionHash: "0x1", confirmFinalityReplacement: v })],
    ["confirmCvmPatch", `/cvms/${cvmId}`, (c, v) =>
      confirmCvmPatch(c, { id: cvmId, composeHash: hash, transactionHash: "0x1", confirmFinalityReplacement: v })],
    ["upgradePreLaunchScript", `/cvms/${cvmId}/pre-launch-script/upgrade-to-latest-official`, (c, v) =>
      upgradePreLaunchScript(c, { id: cvmId, confirmFinalityReplacement: v })],
  ];

  it.each(calls)("%s omits the header, sends none, parses the 412 and retries with the ID", async (_name, path, call) => {
    const { client, requests } = setupHttp(
      Response.json(accepted, { status: 202 }),
      Response.json(replacementRequired("waiting-2", "submitted"), { status: 412 }),
      Response.json(accepted, { status: 202 }),
    );
    await call(client);
    const error = await call(client, "none").catch((e: unknown) => e);
    const waiting = readFinalityReplacementRequired(error);
    expect(waiting).toEqual({ correlationId: "waiting-2", stage: "submitted" });
    await call(client, waiting?.correlationId);
    expect(requests.map((r) => new URL(r.url).pathname.replace("/api/v1", ""))).toEqual([path, path, path]);
    expect(requests.map((r) => r.headers.get(HEADER))).toEqual([null, "none", "waiting-2"]);
  });
});
