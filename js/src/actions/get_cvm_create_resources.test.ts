import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Client } from "../client";
import {
	getCvmCreateResources,
	safeGetCvmCreateResources,
	type CvmCreateResourceGraph,
} from "./get_cvm_create_resources";

const mockResourceGraph: CvmCreateResourceGraph = {
	tier: "free",
	capacity: {
		max_instances: 16,
		max_vcpu: 16,
		max_memory: 32768,
		max_disk: 640,
	},
	nodes: [
		{
			teepod_id: 11,
			name: "public-node",
			listed: true,
			resource_score: 1,
			remaining_vcpu: 8,
			remaining_memory: 16384,
			remaining_cvm_slots: 4,
			images: [
				{
					name: "dstack-0.5.0",
					is_dev: false,
					version: [0, 5, 0],
					os_image_hash: "0ximage",
				},
			],
			kms_list: ["kms-base"],
		},
	],
	kms_nodes: [
		{
			id: 201,
			slug: "kms-base",
			url: "https://kms-base.example.com",
			version: "0.5.0",
			kms_type: "BASE",
			chain_id: 8453,
			kms_contract_id: 301,
			kms_contract_address: "0xbase",
			gateway_app_id: "0xgateway",
			supported_os_images: ["dstack-0.5.0"],
		},
		{
			id: "kms-eth",
			slug: "kms-eth",
			url: "https://kms-eth.example.com",
			version: "0.5.0",
			kms_type: "ETHEREUM",
			chain_id: 1,
			kms_contract_id: "302",
			kms_contract_address: "0xeth",
			gateway_app_id: null,
			supported_os_images: [],
		},
	],
	node_kms_relations: [
		{
			teepod_id: 11,
			kms_id: 201,
			kms_type: "BASE",
			kms_contract_id: 301,
			kms_contract_address: "0xbase",
			supported_os_images: ["dstack-0.5.0"],
		},
	],
	gateway_nodes: [
		{
			id: 401,
			teepod_id: 11,
			kms_contract_id: 301,
			rpc_url: "https://gateway.example.com/rpc",
			domain_suffix: "example.app",
			enabled: true,
		},
	],
	instance_types: [
		{
			id: "tdx.small",
			name: "TDX Small",
			vcpu: 2,
			memory_mb: 4096,
			default_disk_size_gb: 40,
			requires_gpu: false,
			requires_gpu_count: 0,
			family: "cpu",
			display_order: 1,
		},
	],
	gpu_availability: {
		has_reserved_gpus: false,
		reserved_gpu_count: 0,
		has_public_gpus: true,
		public_gpu_count: 1,
	},
};

describe("getCvmCreateResources", () => {
	let mockClient: Client;

	beforeEach(() => {
		vi.clearAllMocks();
		mockClient = {
			get: vi.fn(),
			safeGet: vi.fn(),
		} as unknown as Client;
	});

	it("calls the CVM create resource graph endpoint", async () => {
		(mockClient.get as jest.Mock).mockResolvedValueOnce(mockResourceGraph);

		const result = await getCvmCreateResources(mockClient);

		expect(mockClient.get).toHaveBeenCalledWith(
			"/teepods/cvm-create-resources",
		);
		expect(result.kms_nodes[0].kms_contract_id).toBe(301);
		expect(result.gateway_nodes[0].domain_suffix).toBe("example.app");
	});

	it("parses string and numeric resource IDs", async () => {
		(mockClient.get as jest.Mock).mockResolvedValueOnce(mockResourceGraph);

		const result = await getCvmCreateResources(mockClient);

		expect(result.kms_nodes.map((kms) => kms.id)).toEqual([201, "kms-eth"]);
		expect(result.kms_nodes.map((kms) => kms.kms_contract_id)).toEqual([
			301,
			"302",
		]);
	});

	it("returns SafeResult on success", async () => {
		(mockClient.get as jest.Mock).mockResolvedValueOnce(mockResourceGraph);

		const result = await safeGetCvmCreateResources(mockClient);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.instance_types[0].id).toBe("tdx.small");
		}
	});
});
