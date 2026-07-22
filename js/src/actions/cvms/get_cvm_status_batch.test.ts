import { describe, it, expect } from "vitest";
import {
  CvmStatusSchema,
  CvmResourceUsageSchema,
  GetCvmStatusBatchResponseSchema,
} from "./get_cvm_status_batch";

describe("CvmStatusSchema", () => {
  it("should parse response with resource_usage and events", () => {
    const fixture = {
      vm_uuid: "abc-123",
      status: "running",
      in_progress: false,
      uptime: "2h30m",
      events: [
        { event: "boot", body: "kernel loaded", timestamp: 1690000000 },
      ],
      resource_usage: {
        cpu_percent: 45.2,
        memory_used_bytes: 2147483648,
        memory_total_bytes: 4294967296,
        egress_bytes: 1048576,
      },
    };

    const result = CvmStatusSchema.parse(fixture);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].event).toBe("boot");
    expect(result.events[0].body).toBe("kernel loaded");
    expect(result.events[0].timestamp).toBe(1690000000);
    expect(result.resource_usage).toBeDefined();
    expect(result.resource_usage!.cpu_percent).toBe(45.2);
    expect(result.resource_usage!.memory_used_bytes).toBe(2147483648);
    expect(result.resource_usage!.memory_total_bytes).toBe(4294967296);
    expect(result.resource_usage!.egress_bytes).toBe(1048576);
  });

  it("should parse response without events (defaults to empty array)", () => {
    const fixture = {
      vm_uuid: "abc-123",
      status: "running",
      in_progress: false,
    };

    const result = CvmStatusSchema.parse(fixture);
    expect(result.events).toEqual([]);
  });

  it("should parse resource_usage as null", () => {
    const fixture = {
      vm_uuid: "abc-123",
      status: "offline",
      in_progress: false,
      resource_usage: null,
    };

    const result = CvmStatusSchema.parse(fixture);
    expect(result.resource_usage).toBeNull();
  });

  it("should parse resource_usage with partial null fields", () => {
    const fixture = {
      vm_uuid: "abc-123",
      status: "running",
      in_progress: false,
      resource_usage: {
        cpu_percent: 10.0,
        memory_used_bytes: null,
        memory_total_bytes: 4294967296,
        egress_bytes: null,
      },
    };

    const result = CvmStatusSchema.parse(fixture);
    expect(result.resource_usage!.cpu_percent).toBe(10.0);
    expect(result.resource_usage!.memory_used_bytes).toBeNull();
    expect(result.resource_usage!.egress_bytes).toBeNull();
  });

  it("should drop unknown fields (forward-compatibility)", () => {
    const fixture = {
      vm_uuid: "abc-123",
      status: "running",
      in_progress: false,
      future_field: "should be ignored",
      resource_usage: {
        cpu_percent: 5.0,
        memory_used_bytes: 1024,
        memory_total_bytes: 2048,
        egress_bytes: 0,
        gpu_percent: 99.0,
      },
    };

    const result = CvmStatusSchema.parse(fixture);
    expect(result.vm_uuid).toBe("abc-123");
    expect((result as Record<string, unknown>).future_field).toBeUndefined();
    expect(
      (result.resource_usage as Record<string, unknown>).gpu_percent,
    ).toBeUndefined();
  });
});

describe("CvmResourceUsageSchema", () => {
  it("should parse fully populated resource usage", () => {
    const fixture = {
      cpu_percent: 75.5,
      memory_used_bytes: 8589934592,
      memory_total_bytes: 17179869184,
      egress_bytes: 104857600,
    };

    const result = CvmResourceUsageSchema.parse(fixture);
    expect(result.cpu_percent).toBe(75.5);
    expect(result.memory_used_bytes).toBe(8589934592);
    expect(result.memory_total_bytes).toBe(17179869184);
    expect(result.egress_bytes).toBe(104857600);
  });
});

describe("GetCvmStatusBatchResponseSchema", () => {
  it("should parse batch response with mixed statuses", () => {
    const fixture = {
      "uuid-1": {
        vm_uuid: "uuid-1",
        status: "running",
        in_progress: false,
        resource_usage: {
          cpu_percent: 20.0,
          memory_used_bytes: 1073741824,
          memory_total_bytes: 2147483648,
          egress_bytes: 512000,
        },
        events: [
          { event: "start", body: "vm started", timestamp: 1690000000 },
        ],
      },
      "uuid-2": {
        vm_uuid: "uuid-2",
        status: "maintenance",
        in_progress: false,
        resource_usage: null,
        events: [],
      },
    };

    const result = GetCvmStatusBatchResponseSchema.parse(fixture);
    expect(Object.keys(result)).toHaveLength(2);
    expect(result["uuid-1"].resource_usage!.cpu_percent).toBe(20.0);
    expect(result["uuid-1"].events).toHaveLength(1);
    expect(result["uuid-2"].resource_usage).toBeNull();
  });
});
