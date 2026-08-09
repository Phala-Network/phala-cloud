import chalk from "chalk";
import open from "open";
import ora from "ora";
import prompts from "prompts";

import {
	createClient,
	safeGetCurrentUser,
	BusinessError,
	ResourceError,
	formatStructuredError,
	type AuthResponse,
} from "@phala/cloud";

import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getClientWithKey } from "@/src/lib/client";
import { DEFAULT_API_PREFIX, upsertProfile } from "@/src/utils/credentials";

import { loginCommandMeta, loginCommandSchema } from "./command";
import type { LoginCommandInput } from "./command";
import { extractRfc8628Error } from "./error-handling";

// Device auth response types
interface DeviceCodeResponse {
	device_code: string;
	user_code: string;
	verification_uri: string;
	verification_uri_complete: string;
	expires_in: number;
	interval: number;
}

interface DeviceTokenResponse {
	access_token: string;
	token_type: string;
}

function writeLine(stream: NodeJS.WriteStream, message = ""): void {
	stream.write(`${message}\n`);
}

export async function validateApiKey(options: {
	apiKey: string;
	baseURL: string;
}): Promise<AuthResponse> {
	const client = await getClientWithKey(options.apiKey, {
		baseURL: options.baseURL,
	});
	const result = await safeGetCurrentUser(client);

	if (!result.success || !result.data?.user.username) {
		throw new Error("Invalid API key");
	}

	return result.data;
}

export async function promptForApiKey(options: {
	baseURL: string;
}): Promise<{ apiKey: string; user: AuthResponse }> {
	let cachedUser: AuthResponse | undefined;
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

export async function runDeviceAuthFlow(
	context: CommandContext,
	options: {
		noOpen?: boolean;
		printToken?: boolean;
		baseURL: string;
		/**
		 * Workspace slug to pre-bind on the verification page. Used by
		 * `profiles refresh` so the page locks workspace selection to the
		 * profile's existing workspace. The page treats it as a hint; the
		 * backend re-validates workspace access at token issue time.
		 */
		workspaceSlug?: string;
	},
): Promise<string> {
	const client = createClient({
		useCookieAuth: true,
		baseURL: options.baseURL,
	});

	// Step 1: Request device authorization codes
	const codeResponse = await client.post<DeviceCodeResponse>(
		"/auth/device/code",
		{
			client_id: "phala-cli",
			scope: "user:profile cvms:* nodes:*",
		},
	);

	const {
		device_code,
		user_code,
		verification_uri_complete,
		interval: initialInterval,
		expires_in,
	} = codeResponse;

	const verificationUrl = options.workspaceSlug
		? `${verification_uri_complete}&workspace=${encodeURIComponent(options.workspaceSlug)}`
		: verification_uri_complete;

	// Polling interval - can be increased on slow_down per RFC 8628
	let pollingInterval = initialInterval;

	// Step 2: Display verification information
	const infoStream = options.printToken ? context.stderr : context.stdout;
	writeLine(infoStream);
	writeLine(infoStream, chalk.bold("To authenticate, visit:"));
	writeLine(infoStream, chalk.cyan(verificationUrl));
	writeLine(infoStream);
	writeLine(
		infoStream,
		`${chalk.bold("And enter code:")} ${chalk.yellow(user_code)}`,
	);
	writeLine(infoStream);

	// Step 3: Open browser (optional)
	if (!options.noOpen) {
		try {
			await open(verificationUrl);
			writeLine(infoStream, "Opening browser automatically...");
		} catch {
			writeLine(
				infoStream,
				"Could not open browser automatically. Please visit the URL above.",
			);
		}
	}

	// Step 4: Poll for authorization
	const spinner = ora("Waiting for authorization...").start();
	const expiresAt = Date.now() + expires_in * 1000;

	while (Date.now() < expiresAt) {
		await new Promise((resolve) => setTimeout(resolve, pollingInterval * 1000));

		try {
			const tokenResponse = await client.post<DeviceTokenResponse>(
				"/auth/device/token",
				{
					device_code,
					grant_type: "urn:ietf:params:oauth:grant-type:device_code",
				},
			);

			spinner.succeed("Authorization successful!");
			return tokenResponse.access_token;
		} catch (error) {
			// 1. Handle StructuredError (SDK converts to ResourceError)
			if (error instanceof ResourceError) {
				spinner.stop();
				throw new Error(formatStructuredError(error));
			}

			// 2. Handle RFC 8628 device auth errors
			if (error instanceof BusinessError) {
				const rfc8628Err = extractRfc8628Error(error);

				if (rfc8628Err) {
					switch (rfc8628Err.error) {
						case "authorization_pending":
							continue;

						case "slow_down":
							pollingInterval += 5;
							continue;

						case "expired_token":
							spinner.fail("Authorization expired");
							throw new Error(
								rfc8628Err.error_description ||
									"Device authorization expired. Please try again.",
							);

						case "access_denied":
							spinner.fail("Authorization denied");
							throw new Error(
								rfc8628Err.error_description ||
									"You denied the authorization request.",
							);

						default:
							spinner.fail("Authorization failed");
							throw new Error(
								`Authorization failed: ${rfc8628Err.error_description || rfc8628Err.error}`,
							);
					}
				}
			}

			spinner.fail("Request failed");
			throw error;
		}
	}

	spinner.fail("Authorization timed out");
	throw new Error("Authorization timed out. Please try again.");
}

export async function runLoginCommand(
	input: LoginCommandInput,
	context: CommandContext,
): Promise<number> {
	try {
		if (input.printToken && input.manual) {
			throw new Error("--print-token is not compatible with --manual");
		}

		const baseURL =
			input.url || context.env.PHALA_CLOUD_API_PREFIX || DEFAULT_API_PREFIX;

		let apiKey: string;
		let user: AuthResponse | undefined;

		// Decide authentication method
		if (input.apiKey) {
			apiKey = input.apiKey;
			user = await validateApiKey({ apiKey, baseURL });
		} else if (input.manual) {
			const result = await promptForApiKey({ baseURL });
			apiKey = result.apiKey;
			user = result.user;
		} else {
			apiKey = await runDeviceAuthFlow(context, {
				noOpen: input.noOpen,
				printToken: input.printToken,
				baseURL,
			});
			user = await validateApiKey({ apiKey, baseURL });
		}

		if (!user) throw new Error("Failed to validate API key");

		if (input.printToken) {
			// Machine-readable stdout output
			context.stdout.write(`${apiKey}\n`);
			return 0;
		}

		const workspaceName = user.workspace.name || "default";
		const workspaceSlug = user.workspace.slug || undefined;
		const profileName = input.profile || workspaceSlug || "default";

		upsertProfile({
			profileName,
			token: apiKey,
			apiPrefix: baseURL,
			workspaceName,
			workspaceSlug,
			user: {
				username: user.user.username,
				email: user.user.email,
			},
			setCurrent: true,
		});

		context.stdout.write(
			chalk.green(
				`Welcome ${user.user.username}! Credentials saved successfully (profile: ${profileName})\n`,
			),
		);
		return 0;
	} catch (error) {
		context.failWithError(error, {
			operation: "Login",
			debug: Boolean((input as { debug?: boolean }).debug),
		});
		return 1;
	}
}

export const loginCommand = defineCommand({
	path: ["login"],
	meta: loginCommandMeta,
	schema: loginCommandSchema,
	handler: runLoginCommand,
});

export default loginCommand;
