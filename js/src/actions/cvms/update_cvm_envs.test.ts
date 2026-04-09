import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateCvmEnvs, safeUpdateCvmEnvs } from "./update_cvm_envs";
import { PhalaCloudError } from "../../utils/errors";
import type { Client } from "../../client";

function make465Error() {
	return new PhalaCloudError("Compose hash registration required", {
		status: 465,
		statusText: "Hash Registration Required",
		detail: {
			error_code: "ERR-01-005",
			message: "Compose hash registration required on-chain",
			details: [
				{ field: "compose_hash", value: "0xhash123" },
				{ field: "app_id", value: "0xapp456" },
				{ field: "device_id", value: "0xdevice789" },
				{
					field: "kms_info",
					value: {
						id: "kms_test",
						slug: "kms-base-prod9",
						url: "https://kms.example.com",
						version: "v0.5.7",
						chain_id: 8453,
						kms_contract_address: "0xkms123",
						gateway_app_id: "0xgateway456",
					},
				},
			],
		},
	});
}

describe("updateCvmEnvs", () => {
	let mockClient: Client;

	beforeEach(() => {
		mockClient = {
			patch: vi.fn(),
		} as unknown as Client;
	});

	it("should return in_progress on success", async () => {
		vi.mocked(mockClient.patch).mockResolvedValue({
			status: "in_progress",
			message: "Update initiated",
			correlation_id: "corr-123",
			allowed_envs_changed: false,
		});

		const result = await updateCvmEnvs(mockClient, {
			id: "test-cvm-id",
			encrypted_env: "encrypted-data",
			env_keys: ["KEY1"],
		});

		expect(result.status).toBe("in_progress");
		if (result.status === "in_progress") {
			expect(result.correlation_id).toBe("corr-123");
		}
	});

	it("should return precondition_required on 465", async () => {
		vi.mocked(mockClient.patch).mockRejectedValue(make465Error());

		const result = await updateCvmEnvs(mockClient, {
			id: "test-cvm-id",
			encrypted_env: "encrypted-data",
			env_keys: ["KEY1"],
		});

		expect(result.status).toBe("precondition_required");
		if (result.status === "precondition_required") {
			expect(result.compose_hash).toBe("0xhash123");
			expect(result.app_id).toBe("0xapp456");
			expect(result.device_id).toBe("0xdevice789");
			expect(result.kms_info).toBeDefined();
		}
	});

	it("should throw on non-465 errors", async () => {
		const error = new PhalaCloudError("Not found", {
			status: 404,
			statusText: "Not Found",
			detail: "CVM not found",
		});
		vi.mocked(mockClient.patch).mockRejectedValue(error);

		await expect(
			updateCvmEnvs(mockClient, {
				id: "test-cvm-id",
				encrypted_env: "encrypted-data",
			}),
		).rejects.toThrow();
	});
});

describe("safeUpdateCvmEnvs", () => {
	let mockClient: Client;

	beforeEach(() => {
		mockClient = {
			patch: vi.fn(),
		} as unknown as Client;
	});

	it("should return success for in_progress result", async () => {
		vi.mocked(mockClient.patch).mockResolvedValue({
			status: "in_progress",
			message: "Update initiated",
			correlation_id: "corr-123",
			allowed_envs_changed: false,
		});

		const result = await safeUpdateCvmEnvs(mockClient, {
			id: "test-cvm-id",
			encrypted_env: "encrypted-data",
		});

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.status).toBe("in_progress");
		}
	});

	it("should return success for 465 precondition_required result", async () => {
		vi.mocked(mockClient.patch).mockRejectedValue(make465Error());

		const result = await safeUpdateCvmEnvs(mockClient, {
			id: "test-cvm-id",
			encrypted_env: "encrypted-data",
		});

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.status).toBe("precondition_required");
		}
	});

	it("should return error for non-465 failures", async () => {
		const error = new PhalaCloudError("Server error", {
			status: 500,
			statusText: "Internal Server Error",
			detail: "Unexpected error",
		});
		vi.mocked(mockClient.patch).mockRejectedValue(error);

		const result = await safeUpdateCvmEnvs(mockClient, {
			id: "test-cvm-id",
			encrypted_env: "encrypted-data",
		});

		expect(result.success).toBe(false);
	});
});
