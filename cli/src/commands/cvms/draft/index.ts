import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineCommand } from "@/src/core/define-command";
import type {
	CommandContext,
	CommandHandler,
	CommandMeta,
} from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import {
	acceptedCvmOperationFields,
	formatAcceptedCvmOperation,
	getCvmOperationId,
	untrackedCvmOperationFields,
	waitForAcceptedCvmOperation,
} from "@/src/utils/finality";
import { resolveSigningKey, signingError } from "@/src/utils/signing-key";
import {
	AddComposeHashSchema,
	type ApplyCvmDraftResult,
	type CvmDraft,
	CvmIdSchema,
	SUPPORTED_CHAINS,
	StageCvmDraftRequestSchema,
	addComposeHash,
	applyCvmDraft,
	checkOnChainPrerequisites,
	discardCvmDraft,
	getCvmDraft,
	listCvmDrafts,
	stageCvmDraft,
	undoCvmDraftEntry,
} from "@phala/cloud";
import { isAddress } from "viem";
import { z } from "zod";
import {
	draftApplyMeta,
	draftApplySchema,
	draftCvmSchema,
	draftDiscardMeta,
	draftGroup,
	draftListMeta,
	draftReviewedCvmSchema,
	draftShowMeta,
	draftStageMeta,
	draftStageSchema,
	draftUndoMeta,
	draftUndoSchema,
	emptySchema,
} from "./command";

const patchSchema = z
	.strictObject(StageCvmDraftRequestSchema.shape)
	.omit({
		id: true,
		uuid: true,
		app_id: true,
		instance_id: true,
		name: true,
		prepareOnly: true,
	})
	.refine(
		(patch) => Object.keys(patch).length > 0,
		"Provide at least one CVM update field.",
	);

function cvmId(input: { cvmId: string }, context: CommandContext): string {
	return CvmIdSchema.parse(context.cvmId ?? { id: input.cvmId }).cvmId;
}

function warnDraftChange(context: CommandContext): void {
	context.stderr.write(
		"Changing this draft can replace an update waiting for finality. Existing on-chain registrations stay in place.\n",
	);
}

function printDraft(
	context: CommandContext,
	id: string,
	draft: CvmDraft,
): void {
	if (context.globalOptions?.json) {
		context.success(draft);
		return;
	}
	const hashes = [
		`Draft for ${id}`,
		`Base hash: ${draft.base_compose_hash ?? "Not available"}`,
		`Current hash: ${draft.current_compose_hash ?? "Not available"}`,
		`Preview hash: ${draft.preview_compose_hash}`,
	];
	context.stdout.write(`${hashes.join("\n")}\n`);
	for (const entry of draft.entries) {
		context.stdout.write(
			`\n${entry.id} by ${entry.username} at ${entry.staged_at}\n`,
		);
		context.stdout.write(
			`${entry.diff || "No differences."}${entry.diff.endsWith("\n") ? "" : "\n"}`,
		);
	}
}

function draftCommand<T extends z.ZodType>(
	meta: CommandMeta,
	schema: T,
	operation: string,
	run: CommandHandler<T>,
) {
	return defineCommand({
		path: [...draftGroup.path, meta.name],
		meta,
		schema,
		handler: async (input, context) => {
			try {
				if (
					context.rawPositionals.length > (meta.arguments?.length ?? 0) ||
					context.argv.includes("--")
				) {
					throw new Error(
						`Unexpected arguments. Run phala cvms draft ${meta.name} --help for usage.`,
					);
				}
				return await run(input, context);
			} catch (error) {
				context.failWithError(error, { operation });
				return 1;
			}
		},
	});
}

const draftList = draftCommand(
	draftListMeta,
	emptySchema,
	"List CVM drafts",
	async (_, context) => {
		const drafts = await listCvmDrafts(await getClient(context));
		if (context.globalOptions?.json) {
			context.success(drafts);
		} else if (drafts.items.length === 0) {
			context.stdout.write("No CVM drafts in this workspace.\n");
		} else {
			for (const draft of drafts.items) {
				const state = draft.state.replace(/_/g, " ");
				const lines = [
					draft.name ? `${draft.name} (${draft.cvm_id})` : draft.cvm_id,
					`  State: ${state}${draft.corrupt ? " (unreadable draft)" : ""}`,
					`  Entries: ${draft.entry_count ?? "Not available"}`,
					`  Base hash: ${draft.base_compose_hash ?? "Not available"}`,
					`  Preview hash: ${draft.preview_compose_hash ?? "Not available"}`,
				];
				context.stdout.write(`${lines.join("\n")}\n`);
			}
		}
		return 0;
	},
);

const draftShow = draftCommand(
	draftShowMeta,
	draftCvmSchema,
	"Show CVM draft",
	async (input, context) => {
		const id = cvmId(input, context);
		const draft = await getCvmDraft(await getClient(context), { id });
		printDraft(context, id, draft);
		return 0;
	},
);

const draftStage = draftCommand(
	draftStageMeta,
	draftStageSchema,
	"Stage CVM draft change",
	async (input, context) => {
		const id = cvmId(input, context);
		const patch = input.patchFile
			? patchSchema.parse(
					JSON.parse(
						await readFile(resolve(context.cwd, input.patchFile), "utf8"),
					),
				)
			: {
					docker_compose_file: await readFile(
						resolve(context.cwd, input.compose ?? ""),
						"utf8",
					),
				};
		warnDraftChange(context);
		const draft = await stageCvmDraft(await getClient(context), {
			...patch,
			id,
		});
		printDraft(context, id, draft);
		return 0;
	},
);

const draftUndo = draftCommand(
	draftUndoMeta,
	draftUndoSchema,
	"Undo CVM draft entry",
	async (input, context) => {
		const id = cvmId(input, context);
		const client = await getClient(context);
		const entryId =
			input.entryId ?? (await getCvmDraft(client, { id })).entries.at(-1)?.id;
		if (!entryId) throw new Error("This draft has no entries to undo.");
		warnDraftChange(context);
		const remaining = await undoCvmDraftEntry(client, { id, entryId });
		if (remaining) {
			printDraft(context, id, remaining);
		} else if (context.globalOptions?.json) {
			context.success({ discarded: true, entry_id: entryId });
		} else {
			context.stdout.write(
				`Undid entry ${entryId}. No staged changes remain. On-chain registrations were not changed.\n`,
			);
		}
		return 0;
	},
);

const draftDiscard = draftCommand(
	draftDiscardMeta,
	draftReviewedCvmSchema,
	"Discard CVM draft",
	async (input, context) => {
		const id = cvmId(input, context);
		await discardCvmDraft(await getClient(context), {
			id,
			expectedEntryIds: input.expectedEntryIds,
		});
		if (context.globalOptions?.json) {
			context.success({ discarded: true });
		} else {
			context.stdout.write(
				"Discarded staged changes. On-chain registrations were not changed.\n",
			);
		}
		return 0;
	},
);

async function registerDraftHash(
	result: Extract<ApplyCvmDraftResult, { requiresOnChainHash: true }>,
	input: z.infer<typeof draftApplySchema>,
	context: CommandContext,
): Promise<string> {
	const chainId = result.kmsInfo.chain_id;
	const chain = chainId != null ? SUPPORTED_CHAINS[chainId] : undefined;
	if (!chain) {
		throw new Error(
			chainId == null
				? "The CVM's KMS chain is unknown."
				: `Chain ID ${chainId} is not supported.`,
		);
	}
	const address = `0x${result.appId.replace(/^0x/i, "")}`;
	if (!isAddress(address, { strict: false })) {
		throw new Error("Phala Cloud did not return a valid app contract address.");
	}
	const rpcUrl = input.rpcUrl || context.env.ETH_RPC_URL;
	const onChain = await checkOnChainPrerequisites({
		chain,
		rpcUrl,
		appAddress: address,
		deviceId: result.deviceId,
		composeHash: result.composeHash,
	});
	if (!onChain.deviceAllowed) {
		throw new Error(
			`Device ${result.deviceId} must be allowed on ${chain.name} before you apply this draft.`,
		);
	}
	if (onChain.composeHashAllowed) return "already-registered";

	const privateKey = resolveSigningKey(
		input.privateKey || context.env.PRIVATE_KEY,
	);
	context.stderr.write(
		`Registering compose hash ${result.composeHash} on ${chain.name} is irreversible. Undo, discard, or cancel does not remove the registration or take back keys already released.\n`,
	);
	try {
		const transaction = await addComposeHash(
			{
				chain,
				rpcUrl,
				appId: address,
				composeHash: result.composeHash,
				privateKey,
				onTransactionSubmitted: (hash) => {
					context.stderr.write(`Registration transaction submitted: ${hash}\n`);
					if (input.expectedEntryIds) {
						context.stderr.write(
							"If you retry with --compose-hash and --transaction-hash, keep the same --expected-entry-id flags in the same order.\n",
						);
					}
				},
			},
			{ schema: AddComposeHashSchema },
		);
		return transaction.transactionHash;
	} catch (error) {
		throw signingError(error, privateKey);
	}
}

const draftApply = draftCommand(
	draftApplyMeta,
	draftApplySchema,
	"Apply CVM draft",
	async (input, context) => {
		const client = await getClient(context);
		const id = cvmId(input, context);
		const json = context.globalOptions?.json;
		let chainId: number | undefined;
		const draftRequest = { id, expectedEntryIds: input.expectedEntryIds };
		// Never override the draft's original basis. The first request may apply the draft
		// immediately if no transaction is required, so there is no prepare-only CLI mode.
		let result = await applyCvmDraft(
			client,
			input.composeHash && input.transactionHash
				? {
						...draftRequest,
						composeHash: input.composeHash,
						transactionHash: input.transactionHash,
					}
				: draftRequest,
		);
		if (result.requiresOnChainHash === true) {
			if (input.composeHash && input.transactionHash) {
				throw new Error(
					"Phala Cloud did not accept the provided transaction as proof for this draft.",
				);
			}
			chainId = result.kmsInfo.chain_id ?? undefined;
			const transactionHash = await registerDraftHash(result, input, context);
			result = await applyCvmDraft(client, {
				...draftRequest,
				composeHash: result.composeHash,
				transactionHash,
			});
			if (result.requiresOnChainHash === true) {
				throw new Error(
					"Phala Cloud did not accept the transaction as proof for this draft.",
				);
			}
		}
		const correlationId = getCvmOperationId(result.correlationId);
		const acceptance = correlationId
			? { correlation_id: correlationId, finality_wait: result.finalityWait }
			: undefined;
		const untracked =
			!acceptance && result.status !== "no_change"
				? untrackedCvmOperationFields(id)
				: undefined;
		if (input.wait && acceptance) {
			const completed = await waitForAcceptedCvmOperation(
				client,
				id,
				acceptance,
				{
					chainId,
					onProgress: (message) => {
						if (!json) context.stderr.write(`${message}\n`);
					},
				},
			);
			if (json)
				context.success({
					correlation_id: completed.correlation_id,
					status: completed.status,
				});
			else
				context.stdout.write(
					`Draft applied. Operation: ${completed.correlation_id}\n`,
				);
		} else if (json) {
			context.success({
				...(acceptance
					? acceptedCvmOperationFields(id, acceptance)
					: untracked),
				status: result.status,
			});
		} else if (untracked) {
			context.stdout.write(`${untracked.message}\n`);
		} else if (acceptance?.finality_wait) {
			context.stdout.write(`${formatAcceptedCvmOperation(id, acceptance)}\n`);
		} else if (result.status === "no_change") {
			context.stdout.write("No changes to apply. The draft was cleared.\n");
		} else {
			context.stdout.write(
				`Draft update accepted. Operation: ${correlationId}\n`,
			);
		}
		return 0;
	},
);

export const cvmsDraftCommands = {
	group: draftGroup,
	commands: [
		draftList,
		draftShow,
		draftStage,
		draftUndo,
		draftDiscard,
		draftApply,
	],
};
