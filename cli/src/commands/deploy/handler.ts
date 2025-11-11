import path from "node:path";
import {
	type RuntimeProjectConfig,
	parse_cvm_id,
} from "@/src/utils/project-config";
import { getApiKey } from "@/src/utils/credentials";
import {
	CLOUD_URL,
	DEFAULT_DISK_SIZE,
	DEFAULT_MEMORY,
	DEFAULT_VCPU,
} from "@/src/utils/constants";
import { waitForCvmReady } from "@/src/utils/cvms";
import { logDetailedError } from "@/src/utils/error-handling";
import { detectFileInCurrentDir, promptForFile } from "@/src/utils/prompts";
import { parseDiskSizeInput, parseMemoryInput } from "@/src/utils/units";
import {
	type Client,
	type EnvVar,
	type ErrorLink,
	type ProvisionCvmComposeFileUpdateRequest,
	ResourceError,
	createClient,
	encryptEnvVars,
	formatStructuredError,
	parseEnvVars,
	safeAddComposeHash,
	safeCommitCvmComposeFileUpdate,
	safeCommitCvmProvision,
	safeDeployAppAuth,
	safeGetAppEnvEncryptPubKey,
	safeGetAvailableNodes,
	safeGetCvmComposeFile,
	safeGetCvmInfo,
	safeGetCvmList,
	safeGetCurrentUser,
	safeGetKmsList,
	safeProvisionCvm,
	safeProvisionCvmComposeFileUpdate,
} from "@phala/cloud";
import dedent from "dedent";
import fs from "fs-extra";
import inquirer from "inquirer";
import type { DeployCommandInput } from "./command";

interface Options {
	name?: string;
	compose?: string;
	instanceType?: string;
	vcpu?: string;
	memory?: string;
	diskSize?: string;
	image?: string;
	region?: string;
	nodeId?: string;
	envFile?: string | boolean;
	interactive?: boolean;
	kmsId?: string;
	uuid?: string;
	customAppId?: string;
	preLaunchScript?: string;
	privateKey?: string;
	rpcUrl?: string;
	json?: boolean;
	debug?: boolean;
	apiKey?: string;
	wait?: boolean;
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

async function getApiClient({
	apiKey,
	interactive,
}: Readonly<Pick<Options, "apiKey" | "interactive">>): Promise<Client> {
	if (!apiKey && !process.env.PHALA_CLOUD_API_KEY) {
		if (interactive) {
			const { apiKey } = await inquirer.prompt([
				{
					type: "password",
					name: "apiKey",
					message: "Enter your API key:",
					validate: (input: string) =>
						input.trim() ? true : "API key is required",
				},
			]);
			return createClient({ apiKey: apiKey });
		}
		const apiKey = getApiKey();
		if (!apiKey) {
			throw new Error(
				"API key is required. Please provide it via --api-key or PHALA_CLOUD_API_KEY environment variable",
			);
		}
		return createClient({ apiKey: apiKey });
	}
	if (apiKey) {
		return createClient({ apiKey: apiKey });
	}
	return createClient();
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
          phala deploy --node-id 1 docker-compose.yml
          phala deploy --node-id 6 --kms-id t16z-dev --private-key <your-private-key> --rpc-url <rpc-url> docker-compose.yml

        Minimal required parameters:
          --compose <path>    Path to docker-compose.yml

        For on-chain KMS, also provide:
          --kms-id <id>       KMS ID
          --private-key <key> Private key for deployment

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

	// 2. Handle KMS related validations
	if (options.kmsId && chainId) {
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

const validateName = async (options: Options): Promise<string | undefined> => {
	let name = options.name;
	if (!options.name) {
		let folderName = path
			.basename(process.cwd())
			.toLowerCase()
			.replace(/[^a-z0-9_-]/g, "-");
		// Ensure folder name is at least 3 characters by appending 'cvm' if needed
		if (folderName.length < 3) {
			folderName = `${folderName}-cvm`;
		}
		const validFolderName = folderName.slice(0, 20); // Ensure max length of 20

		if (!options.interactive) {
			name = validFolderName;
		} else {
			const result = await inquirer.prompt([
				{
					type: "input",
					name: "name",
					message: "Enter a name for the CVM:",
					default: validFolderName,
					validate: (input) => {
						if (!input.trim()) return "CVM name is required";
						if (input.trim().length > 20)
							return "CVM name must be less than 20 characters";
						if (input.trim().length < 3)
							return "CVM name must be at least 3 characters";
						if (!/^[a-zA-Z0-9_-]+$/.test(input))
							return "CVM name must contain only letters, numbers, underscores, and hyphens";
						return true;
					},
				},
			]);
			name = result.name;
		}
	}
	return name;
};

const validateEnvFile = async (options: Options) => {
	// Handle environment variables
	let envs: EnvVar[] | undefined = undefined;
	let envFilePath = options.envFile;

	// Handle environment file path resolution
	if (options.interactive && (!options.envFile || envFilePath === true)) {
		envFilePath = await promptForFile(
			"Enter the path to your environment file:",
			".env",
			"file",
		);
	}

	if (envFilePath && envFilePath !== true) {
		try {
			// Read and parse environment variables
			const envContent = fs.readFileSync(envFilePath as string, {
				encoding: "utf8",
			});
			envs = parseEnvVars(envContent);
		} catch (error) {
			throw new Error(
				`Error reading environment file ${envFilePath}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
	return envs;
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

/**
 * Build provision payload from options
 * All parameters are optional - backend will auto-match resources
 */
const buildProvisionPayload = (
	options: Options,
	name: string,
	dockerComposeYml: string,
	envs: EnvVar[],
) => {
	const payload: Record<string, unknown> = {
		name: name,
		compose_file: {
			name: "", // Required by backend schema, defaults to empty string
			docker_compose_file: dockerComposeYml,
			allowed_envs: envs?.map((e) => e.key) || [],
		},
	};

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

	if (options.kmsId) {
		payload.kms_id = options.kmsId;
	}

	return payload;
};

const deployNewCvm = async (
	validatedOptions: Options,
	docker_compose_yml: string,
	envs: EnvVar[],
	client: Client,
	stdout: NodeJS.WriteStream,
	stderr: NodeJS.WriteStream,
) => {
	const name = await validateName(validatedOptions);
	const payload = buildProvisionPayload(
		validatedOptions,
		name,
		docker_compose_yml,
		envs || [],
	);

	stdout.write(`Provisioning CVM ${name}...\n`);

	// Provision - backend will auto-match resources
	const provision_result = await safeProvisionCvm(client, payload);
	if (!provision_result.success) {
		const formattedError = handleProvisionError(
			provision_result.error,
			validatedOptions,
		);
		if (validatedOptions.json) {
			stdout.write(`${JSON.stringify(formattedError, null, 2)}\n`);
		} else {
			stderr.write(String(formattedError));
		}
		throw provision_result.error;
	}
	// biome-ignore lint/suspicious/noExplicitAny: type inference issue with @phala/cloud library
	const app = provision_result.data as any;
	let commit_result;

	// Check if we need on-chain KMS deployment
	const needsOnchainKms = validatedOptions.kmsId && !app.app_id;

	if (needsOnchainKms) {
		// For on-chain KMS, we need to get KMS info and deploy contract
		const kms_result = await safeGetKmsList(client);
		if (!kms_result.success) {
			throw new Error(`Failed to get KMS list: ${kms_result.error.message}`);
		}

		// biome-ignore lint/suspicious/noExplicitAny: type inference issue with @phala/cloud library
		const kms_list = kms_result.data as any;
		const kms = kms_list.items.find(
			// biome-ignore lint/suspicious/noExplicitAny: type inference issue with @phala/cloud library
			(k: any) =>
				k.slug === validatedOptions.kmsId || k.id === validatedOptions.kmsId,
		);

		if (!kms || !kms.chain_id) {
			throw new Error(`KMS ${validatedOptions.kmsId} not found or invalid`);
		}

		// Validate private key for on-chain KMS
		const privateKey = await validatePrivateKey(validatedOptions, kms.chain_id);

		// Deploy contract
		const deploy_result = await safeDeployAppAuth({
			chain: kms.chain,
			rpcUrl: validatedOptions.rpcUrl,
			kmsContractAddress: kms.kms_contract_address,
			privateKey: privateKey as `0x${string}`,
			deviceId: app.device_id,
			composeHash: app.compose_hash,
		});

		if (!deploy_result.success) {
			logDetailedError(deploy_result, "Deploy App Auth");
			throw new Error("Contract deployment failed");
		}

		// biome-ignore lint/suspicious/noExplicitAny: type inference issue with @phala/cloud library
		const deployed_contract = deploy_result.data as any;

		// Get encryption key
		const resp = await safeGetAppEnvEncryptPubKey(client, {
			app_id: deployed_contract.appId,
			kms: kms.slug,
		});

		if (!resp.success) {
			throw new Error(
				`Failed to get app env encrypt pubkey: ${resp.error.message}`,
			);
		}

		// biome-ignore lint/suspicious/noExplicitAny: type inference issue with @phala/cloud library
		const pubkey_signature = resp.data as any;
		const encrypted_env_vars = await encryptEnvVars(
			envs,
			pubkey_signature.public_key,
		);

		commit_result = await safeCommitCvmProvision(client, {
			app_id: deployed_contract.appId,
			encrypted_env: encrypted_env_vars,
			compose_hash: app.compose_hash,
			kms_id: kms.slug,
			contract_address: deployed_contract.appAuthAddress,
			deployer_address: deployed_contract.deployer,
		});
	} else {
		// Centralized KMS or provision already has app_id
		const encrypted_env_vars =
			envs && envs.length > 0
				? await encryptEnvVars(envs, app.app_env_encrypt_pubkey)
				: undefined;

		commit_result = await safeCommitCvmProvision(client, {
			app_id: app.app_id,
			encrypted_env: encrypted_env_vars,
			compose_hash: app.compose_hash,
			kms_id: validatedOptions.kmsId,
		});
	}

	if (!commit_result.success) {
		logDetailedError(commit_result.error, "Commit CVM Provision");
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
	client: Client,
	stdout: NodeJS.WriteStream,
) => {
	const [cvm_result, app_compose_result] = await Promise.all([
		safeGetCvmInfo(client, {
			uuid: validatedOptions.uuid,
		}),
		safeGetCvmComposeFile(client, {
			uuid: validatedOptions.uuid,
		}),
	]);
	if (!cvm_result.success) {
		logDetailedError(cvm_result.error, "Get CVM Info");
		throw new Error(`Failed to get cvm info: ${cvm_result.error.message}`);
	}
	if (!app_compose_result.success) {
		logDetailedError(app_compose_result.error, "Get CVM Compose File");
		throw new Error(
			`Failed to get cvm compose file: ${app_compose_result.error.message}`,
		);
	}
	// biome-ignore lint/suspicious/noExplicitAny: type inference issue with @phala/cloud library
	const cvm = cvm_result.data as any;
	// biome-ignore lint/suspicious/noExplicitAny: type inference issue with @phala/cloud library
	const app_compose = app_compose_result.data as any;

	// patched the compose_file
	app_compose.docker_compose_file = docker_compose_yml;
	if (envs) {
		app_compose.allowed_envs = envs.map((env) => env.key);
	}

	stdout.write(`Preparing update for CVM ${validatedOptions.uuid}...\n`);
	const provision_result = await safeProvisionCvmComposeFileUpdate(client, {
		uuid: validatedOptions.uuid,
		app_compose:
			app_compose as ProvisionCvmComposeFileUpdateRequest["app_compose"],
	});
	if (!provision_result.success) {
		logDetailedError(
			provision_result.error,
			"Provision CVM Compose File Update",
		);
		throw new Error(
			`Failed to provision cvm compose file: ${provision_result.error.message}`,
		);
	}
	// biome-ignore lint/suspicious/noExplicitAny: type inference issue with @phala/cloud library
	const provision = provision_result.data as any;

	let encrypted_env: string | undefined;
	if (cvm.kms_info?.chain_id) {
		// Update with decentralized KMS.
		if (!validatedOptions.privateKey) {
			throw new Error("Private key is required for contract DstackApp");
		}

		const receipt_result = await safeAddComposeHash({
			chain: cvm.kms_info?.chain,
			rpcUrl: validatedOptions.rpcUrl,
			appId: cvm.app_id as `0x${string}`,
			composeHash: provision.compose_hash,
			privateKey: validatedOptions.privateKey as `0x${string}`,
		});
		if (!receipt_result.success) {
			logDetailedError(receipt_result, "Add Compose Hash");
			const errorMsg =
				typeof receipt_result === "object" && receipt_result !== null
					? JSON.stringify(receipt_result)
					: String(receipt_result);
			throw new Error(`Failed to add compose hash: ${errorMsg}`);
		}
	} else {
		if (envs && envs.length > 0) {
			if (!cvm.encrypted_env_pubkey) {
				throw new Error(
					"CVM encrypted_env_pubkey is required for centralized KMS",
				);
			}
			const encrypted_env_vars = await encryptEnvVars(
				envs,
				cvm.encrypted_env_pubkey,
			);
			encrypted_env = encrypted_env_vars;
		}
	}

	const data = {
		id: validatedOptions.uuid,
		compose_hash: provision.compose_hash,
		encrypted_env: encrypted_env,
		env_keys: envs?.length ? envs.map((env) => env.key) : undefined,
	};
	// @ts-ignore
	const commitResult = await safeCommitCvmComposeFileUpdate(client, data);

	if (!commitResult.success) {
		logDetailedError(commitResult.error, "Commit CVM Compose File Update");
		throw new Error(
			`Failed to commit CVM compose file update: ${commitResult.error.message}`,
		);
	}
	// Wait for update to complete if --wait flag is set
	if (validatedOptions.wait) {
		if (!validatedOptions.json) {
			stdout.write("\nWaiting for update to complete...\n");
		}
		try {
			await waitForCvmReady(
				validatedOptions.uuid as string,
				300000, // 5 minutes timeout
				!validatedOptions.json, // show progress if not in JSON mode
			);
		} catch (error: unknown) {
			logDetailedError(error, "Wait for CVM Ready");
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
		stdout.write("CVM compose file updated successfully!\n");
	}
};

export async function runDeploy(
	input: DeployCommandInput,
	context: {
		stdout: NodeJS.WriteStream;
		stderr: NodeJS.WriteStream;
		projectConfig: RuntimeProjectConfig;
	},
): Promise<void> {
	try {
		// Use positional argument if provided, otherwise use the --compose option
		const dockerComposePath = input.compose;

		const client = await getApiClient({
			apiKey: input.apiKey,
			interactive: input.interactive,
		});

		const docker_compose_yml = await readDockerComposeFile({
			dockerComposePath: dockerComposePath,
			interactive: input.interactive,
		});

		const envs = await validateEnvFile(input as Options);

		// Determine UUID: priority is CLI input > phala.toml
		const uuid = parse_cvm_id(input.uuid) ?? context.projectConfig.cvm_id;

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
