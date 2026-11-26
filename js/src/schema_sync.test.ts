import { describe, expect, it, vi } from "vitest";
import type { Client } from "./client";
import { CreateAppInstanceRequestSchema, createAppInstance } from "./actions/apps/create_app_instance";
import { GetCvmListRequestSchema } from "./actions/cvms/get_cvm_list";
import { PatchCvmRequestSchema, patchCvm } from "./actions/cvms/patch_cvm";
import { ReplicateCvmRequestSchema, replicateCvm } from "./actions/cvms/replicate_cvm";
import { ProvisionCvmRequestSchema } from "./actions/cvms/provision_cvm";
import { WorkspaceResponseSchema } from "./actions/workspaces/list_workspaces";
import { CurrentUserV20260121Schema } from "./credentials/current_user_v20260121";
import { AppRevisionResponseSchema } from "./types/app_revision";
import { VMSchema } from "./types/cvm_info";
import { CvmInfoDetailV20261111Schema } from "./types/cvm_info_v20260121";

const replica = {
  id: "cvm-1",
  name: "n",
  status: "starting",
  teepod_id: 1,
  app_id: "a",
  vm_uuid: null,
  instance_id: null,
  vcpu: 1,
  memory: 1,
  disk_size: 1,
  created_at: "2026-01-01T00:00:00Z",
  encrypted_env_pubkey: null,
  finality_wait: {
    operation: "create",
    correlation_id: "corr-1",
    phase: "awaiting_finality",
    stage: "submitted",
    transaction: null,
    finality: {
      block_tag: "finalized",
      policy_block_number: 1,
      blocks_remaining: 0,
      eta_seconds: 0,
    },
  },
};

describe("schema sync", () => {
  it("accepts CVM list filters the API already reads", () => {
    const parsed = GetCvmListRequestSchema.parse({
      search: "web",
      status: ["running"],
      base_image: "dstack-0.5.8",
      kms_slug: "phala",
      kms_type: "PHALA",
      node: "usw5",
      region: "us-west",
    });
    expect(parsed).toMatchObject({
      search: "web",
      status: ["running"],
      node: "usw5",
      region: "us-west",
    });
  });

  it("sends a null shutdown_timeout so the platform default can be restored", async () => {
    const client = { patch: vi.fn().mockResolvedValue({ correlation_id: "c" }) } as unknown as Client;
    await patchCvm(client, { id: "cvm-1", shutdown_timeout: null });
    expect(client.patch).toHaveBeenCalledWith(
      "/cvms/cvm-1",
      { shutdown_timeout: null },
      expect.anything(),
    );
  });

  it("accepts guest_agent_gateway_access on provision and patch", () => {
    expect(
      ProvisionCvmRequestSchema.parse({
        name: "hello",
        compose_file: { docker_compose_file: "services: {}" },
        guest_agent_gateway_access: "closed",
      }).guest_agent_gateway_access,
    ).toBe("closed");
    expect(
      PatchCvmRequestSchema.parse({ id: "cvm-1", guest_agent_gateway_access: "closed" })
        .guest_agent_gateway_access,
    ).toBe("closed");
  });

  it("sends replica extras the API already reads", async () => {
    const client = {
      post: vi.fn().mockResolvedValue(replica),
      config: { version: "2026-11-11" },
    } as unknown as Client;
    await replicateCvm(client, {
      id: "source",
      os_image: "dstack-0.5.8",
      encrypted_env: "deadbeef",
      compose_hash: "h",
      kms_urls: ["https://kms"],
      gateway_urls: ["https://gw"],
    });
    expect(client.post).toHaveBeenCalledWith("/cvms/source/replicas", {
      os_image: "dstack-0.5.8",
      encrypted_env: "deadbeef",
      compose_hash: "h",
      kms_urls: ["https://kms"],
      gateway_urls: ["https://gw"],
    });
  });

  it("accepts instance extras and decodes ReplicaVM without a resource object", async () => {
    const parsed = CreateAppInstanceRequestSchema.parse({
      appId: "app-1",
      os_image: "dstack-0.5.8",
      kms_urls: ["https://kms"],
      gateway_urls: ["https://gw"],
    });
    expect(parsed.os_image).toBe("dstack-0.5.8");

    const client = {
      post: vi.fn().mockResolvedValue(replica),
      config: { version: "2026-11-11" },
    } as unknown as Client;
    const result = await createAppInstance(client, { appId: "app-1", os_image: "dstack-0.5.8" });
    expect(result.finality_wait?.correlation_id).toBe("corr-1");
    expect("resource" in result).toBe(false);
    expect(client.post).toHaveBeenCalledWith("/apps/app-1/instances", { os_image: "dstack-0.5.8" });
  });

  it("keeps CVM detail finality, node_id and kms block tag", () => {
    const parsed = CvmInfoDetailV20261111Schema.parse({
      id: "cvm-1",
      name: "app",
      status: "running",
      resource: { memory_in_mb: 1024 },
      gateway: {},
      node_info: { object_type: "node", id: 7, node_id: 42 },
      kms_info: { block_tag: "finalized", finality_eta_seconds: 12 },
      finality_wait: replica.finality_wait,
      finality_failure: {
        operation: "update",
        correlation_id: "corr-old",
        failure_reason: "timeout",
        failed_at: "2026-01-02T00:00:00Z",
      },
    });
    expect(parsed.node_info?.node_id).toBe(42);
    expect(parsed.kms_info?.block_tag).toBe("finalized");
    expect(parsed.kms_info?.finality_eta_seconds).toBe(12);
    expect(parsed.finality_failure?.failure_reason).toBe("timeout");
  });

  it("keeps revision OIDC provenance", () => {
    const parsed = AppRevisionResponseSchema.parse({
      revision_id: "rev_1",
      app_id: "abc",
      vm_uuid: "u",
      compose_hash: "h",
      created_at: "2026-01-01T00:00:00Z",
      operation_type: "deploy",
      oidc_provenance: {
        repository: "org/repo",
        ref: "refs/heads/main",
        sha: "deadbeef",
        actor: "ada",
        workflow_ref: "org/repo/.github/workflows/deploy.yml@refs/heads/main",
      },
      launch_ticket_status: "issued",
    });
    expect(parsed.oidc_provenance?.repository).toBe("org/repo");
    expect(parsed.launch_ticket_status).toBe("issued");
  });

  it("types /auth/me user.id and features", () => {
    const parsed = CurrentUserV20260121Schema.parse({
      user: {
        id: "usr_1",
        username: "ada",
        email: "a@b.c",
        role: "user",
        avatar: "",
        email_verified: true,
        totp_enabled: false,
        has_backup_codes: false,
        flag_has_password: true,
      },
      workspace: { id: "wks_1", name: "acme", slug: "acme", tier: "level_1", role: "owner" },
      credits: {
        balance: "0",
        granted_balance: "0",
        is_post_paid: false,
        outstanding_amount: null,
      },
      features: [{ name: "can_create_cvm", enabled: true }],
    });
    expect(parsed.user.id).toBe("usr_1");
    expect(parsed.features?.[0]?.name).toBe("can_create_cvm");
  });

  it("keeps workspace viewer", () => {
    const parsed = WorkspaceResponseSchema.parse({
      id: "wks_1",
      name: "acme",
      slug: "acme",
      tier: "level_1",
      role: "owner",
      is_default: true,
      created_at: "2026-01-01T00:00:00Z",
      viewer: { user: { username: "ada" }, features: [] },
    });
    expect(parsed.viewer).toEqual({ user: { username: "ada" }, features: [] });
  });
});

describe("ReplicaVM schema", () => {
  it("does not require CvmInfo.resource", () => {
    expect(VMSchema.parse(replica).teepod_id).toBe(1);
  });
});
