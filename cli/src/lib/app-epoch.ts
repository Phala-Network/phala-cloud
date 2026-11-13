/**
 * App-epoch context for on-chain allowlist operations.
 *
 * dstack 0.6.4 replaced the epoch-less `DstackApp` allowlist setters with
 * per-epoch forms, and allowlist rows are not inherited across epochs. The
 * `@phala/cloud` SDK hides that difference behind `resolveAppEpochPlan` and the
 * optional `epoch` write parameter; this module only supplies the bits the CLI
 * needs on top: a probe with its own RPC client, the user-facing wording, and
 * `[from, to]` formatting.
 *
 * See docs/plans/2026-11-13-dstack-epoch-contract-compat-plan.md.
 */
import {
	type AppEpochPlan,
	type EpochsWritten,
	resolveAppEpochPlan,
} from "@phala/cloud";
import {
	type Address,
	type Chain,
	type PublicClient,
	createPublicClient,
	http,
} from "viem";
import { logger } from "@/src/utils/logger";

/** The epoch rows a write touched, as `[fromEpoch, toEpoch]`. */
export type { AppEpochPlan, EpochsWritten };

/** Budget for the two probe reads (ERC-165 support, then currentAppEpoch). */
const DEFAULT_PROBE_TIMEOUT_MS = 15_000;

/**
 * Resolve the app contract generation and, on epoch-aware contracts, the
 * current app epoch.
 *
 * Returns `null` when the probe could not reach a verdict (RPC hiccup, broken
 * contract); callers must not treat that as "legacy".
 */
export async function detectAppEpochPlan(params: {
	chain: Chain;
	appAddress: Address;
	rpcUrl?: string;
	timeoutMs?: number;
}): Promise<AppEpochPlan | null> {
	const publicClient = createPublicClient({
		chain: params.chain,
		transport: http(params.rpcUrl, {
			timeout: params.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS,
		}),
	});

	try {
		// The CLI tsconfig is non-strict, which widens viem's inferred client so
		// it is not directly assignable to the SDK's `PublicClient` parameter.
		return await resolveAppEpochPlan(
			publicClient as unknown as PublicClient,
			params.appAddress,
		);
	} catch {
		return null;
	}
}

/**
 * Human-readable epoch context line, or `null` when there is nothing to show:
 * legacy contracts and undecided probes stay silent.
 */
export function formatAppEpochPlan(plan: AppEpochPlan | null): string | null {
	if (!plan || plan.kind !== "epoch") return null;
	return `App epoch: ${plan.currentAppEpoch} (epoch-aware contract)`;
}

/** Error text for `--epoch` used against a legacy app contract. */
export function legacyEpochUnsupportedMessage(appAddress: Address): string {
	return `Contract ${appAddress} is a legacy (pre-epoch) DstackApp contract; it has no epoch-scoped allowlist. --epoch is only valid on epoch-aware contracts. Omit --epoch to write the allowlist the legacy way.`;
}

/**
 * Narrow the SDK's `epochsWritten` payload to a strict two-element tuple.
 *
 * The SDK declares it as an optional tuple whose elements are themselves
 * optional, so callers cannot destructure it without normalizing first.
 */
export function readEpochsWritten(value: unknown): EpochsWritten | undefined {
	if (!Array.isArray(value) || value.length < 2) return undefined;
	const [from, to] = value;
	if (typeof from !== "number" || typeof to !== "number") return undefined;
	return [from, to];
}

/** Render the rows a write touched as `epoch 0` / `epochs 0..1`. */
export function formatEpochsWritten(epochs: EpochsWritten): string {
	const [from, to] = epochs;
	return from === to ? `epoch ${from}` : `epochs ${from}..${to}`;
}

/**
 * Print the epoch rows an SDK write reported on the debug channel.
 *
 * Returns the range so callers with their own verbose flag can echo it too;
 * `undefined` means the contract has no epochs and the SDK used the legacy
 * setter.
 */
export function logWrittenEpochRange(
	label: string,
	epochs: EpochsWritten | undefined,
): EpochsWritten | undefined {
	if (!epochs) return undefined;
	logger.debug(`${label} written for ${formatEpochsWritten(epochs)}`);
	return epochs;
}
