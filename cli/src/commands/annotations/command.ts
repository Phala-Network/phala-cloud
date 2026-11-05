import { z } from "zod";
import type { CommandMeta } from "@/src/core/types";

export const annotationsCommandMeta: CommandMeta = {
	name: "annotations",
	category: "manage",
	description:
		"Show or set CVM annotations: unmeasured key/value metadata for host-side tools",
	stability: "stable",
	arguments: [
		{
			name: "args",
			description:
				"[cvm-id] [KEY=VALUE ...]. The CVM id is optional and falls back to phala.toml; an argument containing '=' is a pair.",
			required: false,
			variadic: true,
			target: "args",
		},
	],
	options: [
		{
			name: "unset",
			description: "Remove an annotation key (repeatable)",
			type: "string[]",
			target: "unset",
		},
		{
			name: "clear",
			description: "Remove every annotation",
			type: "boolean",
			target: "clear",
		},
		{
			name: "replace",
			description: "Make the given pairs the whole set instead of merging them",
			type: "boolean",
			target: "replace",
		},
	],
	examples: [
		{ name: "Show annotations", value: "phala annotations app_abc123" },
		{
			name: "Set annotations (CVM from phala.toml)",
			value: "phala annotations memory_tier=fast pin_numa=0",
		},
		{
			name: "Remove a key",
			value: "phala annotations app_abc123 --unset memory_tier",
		},
		{
			name: "Replace the whole set",
			value: "phala annotations app_abc123 memory_tier=fast --replace",
		},
		{
			name: "Remove every annotation",
			value: "phala annotations app_abc123 --clear",
		},
	],
};

export const annotationsCommandSchema = z.object({
	args: z.array(z.string()).default([]),
	unset: z.array(z.string()).optional(),
	clear: z.boolean().default(false),
	replace: z.boolean().default(false),
});

export type AnnotationsCommandInput = z.infer<typeof annotationsCommandSchema>;
