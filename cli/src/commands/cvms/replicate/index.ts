import fs from "node:fs";
import path from "node:path";
import { CvmIdSchema, safeGetCvmInfo, encryptEnvVars } from "@phala/cloud";
import { replicateCvm } from "@/src/api/cvms";
import { getClient } from "@/src/lib/client";
import { getEncryptPubkey } from "@/src/commands/envs/get-encrypt-pubkey";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";

import { logger } from "@/src/utils/logger";
import {
	cvmsReplicateCommandMeta,
	cvmsReplicateCommandSchema,
	type CvmsReplicateCommandInput,
} from "./command";

function parseEnvFile(filePath: string): { key: string; value: string }[] {
	const envContent = fs.readFileSync(filePath, "utf-8");
	return envContent
		.split("\n")
		.filter((line) => line.trim() !== "" && !line.trim().startsWith("#"))
		.map((line) => {
			const [key, ...value] = line.split("=");
			return {
				key: key.trim(),
				value: value.join("=").trim(),
			};
		});
}

async function runCvmsReplicateCommand(
	input: CvmsReplicateCommandInput,
	context: CommandContext,
): Promise<number> {
	try {
		if (!context.cvmId) {
			context.fail(
				"No CVM ID provided. Use --interactive to select interactively.",
			);
			return 1;
		}

		const { cvmId: normalizedCvmId } = CvmIdSchema.parse(context.cvmId);
		let encryptedEnv: string | undefined;

		if (input.envFile) {
			const envPath = path.resolve(process.cwd(), input.envFile);
			if (!fs.existsSync(envPath)) {
				throw new Error(`Environment file not found: ${envPath}`);
			}

			const envVars = parseEnvFile(envPath);

			const client = await getClient();
			const result = await safeGetCvmInfo(client, { id: normalizedCvmId });
			if (!result.success) {
				throw new Error(result.error.message);
			}
			const pubkey = await getEncryptPubkey(client, result.data);

			logger.info("Encrypting environment variables...");
			encryptedEnv = await encryptEnvVars(envVars, pubkey);
		}

		const requestBody: { teepod_id?: number; encrypted_env?: string } = {};

		if (input.teepodId) {
			requestBody.teepod_id = Number.parseInt(input.teepodId, 10);
		}
		if (encryptedEnv) {
			requestBody.encrypted_env = encryptedEnv;
		}

		const replica = await replicateCvm(normalizedCvmId, requestBody);

		logger.success(
			`Successfully created replica of CVM UUID: ${normalizedCvmId} with App ID: ${replica.app_id}`,
		);

		const vmUuid = replica.vm_uuid?.replace(/-/g, "") ?? "";
		logger.keyValueTable(
			{
				"CVM UUID": vmUuid,
				"App ID": replica.app_id,
				Name: replica.name,
				Status: replica.status,
				TEEPod: `${replica.teepod.name} (ID: ${replica.teepod_id})`,
				vCPUs: replica.vcpu,
				Memory: `${replica.memory} MB`,
				"Disk Size": `${replica.disk_size} GB`,
				"App URL":
					replica.app_url ||
					`${process.env.CLOUD_URL || "https://cloud.phala.com"}/dashboard/cvms/${vmUuid}`,
			},
			{ borderStyle: "rounded" },
		);

		logger.success(
			`Your CVM replica is being created. You can check its status with:
phala cvms get ${replica.app_id}`,
		);
		return 0;
	} catch (error) {
		logger.error("Failed to create CVM replica");
		logger.logDetailedError(error);
		return 1;
	}
}

export const cvmsReplicateCommand = defineCommand({
	path: ["cvms", "replicate"],
	meta: cvmsReplicateCommandMeta,
	schema: cvmsReplicateCommandSchema,
	handler: runCvmsReplicateCommand,
});

export default cvmsReplicateCommand;
