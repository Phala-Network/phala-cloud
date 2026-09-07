import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getCvmContainersStats,
  safeGetCvmContainersStats,
  GetCvmContainersStatsRequestSchema,
} from "./get_cvm_containers_stats";
import type { Client } from "../../client";

describe("getCvmContainersStats", () => {
  let mockClient: Partial<Client>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockClient = {
      get: vi.fn(),
    };
  });

  describe("GetCvmContainersStatsRequestSchema", () => {
    it("should validate valid request", () => {
      const result = GetCvmContainersStatsRequestSchema.safeParse({ id: "test-cvm-id" });
      expect(result.success).toBe(true);
    });

    it("should reject empty id", () => {
      const result = GetCvmContainersStatsRequestSchema.safeParse({ id: "" });
      expect(result.success).toBe(false);
    });
  });

  describe("getCvmContainersStats", () => {
    it("should call GET /cvms/{id}/composition", async () => {
      const mockResponse = {
        is_online: true,
        is_public: true,
        error: null,
        docker_compose_file: "version: '3'\nservices:\n  app:\n    image: nginx",
        manifest_version: 1,
        version: "1.0.0",
        runner: "docker-compose",
        features: ["kms", "tproxy-net"],
        containers: [
          {
            id: "container-123",
            names: ["/app"],
            image: "nginx:latest",
            image_id: "sha256:abc123",
            command: "nginx -g daemon off;",
            created: 1672531200,
            state: "running",
            status: "Up 2 hours",
            log_endpoint: "https://logs.example.com/app",
          },
        ],
      };

      (mockClient.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await getCvmContainersStats(mockClient as Client, { id: "test-cvm-id" });

      expect(mockClient.get).toHaveBeenCalledWith("/cvms/test-cvm-id/composition");
      expect(result.is_online).toBe(true);
      expect(result.containers?.length).toBe(1);
      expect(result.containers?.[0].names).toEqual(["/app"]);
    });

    it("should accept manifest_version as numeric string (dstack 0.6.0+)", async () => {
      // dstack 0.6.0+ serializes manifest_version as "3" instead of 3
      const mockResponse = {
        is_online: true,
        is_public: true,
        error: null,
        docker_compose_file: "services:\n  app:\n    image: nginx",
        manifest_version: "3",
        version: null,
        runner: "docker-compose",
        features: ["kms", "tproxy-net"],
        containers: [
          {
            id: "container-123",
            names: ["/dstack-app-1"],
            image: "nginx:latest",
            image_id: "sha256:abc123",
            command: null,
            created: 1672531200,
            state: "running",
            status: "Up About an hour (healthy)",
            log_endpoint: "https://logs.example.com/app",
          },
        ],
      };

      (mockClient.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await getCvmContainersStats(mockClient as Client, { id: "test-cvm-id" });

      expect(result.manifest_version).toBe(3);
    });

    it("should throw error for invalid id", async () => {
      await expect(getCvmContainersStats(mockClient as Client, { id: "" })).rejects.toThrow();
    });
  });

  describe("safeGetCvmContainersStats", () => {
    it("should return success result", async () => {
      const mockResponse = {
        is_online: true,
        is_public: true,
        error: null,
        docker_compose_file: null,
        manifest_version: null,
        version: null,
        runner: null,
        features: null,
        containers: [],
      };

      (mockClient.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await safeGetCvmContainersStats(mockClient as Client, { id: "test-cvm-id" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_online).toBe(true);
      }
    });

    it("should return error result for invalid id", async () => {
      const result = await safeGetCvmContainersStats(mockClient as Client, { id: "" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });
});
