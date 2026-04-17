import { z } from "zod";
import type { CommandMeta } from "@/src/core/types";

export const instancesRmCommandMeta: CommandMeta = {
	name: "rm",
	description: "Delete one or more app instances by VM UUID",
	stability: "unstable",
	arguments: [
		{
			name: "vm_uuid...",
			description: "VM UUID(s) of the instances to delete",
			required: true,
			variadic: true,
			target: "vmUuids",
		},
	],
	options: [
		{
			name: "force",
			shorthand: "f",
			description: "Skip confirmation prompt",
			type: "boolean",
			target: "force",
		},
		{
			name: "yes",
			shorthand: "y",
			description: "Alias for --force (skip confirmation prompt)",
			type: "boolean",
			target: "yes",
		},
	],
	examples: [
		{
			name: "Delete a single instance",
			value: "phala instances rm 550e8400-e29b-41d4-a716-446655440000",
		},
		{
			name: "Delete multiple instances",
			value:
				"phala instances rm 550e8400-e29b-41d4-a716-446655440000 661f9511-f30c-52e5-b827-557766551111",
		},
		{
			name: "Delete without confirmation",
			value: "phala instances rm 550e8400-e29b-41d4-a716-446655440000 --force",
		},
	],
};

export const instancesRmCommandSchema = z.object({
	vmUuids: z.array(z.string()).min(1),
	force: z.boolean().default(false),
	yes: z.boolean().default(false),
});

export type InstancesRmCommandInput = z.infer<typeof instancesRmCommandSchema>;
