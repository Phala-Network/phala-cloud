import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "../../client";
import { ReplicateCvmRequestSchema, replicateCvm } from "./replicate_cvm";

describe("replicateCvm", () => {
  let client: Client;

  beforeEach(() => {
    client = {
      post: vi.fn(),
      config: { version: "2026-05-22" as const },
    } as unknown as Client;
  });

  it("accepts and sends an explicit OS image", async () => {
    const response = {
      id: "cvm_1",
      name: "replica",
      status: "starting",
      finality_wait: {
        operation: "create",
        correlation_id: "replica-operation",
        phase: "awaiting_finality",
        stage: "submitted",
        transaction: { hash: "0xabc", block_number: 100, chain_id: 8453 },
        finality: { block_tag: "safe", policy_block_number: 90, blocks_remaining: 10, eta_seconds: 20 },
      },
      teepod_id: 1,
      teepod: { id: 1, name: "node" },
      app_id: "app_test",
      vm_uuid: "uuid-1",
      instance_id: null,
      vcpu: 2,
      memory: 4096,
      disk_size: 20,
      base_image: "dstack-0.5.8-target",
      created_at: "2026-01-01T00:00:00Z",
      encrypted_env_pubkey: null,
    };
    (client.post as ReturnType<typeof vi.fn>).mockResolvedValue(response);

    await expect(replicateCvm(client, {
      id: "source",
      node: "usw5",
      os_image: "dstack-0.5.8-target",
    })).resolves.toEqual(response);

    expect(client.post).toHaveBeenCalledWith("/cvms/source/replicas", {
      node: "usw5",
      os_image: "dstack-0.5.8-target",
    });
  });

  it("rejects an empty OS image", () => {
    expect(ReplicateCvmRequestSchema.safeParse({ id: "source", os_image: "" }).success).toBe(false);
  });
});
