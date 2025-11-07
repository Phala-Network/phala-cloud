import fs from "node:fs";
import { encryptEnvVars, type EnvVar } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getCvmByAppId, upgradeCvm } from "@/src/api/cvms";
import { CLOUD_URL } from "@/src/utils/constants";
import { detectFileInCurrentDir, promptForFile } from "@/src/utils/prompts";
import { parseEnv } from "@/src/utils/secrets";
import { deleteSimulatorEndpointEnv } from "@/src/utils/simulator";
import { resolveCvmAppId } from "@/src/utils/cvms";
import { logger } from "@/src/utils/logger";
import {
	cvmsUpgradeCommandMeta,
	cvmsUpgradeCommandSchema,
	type CvmsUpgradeCommandInput,
} from "./command";

async function ensureComposePath(
	input: CvmsUpgradeCommandInput,
): Promise<string> {
	if (input.compose) {
		return input.compose;
	}

	const possibleFiles = ["docker-compose.yml", "docker-compose.yaml"];
	const detected = detectFileInCurrentDir(
		possibleFiles,
		"Detected docker compose file: {path}",
	);

	return promptForFile(
		"Enter the path to your Docker Compose file:",
		detected,
		"file",
	);
}

async function runCvmsUpgradeCommand(
	input: CvmsUpgradeCommandInput,
	_context: CommandContext,
): Promise<number> {
	try {
		logger.warn(
			'⚠️  This command is deprecated. Please use "phala deploy" instead.',
		);
		logger.warn(
			"⚠️  This legacy API will be maintained but may have limited support.\n",
		);

		const resolvedAppId = await resolveCvmAppId(input.appId);

		const spinner = logger.startSpinner(
			`Fetching current configuration for CVM app_${resolvedAppId}`,
		);
		const currentCvm = await getCvmByAppId(resolvedAppId);
		spinner.stop(true);

		if (!currentCvm) {
			logger.error(`CVM with App ID app_${resolvedAppId} not found`);
			return 1;
		}

		const composePath = await ensureComposePath(input);
		let composeString = "";
		if (composePath) {
			try {
				composeString = fs.readFileSync(composePath, "utf8");
			} catch (error) {
				logger.error(
					`Failed to read Docker Compose file: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
				return 1;
			}
		}

		await deleteSimulatorEndpointEnv();

		if (
			process.env.DSTACK_DOCKER_USERNAME &&
			process.env.DSTACK_DOCKER_PASSWORD
		) {
			logger.info("🔐 Using private DockerHub registry credentials...");
		} else if (
			process.env.DSTACK_AWS_ACCESS_KEY_ID &&
			process.env.DSTACK_AWS_SECRET_ACCESS_KEY &&
			process.env.DSTACK_AWS_REGION &&
			process.env.DSTACK_AWS_ECR_REGISTRY
		) {
			logger.info(
				`🔐 Using private AWS ECR registry: ${process.env.DSTACK_AWS_ECR_REGISTRY}`,
			);
		} else {
			logger.info("🔐 Using public DockerHub registry...");
		}

		let encryptedEnv: string | undefined;
		let envKeys: string[] = [];

		if (input.envFile) {
			try {
				const envs: EnvVar[] = parseEnv([], input.envFile);
				encryptedEnv = await encryptEnvVars(
					envs,
					currentCvm.encrypted_env_pubkey,
				);
				envKeys = envs.map((env) => env.key);
			} catch (error) {
				logger.error(
					`Failed to read environment file: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
				return 1;
			}
		}

		const vmConfig = {
			compose_manifest: {
				docker_compose_file: composeString,
				manifest_version: 1,
				runner: "docker-compose",
				version: "1.0.0",
				features: ["kms", "tproxy-net"],
				name: `app_${resolvedAppId}`,
				allowed_envs: envKeys,
			},
			encrypted_env: encryptedEnv,
			allow_restart: true,
			env_keys: envKeys,
		} as const;

		const upgradeSpinner = logger.startSpinner(
			`Upgrading CVM app_${resolvedAppId}`,
		);
		const response = await upgradeCvm(resolvedAppId, vmConfig);

		if (!response) {
			upgradeSpinner.stop(false);
			logger.error("Failed to upgrade CVM");
			return 1;
		}

		upgradeSpinner.stop(true);

		if (response.detail) {
			logger.info(`Details: ${response.detail}`);
		}

		logger.break();
		logger.success(
			`Your CVM is being upgraded. You can check the dashboard for more details:
${CLOUD_URL}/dashboard/cvms/app_${resolvedAppId}`,
		);
		return 0;
	} catch (error) {
		logger.error(
			`Failed to upgrade CVM: ${error instanceof Error ? error.message : String(error)}`,
		);

		// Note: Use logDetailedError for more detailed error info if needed
		if (input.debug) {
			logger.error("Full Error:", error);
		}

		return 1;
	}
}

export const cvmsUpgradeCommand = defineCommand({
	path: ["cvms", "upgrade"],
	meta: cvmsUpgradeCommandMeta,
	schema: cvmsUpgradeCommandSchema,
	handler: runCvmsUpgradeCommand,
});

export default cvmsUpgradeCommand;
