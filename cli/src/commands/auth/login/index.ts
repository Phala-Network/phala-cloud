import prompts from "prompts";
import { safeGetCurrentUser } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getClientWithKey } from "@/src/lib/client";
import { DEFAULT_API_PREFIX, upsertProfile } from "@/src/utils/credentials";
import { CLOUD_URL } from "@/src/utils/constants";

import { logger } from "@/src/utils/logger";
import { loginCommandMeta, loginCommandSchema } from "./command";
import type { LoginCommandInput } from "./command";

interface CurrentUserInfo {
	username: string;
	email?: string;
	workspace_name?: string;
	workspace_slug?: string;
}

async function validateApiKey(options: {
	apiKey: string;
	baseURL: string;
}): Promise<CurrentUserInfo> {
	const client = await getClientWithKey(options.apiKey, {
		baseURL: options.baseURL,
	});
	const result = await safeGetCurrentUser(client);

	if (!result.success || !result.data?.user.username) {
		throw new Error("Invalid API key");
	}

	return {
		username: result.data.user.username,
		email: result.data.user.email,
		workspace_name: result.data.workspace.name,
		workspace_slug: result.data.workspace.slug || undefined,
	};
}

async function promptForApiKey(options: {
	baseURL: string;
}): Promise<{ apiKey: string; user: CurrentUserInfo }> {
	let cachedUser: CurrentUserInfo | undefined;
	const response = await prompts({
		type: "password",
		name: "apiKey",
		message: "Enter your API key:",
		validate: async (value: string) => {
			if (!value || value.trim().length === 0) {
				return "API key cannot be empty";
			}
			try {
				cachedUser = await validateApiKey({
					apiKey: value,
					baseURL: options.baseURL,
				});
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
		cachedUser = await validateApiKey({
			apiKey: response.apiKey,
			baseURL: options.baseURL,
		});
	}

	return { apiKey: response.apiKey, user: cachedUser };
}

async function runLoginCommand(
	input: LoginCommandInput,
	context: CommandContext,
): Promise<number> {
	// Show deprecation warning
	logger.warn(
		'The "phala auth login" command is deprecated and will be removed in a future version.',
	);
	logger.info('Please use "phala login" instead for a better experience.');
	logger.break();

	try {
		const baseURL = context.env.PHALA_CLOUD_API_PREFIX || DEFAULT_API_PREFIX;

		let apiKey = input.apiKey;
		let user: CurrentUserInfo | undefined;

		if (!apiKey) {
			const result = await promptForApiKey({ baseURL });
			apiKey = result.apiKey;
			user = result.user;
		} else {
			user = await validateApiKey({ apiKey, baseURL });
		}

		if (!user) {
			throw new Error("Failed to validate API key");
		}

		const workspaceName = user.workspace_name || "default";
		const workspaceSlug = user.workspace_slug;
		const profileName = workspaceSlug || "default";

		upsertProfile({
			profileName,
			token: apiKey,
			apiPrefix: baseURL,
			workspaceName,
			workspaceSlug,
			user: {
				username: user.username,
				email: user.email,
			},
			setCurrent: true,
		});

		logger.success(
			`Welcome ${user.username}! Credentials saved successfully (profile: ${profileName})`,
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
