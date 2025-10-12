import fs from "node:fs";
import path from "node:path";
import { getDockerCredentials } from "@/src/utils/credentials";
import { DockerService } from "@/src/utils/docker";
import { logDetailedError } from "@/src/utils/error-handling";
import { logger } from "@/src/utils/logger";
import { validateFileExists } from "@/src/utils/prompts";
import { Command } from "commander";
import inquirer from "inquirer";

export const generateCommand = new Command()
	.name("generate")
	.description("Generate a Docker Compose file")
	.option(
		"-i, --image <imageName>",
		"Docker image name to use in the compose file (e.g. phala/phala-cloud)",
	)
	.option("-e, --env-file <envFile>", "Path to environment variables file")
	.option(
		"-o, --output <output>",
		"Output path for generated docker-compose.yml",
	)
	.option(
		"--template <template>",
		"Template to use for the generated docker-compose.yml",
	)
	.action(async (options) => {
		try {
			// Get Docker credentials to create the Docker service
			const credentials = await getDockerCredentials();
			if (!credentials || !credentials.username) {
				logger.error(
					"Docker Hub username not found. Please login first with `phala docker login`",
				);
				process.exit(1);
			}

			let imageName = options.image;

			if (!imageName) {
				// If image name is not provided, list local images and prompt user to select
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
							message: "Select an image to use in the compose file:",
							choices: uniqueImageNames,
						},
					]);

					imageName = selectedImage;
				}
			}

			// Get environment file path from options or prompt
			let envFilePath = options.envFile;
			if (!envFilePath) {
				// Check if .env exists in current directory
				const defaultEnvPath = path.join(process.cwd(), ".env");
				const hasDefaultEnv = fs.existsSync(defaultEnvPath);

				if (hasDefaultEnv) {
					const { useDefault } = await inquirer.prompt([
						{
							type: "confirm",
							name: "useDefault",
							message: "Use .env file in current directory?",
							default: true,
						},
					]);

					if (useDefault) {
						envFilePath = defaultEnvPath;
					}
				}

				// If still no env file path, prompt for it
				if (!envFilePath) {
					const { envPath } = await inquirer.prompt([
						{
							type: "input",
							name: "envPath",
							message: "Enter path to environment variables file:",
							validate: (input) => {
								try {
									validateFileExists(input);
									return true;
								} catch (error) {
									return `File not found: ${input}`;
								}
							},
						},
					]);
					envFilePath = envPath;
				}
			} else {
				// Validate the provided env file path
				try {
					validateFileExists(envFilePath);
				} catch (error) {
					logger.error(`File not found: ${envFilePath}`);
					process.exit(1);
				}
			}

			// Get output path from options or set default
			let outputPath = options.output;
			if (!outputPath) {
				outputPath = path.join(process.cwd(), "docker-compose.yml");

				// If file already exists, confirm overwrite
				if (fs.existsSync(outputPath)) {
					const { confirmOverwrite } = await inquirer.prompt([
						{
							type: "confirm",
							name: "confirmOverwrite",
							message: `File ${outputPath} already exists. Overwrite?`,
							default: false,
						},
					]);
					if (!confirmOverwrite) {
						const { customPath } = await inquirer.prompt([
							{
								type: "input",
								name: "customPath",
								message: "Enter alternative output path:",
								default: path.join(
									process.cwd(),
									"docker-generated-compose.yml",
								),
							},
						]);
						outputPath = customPath;
					}
				}
			}

			// Create a DockerService instance
			const dockerService = new DockerService(
				"",
				credentials.username,
				credentials.registry,
			);

			// Generate the Docker Compose file
			if (envFilePath) {
				logger.info(
					`Generating Docker Compose file for ${imageName} using env file: ${envFilePath}`,
				);
			} else {
				logger.info(
					`Generating Docker Compose file for ${imageName} without env file`,
				);
			}
			const composePath = await dockerService.buildComposeFile(
				imageName,
				envFilePath,
				options.template,
			);

			// Copy the generated file to the output path if needed
			if (composePath !== outputPath) {
				// Ensure the output directory exists
				const outputDir = path.dirname(outputPath);
				if (!fs.existsSync(outputDir)) {
					logger.info(`Creating directory: ${outputDir}`);
					fs.mkdirSync(outputDir, { recursive: true });
				}

				fs.copyFileSync(composePath, outputPath);
			}

			logger.success(
				`Docker Compose file generated successfully: ${outputPath}`,
			);
		} catch (error) {
			logger.error("Failed to generate Docker Compose file");
			logDetailedError(error);
			process.exit(1);
		}
	});
