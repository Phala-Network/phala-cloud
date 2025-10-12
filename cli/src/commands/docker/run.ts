import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import inquirer from "inquirer";
import { DockerService } from "../../utils/docker";
import { logDetailedError } from "../../utils/error-handling";
import { logger } from "../../utils/logger";
import { validateFileExists } from "../../utils/prompts";

export const runCommand = new Command()
	.name("run")
	.description("Run a Docker Compose setup")
	.option("-c, --compose <compose>", "Path to docker-compose.yml file")
	.option("-e, --env-file <envFile>", "Path to environment variables file")
	.option("--skip-env", "Skip environment variables file prompt", true)
	.action(async (options) => {
		try {
			let composePath = options.compose;
			let envFilePath = options.envFile;

			// If compose path is not provided, prompt the user
			if (!composePath) {
				// Check if docker-compose.yml exists in current directory
				const defaultComposePath = path.join(
					process.cwd(),
					"docker-compose.yml",
				);
				const hasDefaultCompose = fs.existsSync(defaultComposePath);

				if (hasDefaultCompose) {
					const { useDefault } = await inquirer.prompt([
						{
							type: "confirm",
							name: "useDefault",
							message: "Use docker-compose.yml in current directory?",
							default: true,
						},
					]);

					if (useDefault) {
						composePath = defaultComposePath;
					}
				}

				// If still no compose path, prompt for it
				if (!composePath) {
					const { composePath: inputPath } = await inquirer.prompt([
						{
							type: "input",
							name: "composePath",
							message: "Enter path to docker-compose.yml file:",
							validate: (input) => {
								if (validateFileExists(input)) {
									return true;
								}
								return "File not found";
							},
						},
					]);
					composePath = inputPath;
				}
			} else {
				// Validate the provided compose path
				try {
					validateFileExists(composePath);
				} catch (error) {
					logger.error(`File not found: ${composePath}`);
					process.exit(1);
				}
			}

			// If env file path is not provided, prompt the user
			if (!envFilePath && !options.skipEnv) {
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
			}

			// Create a DockerService instance (empty image name as we're just using it for compose)
			const dockerService = new DockerService("");

			// Run the compose setup
			if (envFilePath) {
				logger.info(`Validating env file: ${envFilePath}`);
				try {
					validateFileExists(envFilePath);
				} catch (error) {
					logger.error(`File not found: ${envFilePath}`);
					process.exit(1);
				}
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
				process.exit(1);
			}

			logger.success("Docker Compose is running");
		} catch (error) {
			logger.error("Failed to run Docker Compose");
			logDetailedError(error);
			process.exit(1);
		}
	});
