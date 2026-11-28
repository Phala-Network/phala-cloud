import path from "node:path";
import fs from "fs-extra";
import toml from "@iarna/toml";
import { z } from "zod";
import {
	CvmIdObjectSchema,
	CvmIdSchema,
	SUPPORTED_API_VERSIONS,
} from "@phala/cloud";
import {
	gatewayPortPolicySchema,
	PORT_POLICY_TOML_EXAMPLE,
} from "@/src/lib/port-policy";
import { logger } from "./logger";
import { formatZodIssues } from "./validation";

// Project configuration schema - for validating phala.toml file content
// Extends CvmIdObjectSchema but does NOT require CVM ID fields (allows gateway-only config)
export const ProjectConfigSchema = CvmIdObjectSchema.extend({
	profile: z.string().optional(),
	api_version: z.enum(SUPPORTED_API_VERSIONS).optional(),
	gateway_domain: z.string().optional(),
	gateway_port: z.number().int().positive().optional(),
	// Deploy configuration
	compose_file: z.string().optional(),
	env_file: z.string().optional(),
	port_policy: gatewayPortPolicySchema.optional(),
	// Privacy settings
	public_logs: z.boolean().optional(),
	public_sysinfo: z.boolean().optional(),
	public_tcbinfo: z.boolean().optional(),
	secure_time: z.boolean().optional(),
	listed: z.boolean().optional(),
});

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

// Runtime project config - includes extracted cvm_id field
export type RuntimeProjectConfig = Partial<ProjectConfig> & {
	cvm_id?: string;
	gateway_domain?: string;
	gateway_port?: number;
	compose_file?: string;
	env_file?: string;
	// Privacy settings
	public_logs?: boolean;
	public_sysinfo?: boolean;
	public_tcbinfo?: boolean;
	secure_time?: boolean;
	listed?: boolean;
};

const CONFIG_FILE_NAME = "phala.toml";

/**
 * Get the path to phala.toml in the current working directory
 */
function getProjectConfigPath(cwd = process.cwd()): string {
	return path.join(cwd, CONFIG_FILE_NAME);
}

/**
 * Check if phala.toml exists in the current directory
 */
export function projectConfigExists(cwd?: string): boolean {
	return fs.existsSync(getProjectConfigPath(cwd));
}

/**
 * Load project configuration from phala.toml
 * Extracts and normalizes cvm_id during loading
 * @throws Error if file doesn't exist or validation fails
 */
export function loadProjectConfig(cwd?: string): RuntimeProjectConfig {
	const configPath = getProjectConfigPath(cwd);

	if (!fs.existsSync(configPath)) {
		throw new Error(
			`Project configuration file not found: ${CONFIG_FILE_NAME}\nRun 'phala init' to create one.`,
		);
	}

	try {
		const fileContent = fs.readFileSync(configPath, "utf8");
		const parsed = toml.parse(fileContent);
		const validated = ProjectConfigSchema.parse(parsed);

		// If any CVM ID field exists, extract and normalize it using CvmIdSchema
		if (
			validated.id ||
			validated.uuid ||
			validated.app_id ||
			validated.instance_id ||
			validated.name
		) {
			const { cvmId } = (
				CvmIdSchema as unknown as z.ZodType<{ cvmId: string }>
			).parse(validated);
			return { ...validated, cvm_id: cvmId };
		}

		return validated;
	} catch (error) {
		if (error instanceof z.ZodError) {
			const issues = formatZodIssues(error);
			const example = error.issues.some(
				(issue) => issue.path[0] === "port_policy",
			)
				? `\nExample:\n${PORT_POLICY_TOML_EXAMPLE}`
				: "";
			throw new Error(`Invalid ${CONFIG_FILE_NAME}:\n${issues}${example}`);
		}
		throw new Error(
			`Failed to parse ${CONFIG_FILE_NAME}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Save project configuration to phala.toml
 */
export function saveProjectConfig(config: ProjectConfig): void {
	const configPath = getProjectConfigPath();

	try {
		// Relinking changes the target, not the policy. Validate the table but
		// keep its entry order and any omitted pp values when writing it back.
		const existingPolicy = fs.existsSync(configPath)
			? toml.parse(fs.readFileSync(configPath, "utf8")).port_policy
			: undefined;
		const validated = ProjectConfigSchema.parse(
			existingPolicy === undefined
				? config
				: { ...config, port_policy: existingPolicy },
		);
		const saved =
			existingPolicy === undefined
				? validated
				: { ...validated, port_policy: existingPolicy };
		const tomlContent = toml.stringify(saved as toml.JsonMap);

		// Write to file
		fs.writeFileSync(configPath, tomlContent, "utf8");
		logger.success(`Project configuration saved to ${CONFIG_FILE_NAME}`);
	} catch (error) {
		if (error instanceof z.ZodError) {
			const issues = formatZodIssues(error);
			throw new Error(`Invalid configuration:\n${issues}`);
		}
		throw new Error(
			`Failed to save ${CONFIG_FILE_NAME}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Get project configuration from phala.toml
 * Returns empty config object if file doesn't exist
 * This is safe to call without checking if file exists first
 */
export function getProjectConfig(cwd?: string): RuntimeProjectConfig {
	if (!projectConfigExists(cwd)) {
		return {};
	}
	return loadProjectConfig(cwd);
}

/**
 * Parse and validate CVM ID from command input
 * Uses SDK's CvmIdSchema with smart auto-detection:
 * - UUID (with or without dashes) → removes dashes
 * - 40-char hex string → adds 'app_' prefix
 * - Other formats → uses as-is (app_xxx, instance_xxx, cvm-xxx)
 *
 * @param input - CVM ID from command argument/option
 * @returns Validated and normalized CVM ID string or undefined
 * @throws ZodError if input is invalid
 *
 * @example
 * ```typescript
 * const cvm_id = parse_cvm_id(input.cvm_id) ?? projectConfig.cvm_id;
 * // Input: "50b0e827cc6c53f4010b57e588a18c5ef9388cc1" → Output: "app_50b0e827cc6c53f4010b57e588a18c5ef9388cc1"
 * // Input: "91b62ea0-6c64-4985-aa6c-fc3c88a02e64" → Output: "91b62ea06c6449855aa6cfc3c88a02e64"
 * ```
 */
export function parse_cvm_id(input: string | undefined): string | undefined {
	if (!input) {
		return undefined;
	}

	// CvmIdSchema automatically detects the format when using 'id' field
	const { cvmId } = (
		CvmIdSchema as unknown as z.ZodType<{ cvmId: string }>
	).parse({ id: input });
	return cvmId;
}
