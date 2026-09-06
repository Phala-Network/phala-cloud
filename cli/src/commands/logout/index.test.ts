import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CommandContext } from "@/src/core/types";
import type { RevokeTokenResult } from "@/src/lib/client";

const mockTryRevokeApiToken = mock(
	(): Promise<RevokeTokenResult> => Promise.resolve({ outcome: "revoked" }),
);

mock.module("@/src/lib/client", () => ({
	tryRevokeApiToken: mockTryRevokeApiToken,
}));

const noop = () => {};
mock.module("@/src/utils/logger", () => ({
	logger: {
		info: noop,
		warn: noop,
		error: noop,
		success: noop,
		break: noop,
		logDetailedError: noop,
	},
}));

const { logoutCommand } = await import("./index");
const { saveCredentialsFile, loadCredentialsFile } = await import(
	"@/src/utils/credentials"
);

function makeContext(json = false): CommandContext {
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
		globalOptions: { json },
		success() {},
		fail() {},
		failWithError() {},
	} as unknown as CommandContext;
}

function profile(token: string) {
	return {
		token,
		api_prefix: "https://example.test/api/v1",
		workspace: { name: "W" },
		user: { username: "u" },
		updated_at: "2026-01-01T00:00:00.000Z",
	};
}

function setEnv(key: string, value: string | undefined): void {
	if (value === undefined) delete process.env[key];
	else process.env[key] = value;
}

describe("logout command", () => {
	let tempDir: string;
	let oldDir: string | undefined;
	let oldPrefix: string | undefined;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "phala-cli-test-"));
		oldDir = process.env.PHALA_CLOUD_DIR;
		oldPrefix = process.env.PHALA_CLOUD_API_PREFIX;
		process.env.PHALA_CLOUD_DIR = tempDir;
		setEnv("PHALA_CLOUD_API_PREFIX", undefined);
		mockTryRevokeApiToken.mockClear();
		mockTryRevokeApiToken.mockImplementation(() =>
			Promise.resolve({ outcome: "revoked" }),
		);
	});

	afterEach(() => {
		setEnv("PHALA_CLOUD_DIR", oldDir);
		setEnv("PHALA_CLOUD_API_PREFIX", oldPrefix);
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	test("revokes the current profile token before removing it locally", async () => {
		saveCredentialsFile({
			schema_version: 1,
			current_profile: "alpha",
			profiles: { alpha: profile("phak_alpha"), beta: profile("phak_beta") },
		});

		const code = await logoutCommand.run({}, makeContext());

		expect(code).toBe(0);
		expect(mockTryRevokeApiToken).toHaveBeenCalledTimes(1);
		expect(mockTryRevokeApiToken).toHaveBeenCalledWith({
			apiKey: "phak_alpha",
			baseURL: "https://example.test/api/v1",
		});

		// Only the current profile was removed
		const remaining = loadCredentialsFile();
		expect(Object.keys(remaining?.profiles ?? {})).toEqual(["beta"]);
		expect(remaining?.current_profile).toBe("beta");
	});

	test("revoke failure still removes the profile locally", async () => {
		mockTryRevokeApiToken.mockImplementation(() =>
			Promise.resolve({ outcome: "failed", message: "boom" }),
		);
		saveCredentialsFile({
			schema_version: 1,
			current_profile: "alpha",
			profiles: { alpha: profile("phak_alpha") },
		});

		const code = await logoutCommand.run({}, makeContext());

		expect(code).toBe(0);
		expect(loadCredentialsFile()).toBeNull();
	});

	test("json output reports whether the token was revoked", async () => {
		saveCredentialsFile({
			schema_version: 1,
			current_profile: "alpha",
			profiles: { alpha: profile("phak_alpha") },
		});

		let payload: unknown;
		const context = makeContext(true);
		context.success = ((data: unknown) => {
			payload = data;
		}) as CommandContext["success"];

		const code = await logoutCommand.run({}, context);

		expect(code).toBe(0);
		expect(payload).toEqual({
			message: "Credentials removed successfully (profile: alpha)",
			profile: "alpha",
			revoked: true,
		});
	});
});
