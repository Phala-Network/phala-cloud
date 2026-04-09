import {
	safeGetCvmList,
	safeGetCvmInfo,
	type Client,
	type CvmInfoDetailV20260121,
} from "@phala/cloud";
import { getClient } from "@/src/lib/client";
import { logger } from "@/src/utils/logger";
import {
	postCvmResponseSchema,
	cvmAttestationResponseSchema,
	getCvmNetworkResponseSchema,
	replicateCvmResponseSchema,
	type ReplicateCvmResponse,
} from "./types";
import type {
	PostCvmResponse,
	CvmAttestationResponse,
	GetCvmNetworkResponse,
	TeepodResponse,
	PubkeyResponse,
	UpgradeResponse,
} from "./types";
import inquirer from "inquirer";

/**
 * Get CVM by App ID using SDK
 * @param appId App ID (with or without app_ prefix)
 * @returns CVM details
 */
export async function getCvmByAppId(
	appId: string,
): Promise<CvmInfoDetailV20260121> {
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
	allow_restart?: number;
}

/**
 * Replicate a CVM instance
 * @param appId App ID (with or without app_ prefix)
 * @param vmUuid Source CVM UUID (with or without dashes)
 */
export async function replicateCvm(
	appId: string,
	vmUuid: string,
	payload: {
		teepod_id?: number;
		encrypted_env?: string;
	},
): Promise<ReplicateCvmResponse> {
	const client = await getClient();
	const cleanAppId = appId.replace(/^app_/, "");
	const response = await client.post<ReplicateCvmResponse>(
		`apps/${cleanAppId}/cvms/${vmUuid}/replicas`,
		payload,
	);
	return replicateCvmResponseSchema.parse(response);
}

/**
 * Resize a CVM's resources
 * @param appId App ID (with or without app_ prefix)
 * @param vcpu Number of virtual CPUs (optional)
 * @param memory Memory size in MB (optional)
 * @param diskSize Disk size in GB (optional)
 * @param allowRestart Whether to allow restart (1) or not (0) for the resize operation (optional)
 * @returns Success status
 */
export async function resizeCvm(
	appId: string,
	vcpu?: number,
	memory?: number,
	diskSize?: number,
	allowRestart?: number,
): Promise<boolean> {
	const client = await getClient();
	const cleanAppId = appId.replace(/^app_/, "");
	// Only include defined parameters in the payload
	const resizePayload: Record<string, unknown> = {};

	if (vcpu !== undefined) resizePayload.vcpu = vcpu;
	if (memory !== undefined) resizePayload.memory = memory;
	if (diskSize !== undefined) resizePayload.disk_size = diskSize;
	if (allowRestart !== undefined) resizePayload.allow_restart = allowRestart;

	// Check if any parameters were provided
	if (Object.keys(resizePayload).length === 0) {
		throw new Error("At least one resource parameter must be provided");
	}

	await client.patch(`cvms/app_${cleanAppId}/resources`, resizePayload);
	return true;
}

// ============================================
// Legacy Functions (for create/upgrade commands)
// These use the old API endpoints
// ============================================

/**
 * VM configuration type
 */
export interface VMConfig {
	[key: string]: unknown;
}

/**
 * Get public key from CVM (Legacy)
 * @deprecated This is a legacy function for create command
 * @param vmConfig VM configuration
 * @returns Public key
 */
export async function getPubkeyFromCvm(
	vmConfig: VMConfig,
): Promise<PubkeyResponse> {
	const client = await getClient();
	const response = await client.post(
		"cvms/pubkey/from_cvm_configuration",
		vmConfig,
	);
	return response as PubkeyResponse;
}

/**
 * Create a new CVM (Legacy)
 * @deprecated This is a legacy function, consider using SDK's provisionCvm
 * @param vmConfig VM configuration
 * @returns Created CVM details
 */
export async function createCvm(vmConfig: VMConfig): Promise<PostCvmResponse> {
	const client = await getClient();
	const response = await client.post<PostCvmResponse>(
		"cvms/from_cvm_configuration",
		vmConfig,
	);
	return postCvmResponseSchema.parse(response);
}

/**
 * Upgrade a CVM (Legacy)
 * @deprecated This is a legacy function, consider using SDK's provisionCvmComposeFileUpdate
 * @param appId App ID (with or without app_ prefix)
 * @param vmConfig VM configuration
 * @returns Upgrade response
 */
export async function upgradeCvm(
	appId: string,
	vmConfig: VMConfig,
): Promise<UpgradeResponse> {
	const client = await getClient();
	const cleanAppId = appId.replace(/^app_/, "");
	const response = await client.put(`cvms/app_${cleanAppId}/compose`, vmConfig);
	return response as UpgradeResponse;
}

/**
 * Get all TEEPods with their images (Legacy)
 * @deprecated This is a legacy function for create command, use SDK's safeGetAvailableNodes instead
 * @param v03x_only Only get v0.3.x compatible nodes
 * @returns List of TEEPods with embedded images
 */
export async function getTeepods(v03x_only = false): Promise<TeepodResponse> {
	const client = await getClient();
	let url = "teepods/available";
	if (v03x_only) {
		url += "?v03x_only=1";
	}
	const response = await client.get(url);
	return response as TeepodResponse;
}

// ============================================
// Logs Functions
// ============================================

export interface SerialLogsOptions {
	tail?: number;
	timestamps?: boolean;
	/** RFC3339 timestamp or relative time (backend-dependent) */
	since?: string;
	/** RFC3339 timestamp or relative time (backend-dependent) */
	until?: string;
	/** Ask backend to return human-readable text output (recommended default). */
	text?: boolean;
	/** Ask backend to omit metadata wrappers if supported. */
	bare?: boolean;
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
		since?: string;
		until?: string;
		tail?: number;
		text?: boolean;
		bare?: boolean;
		timestamps?: boolean;
		follow?: boolean;
		ansi?: boolean;
	},
): string {
	const params: string[] = [];
	if (options.since) params.push(`since=${encodeURIComponent(options.since)}`);
	if (options.until) params.push(`until=${encodeURIComponent(options.until)}`);
	if (options.follow) params.push("follow");
	if (options.text) params.push("text");
	if (options.bare) params.push("bare");
	if (options.tail !== undefined) {
		// Backend supports `tail`; keep `lines` for backward compatibility.
		params.push(`tail=${options.tail}`);
		params.push(`lines=${options.tail}`);
	}
	if (options.timestamps) params.push("timestamps");
	if (options.ansi ?? true) params.push("ansi");

	const sep = baseUrl.includes("?") ? "&" : "?";
	return baseUrl + sep + params.join("&");
}

/** Stream response body to callback */
async function streamResponse(
	response: Response,
	onData: (data: string) => void,
): Promise<void> {
	const reader = response.body?.getReader();
	if (!reader) throw new Error("No response body available for streaming");

	const decoder = new TextDecoder();
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		onData(decoder.decode(value, { stream: true }));
	}
}

function isLikelyBase64(data: string): boolean {
	// Fast heuristic: base64 strings usually don't contain whitespace and only contain base64 alphabet
	// and optional padding '='.
	// We also require length to be a multiple of 4 to reduce false positives.
	if (!data) return false;
	if (/\s/.test(data)) return false;
	if (data.length % 4 !== 0) return false;
	return /^[A-Za-z0-9+/]+={0,2}$/.test(data);
}

function decodeBase64ToUtf8(data: string): string {
	if (!isLikelyBase64(data)) return data;

	try {
		return Buffer.from(data, "base64").toString("utf-8");
	} catch {
		return data;
	}
}

function parseStructuredLogLineToEntry(line: string): LogEntry | null {
	const trimmed = line.trim();
	if (!trimmed) return null;

	try {
		const parsed = JSON.parse(trimmed) as {
			channel?: string;
			message?: string;
		};
		if (typeof parsed.message !== "string") return null;

		const parsedChannel: LogChannel =
			parsed.channel === "stderr" ? "stderr" : "stdout";
		return {
			channel: parsedChannel,
			message: decodeBase64ToUtf8(parsed.message),
		};
	} catch {
		return null;
	}
}

function parseStructuredLogsToEntries(input: string): LogEntry[] {
	const lines = input.split(/\r?\n/);
	const out: LogEntry[] = [];
	for (const line of lines) {
		if (!line.trim()) continue;
		const entry = parseStructuredLogLineToEntry(line);
		if (entry) {
			out.push(entry);
			continue;
		}
		out.push({ channel: "stdout", message: `${line}\n` });
	}
	return out;
}

function decodeStructuredLogsText(input: string): string {
	// The backend may return NDJSON lines like:
	// {"channel":"stderr","message":"<base64>"}
	// We decode them into human-readable text.
	const lines = input.split(/\r?\n/);
	let out = "";
	for (const line of lines) {
		const entry = parseStructuredLogLineToEntry(line);
		if (entry) {
			out += entry.message;
			continue;
		}
		if (line.trim()) out += `${line}\n`;
	}
	return out;
}

async function streamStructuredLogsResponse(
	response: Response,
	onData: (data: string) => void,
): Promise<void> {
	const reader = response.body?.getReader();
	if (!reader) throw new Error("No response body available for streaming");

	const decoder = new TextDecoder();
	let buffer = "";
	let mode: "unknown" | "raw" | "structured" = "unknown";

	const flushStructuredLine = (line: string) => {
		const entry = parseStructuredLogLineToEntry(line);
		if (entry) {
			onData(entry.message);
			return;
		}
		if (line.trim()) onData(`${line}\n`);
	};

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		const chunk = decoder.decode(value, { stream: true });
		if (mode === "raw") {
			onData(chunk);
			continue;
		}

		buffer += chunk;

		if (mode === "unknown") {
			const probe = buffer.trimStart();
			// Heuristic: structured logs are NDJSON objects.
			if (probe.startsWith("{")) {
				mode = "structured";
			} else {
				mode = "raw";
				onData(buffer);
				buffer = "";
				continue;
			}
		}

		let idx = buffer.indexOf("\n");
		while (idx >= 0) {
			const line = buffer.slice(0, idx);
			buffer = buffer.slice(idx + 1);
			flushStructuredLine(line);
			idx = buffer.indexOf("\n");
		}
	}

	if (mode === "structured" && buffer.trim()) {
		flushStructuredLine(buffer);
	} else if (mode === "raw" && buffer) {
		onData(buffer);
	}
}

async function streamStructuredLogsEntriesResponse(
	response: Response,
	onEntry: (entry: LogEntry) => void,
): Promise<void> {
	const reader = response.body?.getReader();
	if (!reader) throw new Error("No response body available for streaming");

	const decoder = new TextDecoder();
	let buffer = "";
	let mode: "unknown" | "raw" | "structured" = "unknown";

	const flushStructuredLine = (line: string) => {
		const entry = parseStructuredLogLineToEntry(line);
		if (entry) {
			onEntry(entry);
			return;
		}
		if (line.trim()) onEntry({ channel: "stdout", message: `${line}\n` });
	};

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		const chunk = decoder.decode(value, { stream: true });
		if (mode === "raw") {
			onEntry({ channel: "stdout", message: chunk });
			continue;
		}

		buffer += chunk;

		if (mode === "unknown") {
			const probe = buffer.trimStart();
			if (probe.startsWith("{")) {
				mode = "structured";
			} else {
				mode = "raw";
				onEntry({ channel: "stdout", message: buffer });
				buffer = "";
				continue;
			}
		}

		let idx = buffer.indexOf("\n");
		while (idx >= 0) {
			const line = buffer.slice(0, idx);
			buffer = buffer.slice(idx + 1);
			flushStructuredLine(line);
			idx = buffer.indexOf("\n");
		}
	}

	if (mode === "structured" && buffer.trim()) {
		flushStructuredLine(buffer);
	} else if (mode === "raw" && buffer) {
		onEntry({ channel: "stdout", message: buffer });
	}
}

export type CvmLogChannel = "serial" | "stdout" | "stderr";

/** Get CVM-level (syslog) log endpoint URL for a given channel */
export async function getCvmLogEndpoint(
	appId: string,
	channel: CvmLogChannel,
): Promise<string> {
	// syslog_endpoint is not in the v20260121 schema. Force the legacy version
	// header so the backend returns CvmBasicInfo which includes the field.
	const client = await getClient();
	const rawInfo = await client.get<{ syslog_endpoint?: string | null }>(
		`cvms/${appId}`,
		{ headers: { "X-Phala-Version": "2025-10-28" } },
	);
	if (!rawInfo.syslog_endpoint) {
		throw new Error(`No syslog endpoint available for CVM '${appId}'`);
	}
	return `${rawInfo.syslog_endpoint}&ch=${channel}`;
}

/** Get serial log endpoint URL (backward compat wrapper) */
async function getSerialLogEndpoint(appId: string): Promise<string> {
	return getCvmLogEndpoint(appId, "serial");
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

/** Fetch serial logs from a CVM */
export async function fetchSerialLogs(
	appId: string,
	options: SerialLogsOptions = {},
): Promise<string> {
	const baseUrl = await getSerialLogEndpoint(appId);
	const url = buildLogUrl(baseUrl, options);
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(
			`Failed to fetch serial logs: ${response.status} ${response.statusText}`,
		);
	}
	return response.text();
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

	const text = options.text ?? true;
	const bare = options.bare ?? true;

	const url = buildLogUrl(baseUrl, {
		...options,
		text,
		bare,
	});
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(
			`Failed to fetch container logs: ${response.status} ${response.statusText}`,
		);
	}

	const body = await response.text();
	// If backend returned structured logs (NDJSON with base64 payloads), decode them.
	if (body.trimStart().startsWith("{")) {
		return decodeStructuredLogsText(body);
	}
	return body;
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

	// Request structured logs (NDJSON with channel + base64 message)
	const url = buildLogUrl(baseUrl, {
		...options,
		// Request structured logs (NDJSON with channel + message). We'll decode the
		// message (base64 when applicable) and optionally route stderr.
		text: false,
		bare: false,
	});
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(
			`Failed to fetch container logs: ${response.status} ${response.statusText}`,
		);
	}

	const body = await response.text();
	if (body.trimStart().startsWith("{")) {
		return parseStructuredLogsToEntries(body);
	}
	return [{ channel: "stdout", message: body }];
}

/** Stream container logs as structured entries. */
export async function streamContainerLogsEntries(
	appId: string,
	onEntry: (entry: LogEntry) => void,
	options: ContainerLogsOptions = {},
	signal?: AbortSignal,
): Promise<void> {
	const baseUrl = await getContainerLogEndpoint(
		appId,
		options.container,
		options.matchContainerIdPrefix ?? true,
	);

	const url = buildLogUrl(baseUrl, {
		...options,
		follow: true,
		text: false,
		bare: false,
	});
	const response = await fetch(url, { signal });
	if (!response.ok) {
		throw new Error(
			`Failed to stream container logs: ${response.status} ${response.statusText}`,
		);
	}

	await streamStructuredLogsEntriesResponse(response, onEntry);
}

/** Stream serial logs from a CVM */
export async function streamSerialLogs(
	appId: string,
	onData: (data: string) => void,
	options: SerialLogsOptions = {},
	signal?: AbortSignal,
): Promise<void> {
	const baseUrl = await getSerialLogEndpoint(appId);
	const url = buildLogUrl(baseUrl, { ...options, follow: true });
	const response = await fetch(url, { signal });
	if (!response.ok) {
		throw new Error(
			`Failed to stream serial logs: ${response.status} ${response.statusText}`,
		);
	}
	await streamResponse(response, onData);
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
	const baseUrl = await getContainerLogEndpoint(
		appId,
		options.container,
		options.matchContainerIdPrefix ?? true,
	);

	const text = options.text ?? true;
	const bare = options.bare ?? true;

	const url = buildLogUrl(baseUrl, {
		...options,
		follow: true,
		text,
		bare,
	});
	const response = await fetch(url, { signal });
	if (!response.ok) {
		throw new Error(
			`Failed to stream container logs: ${response.status} ${response.statusText}`,
		);
	}

	// Always use the structured-aware streamer: if the backend returns plain text,
	// it will fall back to raw streaming; if it returns structured logs, it will decode.
	await streamStructuredLogsResponse(response, onData);
}

/** Fetch CVM-level channel logs (serial/stdout/stderr) */
export async function fetchCvmChannelLogs(
	appId: string,
	channel: CvmLogChannel,
	options: SerialLogsOptions = {},
): Promise<string> {
	const baseUrl = await getCvmLogEndpoint(appId, channel);
	const url = buildLogUrl(baseUrl, options);
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(
			`Failed to fetch CVM ${channel} logs: ${response.status} ${response.statusText}`,
		);
	}
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
	const baseUrl = await getCvmLogEndpoint(appId, channel);
	const url = buildLogUrl(baseUrl, { ...options, follow: true });
	const response = await fetch(url, { signal });
	if (!response.ok) {
		throw new Error(
			`Failed to stream CVM ${channel} logs: ${response.status} ${response.statusText}`,
		);
	}
	await streamResponse(response, onData);
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
