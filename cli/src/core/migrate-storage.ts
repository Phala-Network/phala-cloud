import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createClient, safeGetCurrentUser } from "@phala/cloud";
import { CLI_USER_AGENT } from "@/src/utils/cli-version";

import {
	DEFAULT_API_PREFIX,
	getCredentialsFilePath,
	getLegacyApiKeyFilePath,
	upsertProfile,
} from "@/src/utils/credentials";
import { getStateFilePath, loadState, saveState } from "@/src/utils/state";

function getPhalaCloudDir(): string {
	const overridden = process.env.PHALA_CLOUD_DIR;
	if (typeof overridden === "string" && overridden.trim().length > 0) {
		return overridden;
	}
	return path.join(os.homedir(), ".phala-cloud");
}

function getLegacyConfigFilePath(): string {
	return path.join(getPhalaCloudDir(), "config.json");
}

function isHex(str: string): boolean {
	return /^[0-9a-fA-F]+$/.test(str);
}

function isLikelyLegacyEncrypted(value: string): boolean {
	const trimmed = value.trim();
	const parts = trimmed.split(":");
	if (parts.length !== 2) return false;
	const [iv, cipher] = parts;
	return iv.length === 32 && isHex(iv) && cipher.length > 0 && isHex(cipher);
}

// Legacy machine-key encryption (migration only).
// TODO: Remove this legacy decrypt logic after sufficient deprecation window.
function getMachineKey(): Buffer {
	const machineParts = [
		os.hostname(),
		os.platform(),
		os.arch(),
		os.cpus()[0]?.model || "",
		os.userInfo().username,
	];

	const hash = crypto.createHash("sha256");
	hash.update(machineParts.join("|"));
	return hash.digest();
}

function legacyDecrypt(encryptedText: string): string {
	const key = getMachineKey();
	const parts = encryptedText.trim().split(":");
	if (parts.length !== 2) throw new Error("Invalid legacy encrypted format");
	const iv = Buffer.from(parts[0], "hex");
	const encrypted = parts[1];

	const decipher = crypto.createDecipheriv("aes-256-cbc", key.slice(0, 32), iv);
	let decrypted = decipher.update(encrypted, "hex", "utf8");
	decrypted += decipher.final("utf8");
	return decrypted;
}

function safeUnlink(filePath: string): void {
	try {
		fs.unlinkSync(filePath);
	} catch {
		// ignore
	}
}

function pickMigratableConfigKeys(
	config: Record<string, unknown>,
): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(config)) {
		if (
			key === "disableUpdateNotice" ||
			key === "updateCheckChannel" ||
			key === "updateCheckLastAt" ||
			key === "updateCheckLatest" ||
			key.startsWith("updateCheckLastAt_") ||
			key.startsWith("updateCheckLatest_")
		) {
			result[key] = value;
		}
	}
	return result;
}

export interface CurrentUserInfo {
	readonly username?: string;
	readonly email?: string;
	readonly workspace_name?: string;
	readonly workspace_slug?: string;
}

export type FetchCurrentUser = (options: {
	readonly token: string;
	readonly baseURL: string;
}) => Promise<{ success: true; data: CurrentUserInfo } | { success: false }>;

function defaultFetchCurrentUser(): FetchCurrentUser {
	return async ({ token, baseURL }) => {
		const client = createClient({
			apiKey: token,
			baseURL,
			headers: { "User-Agent": CLI_USER_AGENT },
		});
		const result = await safeGetCurrentUser(client);
		if (!result.success) return { success: false };
		return {
			success: true,
			data: {
				username: result.data.user.username,
				email: result.data.user.email,
				workspace_name: result.data.workspace.name,
				workspace_slug: result.data.workspace.slug || undefined,
			},
		};
	};
}

export async function migrateStorage(options: {
	readonly env: NodeJS.ProcessEnv;
	readonly stderr: NodeJS.WriteStream;
	readonly fetchCurrentUser?: FetchCurrentUser;
}): Promise<void> {
	await migrateLegacyCredentials(options);
	await migrateLegacyConfig(options);
}

async function migrateLegacyCredentials(options: {
	readonly env: NodeJS.ProcessEnv;
	readonly stderr: NodeJS.WriteStream;
	readonly fetchCurrentUser?: FetchCurrentUser;
}): Promise<void> {
	const credentialsPath = getCredentialsFilePath();
	if (fs.existsSync(credentialsPath)) {
		// New file exists, cleanup legacy file if present.
		const legacyFile = getLegacyApiKeyFilePath();
		if (fs.existsSync(legacyFile)) {
			safeUnlink(legacyFile);
		}
		return;
	}

	const legacyFile = getLegacyApiKeyFilePath();
	if (!fs.existsSync(legacyFile)) return;

	const raw = fs.readFileSync(legacyFile, "utf8").trim();
	if (!raw) return;

	let token: string;
	try {
		token = isLikelyLegacyEncrypted(raw) ? legacyDecrypt(raw) : raw;
	} catch {
		options.stderr.write(
			"Legacy credentials could not be migrated (possibly due to machine change). Please run 'phala login' again.\n",
		);
		return;
	}

	const baseURL = options.env.PHALA_CLOUD_API_PREFIX || DEFAULT_API_PREFIX;
	const fetchCurrentUser =
		options.fetchCurrentUser ?? defaultFetchCurrentUser();

	try {
		const result = await fetchCurrentUser({ token, baseURL });
		if (!result.success) {
			options.stderr.write(
				"Legacy credentials appear invalid or expired. Please run 'phala login' again.\n",
			);
			return;
		}

		const user = result.data;
		const workspaceName = user.workspace_name || "default";
		const workspaceSlug = user.workspace_slug;
		const profileName = workspaceSlug || "default";

		upsertProfile({
			profileName,
			token,
			apiPrefix: baseURL,
			workspaceName,
			workspaceSlug,
			user: {
				username: user.username || "unknown",
				email: user.email,
			},
			setCurrent: true,
		});

		safeUnlink(legacyFile);
		options.stderr.write(
			`Migrated legacy credentials into ${credentialsPath} (profile: ${profileName}).\n`,
		);
	} catch {
		options.stderr.write(
			"Legacy credentials could not be migrated. Please run 'phala login' again.\n",
		);
	}
}

async function migrateLegacyConfig(options: {
	readonly env: NodeJS.ProcessEnv;
	readonly stderr: NodeJS.WriteStream;
}): Promise<void> {
	const statePath = getStateFilePath();
	const legacyConfigPath = getLegacyConfigFilePath();
	if (!fs.existsSync(legacyConfigPath)) return;

	try {
		const raw = fs.readFileSync(legacyConfigPath, "utf8");
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== "object") {
			safeUnlink(legacyConfigPath);
			return;
		}

		const migratable = pickMigratableConfigKeys(
			parsed as Record<string, unknown>,
		);
		if (Object.keys(migratable).length > 0) {
			const currentState = loadState();
			saveState({
				...currentState,
				...(migratable as Record<
					string,
					string | number | boolean | null | undefined
				>),
			});
			options.stderr.write(`Migrated legacy config into ${statePath}.\n`);
		}

		safeUnlink(legacyConfigPath);
	} catch {
		// If config is corrupt, just remove it to avoid repeated parsing attempts.
		safeUnlink(legacyConfigPath);
	}
}
