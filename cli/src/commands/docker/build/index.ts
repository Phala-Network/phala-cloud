import fs from "node:fs";
import path from "node:path";
import inquirer from "inquirer";
import { getDockerCredentials } from "@/src/utils/credentials";
import { DockerService } from "@/src/utils/docker";

import { logger } from "@/src/utils/logger";
import { promptForFile } from "@/src/utils/prompts";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import {
	dockerBuildCommandMeta,
	dockerBuildCommandSchema,
	type DockerBuildCommandInput,
} from "./command";

async function runDockerBuild(
	input: DockerBuildCommandInput,
	_context: CommandContext,
): Promise<number> {
	try {
		const credentials = await getDockerCredentials();

		if (!credentials) {
			logger.error(
				'Docker information not found. Please login first with "phala docker login"',
			);
			return 1;
		}

		let imageName = input.image;
		if (!imageName) {
			const response = await inquirer.prompt<{ image: string }>([
				{
					type: "input",
					name: "image",
					message: "Enter the Docker image name:",
					validate: (value: string) =>
						value.trim() ? true : "Image name is required",
				},
			]);
			imageName = response.image;
		}

		let tag = input.tag;
		if (!tag) {
			const response = await inquirer.prompt<{ tag: string }>([
				{
					type: "input",
					name: "tag",
					message: "Enter the Docker image tag:",
					default: "latest",
					validate: (value: string) =>
						value.trim() ? true : "Tag is required",
				},
			]);
			tag = response.tag;
		}

		let dockerfilePath = path.resolve(process.cwd(), input.file);
		if (!fs.existsSync(dockerfilePath)) {
			logger.info(`Default Dockerfile not found at ${dockerfilePath}`);
			const selectedFile = await promptForFile(
				"Enter the path to your Dockerfile:",
				"Dockerfile",
				"file",
			);
			dockerfilePath = path.resolve(process.cwd(), selectedFile);
		}

		const dockerService = new DockerService(
			imageName,
			credentials.username,
			credentials.registry,
		);
		const success = await dockerService.buildImage(dockerfilePath, tag);

		if (!success) {
			logger.error("Failed to build Docker image");
			return 1;
		}

		logger.success(
			`Docker image ${credentials.username}/${imageName}:${tag} built successfully`,
		);
		return 0;
	} catch (error) {
		logger.error("Failed to build Docker image");
		logger.logDetailedError(error);
		return 1;
	}
}

export const dockerBuildCommand = defineCommand({
	path: ["docker", "build"],
	meta: dockerBuildCommandMeta,
	schema: dockerBuildCommandSchema,
	handler: runDockerBuild,
});

export default dockerBuildCommand;
