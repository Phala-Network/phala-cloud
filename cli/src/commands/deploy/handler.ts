import os from "node:os";
import path from "node:path";
import type { CommandContext } from "@/src/core/types";
import {
	type CliApiClient,
	getClient,
	getClientWithKey,
	resolveAuthForContext,
} from "@/src/lib/client";
import {
	CLOUD_URL,
	DEFAULT_DISK_SIZE,
	DEFAULT_MEMORY,
	DEFAULT_VCPU,
} from "@/src/utils/constants";
import {
	waitForCvmCreated,
	waitForCvmOperation,
	waitForCvmReady,
} from "@/src/utils/cvms";
import { logger } from "@/src/utils/logger";

import {
	getEncryptPubkey,
	verifyAndExtractEnvEncryptPubkey,
} from "@/src/commands/envs/get-encrypt-pubkey";
import { dedupeEnvVars, parseEnvInputs } from "@/src/utils/env-parsing";
import type { RuntimeProjectConfig } from "@/src/utils/project-config";
import { detectFileInCurrentDir, promptForFile } from "@/src/utils/prompts";
import {
	parseDiskSizeInput,
	parseMemoryInput,
	parseSizeWithUnit,
} from "@/src/utils/units";
import {
	CvmIdSchema,
	type EnvVar,
	MAX_COMPOSE_PAYLOAD_BYTES,
	type MrConfigV3Input,
	type ProvisionCvmRequest,
	buildMrConfigV3Document,
	canonicalizeMrConfigV3Document,
	convertToHostname,
	encryptEnvVars,
	getMrConfigIdV3,
	isValidHostname,
	parseEnvVars,
	safeCommitCvmProvision,
	safeCommitCvmUpdate,
	safeConfirmCvmPatch,
	safeDeployAppAuth,
	safeGetAppEnvEncryptPubKey,
	safeGetAvailableNodes,
	safeGetCurrentUser,
	safeGetCvmInfo,
	safeGetCvmList,
	safeGetOsImages,
	safeListSshKeys,
	safePatchCvm,
	safeProvisionCvm,
	safeUpdateCvmVisibility,
} from "@phala/cloud";
import dedent from "dedent";
import fs from "fs-extra";
import inquirer from "inquirer";
import {
	assertInitScriptFilesExist,
	partitionInitScriptValues,
	readInitScriptFiles,
	unknownInitScriptSlugMessage,
} from "@/src/lib/init-script-files";
import {
	type DevOsMode,
	type DevOsPlan,
	type OsImageCatalogEntry,
	composeHasDevBoxMarkers,
	injectDevBoxService,
	requireDevOsImage,
	resolveDevOsPlan,
} from "./dev-box";
import {
	forgetDevOsMode,
	recallDevOsMode,
	rememberDevOsMode,
} from "./dev-os-selection";
import { runTwoPhaseComposeUpdate } from "@/src/lib/on-chain-update";
import type { DeployCommandInput } from "./command";

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
	node?: string;
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
	noPreLaunchScript?: boolean;
	privateKey?: string;
	rpcUrl?: string;
	json?: boolean;
	debug?: boolean;
	apiToken?: string;
	wait?: boolean;
	forceStop?: boolean;
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
	runner?: "docker-compose" | "nerdctl-compose" | "bash";
	appCompose?: string;
	initScript?: string[];
	clearInitScripts?: boolean;
	launchToken?: string;
	launchTokenHash?: string;
	generateLaunchToken?: boolean;
	eventLogVersion?: "1" | "2";
	ephemeralDataDisk?: boolean;
	gateway?: boolean;
	confirmDataWipe?: boolean;
	[key: string]: unknown;
}

export function applyForceStopOption(
	patchBody: Record<string, unknown>,
	forceStop: boolean | undefined,
): void {
	if (!forceStop) return;
	patchBody.allow_force_stop = true;
}

export function validatePreLaunchScriptOptions(
	options: Pick<Options, "noPreLaunchScript" | "preLaunchScript">,
): void {
	if (options.noPreLaunchScript && options.preLaunchScript !== undefined) {
		throw new Error(
			"--no-pre-launch-script cannot be used with --pre-launch-script",
		);
	}
}

/**
 * Flags that set create-time CVM configuration. PATCH /cvms/{id} cannot
 * change them, so an update rejects them instead of ignoring them.
 */
const CREATE_ONLY_FLAGS: ReadonlyArray<readonly [keyof Options, string]> = [
	["name", "--name"],
	["region", "--region"],
	["node", "--node"],
	["customAppId", "--custom-app-id"],
	["nonce", "--nonce"],
	["keyProviderMode", "--key-provider-mode"],
	// --dev-os is *not* here: a dev box lives only in the payload, never in the
	// compose file on disk, so an update has to be able to re-add it.
	["sshPubkey", "--ssh-pubkey"],
	["fs", "--fs"],
	["skipGateway", "--skip-gateway"],
	["kms", "--kms"],
	["kmsId", "--kms-id"],
	["kmsContract", "--kms-contract"],
	["kmsContractId", "--kms-contract-id"],
	["experimentalKeyProviderType", "--experimental-key-provider-type"],
	["runner", "--runner"],
	["appCompose", "--app-compose"],
	["launchToken", "--launch-token"],
	["generateLaunchToken", "--generate-launch-token"],
];

function readScriptFile(filePath: string, missingMessage: string): string {
	if (!fs.existsSync(filePath)) {
		throw new Error(missingMessage);
	}
	return fs.readFileSync(filePath, "utf8");
}

export function assertUpdatableOptions(options: Options): void {
	const flags = CREATE_ONLY_FLAGS.filter(
		([key]) => options[key] !== undefined,
	).map(([, flag]) => flag);
	if (flags.length > 0) {
		throw new Error(
			`${flags.join(", ")} cannot be changed on an existing CVM. Remove ${flags.length === 1 ? "it" : "them"} to update the CVM, or deploy a new CVM.`,
		);
	}
	if (options.clearInitScripts && options.initScript !== undefined) {
		throw new Error(
			"--clear-init-scripts cannot be combined with --init-script.",
		);
	}
	const unknownInitScripts = partitionInitScriptValues(
		options.initScript,
	).files;
	if (unknownInitScripts.length > 0) {
		throw new Error(
			`${unknownInitScriptSlugMessage(unknownInitScripts[0] as string)}. File paths with --init-script can only be used when creating a CVM, not with --cvm-id.`,
		);
	}
}

/**
 * Flags that shape the compose. --app-compose sends a whole app compose, so
 * they would be ignored; reject them instead.
 */
const COMPOSE_SHAPING_FLAGS: ReadonlyArray<readonly [keyof Options, string]> = [
	["compose", "--compose"],
	["runner", "--runner"],
	["preLaunchScript", "--pre-launch-script"],
	["fs", "--fs"],
	["secureTime", "--secure-time"],
	["publicLogs", "--public-logs"],
	["publicSysinfo", "--public-sysinfo"],
	["publicTcbinfo", "--public-tcbinfo"],
	["eventLogVersion", "--event-log-version"],
	["ephemeralDataDisk", "--ephemeral-data-disk"],
	["gateway", "--gateway"],
	["experimentalKeyProviderType", "--experimental-key-provider-type"],
];

/** Reject flag combinations a new deployment cannot honor. */
export function assertCreateOptions(options: Options): void {
	for (const [key, flag] of [
		["confirmDataWipe", "--confirm-data-wipe"],
		["launchTokenHash", "--launch-token-hash"],
		["clearInitScripts", "--clear-init-scripts"],
	] as const) {
		if (options[key] !== undefined) {
			throw new Error(
				`${flag} only applies to an update of an existing CVM (--cvm-id).`,
			);
		}
	}
	const initScripts = partitionInitScriptValues(options.initScript);
	assertInitScriptFilesExist(initScripts.files);
	if (initScripts.slugs.length > 0 && initScripts.files.length > 0) {
		throw new Error(
			"Send either init script slugs or init script files with --init-script, not both.",
		);
	}
	if (initScripts.files.length > 5) {
		throw new Error("--init-script accepts at most 5 script files.");
	}
	if (options.appCompose !== undefined && initScripts.files.length > 0) {
		throw new Error(
			"--init-script file paths cannot be used with --app-compose. Set them in the app-compose file.",
		);
	}
	if (options.appCompose === undefined) return;
	const flags = COMPOSE_SHAPING_FLAGS.filter(
		([key]) => options[key] !== undefined,
	).map(([, flag]) => flag);
	if (options.noPreLaunchScript) flags.push("--no-pre-launch-script");
	if (flags.length > 0) {
		throw new Error(
			`${flags.join(", ")} cannot be used with --app-compose. Set ${flags.length === 1 ? "it" : "them"} in the app-compose file.`,
		);
	}
}

/** Compose fields set by flags; a create puts them in compose_file, an update in compose. */
function composeFieldsFromOptions(options: Options): Record<string, unknown> {
	const fields: Record<string, unknown> = {};
	if (options.gateway !== undefined) {
		fields.gateway_enabled = options.gateway;
	}
	if (options.eventLogVersion !== undefined) {
		fields.event_log_version = Number(options.eventLogVersion);
	}
	if (options.ephemeralDataDisk !== undefined) {
		fields.requirements = { ephemeral_data_disk: options.ephemeralDataDisk };
	}
	return fields;
}

function parseVcpuInput(input: string): number {
	const vcpu = Number(input);
	if (!Number.isInteger(vcpu) || vcpu <= 0) {
		throw new Error(`Invalid vCPU count '${input}'. Use a positive integer.`);
	}
	return vcpu;
}

export function buildUpdatePatchBody(
	options: Options,
	composeContent: string,
	preLaunchScriptContent?: string,
	currentRunner?: string,
): Record<string, unknown> {
	const patchBody: Record<string, unknown> = { id: options.uuid };

	if (options.noPreLaunchScript) {
		patchBody.pre_launch_script = "";
	} else if (preLaunchScriptContent) {
		patchBody.pre_launch_script = preLaunchScriptContent;
	}
	if (options.publicLogs !== undefined) {
		patchBody.public_logs = options.publicLogs;
	}
	if (options.publicSysinfo !== undefined) {
		patchBody.public_sysinfo = options.publicSysinfo;
	}
	if (options.publicTcbinfo !== undefined) {
		patchBody.public_tcbinfo = options.publicTcbinfo;
	}
	if (options.instanceType) {
		patchBody.instance_type = options.instanceType;
	}
	if (options.vcpu) {
		patchBody.vcpu = parseVcpuInput(options.vcpu);
	}
	if (options.memory) {
		// Unit conversion only: the backend matches the nearest instance spec.
		patchBody.memory = Math.round(
			parseSizeWithUnit(options.memory, "MB") / (1024 * 1024),
		);
	}
	if (options.diskSize) {
		patchBody.disk_size = parseDiskSizeInput(options.diskSize);
	}
	if (options.image) {
		patchBody.image = options.image;
	}
	const compose = composeFieldsFromOptions(options);
	// The bash runner runs a script instead of Docker Compose YAML.
	if (currentRunner === "bash") {
		compose.bash_script = composeContent;
	} else {
		patchBody.docker_compose_file = composeContent;
	}
	if (options.secureTime !== undefined) {
		compose.secure_time = options.secureTime;
	}
	if (options.launchTokenHash !== undefined) {
		// An empty value removes the key: null in a merge patch.
		compose.requirements = {
			...(compose.requirements as Record<string, unknown> | undefined),
			launch_token_hash: options.launchTokenHash || null,
		};
	}
	if (Object.keys(compose).length > 0) {
		patchBody.compose = compose;
	}
	if (options.clearInitScripts) {
		patchBody.init_scripts = [];
	} else if (options.initScript !== undefined) {
		patchBody.init_scripts = options.initScript;
	}
	if (options.confirmDataWipe) {
		patchBody.confirm_data_wipe = true;
	}
	applyForceStopOption(patchBody, options.forceStop);
	if (options.prepareOnly) {
		patchBody.prepareOnly = true;
	}

	return patchBody;
}

async function getApiClient({
	context,
	apiToken,
	interactive,
}: Readonly<
	Pick<Options, "apiToken" | "interactive"> & {
		context?: Pick<CommandContext, "env" | "projectConfig" | "globalOptions">;
	}
>): Promise<CliApiClient> {
	const resolved = resolveAuthForContext(context, { apiToken });
	if (resolved.apiKey || resolved.bearerToken) {
		// Honors global --api-version via getClient (no hardcoded version).
		// OIDC: PHALA_OIDC_TOKEN -> Authorization Bearer (deploy routes only on server).
		return getClient(context, { apiToken });
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
		return getClientWithKey(promptedToken, { baseURL: resolved.baseURL });
	}

	throw new Error(
		"Authentication required. Run 'phala login', set PHALA_CLOUD_API_KEY, or set PHALA_OIDC_TOKEN for GitHub Actions OIDC deploy.",
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

async function readAppComposeFile(appComposePath: string): Promise<string> {
	if (!fs.existsSync(appComposePath)) {
		throw new Error(`App compose file not found: ${appComposePath}`);
	}
	return fs.readFileSync(appComposePath, "utf8");
}

const OS_IMAGE_CATALOG_PAGE_SIZE = 100;

/** Every enabled OS image, walking the catalog's pages. */
async function listOsImageCatalog(
	client: CliApiClient,
): Promise<OsImageCatalogEntry[]> {
	const entries: OsImageCatalogEntry[] = [];
	for (let page = 1; ; page += 1) {
		const result = await safeGetOsImages(client, {
			page,
			page_size: OS_IMAGE_CATALOG_PAGE_SIZE,
		});
		if (!result.success) throw result.error;
		entries.push(...result.data.items);
		if (page >= result.data.pages) return entries;
	}
}

/** A state write the CLI commits only after the deployment has been applied. */
type DevOsStateChange =
	| { readonly kind: "remember"; readonly mode: DevOsMode }
	| { readonly kind: "forget" };

/** What the dev OS step decided, and what to record once it succeeded. */
interface DevOsResolution {
	/** How this deployment satisfies `--dev-os`, when it does. */
	readonly plan?: DevOsPlan;
	/** The state write to commit once the deployment has been applied. */
	readonly stateChange?: DevOsStateChange;
}

/**
 * The compose a deployment sends: the caller's payload, plus the dev box when
 * the resolved mode asks for it.
 *
 * Idempotent: a payload the backend already reads as a dev box (the four
 * markers) comes back unchanged, whoever wrote it and whatever the service is
 * called. Adding the canonical box beside a hand-written one would only put two
 * containers on the host's port 22.
 */
export function composeForDevOs(
	composeYaml: string,
	devOsMode: DevOsMode | undefined,
): { compose: string; added: boolean } {
	if (devOsMode !== "dev-box") return { compose: composeYaml, added: false };
	if (composeHasDevBoxMarkers(composeYaml)) {
		return { compose: composeYaml, added: false };
	}
	const compose = injectDevBoxService(composeYaml);
	return { compose, added: compose !== composeYaml };
}

/**
 * The CVM an update targets, in the terms the dev OS record needs.
 *
 * `vmUuid` is the key the record is stored under: the user may name the same
 * CVM as a UUID, a 40-character app id or `app_...`, and only the server can
 * tell those are one CVM, so the id is resolved before anything is recalled.
 *
 * `compose` and `sshAccessEnabled` are how a dev box the record does not know
 * about is recognised — a CVM deployed from another machine, or before this CLI
 * kept a record, still has SSH access worth keeping.
 */
export interface UpdateTarget {
	/** The identifier the caller used, normalized by `CvmIdSchema`. */
	readonly id: string;
	/** The server's canonical id for this CVM; the dev OS record key. */
	readonly vmUuid: string;
	/** The CVM as the API returned it. */
	readonly cvm: unknown;
	/** The compose the CVM currently runs, when the server returns one. */
	readonly compose?: string;
	/** The server's own verdict on whether this CVM has SSH access. */
	readonly sshAccessEnabled?: boolean;
}

function readMapping(value: unknown): Record<string, unknown> | undefined {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return undefined;
	}
	return value as Record<string, unknown>;
}

/** The compose a CVM detail payload carries, in either shape the API allows. */
function readDeployedCompose(cvm: unknown): string | undefined {
	const composeFile = readMapping(cvm)?.compose_file;
	const record = readMapping(composeFile);
	if (record) {
		const compose = record.docker_compose_file;
		return typeof compose === "string" ? compose : undefined;
	}
	return typeof composeFile === "string" ? composeFile : undefined;
}

/**
 * Resolve the CVM an update targets, once, before the payload is built.
 *
 * Not an extra round trip: `updateCvm` needs the same record for the runner and
 * the KMS key, and used to fetch it itself.
 */
async function fetchUpdateTarget(
	client: CliApiClient,
	id: string,
): Promise<UpdateTarget> {
	const result = await safeGetCvmInfo(client, { id });
	if (!result.success) throw result.error;

	const cvm = result.data;
	const record = readMapping(cvm);
	const vmUuid = record?.vm_uuid;
	const sshAccess = record?.enabled_ssh_access;
	const resolvedUuid =
		typeof vmUuid === "string" && vmUuid.length > 0 ? vmUuid : undefined;
	if (!resolvedUuid) {
		logger.warn(
			"Phala Cloud did not return this CVM's vm_uuid, so the dev OS setting is recorded under the identifier you passed. Pass --dev-os on the next update if this CVM uses a dev box.",
		);
	}

	return {
		id,
		vmUuid: resolvedUuid ?? id,
		cvm,
		compose: readDeployedCompose(cvm),
		sshAccessEnabled: typeof sshAccess === "boolean" ? sshAccess : undefined,
	};
}

/**
 * How `--dev-os` is satisfied for this deployment.
 *
 * The dstack release of the requested image decides it, resolved against the OS
 * image catalog. `resolveDevOsPlan` refuses to guess, so an unpinned image or
 * one the catalog does not know fails here instead of deploying a CVM with the
 * wrong SSH setup.
 *
 * An update without the flag reuses the choice recorded for the CVM, and when
 * there is no record it asks the deployed compose rather than assuming SSH
 * should go away: the dev box only ever existed in a payload, never in the
 * compose file on disk, so the record can be missing for a CVM that still has
 * one.
 *
 * Records are only *planned* here; `commitDevOsState` writes them once the API
 * accepted the change, so a failed deployment leaves them untouched.
 */
async function resolveDevOsTarget(
	client: CliApiClient,
	options: Options,
	target: UpdateTarget | undefined,
): Promise<DevOsResolution> {
	if (options.devOs === false) {
		return target ? { stateChange: { kind: "forget" } } : {};
	}
	if (options.devOs === undefined) {
		if (!target) return {};
		const recorded = recallDevOsMode(target.vmUuid);
		if (recorded !== undefined) {
			logger.info(
				`Re-using the dev OS setting recorded for this CVM (${recorded}).`,
			);
			return { plan: { mode: recorded, image: options.image } };
		}
		if (target.compose !== undefined) {
			if (!composeHasDevBoxMarkers(target.compose)) return {};
			logger.info(
				"The deployed compose carries a dev box; keeping it on this update.",
			);
			return {
				plan: { mode: "dev-box", image: options.image },
				stateChange: { kind: "remember", mode: "dev-box" },
			};
		}
		if (target.sshAccessEnabled === true) {
			logger.warn(
				"This CVM has SSH access and Phala Cloud did not return its compose, so the CLI cannot tell whether that comes from a dev box. Pass --dev-os to keep the dev box, or --no-dev-os to drop it.",
			);
		}
		return {};
	}
	// Validate before the catalog request so an unusable invocation fails
	// without touching the network.
	const identifier = requireDevOsImage(options.image);
	const catalog = await listOsImageCatalog(client);
	const plan = resolveDevOsPlan(identifier, catalog);
	return { plan, stateChange: { kind: "remember", mode: plan.mode } };
}

/**
 * Write a dev OS state change once the deployment that decided it succeeded.
 *
 * The record is keyed by the server's `vm_uuid`: a create and an update can only
 * agree on that id, whatever form the caller used.
 */
function commitDevOsState(
	vmUuid: string | undefined,
	change: DevOsStateChange | undefined,
): void {
	if (!change) return;
	if (!vmUuid) {
		if (change.kind === "remember") {
			logger.warn(
				"Could not record the dev OS setting: the API did not return the CVM's vm_uuid. Pass --dev-os on the next update.",
			);
		}
		return;
	}
	if (change.kind === "remember") {
		rememberDevOsMode(vmUuid, change.mode);
	} else {
		forgetDevOsMode(vmUuid);
	}
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
 * Where the SSH keys of a deployment come from.
 *
 * The dev box reads them from `user_config`, which provision fills with the
 * account's keys; a dev OS image below dstack 0.6 (or anything else) can only
 * take them from `DSTACK_AUTHORIZED_KEYS`.
 */
export type SshKeyChannel = "dev-image" | "dev-box" | "none";

/**
 * Decide the key channel from the payload that will actually be sent.
 *
 * The rule is the backend's own (`teehouse/cvms/dev_box.py`): any service with
 * the four markers is a dev box, whatever its image, volume names, environment
 * or whether the CLI would have written it that way. A key read from disk only
 * reaches `DSTACK_AUTHORIZED_KEYS`, which is frozen at deploy time and outlives
 * a revocation, so the markers — not the stricter canonical check, which only
 * decides whether injection can be skipped — decide this.
 *
 * `--app-compose` passes a whole AppCompose JSON document; the markers are read
 * from the compose inside it. A pre-0.6 dev image keeps the legacy env path,
 * flag or not.
 */
export function resolveSshKeyChannel(
	devOsMode: DevOsMode | undefined,
	payload: string,
): SshKeyChannel {
	if (devOsMode === "dev-image") return "dev-image";
	if (devOsMode === "dev-box" || composeHasDevBoxMarkers(payload)) {
		return "dev-box";
	}
	return "none";
}

/**
 * Read the SSH public key that goes into `DSTACK_AUTHORIZED_KEYS`.
 *
 * - `none`: `--no-dev-os`, or no dev release in play; a local key is used
 *   unless `--no-pre-launch-script` asks for none
 * - `dev-image`: a dev OS image (dstack 0.5 and older) with sshd built in; a
 *   key is required and only the env var can carry it
 * - `dev-box`: the compose ships the dev box, which reads keys from
 *   `user_config`; only an explicit `--ssh-pubkey` is injected into the env,
 *   see below for why
 *
 * @param channel - where this deployment's SSH keys come from, as decided by
 * the final compose rather than the flag
 */
export const readSshPubkey = async (
	options: Options,
	channel: SshKeyChannel = "none",
): Promise<string | undefined> => {
	let sshPubkeyPath = options.sshPubkey;

	if (options.sshPubkey) {
		logger.warn(
			"--ssh-pubkey is deprecated. Register the key with `phala ssh-keys add` and manage per-CVM access with `phala ssh-keys grant`. Provision already authorizes all of your account keys by default, so this flag is usually unnecessary.",
		);
	}

	// --no-dev-os: never inject SSH key
	if (options.devOs === false) {
		return undefined;
	}

	// The dev box merges two key channels, and the managed one —
	// `user_config.ssh_authorized_keys`, which provision fills with every
	// account key when the request carries no ssh_key_ids — is the one that
	// follows the platform key management. A key read from disk would only land
	// in the container environment, where it is frozen at deploy time and
	// survives revoking the key in the account. So never pick up a local key
	// here; the user has to name one explicitly.
	if (channel === "dev-box" && !options.sshPubkey) {
		return undefined;
	}

	if (
		options.noPreLaunchScript &&
		options.devOs !== true &&
		!options.sshPubkey
	) {
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
			// A dev OS image (dstack 0.5 and older) can only take keys from here.
			if (channel === "dev-image") {
				throw new Error(
					dedent(`
						SSH public key is required for a dev OS image but not found.

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

/**
 * Point out that a dev-box deployment with no account SSH key and no
 * `--ssh-pubkey` produces a CVM nobody can log into.
 *
 * Provision authorizes every account key into `user_config` when the request
 * carries no `ssh_key_ids`, which is exactly the channel the dev box reads, so
 * an empty account means an empty authorized_keys. This is a hint, never a
 * failure: keys added later reach the CVM on its next boot.
 */
async function warnWhenAccountHasNoSshKeys(
	client: CliApiClient,
): Promise<void> {
	const result = await safeListSshKeys(client);
	if (!result.success || result.data.length > 0) return;
	logger.warn(
		"This account has no SSH keys. The dev box authorizes your account keys into the CVM, so add one with `phala ssh-keys add` and restart the CVM, or no SSH login will succeed.",
	);
}

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

function buildComposeFile(
	options: Options,
	composeContent: string,
	envs: EnvVar[],
	privacySettings: PrivacySettings,
	preLaunchScriptContent?: string,
	initScriptContents?: string[],
): Record<string, unknown> {
	const composeFile: Record<string, unknown> = {
		name: "", // Required by backend schema, defaults to empty string
		allowed_envs: envs?.map((e) => e.key) || [],
		public_logs: privacySettings.publicLogs,
		public_sysinfo: privacySettings.publicSysinfo,
		public_tcbinfo: privacySettings.publicTcbinfo,
		secure_time: privacySettings.secureTime,
		...composeFieldsFromOptions(options),
	};
	// The bash runner runs a script instead of Docker Compose YAML.
	if (options.runner === "bash") {
		composeFile.bash_script = composeContent;
	} else {
		composeFile.docker_compose_file = composeContent;
	}
	if (options.runner) {
		composeFile.runner = options.runner;
	}

	if (options.noPreLaunchScript) {
		composeFile.pre_launch_script = "";
	} else if (preLaunchScriptContent) {
		composeFile.pre_launch_script = preLaunchScriptContent;
	}

	if (options.fs) {
		composeFile.storage_fs = options.fs;
	}

	if (options.experimentalKeyProviderType) {
		composeFile.key_provider = options.experimentalKeyProviderType;
	}
	if (initScriptContents && initScriptContents.length > 0) {
		composeFile.init_script = initScriptContents;
	}
	return composeFile;
}

/**
 * Build provision payload from options
 * All parameters are optional - backend will auto-match resources
 * @param preResolvedKmsSelection - Optional pre-resolved KMS selection to avoid duplicate calls/warnings
 * @param devOsMode - How `--dev-os` was resolved against the OS image catalog;
 *   undefined when the flag is absent. Required for the flag, because
 *   `prefer_dev` must be false when the dev box already carries SSH.
 */
export const buildProvisionPayload = (
	options: Options,
	name: string,
	dockerComposeYml: string,
	envs: EnvVar[],
	privacySettings: PrivacySettings,
	preResolvedKmsSelection?: ReturnType<typeof resolveKmsSelection>,
	preLaunchScriptContent?: string,
	initScriptContents?: string[],
	devOsMode?: DevOsMode,
) => {
	const payload: ProvisionCvmRequest = options.appCompose
		? // The file is the whole app compose; the API parses it.
			{
				name,
				compose_file_raw: dockerComposeYml,
				listed: privacySettings.listed,
			}
		: {
				name,
				compose_file: buildComposeFile(
					options,
					dockerComposeYml,
					envs,
					privacySettings,
					preLaunchScriptContent,
					initScriptContents,
				),
				listed: privacySettings.listed,
			};

	const initScripts = partitionInitScriptValues(options.initScript);
	if (initScripts.slugs.length > 0 && initScripts.files.length === 0) {
		payload.init_scripts = initScripts.slugs;
	}
	if (options.launchToken !== undefined) {
		payload.launch_token = options.launchToken;
	}
	if (options.generateLaunchToken !== undefined) {
		payload.generate_launch_token = options.generateLaunchToken;
	}

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

	if (options.node) {
		payload.node = options.node;
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
	// For on-chain KMS (ETHEREUM/BASE), default to non-dev since dev images may not be available.
	// dstack 0.6+ has no dev image at all: there `--dev-os` injected the
	// dev-box service into the compose, so the release image is the right one
	// and prefer_dev must stay false.
	const isOnchainKms = kmsType === "ETHEREUM" || kmsType === "BASE";
	if (options.devOs !== undefined) {
		payload.prefer_dev = devOsMode === "dev-image";
	} else if (isOnchainKms) {
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

/**
 * Report the MrConfigV3 measurement dstack will enforce at boot.
 *
 * The document binds a random per-instance `instance_id` that the VMM only
 * mints when the VM first starts, so right after provision the id is not yet
 * knowable — in that case report the document inputs instead of a value that
 * would be wrong. See `dstack/vmm/src/app/mr_config.rs`.
 */
const reportMrConfigV3 = (input: MrConfigV3Input, mayHaveGpus: boolean) => {
	if (!input.compose_hash) return;

	if (input.instance_id) {
		const document = buildMrConfigV3Document(input);
		logger.info(`mr_config_id (v3): ${getMrConfigIdV3(document)}`);
		logger.info(
			`mr_config document: ${canonicalizeMrConfigV3Document(document)}`,
		);
		return;
	}

	logger.info("mr_config_id (v3): finalized on first boot (instance_id)");
	logger.info(`  compose_hash:    ${input.compose_hash}`);
	logger.info(`  app_id:          ${input.app_id || "(not assigned)"}`);
	logger.info(`  key_provider:    ${input.key_provider}`);
	logger.info(`  key_provider_id: ${input.key_provider_id || "(none)"}`);
	if (mayHaveGpus) {
		logger.info("  gpu_policy_hash: bound at boot when the node attaches GPUs");
	}
};

const deployNewCvm = async (
	validatedOptions: Options,
	docker_compose_yml: string,
	envs: EnvVar[],
	client: CliApiClient,
	stdout: NodeJS.WriteStream,
	stderr: NodeJS.WriteStream,
	projectConfig: PrivacyConfig | undefined,
	preLaunchScriptContent: string | undefined,
	initScriptContents: string[],
	devOsMode: DevOsMode | undefined,
	sshKeyChannel: SshKeyChannel,
	context: Pick<CommandContext, "env" | "projectConfig" | "globalOptions">,
) => {
	// Resolve KMS selection once at the start to avoid duplicate calls and warnings
	const kmsSelection = resolveKmsSelection(validatedOptions);

	const name = await validateName(validatedOptions);

	// Read SSH public key and add to environment variables
	const sshPubkey = await readSshPubkey(validatedOptions, sshKeyChannel);
	const usesDevBox = sshKeyChannel === "dev-box";
	const envsWithSshKey = [...(envs || [])];
	if (sshPubkey) {
		envsWithSshKey.push({
			key: "DSTACK_AUTHORIZED_KEYS",
			value: sshPubkey,
		});
	}
	if (usesDevBox) {
		if (sshPubkey) {
			logger.warn(
				"The key from --ssh-pubkey is frozen into DSTACK_AUTHORIZED_KEYS at deploy time. Revoking it with `phala ssh-keys revoke` does not remove it from the dev-box container; restart with a compose that drops the variable for that.",
			);
		} else {
			await warnWhenAccountHasNoSshKeys(client);
		}
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
		initScriptContents,
		devOsMode,
	);

	logger.info(`Provisioning CVM ${name}...`);

	// Provision - backend will auto-match resources
	const provision_result = await safeProvisionCvm(client, payload);
	if (!provision_result.success) {
		throw provision_result.error;
	}
	// biome-ignore lint/suspicious/noExplicitAny: type inference issue with @phala/cloud library
	const app = provision_result.data as any;
	let commit_result;

	const provisionKmsInfo = app.kms_info;

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
			const failure = deploy_result as { error?: unknown };
			throw failure.error ?? new Error("Deployment contract failed");
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
			throw resp.error;
		}

		const pubkey = verifyAndExtractEnvEncryptPubkey(
			resp.data,
			deployed_contract.appId,
			provisionKmsInfo.k256_pubkey,
		);
		const encrypted_env_vars = await encryptEnvVars(envsWithSshKey, pubkey);

		commit_result = await safeCommitCvmProvision(client, {
			// Same-path two-phase create: prefer the one-time commit token.
			token: app.token,
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
			// Same-path two-phase create: prefer the one-time commit token.
			token: app.token,
			app_id: app.app_id,
			encrypted_env: encrypted_env_vars,
			compose_hash: app.compose_hash,
			kms_id: kmsSelection.deprecatedKmsId,
		});
	}

	if (!commit_result.success) {
		throw commit_result.error;
	}
	// biome-ignore lint/suspicious/noExplicitAny: type inference issue with @phala/cloud library
	const cvm = commit_result.data as any;

	if (validatedOptions.experimentalKeyProviderType) {
		reportMrConfigV3(
			{
				app_id: cvm.app_id || app.app_id || "",
				compose_hash: app.compose_hash || "",
				key_provider: validatedOptions.experimentalKeyProviderType,
				key_provider_id: provisionKmsInfo?.k256_pubkey || "",
				instance_id: cvm.instance_id || "",
			},
			!!validatedOptions.instanceType,
		);
	}

	if (validatedOptions.wait) {
		logger.info("Waiting for the CVM to start...");
		try {
			await waitForCvmCreated(client, cvm.vm_uuid, context, 300000);
		} catch (error: unknown) {
			// Name the CVM: it exists even though the wait failed. No `cause`:
			// the error envelope unwraps a cause and would drop this message.
			throw new Error(
				`The CVM ${cvm.vm_uuid} was created but did not start: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	if (validatedOptions?.json !== false) {
		stdout.write(
			`${JSON.stringify(
				{
					success: true,
					vm_uuid: cvm.vm_uuid,
					name: cvm.name,
					app_id: cvm.app_id,
					dashboard_url: `${CLOUD_URL}/dashboard/cvms/${cvm.vm_uuid}`,
					...(cvm.launch_token ? { launch_token: cvm.launch_token } : {}),
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
		if (cvm.launch_token) {
			stdout.write(
				`Launch token:   ${cvm.launch_token}\nThis is the only time the launch token is shown. Store it.\n`,
			);
		}
	}

	return {
		vmUuid: typeof cvm.vm_uuid === "string" ? cvm.vm_uuid : undefined,
	};
};

/**
 * Set the Trust Center listing once the CVM update has been accepted. The
 * listing is app-wide metadata on its own endpoint (PATCH /cvms/{id}/listed),
 * which needs an API key or session; GitHub OIDC tokens are not accepted there.
 */
async function applyListedAfterUpdate(
	client: CliApiClient,
	options: Options,
): Promise<void> {
	if (options.listed === undefined) return;
	try {
		await client.patch(`/cvms/${options.uuid}/listed`, {
			listed: options.listed,
		});
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		throw new Error(
			`The CVM update was already applied, but setting the Trust Center listing failed: ${reason}. Retry with an API key: phala api -X PATCH /cvms/${options.uuid}/listed -F listed:=${options.listed}`,
			{ cause: error },
		);
	}
	logger.info(
		`Trust Center listing ${options.listed ? "enabled" : "disabled"}.`,
	);
}

/**
 * Apply an update.
 *
 * Returns whether the change is in effect: `--prepare-only` on an on-chain CVM
 * stops at the registration step, and the dev OS record must not be written
 * until the compose actually lands.
 */
const updateCvm = async (
	validatedOptions: Options,
	docker_compose_yml: string,
	envs: EnvVar[] | undefined,
	client: CliApiClient,
	stdout: NodeJS.WriteStream,
	context:
		| Pick<CommandContext, "env" | "projectConfig" | "globalOptions">
		| undefined,
	preLaunchScriptContent: string | undefined,
	target: UpdateTarget,
): Promise<boolean> => {
	// biome-ignore lint/suspicious/noExplicitAny: type inference issue with @phala/cloud library
	const cvm = target.cvm as any;

	// Encrypt env vars before patching (backend stores the full body in Redis for two-phase).
	// getEncryptPubkey handles current (kms_info.*) and legacy top-level shapes.
	let encrypted_env: string | undefined;
	if (envs && envs.length > 0) {
		const pubkey = await getEncryptPubkey(client, cvm);
		encrypted_env = await encryptEnvVars(envs, pubkey);
	}

	// Build unified patch request
	const patchBody = buildUpdatePatchBody(
		validatedOptions,
		docker_compose_yml,
		preLaunchScriptContent,
		cvm.compose_file?.runner,
	);
	if (envs && envs.length > 0) {
		patchBody.allowed_envs = envs.map((env) => env.key);
	}
	if (encrypted_env) {
		patchBody.encrypted_env = encrypted_env;
	}

	logger.info(`Updating CVM ${validatedOptions.uuid}...`);
	// biome-ignore lint/suspicious/noExplicitAny: dynamic patch body
	const patchResult = await safePatchCvm(client, patchBody as any);
	if (!patchResult.success) {
		throw patchResult.error;
	}

	const result = patchResult.data;
	// Empty for no_change (no operation to follow); the on-chain path sets it on confirm.
	let correlationId = "correlationId" in result ? result.correlationId : "";

	if (validatedOptions.prepareOnly && validatedOptions.listed !== undefined) {
		logger.warn(
			"--listed is not applied with --prepare-only. Pass it again with --commit.",
		);
	}

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
		return true;
	}

	const outcome = await runTwoPhaseComposeUpdate({
		phase1: async () => result,
		phase2: async (composeHash, transactionHash) => {
			const confirmResult = await safeConfirmCvmPatch(client, {
				id: validatedOptions.uuid,
				composeHash,
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
			return confirmResult.data;
		},
		options: {
			prepareOnly: Boolean(validatedOptions.prepareOnly),
			privateKey: validatedOptions.privateKey,
			rpcUrl: validatedOptions.rpcUrl,
			json: validatedOptions.json,
			debug: validatedOptions.debug,
		},
		appId: cvm.app_id,
		followUpLines: (composeHashHex, commitToken) => [
			`  phala deploy --cvm-id ${validatedOptions.uuid} \\`,
			"    --commit \\",
			`    --token ${commitToken || "<token>"} \\`,
			`    --compose-hash ${composeHashHex} \\`,
			"    --transaction-hash <tx-hash>",
		],
		stdout,
	});
	if (!("correlationId" in outcome)) {
		// --prepare-only on an on-chain CVM: registered, not applied yet.
		return false;
	}
	correlationId = outcome.correlationId;

	await applyListedAfterUpdate(client, validatedOptions);

	// Wait for update to complete if --wait flag is set
	if (validatedOptions.wait) {
		logger.info("Waiting for update to complete...");
		try {
			const timeoutMs = 300000; // 5 minutes
			const startedAt = Date.now();
			// The operation's outcome comes first: a failed update can leave the
			// CVM in a state other than the pre-update one, and the state wait
			// would then only time out without naming the failure.
			if (correlationId) {
				await waitForCvmOperation(
					client,
					validatedOptions.uuid as string,
					correlationId,
					timeoutMs,
				);
			}
			// The backend keeps the power state of the live VM, and only a
			// running CVM is known to have a running VM. A stopped CVM, or one
			// in error after a failed boot, stays stopped through the update.
			await waitForCvmReady(
				validatedOptions.uuid as string,
				timeoutMs - (Date.now() - startedAt),
				context,
				cvm.status === "running" ? "running" : "stopped",
			);
		} catch (error: unknown) {
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
		stdout.write("CVM updated successfully!\n");
	}
	return true;
};

/**
 * Commit a previously prepared CVM update using a commit token.
 * Skips compose file reading and env processing — goes straight to the API.
 */
const commitCvmUpdate = async (
	validatedOptions: Options,
	client: CliApiClient,
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

	await applyListedAfterUpdate(client, validatedOptions);

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
): Promise<number> {
	try {
		validatePreLaunchScriptOptions(input);
		// Reject create-only flags before --commit handling, file reads or any
		// prompt, so an invalid update fails first.
		if (context.cvmId) {
			assertUpdatableOptions(input);
		} else {
			assertCreateOptions(input);
		}

		// Handle --commit mode: skip compose file reading entirely
		// commit-update endpoint is token-based (no API key required),
		// but we still need a client with the correct base URL.
		if (input.commit) {
			// Token-based commit still needs the correct base URL / API version.
			const client = await getClient(context, { apiToken: input.apiToken });

			const uuid = context.cvmId
				? CvmIdSchema.parse(context.cvmId).cvmId
				: undefined;

			await commitCvmUpdate({ ...input, uuid }, client, context.stdout);
			return 0;
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

		const composeSource = input.appCompose
			? await readAppComposeFile(input.appCompose)
			: await readDockerComposeFile({
					dockerComposePath: dockerComposePath,
					interactive: input.interactive,
				});

		// Resolve the CVM id here, once, for the dev OS record and everything
		// below. An update also needs the server's view of the CVM: the canonical
		// vm_uuid the record is keyed by, and the compose it currently runs.
		const uuid = context.cvmId
			? CvmIdSchema.parse(context.cvmId).cvmId
			: undefined;
		const updateTarget = uuid
			? await fetchUpdateTarget(client, uuid)
			: undefined;

		// The dev OS mode decides the payload: below dstack 0.6 it picks the dev
		// image, on 0.6 and newer it adds the dev box service to the compose.
		const devOs = await resolveDevOsTarget(client, input, updateTarget);
		const devOsPlan = devOs.plan;
		const devOsMode = devOsPlan?.mode;

		// Below dstack 0.6 the plan also picks the image: the backend ignores
		// prefer_dev when the request names one, so a production image of a
		// release that has a dev variant deploys a CVM without sshd.
		const devOsImage =
			devOsPlan?.image !== undefined && devOsPlan.image !== input.image
				? devOsPlan.image
				: undefined;
		const deployInput: Options = devOsImage
			? { ...input, image: devOsImage }
			: input;
		if (devOsImage) {
			logger.info(
				`--dev-os selected the dev OS image ${devOsImage} for this dstack release.`,
			);
		}

		let docker_compose_yml = composeSource;
		// The SSH server ships as an extra service in the compose instead of a dev
		// OS image. Inject it before the payload size check so the limit covers
		// what is actually sent.
		if (devOsMode === "dev-box") {
			if (input.appCompose) {
				// --app-compose is an opaque whole-document payload the API parses.
				logger.warn(
					"--dev-os cannot add the dev-box service to an --app-compose payload. Add it to that file's docker_compose_file yourself.",
				);
			} else {
				const prepared = composeForDevOs(composeSource, devOsMode);
				docker_compose_yml = prepared.compose;
				logger.info(
					prepared.added
						? "Added the dev-box SSH service to the compose file (dstack 0.6+ has no dev image)."
						: "The compose already carries the dev-box SSH service.",
				);
			}
		}

		// The key channel follows the final payload, not the flag: a dev box the
		// user wrote by hand (whatever its image, volume names or env) joins the
		// same channel as an injected one, and a key frozen into the env there
		// would outlive a revocation. `--app-compose` JSON is unwrapped first.
		const sshKeyChannel = resolveSshKeyChannel(devOsMode, docker_compose_yml);

		// What a create records once the CVM exists. The dev box lives only in
		// the payload, so repeating the choice is the only way a later update
		// keeps SSH access; a payload the backend does not read as a dev box (an
		// opaque --app-compose without one) is not recorded.
		const createDevOsState: DevOsStateChange | undefined =
			devOsMode === "dev-image"
				? { kind: "remember", mode: devOsMode }
				: devOsMode === "dev-box" && composeHasDevBoxMarkers(docker_compose_yml)
					? { kind: "remember", mode: devOsMode }
					: undefined;

		// Read pre-launch script file if provided
		let preLaunchScriptContent: string | undefined;
		if (input.preLaunchScript) {
			preLaunchScriptContent = readScriptFile(
				input.preLaunchScript,
				`Pre-launch script file not found: ${input.preLaunchScript}`,
			);
		}
		const initScriptContents = readInitScriptFiles(
			partitionInitScriptValues(input.initScript).files,
		);

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
			...deployInput,
			// If no env specified and phala.toml has env_file, use it
			env:
				deployInput.env && deployInput.env.length > 0
					? deployInput.env
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

		if (input.debug) {
			console.log("[DEBUG] resolved uuid:", uuid);
			console.log("[DEBUG] isUpdate:", !!uuid);
		}

		if (updateTarget) {
			// Update the existing CVM
			const applied = await updateCvm(
				{
					...deployInput,
					uuid: updateTarget.id,
				},
				docker_compose_yml,
				envs,
				client,
				context.stdout,
				context,
				preLaunchScriptContent,
				updateTarget,
			);
			// Only an applied update changes what a later update should do.
			if (applied) {
				commitDevOsState(updateTarget.vmUuid, devOs.stateChange);
			}
		} else {
			// Deploy a new CVM
			const created = await deployNewCvm(
				deployInput,
				docker_compose_yml,
				envs ?? [],
				client,
				context.stdout,
				context.stderr,
				context.projectConfig,
				preLaunchScriptContent,
				initScriptContents,
				devOsMode,
				sshKeyChannel,
				context,
			);
			commitDevOsState(created.vmUuid, createDevOsState);
		}
		return 0;
	} catch (error) {
		const isUpdate = Boolean(context.cvmId);
		context.failWithError(error, {
			operation: isUpdate ? "CVM update" : "CVM deployment",
			debug: input.debug,
			guidance: isUpdate
				? "Check the CVM status before retrying. Include the Request ID when contacting support."
				: "Include the Request ID when contacting support.",
		});
		return 1;
	}
}
