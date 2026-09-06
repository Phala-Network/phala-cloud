import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Writable } from "node:stream";

import { migrateStorage } from "./migrate-storage";
import {
	type CredentialsFileV1,
	getCredentialsFilePath,
	getLegacyApiKeyFilePath,
} from "../utils/credentials";
import { getStateFilePath } from "../utils/state";

class CaptureStream extends Writable {
	public chunks: string[] = [];
	_write(
		chunk: Buffer | string | Uint8Array,
		_encoding: BufferEncoding,
		callback: (error?: Error | null) => void,
	) {
		this.chunks.push(Buffer.from(chunk).toString("utf8"));
		callback(null);
	}
	toString(): string {
		return this.chunks.join("");
	}
}

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

function legacyEncrypt(plain: string): string {
	const machineParts = [
		os.hostname(),
		os.platform(),
		os.arch(),
		os.cpus()[0]?.model || "",
		os.userInfo().username,
	];
	const hash = crypto.createHash("sha256");
	hash.update(machineParts.join("|"));
	const key = hash.digest();

	const iv = crypto.randomBytes(16);
	const cipher = crypto.createCipheriv("aes-256-cbc", key.slice(0, 32), iv);
	let encrypted = cipher.update(plain, "utf8", "hex");
	encrypted += cipher.final("hex");
	return `${iv.toString("hex")}:${encrypted}`;
}

describe("migrateStorage", () => {
	let tempHome: string;
	let oldHome: string | undefined;
	let oldApiPrefix: string | undefined;
	let oldCloudDir: string | undefined;

	beforeEach(() => {
		oldHome = process.env.HOME;
		oldApiPrefix = process.env.PHALA_CLOUD_API_PREFIX;
		oldCloudDir = process.env.PHALA_CLOUD_DIR;

		tempHome = makeTempHome();
		process.env.HOME = tempHome;
		process.env.PHALA_CLOUD_DIR = path.join(tempHome, ".phala-cloud");
		setEnv("PHALA_CLOUD_API_PREFIX", undefined);

		fs.mkdirSync(process.env.PHALA_CLOUD_DIR, { recursive: true });
	});

	afterEach(() => {
		setEnv("HOME", oldHome);
		setEnv("PHALA_CLOUD_API_PREFIX", oldApiPrefix);
		setEnv("PHALA_CLOUD_DIR", oldCloudDir);

		cleanupDir(tempHome);
	});

	test("migrates legacy api-key (plain) into credentials.json and deletes legacy file", async () => {
		const legacyPath = getLegacyApiKeyFilePath();
		fs.writeFileSync(legacyPath, "plain-token", { encoding: "utf8" });

		const stderr = new CaptureStream();
		await migrateStorage({
			env: process.env,
			stderr: stderr as unknown as NodeJS.WriteStream,
			fetchCurrentUser: async () => ({
				success: true,
				data: {
					username: "alice",
					email: "a@b.c",
					workspace_name: "Team A",
					workspace_slug: "teamA",
				},
			}),
		});

		expect(fs.existsSync(legacyPath)).toBe(false);

		const credentialsPath = getCredentialsFilePath();
		expect(fs.existsSync(credentialsPath)).toBe(true);
		const parsed = JSON.parse(
			fs.readFileSync(credentialsPath, "utf8"),
		) as CredentialsFileV1;
		expect(parsed.current_profile).toBe("teamA");
		expect(parsed.profiles.teamA.token).toBe("plain-token");
	});

	test("migrates legacy api-key (encrypted) into credentials.json", async () => {
		const legacyPath = getLegacyApiKeyFilePath();
		fs.writeFileSync(legacyPath, legacyEncrypt("enc-token"), {
			encoding: "utf8",
		});

		const stderr = new CaptureStream();
		await migrateStorage({
			env: process.env,
			stderr: stderr as unknown as NodeJS.WriteStream,
			fetchCurrentUser: async () => ({
				success: true,
				data: {
					username: "alice",
					workspace_name: "Team Encrypted",
					workspace_slug: "teamEnc",
				},
			}),
		});

		expect(fs.existsSync(legacyPath)).toBe(false);

		const credentialsPath = getCredentialsFilePath();
		const parsed = JSON.parse(
			fs.readFileSync(credentialsPath, "utf8"),
		) as CredentialsFileV1;
		expect(parsed.current_profile).toBe("teamEnc");
		expect(parsed.profiles.teamEnc.token).toBe("enc-token");
	});

	test("legacy encrypted api-key bad decrypt does not crash and does not delete legacy file", async () => {
		const legacyPath = getLegacyApiKeyFilePath();
		// Looks like legacy encrypted format but should fail to decrypt.
		fs.writeFileSync(legacyPath, `${"0".repeat(32)}:00`, { encoding: "utf8" });

		const stderr = new CaptureStream();
		await migrateStorage({
			env: process.env,
			stderr: stderr as unknown as NodeJS.WriteStream,
			fetchCurrentUser: async () => ({
				success: true,
				data: { username: "alice", workspace_name: "team" },
			}),
		});

		expect(fs.existsSync(getCredentialsFilePath())).toBe(false);
		expect(fs.existsSync(legacyPath)).toBe(true);
		expect(stderr.toString()).toContain(
			"Legacy credentials could not be migrated",
		);
	});

	test("migrates legacy config.json into state.json and deletes legacy config", async () => {
		const cloudDir = process.env.PHALA_CLOUD_DIR as string;
		const legacyConfigPath = path.join(cloudDir, "config.json");
		fs.writeFileSync(
			legacyConfigPath,
			JSON.stringify(
				{
					updateCheckChannel: "latest",
					updateCheckLastAt: 123,
					updateCheckLatest: "1.2.3",
					apiUrl: "https://should-not-migrate",
				},
				null,
				2,
			),
		);

		const stderr = new CaptureStream();
		await migrateStorage({
			env: process.env,
			stderr: stderr as unknown as NodeJS.WriteStream,
		});

		expect(fs.existsSync(legacyConfigPath)).toBe(false);

		const statePath = getStateFilePath();
		expect(fs.existsSync(statePath)).toBe(true);
		const parsed = JSON.parse(fs.readFileSync(statePath, "utf8")) as Record<
			string,
			unknown
		>;
		expect(parsed.updateCheckChannel).toBe("latest");
		expect(parsed.updateCheckLastAt).toBe(123);
		expect(parsed.updateCheckLatest).toBe("1.2.3");
		expect(parsed.apiUrl).toBeUndefined();
	});
});
