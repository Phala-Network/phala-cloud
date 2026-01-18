import type { z, ZodTypeAny } from "zod";
import type { CvmIdInput } from "@phala/cloud";
import type { RuntimeProjectConfig } from "@/src/utils/project-config";

export type CommandPath = readonly string[];

export type CommandStability = "stable" | "unstable" | "deprecated";

export interface CommandArgument {
	readonly name: string;
	readonly description?: string;
	readonly required?: boolean;
	readonly variadic?: boolean;
	readonly target?: string;
}

export type CommandOptionValueType =
	| "string"
	| "number"
	| "boolean"
	| "string[]"
	| "number[]";

export interface CommandOption {
	readonly name: string;
	readonly description?: string;
	readonly shorthand?: string;
	readonly argumentName?: string;
	readonly type: CommandOptionValueType;
	readonly deprecated?: boolean;
	readonly hidden?: boolean;
	/**
	 * Optional long aliases (e.g. `--token` for `--api-token`).
	 */
	readonly aliases?: readonly string[];
	/**
	 * When provided, `--<negatedName>` acts as a negated boolean for this option.
	 */
	readonly negatedName?: string;
	/**
	 * Optional property name override. Defaults to camelCase of `name`.
	 */
	readonly target?: string;
}

export interface CommandExample {
	readonly name: string;
	readonly value: string;
}

export interface CommandPassThrough {
	readonly description: string;
	readonly examples?: readonly string[];
}

export interface CommandMeta {
	readonly name: string;
	readonly description: string;
	readonly stability: CommandStability;
	readonly aliases?: readonly string[];
	readonly arguments?: readonly CommandArgument[];
	readonly options?: readonly CommandOption[];
	readonly passThrough?: CommandPassThrough;
	readonly examples?: readonly CommandExample[];
}

export interface CommandContext {
	readonly argv: readonly string[];
	readonly rawFlags: Record<string, unknown>;
	readonly rawPositionals: readonly string[];
	readonly cwd: string;
	readonly env: NodeJS.ProcessEnv;
	readonly stdout: NodeJS.WriteStream;
	readonly stderr: NodeJS.WriteStream;
	readonly stdin: NodeJS.ReadStream;
	readonly projectConfig: RuntimeProjectConfig;
	readonly cli?: {
		readonly executableName: string;
		readonly packageName: string;
		readonly packageVersion: string;
		readonly runtime: "node" | "bun";
	};

	/**
	 * Parsed CVM identifier (optional)
	 * Automatically parsed from input.cvmId using SDK's CvmIdSchema
	 * Populated when:
	 * - input.cvmId is provided: parsed as { id: cvmId }
	 * - input.cvmId is empty + input.interactive is true: prompts user to select CVM
	 * - Otherwise: undefined (command should fail with "No CVM ID provided")
	 */
	readonly cvmId?: CvmIdInput;

	/**
	 * Output success result. In JSON mode, outputs {success: true, ...data} to stdout.
	 * In human mode, outputs success message to stdout.
	 */
	success(data: unknown): void;

	/**
	 * Output failure result and exit. In JSON mode, outputs {success: false, error: ...} to stdout.
	 * In human mode, outputs error message to stderr.
	 */
	fail(message: string, details?: unknown): void;
}

export interface CommandDefinition<Schema extends ZodTypeAny = ZodTypeAny> {
	readonly path: CommandPath;
	readonly meta: CommandMeta;
	readonly schema: Schema;
	readonly run: CommandHandler<Schema>;
}

export type CommandHandler<Schema extends ZodTypeAny> = (
	input: Readonly<InferCommandInput<Schema>>,
	context: CommandContext,
) => Promise<number | undefined> | number | undefined;

export type InferCommandInput<Schema extends ZodTypeAny> = z.infer<Schema>;

export interface CommandGroup {
	readonly path: CommandPath;
	readonly meta: Omit<CommandMeta, "options"> & {
		readonly options?: readonly CommandOption[];
	};
}

export type RegistryEntry = CommandDefinition | CommandGroup;
