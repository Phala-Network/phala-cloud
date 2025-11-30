import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient } from "../../client";
import {
  getAppsList,
  safeGetAppsList,
  type GetAppsListResponse,
  type DstackApp,
  type AppCvmInfo,
} from "./get_apps_list";

// Mock CVM data matching the API structure
const mockCvmInfo: AppCvmInfo = {
  vm_uuid: "c48d9363-21b2-4f4a-87d9-3496623f020d",
  app_id: "2a7b4d0d0c0883d0d3119c36eb25a1f72122a7c4",
  name: "test-app",
  status: "running",
  vcpu: 4,
  memory: 8192,
  disk_size: 20,
  teepod_id: 11,
  teepod_name: "prod6",
  region_identifier: "EU-WEST-1",
  kms_type: "phala",
  instance_type: "tdx.large",
  listed: true,
  base_image: "dstack-dev-0.5.4.1",
  kms_slug: "phala-prod6",
  kms_id: "kms_dA2M76mq",
  instance_id: null,
};

const mockDstackApp: DstackApp = {
  id: "prj_A6eez86X",
  name: "test-app",
  app_id: "2a7b4d0d0c0883d0d3119c36eb25a1f72122a7c4",
  app_provision_type: null,
  app_icon_url: null,
  created_at: "2025-11-25T02:24:51.954322+00:00",
  kms_type: "phala",
  current_cvm: mockCvmInfo,
  cvms: [mockCvmInfo],
  cvm_count: 1,
};

const mockAppsListData: GetAppsListResponse = {
  dstack_apps: [mockDstackApp],
  page: 1,
  page_size: 20,
  total: 1,
  total_pages: 1,
};

describe("getAppsList", () => {
  let client: ReturnType<typeof createClient>;
  let mockGet: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = createClient({
      apiKey: "test-api-key",
      baseURL: "https://api.test.com",
    });
    mockGet = vi.spyOn(client, "get");
  });

  describe("API routing & basic success", () => {
    it("should call correct endpoint with query params", async () => {
      mockGet.mockResolvedValue(mockAppsListData);

      const result = await getAppsList(client, {
        page: 2,
        page_size: 50,
      });

      expect(mockGet).toHaveBeenCalledWith("/apps", {
        params: {
          page: 2,
          page_size: 50,
        },
      });
      expect(result).toEqual(mockAppsListData);
      expect(result.dstack_apps).toHaveLength(1);
    });

    it("should support search parameter", async () => {
      mockGet.mockResolvedValue(mockAppsListData);

      await getAppsList(client, {
        search: "my-app",
      });

      expect(mockGet).toHaveBeenCalledWith("/apps", {
        params: {
          search: "my-app",
        },
      });
    });

    it("should support filtering parameters", async () => {
      mockGet.mockResolvedValue(mockAppsListData);

      await getAppsList(client, {
        status: ["running", "stopped"],
        listed: true,
        region: "US-WEST-1",
        instance_type: "tdx.large",
      });

      expect(mockGet).toHaveBeenCalledWith("/apps", {
        params: {
          status: ["running", "stopped"],
          listed: true,
          region: "US-WEST-1",
          instance_type: "tdx.large",
        },
      });
    });
  });

  describe("error handling", () => {
    it("should throw on API errors", async () => {
      const apiError = new Error("API Error");
      mockGet.mockRejectedValue(apiError);

      await expect(getAppsList(client)).rejects.toThrow("API Error");
    });
  });

  describe("edge cases", () => {
    it("should work without parameters", async () => {
      mockGet.mockResolvedValue(mockAppsListData);

      const result = await getAppsList(client);

      expect(mockGet).toHaveBeenCalledWith("/apps", { params: {} });
      expect(result).toEqual(mockAppsListData);
    });

    it("should handle empty apps list", async () => {
      const emptyResponse: GetAppsListResponse = {
        dstack_apps: [],
        page: 1,
        page_size: 20,
        total: 0,
        total_pages: 0,
      };
      mockGet.mockResolvedValue(emptyResponse);

      const result = await getAppsList(client);

      expect(result.dstack_apps).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("should handle apps with multiple CVMs", async () => {
      const secondCvm: AppCvmInfo = {
        ...mockCvmInfo,
        vm_uuid: "d59e4474-32c3-5g5b-98e0-4507734g131e",
        name: "test-app-replica",
      };
      const multiCvmApp: DstackApp = {
        ...mockDstackApp,
        cvms: [mockCvmInfo, secondCvm],
        cvm_count: 2,
      };
      const responseWithMultipleCvms: GetAppsListResponse = {
        dstack_apps: [multiCvmApp],
        page: 1,
        page_size: 20,
        total: 1,
        total_pages: 1,
      };
      mockGet.mockResolvedValue(responseWithMultipleCvms);

      const result = await getAppsList(client);

      expect(result.dstack_apps[0].cvms).toHaveLength(2);
      expect(result.dstack_apps[0].cvm_count).toBe(2);
    });
  });

  describe("safeGetAppsList", () => {
    it("should return SafeResult on success", async () => {
      mockGet.mockResolvedValue(mockAppsListData);

      const result = await safeGetAppsList(client);

      expect(mockGet).toHaveBeenCalledWith("/apps", { params: {} });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockAppsListData);
        expect(result.data.dstack_apps).toHaveLength(1);
      }
    });

    it("should handle query parameters correctly in safe version", async () => {
      mockGet.mockResolvedValue(mockAppsListData);

      await safeGetAppsList(client, {
        page: 2,
        page_size: 50,
        search: "test",
      });

      expect(mockGet).toHaveBeenCalledWith("/apps", {
        params: {
          page: 2,
          page_size: 50,
          search: "test",
        },
      });
    });

    it("should return SafeResult with error on failure", async () => {
      const apiError = new Error("Network Error");
      mockGet.mockRejectedValue(apiError);

      const result = await safeGetAppsList(client);

      expect(result.success).toBe(false);
    });
  });

  describe("response structure validation", () => {
    it("should correctly parse app with current_cvm", async () => {
      mockGet.mockResolvedValue(mockAppsListData);

      const result = await getAppsList(client);

      const app = result.dstack_apps[0];
      expect(app.id).toBe("prj_A6eez86X");
      expect(app.name).toBe("test-app");
      expect(app.current_cvm).not.toBeNull();
      expect(app.current_cvm?.status).toBe("running");
      expect(app.current_cvm?.vm_uuid).toBe("c48d9363-21b2-4f4a-87d9-3496623f020d");
    });

    it("should correctly parse CVM info within app", async () => {
      mockGet.mockResolvedValue(mockAppsListData);

      const result = await getAppsList(client);

      const cvm = result.dstack_apps[0].cvms[0];
      expect(cvm.vm_uuid).toBe("c48d9363-21b2-4f4a-87d9-3496623f020d");
      expect(cvm.app_id).toBe("2a7b4d0d0c0883d0d3119c36eb25a1f72122a7c4");
      expect(cvm.status).toBe("running");
      expect(cvm.vcpu).toBe(4);
      expect(cvm.memory).toBe(8192);
      expect(cvm.disk_size).toBe(20);
      expect(cvm.teepod_id).toBe(11);
      expect(cvm.teepod_name).toBe("prod6");
      expect(cvm.region_identifier).toBe("EU-WEST-1");
      expect(cvm.instance_type).toBe("tdx.large");
    });
  });
});
