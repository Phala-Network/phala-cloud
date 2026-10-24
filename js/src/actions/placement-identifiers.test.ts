import { describe, expect, it, vi } from "vitest";
import type { Client } from "../client";
import { CreateAppInstanceRequestSchema } from "./apps/create_app_instance";
import { CheckAppIsAllowedRequestSchema } from "./apps/check_app_is_allowed";
import { ProvisionCvmRequestSchema, provisionCvm } from "./cvms/provision_cvm";
import { ReplicateCvmRequestSchema, replicateCvm } from "./cvms/replicate_cvm";
import { TeepodCapacitySchema } from "./get_available_nodes";
import { CheckCvmIsAllowedRequestSchema } from "./cvms/check_cvm_is_allowed";

const baseRequest = {
  name: "placement-test",
  compose_file: { docker_compose_file: "services: {}" },
};

function mockClient() {
  const post = vi.fn().mockResolvedValue({
    compose_hash: "hash", id: "cvm_test", name: "replica", status: "running",
    teepod_id: 7, teepod: { id: 7, name: "test-node" }, app_id: "app_test",
    vm_uuid: "uuid-test", instance_id: null, vcpu: 2, memory: 4096, disk_size: 20,
    base_image: "dstack-0.6.0", created_at: "2026-01-01T00:00:00Z", encrypted_env_pubkey: null,
  });
  const client = { post, config: { version: "2026-06-23" } } as unknown as Client;
  return { client, post };
}

describe("non-admin placement identifiers", () => {
  it("serializes distinct physical node and Teepod hash IDs for provisioning", async () => {
    const { client, post } = mockClient();
    await provisionCvm(client, {
      ...baseRequest,
      node_id: "node_physical42",
      teepod_id: "teepod_placement7",
      kms_id: "phala",
    });
    expect(post).toHaveBeenCalledWith("/cvms", expect.objectContaining({
      node_id: "node_physical42", teepod_id: "teepod_placement7", kms_id: "phala",
    }));
  });

  it.each([42, "42", "teepod_wrong", "node_"])("rejects invalid provision node_id %s", (node_id) => {
    expect(ProvisionCvmRequestSchema.safeParse({ ...baseRequest, node_id }).success).toBe(false);
  });

  it.each([7, "7", "node_wrong"])("rejects invalid provision teepod_id %s", (teepod_id) => {
    expect(ProvisionCvmRequestSchema.safeParse({ ...baseRequest, teepod_id }).success).toBe(false);
  });

  it("does not send malformed input or numeric KMS contract IDs", async () => {
    const { client, post } = mockClient();
    await expect(provisionCvm(client, { ...baseRequest, node_id: "42" })).rejects.toThrow();
    expect(post).not.toHaveBeenCalled();
    expect(ProvisionCvmRequestSchema.safeParse({ ...baseRequest, kms_contract_id: 42 }).success).toBe(false);
  });

  it("fails resource parsing when canonical placement identifiers are missing", () => {
    expect(TeepodCapacitySchema.safeParse({
      teepod_id: 7, node_id: 42, name: "test-node", listed: true, resource_score: 1,
      remaining_vcpu: 8, remaining_memory: 16, remaining_cvm_slots: 4, images: [],
    }).success).toBe(false);
  });

  it("uses the Teepod hash for replica placement when Node.id differs from Teepod.id", async () => {
    const capacity = TeepodCapacitySchema.parse({
      teepod_id: 7, node_id: 42,
      teepod_id_hashid: "teepod_placement7", node_id_hashid: "node_physical42",
      name: "test-node", listed: true, resource_score: 1,
      remaining_vcpu: 8, remaining_memory: 16, remaining_cvm_slots: 4, images: [],
    });
    const { client, post } = mockClient();
    await replicateCvm(client, { id: "source", node_id: capacity.teepod_id_hashid });
    expect(post).toHaveBeenCalledWith("/cvms/source/replicas", expect.objectContaining({
      node_id: "teepod_placement7",
    }));
  });

  it.each([7, "7", "node_physical42"])("rejects the wrong identifier space for replica/instance placement: %s", (node_id) => {
    expect(ReplicateCvmRequestSchema.safeParse({ id: "source", node_id }).success).toBe(false);
    expect(CreateAppInstanceRequestSchema.safeParse({ appId: "app_test", node_id }).success).toBe(false);
  });

  it("uses physical Node hashes for allowance checks", () => {
    const request = { appId: "app_test", compose_hash: "hash" };
    expect(CheckAppIsAllowedRequestSchema.safeParse({ ...request, node_id: "node_physical42" }).success).toBe(true);
    expect(CheckAppIsAllowedRequestSchema.safeParse({ ...request, node_id: 42 }).success).toBe(false);
    expect(CheckAppIsAllowedRequestSchema.safeParse({ ...request, node_id: "teepod_placement7" }).success).toBe(false);
    expect(CheckCvmIsAllowedRequestSchema.safeParse({ cvmId: "source", node_id: "node_physical42" }).success).toBe(true);
    expect(CheckCvmIsAllowedRequestSchema.safeParse({ cvmId: "source", node_id: 42 }).success).toBe(false);
  });

  it("keeps the deprecated replica alias in the Teepod identifier space", () => {
    expect(ReplicateCvmRequestSchema.safeParse({ id: "source", teepod_id: "teepod_placement7" }).success).toBe(true);
    expect(ReplicateCvmRequestSchema.safeParse({ id: "source", teepod_id: "node_physical42" }).success).toBe(false);
  });
});
