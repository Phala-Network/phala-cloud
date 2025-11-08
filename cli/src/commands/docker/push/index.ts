import inquirer from "inquirer";
import { getDockerCredentials } from "@/src/utils/credentials";
import { DockerService } from "@/src/utils/docker";

import { logger } from "@/src/utils/logger";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import {
	dockerPushCommandMeta,
	dockerPushCommandSchema,
	type DockerPushCommandInput,
} from "./command";

async function resolveImageName(image: string | undefined): Promise<string> {
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
			message: "Select an image to push:",
			choices: uniqueImageNames,
		},
	]);
	return selectedImage;
}

async function runDockerPush(
	input: DockerPushCommandInput,
	_context: CommandContext,
): Promise<number> {
	try {
		const credentials = await getDockerCredentials();
		if (!credentials) {
			throw new Error(
				'Docker information not found. Please login first with "phala docker login"',
			);
		}

		const imageName = await resolveImageName(input.image);

		const dockerService = new DockerService(
			"",
			credentials.username,
			credentials.registry,
		);
		const success = await dockerService.pushImage(imageName);

		if (!success) {
			logger.error("Failed to push Docker image");
			return 1;
		}

		logger.success(`Docker image ${imageName} pushed successfully`);
		return 0;
	} catch (error) {
		logger.error("Failed to push Docker image");
		logger.logDetailedError(error);
		return 1;
	}
}

export const dockerPushCommand = defineCommand({
	path: ["docker", "push"],
	meta: dockerPushCommandMeta,
	schema: dockerPushCommandSchema,
	handler: runDockerPush,
});

export default dockerPushCommand;
