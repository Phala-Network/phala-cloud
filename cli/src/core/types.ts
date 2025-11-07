import type { z, ZodTypeAny } from "zod";

export type CommandPath = readonly string[];

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

export interface CommandMeta {
	readonly name: string;
	readonly description: string;
	readonly aliases?: readonly string[];
	readonly arguments?: readonly CommandArgument[];
	readonly options?: readonly CommandOption[];
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
