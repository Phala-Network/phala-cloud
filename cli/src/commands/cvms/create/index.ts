import fs from "node:fs";
import path from "node:path";
import { encryptEnvVars, type EnvVar } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { createCvm, getPubkeyFromCvm, getTeepods } from "@/src/api/cvms";
import type { Image, TEEPod } from "@/src/api/types";
import {
	CLOUD_URL,
	DEFAULT_DISK_SIZE,
	DEFAULT_IMAGE,
	DEFAULT_MEMORY,
	DEFAULT_VCPU,
} from "@/src/utils/constants";
import { detectFileInCurrentDir, promptForFile } from "@/src/utils/prompts";
import { parseEnv } from "@/src/utils/secrets";
import { deleteSimulatorEndpointEnv } from "@/src/utils/simulator";
import { logger } from "@/src/utils/logger";
import inquirer from "inquirer";
import {
	cvmsCreateCommandMeta,
	cvmsCreateCommandSchema,
	type CvmsCreateCommandInput,
} from "./command";

async function ensureName(name?: string): Promise<string> {
	if (name) {
		return name;
	}

	const { value } = await inquirer.prompt([
		{
			type: "input",
			name: "value",
			message: "Enter a name for the CVM:",
			validate: (input: string) => {
				const trimmed = input.trim();
				if (!trimmed) {
					return "CVM name is required";
				}
				if (trimmed.length > 20) {
					return "CVM name must be less than 20 characters";
				}
				if (trimmed.length < 3) {
					return "CVM name must be at least 3 characters";
				}
				if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
					return "CVM name must contain only letters, numbers, underscores, and hyphens";
				}
				return true;
			},
		},
	]);

	return value.trim();
}

async function ensureComposePath(compose?: string): Promise<string> {
	if (compose) {
		return compose;
	}

	const possibleFiles = ["docker-compose.yml", "docker-compose.yaml"];
	const detected = detectFileInCurrentDir(
		possibleFiles,
		"Detected docker compose file: {path}",
	);

	const value = await promptForFile(
		"Enter the path to your Docker Compose file:",
		detected,
		"file",
	);
	return value;
}

async function collectEnvs(input: CvmsCreateCommandInput): Promise<EnvVar[]> {
	if (input.envFile) {
		return parseEnv([], input.envFile);
	}

	if (input.skipEnv) {
		logger.info("Skipping environment variable prompt");
		return [];
	}

	const { shouldSkip } = await inquirer.prompt([
		{
			type: "confirm",
			name: "shouldSkip",
			message: "Do you want to skip environment variable prompt?",
			default: true,
		},
	]);

	if (shouldSkip) {
		logger.info("Skipping environment variable prompt");
		return [];
	}

	const envFile = await promptForFile(
		"Enter the path to your environment file:",
		".env",
		"file",
	);
	return parseEnv([], envFile);
}

function resolveNumericOption(
	value: string | undefined,
	fallback: number,
): number {
	if (!value) {
		return fallback;
	}
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function validateResource(name: string, value: number): string | null {
	if (!Number.isFinite(value) || value <= 0) {
		return `Invalid ${name}: ${value}`;
	}
	return null;
}

async function resolveTeepod(
	teepodId: string | undefined,
	teepods: Awaited<ReturnType<typeof getTeepods>>,
): Promise<TEEPod | undefined> {
	if (!teepods.nodes.length) {
		return undefined;
	}
	if (!teepodId) {
		return teepods.nodes[0];
	}
	const targetId = Number(teepodId);
	return teepods.nodes.find((pod) => pod.teepod_id === targetId);
}

function resolveImage(teepod: TEEPod, imageName?: string): Image | undefined {
	const images = teepod.images ?? [];
	if (!imageName) {
		return images.find((image) => image.name === DEFAULT_IMAGE);
	}
	return images.find((image) => image.name === imageName);
}

async function runCvmsCreateCommand(
	input: CvmsCreateCommandInput,
	_context: CommandContext,
): Promise<number> {
	try {
		logger.warn(
			'⚠️  This command is deprecated. Please use "phala deploy" instead.',
		);
		logger.warn(
			"⚠️  This legacy API will be maintained but may have limited support.\\n",
		);

		const name = await ensureName(input.name);
		const composePath = await ensureComposePath(input.compose);
		const absoluteComposePath = path.resolve(composePath);
		if (!fs.existsSync(absoluteComposePath)) {
			logger.error(`Docker Compose file not found: ${absoluteComposePath}`);
			return 1;
		}
		const composeString = fs.readFileSync(absoluteComposePath, "utf8");

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

		let envs: EnvVar[] = [];
		try {
			envs = await collectEnvs(input);
		} catch (error) {
			logger.error(
				`Failed to read environment file: ${error instanceof Error ? error.message : String(error)}`,
			);
			return 1;
		}

		const vcpu = resolveNumericOption(input.vcpu, DEFAULT_VCPU);
		const memory = resolveNumericOption(input.memory, DEFAULT_MEMORY);
		const diskSize = resolveNumericOption(input.diskSize, DEFAULT_DISK_SIZE);

		for (const [label, value] of [
			["number of vCPUs", vcpu],
			["memory", memory],
			["disk size", diskSize],
		] as const) {
			const error = validateResource(label, value);
			if (error) {
				logger.error(error);
				return 1;
			}
		}

		const teepodsSpinner = logger.startSpinner("Fetching available TEEPods");
		const teepods = await getTeepods(true);
		teepodsSpinner.stop(true);

		const teepod = await resolveTeepod(input.teepodId, teepods);
		if (!teepod) {
			logger.error("Failed to find suitable TEEPod");
			return 1;
		}

		const image = resolveImage(teepod, input.image);
		if (!image) {
			logger.error(
				input.image
					? `Failed to find selected image: ${input.image}`
					: `Failed to find default image ${DEFAULT_IMAGE}`,
			);
			return 1;
		}

		const vmConfig = {
			teepod_id: teepod.teepod_id,
			name,
			image: image.name,
			vcpu,
			memory,
			disk_size: diskSize,
			compose_manifest: {
				docker_compose_file: composeString,
				docker_config: {
					url: "",
					username: "",
					password: "",
				},
				features: ["kms", "tproxy-net"],
				kms_enabled: true,
				manifest_version: 2,
				name,
				public_logs: true,
				public_sysinfo: true,
				runner: "docker-compose",
				tproxy_enabled: true,
			},
			listed: false,
		} as const;

		const keySpinner = logger.startSpinner("Getting public key from CVM");
		const pubkey = await getPubkeyFromCvm(vmConfig);
		keySpinner.stop(true);

		if (!pubkey) {
			logger.error("Failed to get public key from CVM");
			return 1;
		}

		const encryptSpinner = logger.startSpinner(
			"Encrypting environment variables",
		);
		const encryptedEnv = await encryptEnvVars(
			envs,
			pubkey.app_env_encrypt_pubkey,
		);
		encryptSpinner.stop(true);

		if (input.debug) {
			logger.debug("Public key:", pubkey.app_env_encrypt_pubkey);
			logger.debug("Encrypted environment variables:", encryptedEnv);
			logger.debug("Environment variables:", JSON.stringify(envs));
		}

		const createSpinner = logger.startSpinner("Creating CVM");
		const response = await createCvm({
			...vmConfig,
			encrypted_env: encryptedEnv,
			app_env_encrypt_pubkey: pubkey.app_env_encrypt_pubkey,
			app_id_salt: pubkey.app_id_salt,
		});
		createSpinner.stop(true);

		if (!response) {
			logger.error("Failed to create CVM");
			return 1;
		}

		logger.success("CVM created successfully");
		logger.break();
		logger.keyValueTable(
			{
				"CVM ID": response.id,
				Name: response.name,
				Status: response.status,
				"App ID": `app_${response.app_id}`,
				"App URL":
					response.app_url ||
					`${CLOUD_URL}/dashboard/cvms/app_${response.app_id}`,
			},
			{ borderStyle: "rounded" },
		);
		logger.info("");
		logger.success(
			`Your CVM is being created. You can check its status with:
phala cvms get app_${response.app_id}`,
		);
		return 0;
	} catch (error) {
		logger.error(
			`Failed to create CVM: ${error instanceof Error ? error.message : String(error)}`,
		);
		// Note: Use logDetailedError for more detailed error info if needed
		return 1;
	}
}

export const cvmsCreateCommand = defineCommand({
	path: ["cvms", "create"],
	meta: cvmsCreateCommandMeta,
	schema: cvmsCreateCommandSchema,
	handler: runCvmsCreateCommand,
});

export default cvmsCreateCommand;
