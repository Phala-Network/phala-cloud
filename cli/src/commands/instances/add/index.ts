import fs from "node:fs";
import path from "node:path";
import {
	type PhalaCloudError,
	ResourceError,
	type Client,
	type ErrorLink,
	type EnvVar,
	safeAddComposeHash,
	safeAddDevice,
	safeCheckOnChainPrerequisites,
	safeGetAvailableNodes,
	safeGetAppCvms,
	safeGetCvmInfo,
	encryptEnvVars,
	formatErrorMessage,
	formatStructuredError,
} from "@phala/cloud";
import { getClient } from "@/src/lib/client";
import { getEncryptPubkey } from "@/src/commands/envs/get-encrypt-pubkey";
import { defineCommand } from "@/src/core/define-command";
import { isInJsonMode } from "@/src/core/json-mode";
import type { CommandContext } from "@/src/core/types";
import { CLOUD_URL } from "@/src/utils/constants";
import { logger } from "@/src/utils/logger";
import {
	instancesAddCommandMeta,
	instancesAddCommandSchema,
	type InstancesAddCommandInput,
} from "./command";

interface PreparePayload {
	composeHash: string;
	appId: string;
	deviceId: string;
	kmsInfo?: unknown;
	commitToken?: string;
	commitUrl?: string;
	apiCommitUrl?: string;
	onchainStatus?: {
		compose_hash_allowed: boolean;
		device_id_allowed: boolean;
		is_allowed: boolean;
	};
}

function parseEnvFile(filePath: string): EnvVar[] {
	const envContent = fs.readFileSync(filePath, "utf-8");
	return envContent
		.split("\n")
		.filter((line) => line.trim() !== "" && !line.trim().startsWith("#"))
		.map((line) => {
			const [key, ...value] = line.split("=");
			return {
				key: key.trim(),
				value: value.join("=").trim(),
			};
		});
}

function extractDetailsMap(error: ResourceError): Record<string, unknown> {
	const map: Record<string, unknown> = {};
	const details = (error.structuredDetails ?? []) as Array<{
		field?: string;
		value?: unknown;
	}>;
	for (const item of details) {
		if (item.field) {
			map[item.field] = item.value;
		}
	}
	return map;
}

function getPreparePayload(error: ResourceError): PreparePayload | null {
	const status = (error as unknown as { status?: number }).status;
	if (status !== 465) {
		return null;
	}
	const details = extractDetailsMap(error);
	return {
		composeHash: String(details.compose_hash ?? ""),
		appId: String(details.app_id ?? ""),
		deviceId: String(details.device_id ?? ""),
		kmsInfo: details.kms_info,
		commitToken: details.commit_token as string | undefined,
		commitUrl: details.commit_url as string | undefined,
		apiCommitUrl: details.api_commit_url as string | undefined,
		onchainStatus: details.onchain_status as
			| PreparePayload["onchainStatus"]
			| undefined,
	};
}

async function loadEncryptedEnv(
	client: Client<"2026-01-21">,
	sourceCvm: Parameters<typeof getEncryptPubkey>[1],
	envFile?: string,
): Promise<string | undefined> {
	if (!envFile) {
		return undefined;
	}
	const envPath = path.resolve(process.cwd(), envFile);
	if (!fs.existsSync(envPath)) {
		throw new Error(`Environment file not found: ${envPath}`);
	}
	const envVars = parseEnvFile(envPath);
	const pubkey = await getEncryptPubkey(client, sourceCvm);
	return encryptEnvVars(envVars, pubkey);
}

async function resolveNodeId(
	client: Client<"2026-01-21">,
	nodeInput?: string,
): Promise<number | undefined> {
	if (!nodeInput) {
		return undefined;
	}

	const trimmed = nodeInput.trim();
	if (/^\d+$/.test(trimmed)) {
		return Number.parseInt(trimmed, 10);
	}

	const nodesResult = await safeGetAvailableNodes(client);
	if (!nodesResult.success) {
		const nodesError = "error" in nodesResult ? nodesResult.error : undefined;
		throw new Error(
			nodesError?.message || `Failed to resolve node name "${trimmed}"`,
		);
	}

	const matches = nodesResult.data.nodes.filter(
		(node) => node.name.toLowerCase() === trimmed.toLowerCase(),
	);
	if (matches.length === 0) {
		throw new Error(`Node "${trimmed}" not found.`);
	}
	if (matches.length > 1) {
		throw new Error(
			`Node name "${trimmed}" is ambiguous (${matches.length} matches). Use an explicit node ID.`,
		);
	}
	return matches[0].teepod_id;
}

function formatInstanceOutput(
	instance: Record<string, unknown>,
	context: CommandContext,
): void {
	if (isInJsonMode()) {
		context.success(instance);
		return;
	}

	const vmUuid = typeof instance.vm_uuid === "string" ? instance.vm_uuid : "";
	const vmUuidCompact = vmUuid.replace(/-/g, "");
	const workspaceSlug = context.projectConfig.slug || "";
	const appUrl =
		workspaceSlug && vmUuidCompact && typeof instance.app_id === "string"
			? `${CLOUD_URL}/${workspaceSlug}/apps/${instance.app_id}/instances/${vmUuidCompact}`
			: typeof instance.app_url === "string"
				? instance.app_url
				: "-";
	const teepodName =
		typeof instance.teepod === "object" &&
		instance.teepod !== null &&
		"name" in instance.teepod &&
		typeof instance.teepod.name === "string"
			? instance.teepod.name
			: typeof instance.teepod_name === "string"
				? instance.teepod_name
				: "-";
	const lines = [
		`App ID:          ${instance.app_id || "-"}`,
		`CVM UUID:        ${vmUuid || "-"}`,
		`Name:            ${instance.name}`,
		`Status:          ${instance.status}`,
		`Node:            ${teepodName} (ID: ${instance.teepod_id})`,
		`vCPUs:           ${instance.vcpu}`,
		`Memory:          ${instance.memory} MB`,
		`Disk Size:       ${instance.disk_size} GB`,
		`App URL:         ${appUrl}`,
	];
	context.stdout.write(`${lines.join("\n")}\n`);
}

function formatPrepareOutput(
	payload: PreparePayload,
	context: CommandContext,
): void {
	if (isInJsonMode()) {
		context.success({ success: true, prepare_only: true, ...payload });
		return;
	}

	const ensureHex = (v: string) => (v && !v.startsWith("0x") ? `0x${v}` : v);
	const lines = [
		"App instance prepared successfully (pending on-chain approval).",
		"",
		`Compose Hash:    ${ensureHex(payload.composeHash)}`,
		`App ID:          ${ensureHex(payload.appId)}`,
		`Device ID:       ${ensureHex(payload.deviceId)}`,
	];
	if (payload.commitToken) {
		lines.push(`Commit Token:    ${payload.commitToken}`);
	}
	if (payload.commitUrl) {
		lines.push(`Commit URL:      ${payload.commitUrl}`);
	}
	if (payload.apiCommitUrl) {
		lines.push(`API Commit URL:  ${payload.apiCommitUrl}`);
	}
	if (payload.onchainStatus) {
		lines.push(
			"",
			"On-chain Status:",
			`  Compose Hash:  ${payload.onchainStatus.compose_hash_allowed ? "registered" : "NOT registered"}`,
			`  Device ID:     ${payload.onchainStatus.device_id_allowed ? "registered" : "NOT registered"}`,
		);
		if (payload.onchainStatus.is_allowed) {
			lines.push(
				"  All prerequisites met. You can commit with --transaction-hash already-registered.",
			);
		}
	}
	if (payload.commitToken) {
		const composeHashHex = payload.composeHash.startsWith("0x")
			? payload.composeHash
			: `0x${payload.composeHash}`;
		lines.push(
			"",
			"To complete the instance after on-chain approval:",
			`  phala instances add --app-id ${payload.appId} \\`,
			"    --commit \\",
			`    --token ${payload.commitToken} \\`,
			`    --compose-hash ${composeHashHex} \\`,
			"    --transaction-hash <tx-hash>",
		);
	}
	context.stdout.write(`${lines.join("\n")}\n`);
}

function resolveAppId(
	input: InstancesAddCommandInput,
	context: CommandContext,
): string {
	const appId = input.appId || context.projectConfig.app_id;
	if (!appId) {
		throw new Error(
			"No app ID provided. Pass --app-id or run `phala link` to create phala.toml with app_id.",
		);
	}
	return appId.replace(/^app_/, "").replace(/^0x/, "").toLowerCase();
}

async function runInstancesAddCommand(
	rawInput: InstancesAddCommandInput,
	context: CommandContext,
): Promise<number> {
	const input: InstancesAddCommandInput = {
		...rawInput,
		rpcUrl: rawInput.rpcUrl || process.env.ETH_RPC_URL,
	};

	try {
		const appId = resolveAppId(input, context);
		const client = await getClient(context);

		// Commit mode
		if (input.commit) {
			if (!input.token) {
				throw new Error("--token is required for --commit mode");
			}
			if (!input.composeHash) {
				throw new Error("--compose-hash is required for --commit mode");
			}
			const instance = (await client.post(`/apps/${appId}/instances`, {
				token: input.token,
				compose_hash: input.composeHash,
				transaction_hash: input.transactionHash || "already-registered",
			})) as Record<string, unknown>;
			formatInstanceOutput(instance, context);
			return 0;
		}

		// Get a CVM from the app for encrypt pubkey derivation
		const appCvmsResult = await safeGetAppCvms(client, { appId });
		if (!appCvmsResult.success || appCvmsResult.data.length === 0) {
			throw new Error(
				`No instances found for app ${appId}. Cannot derive encryption key.`,
			);
		}
		const templateCvmRef = appCvmsResult.data[0];
		if (!templateCvmRef.vm_uuid) {
			throw new Error("Template CVM has no vm_uuid");
		}

		// Fetch full CVM info for encrypt pubkey
		const cvmInfoResult = await safeGetCvmInfo(client, {
			id: templateCvmRef.vm_uuid,
		});
		if (!cvmInfoResult.success) {
			throw new Error(
				`Failed to fetch CVM info: ${cvmInfoResult.error?.message || "Unknown error"}`,
			);
		}
		const templateCvm = cvmInfoResult.data;

		// Build request body
		const encryptedEnv = await loadEncryptedEnv(
			client,
			templateCvm,
			input.envFile,
		);
		const resolvedNodeId = await resolveNodeId(client, input.nodeId);
		const requestBody: Record<string, unknown> = {};
		if (resolvedNodeId !== undefined) {
			requestBody.node_id = resolvedNodeId;
		}
		if (encryptedEnv) {
			requestBody.encrypted_env = encryptedEnv;
		}
		if (input.composeHash) {
			requestBody.compose_hash = input.composeHash;
		}
		if (input.composeFile) {
			const composePath = path.resolve(process.cwd(), input.composeFile);
			if (!fs.existsSync(composePath)) {
				throw new Error(`Docker Compose file not found: ${composePath}`);
			}
			requestBody.docker_compose_file = fs.readFileSync(composePath, "utf-8");
		}
		if (input.preLaunchScript) {
			const scriptPath = path.resolve(process.cwd(), input.preLaunchScript);
			if (!fs.existsSync(scriptPath)) {
				throw new Error(`Pre-launch script not found: ${scriptPath}`);
			}
			requestBody.pre_launch_script = fs.readFileSync(scriptPath, "utf-8");
		}

		try {
			const instance = (await client.post(
				`/apps/${appId}/instances`,
				requestBody,
				{
					headers: input.prepareOnly ? { "X-Prepare-Only": "true" } : undefined,
				},
			)) as Record<string, unknown>;
			formatInstanceOutput(instance, context);
			return 0;
		} catch (error) {
			if (!(error instanceof ResourceError)) {
				throw error;
			}

			const preparePayload = getPreparePayload(error);
			if (!preparePayload) {
				throw error;
			}

			if (input.prepareOnly) {
				formatPrepareOutput(preparePayload, context);
				return 0;
			}

			if (!preparePayload.commitToken) {
				throw new Error("Prepare response did not include a commit token");
			}

			const chain = (
				templateCvm as {
					kms_info?: {
						chain?: Parameters<
							typeof safeCheckOnChainPrerequisites
						>[0]["chain"];
					};
				}
			).kms_info?.chain;
			if (!chain) {
				throw new Error("App KMS info is missing chain configuration");
			}

			const prereqs = await safeCheckOnChainPrerequisites({
				chain: chain,
				rpcUrl: input.rpcUrl,
				appAddress: `0x${appId}` as `0x${string}`,
				deviceId: preparePayload.deviceId,
				composeHash: preparePayload.composeHash,
			});
			if (!prereqs.success) {
				const prereqError = "error" in prereqs ? prereqs.error : undefined;
				throw new Error(
					prereqError?.message || "Failed to check on-chain prerequisites",
				);
			}

			let transactionHash = input.transactionHash || "already-registered";
			const needsDevice = !prereqs.data.deviceAllowed;
			const needsCompose = !prereqs.data.composeHashAllowed;

			if (needsDevice || needsCompose) {
				const missing: string[] = [];
				if (needsCompose) {
					missing.push("compose hash");
				}
				if (needsDevice) {
					missing.push("device");
				}

				const privateKey = input.privateKey || process.env.PRIVATE_KEY;
				if (!privateKey) {
					// No signing key available — fall back to prepare/commit mode so the
					// user can register on-chain manually and finish with --commit.
					formatPrepareOutput(preparePayload, context);
					return 0;
				}
				const typedKey = privateKey as `0x${string}`;

				if (needsDevice) {
					const deviceResult = await safeAddDevice({
						chain: chain,
						rpcUrl: input.rpcUrl,
						appAddress: `0x${appId}` as `0x${string}`,
						deviceId: preparePayload.deviceId,
						privateKey: typedKey,
					});
					if (!deviceResult.success) {
						const deviceError =
							"error" in deviceResult ? deviceResult.error : undefined;
						throw new Error(
							deviceError?.message || "Failed to register device on-chain",
						);
					}
				}

				if (needsCompose) {
					const receiptResult = await safeAddComposeHash({
						chain: chain,
						rpcUrl: input.rpcUrl,
						appId: `0x${appId}` as `0x${string}`,
						composeHash: preparePayload.composeHash,
						privateKey: typedKey,
					});
					if (!receiptResult.success) {
						const receiptError =
							"error" in receiptResult ? receiptResult.error : undefined;
						throw new Error(
							receiptError?.message ||
								"Failed to register compose hash on-chain",
						);
					}
					transactionHash = String(
						(
							receiptResult.data as {
								transactionHash?: string;
							}
						).transactionHash || "already-registered",
					);
				}
			}

			const instance = (await client.post(`/apps/${appId}/instances`, {
				token: preparePayload.commitToken,
				compose_hash: preparePayload.composeHash,
				transaction_hash: transactionHash,
			})) as Record<string, unknown>;
			formatInstanceOutput(instance, context);
			return 0;
		}
	} catch (error) {
		logger.error("Failed to create app instance");
		if (error instanceof ResourceError) {
			process.stderr.write(`${formatStructuredError(error)}\n`);
			const links = error.links as ErrorLink[] | undefined;
			if (links && links.length > 0) {
				for (const link of links) {
					process.stderr.write(`  ${link.label}: ${link.url}\n`);
				}
			}
			return 1;
		}
		if (error instanceof Error) {
			process.stderr.write(`${formatErrorMessage(error as PhalaCloudError)}\n`);
			return 1;
		}
		logger.logDetailedError(error);
		return 1;
	}
}

export const instancesAddCommand = defineCommand({
	path: ["instances", "add"],
	meta: instancesAddCommandMeta,
	schema: instancesAddCommandSchema,
	handler: runInstancesAddCommand,
});

export default instancesAddCommand;
