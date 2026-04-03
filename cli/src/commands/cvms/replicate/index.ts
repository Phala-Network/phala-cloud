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
	cvmsReplicateCommandMeta,
	cvmsReplicateCommandSchema,
	type CvmsReplicateCommandInput,
} from "./command";

interface ReplicaPreparePayload {
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

function getPreparePayload(error: ResourceError): ReplicaPreparePayload | null {
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
			| ReplicaPreparePayload["onchainStatus"]
			| undefined,
	};
}

function readPrivateKey(input: CvmsReplicateCommandInput): `0x${string}` {
	const privateKey = input.privateKey || process.env.PRIVATE_KEY;
	if (!privateKey) {
		throw new Error(
			"Private key is required for on-chain replica approval. Pass --private-key or set PRIVATE_KEY.",
		);
	}
	return privateKey as `0x${string}`;
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
			nodesError?.message || `Failed to resolve node name \"${trimmed}\"`,
		);
	}

	const matches = nodesResult.data.nodes.filter(
		(node) => node.name.toLowerCase() === trimmed.toLowerCase(),
	);
	if (matches.length === 0) {
		throw new Error(`Node \"${trimmed}\" not found.`);
	}
	if (matches.length > 1) {
		throw new Error(
			`Node name \"${trimmed}\" is ambiguous (${matches.length} matches). Use an explicit node ID.`,
		);
	}
	return matches[0].teepod_id;
}

function formatReplicaOutput(
	replica: Record<string, unknown>,
	context: CommandContext,
	sourceCvm?: {
		workspace?: { slug?: string | null; name?: string } | null;
		kms_type?: string | null;
	},
): void {
	if (isInJsonMode()) {
		context.success(replica);
		return;
	}

	const vmUuid = typeof replica.vm_uuid === "string" ? replica.vm_uuid : "";
	const workspaceSlug =
		sourceCvm?.workspace?.slug || context.projectConfig.slug || "";
	const workspaceName = sourceCvm?.workspace?.name || workspaceSlug || "-";
	const teamLabel =
		workspaceSlug && workspaceSlug !== workspaceName
			? `${workspaceName} (${workspaceSlug})`
			: workspaceSlug || workspaceName;
	const vmUuidCompact = vmUuid.replace(/-/g, "");
	const appUrl =
		workspaceSlug && vmUuidCompact && typeof replica.app_id === "string"
			? `${CLOUD_URL}/${workspaceSlug}/apps/${replica.app_id}/instances/${vmUuidCompact}`
			: typeof replica.app_url === "string"
				? replica.app_url
				: "-";
	const teepodName =
		typeof replica.teepod === "object" &&
		replica.teepod !== null &&
		"name" in replica.teepod &&
		typeof replica.teepod.name === "string"
			? replica.teepod.name
			: typeof replica.teepod_name === "string"
				? replica.teepod_name
				: "-";
	const kmsType = sourceCvm?.kms_type || "-";
	const lines = [
		`Source CVM ID:   ${context.cvmId?.id || replica.source_cvm_id || "-"}`,
		`Team:            ${teamLabel}`,
		`CVM UUID:        ${vmUuid || "-"}`,
		`App ID:          ${replica.app_id}`,
		`Name:            ${replica.name}`,
		`Status:          ${replica.status}`,
		`KMS:             ${kmsType}`,
		`Node:            ${teepodName} (ID: ${replica.teepod_id})`,
		`vCPUs:           ${replica.vcpu}`,
		`Memory:          ${replica.memory} MB`,
		`Disk Size:       ${replica.disk_size} GB`,
		`App URL:         ${appUrl}`,
	];
	context.stdout.write(`${lines.join("\n")}\n`);
}

function formatPrepareOutput(
	payload: ReplicaPreparePayload,
	context: CommandContext,
): void {
	if (isInJsonMode()) {
		context.success({ success: true, prepare_only: true, ...payload });
		return;
	}

	const ensureHex = (v: string) => (v && !v.startsWith("0x") ? `0x${v}` : v);
	const lines = [
		"CVM replica prepared successfully (pending on-chain approval).",
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
			"To complete the replica after on-chain approval:",
			"  phala cvms replicate <cvm-id> \\",
			"    --commit \\",
			`    --token ${payload.commitToken} \\`,
			`    --compose-hash ${composeHashHex} \\`,
			"    --transaction-hash <tx-hash>",
		);
	}
	context.stdout.write(`${lines.join("\n")}\n`);
}

async function commitReplica(
	client: Client<"2026-01-21">,
	sourceVmUuid: string,
	payload: {
		token: string;
		composeHash: string;
		transactionHash: string;
	},
): Promise<Record<string, unknown>> {
	return client.post(`/cvms/${sourceVmUuid}/commit-replica`, {
		token: payload.token,
		compose_hash: payload.composeHash,
		transaction_hash: payload.transactionHash,
	});
}

async function runCvmsReplicateCommand(
	input: CvmsReplicateCommandInput,
	context: CommandContext,
): Promise<number> {
	try {
		if (!context.cvmId) {
			context.fail(
				"No CVM ID provided. Use --interactive to select interactively.",
			);
			return 1;
		}

		const client = await getClient(context);
		const cvmResult = await safeGetCvmInfo(client, context.cvmId);
		if (!cvmResult.success) {
			throw cvmResult.error;
		}
		const sourceCvm = cvmResult.data;

		if (!sourceCvm.vm_uuid) {
			throw new Error("Source CVM has no vm_uuid");
		}

		if (input.commit) {
			if (!input.token) {
				throw new Error("--token is required for --commit mode");
			}
			if (!input.composeHash) {
				throw new Error("--compose-hash is required for --commit mode");
			}
			const replica = (await commitReplica(client, sourceCvm.vm_uuid, {
				token: input.token,
				composeHash: input.composeHash,
				transactionHash: input.transactionHash || "already-registered",
			})) as Record<string, unknown>;
			formatReplicaOutput(replica, context, sourceCvm);
			return 0;
		}

		const encryptedEnv = await loadEncryptedEnv(
			client,
			sourceCvm,
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

		try {
			const replica = (await client.post(
				`/cvms/${sourceCvm.vm_uuid}/replicas`,
				requestBody,
				{
					headers: input.prepareOnly ? { "X-Prepare-Only": "true" } : undefined,
				},
			)) as Record<string, unknown>;
			formatReplicaOutput(replica, context, sourceCvm);
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
				throw new Error(
					"Replica prepare response did not include a commit token",
				);
			}
			const kmsInfo = (preparePayload.kmsInfo ?? {}) as {
				chain?: Parameters<typeof safeCheckOnChainPrerequisites>[0]["chain"];
			};
			if (!kmsInfo.chain) {
				throw new Error(
					"Replica prepare response is missing chain info required for on-chain approval",
				);
			}
			if (!sourceCvm.app_id) {
				throw new Error(
					"Source CVM is missing app_id required for on-chain approval",
				);
			}

			const prereqs = await safeCheckOnChainPrerequisites({
				chain: kmsInfo.chain,
				rpcUrl: input.rpcUrl,
				appAddress: sourceCvm.app_id as `0x${string}`,
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
					formatPrepareOutput(preparePayload, context);
					throw new Error(
						`On-chain registration required: ${missing.join(", ")} not registered. Pass --private-key or set PRIVATE_KEY to register automatically, or use --prepare-only to handle registration separately.`,
					);
				}
				const typedKey = privateKey as `0x${string}`;

				if (needsDevice) {
					const deviceResult = await safeAddDevice({
						chain: kmsInfo.chain,
						rpcUrl: input.rpcUrl,
						appAddress: sourceCvm.app_id as `0x${string}`,
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
						chain: kmsInfo.chain,
						rpcUrl: input.rpcUrl,
						appId: sourceCvm.app_id as `0x${string}`,
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
						(receiptResult.data as { transactionHash?: string })
							.transactionHash || "already-registered",
					);
				}
			}

			const replica = (await commitReplica(client, sourceCvm.vm_uuid, {
				token: preparePayload.commitToken,
				composeHash: preparePayload.composeHash,
				transactionHash,
			})) as Record<string, unknown>;
			formatReplicaOutput(replica, context, sourceCvm);
			return 0;
		}
	} catch (error) {
		logger.error("Failed to create CVM replica");
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

export const cvmsReplicateCommand = defineCommand({
	path: ["cvms", "replicate"],
	meta: cvmsReplicateCommandMeta,
	schema: cvmsReplicateCommandSchema,
	handler: runCvmsReplicateCommand,
});

export default cvmsReplicateCommand;
