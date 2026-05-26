/**
 * Runtime tests for versioned API client schema validation
 *
 * These tests verify that the correct schema is used based on API version.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient } from "./create-client";
import {
  AppCvmsBatchIsAllowedResponseSchema,
  AppCvmsBatchIsAllowedResponseV20260121Schema,
  AppCvmsBatchIsAllowedResponseV20260522Schema,
} from "./actions/apps/check_app_cvms_is_allowed";
import {
  DeviceAllowlistResponseAnySchema,
  DeviceAllowlistResponseV20260121Schema,
  DeviceAllowlistResponseV20260522Schema,
} from "./actions/apps/get_app_device_allowlist";
import {
  CommitCvmProvisionSchema,
  CommitCvmProvisionV20260121Schema,
  CommitCvmProvisionV20260522Schema,
} from "./actions/cvms/commit_cvm_provision";
import {
  IsAllowedResultSchema,
  IsAllowedResultV20260121Schema,
  IsAllowedResultV20260522Schema,
} from "./actions/cvms/check_cvm_is_allowed";
import {
  InstanceIdRefreshResultSchema,
  InstanceIdRefreshResultV20260121Schema,
  InstanceIdRefreshResultV20260522Schema,
} from "./actions/cvms/refresh_cvm_instance_id";
import {
  RefreshCvmInstanceIdsResponseSchema,
  RefreshCvmInstanceIdsResponseV20260121Schema,
  RefreshCvmInstanceIdsResponseV20260522Schema,
} from "./actions/cvms/refresh_cvm_instance_ids";
import { DstackAppFullResponseV20260121Schema } from "./types/app_info_v20260121";
import {
  CvmDetailV20251028Schema,
  CvmInfoV20251028Schema,
  PaginatedCvmInfosV20251028Schema,
} from "./types/cvm_info_v20251028";
import {
  CvmInfoDetailV20260121Schema,
  CvmInfoV20260121Schema,
  CvmInfoV20260522Schema,
  PaginatedCvmInfosV20260121Schema,
  PaginatedCvmInfosV20260522Schema,
} from "./types/cvm_info_v20260121";
import {
  VMSchema,
  VMV20260121Schema,
  VMV20260522Schema,
} from "./types/cvm_info";

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
      id: "cvm_ykL5lbAn",
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
      in_progress: false,
      progress: null,
      compose_hash: null,
      docker_compose_hash: null,
      pre_launch_script_hash: null,
      gateway: {
        base_domain: null,
        cname: null,
      },
      logs: {
        serial: null,
        stdout: null,
        stderr: null,
        container_log_base: null,
      },
      services: [],
      endpoints: [],
      project_type: null,
      created_at: null,
      deleted_at: null,
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

const mockCvmListV20260522 = {
  ...mockCvmListV20260121,
  items: [{ ...mockCvmListV20260121.items[0] }],
};

const mockCvmDetailV20260522 = {
  ...mockCvmListV20260522.items[0],
  compose_file: null,
};

const mockAppFullV20260121 = {
  id: "04b927aa4ea8c9554ee9858538f181517714dbd2",
  name: "test-app",
  app_id: "app-123",
  app_provision_type: null,
  app_icon_url: null,
  created_at: "2026-05-22T00:00:00Z",
  kms_type: "phala",
  profile: null,
  current_cvm: mockCvmListV20260121.items[0],
  cvms: [mockCvmListV20260121.items[0]],
  cvm_count: 1,
};

const mockIsAllowedResult = {
  cvm_id: "cvm_ykL5lbAn",
  app_contract_address: "0x123",
  compose_hash: "compose-hash",
  device_id: "dev-1",
  compose_hash_allowed: true,
  allow_any_device: false,
  device_id_allowed: true,
  is_allowed: true,
  error: null,
};

const mockInstanceRefreshResult = {
  cvm_id: "cvm_ykL5lbAn",
  identifier: "cvm_ykL5lbAn",
  status: "updated",
  old_instance_id: null,
  new_instance_id: "inst-1",
  source: "teepod_state",
  verified_with_gateway: false,
  reason: null,
};

const mockBatchRefreshResult = {
  total: 1,
  scanned: 1,
  updated: 1,
  unchanged: 0,
  skipped: 0,
  conflicts: 0,
  errors: 0,
  items: [mockInstanceRefreshResult],
};

describe("version-based schema validation", () => {
  describe("schema validation for v20251028", () => {
    it("should validate v20251028 CVM list response", () => {
      const result =
        PaginatedCvmInfosV20251028Schema.safeParse(mockCvmListV20251028);
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

    it("should validate versioned table IDs in v20251028 CVM mutation responses", () => {
      const result = CvmDetailV20251028Schema.safeParse({
        ...mockCvmDetailV20251028,
        id: "cvm_ykL5lbAn",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe("cvm_ykL5lbAn");
      }
    });

    it("should reject v20260121 format with v20251028 schema", () => {
      const result =
        PaginatedCvmInfosV20251028Schema.safeParse(mockCvmListV20260121);
      expect(result.success).toBe(false);
    });
  });

  describe("schema validation for v20260121", () => {
    it("should validate v20260121 CVM list response", () => {
      const result =
        PaginatedCvmInfosV20260121Schema.safeParse(mockCvmListV20260121);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items[0].node_info?.region).toBe("us-east-1");
      }
    });

    it("should validate v20260121 CVM detail response", () => {
      const result = CvmInfoDetailV20260121Schema.safeParse(
        mockCvmDetailV20260121,
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.node_info?.region).toBe("us-east-1");
      }
    });

    it("should validate v20260121 app detail response with hashid CVM IDs", () => {
      const result =
        DstackAppFullResponseV20260121Schema.safeParse(mockAppFullV20260121);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.current_cvm?.id).toBe("cvm_ykL5lbAn");
      }
    });

    it("should reject v20251028 format with v20260121 schema", () => {
      const result =
        PaginatedCvmInfosV20260121Schema.safeParse(mockCvmListV20251028);
      expect(result.success).toBe(false);
    });
  });

  describe("CVM hashid schema compatibility", () => {
    it("uses hashed CVM IDs in 2026-01-21 CVMInfo schemas", () => {
      expect(
        CvmInfoV20260121Schema.safeParse(mockCvmListV20260121.items[0]).success,
      ).toBe(true);
      expect(
        PaginatedCvmInfosV20260121Schema.safeParse(mockCvmListV20260121)
          .success,
      ).toBe(true);
      expect(
        CvmInfoDetailV20260121Schema.safeParse(mockCvmDetailV20260121).success,
      ).toBe(true);
      expect(
        VMV20260121Schema.safeParse({
          ...mockCvmDetailV20251028,
          created_at: "2026-05-22T00:00:00Z",
        }).success,
      ).toBe(true);
    });

    it("uses versioned managed user IDs in v20251028 hosted CVM schemas", () => {
      expect(
        CvmInfoV20251028Schema.safeParse({
          ...mockCvmListV20251028.items[0],
          managed_user: {
            id: "usr_ykL5lbAn",
            username: "test-user",
          },
        }).success,
      ).toBe(true);
    });

    it("uses hashed CVM IDs in 2026-05-22 and default schemas", () => {
      expect(
        CvmInfoV20260522Schema.safeParse(mockCvmListV20260522.items[0]).success,
      ).toBe(true);
      expect(
        PaginatedCvmInfosV20260522Schema.safeParse(mockCvmListV20260522)
          .success,
      ).toBe(true);
      expect(
        VMV20260522Schema.safeParse({
          ...mockCvmDetailV20251028,
          id: "cvm_ykL5lbAn",
          created_at: "2026-05-22T00:00:00Z",
        }).success,
      ).toBe(true);
      expect(
        VMSchema.safeParse({
          ...mockCvmDetailV20251028,
          id: "cvm_ykL5lbAn",
          created_at: "2026-05-22T00:00:00Z",
        }).success,
      ).toBe(true);
    });

    it("rejects numeric CVM IDs in CVMInfo hashid schemas", () => {
      const numericCvmInfo = { ...mockCvmListV20260121.items[0], id: 123 };
      const numericCvmList = {
        ...mockCvmListV20260121,
        items: [numericCvmInfo],
      };

      expect(CvmInfoV20260121Schema.safeParse(numericCvmInfo).success).toBe(
        false,
      );
      expect(
        PaginatedCvmInfosV20260121Schema.safeParse(numericCvmList).success,
      ).toBe(false);
      expect(CvmInfoV20260522Schema.safeParse(numericCvmInfo).success).toBe(
        false,
      );
      expect(
        PaginatedCvmInfosV20260522Schema.safeParse(numericCvmList).success,
      ).toBe(false);
      expect(CommitCvmProvisionSchema.safeParse({ id: 123 }).success).toBe(
        false,
      );
      expect(
        IsAllowedResultSchema.safeParse({ ...mockIsAllowedResult, cvm_id: 123 })
          .success,
      ).toBe(false);
      expect(
        InstanceIdRefreshResultSchema.safeParse({
          ...mockInstanceRefreshResult,
          cvm_id: 123,
        }).success,
      ).toBe(false);
    });
  });

  describe("action response hashid compatibility", () => {
    const commitBase = {
      id: "cvm_ykL5lbAn",
      name: "test-cvm",
      status: "running",
      teepod_id: 1,
      app_id: "app-123",
      vm_uuid: null,
      instance_id: null,
      teepod: null,
      user_id: null,
      base_image: null,
      vcpu: 2,
      memory: 4096,
      disk_size: 100,
      docker_compose_file: null,
      created_at: "2026-05-22T00:00:00Z",
      encrypted_env_pubkey: null,
    };

    it("validates commit and lifecycle response versions", () => {
      expect(
        CommitCvmProvisionV20260121Schema.safeParse({ ...commitBase, id: 123 })
          .success,
      ).toBe(true);
      expect(
        CommitCvmProvisionV20260522Schema.safeParse(commitBase).success,
      ).toBe(true);
      expect(CommitCvmProvisionSchema.safeParse(commitBase).success).toBe(true);
    });

    it("validates allowance response versions", () => {
      expect(
        IsAllowedResultV20260121Schema.safeParse({
          ...mockIsAllowedResult,
          cvm_id: 123,
        }).success,
      ).toBe(true);
      expect(
        IsAllowedResultV20260522Schema.safeParse(mockIsAllowedResult).success,
      ).toBe(true);
      expect(
        AppCvmsBatchIsAllowedResponseV20260121Schema.safeParse({
          is_onchain: true,
          results: [{ ...mockIsAllowedResult, cvm_id: 123 }],
          skipped_cvm_ids: [456],
        }).success,
      ).toBe(true);
      expect(
        AppCvmsBatchIsAllowedResponseV20260522Schema.safeParse({
          is_onchain: true,
          results: [mockIsAllowedResult],
          skipped_cvm_ids: ["cvm_ykL5lbAn"],
        }).success,
      ).toBe(true);
      expect(
        AppCvmsBatchIsAllowedResponseSchema.safeParse({
          is_onchain: true,
          results: [mockIsAllowedResult],
          skipped_cvm_ids: ["cvm_ykL5lbAn"],
        }).success,
      ).toBe(true);
    });

    it("validates device allowlist response versions", () => {
      const oldResponse = {
        is_onchain_kms: true,
        devices: [
          {
            device_id: "dev-1",
            node_name: "node-1",
            allowed_onchain: true,
            status: "allowed",
            cvm_ids: [123],
          },
        ],
      };
      const newResponse = {
        is_onchain_kms: true,
        devices: [
          {
            device_id: "dev-1",
            node_name: "node-1",
            allowed_onchain: true,
            status: "allowed",
            cvm_ids: ["cvm_ykL5lbAn"],
          },
        ],
      };
      expect(
        DeviceAllowlistResponseV20260121Schema.safeParse(oldResponse).success,
      ).toBe(true);
      expect(
        DeviceAllowlistResponseV20260522Schema.safeParse(newResponse).success,
      ).toBe(true);
      expect(
        DeviceAllowlistResponseAnySchema.safeParse(oldResponse).success,
      ).toBe(true);
      expect(
        DeviceAllowlistResponseAnySchema.safeParse(newResponse).success,
      ).toBe(true);
    });

    it("validates refresh instance ID response versions", () => {
      expect(
        InstanceIdRefreshResultV20260121Schema.safeParse({
          ...mockInstanceRefreshResult,
          cvm_id: 123,
        }).success,
      ).toBe(true);
      expect(
        InstanceIdRefreshResultV20260522Schema.safeParse(
          mockInstanceRefreshResult,
        ).success,
      ).toBe(true);
      expect(
        RefreshCvmInstanceIdsResponseV20260121Schema.safeParse({
          ...mockBatchRefreshResult,
          items: [{ ...mockInstanceRefreshResult, cvm_id: 123 }],
        }).success,
      ).toBe(true);
      expect(
        RefreshCvmInstanceIdsResponseV20260522Schema.safeParse(
          mockBatchRefreshResult,
        ).success,
      ).toBe(true);
      expect(
        RefreshCvmInstanceIdsResponseSchema.safeParse(mockBatchRefreshResult)
          .success,
      ).toBe(true);
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
