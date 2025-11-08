/**
 * Shared JSON mode state for CLI
 * When enabled, human-readable output is suppressed and only JSON is output
 * JSON mode also implies non-interactive mode (no prompts)
 */
let isJsonMode = false;

export function setJsonMode(enabled: boolean): void {
	isJsonMode = enabled;
}

export function isInJsonMode(): boolean {
	return isJsonMode;
}

/**
 * Check if the CLI should run in interactive mode
 * Interactive mode is disabled when:
 * - JSON mode is enabled (--json flag)
 * - This allows --json to be used for automation/scripting
 *
 * @returns true if interactive prompts should be shown
 */
export function isInteractive(): boolean {
	return !isJsonMode;
}
