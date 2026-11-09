import fs from "node:fs";
import {
	safeGetCvmInitScripts,
	safePatchCvm,
	safePutCvmInitScripts,
	type CvmInitScripts,
} from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import {
	INIT_SCRIPT_SLUGS,
	isInitScriptSlug,
	type InitScriptSlug,
} from "@/src/commands/deploy/command";
import { getClient } from "@/src/lib/client";
import { printTable } from "@/src/lib/table";
import { logger } from "@/src/utils/logger";
import {
	cvmsInitScriptsCommandMeta,
	cvmsInitScriptsCommandSchema,
	type CvmsInitScriptsCommandInput,
} from "./command";

const MAX_INIT_SCRIPT_FILES = 5;

function readScriptFiles(paths: string[]): string[] {
	if (paths.length > MAX_INIT_SCRIPT_FILES) {
		throw new Error(`--file accepts at most ${MAX_INIT_SCRIPT_FILES} scripts.`);
	}
	return paths.map((filePath) => {
		if (!fs.existsSync(filePath)) {
			throw new Error(`No such file: ${filePath}`);
		}
		return fs.readFileSync(filePath, "utf8");
	});
}

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

		if (!hasFiles && input.slug === undefined) {
			if (input.json) {
				context.success(scripts);
				return 0;
			}
			printScripts(scripts);
			return 0;
		}

		requireReplaceCustom(scripts, input.yes);

		if (hasFiles) {
			const result = await safePutCvmInitScripts(client, {
				...context.cvmId,
				scripts: readScriptFiles(files),
			});
			if (!result.success) {
				context.failWithError(result.error.cause ?? result.error, {
					operation: "Replace CVM init scripts",
				});
				return 1;
			}
			if (result.data.requiresOnChainHash) {
				context.fail(
					`This CVM uses on-chain KMS: compose hash ${result.data.composeHash} must be registered on-chain first.`,
				);
				return 1;
			}
			if (input.json) {
				context.success(result.data);
				return 0;
			}
			logger.success("Init scripts update started.");
			return 0;
		}

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
		const result = await safePatchCvm(client, {
			...context.cvmId,
			init_scripts: next,
			confirm_data_wipe:
				slug === "docker_cleanup" && input.state === "on" ? true : undefined,
		});
		if (!result.success) {
			context.failWithError(result.error.cause ?? result.error, {
				operation: "Update CVM init scripts",
			});
			return 1;
		}
		if (result.data.requiresOnChainHash) {
			context.fail(
				`This CVM uses on-chain KMS: compose hash ${result.data.composeHash} must be registered on-chain first.`,
			);
			return 1;
		}
		if (input.json) {
			context.success(result.data);
			return 0;
		}
		if ("correlationId" in result.data && !result.data.correlationId) {
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
