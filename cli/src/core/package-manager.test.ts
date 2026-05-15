import { describe, expect, test } from "bun:test";
import {
	detectPackageManagerFromPath,
	detectPackageManager,
	detectRuntimeFromProcess,
	formatGlobalInstallCommand,
	getGlobalInstallArgs,
} from "./package-manager";

describe("detectPackageManagerFromPath", () => {
	test("detects bun from ~/.bun/bin/ path", () => {
		expect(detectPackageManagerFromPath("/Users/user/.bun/bin/phala")).toBe(
			"bun",
		);
		expect(detectPackageManagerFromPath("/home/user/.bun/bin/phala")).toBe(
			"bun",
		);
	});

	test("detects pnpm from path containing pnpm", () => {
		expect(
			detectPackageManagerFromPath(
				"/Users/user/.local/share/pnpm/global/5/node_modules/.bin/phala",
			),
		).toBe("pnpm");
		expect(
			detectPackageManagerFromPath(
				"/home/user/pnpm/global/node_modules/phala/dist/index.js",
			),
		).toBe("pnpm");
	});

	test("detects yarn from ~/.yarn/ path", () => {
		expect(detectPackageManagerFromPath("/Users/user/.yarn/bin/phala")).toBe(
			"yarn",
		);
		expect(
			detectPackageManagerFromPath(
				"/home/user/yarn/global/node_modules/phala/dist/index.js",
			),
		).toBe("yarn");
	});

	test("returns undefined for npm or unknown paths", () => {
		expect(
			detectPackageManagerFromPath(
				"/usr/local/lib/node_modules/phala/dist/index.js",
			),
		).toBeUndefined();
		expect(
			detectPackageManagerFromPath(
				"/home/user/.npm-global/lib/node_modules/phala/dist/index.js",
			),
		).toBeUndefined();
	});

	test("handles Windows-style paths", () => {
		expect(
			detectPackageManagerFromPath("C:\\Users\\user\\.bun\\bin\\phala"),
		).toBe("bun");
	});
});

describe("detectPackageManager", () => {
	test("returns bun when runtime is bun", () => {
		expect(detectPackageManager({}, "bun")).toBe("bun");
	});

	test("detects from npm_config_user_agent", () => {
		expect(
			detectPackageManager({ npm_config_user_agent: "pnpm/8.0.0" }, "node"),
		).toBe("pnpm");
		expect(
			detectPackageManager({ npm_config_user_agent: "yarn/1.22.0" }, "node"),
		).toBe("yarn");
		expect(
			detectPackageManager({ npm_config_user_agent: "npm/10.0.0" }, "node"),
		).toBe("npm");
		expect(
			detectPackageManager({ npm_config_user_agent: "bun/1.0.0" }, "node"),
		).toBe("bun");
	});

	test("falls back to npm when no detection succeeds", () => {
		expect(detectPackageManager({}, "node")).toBe("npm");
	});
});

describe("formatGlobalInstallCommand", () => {
	test("uses update for bun", () => {
		expect(formatGlobalInstallCommand("bun", "phala@1.2.3")).toBe(
			"bun update -g phala@1.2.3",
		);
	});

	test("formats correctly for npm", () => {
		expect(formatGlobalInstallCommand("npm", "phala@latest")).toBe(
			"npm i -g phala@latest",
		);
	});

	test("formats correctly for pnpm", () => {
		expect(formatGlobalInstallCommand("pnpm", "phala@latest")).toBe(
			"pnpm add -g phala@latest",
		);
	});

	test("formats correctly for yarn", () => {
		expect(formatGlobalInstallCommand("yarn", "phala@latest")).toBe(
			"yarn global add phala@latest",
		);
	});
});

describe("getGlobalInstallArgs", () => {
	test("uses update for bun", () => {
		const result = getGlobalInstallArgs("bun", "phala@1.2.3");
		expect(result.command).toBe("bun");
		expect(result.args).toEqual(["update", "-g", "phala@1.2.3"]);
	});

	test("returns correct args for npm", () => {
		const result = getGlobalInstallArgs("npm", "phala@latest");
		expect(result.command).toBe("npm");
		expect(result.args).toEqual(["i", "-g", "phala@latest"]);
	});
});

describe("detectRuntimeFromProcess", () => {
	test("detects current runtime", () => {
		const runtime = detectRuntimeFromProcess();
		// In bun test environment, this should be "bun"
		expect(["node", "bun"]).toContain(runtime);
	});
});
