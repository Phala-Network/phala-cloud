import type { CommandOption } from "./types";

export const helpOption: CommandOption = {
	name: "help",
	shorthand: "h",
	description: "Show help information for the current command",
	type: "boolean",
	target: "help",
};

export const versionOption: CommandOption = {
	name: "version",
	shorthand: "v",
	description: "Show CLI version",
	type: "boolean",
	target: "version",
};

export const interactiveOption: CommandOption = {
	name: "interactive",
	shorthand: "i",
	description: "Enable interactive mode",
	type: "boolean",
	target: "interactive",
	group: "basic",
};

export const globalInteractiveOption: CommandOption = {
	name: "interactive",
	description: "Enable interactive mode for commands that support it",
	type: "boolean",
	target: "interactive",
	group: "basic",
};

export const apiTokenOption: CommandOption = {
	name: "api-token",
	description: "API token for authenticating with Phala Cloud",
	type: "string",
	target: "apiToken",
	aliases: ["api-key"],
	argumentName: "token",
	group: "basic",
};

export const jsonOption: CommandOption = {
	name: "json",
	shorthand: "j",
	description: "Output in JSON format",
	type: "boolean",
	target: "json",
	negatedName: "no-json",
	group: "basic",
};

export const profileOption: CommandOption = {
	name: "profile",
	description: "Temporarily use a different auth profile for this command",
	type: "string",
	target: "profile",
	argumentName: "profile",
	group: "basic",
};

export const apiVersionOption: CommandOption = {
	name: "api-version",
	description: "API version to use (e.g. 2025-10-28, 2026-01-21, 2026-05-22)",
	type: "string",
	target: "apiVersion",
	group: "advanced",
};

export const commonAuthOptions: readonly CommandOption[] = [apiTokenOption];

/**
 * CVM ID argument (positional)
 * Supports all identifier formats: UUID, app_id, instance_id, name
 */
export const cvmIdArgument = {
	name: "cvm_id",
	description: "CVM identifier (UUID, app_id, instance_id, or name)",
	required: false,
	target: "cvmId",
};

/**
 * CVM ID option (--cvm-id)
 * Primary option for CVM identifier
 */
export const cvmIdOption: CommandOption = {
	name: "cvm-id",
	description: "CVM identifier (UUID, app_id, instance_id, or name)",
	type: "string",
	target: "cvmId",
};

/**
 * UUID option (--uuid) - DEPRECATED
 * Kept for backward compatibility, maps to cvmId
 */
export const uuidOption: CommandOption = {
	name: "uuid",
	description: "[DEPRECATED] Use --cvm-id instead. CVM UUID.",
	type: "string",
	target: "cvmId",
	deprecated: true,
	group: "deprecated",
};

/**
 * Private key option (--private-key)
 * Used by on-chain KMS commands for signing transactions.
 * Falls back to PRIVATE_KEY env var.
 */
export const privateKeyOption: CommandOption = {
	name: "private-key",
	description:
		"Private key for signing on-chain transactions (or set PRIVATE_KEY env var)",
	type: "string",
	target: "privateKey",
	group: "advanced",
};

/**
 * RPC URL option (--rpc-url)
 * Used by on-chain KMS commands to override the default RPC endpoint.
 * Falls back to ETH_RPC_URL env var (foundry/cast convention).
 */
export const rpcUrlOption: CommandOption = {
	name: "rpc-url",
	description:
		"RPC URL for on-chain KMS transactions (or set ETH_RPC_URL env var)",
	type: "string",
	target: "rpcUrl",
	group: "advanced",
};

/**
 * Transaction hash option (--transaction-hash)
 * Used by deploy and cvms replicate to prove on-chain compose hash registration.
 * Accepts the literal sentinel `already-registered` to skip the proof and
 * fall back to state-only verification.
 */
export const transactionHashOption: CommandOption = {
	name: "transaction-hash",
	description:
		"Transaction hash proving on-chain compose hash registration. Pass `already-registered` to skip the proof and rely on state-only verification.",
	type: "string",
	target: "transactionHash",
	group: "advanced",
};

export const globalCommandOptions: readonly CommandOption[] = [
	helpOption,
	versionOption,
	apiTokenOption,
	jsonOption,
	globalInteractiveOption,
	cvmIdOption,
	profileOption,
	apiVersionOption,
];
