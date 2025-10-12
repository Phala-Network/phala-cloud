import { safeGetAvailableNodes } from "@phala/cloud";
import { getClient } from "@/src/lib/client";
import { getTeepods } from "@/src/api/teepods";
import type { KmsListItem, TEEPod } from "@/src/api/types";
import { logDetailedError } from "@/src/utils/error-handling";
import { logger } from "@/src/utils/logger";
import type { AvailableNodesResponse } from "@/src/api/types";

export async function listNodes() {
	try {
		const client = await getClient();
		const result = await safeGetAvailableNodes(client);

		if (!result.success) {
			throw new Error(result.error.message);
		}

		const { nodes: teepods, kms_list: kmsList } =
			result.data as AvailableNodesResponse;

		if (teepods.length === 0) {
			logger.info("No available nodes found.");
			return;
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
				logger.info(`  Slug:               ${kms.slug}`);
				logger.info(`  URL:                ${kms.url}`);
				logger.info(`  Version:            ${kms.version}`);
				if (kms.chain_id) {
					logger.info(`  Chain ID:           ${kms.chain_id}`);
					logger.info(`  Contract Address:   ${kms.kms_contract_address}`);
					logger.info(`  Gateway App ID:     ${kms.gateway_app_id}`);
				}
			}
		}
	} catch (error) {
		logger.error("Failed to list available nodes");
		logDetailedError(error);
		throw error;
	}
}
