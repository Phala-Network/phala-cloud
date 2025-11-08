import { safeGetAvailableNodes } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import type { AvailableNodesResponse } from "@/src/api/types";
import { getClient } from "@/src/lib/client";

import { logger } from "@/src/utils/logger";
import {
	cvmsListNodesCommandMeta,
	cvmsListNodesCommandSchema,
	type CvmsListNodesCommandInput,
} from "./command";

async function runCvmsListNodesCommand(
	_input: CvmsListNodesCommandInput,
	_context: CommandContext,
): Promise<number> {
	try {
		const client = await getClient();
		const result = await safeGetAvailableNodes(client);

		if (!result.success) {
			throw new Error(result.error.message);
		}

		const { nodes: teepods, kms_list: kmsList } =
			result.data as AvailableNodesResponse;

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
				logger.info(`  Chain ID:           ${kms.chain_id}`);
				logger.info(`  Contract Address:   ${kms.kms_contract_address}`);
				logger.info(`  Gateway App ID:     ${kms.gateway_app_id}`);
			}
		}

		return 0;
	} catch (error) {
		logger.error("Failed to list available nodes");
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
