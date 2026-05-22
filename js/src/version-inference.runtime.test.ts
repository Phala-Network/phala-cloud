/**
 * Runtime tests for versioned API client schema validation
 *
 * These tests verify that the correct schema is used based on API version.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient } from "./create-client";
import { PaginatedCvmInfosV20251028Schema } from "./types/cvm_info_v20251028";
import { PaginatedCvmInfosV20260121Schema } from "./types/cvm_info_v20260121";
import { CvmDetailV20251028Schema } from "./types/cvm_info_v20251028";
import { CvmInfoDetailV20260121Schema } from "./types/cvm_info_v20260121";

// Sample v20251028 CVM list response
const mockCvmListV20251028 = {
  items: [
    {
      hosted: {
        id: "test-id",
        name: "test-cvm",
        status: "running",
        uptime: "1h",
        app_url: null,
        app_id: "app-123",
        instance_id: null,
        exited_at: null,
        boot_progress: null,
        boot_error: null,
        shutdown_progress: null,
        image_version: null,
      },
      name: "test-cvm",
      managed_user: null,
      node: {
        id: 1,
        name: "node-1",
        region_identifier: "us-east-1",
      },
      listed: false,
      status: "running",
      in_progress: false,
      dapp_dashboard_url: null,
      syslog_endpoint: null,
      allow_upgrade: false,
      project_id: null,
      project_type: null,
      billing_period: null,
      kms_info: null,
      vcpu: 2,
      memory: 4096,
      disk_size: 100,
      gateway_domain: null,
      public_urls: [],
    },
  ],
  total: 1,
  page: 1,
  page_size: 10,
  pages: 1,
};

// Sample v20260121 CVM list response
const mockCvmListV20260121 = {
  items: [
    {
      id: 123,
      name: "test-cvm",
      app_id: "app-123",
      vm_uuid: null,
      resource: {
        instance_type: "standard",
        vcpu: 2,
        memory_in_gb: 4,
        disk_in_gb: 100,
        gpus: 0,
        compute_billing_price: null,
        billing_period: null,
      },
      node_info: {
        object_type: "node",
        name: "node-1",
        region: "us-east-1",
        device_id: null,
        status: "active",
        version: null,
      },
      os: null,
      kms_type: null,
      kms_info: null,
      status: "running",
      progress: null,
      compose_hash: null,
      gateway: {
        base_domain: null,
        cname: null,
      },
      services: [],
      endpoints: [],
    },
  ],
  total: 1,
  page: 1,
  page_size: 10,
  pages: 1,
};

// Sample v20251028 CVM detail response
const mockCvmDetailV20251028 = {
  id: 123,
  name: "test-cvm",
  status: "running",
  in_progress: false,
  teepod_id: 1,
  teepod: {
    id: 1,
    name: "teepod-1",
    region_identifier: "us-east-1",
  },
  app_id: "app-123",
  vm_uuid: null,
  instance_id: null,
  vcpu: 2,
  memory: 4096,
  disk_size: 100,
  base_image: null,
  encrypted_env_pubkey: null,
  listed: false,
  project_id: null,
  project_type: null,
  instance_type: null,
  public_sysinfo: false,
  public_logs: false,
  dapp_dashboard_url: null,
  syslog_endpoint: null,
  kms_info: null,
  contract_address: null,
  deployer_address: null,
  scheduled_delete_at: null,
  public_urls: [],
  gateway_domain: null,
  machine_info: null,
  updated_at: null,
};

// Sample v20260121 CVM detail response
const mockCvmDetailV20260121 = {
  ...mockCvmListV20260121.items[0],
  compose_file: null,
};

describe("version-based schema validation", () => {
  describe("schema validation for v20251028", () => {
    it("should validate v20251028 CVM list response", () => {
      const result = PaginatedCvmInfosV20251028Schema.safeParse(mockCvmListV20251028);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items[0].node?.region_identifier).toBe("us-east-1");
      }
    });

    it("should validate v20251028 CVM detail response", () => {
      const result = CvmDetailV20251028Schema.safeParse(mockCvmDetailV20251028);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.teepod?.region_identifier).toBe("us-east-1");
      }
    });

    it("should reject v20260121 format with v20251028 schema", () => {
      const result = PaginatedCvmInfosV20251028Schema.safeParse(mockCvmListV20260121);
      expect(result.success).toBe(false);
    });
  });

  describe("schema validation for v20260121", () => {
    it("should validate v20260121 CVM list response", () => {
      const result = PaginatedCvmInfosV20260121Schema.safeParse(mockCvmListV20260121);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items[0].node_info?.region).toBe("us-east-1");
      }
    });

    it("should validate v20260121 CVM detail response", () => {
      const result = CvmInfoDetailV20260121Schema.safeParse(mockCvmDetailV20260121);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.node_info?.region).toBe("us-east-1");
      }
    });

    it("should reject v20251028 format with v20260121 schema", () => {
      const result = PaginatedCvmInfosV20260121Schema.safeParse(mockCvmListV20251028);
      expect(result.success).toBe(false);
    });
  });

  describe("client version configuration", () => {
    it("should default to 2026-05-22 version", () => {
      const client = createClient({ apiKey: "test" });
      expect(client.config.version).toBe("2026-05-22");
    });

    it("should use specified version 2025-10-28", () => {
      const client = createClient({ apiKey: "test", version: "2025-10-28" });
      expect(client.config.version).toBe("2025-10-28");
    });

    it("should use specified version 2026-01-21", () => {
      const client = createClient({ apiKey: "test", version: "2026-01-21" });
      expect(client.config.version).toBe("2026-01-21");
    });

    it("should use specified version 2026-05-22", () => {
      const client = createClient({ apiKey: "test", version: "2026-05-22" });
      expect(client.config.version).toBe("2026-05-22");
    });
  });
});
