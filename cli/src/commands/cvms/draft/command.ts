import {
	cvmIdArgument,
	privateKeyOption,
	rpcUrlOption,
	transactionHashOption,
} from "@/src/core/common-flags";
import type { CommandGroup, CommandMeta } from "@/src/core/types";
import { z } from "zod";

export const draftGroup: CommandGroup = {
	path: ["cvms", "draft"],
	meta: {
		name: "draft",
		description: "Stage and apply CVM changes together",
		stability: "stable",
	},
};

export const draftListMeta: CommandMeta = {
	name: "list",
	description: "List CVMs with staged changes in this workspace",
	stability: "stable",
};

const draftCvmArgument = { ...cvmIdArgument, required: true };
export const emptySchema = z.object({});
export const draftCvmSchema = z.object({ cvmId: z.string().min(1) });

export const draftShowMeta: CommandMeta = {
	name: "show",
	description: "Show the diff for each staged change, oldest first",
	stability: "stable",
	arguments: [draftCvmArgument],
};

export const draftStageMeta: CommandMeta = {
	name: "stage",
	description: "Stage a change without updating the running CVM",
	stability: "stable",
	arguments: [draftCvmArgument],
	options: [
		{
			name: "compose",
			shorthand: "c",
			description: "Path to a Docker Compose file",
			type: "string",
		},
		{
			name: "patch-file",
			description: "Path to a JSON file containing CVM update fields",
			type: "string",
		},
	],
	examples: [
		{
			name: "Stage a Compose change",
			value: "phala cvms draft stage my-cvm --compose docker-compose.yml",
		},
		{
			name: "Stage a CVM update",
			value: "phala cvms draft stage my-cvm --patch-file update.json",
		},
	],
};
export const draftStageSchema = draftCvmSchema
	.extend({
		compose: z.string().min(1).optional(),
		patchFile: z.string().min(1).optional(),
	})
	.refine(({ compose, patchFile }) => Boolean(compose) !== Boolean(patchFile), {
		message: "Use exactly one of --compose and --patch-file.",
	});

export const draftUndoMeta: CommandMeta = {
	name: "undo",
	description:
		"Undo the newest staged change without changing on-chain registrations",
	stability: "stable",
	arguments: [
		draftCvmArgument,
		{
			name: "entry_id",
			target: "entryId",
			description: "Require the newest entry to have this ID",
		},
	],
};
export const draftUndoSchema = draftCvmSchema.extend({
	entryId: z.string().min(1).optional(),
});

export const draftDiscardMeta: CommandMeta = {
	name: "discard",
	description:
		"Discard all staged changes without changing on-chain registrations",
	stability: "stable",
	arguments: [draftCvmArgument],
};

export const draftApplyMeta: CommandMeta = {
	name: "apply",
	description:
		"Apply all staged changes as one update. This can register a compose hash on-chain.",
	stability: "stable",
	arguments: [draftCvmArgument],
	options: [
		{
			name: "wait",
			description: "Wait until Phala Cloud finishes applying this update",
			type: "boolean",
		},
		privateKeyOption,
		rpcUrlOption,
		{
			name: "compose-hash",
			description:
				"Hash from a prior on-chain registration for this draft (use with --transaction-hash)",
			type: "string",
			group: "advanced",
		},
		transactionHashOption,
	],
	examples: [
		{
			name: "Apply and wait for the update",
			value: "phala cvms draft apply my-cvm --wait",
		},
	],
};
export const draftApplySchema = draftCvmSchema
	.extend({
		wait: z.boolean().default(false),
		privateKey: z.string().optional(),
		rpcUrl: z.string().optional(),
		composeHash: z
			.string()
			.regex(/^(?:0x)?[0-9a-f]{64}$/i, "Expected a 32-byte compose hash.")
			.optional(),
		transactionHash: z
			.string()
			.regex(
				/^(?:0x[0-9a-fA-F]{64}|already-registered)$/,
				"Expected a transaction hash or already-registered.",
			)
			.optional(),
	})
	.refine(
		({ composeHash, transactionHash }) =>
			Boolean(composeHash) === Boolean(transactionHash),
		{
			message: "Use --compose-hash and --transaction-hash together.",
		},
	);
