export type RuntimeName = "node" | "bun";

export type PackageManagerName = "npm" | "pnpm" | "yarn" | "bun";

export function detectRuntimeFromProcess(): RuntimeName {
	// Bun provides process.versions.bun
	// biome-ignore lint/suspicious/noExplicitAny: runtime detection
	return typeof (process.versions as any).bun === "string" ? "bun" : "node";
}

/**
 * Detect package manager from the executable path.
 * Global installs typically reside in package-manager-specific directories.
 */
export function detectPackageManagerFromPath(
	execPath: string,
): PackageManagerName | undefined {
	// Normalize path separators for cross-platform support
	const normalizedPath = execPath.replace(/\\/g, "/");

	// bun: ~/.bun/bin/ or similar
	if (/[/\\]\.bun[/\\]/.test(normalizedPath)) return "bun";

	// pnpm: ~/.local/share/pnpm/ or pnpm/global/
	if (/pnpm/.test(normalizedPath)) return "pnpm";

	// yarn: ~/.yarn/ or yarn/global/
	if (/[/\\]\.yarn[/\\]|yarn[/\\]global/.test(normalizedPath)) return "yarn";

	return undefined;
}

export function detectPackageManager(
	env: NodeJS.ProcessEnv,
	runtime: RuntimeName,
): PackageManagerName {
	if (runtime === "bun") return "bun";

	// Check npm_config_user_agent first (set when running via package manager scripts)
	const userAgent = env.npm_config_user_agent;
	if (userAgent) {
		const firstToken = userAgent.split(" ")[0] ?? "";
		const name = firstToken.split("/")[0];
		if (name === "pnpm") return "pnpm";
		if (name === "yarn") return "yarn";
		if (name === "npm") return "npm";
		if (name === "bun") return "bun";
	}

	// For global CLI execution, detect from the executable path
	// process.argv[1] contains the path to the executed script
	const scriptPath = process.argv[1];
	if (scriptPath) {
		const fromPath = detectPackageManagerFromPath(scriptPath);
		if (fromPath) return fromPath;
	}

	// Fallback for direct execution without a package manager wrapper.
	return "npm";
}

export function formatGlobalInstallCommand(
	packageManager: PackageManagerName,
	packageName: string,
): string {
	switch (packageManager) {
		case "bun":
			return `bun update -g ${packageName}`;
		case "pnpm":
			return `pnpm add -g ${packageName}`;
		case "yarn":
			return `yarn global add ${packageName}`;
		default:
			return `npm i -g ${packageName}`;
	}
}

export function getGlobalInstallArgs(
	packageManager: PackageManagerName,
	packageNameOrSpec: string,
): { command: string; args: string[] } {
	switch (packageManager) {
		case "bun":
			return {
				command: "bun",
				args: ["update", "-g", packageNameOrSpec],
			};
		case "pnpm":
			return { command: "pnpm", args: ["add", "-g", packageNameOrSpec] };
		case "yarn":
			return { command: "yarn", args: ["global", "add", packageNameOrSpec] };
		default:
			return { command: "npm", args: ["i", "-g", packageNameOrSpec] };
	}
}
