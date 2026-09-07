import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
	getCredentialsFilePath,
	getCurrentProfile,
	listProfiles,
	resolveAuth,
	switchProfile,
	upsertProfile,
} from "./credentials";

function makeTempHome(): string {
	return fs.mkdtempSync(path.join(os.tmpdir(), "phala-cli-home-"));
}

function cleanupDir(dir: string): void {
	try {
		fs.rmSync(dir, { recursive: true, force: true });
	} catch {
		// ignore
	}
}

function setEnv(key: string, value: string | undefined): void {
	if (value === undefined) delete process.env[key];
	else process.env[key] = value;
}

describe("credentials", () => {
	let tempHome: string;
	let oldHome: string | undefined;
	let oldApiKey: string | undefined;
	let oldApiPrefix: string | undefined;
	let oldOidc: string | undefined;
	let oldWorkspace: string | undefined;
	let oldCloudDir: string | undefined;

	beforeEach(() => {
		oldHome = process.env.HOME;
		oldApiKey = process.env.PHALA_CLOUD_API_KEY;
		oldApiPrefix = process.env.PHALA_CLOUD_API_PREFIX;
		oldOidc = process.env.PHALA_OIDC_TOKEN;
		oldWorkspace = process.env.PHALA_CLOUD_WORKSPACE;
		oldCloudDir = process.env.PHALA_CLOUD_DIR;

		tempHome = makeTempHome();
		process.env.HOME = tempHome;
		process.env.PHALA_CLOUD_DIR = path.join(tempHome, ".phala-cloud");
		setEnv("PHALA_CLOUD_API_KEY", undefined);
		setEnv("PHALA_CLOUD_API_PREFIX", undefined);
		setEnv("PHALA_OIDC_TOKEN", undefined);
		setEnv("PHALA_CLOUD_WORKSPACE", undefined);
	});

	afterEach(() => {
		setEnv("HOME", oldHome);
		setEnv("PHALA_CLOUD_API_KEY", oldApiKey);
		setEnv("PHALA_CLOUD_API_PREFIX", oldApiPrefix);
		setEnv("PHALA_OIDC_TOKEN", oldOidc);
		setEnv("PHALA_CLOUD_WORKSPACE", oldWorkspace);
		setEnv("PHALA_CLOUD_DIR", oldCloudDir);

		cleanupDir(tempHome);
	});

	test("resolveAuth prioritizes flag > env > file", () => {
		// Prepare file credentials
		upsertProfile({
			profileName: "p1",
			token: "file-token",
			apiPrefix: "https://file.example/api/v1",
			workspaceName: "ws",
			user: { username: "u" },
			setCurrent: true,
		});

		// env wins over file
		process.env.PHALA_CLOUD_API_KEY = "env-token";
		let resolved = resolveAuth({ env: process.env });
		expect(resolved.apiKey).toBe("env-token");
		expect(resolved.tokenSource).toBe("env");

		// flag wins over env
		resolved = resolveAuth({ env: process.env, apiToken: "flag-token" });
		expect(resolved.apiKey).toBe("flag-token");
		expect(resolved.tokenSource).toBe("flag");
	});

	test("resolveAuth uses explicit profile over projectProfile and current_profile", () => {
		upsertProfile({
			profileName: "a",
			token: "token-a",
			apiPrefix: "https://a.example/api/v1",
			workspaceName: "a",
			user: { username: "u" },
			setCurrent: true,
		});
		upsertProfile({
			profileName: "b",
			token: "token-b",
			apiPrefix: "https://b.example/api/v1",
			workspaceName: "b",
			user: { username: "u" },
			setCurrent: false,
		});

		const resolved = resolveAuth({
			env: process.env,
			profile: "b",
			projectProfile: "a",
		});
		expect(resolved.profileName).toBe("b");
		expect(resolved.apiKey).toBe("token-b");
		expect(resolved.baseURL).toBe("https://b.example/api/v1");
	});

	test("resolveAuth uses projectProfile over current_profile", () => {
		upsertProfile({
			profileName: "a",
			token: "token-a",
			apiPrefix: "https://a.example/api/v1",
			workspaceName: "a",
			user: { username: "u" },
			setCurrent: true,
		});
		upsertProfile({
			profileName: "b",
			token: "token-b",
			apiPrefix: "https://b.example/api/v1",
			workspaceName: "b",
			user: { username: "u" },
			setCurrent: false,
		});

		const resolved = resolveAuth({ env: process.env, projectProfile: "b" });
		expect(resolved.profileName).toBe("b");
		expect(resolved.apiKey).toBe("token-b");
		expect(resolved.baseURL).toBe("https://b.example/api/v1");
	});

	test("api prefix resolution: env > profile > default", () => {
		upsertProfile({
			profileName: "p",
			token: "t",
			apiPrefix: "https://profile.example/api/v1",
			workspaceName: "p",
			user: { username: "u" },
			setCurrent: true,
		});

		let resolved = resolveAuth({ env: process.env });
		expect(resolved.baseURL).toBe("https://profile.example/api/v1");
		expect(resolved.apiPrefixSource).toBe("file");

		process.env.PHALA_CLOUD_API_PREFIX = "https://env.example/api/v1";
		resolved = resolveAuth({ env: process.env });
		expect(resolved.baseURL).toBe("https://env.example/api/v1");
		expect(resolved.apiPrefixSource).toBe("env");
	});

	test("upsertProfile persists credentials.json with schema_version=1", () => {
		upsertProfile({
			profileName: "team",
			token: "tok",
			workspaceName: "team",
			user: { username: "alice", email: "alice@example.com" },
			setCurrent: true,
		});

		const filePath = getCredentialsFilePath();
		expect(fs.existsSync(filePath)).toBe(true);

		const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
			schema_version: number;
			current_profile: string;
			profiles: Record<string, { token: string; api_prefix: string }>;
		};
		expect(parsed.schema_version).toBe(1);
		expect(parsed.current_profile).toBe("team");
		expect(parsed.profiles.team.token).toBe("tok");
	});

	test("listProfiles returns empty array when no credentials", () => {
		expect(listProfiles()).toEqual([]);
	});

	test("listProfiles returns all profile names", () => {
		upsertProfile({
			profileName: "a",
			token: "t-a",
			workspaceName: "ws-a",
			user: { username: "u" },
			setCurrent: true,
		});
		upsertProfile({
			profileName: "b",
			token: "t-b",
			workspaceName: "ws-b",
			user: { username: "u" },
			setCurrent: false,
		});

		const profiles = listProfiles();
		expect(profiles).toContain("a");
		expect(profiles).toContain("b");
		expect(profiles).toHaveLength(2);
	});

	test("switchProfile changes current_profile", () => {
		upsertProfile({
			profileName: "first",
			token: "t1",
			workspaceName: "ws1",
			user: { username: "u" },
			setCurrent: true,
		});
		upsertProfile({
			profileName: "second",
			token: "t2",
			workspaceName: "ws2",
			user: { username: "u" },
			setCurrent: false,
		});

		expect(getCurrentProfile()?.name).toBe("first");
		switchProfile("second");
		expect(getCurrentProfile()?.name).toBe("second");
	});

	test("switchProfile throws when no credentials file", () => {
		expect(() => switchProfile("any")).toThrow(
			"No credentials file found. Please login first.",
		);
	});

	test("switchProfile throws when profile not found", () => {
		upsertProfile({
			profileName: "existing",
			token: "t",
			workspaceName: "ws",
			user: { username: "u" },
			setCurrent: true,
		});

		expect(() => switchProfile("nonexistent")).toThrow(
			'Profile "nonexistent" not found',
		);
	});

	test("switchProfile is no-op when already on target profile", () => {
		upsertProfile({
			profileName: "current",
			token: "t",
			workspaceName: "ws",
			user: { username: "u" },
			setCurrent: true,
		});

		const before = fs.statSync(getCredentialsFilePath()).mtimeMs;
		switchProfile("current");
		const after = fs.statSync(getCredentialsFilePath()).mtimeMs;
		expect(after).toBe(before);
	});

	test("getCurrentProfile returns null when no credentials", () => {
		expect(getCurrentProfile()).toBeNull();
	});

	test("getCurrentProfile returns current profile info", () => {
		upsertProfile({
			profileName: "myprofile",
			token: "tok",
			workspaceName: "my-ws",
			user: { username: "alice" },
			setCurrent: true,
		});

		const profile = getCurrentProfile();
		expect(profile).not.toBeNull();
		expect(profile?.name).toBe("myprofile");
		expect(profile?.info.token).toBe("tok");
		expect(profile?.info.workspace.name).toBe("my-ws");
	});

	test("switchProfile normalizes whitespace in profile name", () => {
		upsertProfile({
			profileName: "trimmed",
			token: "t",
			workspaceName: "ws",
			user: { username: "u" },
			setCurrent: false,
		});
		upsertProfile({
			profileName: "other",
			token: "t2",
			workspaceName: "ws2",
			user: { username: "u" },
			setCurrent: true,
		});

		switchProfile("  trimmed  ");
		expect(getCurrentProfile()?.name).toBe("trimmed");
	});
	test("resolveAuth falls back to PHALA_OIDC_TOKEN when no API key", () => {
		process.env.PHALA_OIDC_TOKEN = "oidc-jwt";
		process.env.PHALA_CLOUD_WORKSPACE = "acme-ws";
		const resolved = resolveAuth({ env: process.env });
		expect(resolved.apiKey).toBeNull();
		expect(resolved.bearerToken).toBe("oidc-jwt");
		expect(resolved.workspace).toBe("acme-ws");
		expect(resolved.tokenSource).toBe("oidc_env");
	});

	test("resolveAuth prefers API key over OIDC token", () => {
		process.env.PHALA_CLOUD_API_KEY = "env-token";
		process.env.PHALA_OIDC_TOKEN = "oidc-jwt";
		const resolved = resolveAuth({ env: process.env });
		expect(resolved.apiKey).toBe("env-token");
		expect(resolved.bearerToken).toBeNull();
		expect(resolved.tokenSource).toBe("env");
	});
});
