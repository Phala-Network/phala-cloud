import fs from "node:fs";
import path from "node:path";
import { CvmIdSchema, encryptEnvVars, safeGetCvmInfo } from "@phala/cloud";
import { replicateCvm } from "@/src/api/cvms";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";

import { logger } from "@/src/utils/logger";
import { getEncryptPubkey } from "../../envs/get-encrypt-pubkey";
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
		const client = await getClient();
		const cvmResult = await safeGetCvmInfo(client, context.cvmId);
		if (!cvmResult.success) {
			throw new Error(cvmResult.error.message);
		}
		const cvm = cvmResult.data;
		const replicateIdentifier = cvm.id || normalizedCvmId;
		let encryptedEnv: string | undefined;

		if (input.envFile) {
			const envPath = path.resolve(process.cwd(), input.envFile);
			if (!fs.existsSync(envPath)) {
				throw new Error(`Environment file not found: ${envPath}`);
			}

			const envVars = parseEnvFile(envPath);

			logger.info("Encrypting environment variables...");
			const pubkey = await getEncryptPubkey(client, cvm);
			encryptedEnv = await encryptEnvVars(envVars, pubkey);
		}

		const requestBody: { teepod_id?: number; encrypted_env?: string } = {};

		if (input.teepodId) {
			requestBody.teepod_id = Number.parseInt(input.teepodId, 10);
		}
		if (encryptedEnv) {
			requestBody.encrypted_env = encryptedEnv;
		}

		const replica = await replicateCvm(replicateIdentifier, requestBody);

		logger.success(
			`Successfully created replica of CVM UUID: ${normalizedCvmId} with App ID: ${replica.app_id}`,
		);

		logger.keyValueTable(
			{
				"CVM UUID": replica.vm_uuid.replace(/-/g, ""),
				"App ID": replica.app_id,
				Name: replica.name,
				Status: replica.status,
				TEEPod: `${replica.teepod.name} (ID: ${replica.teepod_id})`,
				vCPUs: replica.vcpu,
				Memory: `${replica.memory} MB`,
				"Disk Size": `${replica.disk_size} GB`,
				"App URL":
					replica.app_url ||
					`${process.env.CLOUD_URL || "https://cloud.phala.com"}/dashboard/cvms/${replica.vm_uuid.replace(/-/g, "")}`,
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
