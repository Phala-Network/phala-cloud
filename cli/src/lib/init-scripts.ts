import { normalizeCliError } from "@/src/utils/logger";

/** Phala Cloud error code: an init script that wipes data needs confirmation. */
const DATA_WIPE_CONFIRM_ERROR_CODE = "ERR-03-048";

export const DATA_WIPE_CONFIRM_GUIDANCE =
	"This change erases or stops using existing data on disk. Rerun the command with --confirm-data-wipe to confirm it.";

export function isDataWipeConfirmError(error: unknown): boolean {
	return normalizeCliError(error).errorCode === DATA_WIPE_CONFIRM_ERROR_CODE;
}
