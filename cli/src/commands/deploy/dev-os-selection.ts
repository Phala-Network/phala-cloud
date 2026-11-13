/**
 * Remembering how `--dev-os` was satisfied for a CVM.
 *
 * On dstack 0.6 and newer the SSH server is a `dev-box` service that
 * `phala deploy --dev-os` adds to the compose it *sends*. The CLI never edits
 * the user's compose file, so a later `phala deploy --cvm-id ...` rebuilds the
 * payload from a file without that service: without a record of the choice the
 * redeploy silently drops SSH access, and `--dev-os` used to be create-only, so
 * there was no flag to bring it back.
 *
 * The record lives in the CLI's own state file (`~/.phala-cloud/state.json`,
 * see `src/utils/state.ts`), keyed by CVM id. The project config (`phala.toml`)
 * was the other candidate, but it is user-authored and the only writer
 * available re-serialises the whole file, which would drop its comments and any
 * key this CLI does not know about.
 *
 * Writing is best effort: a deploy that succeeded must not fail because a local
 * cache could not be updated. A missing record only means a later update has to
 * pass `--dev-os` again.
 */

import {
	getStateValue,
	removeStateKeys,
	setStateValue,
} from "@/src/utils/state";
import { logger } from "@/src/utils/logger";
import type { DevOsMode } from "./dev-box";

/** State key prefix; the CVM id follows it. */
const KEY_PREFIX = "deploy.devOsMode.";

function isDevOsMode(value: unknown): value is DevOsMode {
	return value === "dev-box" || value === "dev-image";
}

function stateKey(cvmId: string): string {
	return `${KEY_PREFIX}${cvmId}`;
}

/** Record how `--dev-os` was satisfied, so an update can repeat it. */
export function rememberDevOsMode(cvmId: string, mode: DevOsMode): void {
	try {
		setStateValue(stateKey(cvmId), mode);
	} catch (error) {
		logger.warn(
			`Could not record the dev OS setting for ${cvmId}; a later update has to pass --dev-os again. ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/** How `--dev-os` was satisfied for a CVM, or undefined when it never was. */
export function recallDevOsMode(cvmId: string): DevOsMode | undefined {
	const value = getStateValue(stateKey(cvmId));
	return isDevOsMode(value) ? value : undefined;
}

/** Drop the record, so an update does not re-add what `--no-dev-os` removed. */
export function forgetDevOsMode(cvmId: string): void {
	try {
		removeStateKeys([stateKey(cvmId)]);
	} catch (error) {
		logger.warn(
			`Could not clear the recorded dev OS setting for ${cvmId}. ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}
