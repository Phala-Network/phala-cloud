import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  updateCvmSshKeys,
  safeUpdateCvmSshKeys,
  UpdateCvmSshKeysRequestSchema,
} from "./update_cvm_ssh_keys";
import type { Client } from "../../client";

describe("updateCvmSshKeys", () => {
  let mockClient: Client;

  beforeEach(() => {
    mockClient = {
      put: vi.fn(),
    } as unknown as Client;
  });

  const mockResponse = {
    keys: [
      {
        id: "sshkey_abc",
        owner_user_id: "usr_1",
        owner_username: "alice",
        added_by_user_id: "usr_2",
        name: "laptop",
        public_key: "ssh-ed25519 AAAA...",
        fingerprint: "SHA256:abc",
        key_type: "ssh-ed25519",
      },
    ],
    restart_required: true,
  };

  describe("UpdateCvmSshKeysRequestSchema", () => {
    it("should accept ssh_key_ids and optional usernames", () => {
      const result = UpdateCvmSshKeysRequestSchema.safeParse({
        id: "app_123",
        ssh_key_ids: ["sshkey_abc"],
        usernames: ["alice"],
      });
      expect(result.success).toBe(true);
    });

    it("should reject a request with no CVM identifier", () => {
      const result = UpdateCvmSshKeysRequestSchema.safeParse({
        ssh_key_ids: ["sshkey_abc"],
      });
      expect(result.success).toBe(false);
    });
  });

  it("should call PUT /cvms/{id}/ssh-keys with the replacement set", async () => {
    vi.mocked(mockClient.put).mockResolvedValue(mockResponse);

    const result = await updateCvmSshKeys(mockClient, {
      id: "app_123",
      ssh_key_ids: ["sshkey_abc"],
      usernames: ["alice"],
      apply_now: true,
    });

    expect(mockClient.put).toHaveBeenCalledWith("/cvms/app_123/ssh-keys", {
      ssh_key_ids: ["sshkey_abc"],
      usernames: ["alice"],
      apply_now: true,
    });
    expect(result.restart_required).toBe(true);
  });

  it("should default apply_now to false when omitted", async () => {
    vi.mocked(mockClient.put).mockResolvedValue(mockResponse);

    await updateCvmSshKeys(mockClient, {
      id: "app_123",
      ssh_key_ids: [],
    });

    expect(mockClient.put).toHaveBeenCalledWith("/cvms/app_123/ssh-keys", {
      ssh_key_ids: [],
      apply_now: false,
    });
  });

  it("should return an error result from the safe helper", async () => {
    vi.mocked(mockClient.put).mockRejectedValue(new Error("API Error"));

    const result = await safeUpdateCvmSshKeys(mockClient, {
      id: "app_123",
      ssh_key_ids: ["sshkey_abc"],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe("API Error");
    }
  });
});
