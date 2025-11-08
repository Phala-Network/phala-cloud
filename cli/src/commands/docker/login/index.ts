import prompts from "prompts";
import { saveDockerCredentials } from "@/src/utils/credentials";
import { DockerService } from "@/src/utils/docker";

import { logger } from "@/src/utils/logger";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import {
	dockerLoginCommandMeta,
	dockerLoginCommandSchema,
	type DockerLoginCommandInput,
} from "./command";

async function runDockerLogin(
	input: DockerLoginCommandInput,
	_context: CommandContext,
): Promise<number> {
	try {
		let username = input.username;
		let password = input.password;
		const registry = input.registry;

		if (!username) {
			logger.info(
				"First we need your Docker Hub username to check if you are already logged in.",
			);

			const response = await prompts({
				type: "text",
				name: "username",
				message: "Enter your Docker Hub username:",
				validate: (value: string) =>
					value.length > 0 ? true : "Username cannot be empty",
			});

			if (!response.username) {
				logger.error("Username is required");
				return 1;
			}

			username = response.username;
		}

		const dockerService = new DockerService("", username, registry);
		const loggedIn = await dockerService.login(username);
		if (loggedIn) {
			logger.success(`${username} is logged in to Docker Hub`);
			await saveDockerCredentials({
				username,
				registry: registry || null,
			});
			return 0;
		}

		if (!password) {
			const response = await prompts({
				type: "password",
				name: "password",
				message: "Enter your Docker Hub password:",
				validate: (value: string) =>
					value.length > 0 ? true : "Password cannot be empty",
			});

			if (!response.password) {
				logger.error("Password is required");
				return 1;
			}

			password = response.password;
		}

		const success = await dockerService.login(username, password, registry);
		if (!success) {
			logger.error("Failed to login to Docker Hub");
			return 1;
		}

		await saveDockerCredentials({
			username,
			registry: registry || null,
		});

		logger.success("Logged in to Docker Hub successfully");
		return 0;
	} catch (error) {
		logger.error("Failed to login to Docker Hub");
		logger.logDetailedError(error);
		return 1;
	}
}

export const dockerLoginCommand = defineCommand({
	path: ["docker", "login"],
	meta: dockerLoginCommandMeta,
	schema: dockerLoginCommandSchema,
	handler: runDockerLogin,
});

export default dockerLoginCommand;
