import { z } from "zod";
import {
  ConfirmFinalityReplacementSchema,
  CvmFinalityWaitPhaseSchema,
  OptionalCvmFinalityWaitSchema,
  finalityReplacementHeaders,
} from "../../types/cvm_finality";
import { CvmIdObjectSchema, CvmIdSchema, type CvmIdInput, refineCvmId } from "../../types/cvm_id";
import { defineAction, defineSimpleAction } from "../../utils/define-action";
import {
  CvmUpdateAcceptedFieldsSchema,
  CvmUpdateHashRequiredSchema,
  cvmUpdateCommitHeaders,
  submitCvmUpdate,
} from "./cvm_update_response";
import { CvmPatchBodySchema } from "./patch_cvm";

const PatchRecordSchema = z.record(z.string(), z.unknown());

export const CvmDraftEntrySchema = z.object({
  id: z.string(),
  user_id: z.string(),
  username: z.string(),
  staged_at: z.string(),
  patch: PatchRecordSchema,
  diff: z.string(),
});
export type CvmDraftEntry = z.infer<typeof CvmDraftEntrySchema>;

export const CvmDraftSchema = z.object({
  base_compose_hash: z.string().nullable(),
  current_compose_hash: z.string().nullable(),
  preview_compose_hash: z.string(),
  patch: PatchRecordSchema,
  entries: z.array(CvmDraftEntrySchema),
});
export type CvmDraft = z.infer<typeof CvmDraftSchema>;

export const CvmDraftListItemSchema = z.object({
  cvm_id: z.string(),
  vm_uuid: z.string(),
  name: z.string().nullable(),
  app_id: z.string().nullable(),
  state: z.union([z.literal("staged"), CvmFinalityWaitPhaseSchema]),
  corrupt: z.boolean(),
  entry_count: z.number().int().nonnegative().nullable(),
  base_compose_hash: z.string().nullable(),
  preview_compose_hash: z.string().nullable(),
  finality_wait: OptionalCvmFinalityWaitSchema,
});
export type CvmDraftListItem = z.infer<typeof CvmDraftListItemSchema>;

export const CvmDraftListSchema = z.object({ items: z.array(CvmDraftListItemSchema) });
export type CvmDraftList = z.infer<typeof CvmDraftListSchema>;

export const StageCvmDraftRequestSchema = refineCvmId(
  CvmIdObjectSchema.extend({ ...CvmPatchBodySchema.shape, prepareOnly: z.never().optional() }),
);
export type StageCvmDraftRequest = z.input<typeof StageCvmDraftRequestSchema>;

export const UndoCvmDraftEntryRequestSchema = refineCvmId(
  CvmIdObjectSchema.extend({ entryId: z.string().min(1) }),
);
export type UndoCvmDraftEntryRequest = z.input<typeof UndoCvmDraftEntryRequestSchema>;

export const DiscardCvmDraftRequestSchema = refineCvmId(
  CvmIdObjectSchema.extend({ expectedEntryIds: z.array(z.string()).optional() }),
);
export type DiscardCvmDraftRequest = z.input<typeof DiscardCvmDraftRequestSchema>;

const ApplyCvmDraftBaseRequestSchema = CvmIdObjectSchema.extend({
  baseComposeHash: z.string().optional(),
  expectedEntryIds: z.array(z.string()).optional(),
  prepareOnly: z.boolean().optional(),
  confirmFinalityReplacement: ConfirmFinalityReplacementSchema,
});

export const ApplyCvmDraftRequestSchema = refineCvmId(
  z.union([
    ApplyCvmDraftBaseRequestSchema.extend({
      composeHash: z.string().min(1),
      transactionHash: z.string().min(1),
    }),
    ApplyCvmDraftBaseRequestSchema.extend({
      composeHash: z.never().optional(),
      transactionHash: z.never().optional(),
    }),
  ]),
);
export type ApplyCvmDraftRequest = z.input<typeof ApplyCvmDraftRequestSchema>;

export const ApplyCvmDraftResultSchema = z.discriminatedUnion("requiresOnChainHash", [
  CvmUpdateAcceptedFieldsSchema.extend({
    requiresOnChainHash: z.literal(false),
  }),
  CvmUpdateHashRequiredSchema,
]);
export type ApplyCvmDraftResult = z.infer<typeof ApplyCvmDraftResultSchema>;

function cvmDraftPath(request: CvmIdInput): string {
  const { cvmId } = CvmIdSchema.parse(request);
  return `/cvms/${encodeURIComponent(cvmId)}/draft`;
}

/** List CVMs with staged changes in the current workspace. */
const { action: listCvmDrafts, safeAction: safeListCvmDrafts } = defineSimpleAction(
  CvmDraftListSchema,
  (client) => client.get("/cvms/drafts"),
);

/** Read the draft and its entries, oldest first. */
const { action: getCvmDraft, safeAction: safeGetCvmDraft } = defineAction<
  CvmIdInput,
  typeof CvmDraftSchema
>(CvmDraftSchema, (client, request) => client.get(cvmDraftPath(request)));

/** Stage a partial CVM update without applying it. */
const { action: stageCvmDraft, safeAction: safeStageCvmDraft } = defineAction<
  StageCvmDraftRequest,
  typeof CvmDraftSchema
>(CvmDraftSchema, (client, request) => {
  const { id, uuid, app_id, instance_id, name, ...patch } =
    StageCvmDraftRequestSchema.parse(request);
  return client.patch(cvmDraftPath({ id, uuid, app_id, instance_id, name }), patch);
});

const UndoCvmDraftEntryResultSchema = z.union([CvmDraftSchema, z.undefined()]);

/** Undo the newest entry. Returns undefined if no entries remain. */
const { action: undoCvmDraftEntry, safeAction: safeUndoCvmDraftEntry } = defineAction<
  UndoCvmDraftEntryRequest,
  typeof UndoCvmDraftEntryResultSchema
>(UndoCvmDraftEntryResultSchema, (client, request) => {
  const { entryId, ...identifier } = UndoCvmDraftEntryRequestSchema.parse(request);
  return client.delete(`${cvmDraftPath(identifier)}/entries/${encodeURIComponent(entryId)}`);
});

const DiscardCvmDraftResultSchema = z.void();

/**
 * Discard the draft without changing any on-chain registrations. Pass entry IDs
 * in draft order to discard only if the entries are unchanged.
 */
const { action: discardCvmDraft, safeAction: safeDiscardCvmDraft } = defineAction<
  DiscardCvmDraftRequest,
  typeof DiscardCvmDraftResultSchema
>(DiscardCvmDraftResultSchema, (client, request) => {
  const { expectedEntryIds, ...identifier } = DiscardCvmDraftRequestSchema.parse(request);
  const options =
    expectedEntryIds === undefined ? undefined : { body: { expected_entry_ids: expectedEntryIds } };
  return client.delete(cvmDraftPath(identifier), options);
});

/**
 * Apply all staged changes as one update. If registration is required, register the
 * returned compose hash and call this action again with both hashes. Pass the
 * reviewed entry IDs in draft order on both calls to guard against draft changes.
 * Acceptance does not mean the update has finished.
 */
const { action: applyCvmDraft, safeAction: safeApplyCvmDraft } = defineAction<
  ApplyCvmDraftRequest,
  typeof ApplyCvmDraftResultSchema
>(ApplyCvmDraftResultSchema, (client, request) => {
  const {
    baseComposeHash,
    expectedEntryIds,
    prepareOnly,
    confirmFinalityReplacement,
    composeHash,
    transactionHash,
    ...identifier
  } = ApplyCvmDraftRequestSchema.parse(request);
  const headers = {
    ...(prepareOnly ? { "X-Prepare-Only": "true" } : {}),
    ...finalityReplacementHeaders(confirmFinalityReplacement),
    ...(composeHash && transactionHash ? cvmUpdateCommitHeaders(composeHash, transactionHash) : {}),
  };
  const body =
    baseComposeHash === undefined && expectedEntryIds === undefined
      ? undefined
      : { base_compose_hash: baseComposeHash, expected_entry_ids: expectedEntryIds };
  return submitCvmUpdate(() => client.post(`${cvmDraftPath(identifier)}/apply`, body, { headers }));
});

export {
  applyCvmDraft,
  discardCvmDraft,
  getCvmDraft,
  listCvmDrafts,
  safeApplyCvmDraft,
  safeDiscardCvmDraft,
  safeGetCvmDraft,
  safeListCvmDrafts,
  safeStageCvmDraft,
  safeUndoCvmDraftEntry,
  stageCvmDraft,
  undoCvmDraftEntry,
};
