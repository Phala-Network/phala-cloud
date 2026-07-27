import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CommandContext } from "@/src/core/types";
import { getCurrentProfile, upsertProfile } from "@/src/utils/credentials";
import { switchCommand } from "./index";

function makeTempHome(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "phala-cli-switch-"));
}

function cleanupDir(dir: string): void {
	try {
		fs.rmSync(dir, { recursive: true, force: true });
	} catch {
		// ignore
	}
}

function makeContext(): CommandContext {
	return {
		argv: [],
		rawFlags: {},
		rawPositionals: [],
		cwd: process.cwd(),
		env: process.env,
		stdout: process.stdout,
		stderr: process.stderr,
		stdin: process.stdin,
		projectConfig: {},
		success() {},
		fail() {},
		failWithError() {},
	};
}

describe("switch command", () => {
	let tempHome: string;
	let oldHome: string | undefined;
	let oldApiKey: string | undefined;
	let oldApiPrefix: string | undefined;
	let oldCloudDir: string | undefined;

	beforeEach(() => {
		oldHome = process.env.HOME;
		oldApiKey = process.env.PHALA_CLOUD_API_KEY;
		oldApiPrefix = process.env.PHALA_CLOUD_API_PREFIX;
		oldCloudDir = process.env.PHALA_CLOUD_DIR;

		tempHome = makeTempHome();
		process.env.HOME = tempHome;
		process.env.PHALA_CLOUD_DIR = path.join(tempHome, ".phala-cloud");
		process.env.PHALA_CLOUD_API_KEY = undefined;
		process.env.PHALA_CLOUD_API_PREFIX = undefined;
	});

	afterEach(() => {
		if (oldHome !== undefined) process.env.HOME = oldHome;
		else process.env.HOME = undefined;
		if (oldApiKey !== undefined) process.env.PHALA_CLOUD_API_KEY = oldApiKey;
		else process.env.PHALA_CLOUD_API_KEY = undefined;
		if (oldApiPrefix !== undefined)
			process.env.PHALA_CLOUD_API_PREFIX = oldApiPrefix;
		else process.env.PHALA_CLOUD_API_PREFIX = undefined;
		if (oldCloudDir !== undefined) process.env.PHALA_CLOUD_DIR = oldCloudDir;
		else process.env.PHALA_CLOUD_DIR = undefined;

		cleanupDir(tempHome);
	});

	test("returns 1 when no profile name provided", async () => {
		const code = await switchCommand.run({ interactive: false }, makeContext());
		expect(code).toBe(1);
	});

	test("switches to existing profile", async () => {
		upsertProfile({
			profileName: "alpha",
			token: "t1",
			workspaceName: "ws-alpha",
			user: { username: "u" },
			setCurrent: true,
		});
		upsertProfile({
			profileName: "beta",
			token: "t2",
			workspaceName: "ws-beta",
			user: { username: "u" },
			setCurrent: false,
		});

		expect(getCurrentProfile()?.name).toBe("alpha");

		const code = await switchCommand.run(
			{ profileName: "beta", interactive: false },
			makeContext(),
		);
		expect(code).toBe(0);
		expect(getCurrentProfile()?.name).toBe("beta");
	});

	test("returns 0 when already on target profile", async () => {
		upsertProfile({
			profileName: "only",
			token: "t",
			workspaceName: "ws",
			user: { username: "u" },
			setCurrent: true,
		});

		const code = await switchCommand.run(
			{ profileName: "only", interactive: false },
			makeContext(),
		);
		expect(code).toBe(0);
		expect(getCurrentProfile()?.name).toBe("only");
	});

	test("returns 1 when profile not found", async () => {
		upsertProfile({
			profileName: "existing",
			token: "t",
			workspaceName: "ws",
			user: { username: "u" },
			setCurrent: true,
		});

		const code = await switchCommand.run(
			{ profileName: "ghost", interactive: false },
			makeContext(),
		);
		expect(code).toBe(1);
	});

	test("returns 1 when no credentials file and profile specified", async () => {
		const code = await switchCommand.run(
			{ profileName: "any", interactive: false },
			makeContext(),
		);
		expect(code).toBe(1);
	});

	describe("--interactive", () => {
		test("returns 1 when no profiles", async () => {
			const code = await switchCommand.run(
				{ interactive: true },
				makeContext(),
			);
			expect(code).toBe(1);
		});

		test("returns 0 when only one profile", async () => {
			upsertProfile({
				profileName: "solo",
				token: "t",
				workspaceName: "ws",
				user: { username: "u" },
				setCurrent: true,
			});

			const code = await switchCommand.run(
				{ interactive: true },
				makeContext(),
			);
			expect(code).toBe(0);
		});
	});
});
