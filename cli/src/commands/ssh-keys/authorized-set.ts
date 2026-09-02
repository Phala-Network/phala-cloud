import { printTable } from "@/src/lib/table";
import { logger } from "@/src/utils/logger";
import type { CvmSshKey, CvmSshKeysResponse } from "@phala/cloud";

export function keyIds(keys: readonly CvmSshKey[]): string[] {
	return keys.map((key) => key.id);
}

export function sameKeyIds(
	left: readonly string[],
	right: readonly string[],
): boolean {
	if (left.length !== right.length) return false;
	const rightSet = new Set(right);
	return left.every((id) => rightSet.has(id));
}

export function keysToRevoke(
	keys: readonly CvmSshKey[],
	nickname: string | undefined,
	sshKeyId: string | undefined,
): CvmSshKey[] {
	return keys.filter((key) => {
		if (sshKeyId && key.id === sshKeyId) return true;
		if (nickname && key.owner_username === nickname) return true;
		return false;
	});
}

export function printAuthorizedSet(
	result: CvmSshKeysResponse,
	options?: { skipRestartHint?: boolean },
): void {
	if (result.keys.length === 0) {
		logger.info("This CVM authorizes no SSH keys.");
	} else {
		const columns = [
			"ID",
			"OWNER",
			"EMAIL",
			"NAME",
			"TYPE",
			"FINGERPRINT",
		] as const;
		const rows = result.keys.map((key) => ({
			ID: key.id,
			OWNER: key.owner_username,
			EMAIL: key.owner_email ?? "",
			NAME: key.name,
			TYPE: key.key_type,
			FINGERPRINT: key.fingerprint,
		}));
		printTable(columns, rows);
	}

	if (result.restart_required && !options?.skipRestartHint) {
		logger.info(
			"The stored set has not been applied to the running VM yet. Pass --apply-now or run `phala cvms restart`.",
		);
	}
}
