import { z } from "zod";
import type { CommandMeta } from "@/src/core/types";

export const jsonOption = {
	name: "json",
	shorthand: "j",
	description: "Output in JSON format",
	type: "boolean" as const,
	target: "json",
	negatedName: "no-json",
};

export const yesOption = {
	name: "yes",
	shorthand: "y",
	description: "Skip confirmation prompt",
	type: "boolean" as const,
	target: "yes",
};

export const dryRunOption = {
	name: "dry-run",
	description: "Print the update command without executing it",
	type: "boolean" as const,
	target: "dryRun",
};

export const packageManagerOption = {
	name: "package-manager",
	description: "Override package manager (npm|pnpm|yarn|bun)",
	type: "string" as const,
	target: "packageManager",
	aliases: ["pm"],
	argumentName: "name",
};

export const channelOption = {
	name: "channel",
	description: "Release channel/dist-tag (e.g. latest, beta, next)",
	type: "string" as const,
	target: "channel",
	argumentName: "tag",
};

export const selfUpdateCommandMeta: CommandMeta = {
	name: "update",
	description: "Update the Phala CLI",
	stability: "stable",
	options: [
		jsonOption,
		yesOption,
		dryRunOption,
		packageManagerOption,
		channelOption,
	],
	examples: [
		{ name: "Update CLI", value: "phala self update" },
		{ name: "Dry run (print command)", value: "phala self update --dry-run" },
		{ name: "Use beta channel", value: "phala self update --channel beta" },
	],
};

export const selfUpdateCommandSchema = z.object({
	json: z.boolean().default(false),
	yes: z.boolean().default(false),
	dryRun: z.boolean().default(false),
	packageManager: z.enum(["npm", "pnpm", "yarn", "bun"]).optional(),
	channel: z
		.string()
		.regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
		.optional(),
});

export type SelfUpdateCommandInput = z.infer<typeof selfUpdateCommandSchema>;
