import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAppInstance, CreateAppInstanceRequestSchema } from "./create_app_instance";
import type { Client } from "../../client";

describe("createAppInstance", () => {
  let mockClient: Client;

  beforeEach(() => {
    mockClient = {
      post: vi.fn(),
    } as unknown as Client;
  });

  it("accepts a custom instance name", () => {
    const result = CreateAppInstanceRequestSchema.safeParse({
      appId: "app-123",
      name: "redis-0",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("redis-0");
    }
  });

  it("sends the custom instance name in the create request body", async () => {
    const response = {
      id: "cvm_123",
      app_id: "app-123",
      vm_uuid: "vm-123",
      instance_id: "instance-123",
      name: "redis-0",
      status: "running",
      teepod_id: 5,
      vcpu: 2,
      memory: 4096,
      disk_size: 20,
      created_at: "2026-01-01T00:00:00Z",
      encrypted_env_pubkey: "pubkey",
    };
    (mockClient.post as any).mockResolvedValue(response);

    await createAppInstance(mockClient, {
      appId: "app-123",
      name: "redis-0",
      node_id: 5,
    });

    expect(mockClient.post).toHaveBeenCalledWith("/apps/app-123/instances", {
      name: "redis-0",
      node_id: 5,
    });
  });
});
