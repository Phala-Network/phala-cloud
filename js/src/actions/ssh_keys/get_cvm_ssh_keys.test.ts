import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCvmSshKeys, safeGetCvmSshKeys, CvmSshKeysResponseSchema } from "./get_cvm_ssh_keys";
import type { Client } from "../../client";

describe("getCvmSshKeys", () => {
  let mockClient: Client;

  beforeEach(() => {
    mockClient = {
      get: vi.fn(),
    } as unknown as Client;
  });

  const mockResponse = {
    keys: [
      {
        id: "sshkey_abc",
        owner_user_id: "usr_1",
        owner_username: "alice",
        owner_email: "alice@example.com",
        added_by_user_id: "usr_1",
        name: "laptop",
        public_key: "ssh-ed25519 AAAA...",
        fingerprint: "SHA256:abc",
        key_type: "ssh-ed25519",
      },
    ],
    restart_required: false,
  };

  it("should call GET /cvms/{id}/ssh-keys", async () => {
    vi.mocked(mockClient.get).mockResolvedValue(mockResponse);

    const result = await getCvmSshKeys(mockClient, { id: "app_123" });

    expect(mockClient.get).toHaveBeenCalledWith("/cvms/app_123/ssh-keys");
    expect(result.keys[0]?.owner_username).toBe("alice");
    expect(result.restart_required).toBe(false);
  });

  it("should reject a response missing owner fields", () => {
    const result = CvmSshKeysResponseSchema.safeParse({
      keys: [
        {
          id: "sshkey_abc",
          owner_user_id: "usr_1",
          added_by_user_id: "usr_1",
          name: "laptop",
          public_key: "ssh-ed25519 AAAA...",
          fingerprint: "SHA256:abc",
          key_type: "ssh-ed25519",
        },
      ],
      restart_required: false,
    });
    expect(result.success).toBe(false);
  });

  it("should return an error result from the safe helper", async () => {
    vi.mocked(mockClient.get).mockRejectedValue(new Error("API Error"));

    const result = await safeGetCvmSshKeys(mockClient, { id: "app_123" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe("API Error");
    }
  });
});
