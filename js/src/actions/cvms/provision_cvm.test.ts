import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "../../client";
import { MAX_COMPOSE_PAYLOAD_BYTES } from "../../types/app_compose";
import { provisionCvm, ProvisionCvmRequestSchema } from "./provision_cvm";

describe("ProvisionCvmRequestSchema", () => {
  describe("manual nonce specification", () => {
    it("should accept nonce and app_id fields", () => {
      const input = {
        name: "test-app",
        instance_type: "tdx.small",
        compose_file: {
          docker_compose_file: "version: '3'\nservices:\n  app:\n    image: nginx",
        },
        kms: "PHALA" as const,
        nonce: 5,
        app_id: "0x97b33782AEeB23974b7b4839BB22cCF8F11Cd83e",
      };

      const result = ProvisionCvmRequestSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.nonce).toBe(5);
        expect(result.data.app_id).toBe("0x97b33782AEeB23974b7b4839BB22cCF8F11Cd83e");
      }
    });

    it("should accept request without nonce/app_id (auto-generate)", () => {
      const input = {
        name: "test-app",
        instance_type: "tdx.small",
        compose_file: {
          docker_compose_file: "version: '3'\nservices:\n  app:\n    image: nginx",
        },
      };

      const result = ProvisionCvmRequestSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.nonce).toBeUndefined();
        expect(result.data.app_id).toBeUndefined();
      }
    });

    it("should accept nonce as number type", () => {
      const input = {
        name: "test-app",
        compose_file: {
          docker_compose_file: "version: '3'\nservices:\n  app:\n    image: nginx",
        },
        nonce: 0,
        app_id: "0xFCd8E7d731E613c92f428501686B74C7De7Fa95C",
      };

      const result = ProvisionCvmRequestSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.nonce).toBe(0);
      }
    });
  });

  describe("compose payload size limit", () => {
    const baseInput = {
      name: "test-app",
      instance_type: "tdx.small" as const,
      kms: "PHALA" as const,
    };

    it("should accept compose file within 200KB", () => {
      const result = ProvisionCvmRequestSchema.safeParse({
        ...baseInput,
        compose_file: {
          docker_compose_file: "x".repeat(100 * 1024),
        },
      });
      expect(result.success).toBe(true);
    });

    it("should reject compose file exceeding 200KB", () => {
      const result = ProvisionCvmRequestSchema.safeParse({
        ...baseInput,
        compose_file: {
          docker_compose_file: "x".repeat(MAX_COMPOSE_PAYLOAD_BYTES + 1),
        },
      });
      expect(result.success).toBe(false);
    });

    it("should reject when compose + pre_launch_script exceed 200KB combined", () => {
      const result = ProvisionCvmRequestSchema.safeParse({
        ...baseInput,
        compose_file: {
          docker_compose_file: "x".repeat(150 * 1024),
          pre_launch_script: "y".repeat(60 * 1024),
        },
      });
      expect(result.success).toBe(false);
    });

    it("should accept when compose + pre_launch_script are within 200KB combined", () => {
      const result = ProvisionCvmRequestSchema.safeParse({
        ...baseInput,
        compose_file: {
          docker_compose_file: "x".repeat(100 * 1024),
          pre_launch_script: "y".repeat(90 * 1024),
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("backward compatibility", () => {
    it("should still accept traditional requests without nonce fields", () => {
      const input = {
        name: "test-app",
        instance_type: "tdx.small",
        compose_file: {
          docker_compose_file: "version: '3'\nservices:\n  app:\n    image: nginx",
        },
        node_id: 123,
        region: "us-east",
      };

      const result = ProvisionCvmRequestSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("should preserve CVM resource matching v2 fields", () => {
      const input = {
        name: "test-app",
        instance_type: "tdx.small",
        compose_file: {
          docker_compose_file:
            "version: '3'\nservices:\n  app:\n    image: nginx",
        },
        kms: "BASE",
        kms_contract: "0xbase",
        kms_contract_id: "contract_1",
        key_provider_mode: "local",
        skip_gateway: true,
      };

      const result = ProvisionCvmRequestSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.kms_contract).toBe("0xbase");
        expect(result.data.kms_contract_id).toBe("contract_1");
        expect(result.data.key_provider_mode).toBe("local");
        expect(result.data.skip_gateway).toBe(true);
      }
    });
  });

  describe("smart default for instance_type", () => {
    const baseInput = {
      name: "test-app",
      compose_file: {
        docker_compose_file: "version: '3'\nservices:\n  app:\n    image: nginx",
      },
    };

    it("should default to tdx.small when no resource params specified", () => {
      const result = ProvisionCvmRequestSchema.safeParse(baseInput);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.instance_type).toBe("tdx.small");
        expect(result.data.vcpu).toBeUndefined();
        expect(result.data.memory).toBeUndefined();
      }
    });

    it("should NOT set default instance_type when vcpu is specified", () => {
      const input = { ...baseInput, vcpu: 4 };

      const result = ProvisionCvmRequestSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.instance_type).toBeUndefined();
        expect(result.data.vcpu).toBe(4);
      }
    });

    it("should NOT set default instance_type when memory is specified", () => {
      const input = { ...baseInput, memory: 8192 };

      const result = ProvisionCvmRequestSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.instance_type).toBeUndefined();
        expect(result.data.memory).toBe(8192);
      }
    });

    it("should NOT set default instance_type when both vcpu and memory are specified", () => {
      const input = { ...baseInput, vcpu: 4, memory: 8192 };

      const result = ProvisionCvmRequestSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.instance_type).toBeUndefined();
        expect(result.data.vcpu).toBe(4);
        expect(result.data.memory).toBe(8192);
      }
    });

    it("should use explicit instance_type when specified", () => {
      const input = { ...baseInput, instance_type: "tdx.large" };

      const result = ProvisionCvmRequestSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.instance_type).toBe("tdx.large");
      }
    });

    it("should use explicit instance_type even when vcpu/memory are also specified", () => {
      const input = { ...baseInput, instance_type: "tdx.medium", vcpu: 4, memory: 8192 };

      const result = ProvisionCvmRequestSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.instance_type).toBe("tdx.medium");
        expect(result.data.vcpu).toBe(4);
        expect(result.data.memory).toBe(8192);
      }
    });
  });

  describe("compose_file passthrough", () => {
    // compose_file must forward unknown keys so newer backend fields
    // (local_key_provider_enabled, port_policy, ...) reach the server
    // without requiring a schema bump on every client.
    it("preserves unknown keys on compose_file", () => {
      const input = {
        name: "test-app",
        instance_type: "tdx.small",
        compose_file: {
          docker_compose_file: "version: '3'\nservices:\n  app:\n    image: nginx",
          local_key_provider_enabled: true,
          port_policy: {
            ports: [{ port: 8080, pp: true }],
            restrict_mode: true,
          },
        },
      };

      const result = ProvisionCvmRequestSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        const composeFile = result.data.compose_file as Record<string, unknown>;
        expect(composeFile.local_key_provider_enabled).toBe(true);
        expect(composeFile.port_policy).toEqual({
          ports: [{ port: 8080, pp: true }],
          restrict_mode: true,
        });
      }
    });
  });
});

// Regression coverage for the previously-present `node_id -> teepod_id` rewrite.
// Node.id and Teepod.id are separate identifier spaces on the backend; the SDK
// must forward whichever field the caller set without renaming, or post-#1449
// frontends (which now send a real Node.id in `node_id`) route requests to the
// wrong teepod.
describe("provisionCvm (wire-level)", () => {
  let mockClient: Client;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  const baseRequest = {
    name: "test-app",
    instance_type: "tdx.small",
    compose_file: {
      docker_compose_file: "services: {}",
    },
  } as const;

  // Minimal response satisfying ProvisionCvmSchema (compose_hash is the only required field).
  const mockResponse = { compose_hash: "0xabc" };

  function getRequestBody(): Record<string, unknown> {
    const calls = (mockClient.post as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(1);
    const [path, body] = calls[0];
    expect(path).toBe("/cvms");
    return body as Record<string, unknown>;
  }

  beforeEach(() => {
    mockClient = {
      post: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Client;
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("forwards node_id verbatim and does not synthesize teepod_id", async () => {
    await provisionCvm(mockClient, { ...baseRequest, node_id: 7 });

    const body = getRequestBody();
    expect(body.node_id).toBe(7);
    expect("teepod_id" in body).toBe(false);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("forwards teepod_id verbatim with deprecation warning when only teepod_id is set", async () => {
    await provisionCvm(mockClient, { ...baseRequest, teepod_id: 12 });

    const body = getRequestBody();
    expect(body.teepod_id).toBe(12);
    expect("node_id" in body).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("teepod_id is deprecated"));
  });

  it("preserves distinct node_id and teepod_id values when both are set", async () => {
    // Guards against the historical rewrite that copied node_id into teepod_id
    // and dropped node_id. With distinct values (7 vs 12), a regression would
    // collapse them to a single id.
    await provisionCvm(mockClient, { ...baseRequest, node_id: 7, teepod_id: 12 });

    const body = getRequestBody();
    expect(body.node_id).toBe(7);
    expect(body.teepod_id).toBe(12);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("does not warn when neither id is provided", async () => {
    await provisionCvm(mockClient, baseRequest);

    const body = getRequestBody();
    expect("node_id" in body).toBe(false);
    expect("teepod_id" in body).toBe(false);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
