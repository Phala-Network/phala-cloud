import { getDockerCredentials } from "@/src/utils/credentials";
import { DockerService } from "@/src/utils/docker";
import { logDetailedError } from "@/src/utils/error-handling";
import { logger } from "@/src/utils/logger";
import { Command } from "commander";
import inquirer from "inquirer";

export const pushCommand = new Command()
	.name("push")
	.description("Push a Docker image to Docker Hub")
	.option("-i, --image <image>", "Full image name (e.g. username/image:tag)")
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

			let imageName = options.image;

			// If image name is not provided, list local images and prompt user to select
			if (!imageName) {
				const localImages = await DockerService.listLocalImages();

				if (localImages.length === 0) {
					logger.error(
						'No local Docker images found. Please build an image first with "phala docker build"',
					);
					process.exit(1);
				}

				// If no image specified, prompt to select from available images
				if (!imageName) {
					// Get unique image names
					const uniqueImageNames = Array.from(
						new Set(localImages.map((img) => img.imageName)),
					);

					const { selectedImage } = await inquirer.prompt([
						{
							type: "list",
							name: "selectedImage",
							message: "Select an image to push:",
							choices: uniqueImageNames,
						},
					]);

					imageName = selectedImage;
				}
			}

			// Push the image
			const dockerService = new DockerService(
				"",
				credentials.username,
				credentials.registry,
			);
			const success = await dockerService.pushImage(imageName);

			if (!success) {
				logger.error("Failed to push Docker image");
				process.exit(1);
			}

			logger.success(`Docker image ${imageName} pushed successfully`);
		} catch (error) {
			logger.error("Failed to push Docker image");
			logDetailedError(error);
			process.exit(1);
		}
	});
