/**
 * Tests that CVM lifecycle action responses are parsed with the correct
 * versioned schema based on client.config.version.
 *
 * For API version 2026-01-21 (pre-hashid), id and user_id are numeric
 * integers. The server returns 0 as a sentinel value for these fields
 * (the real identifier is no longer exposed as a plain integer).
 *
 * For API version 2026-05-22 and later, id and user_id are hashid strings.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient } from "../../client";
import { startCvm } from "./start_cvm";
import { stopCvm } from "./stop_cvm";
import { restartCvm } from "./restart_cvm";
import { shutdownCvm } from "./shutdown_cvm";
import { commitCvmProvision } from "./commit_cvm_provision";

const vmBaseFields = {
  name: "test-cvm",
  status: "running",
  teepod_id: 1,
  teepod: { id: 1, name: "test-node" },
  app_id: "app_test123",
  vm_uuid: "uuid-123",
  instance_id: null,
  vcpu: 2,
  memory: 2048,
  disk_size: 20,
  base_image: "ubuntu-22.04",
  created_at: "2025-01-01T00:00:00Z",
  encrypted_env_pubkey: null,
  // CommitCvmProvision schema requires docker_compose_file (nullable, not optional)
  docker_compose_file: null,
};

const commitPayload = {
  app_id: "app_test123",
  compose_hash: "abc123",
};

describe("CVM lifecycle actions — version-based schema selection", () => {
  describe("v20260522 (hashid IDs)", () => {
    let client: ReturnType<typeof createClient>;

    beforeEach(() => {
      client = createClient({ apiKey: "test", version: "2026-05-22" });
    });

    const response = { ...vmBaseFields, id: "cvm_ykL5lbAn", user_id: "usr_abc123" };

    it("startCvm accepts hashid id", async () => {
      vi.spyOn(client, "post").mockResolvedValue(response);
      const result = await startCvm(client, { id: "cvm_ykL5lbAn" });
      expect(result.id).toBe("cvm_ykL5lbAn");
    });

    it("stopCvm accepts hashid id", async () => {
      vi.spyOn(client, "post").mockResolvedValue(response);
      const result = await stopCvm(client, { id: "cvm_ykL5lbAn" });
      expect(result.id).toBe("cvm_ykL5lbAn");
    });

    it("restartCvm accepts hashid id", async () => {
      vi.spyOn(client, "post").mockResolvedValue(response);
      const result = await restartCvm(client, { id: "cvm_ykL5lbAn" });
      expect(result.id).toBe("cvm_ykL5lbAn");
    });

    it("shutdownCvm accepts hashid id", async () => {
      vi.spyOn(client, "post").mockResolvedValue(response);
      const result = await shutdownCvm(client, { id: "cvm_ykL5lbAn" });
      expect(result.id).toBe("cvm_ykL5lbAn");
    });

    it("commitCvmProvision accepts hashid id", async () => {
      vi.spyOn(client, "post").mockResolvedValue(response);
      const result = await commitCvmProvision(client, commitPayload);
      expect(result.id).toBe("cvm_ykL5lbAn");
    });

    it("rejects numeric id on v20260522 client", async () => {
      vi.spyOn(client, "post").mockResolvedValue({ ...vmBaseFields, id: 123, user_id: null });
      await expect(startCvm(client, { id: "cvm_ykL5lbAn" })).rejects.toThrow();
    });
  });

  describe("v20260121 (numeric IDs — server returns 0 sentinel)", () => {
    let client: ReturnType<typeof createClient>;

    beforeEach(() => {
      client = createClient({ apiKey: "test", version: "2026-01-21" });
    });

    const response = { ...vmBaseFields, id: 0, user_id: null };

    it("startCvm accepts numeric id (0 sentinel)", async () => {
      vi.spyOn(client, "post").mockResolvedValue(response);
      const result = await startCvm(client, { id: "cvm_ykL5lbAn" });
      expect(result.id).toBe(0);
    });

    it("stopCvm accepts numeric id (0 sentinel)", async () => {
      vi.spyOn(client, "post").mockResolvedValue(response);
      const result = await stopCvm(client, { id: "cvm_ykL5lbAn" });
      expect(result.id).toBe(0);
    });

    it("restartCvm accepts numeric id (0 sentinel)", async () => {
      vi.spyOn(client, "post").mockResolvedValue(response);
      const result = await restartCvm(client, { id: "cvm_ykL5lbAn" });
      expect(result.id).toBe(0);
    });

    it("shutdownCvm accepts numeric id (0 sentinel)", async () => {
      vi.spyOn(client, "post").mockResolvedValue(response);
      const result = await shutdownCvm(client, { id: "cvm_ykL5lbAn" });
      expect(result.id).toBe(0);
    });

    it("commitCvmProvision accepts numeric id (0 sentinel)", async () => {
      vi.spyOn(client, "post").mockResolvedValue(response);
      const result = await commitCvmProvision(client, commitPayload);
      expect(result.id).toBe(0);
    });

    it("rejects hashid id on v20260121 client", async () => {
      vi.spyOn(client, "post").mockResolvedValue({
        ...vmBaseFields,
        id: "cvm_ykL5lbAn",
        user_id: null,
      });
      await expect(startCvm(client, { id: "cvm_ykL5lbAn" })).rejects.toThrow();
    });
  });
});
