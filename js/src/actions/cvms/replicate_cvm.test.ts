import type { Client } from "../../client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { replicateCvm, ReplicateCvmRequestSchema } from "./replicate_cvm";

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
      status: "running",
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

    await replicateCvm(client, {
      id: "source",
      node_id: 7,
      os_image: "dstack-0.5.8-target",
    });

    expect(client.post).toHaveBeenCalledWith("/cvms/source/replicas", {
      node_id: 7,
      os_image: "dstack-0.5.8-target",
    });
  });

  it("rejects an empty OS image", () => {
    expect(ReplicateCvmRequestSchema.safeParse({ id: "source", os_image: "" }).success).toBe(false);
  });
});
