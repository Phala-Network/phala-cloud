import {
	safeConfirmCvmPatch,
	safeGetCvmInitScripts,
	safePatchCvm,
	type CvmInitScripts,
	type PatchCvmResult,
} from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import {
	DATA_WIPE_CONFIRM_GUIDANCE,
	isDataWipeConfirmError,
} from "@/src/lib/init-scripts";
import { runTwoPhaseComposeUpdate } from "@/src/lib/on-chain-update";
import { printTable } from "@/src/lib/table";
import { logger } from "@/src/utils/logger";
import {
	cvmsInitScriptsCommandMeta,
	cvmsInitScriptsCommandSchema,
	type CvmsInitScriptsCommandInput,
} from "./command";

function selectedNames(scripts: CvmInitScripts): string[] {
	return scripts.items.filter((item) => item.selected).map((item) => item.slug);
}

const CUSTOM_SCRIPTS_NOTICE =
	"This CVM also runs init scripts set by Phala Cloud support; changing the selection replaces them.";

function printScripts(scripts: CvmInitScripts): void {
	const columns = ["NAME", "SELECTED", "SELECTABLE", "REASON"] as const;
	const rows = scripts.items.map((item) => ({
		NAME: item.slug,
		SELECTED: item.selected ? "yes" : "no",
		SELECTABLE: item.selectable ? "yes" : "no",
		REASON: item.reason ?? "",
	}));
	printTable(columns, rows);
	if (scripts.has_custom_scripts) {
		logger.info(CUSTOM_SCRIPTS_NOTICE);
	}
}

function requireReplaceCustom(scripts: CvmInitScripts, yes: boolean): void {
	if (scripts.has_custom_scripts && !yes) {
		throw new Error(`${CUSTOM_SCRIPTS_NOTICE} Pass --yes to continue.`);
	}
}

function unwrapPhase(result: {
	success: boolean;
	data?: PatchCvmResult;
	error?: { cause?: unknown } & Error;
}): PatchCvmResult {
	if (!result.success || result.data === undefined) {
		throw result.error?.cause ?? result.error ?? new Error("CVM update failed");
	}
	return result.data;
}

async function runCvmsInitScriptsCommand(
	input: CvmsInitScriptsCommandInput,
	context: CommandContext,
): Promise<number> {
	if (!context.cvmId) {
		context.fail(
			"No CVM ID provided. Use --interactive to select interactively.",
		);
		return 1;
	}

	const hasChange = input.name !== undefined || input.state !== undefined;
	const hasHashes = Boolean(input.composeHash && input.transactionHash);
	if ((input.name === undefined) !== (input.state === undefined)) {
		context.fail("Pass both a name and on|off, or neither to list scripts.");
		return 1;
	}
	if (
		input.state !== undefined &&
		input.state !== "on" &&
		input.state !== "off"
	) {
		context.fail("State must be on or off.");
		return 1;
	}

	try {
		const client = await getClient(context);
		const listed = await safeGetCvmInitScripts(client, context.cvmId);
		if (!listed.success) {
			context.failWithError(listed.error.cause ?? listed.error, {
				operation: "Get CVM init scripts",
			});
			return 1;
		}
		const scripts = listed.data;

		if (!hasChange && !hasHashes) {
			if (input.json) {
				context.success(scripts);
				return 0;
			}
			printScripts(scripts);
			return 0;
		}

		if (hasChange) {
			requireReplaceCustom(scripts, input.yes);
		}

		let phase1: () => Promise<PatchCvmResult> = async () => {
			throw new Error(
				"On-chain confirmation needs --compose-hash and --transaction-hash from a prepare-only run.",
			);
		};

		if (input.name !== undefined) {
			const name = input.name;
			const option = scripts.items.find((item) => item.slug === name);
			if (!option) {
				context.fail(
					`${name} is not an init script provided for this CVM. Available: ${scripts.items.map((item) => item.slug).join(", ")}.`,
				);
				return 1;
			}
			const current = selectedNames(scripts);
			const enabled = current.includes(name);
			if (input.state === "on" && enabled) {
				logger.info(`${name} is already on.`);
				return 0;
			}
			if (input.state === "off" && !enabled) {
				logger.info(`${name} is already off.`);
				return 0;
			}
			if (input.state === "on" && !option.selectable) {
				context.fail(
					option.reason ?? `${name} cannot be selected for this CVM.`,
				);
				return 1;
			}
			// The server validates the set and runs it in its own order.
			const next =
				input.state === "on"
					? [...current, name]
					: current.filter((selected) => selected !== name);
			phase1 = async () =>
				unwrapPhase(
					await safePatchCvm(client, {
						...context.cvmId,
						init_scripts: next,
						confirm_data_wipe: input.confirmDataWipe ? true : undefined,
						prepareOnly: input.prepareOnly,
					}),
				);
		}

		const cvmLabel =
			input.cvmId ??
			context.cvmId.id ??
			context.cvmId.app_id ??
			context.cvmId.uuid ??
			"<cvm>";
		const outcome = await runTwoPhaseComposeUpdate({
			phase1,
			phase2: async (composeHash, transactionHash) => {
				const confirmed = await safeConfirmCvmPatch(client, {
					...context.cvmId,
					composeHash,
					transactionHash,
				});
				if (!confirmed.success) {
					throw confirmed.error.cause ?? confirmed.error;
				}
				return confirmed.data;
			},
			options: {
				prepareOnly: input.prepareOnly,
				privateKey: input.privateKey,
				rpcUrl: input.rpcUrl,
				composeHash: input.composeHash,
				transactionHash: input.transactionHash,
				json: input.json,
				debug: Boolean((input as { debug?: boolean }).debug),
			},
			appId: "",
			followUpLines: (composeHashHex) => [
				`  phala cvms init-scripts ${cvmLabel} \\`,
				`    --compose-hash ${composeHashHex} \\`,
				"    --transaction-hash <tx-hash>",
			],
			stdout: context.stdout,
		});
		if (!("correlationId" in outcome)) {
			return 0;
		}
		if (input.json) {
			context.success({
				requiresOnChainHash: false,
				correlationId: outcome.correlationId,
			});
			return 0;
		}
		if (!outcome.correlationId) {
			logger.info("Init scripts unchanged.");
			return 0;
		}
		logger.success("Init scripts update started.");
		return 0;
	} catch (error) {
		context.failWithError(error, {
			operation: "Manage CVM init scripts",
			...(isDataWipeConfirmError(error)
				? { guidance: DATA_WIPE_CONFIRM_GUIDANCE }
				: {}),
		});
		return 1;
	}
}

export const cvmsInitScriptsCommand = defineCommand({
	path: ["cvms", "init-scripts"],
	meta: cvmsInitScriptsCommandMeta,
	schema: cvmsInitScriptsCommandSchema,
	handler: runCvmsInitScriptsCommand,
});

export default cvmsInitScriptsCommand;
