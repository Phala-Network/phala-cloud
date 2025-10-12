import { saveDockerCredentials } from "@/src/utils/credentials";
import { DockerService } from "@/src/utils/docker";
import { logDetailedError } from "@/src/utils/error-handling";
import { logger } from "@/src/utils/logger";
import { Command } from "commander";
import prompts from "prompts";

export const loginCommand = new Command()
	.name("login")
	.description("Login to Docker Hub")
	.option("-u, --username <username>", "Docker Hub username")
	.option("-p, --password <password>", "Docker Hub password")
	.option("-r, --registry <registry>", "Docker registry URL")
	.action(async (options) => {
		try {
			let username = options.username;
			let password = options.password;
			const registry = options.registry;

			// If no username is provided, prompt for it
			if (!username) {
				logger.info(
					"First we need your Docker Hub username to check if you are already logged in.",
				);

				const response = await prompts({
					type: "text",
					name: "username",
					message: "Enter your Docker Hub username:",
					validate: (value) =>
						value.length > 0 ? true : "Username cannot be empty",
				});

				if (!response.username) {
					logger.error("Username is required");
					process.exit(1);
				}

				username = response.username;
			}

			// Check if Docker is already logged in
			const dockerService = new DockerService("", username, registry);
			const loggedIn = await dockerService.login(username);
			if (loggedIn) {
				logger.success(`${username} is logged in to Docker Hub`);
				// Save credentials
				await saveDockerCredentials({
					username,
					registry: registry || null,
				});
				return;
			}

			// If no password is provided, prompt for it
			if (!password) {
				const response = await prompts({
					type: "password",
					name: "password",
					message: "Enter your Docker Hub password:",
					validate: (value) =>
						value.length > 0 ? true : "Password cannot be empty",
				});

				if (!response.password) {
					logger.error("Password is required");
					process.exit(1);
				}

				password = response.password;
			}

			// Login to Docker Hub
			const success = await dockerService.login(username, password, registry);

			if (!success) {
				logger.error("Failed to login to Docker Hub");
				process.exit(1);
			}

			// Save credentials
			await saveDockerCredentials({
				username,
				registry: registry || null,
			});

			logger.success("Logged in to Docker Hub successfully");
		} catch (error) {
			logger.error("Failed to login to Docker Hub");
			logDetailedError(error);
			process.exit(1);
		}
	});
