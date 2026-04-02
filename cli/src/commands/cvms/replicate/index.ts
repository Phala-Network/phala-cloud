import fs from "node:fs";
import path from "node:path";
import {
	type PhalaCloudError,
	ResourceError,
	formatErrorMessage,
	formatStructuredError,
	safeGetCvmInfo,
	safeGetCurrentUser,
	encryptEnvVars,
} from "@phala/cloud";
import { replicateCvm } from "@/src/api/cvms";
import { getClient } from "@/src/lib/client";
import { getEncryptPubkey } from "@/src/commands/envs/get-encrypt-pubkey";
import { defineCommand } from "@/src/core/define-command";
import { isInJsonMode } from "@/src/core/json-mode";
import type { CommandContext } from "@/src/core/types";

import { CLOUD_URL } from "@/src/utils/constants";
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

		let encryptedEnv: string | undefined;
		const client = await getClient(context);
		const [cvmResult, currentUserResult] = await Promise.all([
			safeGetCvmInfo(client, context.cvmId),
			safeGetCurrentUser(client),
		]);
		if (!cvmResult.success) {
			throw new Error(cvmResult.error.message);
		}
		if (!currentUserResult.success) {
			throw new Error(currentUserResult.error.message);
		}
		const sourceCvm = cvmResult.data;
		const workspace = currentUserResult.data.workspace;

		if (input.envFile) {
			const envPath = path.resolve(process.cwd(), input.envFile);
			if (!fs.existsSync(envPath)) {
				throw new Error(`Environment file not found: ${envPath}`);
			}

			const envVars = parseEnvFile(envPath);
			const pubkey = await getEncryptPubkey(client, sourceCvm);
			encryptedEnv = await encryptEnvVars(envVars, pubkey);
		}

		const requestBody: { teepod_id?: number; encrypted_env?: string } = {};

		if (input.teepodId) {
			requestBody.teepod_id = Number.parseInt(input.teepodId, 10);
		}
		if (encryptedEnv) {
			requestBody.encrypted_env = encryptedEnv;
		}

		if (!sourceCvm.vm_uuid) {
			throw new Error("Source CVM has no vm_uuid");
		}

		const replica = await replicateCvm(
			sourceCvm.app_id,
			sourceCvm.vm_uuid,
			requestBody,
		);

		if (isInJsonMode()) {
			context.success(replica);
			return 0;
		}

		const vmUuid = replica.vm_uuid?.replace(/-/g, "") ?? "";
		const teamLabel =
			workspace.slug && workspace.slug !== workspace.name
				? `${workspace.name} (${workspace.slug})`
				: workspace.slug || workspace.name;
		const appUrl =
			workspace.slug && vmUuid
				? `${CLOUD_URL}/${workspace.slug}/apps/${replica.app_id}/instances/${vmUuid}`
				: replica.app_url || "-";
		const lines = [
			`Source CVM ID:   ${context.cvmId.id}`,
			`Team:            ${teamLabel}`,
			`CVM UUID:        ${vmUuid || "-"}`,
			`App ID:          ${replica.app_id}`,
			`Name:            ${replica.name}`,
			`Status:          ${replica.status}`,
			`TEEPod:          ${replica.teepod.name} (ID: ${replica.teepod_id})`,
			`vCPUs:           ${replica.vcpu}`,
			`Memory:          ${replica.memory} MB`,
			`Disk Size:       ${replica.disk_size} GB`,
			`App URL:         ${appUrl}`,
		];
		context.stdout.write(`${lines.join("\n")}\n`);
		return 0;
	} catch (error) {
		logger.error("Failed to create CVM replica");
		if (error instanceof ResourceError) {
			process.stderr.write(`${formatStructuredError(error)}\n`);
			process.stderr.write(
				"Reference the error code above in the handbook for remediation details.\n",
			);
			return 1;
		}
		if (error instanceof Error) {
			process.stderr.write(`${formatErrorMessage(error as PhalaCloudError)}\n`);
			return 1;
		}
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
