import { z } from "zod";
import type { CommandMeta } from "@/src/core/types";

export const loginCommandMeta: CommandMeta = {
	name: "login",
	description: "Removed. Use 'phala login' instead.",
	stability: "deprecated",
	arguments: [
		{
			name: "api-key",
			description: "API key (triggers device flow if omitted)",
			required: false,
			target: "apiKey",
		},
	],
	options: [
		{
			name: "manual",
			description: "Enter API key manually",
			type: "boolean",
		},
		{
			name: "no-open",
			description: "Skip browser launch",
			type: "boolean",
		},
	],
};

export const loginCommandSchema = z.object({
	apiKey: z.string().min(1, "API key cannot be empty").optional(),
	manual: z.boolean().optional(),
	noOpen: z.boolean().optional(),
});

export type LoginCommandInput = z.infer<typeof loginCommandSchema>;
