import { z } from "zod";
import type { CommandMeta } from "@/src/core/types";

export const keccak256CommandMeta: CommandMeta = {
	name: "keccak256",
	category: "advanced",
	description: "Compute keccak256 hash of concatenated hex inputs",
	stability: "stable",
	arguments: [
		{
			name: "hex-values",
			description:
				"Hex strings to concatenate and hash (with or without 0x prefix)",
			required: true,
			variadic: true,
		},
	],
	examples: [
		{
			name: "Hash concatenated hex values",
			value: "phala keccak256 4f475ed2...e099 8d8f406c...6aef 0x02 3059...9d9f",
		},
	],
};

export const keccak256CommandSchema = z.object({
	hexValues: z.array(z.string()),
});

export type Keccak256CommandInput = z.infer<typeof keccak256CommandSchema>;
