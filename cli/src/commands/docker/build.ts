import fs from "node:fs";
import path from "node:path";
import { getDockerCredentials } from "@/src/utils/credentials";
import { DockerService } from "@/src/utils/docker";
import { logDetailedError } from "@/src/utils/error-handling";
import { logger } from "@/src/utils/logger";
import { promptForFile } from "@/src/utils/prompts";
import { Command } from "commander";
import inquirer from "inquirer";

export const buildCommand = new Command()
	.name("build")
	.description("Build a Docker image")
	.option("-i, --image <image>", "Image name")
	.option("-t, --tag <tag>", "Image tag")
	.option("-f, --file <file>", "Path to Dockerfile", "Dockerfile")
	.action(async (options) => {
		try {
			// Get Docker credentials
			const credentials = await getDockerCredentials();

			if (!credentials) {
				logger.error(
					'Docker information not found. Please login first with "phala docker login"',
				);
				process.exit(1);
			}

			// Prompt for image name if not provided
			if (!options.image) {
				const response = await inquirer.prompt([
					{
						type: "input",
						name: "image",
						message: "Enter the Docker image name:",
						validate: (input) => {
							if (!input.trim()) {
								return "Image name is required";
							}
							return true;
						},
					},
				]);

				options.image = response.image;
			}

			if (!options.tag) {
				const response = await inquirer.prompt([
					{
						type: "input",
						name: "tag",
						message: "Enter the Docker image tag:",
						default: "latest", // Add random hash later
						validate: (input) => {
							if (!input.trim()) {
								return "Tag is required";
							}
							return true;
						},
					},
				]);

				options.tag = response.tag;
			}

			// Prompt for Dockerfile path if the default doesn't exist
			const defaultPath = path.resolve(process.cwd(), options.file);
			if (!fs.existsSync(defaultPath)) {
				logger.info(`Default Dockerfile not found at ${defaultPath}`);

				options.file = await promptForFile(
					"Enter the path to your Dockerfile:",
					"Dockerfile",
					"file",
				);
			}

			// Resolve the Dockerfile path
			const dockerfilePath = path.resolve(process.cwd(), options.file);

			// Build the image
			const dockerService = new DockerService(
				options.image,
				credentials.username,
				credentials.registry,
			);
			const success = await dockerService.buildImage(
				dockerfilePath,
				options.tag,
			);

			if (!success) {
				logger.error("Failed to build Docker image");
				process.exit(1);
			}

			logger.success(
				`Docker image ${credentials.username}/${options.image}:${options.tag} built successfully`,
			);
		} catch (error) {
			logger.error("Failed to build Docker image");
			logDetailedError(error);
			process.exit(1);
		}
	});
