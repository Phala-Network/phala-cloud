import { jsonOption } from "@/src/commands/status/command";
import { cvmIdArgument, interactiveOption } from "@/src/core/common-flags";
import { defineCommand } from "@/src/core/define-command";
import { getClient } from "@/src/lib/client";
import { logger } from "@/src/utils/logger";
import { CvmIdSchema, getCvmGpuStatus } from "@phala/cloud";
import { z } from "zod";

export const cvmsGpuStatusCommand = defineCommand({
	path: ["cvms", "gpu-status"],
	meta: {
		name: "gpu-status",
		description: "Get observed CVM GPU status",
		stability: "unstable",
		arguments: [cvmIdArgument],
		options: [jsonOption, interactiveOption],
		examples: [
			{ name: "Get GPU status", value: "phala cvms gpu-status my-app" },
		],
	},
	schema: z.object({
		cvmId: z.string().optional(),
		interactive: z.boolean().default(false),
		json: z.boolean().default(false),
	}),
	handler: async (input, context) => {
		if (!context.cvmId) {
			context.fail(
				"No CVM ID provided. Use --interactive to select interactively.",
			);
			return 1;
		}
		try {
			const client = await getClient(context);
			const status = await getCvmGpuStatus(
				client,
				CvmIdSchema.parse(context.cvmId),
			);
			if (input.json) {
				context.success(status);
			} else if (status.observed === null) {
				logger.info("GPU status unavailable");
			} else if (status.observed.length === 0) {
				logger.info("No GPUs observed");
			} else {
				logger.table(
					status.observed.map((gpu) => ({
						slot: gpu.slot,
						cc_mode: gpu.cc_mode,
					})),
					[
						{ key: "slot", header: "Slot" },
						{ key: "cc_mode", header: "CC Mode" },
					],
				);
			}
			return 0;
		} catch (error) {
			context.failWithError(error, { operation: "Get GPU status" });
			return 1;
		}
	},
});
