/**
 * Shared JSON mode state for CLI
 * When enabled, human-readable output is suppressed and only JSON is output
 */
let isJsonMode = false;

export function setJsonMode(enabled: boolean): void {
	isJsonMode = enabled;
}

export function isInJsonMode(): boolean {
	return isJsonMode;
}
