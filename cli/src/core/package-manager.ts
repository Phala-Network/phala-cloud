export type RuntimeName = "node" | "bun";

export type PackageManagerName = "npm" | "pnpm" | "yarn" | "bun";

export function detectRuntimeFromProcess(): RuntimeName {
	// Bun provides process.versions.bun
	// biome-ignore lint/suspicious/noExplicitAny: runtime detection
	return typeof (process.versions as any).bun === "string" ? "bun" : "node";
}

export function detectPackageManager(
	env: NodeJS.ProcessEnv,
	runtime: RuntimeName,
): PackageManagerName {
	if (runtime === "bun") return "bun";

	const userAgent = env.npm_config_user_agent;
	if (userAgent) {
		const firstToken = userAgent.split(" ")[0] ?? "";
		const name = firstToken.split("/")[0];
		if (name === "pnpm") return "pnpm";
		if (name === "yarn") return "yarn";
		if (name === "npm") return "npm";
		if (name === "bun") return "bun";
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
			return `bun add -g ${packageName}`;
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
			return { command: "bun", args: ["add", "-g", packageNameOrSpec] };
		case "pnpm":
			return { command: "pnpm", args: ["add", "-g", packageNameOrSpec] };
		case "yarn":
			return { command: "yarn", args: ["global", "add", packageNameOrSpec] };
		default:
			return { command: "npm", args: ["i", "-g", packageNameOrSpec] };
	}
}
