import { createClient, type Client } from "@phala/cloud";
import { getApiVersionOverride } from "@/src/core/api-version";
import type { CommandContext } from "@/src/core/types";
import { getProjectConfig } from "@/src/utils/project-config";
import { resolveAuth, type ResolvedAuth } from "@/src/utils/credentials";

const API_VERSION = "2026-05-22" as const;

export type CliApiClient = Client<typeof API_VERSION>;

export interface ClientWithAuth {
	readonly client: CliApiClient;
	readonly auth: ResolvedAuth;
}

type AuthContextLike = Pick<
	CommandContext,
	"env" | "projectConfig" | "globalOptions"
>;

function getDefaultContext(): AuthContextLike {
	return {
		env: process.env,
		projectConfig: getProjectConfig(),
	};
}

export function resolveAuthForContext(
	context?: AuthContextLike,
	options?: {
		apiToken?: string;
		profile?: string;
	},
): ResolvedAuth {
	const ctx = context ?? getDefaultContext();
	return resolveAuth({
		env: ctx.env,
		apiToken: options?.apiToken ?? ctx.globalOptions?.apiToken,
		profile: options?.profile ?? ctx.globalOptions?.profile,
		projectProfile: ctx.projectConfig.profile,
	});
}

export async function getClient(
	context?: AuthContextLike,
	options?: {
		apiToken?: string;
		profile?: string;
	},
): Promise<CliApiClient> {
	const auth = resolveAuthForContext(context, options);
	const version = getApiVersionOverride() ?? API_VERSION;
	return createClient({
		apiKey: auth.apiKey ?? undefined,
		baseURL: auth.baseURL,
		version,
	}) as CliApiClient;
}

export async function getClientWithAuth(
	context?: AuthContextLike,
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
	const version = getApiVersionOverride() ?? API_VERSION;
	return createClient({
		apiKey,
		baseURL: options?.baseURL,
		version,
	}) as CliApiClient;
}
