import { Command } from "commander";
import { removeApiKey, saveApiKey } from "@/src/utils/credentials";
import { logDetailedError } from "@/src/utils/error-handling";
import { logger } from "@/src/utils/logger";
import prompts from "prompts";
import { safeGetCurrentUser } from "@phala/cloud";
import { getClientWithKey } from "@/src/lib/client";
import { CLOUD_URL } from "@/src/utils/constants";
import type { UserInfoResponse } from "@/src/api/types";

export const loginCommand = new Command()
	.name("login")
	.description("Set the API key for authentication")
	.argument("[api-key]", "Phala Cloud API key to set")
	.action(async (apiKey?: string): Promise<void> => {
		try {
			let checkUserInfo;
			let finalApiKey: string;
			// If no API key is provided, prompt for it
			if (!apiKey) {
				const response = await prompts({
					type: "password",
					name: "apiKey",
					message: "Enter your API key:",
					validate: async (value) => {
						if (value.length === 0) {
							return "API key cannot be empty";
						}
						try {
							await saveApiKey(value);
							const client = await getClientWithKey(value);
							const result = await safeGetCurrentUser(client);
							const userData = result.data as UserInfoResponse;
							if (!result.success || !userData.username) {
								await removeApiKey();
								throw new Error("Invalid API key");
							}
							checkUserInfo = userData;
						} catch (error) {
							throw new Error("Invalid API key");
						}
						return true;
					},
				});

				finalApiKey = response.apiKey;
			} else {
				finalApiKey = apiKey;
				await saveApiKey(finalApiKey);
				// Validate the API key
				const client = await getClientWithKey(finalApiKey);
				const result = await safeGetCurrentUser(client);
				if (!result.success || !(result.data as UserInfoResponse).username) {
					await removeApiKey();
					throw new Error("Invalid API key");
				}
				checkUserInfo = result.data as UserInfoResponse;
			}

			logger.success(
				`Welcome ${checkUserInfo.username}! API key validated and saved successfully`,
			);
			logger.break();
			logger.info(`Open in Web UI at ${CLOUD_URL}/dashboard/`);
		} catch (error) {
			logger.error("Failed to set API key");
			logDetailedError(error);
			process.exit(1);
		}
	});
