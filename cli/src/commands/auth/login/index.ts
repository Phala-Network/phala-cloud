import prompts from "prompts";
import { safeGetCurrentUser } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getClientWithKey } from "@/src/lib/client";
import { removeApiKey, saveApiKey } from "@/src/utils/credentials";
import { CLOUD_URL } from "@/src/utils/constants";

import { logger } from "@/src/utils/logger";
import type { UserInfoResponse } from "@/src/api/types";
import { loginCommandMeta, loginCommandSchema } from "./command";
import type { LoginCommandInput } from "./command";

async function validateAndPersistApiKey(
	apiKey: string,
): Promise<UserInfoResponse> {
	try {
		await saveApiKey(apiKey);
		const client = await getClientWithKey(apiKey);
		const result = await safeGetCurrentUser(client);
		const userData = result.data as UserInfoResponse;

		if (!result.success || !userData?.username) {
			await removeApiKey();
			throw new Error("Invalid API key");
		}

		return userData;
	} catch (error) {
		await removeApiKey();
		throw error instanceof Error ? error : new Error(String(error));
	}
}

async function promptForApiKey(): Promise<{
	apiKey: string;
	user: UserInfoResponse;
}> {
	let cachedUser: UserInfoResponse | undefined;
	const response = await prompts({
		type: "password",
		name: "apiKey",
		message: "Enter your API key:",
		validate: async (value: string) => {
			if (!value || value.trim().length === 0) {
				return "API key cannot be empty";
			}
			try {
				cachedUser = await validateAndPersistApiKey(value);
				return true;
			} catch (error) {
				return error instanceof Error ? error.message : "Invalid API key";
			}
		},
	});

	if (!response.apiKey) {
		throw new Error("API key input cancelled");
	}

	if (!cachedUser) {
		cachedUser = await validateAndPersistApiKey(response.apiKey);
	}

	return { apiKey: response.apiKey, user: cachedUser };
}

async function runLoginCommand(
	input: LoginCommandInput,
	_context: CommandContext,
): Promise<number> {
	try {
		let apiKey = input.apiKey;
		let user: UserInfoResponse | undefined;

		if (!apiKey) {
			const result = await promptForApiKey();
			apiKey = result.apiKey;
			user = result.user;
		} else {
			user = await validateAndPersistApiKey(apiKey);
		}

		if (!user) {
			throw new Error("Failed to validate API key");
		}

		logger.success(
			`Welcome ${user.username}! API key validated and saved successfully`,
		);
		logger.break();
		logger.info(`Open in Web UI at ${CLOUD_URL}/dashboard/`);
		return 0;
	} catch (error) {
		logger.error("Failed to set API key");
		logger.logDetailedError(error);
		return 1;
	}
}

export const loginCommand = defineCommand({
	path: ["auth", "login"],
	meta: loginCommandMeta,
	schema: loginCommandSchema,
	handler: runLoginCommand,
});

export default loginCommand;
