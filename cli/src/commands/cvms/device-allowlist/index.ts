import chalk from "chalk";
import { safeGetCvmInfo, safeGetAppDeviceAllowlist } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import { printTable } from "@/src/lib/table";
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
		const client = await getClient(context);

		const infoResult = await safeGetCvmInfo(client, context.cvmId);
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
		if (!appId) {
			context.fail("CVM has no app_id assigned yet.");
			return 1;
		}

		const result = await safeGetAppDeviceAllowlist(client, { appId });
		if (!result.success) {
			context.fail(result.error.message);
			return 1;
		}

		const allowlist = result.data;

		if (input.json) {
			context.success(allowlist);
			return 0;
		}

		if (!allowlist.is_onchain_kms) {
			logger.info("This app does not use on-chain KMS.");
			return 0;
		}

		logger.info(
			`Chain: ${allowlist.chain_id ?? "N/A"}  Contract: ${allowlist.app_contract_address ?? "N/A"}`,
		);
		logger.info(
			`Allow Any Device: ${allowlist.allow_any_device ? chalk.green("yes") : chalk.red("no")}`,
		);

		if (allowlist.devices.length === 0) {
			logger.info("No devices found for this app.");
			return 0;
		}

		const columns = ["DEVICE_ID", "NODE", "CVMS", "STATUS"] as const;
		const rows = allowlist.devices.map((d) => ({
			DEVICE_ID: d.device_id,
			NODE: d.node_name ?? "-",
			CVMS: d.cvm_ids.join(", ") || "-",
			STATUS:
				d.status === "allowed" ? chalk.green(d.status) : chalk.red(d.status),
		}));

		printTable(columns, rows);

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
