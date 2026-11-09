import {
	safeConfirmCvmPatch,
	safeGetCvmInitScripts,
	safePatchCvm,
	safePutCvmInitScripts,
	type CvmInitScripts,
	type PatchCvmResult,
} from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import {
	INIT_SCRIPT_SLUGS,
	isInitScriptSlug,
	type InitScriptSlug,
} from "@/src/commands/deploy/command";
import { getClient } from "@/src/lib/client";
import { readInitScriptFiles } from "@/src/lib/init-script-files";
import { runTwoPhaseComposeUpdate } from "@/src/lib/on-chain-update";
import { printTable } from "@/src/lib/table";
import { logger } from "@/src/utils/logger";
import {
	cvmsInitScriptsCommandMeta,
	cvmsInitScriptsCommandSchema,
	type CvmsInitScriptsCommandInput,
} from "./command";

function selectedSlugs(scripts: CvmInitScripts): InitScriptSlug[] {
	return scripts.items.filter((item) => item.selected).map((item) => item.slug);
}

function printScripts(scripts: CvmInitScripts): void {
	const columns = ["SLUG", "SELECTED", "SELECTABLE", "REASON"] as const;
	const rows = scripts.items.map((item) => ({
		SLUG: item.slug,
		SELECTED: item.selected ? "yes" : "no",
		SELECTABLE: item.selectable ? "yes" : "no",
		REASON: item.reason ?? "",
	}));
	printTable(columns, rows);
	logger.info(
		scripts.has_custom_scripts
			? "This CVM also runs custom init scripts."
			: "This CVM does not run custom init scripts.",
	);
}

function requireReplaceCustom(scripts: CvmInitScripts, yes: boolean): void {
	if (scripts.has_custom_scripts && !yes) {
		throw new Error(
			"This CVM has custom init scripts. Pass --yes to replace them.",
		);
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

	const files = input.file ?? [];
	const hasFiles = files.length > 0;
	const hasSlug = input.slug !== undefined || input.state !== undefined;
	const hasHashes = Boolean(input.composeHash && input.transactionHash);
	if (hasFiles && hasSlug) {
		context.fail("--file cannot be combined with a slug on/off change.");
		return 1;
	}
	if ((input.slug === undefined) !== (input.state === undefined)) {
		context.fail("Pass both a slug and on|off, or neither to list scripts.");
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
	if (input.slug !== undefined && !isInitScriptSlug(input.slug)) {
		context.fail(
			`${input.slug} is not a known init script slug (${INIT_SCRIPT_SLUGS.join(", ")}).`,
		);
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

		if (!hasFiles && input.slug === undefined && !hasHashes) {
			if (input.json) {
				context.success(scripts);
				return 0;
			}
			printScripts(scripts);
			return 0;
		}

		if (hasSlug) {
			requireReplaceCustom(scripts, input.yes);
		}

		let phase1: () => Promise<PatchCvmResult> = async () => {
			throw new Error(
				"On-chain confirmation needs --compose-hash and --transaction-hash from a prepare-only run.",
			);
		};

		if (hasFiles) {
			const contents = readInitScriptFiles(files);
			phase1 = async () =>
				unwrapPhase(
					await safePutCvmInitScripts(client, {
						...context.cvmId,
						scripts: contents,
						prepareOnly: input.prepareOnly,
					}),
				);
		} else if (hasSlug) {
			const slug = input.slug as InitScriptSlug;
			const current = selectedSlugs(scripts);
			const enabled = current.includes(slug);
			if (input.state === "on" && enabled) {
				logger.info(`${slug} is already on.`);
				return 0;
			}
			if (input.state === "off" && !enabled) {
				logger.info(`${slug} is already off.`);
				return 0;
			}
			if (input.state === "on") {
				const option = scripts.items.find((item) => item.slug === slug);
				if (option && !option.selectable) {
					context.fail(
						option.reason ?? `${slug} cannot be selected for this CVM.`,
					);
					return 1;
				}
				if (slug === "docker_cleanup" && !input.confirmDataWipe) {
					context.fail("Turning on docker_cleanup needs --confirm-data-wipe.");
					return 1;
				}
			}
			const next =
				input.state === "on"
					? INIT_SCRIPT_SLUGS.filter(
							(name) => current.includes(name) || name === slug,
						)
					: current.filter((name) => name !== slug);
			phase1 = async () =>
				unwrapPhase(
					await safePatchCvm(client, {
						...context.cvmId,
						init_scripts: next,
						confirm_data_wipe:
							slug === "docker_cleanup" && input.state === "on"
								? true
								: undefined,
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
