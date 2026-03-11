import { z } from "zod";
import type { CommandMeta } from "@/src/core/types";
import { cvmIdArgument, interactiveOption } from "@/src/core/common-flags";
import { jsonOption } from "@/src/commands/status/command";

export const cvmsDeviceAllowlistCommandMeta: CommandMeta = {
	name: "device-allowlist",
	description: "Show device allowlist status for a CVM's app",
	stability: "unstable",
	arguments: [cvmIdArgument],
	options: [jsonOption, interactiveOption],
	examples: [
		{
			name: "Check device allowlist",
			value: "phala cvms device-allowlist app_abc123",
		},
	],
};

export const cvmsDeviceAllowlistCommandSchema = z.object({
	cvmId: z.string().optional(),
	json: z.boolean().default(false),
	interactive: z.boolean().default(false),
});

export type CvmsDeviceAllowlistCommandInput = z.infer<
	typeof cvmsDeviceAllowlistCommandSchema
>;
