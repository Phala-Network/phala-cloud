import { CvmIdSchema, encryptEnvVars } from "@phala/cloud";
import { getReplicaEnvEncryptPubkey, replicateCvm } from "@/src/api/cvms";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";

import { resolveCvmForInput } from "@/src/utils/cvms";
import { logger } from "@/src/utils/logger";
import { resolveEnvInputs } from "../../envs/resolve-envs";
import {
	cvmsReplicateCommandMeta,
	cvmsReplicateCommandSchema,
	type CvmsReplicateCommandInput,
} from "./command";

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
		const cvm = await resolveCvmForInput(client, context.cvmId);
		const replicateIdentifier = cvm.id || normalizedCvmId;
		let encryptedEnv: string | undefined;

		if (input.envFile) {
			const envVars = resolveEnvInputs([input.envFile]);

			logger.info("Encrypting environment variables...");
			const pubkey = await getReplicaEnvEncryptPubkey(replicateIdentifier, {
				teepod_id: input.teepodId
					? Number.parseInt(input.teepodId, 10)
					: undefined,
			});
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
