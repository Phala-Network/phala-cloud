import { getClient } from "@/src/lib/client";
import { logger } from "@/src/utils/logger";
import {
	type Client,
	type CvmInfoDetailV20260522,
	safeGetCvmInfo,
	safeGetCvmList,
} from "@phala/cloud";
import inquirer from "inquirer";
import {
	cvmAttestationResponseSchema,
	getCvmNetworkResponseSchema,
} from "./types";
import type {
	CvmAttestationResponse,
	CvmCreateResourcesResponse,
	GetCvmNetworkResponse,
} from "./types";

/**
 * Get CVM by App ID using SDK
 * @param appId App ID (with or without app_ prefix)
 * @returns CVM details
 */
export async function getCvmByAppId(
	appId: string,
): Promise<CvmInfoDetailV20260522> {
	const client = await getClient();
	// Remove app_ prefix if present, SDK will add it back
	const cleanAppId = appId.replace(/^app_/, "");
	const result = await safeGetCvmInfo(client, { app_id: cleanAppId });

	if (!result.success) {
		throw new Error(result.error.message);
	}

	return result.data;
}

/**
 * Get CVM network information
 * @param appId App ID (with or without app_ prefix)
 * @returns Network information
 */
export async function getCvmNetwork(
	appId: string,
): Promise<GetCvmNetworkResponse> {
	const client = await getClient();
	const cleanAppId = appId.replace(/^app_/, "");
	const response = await client.get<GetCvmNetworkResponse>(
		`cvms/app_${cleanAppId}/network`,
	);
	return getCvmNetworkResponseSchema.parse(response);
}

/**
 * Presents a list of CVMs to the user and allows them to select one
 * @returns The selected CVM app ID or undefined if no CVMs exist
 */
export async function selectCvm(): Promise<string | undefined> {
	const listSpinner = logger.startSpinner("Fetching available CVMs");
	const client = await getClient();
	const result = await safeGetCvmList(client);
	listSpinner.stop(true);

	if (!result.success) {
		logger.error(`Failed to fetch CVMs: ${result.error.message}`);
		return undefined;
	}

	const { items } = result.data;

	if (items.length === 0) {
		logger.info("No CVMs found for your account");
		return undefined;
	}

	const choices = items.map((cvm) => ({
		name: `${cvm.name} (${cvm.app_id ?? cvm.id}) - ${cvm.status}`,
		value: cvm.app_id ?? cvm.id,
	}));

	const { selectedCvm } = await inquirer.prompt([
		{
			type: "list",
			name: "selectedCvm",
			message: "Select a CVM:",
			choices,
		},
	]);

	return selectedCvm;
}

/**
 * Get attestation information for a CVM
 * @param appId App ID (with or without app_ prefix)
 * @returns Attestation information
 */
export async function getCvmAttestation(
	appId: string,
): Promise<CvmAttestationResponse> {
	const client = await getClient();
	const cleanAppId = appId.replace(/^app_/, "");
	const response = await client.get<CvmAttestationResponse>(
		`cvms/app_${cleanAppId}/attestation`,
	);

	// Attempt to validate and return the response
	try {
		return cvmAttestationResponseSchema.parse(response);
	} catch (validationError) {
		logger.debug(
			`Validation error: ${validationError instanceof Error ? validationError.message : String(validationError)}`,
		);

		// If validation fails, create a normalized response object
		const normalizedResponse: CvmAttestationResponse = {
			is_online: Boolean(response?.is_online),
			is_public: Boolean(response?.is_public),
			error: typeof response?.error === "string" ? response.error : null,
			app_certificates: Array.isArray(response?.app_certificates)
				? response.app_certificates
				: null,
			tcb_info: response?.tcb_info || null,
			compose_file:
				typeof response?.compose_file === "string"
					? response.compose_file
					: null,
		};

		return normalizedResponse;
	}
}

/**
 * Resize payload type
 */
export interface ResizeCvmPayload {
	vcpu?: number;
	memory?: number;
	disk_size?: number;
}

/**
 * Resize a CVM's resources through PATCH /cvms/{id}. The CVM restarts when
 * the resize needs it.
 * @param appId App ID (with or without app_ prefix)
 * @param vcpu Number of virtual CPUs (optional)
 * @param memory Memory size in MB (optional)
 * @param diskSize Disk size in GB (optional)
 * @returns Success status
 */
export async function resizeCvm(
	appId: string,
	vcpu?: number,
	memory?: number,
	diskSize?: number,
): Promise<boolean> {
	const client = await getClient();
	const cleanAppId = appId.replace(/^app_/, "");
	// Only include defined parameters in the payload
	const resizePayload: Record<string, unknown> = {};

	if (vcpu !== undefined) resizePayload.vcpu = vcpu;
	if (memory !== undefined) resizePayload.memory = memory;
	if (diskSize !== undefined) resizePayload.disk_size = diskSize;

	// Check if any parameters were provided
	if (Object.keys(resizePayload).length === 0) {
		throw new Error("At least one resource parameter must be provided");
	}

	await client.patch(`cvms/app_${cleanAppId}`, resizePayload);
	return true;
}

/**
 * Get the CVM create resource graph.
 * @returns Nodes, KMS resources, gateway resources, and instance types for CVM creation
 */
export async function getCvmCreateResources(): Promise<CvmCreateResourcesResponse> {
	const client = await getClient();
	const response = await client.get("teepods/cvm-create-resources");
	return response as CvmCreateResourcesResponse;
}

// ============================================
// Logs Functions
// ============================================

export interface SerialLogsOptions {
	tail?: number;
	timestamps?: boolean;
	/** Absolute Unix seconds resolved at command start. */
	since?: number;
	/** Absolute Unix seconds resolved at command start. */
	until?: number;
}

export type LogChannel = "stdout" | "stderr";

export interface LogEntry {
	channel: LogChannel;
	message: string;
}

export interface ContainerLogsOptions extends SerialLogsOptions {
	container?: string;
	/**
	 * Whether to allow matching a container by its ID prefix.
	 *
	 * - cvms logs: true (default, for backward compatibility)
	 * - logs: false (only match by container name)
	 */
	matchContainerIdPrefix?: boolean;
}

interface ContainerInfo {
	id: string;
	names: string[];
	log_endpoint: string | null;
}

interface CvmCompositionResponse {
	containers: ContainerInfo[] | null;
}

/** Build log URL with query parameters */
function buildLogUrl(
	baseUrl: string,
	options: {
		since?: number;
		until?: number;
		tail?: number;
		timestamps?: boolean;
		follow?: boolean;
		format?: "text" | "ndjson";
	},
): string {
	const params: string[] = [];
	if (options.since !== undefined) {
		params.push(`since=${options.since}`);
	}
	if (options.until !== undefined) {
		params.push(`until=${options.until}`);
	}
	if (options.follow) params.push("follow=true");
	if (options.tail !== undefined) params.push(`tail=${options.tail}`);
	if (options.timestamps) params.push("timestamps=true");
	if (options.format) params.push(`format=${options.format}`);

	const sep = baseUrl.includes("?") ? "&" : "?";
	return `${baseUrl}${sep}${params.join("&")}`;
}

/** Stream response body to callback */
async function streamResponse(
	response: Response,
	onData: (data: string) => void,
): Promise<void> {
	const reader = response.body?.getReader();
	if (!reader) throw new Error("No response body available for streaming");

	const decoder = new TextDecoder();
	let buffer = "";
	let finished = false;
	try {
		while (true) {
			const { done, value } = await reader.read();
			buffer += decoder.decode(value, { stream: !done });
			let newline = buffer.indexOf("\n");
			while (newline >= 0) {
				const line = buffer.slice(0, newline + 1);
				buffer = buffer.slice(newline + 1);
				const content = line.replace(/\r?\n$/, "");
				if (content !== "[vmm heartbeat]" && content !== "[teepod heartbeat]") {
					throwTextStreamError(content);
					onData(line);
				}
				newline = buffer.indexOf("\n");
			}
			if (done) {
				finished = true;
				break;
			}
		}
		if (
			buffer &&
			buffer !== "[vmm heartbeat]" &&
			buffer !== "[teepod heartbeat]"
		) {
			throwTextStreamError(buffer);
			onData(buffer);
		}
	} finally {
		if (!finished) await reader.cancel().catch(() => {});
		reader.releaseLock();
	}
}

interface StructuredLogEntry extends LogEntry {
	timestamp?: string;
}

function logErrorHttpStatus(code: string): number | undefined {
	const statuses: Record<string, number> = {
		"ERR-17-001": 400,
		"ERR-17-002": 401,
		"ERR-17-003": 401,
		"ERR-17-004": 404,
		"ERR-17-005": 409,
		"ERR-17-006": 409,
		"ERR-17-007": 404,
		"ERR-17-008": 502,
		"ERR-17-009": 502,
		"ERR-17-010": 504,
		"ERR-17-011": 429,
		"ERR-17-012": 503,
		"ERR-17-013": 404,
	};
	return statuses[code];
}

export class LogAccessError extends Error {
	readonly code?: string;
	readonly httpStatus?: number;
	readonly suggestions: readonly string[];

	constructor(options: {
		message: string;
		code?: string;
		httpStatus?: number;
		suggestions?: readonly string[];
	}) {
		const details = options.code
			? `${options.code}: ${options.message}`
			: options.message;
		const suggestions = options.suggestions?.length
			? `\nSuggestions:\n${options.suggestions.map((suggestion) => `- ${suggestion}`).join("\n")}`
			: "";
		super(`${details}${suggestions}`);
		this.name = "LogAccessError";
		this.code = options.code;
		this.httpStatus =
			options.httpStatus ??
			(options.code ? logErrorHttpStatus(options.code) : undefined);
		this.suggestions = options.suggestions ?? [];
	}
}

async function throwResponseError(response: Response): Promise<never> {
	const body = await response.text();
	let envelope: {
		error_code?: unknown;
		message?: unknown;
		suggestions?: unknown;
	};
	try {
		envelope = JSON.parse(body) as typeof envelope;
	} catch {
		envelope = {};
	}
	const suggestions = Array.isArray(envelope.suggestions)
		? envelope.suggestions.filter(
				(item): item is string => typeof item === "string",
			)
		: [];
	throw new LogAccessError({
		code:
			typeof envelope.error_code === "string" ? envelope.error_code : undefined,
		message:
			typeof envelope.message === "string"
				? envelope.message
				: `HTTP ${response.status} ${response.statusText}`,
		httpStatus: response.status,
		suggestions,
	});
}

function throwTextStreamError(line: string): void {
	const match = /^\[error\] (ERR-17-\d{3}) (.*)$/.exec(line.trim());
	if (match) throw new LogAccessError({ code: match[1], message: match[2] });
}

function parseTimestampedMessage(message: string): {
	timestamp?: string;
	second?: number;
	message?: string;
} {
	const match =
		/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})) (.*)$/s.exec(
			message,
		);
	if (!match) return {};
	const time = Date.parse(match[1]);
	if (!Number.isFinite(time)) return {};
	return {
		timestamp: match[1],
		second: Math.floor(time / 1000),
		message: match[2],
	};
}

function formatFollowContainerEntry(
	entry: StructuredLogEntry,
	includeTimestamps: boolean,
): LogEntry {
	if (includeTimestamps)
		return { channel: entry.channel, message: entry.message };
	const timestamp = parseTimestampedMessage(entry.message);
	return {
		channel: entry.channel,
		message: timestamp.timestamp ? (timestamp.message ?? "") : entry.message,
	};
}

function parseStructuredLogLineToEntry(
	line: string,
): StructuredLogEntry | null {
	const trimmed = line.trim();
	if (!trimmed) return null;

	let parsed: {
		channel?: unknown;
		message?: unknown;
		error_code?: unknown;
		suggestions?: unknown;
	};
	try {
		parsed = JSON.parse(trimmed) as typeof parsed;
	} catch {
		throw new LogAccessError({ message: "Invalid NDJSON log record." });
	}

	if (typeof parsed.error_code === "string") {
		throw new LogAccessError({
			code: parsed.error_code,
			message:
				typeof parsed.message === "string"
					? parsed.message
					: "The log stream ended with an error.",
			suggestions: Array.isArray(parsed.suggestions)
				? parsed.suggestions.filter(
						(item): item is string => typeof item === "string",
					)
				: [],
		});
	}
	if (
		(parsed.channel !== "stdout" && parsed.channel !== "stderr") ||
		typeof parsed.message !== "string"
	) {
		throw new LogAccessError({ message: "Invalid NDJSON log record." });
	}

	const entry: StructuredLogEntry = {
		channel: parsed.channel,
		message: parsed.message,
	};
	const timestamp = parseTimestampedMessage(entry.message).timestamp;
	if (timestamp) entry.timestamp = timestamp;
	return entry;
}

function parseStructuredLogsToEntries(input: string): LogEntry[] {
	const entries: LogEntry[] = [];
	for (const line of input.split(/\r?\n/)) {
		const entry = parseStructuredLogLineToEntry(line);
		if (entry) entries.push(entry);
	}
	return entries;
}

function decodeStructuredLogsText(input: string): string {
	return parseStructuredLogsToEntries(input)
		.map((entry) => (entry.message === "" ? "\n" : entry.message))
		.join("");
}

async function streamNdjsonEntriesResponse(
	response: Response,
	onEntry: (entry: StructuredLogEntry) => void,
): Promise<void> {
	const reader = response.body?.getReader();
	if (!reader) throw new Error("No response body available for streaming");

	const decoder = new TextDecoder();
	let buffer = "";
	let finished = false;
	try {
		while (true) {
			const { done, value } = await reader.read();
			buffer += decoder.decode(value, { stream: !done });
			let newline = buffer.indexOf("\n");
			while (newline >= 0) {
				const entry = parseStructuredLogLineToEntry(buffer.slice(0, newline));
				if (entry) onEntry(entry);
				buffer = buffer.slice(newline + 1);
				newline = buffer.indexOf("\n");
			}
			if (done) {
				finished = true;
				break;
			}
		}
		if (buffer.trim()) {
			const entry = parseStructuredLogLineToEntry(buffer);
			if (entry) onEntry(entry);
		}
	} finally {
		if (!finished) await reader.cancel().catch(() => {});
		reader.releaseLock();
	}
}

export type CvmLogChannel = "serial" | "stdout" | "stderr";

function assertSupportedNodeLogOptions(options: SerialLogsOptions): void {
	const unsupported = [
		options.timestamps && "--timestamps",
		options.since !== undefined && "--since",
		options.until !== undefined && "--until",
	].filter((option): option is string => Boolean(option));
	if (unsupported.length > 0) {
		throw new Error(
			`${unsupported.join(", ")} not supported for serial/stdout/stderr logs`,
		);
	}
}

/** Get a presigned CVM-level log URL for a given node channel. */
export async function getCvmLogEndpoint(
	appId: string,
	channel: CvmLogChannel,
): Promise<string> {
	const info = await getCvmByAppId(appId);
	const endpoint = info.logs?.[channel];
	if (!endpoint) {
		throw new Error(`No ${channel} log endpoint available for CVM '${appId}'`);
	}
	return endpoint;
}

/** Get container log endpoint URL */
async function getContainerLogEndpoint(
	appId: string,
	containerName?: string,
	matchContainerIdPrefix = true,
): Promise<string> {
	const client = await getClient();
	// appId is already normalized by CvmIdSchema (e.g., "app_xxx" or "my-cvm-name")
	const composition = await client.get<CvmCompositionResponse>(
		`cvms/${appId}/composition`,
	);

	if (!composition.containers?.length) {
		throw new Error(`No containers found for CVM '${appId}'`);
	}

	let containers = composition.containers;
	if (containerName) {
		containers = containers.filter((c) => {
			const matchedByName = c.names.some(
				(n) => n === containerName || n === `/${containerName}`,
			);

			if (matchedByName) return true;
			if (!matchContainerIdPrefix) return false;
			return c.id.startsWith(containerName);
		});

		if (!containers.length) {
			throw new Error(
				`Container '${containerName}' not found in CVM '${appId}'`,
			);
		}
	}

	const container = containers.find((c) => c.log_endpoint);
	if (!container?.log_endpoint) {
		throw new Error(`No log endpoints available for CVM '${appId}'`);
	}
	return container.log_endpoint;
}

function waitForReconnect(
	signal: AbortSignal | undefined,
	delayMs: number,
): Promise<void> {
	if (signal?.aborted) return Promise.resolve();
	return new Promise((resolve) => {
		const timeout = setTimeout(() => {
			signal?.removeEventListener("abort", onAbort);
			resolve();
		}, delayMs);
		const onAbort = () => {
			clearTimeout(timeout);
			signal?.removeEventListener("abort", onAbort);
			resolve();
		};
		signal?.addEventListener("abort", onAbort, { once: true });
	});
}

function getErrorHttpStatus(error: unknown): number | undefined {
	if (typeof error !== "object" || error === null) return undefined;
	if ("httpStatus" in error && typeof error.httpStatus === "number") {
		return error.httpStatus;
	}
	if ("status" in error && typeof error.status === "number") {
		return error.status;
	}
	return undefined;
}

async function followLogRequests(
	resolveUrl: () => Promise<string>,
	consume: (response: Response) => Promise<void>,
	signal?: AbortSignal,
	refreshCvm?: () => Promise<void>,
): Promise<void> {
	let failureCount = 0;
	let expiredRetries = 0;
	while (!signal?.aborted) {
		try {
			const url = await resolveUrl();
			if (signal?.aborted) return;
			const response = await fetch(url, { signal });
			if (!response.ok) await throwResponseError(response);
			failureCount = 0;
			await consume(response);
			expiredRetries = 0;
			if (signal?.aborted) return;
		} catch (error) {
			if (
				signal?.aborted ||
				(error instanceof Error && error.name === "AbortError")
			) {
				return;
			}

			let retryError = error;
			if (error instanceof LogAccessError && error.code === "ERR-17-003") {
				expiredRetries += 1;
				if (expiredRetries > 3) throw error;
				try {
					await refreshCvm?.();
					continue;
				} catch (refreshError) {
					retryError = refreshError;
				}
			}

			const status = getErrorHttpStatus(retryError);
			if (status !== undefined && status < 500) throw retryError;
			if (retryError instanceof LogAccessError && status === undefined) {
				throw retryError;
			}

			failureCount += 1;
			if (failureCount >= 5) throw retryError;
			const delayMs = Math.min(250 * 2 ** (failureCount - 1), 5000);
			await waitForReconnect(signal, delayMs);
		}
	}
}

/** Fetch serial logs from a CVM */
export async function fetchSerialLogs(
	appId: string,
	options: SerialLogsOptions = {},
): Promise<string> {
	return fetchCvmChannelLogs(appId, "serial", options);
}

/**
 * Fetch container logs from a CVM
 * Note: Fetches from a single container. Use --container to specify which one,
 * otherwise fetches from the first container with a log endpoint.
 */
export async function fetchContainerLogs(
	appId: string,
	options: ContainerLogsOptions = {},
): Promise<string> {
	const baseUrl = await getContainerLogEndpoint(
		appId,
		options.container,
		options.matchContainerIdPrefix ?? true,
	);

	const url = buildLogUrl(baseUrl, { ...options, format: "ndjson" });
	const response = await fetch(url);
	if (!response.ok) await throwResponseError(response);

	return decodeStructuredLogsText(await response.text());
}

/**
 * Fetch container logs as structured entries.
 *
 * This is useful when you want to route container stderr to process.stderr
 * (like docker does internally).
 */
export async function fetchContainerLogsEntries(
	appId: string,
	options: ContainerLogsOptions = {},
): Promise<LogEntry[]> {
	const baseUrl = await getContainerLogEndpoint(
		appId,
		options.container,
		options.matchContainerIdPrefix ?? true,
	);

	const url = buildLogUrl(baseUrl, { ...options, format: "ndjson" });
	const response = await fetch(url);
	if (!response.ok) await throwResponseError(response);

	return parseStructuredLogsToEntries(await response.text());
}

/** Stream container logs as structured entries. */
export async function streamContainerLogsEntries(
	appId: string,
	onEntry: (entry: LogEntry) => void,
	options: ContainerLogsOptions = {},
	signal?: AbortSignal,
): Promise<void> {
	const cursor: {
		since?: number;
		boundarySecond?: number;
		boundaryCounts: Map<string, number>;
	} = { since: options.since, boundaryCounts: new Map() };
	let replayCounts = new Map<string, number>();
	let firstRequest = true;

	const buildRequestUrl = async (): Promise<string> => {
		const baseUrl = await getContainerLogEndpoint(
			appId,
			options.container,
			options.matchContainerIdPrefix ?? true,
		);
		const tail = firstRequest ? options.tail : undefined;
		firstRequest = false;
		replayCounts = new Map(cursor.boundaryCounts);
		return buildLogUrl(baseUrl, {
			since: cursor.since,
			until: options.until,
			tail,
			follow: true,
			timestamps: true,
			format: "ndjson",
		});
	};

	await followLogRequests(
		buildRequestUrl,
		(response) =>
			streamNdjsonEntriesResponse(response, (entry) => {
				const timestamp = parseTimestampedMessage(entry.message);
				if (timestamp.second === undefined || !timestamp.timestamp) {
					onEntry(
						formatFollowContainerEntry(entry, options.timestamps ?? false),
					);
					return;
				}

				const key = JSON.stringify([entry.channel, entry.message]);
				if (
					cursor.boundarySecond !== undefined &&
					timestamp.second < cursor.boundarySecond
				) {
					onEntry(
						formatFollowContainerEntry(entry, options.timestamps ?? false),
					);
					return;
				}
				if (timestamp.second === cursor.boundarySecond) {
					const replayCount = replayCounts.get(key) ?? 0;
					if (replayCount > 0) {
						replayCounts.set(key, replayCount - 1);
						return;
					}
				} else if (
					cursor.boundarySecond === undefined ||
					timestamp.second > cursor.boundarySecond
				) {
					cursor.boundarySecond = timestamp.second;
					cursor.boundaryCounts.clear();
				}

				cursor.since = Math.max(
					cursor.since ?? timestamp.second,
					timestamp.second,
				);
				cursor.boundaryCounts.set(
					key,
					(cursor.boundaryCounts.get(key) ?? 0) + 1,
				);
				onEntry(formatFollowContainerEntry(entry, options.timestamps ?? false));
			}),
		signal,
		async () => {
			await getCvmByAppId(appId);
		},
	);
}

/** Stream serial logs from a CVM */
export async function streamSerialLogs(
	appId: string,
	onData: (data: string) => void,
	options: SerialLogsOptions = {},
	signal?: AbortSignal,
): Promise<void> {
	return streamCvmChannelLogs(appId, "serial", onData, options, signal);
}

/**
 * Stream container logs from a CVM
 * Note: Streams from a single container. Use --container to specify which one,
 * otherwise streams from the first container with a log endpoint.
 */
export async function streamContainerLogs(
	appId: string,
	onData: (data: string) => void,
	options: ContainerLogsOptions = {},
	signal?: AbortSignal,
): Promise<void> {
	return streamContainerLogsEntries(
		appId,
		(entry) => onData(entry.message === "" ? "\n" : entry.message),
		options,
		signal,
	);
}

/** Fetch CVM-level channel logs (serial/stdout/stderr) */
export async function fetchCvmChannelLogs(
	appId: string,
	channel: CvmLogChannel,
	options: SerialLogsOptions = {},
): Promise<string> {
	assertSupportedNodeLogOptions(options);
	const baseUrl = await getCvmLogEndpoint(appId, channel);
	const url = buildLogUrl(baseUrl, {
		since: options.since,
		until: options.until,
		tail: options.tail,
	});
	const response = await fetch(url);
	if (!response.ok) await throwResponseError(response);
	return response.text();
}

/** Stream CVM-level channel logs (serial/stdout/stderr) */
export async function streamCvmChannelLogs(
	appId: string,
	channel: CvmLogChannel,
	onData: (data: string) => void,
	options: SerialLogsOptions = {},
	signal?: AbortSignal,
): Promise<void> {
	assertSupportedNodeLogOptions(options);
	let firstRequest = true;
	await followLogRequests(
		async () => {
			const baseUrl = await getCvmLogEndpoint(appId, channel);
			const tail = firstRequest ? options.tail : 0;
			firstRequest = false;
			return buildLogUrl(baseUrl, {
				since: options.since,
				until: options.until,
				tail,
				follow: true,
			});
		},
		(response) => streamResponse(response, onData),
		signal,
		async () => {
			await getCvmByAppId(appId);
		},
	);
}

/** Get CVM status string (e.g. "running", "stopped") */
export async function getCvmStatus(appId: string): Promise<string> {
	const client = await getClient();
	const cleanAppId = appId.replace(/^app_/, "");
	const result = await safeGetCvmInfo(client, { app_id: cleanAppId });
	if (!result.success) {
		throw new Error(result.error.message);
	}
	return result.data.status;
}
