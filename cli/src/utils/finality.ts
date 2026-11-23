import {
	type CvmFinalityStage,
	type CvmFinalityWait,
	type CvmFinalityWaitAccepted,
	type WaitForCvmFinalityResult,
	waitForCvmFinality,
} from "@phala/cloud";
import type { CliApiClient } from "@/src/lib/client";
import { logger } from "./logger";

const UNKNOWN_FINALITY_TIMEOUT_MS = 45 * 60 * 1000;
const FINALITY_TIMEOUT_MARGIN_MS = 15 * 60 * 1000;
// Measured 2026-11-22 15:54–19:55 UTC, public RPC.
// These are p90 seconds from transaction inclusion to the target block tag.
const CHAIN_FINALITY_ETA_SECONDS: ReadonlyMap<
	number,
	Readonly<Partial<Record<CvmFinalityStage, number>>>
> = new Map([
	[1, { safe: 733, finalized: 1117 }],
	[8453, { safe: 73, finalized: 1235 }],
]);

export function getChainFinalityEtaSeconds(
	chainId: number | null | undefined,
	targetTag: CvmFinalityStage = "finalized",
): number | null {
	if (chainId == null || (targetTag !== "safe" && targetTag !== "finalized"))
		return null;
	return CHAIN_FINALITY_ETA_SECONDS.get(chainId)?.[targetTag] ?? null;
}

export function getFinalityTimeoutMs(etaSeconds: number | null): number {
	return etaSeconds == null
		? UNKNOWN_FINALITY_TIMEOUT_MS
		: Math.min(2_147_483_647, etaSeconds * 1000 + FINALITY_TIMEOUT_MARGIN_MS);
}

export function formatFinalityEta(etaSeconds: number | null): string {
	if (etaSeconds == null) return "Finality ETA: unavailable.";
	if (etaSeconds < 60) return "Finality ETA: less than a minute.";
	const minutes = Math.ceil(etaSeconds / 60);
	return `Finality ETA: about ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
}

export function formatCvmOperationStatusCommand(
	cvmId: string,
	correlationId: string,
): string {
	const query = new URLSearchParams({ correlation_id: correlationId });
	// Single-quote the URL so shells do not interpret the query as a glob.
	return `phala api '/cvms/${encodeURIComponent(cvmId).replace(/'/g, "%27")}/operations?${query}'`;
}

/** A blank response field is not an operation ID. Keep nonblank IDs unchanged. */
export function getCvmOperationId(value: string | null | undefined) {
	return value?.trim() ? value : undefined;
}

export function untrackedCvmOperationFields(cvmId: string) {
	return {
		correlation_id: null,
		tracking: "untracked" as const,
		message: `Phala Cloud accepted the request for CVM ${cvmId}, but did not return an operation ID. Check the CVM status. Do not resubmit the request.`,
	};
}

type AcceptedOperation = Pick<
	CvmFinalityWaitAccepted,
	"correlation_id" | "finality_wait"
>;

function exactProgress(
	acceptance: AcceptedOperation,
): CvmFinalityWait | undefined {
	return acceptance.finality_wait?.correlation_id === acceptance.correlation_id
		? (acceptance.finality_wait ?? undefined)
		: undefined;
}

function getOperationEta(progress: CvmFinalityWait | undefined): number | null {
	if (!progress?.transaction || progress.phase === "applying") return null;
	// The API returns null when measurements do not describe the remaining wait.
	return progress.finality.eta_seconds ?? null;
}

function formatStage(progress: CvmFinalityWait): string {
	const stage = `On-chain stage: ${progress.stage}.`;
	if (progress.phase === "applying") {
		return `${stage} Phala Cloud is applying the change.`;
	}
	return `${stage} Waiting for the KMS to honor the change. ${formatFinalityEta(getOperationEta(progress))}`;
}

export function acceptedCvmOperationFields(
	cvmId: string,
	acceptance: AcceptedOperation,
) {
	const progress = exactProgress(acceptance);
	return {
		correlation_id: acceptance.correlation_id,
		finality_wait: progress ?? null,
		eta_seconds: getOperationEta(progress),
		status_command: formatCvmOperationStatusCommand(
			cvmId,
			acceptance.correlation_id,
		),
	};
}

export function formatAcceptedCvmOperation(
	cvmId: string,
	acceptance: AcceptedOperation,
): string {
	const { correlation_id, finality_wait, status_command } =
		acceptedCvmOperationFields(cvmId, acceptance);
	return [
		"CVM operation accepted. It has not finished.",
		...(finality_wait ? [formatStage(finality_wait)] : []),
		`CVM ID: ${cvmId}`,
		`Correlation ID: ${correlation_id}`,
		...(finality_wait?.transaction
			? [`Transaction hash: ${finality_wait.transaction.hash}`]
			: []),
		`Check this operation: ${status_command}`,
	].join("\n");
}

export function acceptedCvmOperationWaitError(
	error: unknown,
	cvmId: string,
	correlationId: string,
): Error {
	const message = error instanceof Error ? error.message : String(error);
	return new Error(
		`${message}\nCheck this operation: ${formatCvmOperationStatusCommand(cvmId, correlationId)}`,
	);
}

export async function waitForAcceptedCvmOperation(
	client: CliApiClient,
	cvmId: string,
	acceptance: AcceptedOperation,
	options?: {
		chainId?: number;
		timeoutMs?: number;
		onProgress?: (message: string) => void;
	},
): Promise<WaitForCvmFinalityResult> {
	const { correlation_id } = acceptance;
	const initial = exactProgress(acceptance);
	const blockTag = initial?.finality.block_tag;
	// With no progress metadata, the chain's finalized head gives a local
	// wait budget, not an ETA for the KMS's unknown policy.
	const chainBudgetEta = initial
		? initial.transaction && blockTag
			? getChainFinalityEtaSeconds(initial.transaction.chain_id, blockTag)
			: null
		: getChainFinalityEtaSeconds(options?.chainId);
	const eta = getOperationEta(initial) ?? chainBudgetEta;
	const onProgress =
		options?.onProgress ?? ((message: string) => logger.info(message));
	let lastStage = initial?.stage;
	let lastPhase = initial?.phase;
	try {
		if (initial) onProgress(formatStage(initial));
		return await waitForCvmFinality(
			client,
			{ id: cvmId, correlationId: correlation_id },
			{
				timeoutMs: options?.timeoutMs ?? getFinalityTimeoutMs(eta),
				onStage(progress) {
					if (progress.stage === lastStage && progress.phase === lastPhase)
						return;
					lastStage = progress.stage;
					lastPhase = progress.phase;
					onProgress(formatStage(progress));
				},
			},
		);
	} catch (error) {
		throw acceptedCvmOperationWaitError(error, cvmId, correlation_id);
	}
}
