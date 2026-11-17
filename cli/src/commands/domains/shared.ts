import {
	listDomains,
	safeGetCvmInfo,
	type DnsRecordCheck,
	type ExpectedDnsRecord,
	type WorkspaceDomain,
} from "@phala/cloud";
import { cvmIdOption } from "@/src/core/common-flags";
import { formatTable } from "@/src/lib/table";
import type { CliApiClient } from "@/src/lib/client";
import type { CommandContext } from "@/src/core/types";

/** External HTTPS port a custom domain is served on unless told otherwise. */
export const DEFAULT_DOMAIN_PORT = 443;

export const appIdOption = {
	name: "app-id",
	description: "App ID (hex identifier).",
	type: "string",
	target: "appId",
} as const;

export const portOption = {
	name: "port",
	description: `External HTTPS port the domain is served on (default ${DEFAULT_DOMAIN_PORT}).`,
	type: "number",
	target: "port",
} as const;

/**
 * App IDs travel as 40 hex characters, without prefixes. Case is kept: the
 * server matches app IDs exactly, and some apps carry mixed-case IDs.
 */
export function normalizeAppId(raw: string): string {
	return raw.trim().replace(/^app_/, "").replace(/^0x/, "");
}

/** The options that select an app, as the schemas of every domains command parse them. */
export interface AppSelector {
	appId?: string;
	cvmId?: string;
}

export const cvmSelectorOption = {
	...cvmIdOption,
	description:
		"CVM identifier (UUID, app_id, instance_id, or name); selects the CVM's app.",
} as const;

function assertSingleSelector(selector: AppSelector): void {
	if (selector.appId && selector.cvmId) {
		throw new Error("Pass one of --app-id or --cvm-id, not both.");
	}
}

/** The app ID of a CVM, looked up through the shared CVM identifier rules. */
async function resolveCvmAppId(
	client: CliApiClient,
	cvmId: string,
): Promise<string> {
	const result = await safeGetCvmInfo(client, { id: cvmId });
	if (!result.success) {
		const status = (result.error as { status?: unknown }).status;
		if (status === 404) throw new Error(`CVM ${cvmId} was not found.`);
		throw result.error.cause ?? result.error;
	}
	const appId = (result.data as { app_id?: string | null }).app_id;
	if (!appId) throw new Error(`CVM ${cvmId} has no app ID.`);
	return normalizeAppId(appId);
}

/**
 * The app a command works on, in order: `--app-id`, `--cvm-id`, `app_id` in
 * phala.toml, then the CVM identifier in phala.toml.
 */
export async function resolveAppId(
	client: CliApiClient,
	selector: AppSelector,
	context: Pick<CommandContext, "projectConfig">,
): Promise<string> {
	assertSingleSelector(selector);
	if (selector.appId) return normalizeAppId(selector.appId);
	if (selector.cvmId) return resolveCvmAppId(client, selector.cvmId);
	const { app_id, cvm_id } = context.projectConfig;
	if (app_id) return normalizeAppId(app_id);
	if (cvm_id) return resolveCvmAppId(client, cvm_id);
	throw new Error(
		"No app ID provided. Pass --app-id or --cvm-id, or run `phala link` to create phala.toml.",
	);
}

/**
 * The app that narrows a lookup by domain: `--app-id`, or the app of
 * `--cvm-id`. Undefined when neither is given; phala.toml is not consulted.
 */
export async function resolveAppFilter(
	client: CliApiClient,
	selector: AppSelector,
): Promise<string | undefined> {
	assertSingleSelector(selector);
	if (selector.appId) return normalizeAppId(selector.appId);
	if (selector.cvmId) return resolveCvmAppId(client, selector.cvmId);
	return undefined;
}

export function normalizeDomain(raw: string): string {
	return raw.trim().toLowerCase().replace(/\.$/, "");
}

/**
 * Find the binding for a domain.
 *
 * A domain can be bound to several apps of the workspace. `appId` narrows the
 * lookup; without it, more than one binding is ambiguous and the caller must
 * say which app it means.
 */
export async function resolveBinding(
	client: CliApiClient,
	domain: string,
	appId: string | undefined,
): Promise<WorkspaceDomain> {
	const bindings = await findBindings(client, domain, appId);
	if (bindings.length > 1) {
		const apps = bindings.map((item) => `  - ${describeApp(item)}`).join("\n");
		throw new Error(
			`Domain ${domain} is bound to more than one app. Pass --app-id or --cvm-id to pick one:\n${apps}`,
		);
	}
	return bindings[0] as WorkspaceDomain;
}

/** Every binding of a domain, narrowed to `appId` when given. Never empty. */
export async function findBindings(
	client: CliApiClient,
	domain: string,
	appId: string | undefined,
): Promise<WorkspaceDomain[]> {
	const result = await listDomains(client, {
		domain,
		page_size: 100,
		...(appId ? { app_id: normalizeAppId(appId) } : {}),
	});
	if (result.items.length === 0) {
		throw new Error(
			appId
				? `Domain ${domain} is not bound to app ${normalizeAppId(appId)}.`
				: `Domain ${domain} was not found in this workspace.`,
		);
	}
	return result.items;
}

export function describeApp(item: {
	app_id: string;
	app_name?: string | null;
}): string {
	return item.app_name ? `${item.app_name} (${item.app_id})` : item.app_id;
}

export function dnsStatus(item: {
	dns_verified_at?: string | null;
	dns_error?: string | null;
}): string {
	if (item.dns_verified_at) return "verified";
	return item.dns_error ? "error" : "pending";
}

function retryAfterSeconds(error: unknown): number | undefined {
	const response = (
		error as {
			response?: { headers?: { get?: (name: string) => string | null } };
		}
	).response;
	const header = response?.headers?.get?.("retry-after");
	const body = (error as { data?: unknown }).data;
	const fromBody =
		typeof body === "object" && body !== null
			? (body as { retry_after?: unknown }).retry_after
			: undefined;
	const value = Number(header ?? fromBody);
	return Number.isFinite(value) && value >= 0 ? value : undefined;
}

function isTurnstileRequired(error: unknown): boolean {
	const body = (error as { data?: unknown }).data;
	return (
		typeof body === "object" &&
		body !== null &&
		(body as { turnstile_required?: unknown }).turnstile_required === true
	);
}

/**
 * Turn the failures users can act on into plain messages. Everything else
 * (including the server's 409 message on add) is passed through unchanged.
 */
export function explainDomainError(error: unknown): unknown {
	const status = (error as { status?: unknown } | null)?.status;
	if (status === 404) return new Error("App or domain not found");
	if (status === 429) {
		const seconds = retryAfterSeconds(error);
		const wait = seconds === undefined ? "a while" : `${seconds} second(s)`;
		if (isTurnstileRequired(error)) {
			return new Error(
				`Your account hit the domain lookup limit, and the server now asks for a browser challenge the CLI cannot complete. Wait ${wait} and try again, or use the Phala Cloud dashboard.`,
			);
		}
		return new Error(`Too many domain requests. Wait ${wait} and try again.`);
	}
	return error;
}

export function failDomainError(
	context: CommandContext,
	error: unknown,
	operation: string,
	debug: boolean,
): number {
	context.failWithError(explainDomainError(error), { operation, debug });
	return 1;
}

/** Render DNS check results: what is published against what is expected. */
export function renderRecordChecks(records: readonly DnsRecordCheck[]): string {
	if (records.length === 0) return "  (no records)\n";
	return records
		.map((record) => {
			const lines = [
				`${record.is_valid ? "[ok]  " : "[fail]"} ${record.record_type} ${record.query_name}`,
				`         expected: ${record.expected_value}`,
				`         actual:   ${record.actual_value ?? "(not found)"}`,
			];
			if (record.warning_message) {
				lines.push(`         warning:  ${record.warning_message}`);
			}
			return `${lines.join("\n")}\n`;
		})
		.join("");
}

/** Render the records a user still has to publish. */
export function renderExpectedRecords(
	records: readonly ExpectedDnsRecord[],
): string {
	if (records.length === 0) return "  (none)\n";
	return `${formatTable(
		["TYPE", "NAME", "VALUE"],
		records.map((record) => ({
			TYPE: record.record_type,
			NAME: record.query_name,
			VALUE: record.expected_value,
		})),
	)}\n`;
}
