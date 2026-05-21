import { describe, it, expect } from "vitest";
import {
  LooseAppComposeSchema,
  MAX_COMPOSE_PAYLOAD_BYTES,
  validateComposePayloadSize,
} from "./app_compose";
import { z } from "zod";

describe("validateComposePayloadSize", () => {
  function runValidation(
    dockerComposeFile: string | undefined,
    preLaunchScript: string | undefined,
  ) {
    const schema = z
      .object({
        docker_compose_file: z.string().optional(),
        pre_launch_script: z.string().optional(),
      })
      .superRefine((data, ctx) => {
        validateComposePayloadSize(data.docker_compose_file, data.pre_launch_script, ctx);
      });

    return schema.safeParse({
      docker_compose_file: dockerComposeFile,
      pre_launch_script: preLaunchScript,
    });
  }

  it("should pass when both fields are undefined", () => {
    const result = runValidation(undefined, undefined);
    expect(result.success).toBe(true);
  });

  it("should pass when total size is within limit", () => {
    const compose = "x".repeat(100 * 1024); // 100KB
    const script = "y".repeat(50 * 1024); // 50KB
    const result = runValidation(compose, script);
    expect(result.success).toBe(true);
  });

  it("should pass when total size equals exactly 200KB", () => {
    const compose = "x".repeat(MAX_COMPOSE_PAYLOAD_BYTES);
    const result = runValidation(compose, undefined);
    expect(result.success).toBe(true);
  });

  it("should fail when docker_compose_file alone exceeds limit", () => {
    const compose = "x".repeat(MAX_COMPOSE_PAYLOAD_BYTES + 1);
    const result = runValidation(compose, undefined);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("must not exceed 200KB");
    }
  });

  it("should fail when combined size exceeds limit", () => {
    const compose = "x".repeat(150 * 1024); // 150KB
    const script = "y".repeat(60 * 1024); // 60KB → total 210KB
    const result = runValidation(compose, script);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("must not exceed 200KB");
      expect(result.error.issues[0].message).toContain("210KB");
    }
  });

  it("should measure byte length not string length for multibyte characters", () => {
    // Each CJK character is 3 bytes in UTF-8
    // 68267 CJK chars × 3 bytes = 204801 bytes > 200KB
    const multibyte = "你".repeat(68267);
    const result = runValidation(multibyte, undefined);
    expect(result.success).toBe(false);
  });
});

describe("LooseAppComposeSchema", () => {
  it("should accept a valid compose file within size limit", () => {
    const result = LooseAppComposeSchema.safeParse({
      docker_compose_file: "version: '3'\nservices:\n  app:\n    image: nginx",
    });
    expect(result.success).toBe(true);
  });

  it("should reject compose file exceeding 200KB", () => {
    const result = LooseAppComposeSchema.safeParse({
      docker_compose_file: "x".repeat(MAX_COMPOSE_PAYLOAD_BYTES + 1),
    });
    expect(result.success).toBe(false);
  });

  it("should reject when compose + pre_launch_script exceed 200KB combined", () => {
    const result = LooseAppComposeSchema.safeParse({
      docker_compose_file: "x".repeat(150 * 1024),
      pre_launch_script: "y".repeat(60 * 1024),
    });
    expect(result.success).toBe(false);
  });

  it("should accept a valid port_policy", () => {
    const result = LooseAppComposeSchema.safeParse({
      docker_compose_file: "version: '3'",
      port_policy: {
        ports: [
          { port: 80, pp: true },
          { port: 443, pp: false },
        ],
        restrict_mode: true,
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.port_policy).toEqual({
        ports: [
          { port: 80, pp: true },
          { port: 443, pp: false },
        ],
        restrict_mode: true,
      });
    }
  });

  it("should reject port_policy with out-of-range port", () => {
    const result = LooseAppComposeSchema.safeParse({
      docker_compose_file: "version: '3'",
      port_policy: {
        ports: [{ port: 70000, pp: true }],
        restrict_mode: false,
      },
    });
    expect(result.success).toBe(false);
  });

  it("should reject port_policy missing restrict_mode", () => {
    const result = LooseAppComposeSchema.safeParse({
      docker_compose_file: "version: '3'",
      port_policy: {
        ports: [{ port: 80, pp: true }],
      },
    });
    expect(result.success).toBe(false);
  });
});
