import { safeGetKmsOnChainDetail } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import { printTable } from "@/src/lib/table";
import { logger } from "@/src/utils/logger";
import {
	kmsChainCommandMeta,
	kmsChainCommandSchema,
	type KmsChainCommandInput,
} from "./command";

function createChainHandler(chain: string) {
	return async function runKmsChainCommand(
		input: KmsChainCommandInput,
		context: CommandContext,
	): Promise<number> {
		try {
			const client = await getClient(context);

			const result = await safeGetKmsOnChainDetail(client, {
				chain,
			});

			if (!result.success) {
				context.fail(result.error.message);
				return 1;
			}

			const data = result.data;

			if (input.json) {
				context.success(data);
				return 0;
			}

			if (data.contracts.length === 0) {
				logger.info(`No KMS contracts found on ${chain}`);
				return 0;
			}

			for (const contract of data.contracts) {
				logger.info(
					`Contract: ${contract.contract_address} (${contract.chain_name})`,
				);
				logger.break();

				// Devices table
				if (contract.devices.length > 0) {
					logger.info("Devices:");
					const deviceColumns = ["DEVICE_ID", "NODE"] as const;
					const deviceRows = contract.devices.map((d) => ({
						DEVICE_ID: d.device_id,
						NODE:
							typeof d.node_name === "string" && d.node_name.length > 0
								? d.node_name
								: "-",
					}));
					printTable(deviceColumns, deviceRows);
				} else {
					logger.info("Devices: none");
				}

				logger.break();

				// OS Images table
				if (contract.os_images.length > 0) {
					logger.info("OS Images:");
					const imageColumns = ["NAME", "VERSION", "OS_IMAGE_HASH"] as const;
					const imageRows = contract.os_images.map((img) => ({
						NAME: img.name,
						VERSION: img.version,
						OS_IMAGE_HASH: img.os_image_hash ?? "-",
					}));
					printTable(imageColumns, imageRows);
				} else {
					logger.info("OS Images: none");
				}

				logger.break();
			}

			return 0;
		} catch (error) {
			logger.logDetailedError(error);
			context.fail(
				`Failed to get KMS details for ${chain}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			return 1;
		}
	};
}

export const kmsEthereumCommand = defineCommand({
	path: ["kms", "ethereum"],
	meta: kmsChainCommandMeta("ethereum"),
	schema: kmsChainCommandSchema,
	handler: createChainHandler("ethereum"),
});

export const kmsBaseCommand = defineCommand({
	path: ["kms", "base"],
	meta: kmsChainCommandMeta("base"),
	schema: kmsChainCommandSchema,
	handler: createChainHandler("base"),
});
