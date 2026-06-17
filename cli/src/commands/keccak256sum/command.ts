import { z } from "zod";
import type { CommandMeta } from "@/src/core/types";

export const keccak256sumCommandMeta: CommandMeta = {
	name: "keccak256sum",
	category: "advanced",
	description: "Compute or verify keccak256 checksums of hex inputs",
	stability: "stable",
	arguments: [
		{
			name: "hex-values",
			description: "Hex strings to hash, or checksum file path when using -c",
			required: false,
			variadic: true,
		},
	],
	options: [
		{
			name: "check",
			shorthand: "c",
			description: "Read checksums from file and verify them",
			type: "boolean",
			target: "check",
		},
		{
			name: "quiet",
			description: "In check mode, suppress OK messages",
			type: "boolean",
			target: "quiet",
		},
		{
			name: "status",
			description:
				"In check mode, suppress all output; exit code indicates result",
			type: "boolean",
			target: "status",
		},
	],
	examples: [
		{
			name: "Hash concatenated hex values",
			value:
				"phala keccak256sum 4f475ed2...e099 8d8f406c...6aef 0x02 3059...9d9f",
		},
		{
			name: "Hash hex from stdin",
			value: "echo 'deadbeef' | phala keccak256sum",
		},
		{
			name: "Verify checksums from file",
			value: "phala keccak256sum -c checksums.txt",
		},
	],
};

export const keccak256sumCommandSchema = z.object({
	hexValues: z.array(z.string()),
	check: z.boolean().default(false),
	quiet: z.boolean().default(false),
	status: z.boolean().default(false),
});

export type Keccak256sumCommandInput = z.infer<
	typeof keccak256sumCommandSchema
>;
