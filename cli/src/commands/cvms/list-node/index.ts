import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import type { CvmCreateResourcesResponse } from "@/src/api/types";
import { getClient } from "@/src/lib/client";

import { logger } from "@/src/utils/logger";
import {
	cvmsListNodesCommandMeta,
	cvmsListNodesCommandSchema,
	type CvmsListNodesCommandInput,
} from "./command";

async function runCvmsListNodesCommand(
	_input: CvmsListNodesCommandInput,
	context: CommandContext,
): Promise<number> {
	try {
		const client = await getClient(context);
		const isJson = context.globalOptions?.json === true;
		const result = await client.get<CvmCreateResourcesResponse>(
			"teepods/cvm-create-resources",
		);

		const {
			nodes: teepods,
			kms_nodes: kmsList,
			gateway_nodes: gatewayNodes,
			instance_types: instanceTypes,
		} = result;

		if (isJson) {
			context.success({
				nodes: teepods ?? [],
				kmsList: kmsList ?? [],
				gatewayNodes: gatewayNodes ?? [],
				instanceTypes: instanceTypes ?? [],
			});
			return 0;
		}

		if (!teepods || teepods.length === 0) {
			logger.info("No available nodes found.");
			return 0;
		}

		logger.info("Available Nodes:");
		for (const teepod of teepods) {
			logger.info("----------------------------------------");
			logger.info(`  ID:          ${teepod.teepod_id}`);
			logger.info(`  Name:        ${teepod.name}`);
			logger.info(`  Region:      ${teepod.region_identifier}`);
			logger.info(`  FMSPC:       ${teepod.fmspc || "N/A"}`);
			logger.info(`  Device ID:   ${teepod.device_id || "N/A"}`);
			logger.info(`  Support Onchain KMS: ${teepod.support_onchain_kms}`);
			logger.info("  Images:");
			if (teepod.images && teepod.images.length > 0) {
				for (const img of teepod.images) {
					logger.info(`    - ${img.name}`);
					logger.info(`      Hash: ${img.os_image_hash || "N/A"}`);
				}
			} else {
				logger.info("    N/A");
			}
		}

		if (kmsList && kmsList.length > 0) {
			logger.info("\nAvailable KMS Instances:");
			for (const kms of kmsList) {
				logger.info("----------------------------------------");
				logger.info(`  ID:                 ${kms.id}`);
				logger.info(`  URL:                ${kms.url}`);
				logger.info(`  Version:            ${kms.version}`);
				logger.info(`  KMS Type:           ${kms.kms_type}`);
				logger.info(`  Chain ID:           ${kms.chain_id}`);
				logger.info(`  Contract ID:        ${kms.kms_contract_id}`);
				logger.info(`  Contract Address:   ${kms.kms_contract_address}`);
				logger.info(`  Gateway App ID:     ${kms.gateway_app_id}`);
			}
		}

		if (gatewayNodes && gatewayNodes.length > 0) {
			logger.info("\nAvailable Gateways:");
			for (const gateway of gatewayNodes) {
				logger.info("----------------------------------------");
				logger.info(`  ID:                 ${gateway.id}`);
				logger.info(`  TEEPod ID:          ${gateway.teepod_id ?? "N/A"}`);
				logger.info(`  Contract ID:        ${gateway.kms_contract_id}`);
				logger.info(`  RPC URL:            ${gateway.rpc_url ?? "N/A"}`);
				logger.info(`  Domain Suffix:      ${gateway.domain_suffix ?? "N/A"}`);
			}
		}

		if (instanceTypes && instanceTypes.length > 0) {
			logger.info("\nAvailable Instance Types:");
			for (const instanceType of instanceTypes) {
				logger.info("----------------------------------------");
				logger.info(`  ID:                 ${instanceType.id}`);
				logger.info(`  Name:               ${instanceType.name}`);
				logger.info(`  vCPU:               ${instanceType.vcpu}`);
				logger.info(`  Memory MB:          ${instanceType.memory_mb}`);
				logger.info(
					`  Default Disk GB:    ${instanceType.default_disk_size_gb}`,
				);
				logger.info(`  Requires GPU:       ${instanceType.requires_gpu}`);
			}
		}

		return 0;
	} catch (error) {
		context.fail("Failed to list available nodes");
		logger.logDetailedError(error);
		return 1;
	}
}

export const cvmsListNodesCommand = defineCommand({
	path: ["cvms", "list-nodes"],
	meta: cvmsListNodesCommandMeta,
	schema: cvmsListNodesCommandSchema,
	handler: runCvmsListNodesCommand,
});

export default cvmsListNodesCommand;
