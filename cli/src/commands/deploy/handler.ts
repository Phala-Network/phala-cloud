import path from "node:path";
import os from "node:os";
import type { CommandContext } from "@/src/core/types";
import { resolveAuthForContext } from "@/src/lib/client";
import { logger } from "@/src/utils/logger";
import {
	CLOUD_URL,
	DEFAULT_DISK_SIZE,
	DEFAULT_MEMORY,
	DEFAULT_VCPU,
} from "@/src/utils/constants";
import { waitForCvmReady } from "@/src/utils/cvms";

import { detectFileInCurrentDir, promptForFile } from "@/src/utils/prompts";
import { dedupeEnvVars, parseEnvInputs } from "@/src/utils/env-parsing";
import { parseDiskSizeInput, parseMemoryInput } from "@/src/utils/units";
import {
	type Client,
	type EnvVar,
	type ErrorLink,
	CvmIdSchema,
	MAX_COMPOSE_PAYLOAD_BYTES,
	ResourceError,
	createClient,
	encryptEnvVars,
	formatStructuredError,
	parseEnvVars,
	safeAddComposeHash,
	safeAddDevice,
	safeCheckOnChainPrerequisites,
	safeCommitCvmProvision,
	safeConfirmCvmPatch,
	safeDeployAppAuth,
	safeGetAppEnvEncryptPubKey,
	safeGetAvailableNodes,
	safeGetCvmInfo,
	safeGetCvmList,
	safeGetCurrentUser,
	safePatchCvm,
	safeProvisionCvm,
	safeUpdateCvmVisibility,
	safeCommitCvmUpdate,
	convertToHostname,
	isValidHostname,
	getMrConfigId,
	type MrConfigIdInput,
} from "@phala/cloud";
import dedent from "dedent";
import fs from "fs-extra";
import inquirer from "inquirer";
import type { DeployCommandInput } from "./command";
import type { RuntimeProjectConfig } from "@/src/utils/project-config";

type PrivacyConfig = Pick<
	RuntimeProjectConfig,
	"public_logs" | "public_sysinfo" | "listed"
> & { public_tcbinfo?: boolean; secure_time?: boolean };

interface Options {
	name?: string;
	compose?: string;
	instanceType?: string;
	vcpu?: string;
	memory?: string;
	diskSize?: string;
	fs?: string;
	image?: string;
	region?: string;
	nodeId?: string;
	env?: string[];
	envFile?: string | boolean;
	interactive?: boolean;
	kms?: string;
	kmsId?: string;
	kmsContract?: string;
	kmsContractId?: string;
	keyProviderMode?: "kms" | "local";
	skipGateway?: boolean;
	cvmId?: string;
	uuid?: string;
	customAppId?: string;
	nonce?: string;
	preLaunchScript?: string;
	privateKey?: string;
	rpcUrl?: string;
	json?: boolean;
	debug?: boolean;
	apiToken?: string;
	wait?: boolean;
	sshPubkey?: string;
	devOs?: boolean;
	publicLogs?: boolean;
	publicSysinfo?: boolean;
	publicTcbinfo?: boolean;
	secureTime?: boolean;
	listed?: boolean;
	experimentalKeyProviderType?: "kms" | "local" | "tpm";
	prepareOnly?: boolean;
	commit?: boolean;
	token?: string;
	composeHash?: string;
	transactionHash?: string;
	[key: string]: unknown;
}

/**
 * Handle provision error with structured error response
 */
function handleProvisionError(
	error: unknown,
	options: Options,
): string | object {
	// Check if it's a ResourceError with structured details
	if (error instanceof ResourceError) {
		if (options.json) {
			return {
				success: false,
				error_code: error.errorCode,
				message: error.message,
				details: error.structuredDetails,
				suggestions: error.suggestions,
				links: error.links,
			};
		}
		return formatStructuredError(error);
	}

	// Parse structured error from plain object (backward compatibility)
	if (error && typeof error === "object" && "response" in error) {
		const errorWithResponse = error as {
			response?: {
				data?: {
					detail?: unknown;
				};
			};
		};
		const errorData = errorWithResponse.response?.data?.detail;
		if (
			errorData &&
			typeof errorData === "object" &&
			"error_code" in errorData
		) {
			const { error_code, message, details, suggestions, links } =
				errorData as {
					error_code: string;
					message: string;
					details?: Array<{
						field?: string;
						value?: unknown;
						message?: string;
					}>;
					suggestions?: string[];
					links?: Array<{ url: string; label: string }>;
				};

			if (options.json) {
				return {
					success: false,
					error_code,
					message,
					details,
					suggestions,
					links,
				};
			}

			let output = `\nError [${error_code}]: ${message}\n`;

			if (details && details.length > 0) {
				output += "\nDetails:\n";
				for (const d of details) {
					if (d.message) {
						output += `  - ${d.message}\n`;
					} else if (d.field && d.value !== undefined) {
						output += `  - ${d.field}: ${d.value}\n`;
					}
				}
			}

			if (suggestions && suggestions.length > 0) {
				output += "\nSuggestions:\n";
				for (const s of suggestions) {
					output += `  - ${s}\n`;
				}
			}

			if (links && links.length > 0) {
				output += "\nLearn more:\n";
				for (const link of links) {
					output += `  - ${link.label}: ${link.url}\n`;
				}
			}

			return output;
		}
	}

	// Fallback to generic error
	const message =
		error instanceof Error ? error.message : String(error || "Unknown error");
	return options.json
		? { success: false, error: message }
		: `\nError: ${message}\n`;
}

const API_VERSION = "2026-05-22" as const;

async function getApiClient({
	context,
	apiToken,
	interactive,
}: Readonly<
	Pick<Options, "apiToken" | "interactive"> & {
		context?: Pick<CommandContext, "env" | "projectConfig" | "globalOptions">;
	}
>): Promise<Client<typeof API_VERSION>> {
	const resolved = resolveAuthForContext(context, { apiToken });
	if (resolved.apiKey) {
		return createClient({
			apiKey: resolved.apiKey,
			baseURL: resolved.baseURL,
			version: API_VERSION,
		});
	}

	if (interactive) {
		const { apiToken: promptedToken } = await inquirer.prompt([
			{
				type: "password",
				name: "apiToken",
				message: "Enter your API token:",
				validate: (input: string) =>
					input.trim() ? true : "API token is required",
			},
		]);
		return createClient({
			apiKey: promptedToken,
			baseURL: resolved.baseURL,
			version: API_VERSION,
		});
	}

	throw new Error(
		"API token is required. Please run 'phala login' or set PHALA_CLOUD_API_KEY environment variable",
	);
}

async function readDockerComposeFile({
	dockerComposePath,
	interactive,
}: {
	dockerComposePath?: string;
	interactive: boolean;
}): Promise<string> {
	// 1. If path is not provided and we're in interactive mode, try to detect it
	if (!dockerComposePath) {
		if (interactive) {
			const possibleFiles = ["docker-compose.yml", "docker-compose.yaml"];
			const composeFileName = detectFileInCurrentDir(
				possibleFiles,
				"Detected docker compose file: {path}",
			);
			dockerComposePath = await promptForFile(
				"Enter the path to your Docker Compose file:",
				composeFileName,
				"file",
			);
		} else {
			throw new Error(
				dedent(`
                       Docker Compose file is required.

                           Usage examples:
                           phala deploy -c docker-compose.yml
                       phala deploy --kms ethereum --private-key <your-private-key> --rpc-url <rpc-url> -c docker-compose.yml

                       Minimal required parameters:
                           -c, --compose <path>    Path to docker-compose.yml

                       For on-chain KMS, also provide:
                           --kms <type>            KMS type (phala, ethereum, base)
                           --private-key <key>     Private key for deployment
                           --rpc-url <url>         RPC URL for the blockchain

                               Run with --interactive for guided setup
                                   `),
			);
		}
	}

	// 2. Validate the file exists
	if (!fs.existsSync(dockerComposePath)) {
		throw new Error(`Docker compose file not found: ${dockerComposePath}`);
	}

	// 3. Read and return the file content
	return fs.readFileSync(dockerComposePath, "utf8");
}

const validatePrivateKey = async (
	options: Options,
	chainId: string | number | undefined,
): Promise<string | undefined> => {
	// 1. Get private key from options or environment
	let privateKey = options.privateKey || process.env.PRIVATE_KEY;

	// 2. Handle on-chain KMS related validations
	// If chainId is present, we will perform on-chain operations and require a private key.
	if (chainId) {
		if (!options.privateKey) {
			if (options.interactive) {
				const result = await inquirer.prompt([
					{
						type: "password",
						name: "privateKey",
						message: "Enter your private key:",
						validate: (input: string) =>
							input.trim() ? true : "Private key is required",
					},
				]);
				privateKey = result.privateKey;
			} else {
				throw new Error(
					"When using on-chain KMS, either --private-key (or PRIVATE_KEY env) must be provided",
				);
			}
		}
	}
	return privateKey;
};

function resolveKmsSelection(options: Options): {
	kmsType: "PHALA" | "ETHEREUM" | "BASE";
	deprecatedKmsId?: string;
} {
	if (options.kmsId) {
		logger.warn("--kms-id is deprecated. Use --kms instead.");
	}

	const kmsInput = (options.kms ?? "phala").toLowerCase();

	let kmsType: "PHALA" | "ETHEREUM" | "BASE";
	switch (kmsInput) {
		case "eth":
		case "ethereum":
			kmsType = "ETHEREUM";
			break;
		case "base":
			kmsType = "BASE";
			break;
		default:
			kmsType = "PHALA";
			break;
	}

	return { kmsType, deprecatedKmsId: options.kmsId };
}

const validateName = async (options: Options): Promise<string | undefined> => {
	let name = options.name;

	// If name was explicitly provided via --name flag, validate it strictly
	if (options.name) {
		if (!isValidHostname(options.name)) {
			throw new Error(
				`Invalid CVM name: "${options.name}". Name must be 5-63 characters, start with letter, and contain only letters/numbers/hyphens.`,
			);
		}
		return options.name;
	}

	// If no name provided, use directory name with auto-conversion
	const folderName = path.basename(process.cwd());
	const convertedName = convertToHostname(folderName);

	if (!options.interactive) {
		// Non-interactive mode: use converted directory name
		name = convertedName;
	} else {
		// Interactive mode: prompt with converted name as default
		const result = await inquirer.prompt([
			{
				type: "input",
				name: "name",
				message: "Enter a name for the CVM:",
				default: convertedName,
				validate: (input) => {
					if (!input.trim()) return "CVM name is required";
					if (!isValidHostname(input.trim())) {
						return "Name must be 5-63 characters, start with letter, and contain only letters/numbers/hyphens";
					}
					return true;
				},
			},
		]);
		name = result.name;
	}

	return name;
};

const resolveEnvVars = async (
	options: Options,
): Promise<EnvVar[] | undefined> => {
	const envs: EnvVar[] = [];

	// 1. Handle deprecated --env-file (backward compatibility)
	if (options.envFile && typeof options.envFile === "string") {
		logger.warn(
			"--env-file is deprecated. Use -e <file> or -e KEY=VALUE instead.",
		);
		try {
			const envContent = fs.readFileSync(options.envFile, { encoding: "utf8" });
			envs.push(...parseEnvVars(envContent));
		} catch (error) {
			throw new Error(
				`Error reading environment file ${options.envFile}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	// 2. Handle new -e parameter (supports both files and KEY=VALUE)
	if (options.env && options.env.length > 0) {
		const parsed = parseEnvInputs(options.env);

		// Load files first (in order)
		for (const filePath of parsed.files) {
			const resolvedPath = path.resolve(process.cwd(), filePath);
			if (!fs.existsSync(resolvedPath)) {
				throw new Error(`Environment file not found: ${filePath}`);
			}
			try {
				const envContent = fs.readFileSync(resolvedPath, { encoding: "utf8" });
				envs.push(...parseEnvVars(envContent));
			} catch (error) {
				throw new Error(
					`Error reading environment file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}

		// Add KEY=VALUE pairs (later values override earlier)
		envs.push(...parsed.keyValues);
	}

	// 3. Interactive mode: prompt if no env inputs provided
	if (
		options.interactive &&
		envs.length === 0 &&
		!options.env &&
		!options.envFile
	) {
		const { envPath } = await inquirer.prompt([
			{
				type: "input",
				name: "envPath",
				message:
					"Enter the path to your environment file (leave empty to skip):",
				default: "",
				validate: (input: string) => {
					if (!input || input.trim() === "") {
						return true;
					}
					const filePath = path.resolve(process.cwd(), input);
					if (!fs.existsSync(filePath)) {
						return `File not found at ${filePath}`;
					}
					return true;
				},
			},
		]);

		if (envPath.trim()) {
			const resolvedPath = path.resolve(process.cwd(), envPath.trim());
			const envContent = fs.readFileSync(resolvedPath, { encoding: "utf8" });
			envs.push(...parseEnvVars(envContent));
		}
	}

	// 4. Return deduplicated envs (later values override earlier)
	if (envs.length === 0) {
		return undefined;
	}

	return dedupeEnvVars(envs);
};

/**
 * Read SSH public key from file
 * - --dev-os: SSH public key is required
 * - --non-dev-os: SSH public key only if explicitly specified via --ssh-pubkey
 * - Neither flag: Try to read public key, use if available
 */
const readSshPubkey = async (options: Options): Promise<string | undefined> => {
	let sshPubkeyPath = options.sshPubkey;

	// For --no-dev-os, only use SSH key if explicitly specified
	if (options.devOs === false && !options.sshPubkey) {
		return undefined;
	}

	// If not specified, search for default public keys (similar to ssh command)
	if (!sshPubkeyPath) {
		const homeDir = os.homedir();
		const defaultPubKeys = [
			path.join(homeDir, ".ssh", "id_rsa.pub"),
			path.join(homeDir, ".ssh", "id_ed25519.pub"),
			path.join(homeDir, ".ssh", "id_ecdsa.pub"),
			path.join(homeDir, ".ssh", "id_dsa.pub"),
		];

		for (const key of defaultPubKeys) {
			if (fs.existsSync(key)) {
				sshPubkeyPath = key;
				break;
			}
		}

		// If still no key found
		if (!sshPubkeyPath) {
			// --dev-os requires SSH public key
			if (options.devOs) {
				throw new Error(
					dedent(`
						SSH public key is required for dev images but not found.

						Searched for:
						  - ~/.ssh/id_rsa.pub
						  - ~/.ssh/id_ed25519.pub
						  - ~/.ssh/id_ecdsa.pub
						  - ~/.ssh/id_dsa.pub

						Please either:
						  1. Create an SSH key pair: ssh-keygen -t rsa
						  2. Specify a different key file: --ssh-pubkey <path>
					`),
				);
			}
			// For default case (no flags), just skip if no key found
			return undefined;
		}
	} else {
		// Expand ~ to home directory
		if (sshPubkeyPath.startsWith("~")) {
			sshPubkeyPath = path.join(os.homedir(), sshPubkeyPath.slice(1));
		}

		// Verify key file exists
		if (!fs.existsSync(sshPubkeyPath)) {
			throw new Error(`SSH public key file not found: ${sshPubkeyPath}`);
		}
	}

	// Read the public key file
	try {
		const pubkey = fs.readFileSync(sshPubkeyPath, "utf8").trim();
		logger.info(`Using SSH public key from ${sshPubkeyPath}`);
		return pubkey;
	} catch (error) {
		throw new Error(
			`Failed to read SSH public key from ${sshPubkeyPath}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
};

const validateCpuMemoryDiskSize = async (options: Options) => {
	let vcpu = DEFAULT_VCPU;
	if (options.vcpu) {
		try {
			vcpu = Number(options.vcpu);
		} catch (error) {
			throw new Error(
				`Invalid vCPU format '${options.vcpu}'. Using default: ${DEFAULT_VCPU}`,
			);
		}
	}

	let memoryMB = DEFAULT_MEMORY;
	if (options.memory) {
		try {
			memoryMB = parseMemoryInput(options.memory);
		} catch (error) {
			throw new Error(
				`Invalid memory format '${options.memory}'. Using default: ${DEFAULT_MEMORY}MB`,
			);
		}
	}

	let diskSizeGB = DEFAULT_DISK_SIZE;
	if (options.diskSize) {
		try {
			diskSizeGB = parseDiskSizeInput(options.diskSize);
		} catch (error) {
			throw new Error(
				`Invalid disk size format '${options.diskSize}'. Using default: ${DEFAULT_DISK_SIZE}GB`,
			);
		}
	}

	return {
		vcpu,
		memoryMB,
		diskSizeGB,
	};
};

interface PrivacySettings {
	publicLogs: boolean;
	publicSysinfo: boolean;
	publicTcbinfo: boolean;
	secureTime: boolean;
	listed: boolean;
}

/**
 * Resolve privacy settings with priority: CLI flags > phala.toml > CLI defaults
 */
const resolvePrivacySettings = (
	options: Options,
	projectConfig?: PrivacyConfig,
): PrivacySettings => {
	return {
		publicLogs: options.publicLogs ?? projectConfig?.public_logs ?? true,
		publicSysinfo:
			options.publicSysinfo ?? projectConfig?.public_sysinfo ?? true,
		publicTcbinfo:
			options.publicTcbinfo ?? projectConfig?.public_tcbinfo ?? true,
		secureTime: options.secureTime ?? projectConfig?.secure_time ?? false,
		listed: options.listed ?? projectConfig?.listed ?? false,
	};
};

/**
 * Build provision payload from options
 * All parameters are optional - backend will auto-match resources
 * @param preResolvedKmsSelection - Optional pre-resolved KMS selection to avoid duplicate calls/warnings
 */
export const buildProvisionPayload = (
	options: Options,
	name: string,
	dockerComposeYml: string,
	envs: EnvVar[],
	privacySettings: PrivacySettings,
	preResolvedKmsSelection?: ReturnType<typeof resolveKmsSelection>,
	preLaunchScriptContent?: string,
) => {
	const composeFile: Record<string, unknown> = {
		name: "", // Required by backend schema, defaults to empty string
		docker_compose_file: dockerComposeYml,
		allowed_envs: envs?.map((e) => e.key) || [],
		public_logs: privacySettings.publicLogs,
		public_sysinfo: privacySettings.publicSysinfo,
		public_tcbinfo: privacySettings.publicTcbinfo,
		secure_time: privacySettings.secureTime,
	};

	if (preLaunchScriptContent) {
		composeFile.pre_launch_script = preLaunchScriptContent;
	}

	if (options.fs) {
		composeFile.storage_fs = options.fs;
	}

	if (options.experimentalKeyProviderType) {
		composeFile.key_provider = options.experimentalKeyProviderType;
	}

	const payload: Record<string, unknown> = {
		name: name,
		compose_file: composeFile,
		listed: privacySettings.listed,
	};

	const { kmsType, deprecatedKmsId } =
		preResolvedKmsSelection ?? resolveKmsSelection(options);

	// Only add user-specified parameters - let backend auto-match the rest
	if (options.instanceType) {
		payload.instance_type = options.instanceType;
	}

	if (options.vcpu) {
		payload.vcpu = Number(options.vcpu);
	}

	if (options.memory) {
		payload.memory = parseMemoryInput(options.memory);
	}

	if (options.diskSize) {
		payload.disk_size = parseDiskSizeInput(options.diskSize);
	}

	if (options.nodeId) {
		payload.teepod_id = Number(options.nodeId);
	}

	if (options.region) {
		payload.region = options.region;
	}

	if (options.image) {
		payload.image = options.image;
	}

	// Always set kms type (defaults to PHALA)
	payload.kms = kmsType;
	// `--kms-id` is deprecated and now a no-op: the backend identifies the KMS
	// by its on-chain contract (kms_contract_id), not a single node id. The flag
	// is retained for one more release to avoid breaking existing invocations.
	void deprecatedKmsId;
	if (options.kmsContract) {
		payload.kms_contract = options.kmsContract;
	}
	if (options.kmsContractId) {
		payload.kms_contract_id = options.kmsContractId;
	}
	if (options.keyProviderMode) {
		payload.key_provider_mode = options.keyProviderMode;
	}
	if (options.skipGateway === true) {
		payload.skip_gateway = true;
	}

	// Add prefer_dev flag based on --dev-os / --no-dev-os
	// For on-chain KMS (ETHEREUM/BASE), default to non-dev since dev images may not be available
	const isOnchainKms = kmsType === "ETHEREUM" || kmsType === "BASE";
	if (options.devOs === true) {
		payload.prefer_dev = true;
	} else if (options.devOs === false || isOnchainKms) {
		payload.prefer_dev = false;
	}
	// If devOs is undefined and not on-chain KMS, don't add prefer_dev (let backend auto-select)

	// Add custom app_id if specified
	if (options.customAppId) {
		payload.app_id = options.customAppId;

		// For PHALA KMS, nonce is required with custom app_id
		if (kmsType === "PHALA") {
			if (!options.nonce) {
				throw new Error(
					"--nonce is required when using --custom-app-id with PHALA KMS.",
				);
			}
			const nonceNum = Number(options.nonce);
			if (Number.isNaN(nonceNum)) {
				throw new Error(
					`Invalid nonce value: "${options.nonce}". Nonce must be a valid number.`,
				);
			}
			payload.nonce = nonceNum;
		}
	}

	// Validate nonce is not used alone
	if (options.nonce && !options.customAppId) {
		throw new Error("--nonce requires --custom-app-id to be specified.");
	}

	return payload;
};

const deployNewCvm = async (
	validatedOptions: Options,
	docker_compose_yml: string,
	envs: EnvVar[],
	client: Client<typeof API_VERSION>,
	stdout: NodeJS.WriteStream,
	stderr: NodeJS.WriteStream,
	projectConfig?: PrivacyConfig,
	preLaunchScriptContent?: string,
) => {
	// Resolve KMS selection once at the start to avoid duplicate calls and warnings
	const kmsSelection = resolveKmsSelection(validatedOptions);

	const name = await validateName(validatedOptions);

	// Read SSH public key and add to environment variables
	const sshPubkey = await readSshPubkey(validatedOptions);
	const envsWithSshKey = [...(envs || [])];
	if (sshPubkey) {
		envsWithSshKey.push({
			key: "DSTACK_AUTHORIZED_KEYS",
			value: sshPubkey,
		});
	}

	// Resolve privacy settings based on options, phala.toml, and dev mode
	const privacySettings = resolvePrivacySettings(
		validatedOptions,
		projectConfig,
	);

	const payload = buildProvisionPayload(
		validatedOptions,
		name,
		docker_compose_yml,
		envsWithSshKey,
		privacySettings,
		kmsSelection,
		preLaunchScriptContent,
	);

	stdout.write(`Provisioning CVM ${name}...\n`);

	// Provision - backend will auto-match resources
	const provision_result = await safeProvisionCvm(client, payload);
	if (!provision_result.success) {
		const formattedError = handleProvisionError(
			provision_result.error,
			validatedOptions,
		);
		logger.error("Error in provisioning CVM:", formattedError);
		throw provision_result.error;
	}
	// biome-ignore lint/suspicious/noExplicitAny: type inference issue with @phala/cloud library
	const app = provision_result.data as any;
	let commit_result;

	const provisionKmsInfo = app.kms_info;

	if (
		validatedOptions.experimentalKeyProviderType &&
		app.app_id &&
		app.compose_hash
	) {
		const kpType = validatedOptions.experimentalKeyProviderType;
		const kpId = provisionKmsInfo?.k256_pubkey || "";
		const mrConfigId = getMrConfigId({
			compose_hash: `0x${app.compose_hash}`,
			app_id: `0x${app.app_id}`,
			key_provider_type: kpType,
			key_provider_id: kpId ? `0x${kpId}` : "0x",
		});
		logger.info(`mr_config_id (v2): ${mrConfigId}`);
	}

	const needsOnchainKms =
		!app.app_id &&
		!!provisionKmsInfo?.chain_id &&
		!!provisionKmsInfo?.kms_contract_address;

	if (needsOnchainKms) {
		if (!provisionKmsInfo?.chain_id || !provisionKmsInfo?.chain) {
			throw new Error(
				"KMS chain info is missing from provision response. Please retry or contact support.",
			);
		}
		if (!provisionKmsInfo?.kms_contract_address) {
			throw new Error(
				"KMS contract address is missing from provision response. Please retry or contact support.",
			);
		}

		// Validate private key for on-chain KMS
		const privateKey = await validatePrivateKey(
			validatedOptions,
			provisionKmsInfo.chain_id,
		);

		// Deploy contract
		const deploy_result = await safeDeployAppAuth({
			chain: provisionKmsInfo.chain,
			rpcUrl: validatedOptions.rpcUrl,
			kmsContractAddress: provisionKmsInfo.kms_contract_address,
			privateKey: privateKey as `0x${string}`,
			deviceId: app.device_id,
			composeHash: app.compose_hash,
		});

		if (!deploy_result.success) {
			logger.logDetailedError(deploy_result, "Deploy App Auth");
			const errorMsg =
				typeof deploy_result === "object" && deploy_result !== null
					? JSON.stringify(deploy_result)
					: String(deploy_result);
			throw new Error(`Deployment contract failed: ${errorMsg}`);
		}

		// biome-ignore lint/suspicious/noExplicitAny: type inference issue with @phala/cloud library
		const deployed_contract = deploy_result.data as any;

		// Get encryption key
		const kmsRef = provisionKmsInfo.slug || provisionKmsInfo.id;
		if (!kmsRef) {
			throw new Error(
				"KMS reference (slug or id) is missing from provision response",
			);
		}
		const resp = await safeGetAppEnvEncryptPubKey(client, {
			app_id: deployed_contract.appId,
			kms: kmsRef,
		});

		if (!resp.success) {
			logger.logDetailedError(resp.error, "Get App Env Encrypt PubKey");
			throw new Error(
				`Failed to get app env encrypt pubkey: ${resp.error.message}`,
			);
		}

		// biome-ignore lint/suspicious/noExplicitAny: type inference issue with @phala/cloud library
		const pubkey_signature = resp.data as any;
		const encrypted_env_vars = await encryptEnvVars(
			envsWithSshKey,
			pubkey_signature.public_key,
		);

		commit_result = await safeCommitCvmProvision(client, {
			app_id: deployed_contract.appId,
			encrypted_env: encrypted_env_vars,
			compose_hash: app.compose_hash,
			kms_id: kmsRef,
			contract_address: deployed_contract.appAuthAddress,
			deployer_address: deployed_contract.deployer,
		});
	} else {
		// Centralized KMS or provision already has app_id
		const encrypted_env_vars =
			envsWithSshKey && envsWithSshKey.length > 0
				? await encryptEnvVars(envsWithSshKey, app.app_env_encrypt_pubkey)
				: undefined;

		commit_result = await safeCommitCvmProvision(client, {
			app_id: app.app_id,
			encrypted_env: encrypted_env_vars,
			compose_hash: app.compose_hash,
			kms_id: kmsSelection.deprecatedKmsId,
		});
	}

	if (!commit_result.success) {
		logger.logDetailedError(commit_result.error, "Commit CVM Provision");
		throw new Error(
			`Failed to commit CVM provision: ${commit_result.error.message}`,
		);
	}
	// biome-ignore lint/suspicious/noExplicitAny: type inference issue with @phala/cloud library
	const cvm = commit_result.data as any;

	if (validatedOptions?.json !== false) {
		stdout.write(
			`${JSON.stringify(
				{
					success: true,
					vm_uuid: cvm.vm_uuid,
					name: cvm.name,
					app_id: cvm.app_id,
					dashboard_url: `${CLOUD_URL}/dashboard/cvms/${cvm.vm_uuid}`,
				},
				null,
				2,
			)}\n`,
		);
	} else {
		const successMessage = dedent`
      CVM created successfully!

      CVM ID:    ${cvm.vm_uuid}
      Name:      ${cvm.name}
      App ID:    ${cvm.app_id}
      Dashboard URL:  ${CLOUD_URL}/dashboard/cvms/${cvm.vm_uuid}
    `;
		stdout.write(`${successMessage}\n`);
	}
};

const updateCvm = async (
	validatedOptions: Options,
	docker_compose_yml: string,
	envs: EnvVar[] | undefined,
	client: Client<typeof API_VERSION>,
	stdout: NodeJS.WriteStream,
	context?: Pick<CommandContext, "env" | "projectConfig" | "globalOptions">,
	preLaunchScriptContent?: string,
) => {
	const cvm_result = await safeGetCvmInfo(client, {
		id: validatedOptions.uuid,
	});
	if (!cvm_result.success) {
		logger.logDetailedError(cvm_result.error, "Get CVM Info");
		throw new Error(`Failed to get cvm info: ${cvm_result.error.message}`);
	}
	// biome-ignore lint/suspicious/noExplicitAny: type inference issue with @phala/cloud library
	const cvm = cvm_result.data as any;

	// Encrypt env vars before patching (backend stores the full body in Redis for two-phase)
	let encrypted_env: string | undefined;
	if (envs && envs.length > 0) {
		if (cvm.kms_info?.chain_id) {
			// On-chain KMS: fetch encrypt pubkey from API
			const kmsSlug = cvm.kms_info?.slug || cvm.kms_info?.id;
			if (!kmsSlug) {
				throw new Error("KMS slug or id is required for decentralized KMS");
			}
			const resp = await safeGetAppEnvEncryptPubKey(client, {
				app_id: cvm.app_id,
				kms: kmsSlug,
			});
			if (!resp.success) {
				logger.logDetailedError(resp.error, "Get App Env Encrypt PubKey");
				throw new Error(
					`Failed to get app env encrypt pubkey: ${resp.error.message}`,
				);
			}
			// biome-ignore lint/suspicious/noExplicitAny: type inference issue with @phala/cloud library
			const pubkey_signature = resp.data as any;
			encrypted_env = await encryptEnvVars(envs, pubkey_signature.public_key);
		} else {
			// Centralized KMS: use pubkey from CVM info
			if (!cvm.encrypted_env_pubkey) {
				throw new Error(
					"CVM encrypted_env_pubkey is required for centralized KMS",
				);
			}
			encrypted_env = await encryptEnvVars(envs, cvm.encrypted_env_pubkey);
		}
	}

	// Build unified patch request
	const patchBody: Record<string, unknown> = {
		id: validatedOptions.uuid,
		docker_compose_file: docker_compose_yml,
	};
	if (preLaunchScriptContent) {
		patchBody.pre_launch_script = preLaunchScriptContent;
	}
	if (envs && envs.length > 0) {
		patchBody.allowed_envs = envs.map((env) => env.key);
	}
	if (encrypted_env) {
		patchBody.encrypted_env = encrypted_env;
	}
	if (validatedOptions.publicLogs !== undefined) {
		patchBody.public_logs = validatedOptions.publicLogs;
	}
	if (validatedOptions.publicSysinfo !== undefined) {
		patchBody.public_sysinfo = validatedOptions.publicSysinfo;
	}

	// Add prepareOnly flag if set
	if (validatedOptions.prepareOnly) {
		patchBody.prepareOnly = true;
	}

	logger.info(`Updating CVM ${validatedOptions.uuid}...`);
	// biome-ignore lint/suspicious/noExplicitAny: dynamic patch body
	const patchResult = await safePatchCvm(client, patchBody as any);
	if (!patchResult.success) {
		const formattedError = handleProvisionError(
			patchResult.error,
			validatedOptions,
		);
		logger.error("Error updating CVM:", formattedError);
		throw patchResult.error;
	}

	const result = patchResult.data;

	// --prepare-only on a CVM that doesn't require on-chain hash
	if (validatedOptions.prepareOnly && !result.requiresOnChainHash) {
		const msg =
			"--prepare-only has no effect on this CVM: it does not use on-chain KMS. The update was applied directly.";
		if (validatedOptions.json !== false) {
			stdout.write(
				`${JSON.stringify({ success: true, prepare_only: false, message: msg }, null, 2)}\n`,
			);
		} else {
			logger.warn(msg);
		}
		return;
	}

	// Two-phase flow: on-chain KMS requires compose hash registration
	if (result.requiresOnChainHash) {
		// --prepare-only mode: output commit info and stop
		if (validatedOptions.prepareOnly) {
			// Build explorer link for the contract address
			const chainId = result.kmsInfo?.chain_id;
			const chain = result.kmsInfo?.chain as
				| { name?: string; blockExplorers?: { default?: { url?: string } } }
				| undefined;
			const contractAddress = cvm.app_id;
			const explorerUrl = chain?.blockExplorers?.default?.url;
			const contractExplorerUrl =
				explorerUrl && contractAddress
					? `${explorerUrl}/address/${contractAddress.startsWith("0x") ? contractAddress : `0x${contractAddress}`}`
					: undefined;

			const composeHashHex = result.composeHash.startsWith("0x")
				? result.composeHash
				: `0x${result.composeHash}`;

			const onchain = result.onchainStatus;
			const output = {
				success: true,
				prepare_only: true,
				compose_hash: composeHashHex,
				app_id: cvm.app_id,
				device_id: result.deviceId,
				kms_info: result.kmsInfo,
				chain_id: chainId,
				contract_explorer_url: contractExplorerUrl,
				onchain_status: onchain,
				commit_token: result.commitToken,
				commit_url: result.commitUrl,
				api_commit_url: result.apiCommitUrl,
			};

			if (validatedOptions.json !== false) {
				stdout.write(`${JSON.stringify(output, null, 2)}\n`);
			} else {
				const lines = [
					"CVM update prepared successfully (pending on-chain approval).",
					"",
					`Compose Hash:    ${composeHashHex}`,
					`App ID:          ${cvm.app_id}`,
					`Device ID:       ${result.deviceId}`,
				];
				if (chainId) {
					lines.push(
						`Chain:           ${chain?.name || "Unknown"} (ID: ${chainId})`,
					);
				}
				if (contractExplorerUrl) {
					lines.push(`Contract:        ${contractExplorerUrl}`);
				}
				lines.push(
					`Commit Token:    ${result.commitToken || "N/A"}`,
					`Commit URL:      ${result.commitUrl || "N/A"}`,
					`API Commit URL:  ${result.apiCommitUrl || "N/A"} (POST)`,
				);
				if (onchain) {
					const hashStatus = onchain.compose_hash_allowed
						? "registered"
						: "NOT registered";
					const deviceStatus = onchain.device_id_allowed
						? "registered"
						: "NOT registered";
					lines.push(
						"",
						"On-chain Status:",
						`  Compose Hash:  ${hashStatus}`,
						`  Device ID:     ${deviceStatus}`,
					);
					if (onchain.is_allowed) {
						lines.push(
							"  All prerequisites met. You can commit with --transaction-hash already-registered.",
						);
					}
				}
				lines.push(
					"",
					"To complete the update after on-chain approval:",
					`  phala deploy --cvm-id ${validatedOptions.uuid} \\`,
					"    --commit \\",
					`    --token ${result.commitToken || "<token>"} \\`,
					`    --compose-hash ${composeHashHex} \\`,
					"    --transaction-hash <tx-hash>",
				);
				stdout.write(`${lines.join("\n")}\n`);
			}
			return;
		}

		if (!validatedOptions.privateKey) {
			throw new Error("Private key is required for contract DstackApp");
		}

		if (validatedOptions.debug) {
			console.log("[DEBUG] patchCvm.composeHash:", result.composeHash);
			console.log("[DEBUG] cvm.app_id:", cvm.app_id);
			console.log("[DEBUG] patchCvm.deviceId:", result.deviceId);
		}

		// Check on-chain prerequisites (device + compose hash status)
		const prereqs = await safeCheckOnChainPrerequisites({
			chain: cvm.kms_info?.chain,
			rpcUrl: validatedOptions.rpcUrl,
			appAddress: cvm.app_id as `0x${string}`,
			deviceId: result.deviceId,
			composeHash: result.composeHash,
		});

		if (!prereqs.success) {
			// biome-ignore lint/suspicious/noExplicitAny: type narrowing issue with safe result union
			const errDetail = (prereqs as any).error;
			throw new Error(
				`Failed to check on-chain prerequisites (contract: ${cvm.app_id}): ${errDetail.message}`,
			);
		}

		if (validatedOptions.debug) {
			console.log("[DEBUG] prereqs:", prereqs.data);
		}

		// Add device if not registered
		if (!prereqs.data.deviceAllowed) {
			logger.info("Device not registered on-chain, adding...");
			const deviceResult = await safeAddDevice({
				chain: cvm.kms_info?.chain,
				rpcUrl: validatedOptions.rpcUrl,
				appAddress: cvm.app_id as `0x${string}`,
				deviceId: result.deviceId,
				privateKey: validatedOptions.privateKey as `0x${string}`,
			});
			if (!deviceResult.success) {
				// biome-ignore lint/suspicious/noExplicitAny: type narrowing issue with safe result union
				const errDetail = (deviceResult as any).error;
				throw new Error(
					`Failed to register device on-chain (device: ${result.deviceId.slice(0, 10)}...): ${errDetail.message}`,
				);
			}
		}

		// Register compose hash on-chain (idempotent — always send to get a real tx hash)
		const receipt_result = await safeAddComposeHash({
			chain: cvm.kms_info?.chain,
			rpcUrl: validatedOptions.rpcUrl,
			appId: cvm.app_id as `0x${string}`,
			composeHash: result.composeHash,
			privateKey: validatedOptions.privateKey as `0x${string}`,
		});
		if (!receipt_result.success) {
			// biome-ignore lint/suspicious/noExplicitAny: type narrowing issue with safe result union
			const errDetail = (receipt_result as any).error;
			throw new Error(
				`Failed to register compose hash on-chain (hash: ${result.composeHash.slice(0, 10)}...): ${errDetail.message}`,
			);
		}

		// biome-ignore lint/suspicious/noExplicitAny: type inference issue with @phala/cloud library
		const txResult = receipt_result.data as any;
		const transactionHash: string = txResult.transactionHash;

		if (validatedOptions.debug) {
			console.log("[DEBUG] transactionHash:", transactionHash);
		}

		const confirmResult = await safeConfirmCvmPatch(client, {
			id: validatedOptions.uuid,
			composeHash: result.composeHash,
			transactionHash,
		});
		if (!confirmResult.success) {
			const errMsg = confirmResult.error.message;
			const status =
				"status" in confirmResult.error
					? (confirmResult.error as { status: number }).status
					: undefined;
			if (status === 466) {
				throw new Error(
					"Compose hash expired. Please retry the update from the beginning.",
				);
			}
			if (status === 467) {
				throw new Error(
					`Transaction verification failed on backend. Hash: ${transactionHash}`,
				);
			}
			if (status === 468) {
				throw new Error(
					`Compose hash not found on-chain. Contract: ${cvm.app_id}`,
				);
			}
			throw new Error(
				`Failed to confirm CVM update after on-chain registration: ${errMsg}`,
			);
		}
	}

	// Wait for update to complete if --wait flag is set
	if (validatedOptions.wait) {
		logger.info("Waiting for update to complete...");
		try {
			await waitForCvmReady(
				validatedOptions.uuid as string,
				300000, // 5 minutes timeout
				context,
			);
		} catch (error: unknown) {
			logger.logDetailedError(error, "Wait for CVM Ready");
			throw new Error(
				`Wait failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	if (validatedOptions?.json !== false) {
		stdout.write(
			`${JSON.stringify(
				{
					success: true,
					vm_uuid: validatedOptions.uuid,
					name: cvm.name,
					app_id: cvm.app_id,
					dashboard_url: `${CLOUD_URL}/dashboard/cvms/${validatedOptions.uuid}`,
				},
				null,
				2,
			)}\n`,
		);
	} else {
		stdout.write("CVM updated successfully!\n");
	}
};

/**
 * Commit a previously prepared CVM update using a commit token.
 * Skips compose file reading and env processing — goes straight to the API.
 */
const commitCvmUpdate = async (
	validatedOptions: Options,
	client: Client<typeof API_VERSION>,
	stdout: NodeJS.WriteStream,
) => {
	if (!validatedOptions.token) {
		throw new Error("--token is required for --commit mode");
	}
	if (!validatedOptions.uuid) {
		throw new Error("--cvm-id is required for --commit mode");
	}
	if (!validatedOptions.transactionHash) {
		logger.info(
			"No --transaction-hash provided, using 'already-registered' (state-only check)",
		);
	}

	logger.info(`Committing CVM update for ${validatedOptions.uuid}...`);

	const commitResult = await safeCommitCvmUpdate(client, {
		id: validatedOptions.uuid,
		token: validatedOptions.token,
		composeHash: validatedOptions.composeHash || "",
		transactionHash: validatedOptions.transactionHash || "",
	});

	if (!commitResult.success) {
		const errMsg =
			commitResult.error instanceof Error
				? commitResult.error.message
				: String(commitResult.error);
		const isExpired = errMsg.includes("expired") || errMsg.includes("Invalid");
		const hint = isExpired
			? " Run --prepare-only again to get a new commit token."
			: "";
		throw new Error(`Failed to commit CVM update: ${errMsg}${hint}`);
	}

	if (validatedOptions.json !== false) {
		stdout.write(
			`${JSON.stringify(
				{
					success: true,
					vm_uuid: validatedOptions.uuid,
					correlation_id: commitResult.data.correlationId,
					status: commitResult.data.status,
				},
				null,
				2,
			)}\n`,
		);
	} else {
		stdout.write(
			`CVM update committed successfully! Correlation ID: ${commitResult.data.correlationId}\n`,
		);
	}
};

export async function runDeploy(
	input: DeployCommandInput,
	context: CommandContext,
): Promise<void> {
	try {
		// Handle --commit mode: skip compose file reading entirely
		// commit-update endpoint is token-based (no API key required),
		// but we still need a client with the correct base URL.
		if (input.commit) {
			const resolved = resolveAuthForContext(context, {
				apiToken: input.apiToken,
			});
			const client = createClient({
				apiKey: resolved.apiKey,
				baseURL: resolved.baseURL,
				version: API_VERSION,
			});

			const uuid = context.cvmId
				? CvmIdSchema.parse(context.cvmId).cvmId
				: undefined;

			await commitCvmUpdate({ ...input, uuid }, client, context.stdout);
			return;
		}

		// Use positional argument if provided, otherwise use the --compose option
		// Fallback to phala.toml compose_file if not specified
		const dockerComposePath =
			input.compose || context.projectConfig.compose_file;

		const client = await getApiClient({
			context,
			apiToken: input.apiToken,
			interactive: input.interactive,
		});

		const docker_compose_yml = await readDockerComposeFile({
			dockerComposePath: dockerComposePath,
			interactive: input.interactive,
		});

		// Read pre-launch script file if provided
		let preLaunchScriptContent: string | undefined;
		if (input.preLaunchScript) {
			if (!fs.existsSync(input.preLaunchScript)) {
				throw new Error(
					`Pre-launch script file not found: ${input.preLaunchScript}`,
				);
			}
			preLaunchScriptContent = fs.readFileSync(input.preLaunchScript, "utf8");
		}

		// Early size check for compose payload (the SDK schema validates the
		// combined size too, but checking here gives users a faster, friendlier
		// error before any network requests)
		const composeByteLength = Buffer.byteLength(docker_compose_yml, "utf8");
		const scriptByteLength = preLaunchScriptContent
			? Buffer.byteLength(preLaunchScriptContent, "utf8")
			: 0;
		const totalPayloadBytes = composeByteLength + scriptByteLength;
		if (totalPayloadBytes > MAX_COMPOSE_PAYLOAD_BYTES) {
			const maxKB = MAX_COMPOSE_PAYLOAD_BYTES / 1024;
			const currentKB = Math.ceil(totalPayloadBytes / 1024);
			throw new Error(
				`Combined size of docker compose file and pre-launch script is too large (${currentKB}KB). Maximum allowed size is ${maxKB}KB.`,
			);
		}

		// Build options with env_file from phala.toml as fallback
		const optionsWithEnvFile: Options = {
			...input,
			// If no env specified and phala.toml has env_file, use it
			env:
				input.env && input.env.length > 0
					? input.env
					: context.projectConfig.env_file
						? [context.projectConfig.env_file]
						: undefined,
			// Fall back to ETH_RPC_URL env var (foundry/cast convention)
			rpcUrl: input.rpcUrl || process.env.ETH_RPC_URL,
		};

		const envs = await resolveEnvVars(optionsWithEnvFile);

		// Get CVM ID from context (already resolved with priority: interactive > --cvm-id > phala.toml)
		if (input.debug) {
			console.log("[DEBUG] context.cvmId:", JSON.stringify(context.cvmId));
			console.log("[DEBUG] input.cvmId:", input.cvmId);
		}

		const uuid = context.cvmId
			? CvmIdSchema.parse(context.cvmId).cvmId
			: undefined;

		if (input.debug) {
			console.log("[DEBUG] resolved uuid:", uuid);
			console.log("[DEBUG] isUpdate:", !!uuid);
		}

		const isUpdate = !!uuid;
		if (isUpdate) {
			// Update the existing CVM
			await updateCvm(
				{
					...input,
					uuid,
				},
				docker_compose_yml,
				envs,
				client,
				context.stdout,
				context,
				preLaunchScriptContent,
			);
		} else {
			// Deploy a new CVM
			await deployNewCvm(
				input,
				docker_compose_yml,
				envs ?? [],
				client,
				context.stdout,
				context.stderr,
				context.projectConfig,
				preLaunchScriptContent,
			);
		}
	} catch (error) {
		if (input.json !== false) {
			context.stderr.write(
				`${JSON.stringify(
					{
						success: false,
						error: error instanceof Error ? error.message : String(error),
						stack:
							input.debug && error instanceof Error ? error.stack : undefined,
					},
					null,
					2,
				)}\n`,
			);
		} else {
			context.stderr.write(
				`${dedent`${error instanceof Error ? error.message : String(error)}`}\n`,
			);
		}
		throw error;
	}
}
