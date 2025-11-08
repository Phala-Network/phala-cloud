import fs from "node:fs";
import path from "node:path";
import inquirer from "inquirer";
import { getDockerCredentials } from "@/src/utils/credentials";
import { DockerService } from "@/src/utils/docker";

import { logger } from "@/src/utils/logger";
import { validateFileExists } from "@/src/utils/prompts";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import {
	dockerGenerateCommandMeta,
	dockerGenerateCommandSchema,
	type DockerGenerateCommandInput,
} from "./command";

async function ensureImageName(image: string | undefined): Promise<string> {
	if (image) {
		return image;
	}

	const localImages = await DockerService.listLocalImages();
	if (localImages.length === 0) {
		throw new Error(
			'No local Docker images found. Please build an image first with "phala docker build"',
		);
	}

	const uniqueImageNames = Array.from(
		new Set(localImages.map((img) => img.imageName)),
	);
	const { selectedImage } = await inquirer.prompt<{ selectedImage: string }>([
		{
			type: "list",
			name: "selectedImage",
			message: "Select an image to use in the compose file:",
			choices: uniqueImageNames,
		},
	]);
	return selectedImage;
}

async function ensureEnvFilePath(
	envFile: string | undefined,
): Promise<string | undefined> {
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

async function ensureOutputPath(output: string | undefined): Promise<string> {
	let outputPath = output ?? path.join(process.cwd(), "docker-compose.yml");

	if (fs.existsSync(outputPath)) {
		const { confirmOverwrite } = await inquirer.prompt<{
			confirmOverwrite: boolean;
		}>([
			{
				type: "confirm",
				name: "confirmOverwrite",
				message: `File ${outputPath} already exists. Overwrite?`,
				default: false,
			},
		]);

		if (!confirmOverwrite) {
			const { customPath } = await inquirer.prompt<{ customPath: string }>([
				{
					type: "input",
					name: "customPath",
					message: "Enter alternative output path:",
					default: path.join(process.cwd(), "docker-generated-compose.yml"),
				},
			]);
			outputPath = customPath;
		}
	}

	const outputDir = path.dirname(outputPath);
	if (!fs.existsSync(outputDir)) {
		logger.info(`Creating directory: ${outputDir}`);
		fs.mkdirSync(outputDir, { recursive: true });
	}

	return outputPath;
}

async function runDockerGenerate(
	input: DockerGenerateCommandInput,
	_context: CommandContext,
): Promise<number> {
	try {
		const credentials = await getDockerCredentials();
		if (!credentials || !credentials.username) {
			throw new Error(
				'Docker Hub username not found. Please login first with "phala docker login"',
			);
		}

		const imageName = await ensureImageName(input.image);
		const envFilePath = await ensureEnvFilePath(input.envFile);
		const outputPath = await ensureOutputPath(input.output);

		if (envFilePath) {
			logger.info(
				`Generating Docker Compose file for ${imageName} using env file: ${envFilePath}`,
			);
		} else {
			logger.info(
				`Generating Docker Compose file for ${imageName} without env file`,
			);
		}

		const dockerService = new DockerService(
			"",
			credentials.username,
			credentials.registry,
		);
		const composePath = await dockerService.buildComposeFile(
			imageName,
			envFilePath,
			input.template,
		);

		if (composePath !== outputPath) {
			fs.copyFileSync(composePath, outputPath);
		}

		logger.success(`Docker Compose file generated successfully: ${outputPath}`);
		return 0;
	} catch (error) {
		logger.error("Failed to generate Docker Compose file");
		logger.logDetailedError(error);
		return 1;
	}
}

export const dockerGenerateCommand = defineCommand({
	path: ["docker", "generate"],
	meta: dockerGenerateCommandMeta,
	schema: dockerGenerateCommandSchema,
	handler: runDockerGenerate,
});

export default dockerGenerateCommand;
