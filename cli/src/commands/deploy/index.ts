import path from "node:path";
import { getCvmUuid, saveCvmUuid } from "@/src/utils/config";
import {
	CLOUD_URL,
	DEFAULT_DISK_SIZE,
	DEFAULT_MEMORY,
	DEFAULT_VCPU,
} from "@/src/utils/constants";
import { getApiKey } from "@/src/utils/credentials";
import { waitForCvmReady } from "@/src/utils/cvms";
import { logDetailedError } from "@/src/utils/error-handling";
import { detectFileInCurrentDir, promptForFile } from "@/src/utils/prompts";
import { parseDiskSizeInput, parseMemoryInput } from "@/src/utils/units";
import {
	type Client,
	type EnvVar,
	type ProvisionCvmComposeFileUpdateRequest,
	createClient,
	encryptEnvVars,
	parseEnvVars,
	safeAddComposeHash,
	safeCommitCvmComposeFileUpdate,
	safeCommitCvmProvision,
	safeDeployAppAuth,
	safeGetAppEnvEncryptPubKey,
	safeGetAvailableNodes,
	safeGetCvmComposeFile,
	safeGetCvmInfo,
	safeGetKmsList,
	safeProvisionCvm,
	safeProvisionCvmComposeFileUpdate,
} from "@phala/cloud";
import { Command, Option } from "commander";
import dedent from "dedent";
import fs from "fs-extra";
import inquirer from "inquirer";

interface Options {
	name?: string;
	compose?: string;
	vcpu?: string;
	memory?: string;
	diskSize?: string;
	image?: string;
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

function readCvmUuid({ uuid }: { uuid?: string } = {}): string | undefined {
	// Return the provided UUID if it exists, otherwise get it from config
	return uuid || getCvmUuid();
}

const validatePrivateKey = async (
	options: Options,
	chainId: string | number | undefined,
): Promise<string | undefined> => {
	// 1. Get private key from options or environment
	let privateKey = options.privateKey || process.env.PRIVATE_KEY;

	// 2. Handle KMS related validations
	// TODO: rpc_url needs handling
	if (options.kmsId && chainId) {
		// TODO: remove customAppId for now
		// If using on-chain KMS, either privateKey or customAppId must be provided
		// if (!options.privateKey && !options.customAppId) {
		//   if (options.interactive) {
		//     const { authMethod } = await inquirer.prompt([{
		//       type: 'list',
		//       name: 'authMethod',
		//       message: 'Choose authentication method for on-chain KMS:',
		//       choices: [
		//         { name: 'Deploy with the standard DstackApp contract, you should provide --private-key', value: 'privateKey' },
		//         { name: 'Deploy with your own DstackApp contract, you should provide --custom-app-id', value: 'customAppId' }
		//       ]
		//     }]);

		//     if (authMethod === 'privateKey') {
		//       const { privateKey } = await inquirer.prompt([{
		//         type: 'password',
		//         name: 'privateKey',
		//         message: 'Enter your private key:',
		//         validate: (input: string) => input.trim() ? true : 'Private key is required'
		//       }]);
		//       options.privateKey = privateKey;
		//     } else {
		//       const { customAppId } = await inquirer.prompt([{
		//         type: 'input',
		//         name: 'customAppId',
		//         message: 'Enter your custom App ID:',
		//         validate: (input: string) => input.trim() ? true : 'Custom App ID is required'
		//       }]);
		//       options.customAppId = customAppId;
		//     }
		//   } else {
		//     throw new Error(
		//       'When using on-chain KMS, either --private-key (or PRIVATE_KEY env) or --custom-app-id must be provided'
		//     );
		//   }
		// }
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
					// 'When using on-chain KMS, either --private-key (or PRIVATE_KEY env) or --custom-app-id must be provided'
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
			const envContent = fs.readFileSync(envFilePath, { encoding: "utf8" });
			envs = parseEnvVars(envContent);
		} catch (error) {
			throw new Error(`Error reading environment file ${envFilePath}:`, error);
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

const validateNodeandKmsandImage = async (options: Options, client: Client) => {
	const nodes_result = await safeGetAvailableNodes(client);
	if (!nodes_result.success) {
		if ("isRequestError" in nodes_result.error) {
			throw new Error(
				`HTTP ${nodes_result.error.status}: ${nodes_result.error.message}`,
			);
		}
		throw new Error(`Validation error: ${nodes_result.error.issues}`);
	}
	// biome-ignore lint/suspicious/noExplicitAny: type inference issue with @phala/cloud library
	const nodes = nodes_result.data as any;
	let target = null;
	let kms = null;
	let privateKey = options.privateKey;
	// If specified node, find it
	if (options.nodeId) {
		target = nodes.nodes.find(
			(node) => node.teepod_id === Number(options.nodeId),
		);
		if (!target) {
			throw new Error(
				`Node ${options.nodeId} not found, available nodes: ${nodes.nodes.map((t) => t.teepod_id).join(", ")}`,
			);
		}
	} else {
		// If interactive, let user select a node
		if (options.interactive) {
			const { node } = await inquirer.prompt([
				{
					type: "list",
					name: "node",
					message: "Select a Node to use:",
					choices: nodes.nodes.map((t) => ({
						name: `${t.name} (Region: ${t.region_identifier})`,
						value: t,
					})),
				},
			]);
			target = node;
		} else {
			// If no specified node, use the first one.
			target = nodes.nodes[0];
		}
	}
	if (!target) {
		throw new Error(
			`No available nodes found, available nodes: ${nodes.nodes.map((t) => t.teepod_id).join(", ")}`,
		);
	}
	// If the target node supports on-chain kms, check if kms is specified
	if (target.support_onchain_kms) {
		const kms_result = await safeGetKmsList(client);
		if (!kms_result.success) {
			if ("isRequestError" in kms_result.error) {
				throw new Error(
					`HTTP ${kms_result.error.status}: ${kms_result.error.message}`,
				);
			}
			throw new Error(`Validation error: ${kms_result.error.issues}`);
		}
		// biome-ignore lint/suspicious/noExplicitAny: type inference issue with @phala/cloud library
		const kms_list = kms_result.data as any;
		if (!options.kmsId) {
			if (options.interactive) {
				const { kmsChoice } = await inquirer.prompt([
					{
						type: "list",
						name: "kmsChoice",
						message: "Select a KMS to use:",
						choices: kms_list.items.map((t) => ({
							name: t.chain_id
								? `${t.slug} (Chain ID: ${t.chain_id})`
								: `${t.slug} (No chain required)`,
							value: t,
						})),
					},
				]);
				kms = kmsChoice;
			} else {
				throw new Error(
					`Node ${target.name} requires a KMS ID for Contract Owned CVM, available kms: ${kms_list.items.map((t) => t.slug).join(", ")}`,
				);
			}
		} else {
			// Find the specified kms
			kms = kms_list.items.find(
				(kms) => kms.slug === options.kmsId || kms.id === options.kmsId,
			);
		}
		if (!kms) {
			throw new Error(
				`KMS ${options.kmsId} not found, available kms: ${kms_list.items.map((t) => t.slug).join(", ")}`,
			);
		}
		privateKey = await validatePrivateKey(
			{ ...options, kmsId: kms.id },
			kms.chain_id,
		);
	}

	// Default image is the first one
	let image = target.images[0];
	if (options.image) {
		image = target.images.find((image) => image.name === options.image);
		if (!image) {
			throw new Error(
				`Image ${options.image} not found in the node ${target.name}, available images: ${target.images.map((t) => t.name).join(", ")}.`,
			);
		}
	} else {
		if (options.interactive) {
			const { imageChoice } = await inquirer.prompt([
				{
					type: "list",
					name: "imageChoice",
					message: "Select an image to use:",
					choices: target.images.map((t) => ({
						name: `${t.name}`,
						value: t,
					})),
				},
			]);
			image = imageChoice;
		}
	}
	if (!image) {
		throw new Error(
			`No available OS images found in the node ${target.name}, available images: ${target.images.map((t) => t.name).join(", ")}.`,
		);
	}

	return {
		target,
		kms,
		image,
		privateKey,
	};
};

const deployNewCvm = async (
	validatedOptions: Options,
	docker_compose_yml: string,
	envs: EnvVar[],
	client: Client,
) => {
	// await validateKMSId(validatedOptions);
	const name = await validateName(validatedOptions);
	const { vcpu, memoryMB, diskSizeGB } =
		await validateCpuMemoryDiskSize(validatedOptions);
	const { target, kms, image, privateKey } = await validateNodeandKmsandImage(
		validatedOptions,
		client,
	);

	const app_compose = {
		name: name,
		compose_file: {
			docker_compose_file: docker_compose_yml,
			allowed_envs: envs.map((env) => env.key),
		},
		vcpu: vcpu,
		memory: memoryMB,
		disk_size: diskSizeGB,
		node_id: target.teepod_id,
		image: image.name,
		kms_id: kms?.slug,
	};

	console.log(`Deploying CVM ${name}...`);

	// Deploy the app with Centralized KMS
	const provision_result = await safeProvisionCvm(client, app_compose);
	if (!provision_result.success) {
		throw new Error("Failed to provision CVM:", provision_result.error);
	}
	// biome-ignore lint/suspicious/noExplicitAny: type inference issue with @phala/cloud library
	const app = provision_result.data as any;
	let commit_result;

	// For centralized KMS, we can get the AppID & AppEnvEncryptPubkey from provision response.
	if ((app.app_env_encrypt_pubkey && app.app_id) || !kms?.chain_id) {
		const encrypted_env_vars = await encryptEnvVars(
			envs,
			app.app_env_encrypt_pubkey,
		);
		commit_result = await safeCommitCvmProvision(client, {
			app_id: app.app_id,
			encrypted_env: encrypted_env_vars,
			compose_hash: app.compose_hash,
			kms_id: kms?.slug,
		});
	} else {
		// For decentralized KMS, we need to deploy the app with on-chain KMS.
		const kms_slug = kms.slug;
		const kms_contract_address = kms.kms_contract_address;
		const chain = kms.chain;
		const compose_hash = app.compose_hash;
		const device_id = target.device_id;
		const rpc_url = validatedOptions.rpcUrl;

		const deploy_result = await safeDeployAppAuth({
			chain: chain,
			rpcUrl: rpc_url,
			kmsContractAddress: kms_contract_address,
			privateKey: privateKey as `0x${string}`,
			deviceId: device_id,
			composeHash: compose_hash,
		});
		if (!deploy_result.success) {
			// @ts-ignore
			const message = deploy_result?.error?.message;
			throw new Error(`Deployment contract failed: ${message}`);
		}
		// biome-ignore lint/suspicious/noExplicitAny: type inference issue with @phala/cloud library
		const deployed_contract = deploy_result.data as any;
		const app_id = deployed_contract.appId;
		const resp = await safeGetAppEnvEncryptPubKey(client, {
			app_id: app_id,
			kms: kms_slug,
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
			app_id: app_id,
			encrypted_env: encrypted_env_vars,
			compose_hash: app.compose_hash,
			kms_id: kms_slug,
			contract_address: deployed_contract.appAuthAddress,
			deployer_address: deployed_contract.deployer,
		});
	}

	if (!commit_result.success) {
		if ("isRequestError" in commit_result.error) {
			throw new Error(
				`HTTP ${commit_result.error.status}: ${commit_result.error.message}`,
			);
		}
		throw new Error(`Validation error: ${commit_result.error.issues}`);
	}
	// biome-ignore lint/suspicious/noExplicitAny: type inference issue with @phala/cloud library
	const cvm = commit_result.data as any;
	saveCvmUuid(cvm.vm_uuid);
	if (validatedOptions?.json !== false) {
		console.log(
			JSON.stringify(
				{
					success: true,
					vm_uuid: cvm.vm_uuid,
					name: cvm.name,
					app_id: cvm.app_id,
					dashboard_url: `${CLOUD_URL}/dashboard/cvms/${cvm.vm_uuid}`,
				},
				null,
				2,
			),
		);
	} else {
		const successMessage = dedent`
      CVM created successfully!

      CVM ID:    ${cvm.vm_uuid}
      Name:      ${cvm.name}
      App ID:    ${cvm.app_id}
      Dashboard URL:  ${CLOUD_URL}/dashboard/cvms/${cvm.vm_uuid}
    `;
		console.log(successMessage);
	}
};

const updateCvm = async (
	validatedOptions: Options,
	docker_compose_yml: string,
	envs: EnvVar[] | undefined,
	client: Client,
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

	if (!validatedOptions.json) {
		console.log(`Preparing update for CVM ${validatedOptions.uuid}...`);
	}
	const provision_result = await safeProvisionCvmComposeFileUpdate(client, {
		uuid: validatedOptions.uuid,
		app_compose:
			app_compose as ProvisionCvmComposeFileUpdateRequest["app_compose"],
	});
	if (!provision_result.success) {
		logDetailedError(provision_result.error, "Provision CVM Compose File Update");
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
			// @ts-ignore
			const message = receipt_result?.error?.message;
			throw new Error(`Failed to add compose hash: ${message}`);
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
			console.log("\nWaiting for update to complete...");
		}
		try {
			await waitForCvmReady(
				validatedOptions.uuid,
				300000, // 5 minutes timeout
				!validatedOptions.json, // show progress if not in JSON mode
			);
		} catch (error: any) {
			throw new Error(`Wait failed: ${error.message}`);
		}
	}

	if (validatedOptions?.json !== false) {
		console.log(
			JSON.stringify(
				{
					success: true,
					vm_uuid: validatedOptions.uuid,
					name: cvm.name,
					app_id: cvm.app_id,
					dashboard_url: `${CLOUD_URL}/dashboard/cvms/${validatedOptions.uuid}`,
				},
				null,
				2,
			),
		);
	} else {
		console.log("CVM compose file updated successfully!");
	}
};

export const deployCommand = new Command()
	.command("deploy [compose]")
	.description("Create a new CVM with on-chain KMS in one step.")
	.option("--json", "Output in JSON format", false)
	.option("--no-json", "Disable JSON output format")
	.option("--debug", "Enable debug logging", false)
	.option("--api-key <apiKey>", "API key for authentication")
	.option("-n, --name <name>", "Name of the CVM")
	.option(
		"-c, --compose <compose>",
		"Path to Docker Compose file (default: docker-compose.yml in current directory)",
	)
	.option("--vcpu <vcpu>", `Number of vCPUs, default is ${DEFAULT_VCPU}`)
	.option(
		"--memory <memory>",
		`Memory with optional unit (e.g., 2G, 1024MB), default is ${DEFAULT_MEMORY}MB`,
	)
	.option(
		"--disk-size <diskSize>",
		`Disk size with optional unit (e.g., 50G, 100GB), default is ${DEFAULT_DISK_SIZE}GB`,
	)
	.option("--image <image>", "Version of dstack image to use")
	.option("--node-id <nodeId>", "Node ID to use")
	.option(
		"-e, --env-file <envFile>",
		"Prompt for environment variables and save to file (optional)",
	)
	.option(
		"-i, --interactive",
		"Enable interactive mode for required parameters",
		false,
	)
	.option("--kms-id <kmsId>", "KMS ID to use.")
	.option("--uuid <uuid>", "UUID of the CVM to upgrade")
	.addOption(
		new Option(
			"--custom-app-id <customAppId>",
			"Custom App ID to use.",
		).hideHelp(),
	)
	.option("--pre-launch-script <preLaunchScript>", "Path to pre-launch script")
	.option("--private-key <privateKey>", "Private key for signing transactions.")
	.option("--rpc-url <rpcUrl>", "RPC URL for the blockchain.")
	.option(
		"--wait",
		"Wait for CVM to complete deployment/update before returning (only applies to updates)",
		false,
	)
	.action(async (composeFile: string | undefined, options: Options) => {
		try {
			// Use positional argument if provided, otherwise use the --compose option
			const dockerComposePath = composeFile || options.compose;

			const client = await getApiClient({
				apiKey: options.apiKey,
				interactive: options.interactive,
			});

			const docker_compose_yml = await readDockerComposeFile({
				dockerComposePath: dockerComposePath,
				interactive: options.interactive,
			});

			const uuid = readCvmUuid({ uuid: options.uuid });
			const envs = await validateEnvFile(options);

			const isUpdate = !!uuid;
			if (isUpdate) {
				// Update the cvm
				await updateCvm(
					{
						...options,
						uuid,
					},
					docker_compose_yml,
					envs,
					client,
				);
			} else {
				// Deploy a new cvm
				await deployNewCvm(
					{
						...options,
						uuid,
					},
					docker_compose_yml,
					envs,
					client,
				);
			}
		} catch (error) {
			if (options.json !== false) {
				console.error(
					JSON.stringify(
						{
							success: false,
							error: error.message,
							stack:
								options.debug && error instanceof Error
									? error.stack
									: undefined,
						},
						null,
						2,
					),
				);
			} else {
				console.error(dedent`${error.message}`);
			}
			process.exit(1);
		}
	});
