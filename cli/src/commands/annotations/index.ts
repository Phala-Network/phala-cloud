import { safeGetCvmAnnotations, safeUpdateCvmAnnotations } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import { isInJsonMode } from "@/src/core/json-mode";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import { logger } from "@/src/utils/logger";
import {
	annotationsCommandMeta,
	annotationsCommandSchema,
	type AnnotationsCommandInput,
} from "./command";

/** Split positionals into an optional leading CVM id and KEY=VALUE pairs. */
function parseArgs(args: readonly string[]): {
	cvmId?: string;
	pairs: Array<[string, string]>;
} {
	const [first, ...rest] = args;
	const hasCvmId = first !== undefined && !first.includes("=");
	const pairArgs = hasCvmId ? rest : args;
	const pairs = pairArgs.map((arg): [string, string] => {
		const index = arg.indexOf("=");
		if (index < 0) {
			throw new Error(
				`Expected KEY=VALUE, got '${arg}'. Only the first argument can be a CVM id.`,
			);
		}
		return [arg.slice(0, index), arg.slice(index + 1)];
	});
	return { cvmId: hasCvmId ? first : undefined, pairs };
}

function printAnnotations(
	context: CommandContext,
	annotations: Record<string, string>,
): void {
	if (isInJsonMode()) {
		context.success({ annotations });
		return;
	}
	const entries = Object.entries(annotations);
	if (entries.length === 0) {
		logger.info("No annotations");
		return;
	}
	for (const [key, value] of entries) {
		context.stdout.write(`${key}=${value}\n`);
	}
}

async function runAnnotationsCommand(
	input: AnnotationsCommandInput,
	context: CommandContext,
): Promise<number> {
	try {
		const { cvmId, pairs } = parseArgs(input.args);
		const cvm = cvmId ? { id: cvmId } : context.cvmId;
		if (!cvm) {
			context.fail(
				"No CVM ID provided. Pass a CVM identifier or set it in phala.toml.",
			);
			return 1;
		}
		const unset = input.unset ?? [];
		if (input.clear && (pairs.length > 0 || unset.length > 0)) {
			context.fail(
				"--clear cannot be combined with KEY=VALUE pairs or --unset.",
			);
			return 1;
		}
		if (input.replace && (pairs.length === 0 || unset.length > 0)) {
			context.fail(
				"--replace needs KEY=VALUE pairs and cannot be combined with --unset.",
			);
			return 1;
		}

		const client = await getClient(context);
		const isUpdate = input.clear || pairs.length > 0 || unset.length > 0;

		let current: Record<string, string> = {};
		if (!input.clear && !input.replace) {
			const result = await safeGetCvmAnnotations(client, cvm);
			if (!result.success) throw result.error;
			current = result.data.annotations;
			if (!isUpdate) {
				printAnnotations(context, current);
				return 0;
			}
		}

		const annotations: Record<string, string> = {
			...current,
			...Object.fromEntries(pairs),
		};
		for (const key of unset) {
			delete annotations[key];
		}
		const result = await safeUpdateCvmAnnotations(client, {
			...cvm,
			annotations,
		});
		if (!result.success) throw result.error;
		printAnnotations(context, result.data.annotations);
		return 0;
	} catch (error) {
		context.failWithError(error, { operation: "CVM annotations" });
		return 1;
	}
}

export const annotationsCommand = defineCommand({
	path: ["annotations"],
	meta: annotationsCommandMeta,
	schema: annotationsCommandSchema,
	handler: runAnnotationsCommand,
});

export default annotationsCommand;
