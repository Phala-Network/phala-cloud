import { getClient } from "@/src/lib/client";
import { logger } from "@/src/utils/logger";
import {
	type CvmInfoDetailV20260522,
	LogAccessError,
	fetchContainerLogs as sdkFetchContainerLogs,
	fetchContainerLogsEntries as sdkFetchContainerLogsEntries,
	fetchCvmChannelLogs as sdkFetchCvmChannelLogs,
	getCvmLogEndpoint as sdkGetCvmLogEndpoint,
	safeGetCvmInfo,
	safeGetCvmList,
	streamContainerLogs as sdkStreamContainerLogs,
	streamContainerLogsEntries as sdkStreamContainerLogsEntries,
	streamCvmChannelLogs as sdkStreamCvmChannelLogs,
	type CvmLogChannel,
	type CvmLogEntry,
	type CvmLogsOptions,
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

export { LogAccessError };
export type { CvmLogChannel };
export type LogEntry = CvmLogEntry;

export interface SerialLogsOptions {
	tail?: number | "all";
	timestamps?: boolean;
	/** Absolute Unix seconds resolved at command start. */
	since?: number;
	/** Absolute Unix seconds resolved at command start. */
	until?: number;
}

export interface ContainerLogsOptions extends SerialLogsOptions {
	container?: string;
	matchContainerIdPrefix?: boolean;
}

function toSdkOptions(
	options: SerialLogsOptions | ContainerLogsOptions,
): CvmLogsOptions & { container?: string; matchContainerIdPrefix?: boolean } {
	return options;
}

export async function getCvmLogEndpoint(
	appId: string,
	channel: CvmLogChannel,
): Promise<string> {
	const client = await getClient();
	return sdkGetCvmLogEndpoint(client, appId, channel);
}

export async function fetchSerialLogs(
	appId: string,
	options: SerialLogsOptions = {},
): Promise<string> {
	return fetchCvmChannelLogs(appId, "serial", options);
}

export async function fetchContainerLogs(
	appId: string,
	options: ContainerLogsOptions = {},
): Promise<string> {
	const client = await getClient();
	return sdkFetchContainerLogs(client, appId, toSdkOptions(options));
}

export async function fetchContainerLogsEntries(
	appId: string,
	options: ContainerLogsOptions = {},
): Promise<LogEntry[]> {
	const client = await getClient();
	return sdkFetchContainerLogsEntries(client, appId, toSdkOptions(options));
}

export async function streamContainerLogsEntries(
	appId: string,
	onEntry: (entry: LogEntry) => void,
	options: ContainerLogsOptions = {},
	signal?: AbortSignal,
): Promise<void> {
	const client = await getClient();
	return sdkStreamContainerLogsEntries(
		client,
		appId,
		onEntry,
		toSdkOptions(options),
		signal,
	);
}

export async function streamSerialLogs(
	appId: string,
	onData: (data: string) => void,
	options: SerialLogsOptions = {},
	signal?: AbortSignal,
): Promise<void> {
	return streamCvmChannelLogs(appId, "serial", onData, options, signal);
}

export async function streamContainerLogs(
	appId: string,
	onData: (data: string) => void,
	options: ContainerLogsOptions = {},
	signal?: AbortSignal,
): Promise<void> {
	const client = await getClient();
	return sdkStreamContainerLogs(
		client,
		appId,
		onData,
		toSdkOptions(options),
		signal,
	);
}

export async function fetchCvmChannelLogs(
	appId: string,
	channel: CvmLogChannel,
	options: SerialLogsOptions = {},
): Promise<string> {
	const client = await getClient();
	return sdkFetchCvmChannelLogs(client, appId, channel, toSdkOptions(options));
}

export async function streamCvmChannelLogs(
	appId: string,
	channel: CvmLogChannel,
	onData: (data: string) => void,
	options: SerialLogsOptions = {},
	signal?: AbortSignal,
): Promise<void> {
	const client = await getClient();
	return sdkStreamCvmChannelLogs(
		client,
		appId,
		channel,
		onData,
		toSdkOptions(options),
		signal,
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
