import {
	createClient,
	safeRevokeCurrentApiToken,
	type Client,
} from "@phala/cloud";
import { getApiVersionOverride } from "@/src/core/api-version";
import type { CommandContext } from "@/src/core/types";
import { resolveAuth, type ResolvedAuth } from "@/src/utils/credentials";
import { CLI_USER_AGENT } from "@/src/utils/cli-version";

const API_VERSION = "2026-11-11" as const;
const DEFAULT_REQUESTS_PER_MINUTE = 180;

/** Default request timeout (seconds) when no --timeout flag is supplied. */
export const DEFAULT_TIMEOUT_SECONDS = 60;

class RequestStartPacer {
	private nextStartAt = 0;

	constructor(private readonly intervalMs: number) {}

	async wait(): Promise<void> {
		const now = Date.now();
		const startAt = Math.max(now, this.nextStartAt);
		this.nextStartAt = startAt + this.intervalMs;
		const delayMs = startAt - now;
		if (delayMs > 0) {
			await new Promise((resolve) => setTimeout(resolve, delayMs));
		}
	}
}

interface SharedRequestBudget {
	readonly requestsPerMinute: number;
	readonly pacer: RequestStartPacer;
}

const requestBudgets = new Map<string, SharedRequestBudget>();

function resolveRequestsPerMinute(
	env: Record<string, string | undefined>,
): number {
	const raw = env.PHALA_CLOUD_REQUESTS_PER_MINUTE;
	if (raw === undefined) return DEFAULT_REQUESTS_PER_MINUTE;
	if (!/^[1-9]\d*$/.test(raw)) {
		throw new Error(
			"PHALA_CLOUD_REQUESTS_PER_MINUTE must be a positive integer",
		);
	}
	const value = Number(raw);
	if (!Number.isSafeInteger(value)) {
		throw new Error(
			"PHALA_CLOUD_REQUESTS_PER_MINUTE must be a positive integer",
		);
	}
	return value;
}

function getRequestPacer(
	auth: ResolvedAuth,
	env: Record<string, string | undefined>,
): RequestStartPacer {
	const requestsPerMinute = resolveRequestsPerMinute(env);
	const credential = auth.apiKey
		? `api-key:${auth.apiKey}`
		: auth.bearerToken
			? `bearer:${auth.bearerToken}`
			: "anonymous";
	const key = `${auth.baseURL.replace(/\/+$/, "")}|${credential}`;
	const existing = requestBudgets.get(key);
	if (existing) {
		if (existing.requestsPerMinute !== requestsPerMinute) {
			throw new Error(
				"Conflicting request rates for clients sharing one API credential",
			);
		}
		return existing.pacer;
	}
	const budget = {
		requestsPerMinute,
		pacer: new RequestStartPacer(60_000 / requestsPerMinute),
	};
	requestBudgets.set(key, budget);
	return budget.pacer;
}

export type CliApiClient = Client<typeof API_VERSION>;

/** Resolve the request timeout (seconds) the CLI will use for this command. */
export function resolveTimeoutSeconds(context?: AuthContextLike): number {
	return context?.globalOptions?.timeout ?? DEFAULT_TIMEOUT_SECONDS;
}

export interface ClientWithAuth {
	readonly client: CliApiClient;
	readonly auth: ResolvedAuth;
}

/**
 * The slice of the command context that decides which credentials, profile and
 * API endpoint a request uses. Every client is built from one of these, so a
 * helper that needs a client must be handed the context of the command that
 * called it; there is no ambient fallback to the default profile.
 */
export type AuthContextLike = Pick<
	CommandContext,
	"env" | "projectConfig" | "globalOptions"
>;

export function resolveAuthForContext(
	context: AuthContextLike,
	options?: {
		apiToken?: string;
		profile?: string;
	},
): ResolvedAuth {
	return resolveAuth({
		env: context.env,
		apiToken: options?.apiToken ?? context.globalOptions?.apiToken,
		profile: options?.profile ?? context.globalOptions?.profile,
		projectProfile: context.projectConfig.profile,
	});
}

export async function getClient(
	context: AuthContextLike,
	options?: {
		apiToken?: string;
		profile?: string;
	},
): Promise<CliApiClient> {
	const auth = resolveAuthForContext(context, options);
	const version = getApiVersionOverride() ?? API_VERSION;
	const timeoutSeconds = resolveTimeoutSeconds(context);
	const pacer = getRequestPacer(auth, context.env);
	return createClient({
		apiKey: auth.apiKey ?? undefined,
		bearerToken: auth.bearerToken ?? undefined,
		workspace: auth.workspace ?? undefined,
		baseURL: auth.baseURL,
		version,
		timeout: timeoutSeconds * 1000,
		headers: {
			"User-Agent": CLI_USER_AGENT,
		},
		onRequest: async () => {
			await pacer.wait();
		},
	}) as CliApiClient;
}

export async function getClientWithAuth(
	context: AuthContextLike,
	options?: {
		apiToken?: string;
		profile?: string;
	},
): Promise<ClientWithAuth> {
	const auth = resolveAuthForContext(context, options);
	return {
		client: await getClient(context, options),
		auth,
	};
}

export async function getClientWithKey(
	apiKey: string,
	options?: {
		baseURL?: string;
	},
): Promise<CliApiClient> {
	return getClient(
		{
			env: {
				...process.env,
				PHALA_CLOUD_API_KEY: apiKey,
				...(options?.baseURL
					? { PHALA_CLOUD_API_PREFIX: options.baseURL }
					: {}),
			},
			projectConfig: {},
		},
		{ apiToken: apiKey },
	);
}

export type RevokeTokenOutcome =
	| "revoked"
	| "already-invalid"
	| "unsupported"
	| "failed";

export interface RevokeTokenResult {
	readonly outcome: RevokeTokenOutcome;
	readonly message?: string;
}

/**
 * Best-effort server-side revocation of an API token via DELETE /tokens/self.
 *
 * Never throws — callers (logout / profiles delete / profiles refresh) treat
 * every outcome as non-fatal:
 * - "already-invalid" (401): the token was already revoked or expired
 * - "unsupported" (404): the server predates the self-revoke endpoint
 * - "failed": network or unexpected error
 */
export async function tryRevokeApiToken(options: {
	apiKey: string;
	baseURL: string;
}): Promise<RevokeTokenResult> {
	try {
		const client = await getClientWithKey(options.apiKey, {
			baseURL: options.baseURL,
		});
		const result = await safeRevokeCurrentApiToken(client);
		if (result.success) {
			return { outcome: "revoked" };
		}
		const status =
			"status" in result.error && typeof result.error.status === "number"
				? result.error.status
				: undefined;
		if (status === 401) {
			return { outcome: "already-invalid" };
		}
		if (status === 404) {
			return { outcome: "unsupported" };
		}
		return { outcome: "failed", message: result.error.message };
	} catch (error) {
		return {
			outcome: "failed",
			message: error instanceof Error ? error.message : String(error),
		};
	}
}
