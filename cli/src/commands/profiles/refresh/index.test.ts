import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CommandContext } from "@/src/core/types";
import type { RevokeTokenResult } from "@/src/lib/client";

const mockTryRevokeApiToken = mock(
	(): Promise<RevokeTokenResult> => Promise.resolve({ outcome: "revoked" }),
);
const mockRunDeviceAuthFlow = mock(() => Promise.resolve("phak_newtoken"));
const mockValidateApiKey = mock(() =>
	Promise.resolve({
		user: { username: "alice", email: "alice@example.test" },
		workspace: { name: "Alpha WS", slug: "alpha-ws" },
	}),
);
const mockPromptForApiKey = mock(() =>
	Promise.resolve({
		apiKey: "phak_manualtoken",
		user: {
			user: { username: "alice", email: "alice@example.test" },
			workspace: { name: "Alpha WS", slug: "alpha-ws" },
		},
	}),
);

mock.module("@/src/lib/client", () => ({
	tryRevokeApiToken: mockTryRevokeApiToken,
}));

mock.module("@/src/commands/login", () => ({
	runDeviceAuthFlow: mockRunDeviceAuthFlow,
	validateApiKey: mockValidateApiKey,
	promptForApiKey: mockPromptForApiKey,
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

const { profilesRefreshCommand } = await import("./index");
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
		workspace: { name: "Alpha WS", slug: "alpha-ws" },
		user: { username: "alice" },
		updated_at: "2026-01-01T00:00:00.000Z",
	};
}

describe("profiles refresh command", () => {
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
		mockRunDeviceAuthFlow.mockClear();
		mockValidateApiKey.mockClear();
		mockPromptForApiKey.mockClear();
	});

	afterEach(() => {
		if (oldDir === undefined) {
			process.env.PHALA_CLOUD_DIR = undefined;
		} else {
			process.env.PHALA_CLOUD_DIR = oldDir;
		}
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	test("fails when the profile does not exist", async () => {
		const code = await profilesRefreshCommand.run(
			{ profileName: "nope" },
			makeContext(),
		);

		expect(code).toBe(1);
		expect(mockRunDeviceAuthFlow).not.toHaveBeenCalled();
	});

	test("defaults to the current profile when no name is given", async () => {
		saveCredentialsFile({
			schema_version: 1,
			current_profile: "alpha",
			profiles: { alpha: profile("phak_oldtoken"), beta: profile("phak_beta") },
		});

		const code = await profilesRefreshCommand.run({}, makeContext());

		expect(code).toBe(0);
		const saved = loadCredentialsFile();
		expect(saved?.profiles.alpha.token).toBe("phak_newtoken");
		expect(saved?.profiles.beta.token).toBe("phak_beta");
		expect(saved?.current_profile).toBe("alpha");
	});

	test("fails when no name is given and there is no current profile", async () => {
		const code = await profilesRefreshCommand.run({}, makeContext());

		expect(code).toBe(1);
		expect(mockRunDeviceAuthFlow).not.toHaveBeenCalled();
	});

	test("passes the profile workspace slug to the device flow", async () => {
		saveCredentialsFile({
			schema_version: 1,
			current_profile: "alpha",
			profiles: { alpha: profile("phak_oldtoken") },
		});

		const code = await profilesRefreshCommand.run(
			{ profileName: "alpha" },
			makeContext(),
		);

		expect(code).toBe(0);
		expect(mockRunDeviceAuthFlow).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ workspaceSlug: "alpha-ws" }),
		);
	});

	test("refuses to save a token bound to a different workspace", async () => {
		mockValidateApiKey.mockImplementationOnce(() =>
			Promise.resolve({
				user: { username: "alice", email: "alice@example.test" },
				workspace: { name: "Other WS", slug: "other-ws" },
			}),
		);
		saveCredentialsFile({
			schema_version: 1,
			current_profile: "alpha",
			profiles: { alpha: profile("phak_oldtoken") },
		});

		const code = await profilesRefreshCommand.run(
			{ profileName: "alpha" },
			makeContext(),
		);

		expect(code).toBe(1);
		// Profile untouched: still holds the old token
		expect(loadCredentialsFile()?.profiles.alpha.token).toBe("phak_oldtoken");
	});

	test("revokes the old token, then stores the new one", async () => {
		saveCredentialsFile({
			schema_version: 1,
			current_profile: "alpha",
			profiles: { alpha: profile("phak_oldtoken") },
		});

		const code = await profilesRefreshCommand.run(
			{ profileName: "alpha" },
			makeContext(),
		);

		expect(code).toBe(0);

		// Old token revoked first
		expect(mockTryRevokeApiToken).toHaveBeenCalledTimes(1);
		expect(mockTryRevokeApiToken).toHaveBeenCalledWith({
			apiKey: "phak_oldtoken",
			baseURL: "https://example.test/api/v1",
		});
		expect(mockTryRevokeApiToken.mock.invocationCallOrder[0]).toBeLessThan(
			mockRunDeviceAuthFlow.mock.invocationCallOrder[0],
		);

		const saved = loadCredentialsFile();
		expect(saved?.profiles.alpha.token).toBe("phak_newtoken");
		expect(saved?.profiles.alpha.user.username).toBe("alice");
		expect(saved?.current_profile).toBe("alpha");
	});

	test("refreshing a non-current profile keeps the current profile", async () => {
		saveCredentialsFile({
			schema_version: 1,
			current_profile: "beta",
			profiles: { alpha: profile("phak_oldtoken"), beta: profile("phak_beta") },
		});

		const code = await profilesRefreshCommand.run(
			{ profileName: "alpha" },
			makeContext(),
		);

		expect(code).toBe(0);
		const saved = loadCredentialsFile();
		expect(saved?.profiles.alpha.token).toBe("phak_newtoken");
		expect(saved?.profiles.beta.token).toBe("phak_beta");
		expect(saved?.current_profile).toBe("beta");
	});

	test("proceeds even when the old token is already invalid", async () => {
		mockTryRevokeApiToken.mockImplementation(() =>
			Promise.resolve({ outcome: "already-invalid" }),
		);
		saveCredentialsFile({
			schema_version: 1,
			current_profile: "alpha",
			profiles: { alpha: profile("phak_deadtoken") },
		});

		const code = await profilesRefreshCommand.run(
			{ profileName: "alpha" },
			makeContext(),
		);

		expect(code).toBe(0);
		expect(loadCredentialsFile()?.profiles.alpha.token).toBe("phak_newtoken");
	});

	test("--manual uses the prompt instead of the device flow", async () => {
		saveCredentialsFile({
			schema_version: 1,
			current_profile: "alpha",
			profiles: { alpha: profile("phak_oldtoken") },
		});

		const code = await profilesRefreshCommand.run(
			{ profileName: "alpha", manual: true },
			makeContext(),
		);

		expect(code).toBe(0);
		expect(mockPromptForApiKey).toHaveBeenCalledTimes(1);
		expect(mockRunDeviceAuthFlow).not.toHaveBeenCalled();
		expect(loadCredentialsFile()?.profiles.alpha.token).toBe(
			"phak_manualtoken",
		);
	});
});
