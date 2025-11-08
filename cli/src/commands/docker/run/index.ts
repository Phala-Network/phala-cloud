import fs from "node:fs";
import path from "node:path";
import inquirer from "inquirer";
import { DockerService } from "@/src/utils/docker";

import { logger } from "@/src/utils/logger";
import { validateFileExists } from "@/src/utils/prompts";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import {
	dockerRunCommandMeta,
	dockerRunCommandSchema,
	type DockerRunCommandInput,
} from "./command";

async function ensureComposePath(compose: string | undefined): Promise<string> {
	if (compose) {
		validateFileExists(compose);
		return compose;
	}

	const defaultComposePath = path.join(process.cwd(), "docker-compose.yml");
	if (fs.existsSync(defaultComposePath)) {
		const { useDefault } = await inquirer.prompt<{ useDefault: boolean }>([
			{
				type: "confirm",
				name: "useDefault",
				message: "Use docker-compose.yml in current directory?",
				default: true,
			},
		]);
		if (useDefault) {
			return defaultComposePath;
		}
	}

	const { composePath } = await inquirer.prompt<{ composePath: string }>([
		{
			type: "input",
			name: "composePath",
			message: "Enter path to docker-compose.yml file:",
			validate: (input: string) => {
				try {
					validateFileExists(input);
					return true;
				} catch (error) {
					return "File not found";
				}
			},
		},
	]);
	return composePath;
}

async function ensureEnvFilePath(
	envFile: string | undefined,
	skipEnv: boolean,
): Promise<string | undefined> {
	if (skipEnv) {
		return envFile;
	}

	if (envFile) {
		validateFileExists(envFile);
		return envFile;
	}

	const defaultEnvPath = path.join(process.cwd(), ".env");
	if (fs.existsSync(defaultEnvPath)) {
		const { useDefault } = await inquirer.prompt<{ useDefault: boolean }>([
			{
				type: "confirm",
				name: "useDefault",
				message: "Use .env file in current directory?",
				default: true,
			},
		]);
		if (useDefault) {
			return defaultEnvPath;
		}
	}

	const { envPath } = await inquirer.prompt<{ envPath: string }>([
		{
			type: "input",
			name: "envPath",
			message: "Enter path to environment variables file:",
			validate: (input: string) => {
				try {
					validateFileExists(input);
					return true;
				} catch (error) {
					return `File not found: ${input}`;
				}
			},
		},
	]);
	return envPath;
}

async function runDockerCompose(
	input: DockerRunCommandInput,
	_context: CommandContext,
): Promise<number> {
	try {
		const composePath = await ensureComposePath(input.compose);
		const envFilePath = await ensureEnvFilePath(input.envFile, input.skipEnv);

		const dockerService = new DockerService("");

		if (envFilePath) {
			logger.info(`Validating env file: ${envFilePath}`);
			validateFileExists(envFilePath);
			logger.info(
				`Running Docker Compose with compose file: ${composePath} and env file: ${envFilePath}`,
			);
		} else {
			logger.info(
				`Running Docker Compose with compose file: ${composePath} without env file`,
			);
		}

		const success = await dockerService.runComposeLocally(
			composePath,
			envFilePath,
		);
		if (!success) {
			logger.error("Failed to run Docker Compose");
			return 1;
		}

		logger.success("Docker Compose is running");
		return 0;
	} catch (error) {
		logger.error("Failed to run Docker Compose");
		logger.logDetailedError(error);
		return 1;
	}
}

export const dockerRunCommand = defineCommand({
	path: ["docker", "run"],
	meta: dockerRunCommandMeta,
	schema: dockerRunCommandSchema,
	handler: runDockerCompose,
});

export default dockerRunCommand;
