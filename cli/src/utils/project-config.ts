import path from "node:path";
import fs from "fs-extra";
import toml from "@iarna/toml";
import { z } from "zod";
import {
	CvmIdObjectSchema,
	CvmIdSchema,
	SUPPORTED_API_VERSIONS,
	refineCvmId,
} from "@phala/cloud";
import { logger } from "./logger";

// Project configuration schema - for validating phala.toml file content
// Extends CvmIdObjectSchema and applies refineCvmId validation
export const ProjectConfigSchema: z.ZodTypeAny = refineCvmId(
	CvmIdObjectSchema.extend({
		api_version: z.enum(SUPPORTED_API_VERSIONS),
	}),
);

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

// Runtime project config - includes extracted cvm_id field
export type RuntimeProjectConfig = Partial<ProjectConfig> & {
	cvm_id?: string;
};

const CONFIG_FILE_NAME = "phala.toml";

/**
 * Get the path to phala.toml in the current working directory
 */
function getProjectConfigPath(): string {
	return path.join(process.cwd(), CONFIG_FILE_NAME);
}

/**
 * Check if phala.toml exists in the current directory
 */
export function projectConfigExists(): boolean {
	return fs.existsSync(getProjectConfigPath());
}

/**
 * Load project configuration from phala.toml
 * Extracts and normalizes cvm_id during loading
 * @throws Error if file doesn't exist or validation fails
 */
export function loadProjectConfig(): RuntimeProjectConfig {
	const configPath = getProjectConfigPath();

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
			validated.instance_id
		) {
			const { cvmId } = (
				CvmIdSchema as unknown as z.ZodType<{ cvmId: string }>
			).parse(validated);
			return { ...validated, cvm_id: cvmId };
		}

		return validated;
	} catch (error) {
		if (error instanceof z.ZodError) {
			const issues = error.issues
				.map((i) => `  - ${i.path.join(".")}: ${i.message}`)
				.join("\n");
			throw new Error(`Invalid project configuration:\n${issues}`);
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
		// Validate before saving
		const validated = ProjectConfigSchema.parse(config);

		// Convert to TOML format
		const tomlContent = toml.stringify(validated as toml.JsonMap);

		// Write to file
		fs.writeFileSync(configPath, tomlContent, "utf8");
		logger.success(`Project configuration saved to ${CONFIG_FILE_NAME}`);
	} catch (error) {
		if (error instanceof z.ZodError) {
			const issues = error.issues
				.map((i) => `  - ${i.path.join(".")}: ${i.message}`)
				.join("\n");
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
export function getProjectConfig(): RuntimeProjectConfig {
	if (!projectConfigExists()) {
		return {};
	}
	return loadProjectConfig();
}

/**
 * Parse and validate CVM ID from command input
 * Uses CvmIdSchema to validate and extract the single cvmId
 * Returns undefined if input is undefined
 *
 * @param input - CVM ID from command argument/option
 * @returns Validated CVM ID string or undefined
 * @throws ZodError if input is invalid
 *
 * @example
 * ```typescript
 * const cvm_id = parse_cvm_id(input.cvm_id) ?? projectConfig.cvm_id;
 * ```
 */
export function parse_cvm_id(input: string | undefined): string | undefined {
	if (!input) {
		return undefined;
	}

	const { cvmId } = (
		CvmIdSchema as unknown as z.ZodType<{ cvmId: string }>
	).parse({
		id: input,
	});
	return cvmId;
}
