import chalk from "chalk";
import { safeGetCvmInfo, safeGetAppDeviceAllowlist } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import { logger } from "@/src/utils/logger";
import {
	cvmsDeviceAllowlistCommandMeta,
	cvmsDeviceAllowlistCommandSchema,
	type CvmsDeviceAllowlistCommandInput,
} from "./command";

async function runCvmsDeviceAllowlistCommand(
	input: CvmsDeviceAllowlistCommandInput,
	context: CommandContext,
): Promise<number> {
	if (!context.cvmId) {
		context.fail(
			"No CVM ID provided. Use --interactive to select interactively.",
		);
		return 1;
	}

	try {
		const client = await getClient();

		const spinner = logger.startSpinner("Resolving CVM...");
		const infoResult = await safeGetCvmInfo(client, context.cvmId);
		spinner.stop(true);

		if (!infoResult.success) {
			context.fail(infoResult.error.message);
			return 1;
		}

		const cvm = infoResult.data;
		if (!cvm) {
			context.fail("CVM not found");
			return 1;
		}

		const appId = cvm.app_id;

		const spinner2 = logger.startSpinner(
			`Fetching device allowlist for app_${appId}...`,
		);
		const result = await safeGetAppDeviceAllowlist(client, { appId });
		spinner2.stop(true);

		if (!result.success) {
			context.fail(result.error.message);
			return 1;
		}

		const allowlist = result.data;

		if (input.json) {
			context.success(allowlist);
			return 0;
		}

		logger.break();

		if (!allowlist.is_onchain_kms) {
			logger.info("This app does not use on-chain KMS.");
			return 0;
		}

		logger.keyValueTable({
			"On-chain KMS": chalk.green("Yes"),
			"Chain ID": allowlist.chain_id ?? "N/A",
			"App Contract": allowlist.app_contract_address ?? "N/A",
			"Allow Any Device":
				allowlist.allow_any_device === true
					? chalk.green("Yes")
					: chalk.red("No"),
		});

		if (allowlist.devices.length === 0) {
			logger.info("\nNo devices found for this app.");
			return 0;
		}

		logger.break();
		logger.info("Devices:");
		logger.break();

		for (const device of allowlist.devices) {
			const statusColor =
				device.status === "allowed"
					? chalk.green(device.status)
					: chalk.red(device.status);
			logger.keyValueTable({
				"Device ID": device.device_id,
				Node: device.node_name ?? "N/A",
				CVMs: device.cvm_ids.join(", ") || "none",
				Status: statusColor,
			});
			logger.break();
		}

		return 0;
	} catch (error) {
		logger.logDetailedError(error);
		context.fail(
			`Failed to get device allowlist: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
		return 1;
	}
}

export const cvmsDeviceAllowlistCommand = defineCommand({
	path: ["cvms", "device-allowlist"],
	meta: cvmsDeviceAllowlistCommandMeta,
	schema: cvmsDeviceAllowlistCommandSchema,
	handler: runCvmsDeviceAllowlistCommand,
});

export default cvmsDeviceAllowlistCommand;
