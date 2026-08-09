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

const { profilesDeleteCommand } = await import("./index");
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

describe("profiles delete command", () => {
	let tempDir: string;
	let oldDir: string | undefined;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "phala-cli-test-"));
		oldDir = process.env.PHALA_CLOUD_DIR;
		process.env.PHALA_CLOUD_DIR = tempDir;
		mockTryRevokeApiToken.mockClear();
		mockTryRevokeApiToken.mockImplementation(() =>
			Promise.resolve({ outcome: "revoked" }),
		);
	});

	afterEach(() => {
		if (oldDir === undefined) {
			process.env.PHALA_CLOUD_DIR = undefined;
		} else {
			process.env.PHALA_CLOUD_DIR = oldDir;
		}
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	test("deletes multiple profiles and reports the active switch", async () => {
		saveCredentialsFile({
			schema_version: 1,
			current_profile: "alpha",
			profiles: {
				alpha: profile("phak_alpha"),
				beta: profile("phak_beta"),
				gamma: profile("phak_gamma"),
			},
		});

		const code = await profilesDeleteCommand.run(
			{ profileNames: ["alpha", "beta"] },
			makeContext(),
		);

		expect(code).toBe(0);
		const remaining = loadCredentialsFile();
		expect(Object.keys(remaining?.profiles ?? {})).toEqual(["gamma"]);
		expect(remaining?.current_profile).toBe("gamma");

		// Revocation attempted once per deleted profile with its own token
		expect(mockTryRevokeApiToken).toHaveBeenCalledTimes(2);
		expect(mockTryRevokeApiToken).toHaveBeenCalledWith({
			apiKey: "phak_alpha",
			baseURL: "https://example.test/api/v1",
		});
		expect(mockTryRevokeApiToken).toHaveBeenCalledWith({
			apiKey: "phak_beta",
			baseURL: "https://example.test/api/v1",
		});
	});

	test("fails fast when any name is unknown and deletes nothing", async () => {
		saveCredentialsFile({
			schema_version: 1,
			current_profile: "alpha",
			profiles: { alpha: profile("phak_alpha"), beta: profile("phak_beta") },
		});

		const code = await profilesDeleteCommand.run(
			{ profileNames: ["alpha", "nope"] },
			makeContext(),
		);

		expect(code).toBe(1);
		const remaining = loadCredentialsFile();
		expect(Object.keys(remaining?.profiles ?? {})).toEqual(["alpha", "beta"]);
		expect(remaining?.current_profile).toBe("alpha");
		expect(mockTryRevokeApiToken).not.toHaveBeenCalled();
	});

	test("revoke failure still removes the profile locally", async () => {
		mockTryRevokeApiToken.mockImplementation(() =>
			Promise.resolve({ outcome: "failed", message: "boom" }),
		);
		saveCredentialsFile({
			schema_version: 1,
			current_profile: "alpha",
			profiles: { alpha: profile("phak_alpha"), beta: profile("phak_beta") },
		});

		const code = await profilesDeleteCommand.run(
			{ profileNames: ["alpha"] },
			makeContext(),
		);

		expect(code).toBe(0);
		const remaining = loadCredentialsFile();
		expect(Object.keys(remaining?.profiles ?? {})).toEqual(["beta"]);
	});

	test("json output reports deleted and revoked sets", async () => {
		saveCredentialsFile({
			schema_version: 1,
			current_profile: "alpha",
			profiles: { alpha: profile("phak_alpha"), beta: profile("phak_beta") },
		});

		let payload: unknown;
		const context = makeContext(true);
		context.success = ((data: unknown) => {
			payload = data;
		}) as CommandContext["success"];

		const code = await profilesDeleteCommand.run(
			{ profileNames: ["alpha", "beta"] },
			context,
		);

		expect(code).toBe(0);
		expect(payload).toEqual({
			deleted: ["alpha", "beta"],
			revoked: ["alpha", "beta"],
			revokeSkipped: [],
			wasActive: true,
			currentProfile: null,
		});
	});
});
