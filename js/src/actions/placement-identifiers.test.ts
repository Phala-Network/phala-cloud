import { describe, expect, it, vi } from "vitest";
import type { Client } from "../client";
import { CheckAppIsAllowedRequestSchema, checkAppIsAllowed } from "./apps/check_app_is_allowed";
import { CreateAppInstanceRequestSchema, createAppInstance } from "./apps/create_app_instance";
import { CheckCvmIsAllowedRequestSchema, checkCvmIsAllowed } from "./cvms/check_cvm_is_allowed";
import { ProvisionCvmRequestSchema, provisionCvm } from "./cvms/provision_cvm";
import { ReplicateCvmRequestSchema, replicateCvm } from "./cvms/replicate_cvm";
import { TeepodCapacitySchema } from "./get_available_nodes";

const baseRequest = {
  name: "placement-test",
  compose_file: { docker_compose_file: "services: {}" },
};

function mockClient() {
  const post = vi.fn().mockResolvedValue({
    compose_hash: "hash",
    token: "token",
    id: "cvm_test",
    name: "replica",
    status: "running",
    teepod_id: 7,
    teepod: { id: 7, name: "test-node" },
    app_id: "app_test",
    vm_uuid: "uuid-test",
    instance_id: null,
    vcpu: 2,
    memory: 4096,
    disk_size: 20,
    base_image: "dstack-0.6.0",
    created_at: "2026-01-01T00:00:00Z",
    encrypted_env_pubkey: null,
  });
  const client = { post, config: { version: "2026-06-23" } } as unknown as Client;
  return { client, post };
}

describe("non-admin placement identifiers", () => {
  it("serializes the physical node name for provisioning", async () => {
    const { client, post } = mockClient();
    await provisionCvm(client, { ...baseRequest, node: "usw5", kms_id: "phala" });
    expect(post).toHaveBeenCalledWith(
      "/cvms",
      expect.objectContaining({ node: "usw5", kms_id: "phala" }),
    );
  });

  it.each([42, "42", "teepod_wrong", "node_"])(
    "rejects invalid provision node_id %s",
    (node_id) => {
      expect(ProvisionCvmRequestSchema.safeParse({ ...baseRequest, node_id }).success).toBe(false);
    },
  );

  it.each([7, "7", "node_wrong"])("rejects invalid provision teepod_id %s", (teepod_id) => {
    expect(ProvisionCvmRequestSchema.safeParse({ ...baseRequest, teepod_id }).success).toBe(false);
  });

  it("does not send malformed input or numeric KMS contract IDs", async () => {
    const { client, post } = mockClient();
    await expect(provisionCvm(client, { ...baseRequest, node_id: "42" })).rejects.toThrow();
    expect(post).not.toHaveBeenCalled();
    expect(
      ProvisionCvmRequestSchema.safeParse({ ...baseRequest, kms_contract_id: 42 }).success,
    ).toBe(false);
  });

  it("fails resource parsing when canonical placement identifiers are missing", () => {
    expect(
      TeepodCapacitySchema.safeParse({
        teepod_id: 7,
        node_id: 42,
        name: "test-node",
        node: "usw5",
        listed: true,
        resource_score: 1,
        remaining_vcpu: 8,
        remaining_memory: 16,
        remaining_cvm_slots: 4,
        images: [],
      }).success,
    ).toBe(false);
  });

  it("uses the physical name from the catalog, not the Teepod display name", async () => {
    const capacity = TeepodCapacitySchema.parse({
      teepod_id: 7,
      node_id: 42,
      teepod_id_hashid: "teepod_placement7",
      node_id_hashid: "node_physical42",
      name: "display-name",
      node: "usw5",
      listed: true,
      resource_score: 1,
      remaining_vcpu: 8,
      remaining_memory: 16,
      remaining_cvm_slots: 4,
      images: [],
    });
    const { client, post } = mockClient();
    await replicateCvm(client, { id: "source", node: capacity.node });
    expect(post).toHaveBeenCalledWith("/cvms/source/replicas", {
      node: "usw5",
      os_image: undefined,
    });
  });

  it("sends node on instance creation and both allowance checks", async () => {
    const { client, post } = mockClient();
    await createAppInstance(client, { appId: "app", node: "usw5" });
    expect(post).toHaveBeenCalledWith("/apps/app/instances", { node: "usw5" });
    post.mockResolvedValue({
      app_contract_address: "app",
      compose_hash: "hash",
      device_id: "device",
      compose_hash_allowed: true,
      allow_any_device: false,
      is_allowed: true,
    });
    await checkAppIsAllowed(client, {
      appId: "app",
      compose_hash: "hash",
      node: "usw5",
      device_id: "device",
    });
    expect(post).toHaveBeenCalledWith("/apps/app/is-allowed", {
      compose_hash: "hash",
      node: "usw5",
      device_id: "device",
    });
    await checkCvmIsAllowed(client, { cvmId: "source", node: "usw5" });
    expect(post).toHaveBeenCalledWith("/cvms/source/is-allowed", { node: "usw5" });
  });

  it.each(["node_id", "teepod_id"])("rejects legacy %s even when null", (key) => {
    for (const value of [null, undefined, "legacy"]) {
      expect(ReplicateCvmRequestSchema.safeParse({ id: "source", [key]: value }).success).toBe(
        false,
      );
      expect(CreateAppInstanceRequestSchema.safeParse({ appId: "app", [key]: value }).success).toBe(
        false,
      );
      expect(
        CheckCvmIsAllowedRequestSchema.safeParse({ cvmId: "source", [key]: value }).success,
      ).toBe(false);
      expect(
        CheckAppIsAllowedRequestSchema.safeParse({
          appId: "app",
          compose_hash: "hash",
          [key]: value,
        }).success,
      ).toBe(false);
    }
  });

  it("accepts optional nonempty node and preserves device_id", () => {
    for (const [schema, request] of [
      [ReplicateCvmRequestSchema, { id: "source" }],
      [CreateAppInstanceRequestSchema, { appId: "app" }],
      [CheckCvmIsAllowedRequestSchema, { cvmId: "source", device_id: "device" }],
      [CheckAppIsAllowedRequestSchema, { appId: "app", compose_hash: "hash", device_id: "device" }],
    ] as const) {
      expect(schema.safeParse(request).success).toBe(true);
      expect(schema.safeParse({ ...request, node: "usw5" }).success).toBe(true);
      expect(schema.safeParse({ ...request, node: "" }).success).toBe(false);
    }
  });
});
