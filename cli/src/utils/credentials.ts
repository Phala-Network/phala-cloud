import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { logger } from "./logger";

export const DEFAULT_API_PREFIX = "https://cloud-api.phala.com/api/v1";

function getPhalaCloudDir(): string {
	// NOTE: This is intentionally undocumented. It's used for testing and
	// controlled environments.
	const overridden = process.env.PHALA_CLOUD_DIR;
	if (typeof overridden === "string" && overridden.trim().length > 0) {
		return overridden;
	}
	return path.join(os.homedir(), ".phala-cloud");
}

export function getCredentialsFilePath(): string {
	return path.join(getPhalaCloudDir(), "credentials.json");
}

export function getLegacyApiKeyFilePath(): string {
	return path.join(getPhalaCloudDir(), "api-key");
}

function getDockerCredentialsFilePath(): string {
	return path.join(getPhalaCloudDir(), "docker-credentials.json");
}

function ensureDirectoryExists(): void {
	const dir = getPhalaCloudDir();
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function normalizeProfileName(name: string): string {
	// Keep it conservative for file keys.
	const trimmed = name.trim();
	if (trimmed.length === 0) return "default";
	return trimmed;
}

export interface CredentialsWorkspaceInfo {
	/**
	 * Workspace display name (human-readable).
	 */
	readonly name: string;
	/**
	 * Workspace slug (URL-safe identifier).
	 * Used for API calls requiring workspace identification.
	 */
	readonly slug?: string;
}

export interface CredentialsUserInfo {
	readonly username: string;
	readonly email?: string;
}

export interface CredentialsProfileV1 {
	readonly token: string;
	readonly api_prefix: string;
	readonly workspace: CredentialsWorkspaceInfo;
	readonly user: CredentialsUserInfo;
	readonly updated_at: string;
}

export interface CredentialsFileV1 {
	readonly schema_version: 1;
	readonly current_profile: string;
	readonly profiles: Record<string, CredentialsProfileV1>;
}

export function loadCredentialsFile(): CredentialsFileV1 | null {
	try {
		const filePath = getCredentialsFilePath();
		if (!fs.existsSync(filePath)) return null;
		const raw = fs.readFileSync(filePath, "utf8");
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== "object") return null;
		const obj = parsed as Partial<CredentialsFileV1>;
		if (obj.schema_version !== 1) return null;
		if (!isNonEmptyString(obj.current_profile)) return null;
		if (!obj.profiles || typeof obj.profiles !== "object") return null;
		return obj as CredentialsFileV1;
	} catch (error) {
		logger.error("Failed to read credentials file:", error);
		return null;
	}
}

export function saveCredentialsFile(file: CredentialsFileV1): void {
	ensureDirectoryExists();
	fs.writeFileSync(getCredentialsFilePath(), JSON.stringify(file, null, 2), {
		mode: 0o600,
		encoding: "utf8",
	});
}

export type TokenSource = "flag" | "env" | "file" | "none";
export type ApiPrefixSource = "env" | "file" | "default";

export interface ResolvedAuth {
	readonly apiKey: string | null;
	readonly baseURL: string;
	readonly profileName: string;
	readonly tokenSource: TokenSource;
	readonly apiPrefixSource: ApiPrefixSource;
}

export function resolveAuth(options: {
	env: NodeJS.ProcessEnv;
	apiToken?: string;
	profile?: string;
	projectProfile?: string;
}): ResolvedAuth {
	const credentials = loadCredentialsFile();
	const requested = normalizeProfileName(
		options.profile ||
			options.projectProfile ||
			credentials?.current_profile ||
			"default",
	);

	// Backward-compat: older `phala link` wrote workspace.name (e.g.
	// "leechael's projects") into phala.toml `profile = ...` but the
	// canonical key is the workspace slug. If the requested profile key
	// doesn't exist verbatim, try matching workspace.name to recover.
	let selectedProfile = requested;
	if (credentials && !credentials.profiles[selectedProfile]) {
		const matchByName = Object.entries(credentials.profiles).find(
			([, info]) => info?.workspace?.name === requested,
		);
		if (matchByName) {
			selectedProfile = matchByName[0];
		}
	}

	// API prefix resolution: env > profile > default
	const baseURLFromEnv = options.env.PHALA_CLOUD_API_PREFIX;
	const baseURLFromFile = credentials?.profiles?.[selectedProfile]?.api_prefix;
	const baseURL =
		(baseURLFromEnv && baseURLFromEnv.trim().length > 0
			? baseURLFromEnv
			: baseURLFromFile && baseURLFromFile.trim().length > 0
				? baseURLFromFile
				: DEFAULT_API_PREFIX) ?? DEFAULT_API_PREFIX;

	const apiPrefixSource: ApiPrefixSource = baseURLFromEnv
		? "env"
		: baseURLFromFile
			? "file"
			: "default";

	// Token resolution: flag > env > profile
	if (isNonEmptyString(options.apiToken)) {
		return {
			apiKey: options.apiToken,
			baseURL,
			profileName: selectedProfile,
			tokenSource: "flag",
			apiPrefixSource,
		};
	}

	if (isNonEmptyString(options.env.PHALA_CLOUD_API_KEY)) {
		return {
			apiKey: options.env.PHALA_CLOUD_API_KEY,
			baseURL,
			profileName: selectedProfile,
			tokenSource: "env",
			apiPrefixSource,
		};
	}

	const tokenFromFile = credentials?.profiles?.[selectedProfile]?.token;
	if (isNonEmptyString(tokenFromFile)) {
		return {
			apiKey: tokenFromFile,
			baseURL,
			profileName: selectedProfile,
			tokenSource: "file",
			apiPrefixSource,
		};
	}

	return {
		apiKey: null,
		baseURL,
		profileName: selectedProfile,
		tokenSource: "none",
		apiPrefixSource,
	};
}

export function upsertProfile(options: {
	profileName: string;
	token: string;
	apiPrefix?: string;
	workspaceName: string;
	workspaceSlug?: string;
	user: CredentialsUserInfo;
	setCurrent?: boolean;
}): void {
	const profileName = normalizeProfileName(options.profileName);
	const apiPrefix = (options.apiPrefix || DEFAULT_API_PREFIX).trim();

	const current = loadCredentialsFile();
	const shouldSetCurrent = options.setCurrent ?? true;
	const nextCurrentProfile = shouldSetCurrent
		? profileName
		: current?.current_profile || profileName;

	const workspace: CredentialsWorkspaceInfo = options.workspaceSlug
		? {
				name: options.workspaceName,
				slug: options.workspaceSlug,
			}
		: {
				name: options.workspaceName,
			};

	const next: CredentialsFileV1 = {
		schema_version: 1,
		current_profile: nextCurrentProfile,
		profiles: {
			...(current?.profiles || {}),
			[profileName]: {
				token: options.token,
				api_prefix: apiPrefix.length > 0 ? apiPrefix : DEFAULT_API_PREFIX,
				workspace,
				user: options.user,
				updated_at: new Date().toISOString(),
			},
		},
	};

	saveCredentialsFile(next);
}

export function removeProfile(profileName?: string): void {
	const current = loadCredentialsFile();
	if (!current) return;

	const target = normalizeProfileName(profileName || current.current_profile);
	const nextProfiles = { ...current.profiles };
	delete nextProfiles[target];

	const remaining = Object.keys(nextProfiles);
	if (remaining.length === 0) {
		try {
			fs.unlinkSync(getCredentialsFilePath());
		} catch (error) {
			logger.error("Failed to remove credentials file:", error);
		}
		return;
	}

	const nextCurrent =
		current.current_profile === target ? remaining[0] : current.current_profile;
	const next: CredentialsFileV1 = {
		schema_version: 1,
		current_profile: nextCurrent,
		profiles: nextProfiles,
	};
	saveCredentialsFile(next);
}

export function renameProfile(oldName: string, newName: string): void {
	const normalizedOld = normalizeProfileName(oldName);
	const normalizedNew = normalizeProfileName(newName);
	const current = loadCredentialsFile();

	if (!current) {
		throw new Error("No credentials file found. Please login first.");
	}

	if (!current.profiles[normalizedOld]) {
		throw new Error(`Profile "${normalizedOld}" not found`);
	}

	if (current.profiles[normalizedNew]) {
		throw new Error(`Profile "${normalizedNew}" already exists`);
	}

	const nextProfiles = { ...current.profiles };
	nextProfiles[normalizedNew] = nextProfiles[normalizedOld];
	delete nextProfiles[normalizedOld];

	const nextCurrent =
		current.current_profile === normalizedOld
			? normalizedNew
			: current.current_profile;

	saveCredentialsFile({
		...current,
		current_profile: nextCurrent,
		profiles: nextProfiles,
	});
}

export function listProfiles(): string[] {
	const current = loadCredentialsFile();
	if (!current) return [];
	return Object.keys(current.profiles);
}

export function switchProfile(profileName: string): void {
	const normalized = normalizeProfileName(profileName);
	const current = loadCredentialsFile();

	if (!current) {
		throw new Error("No credentials file found. Please login first.");
	}

	if (!current.profiles[normalized]) {
		throw new Error(`Profile "${normalized}" not found`);
	}

	if (current.current_profile === normalized) {
		return;
	}

	saveCredentialsFile({
		...current,
		current_profile: normalized,
	});
}

export function getCurrentProfile(): {
	name: string;
	info: CredentialsProfileV1;
} | null {
	const current = loadCredentialsFile();
	if (!current) return null;

	const profileName = current.current_profile;
	const profileInfo = current.profiles[profileName];

	if (!profileInfo) return null;

	return { name: profileName, info: profileInfo };
}

// Backward-compatible helper (used in a few places)
export function getApiKey(): string | null {
	return resolveAuth({ env: process.env }).apiKey;
}

// Deprecated: compatibility only.
export async function saveApiKey(apiKey: string): Promise<void> {
	upsertProfile({
		profileName: "default",
		token: apiKey,
		workspaceName: "default",
		user: { username: "unknown" },
	});
}

export async function removeApiKey(): Promise<void> {
	removeProfile();
}

// Docker Credentials Management
interface DockerCredentials {
	username: string;
	registry?: string;
}

export async function saveDockerCredentials(
	credentials: DockerCredentials,
): Promise<void> {
	ensureDirectoryExists();
	try {
		fs.writeFileSync(
			getDockerCredentialsFilePath(),
			JSON.stringify(credentials, null, 2),
			{ mode: 0o600 },
		);
		logger.success("Docker information saved successfully.");
	} catch (error) {
		logger.error("Failed to save Docker information:", error);
		throw error;
	}
}

export async function getDockerCredentials(): Promise<DockerCredentials | null> {
	try {
		const filePath = getDockerCredentialsFilePath();
		if (fs.existsSync(filePath)) {
			const data = fs.readFileSync(filePath, "utf8");
			const credentials = JSON.parse(data) as DockerCredentials;
			return credentials;
		}
		return null;
	} catch (error) {
		logger.error("Failed to read Docker credentials:", error);
		return null;
	}
}

export async function removeDockerCredentials(): Promise<void> {
	try {
		const filePath = getDockerCredentialsFilePath();
		if (fs.existsSync(filePath)) {
			fs.unlinkSync(filePath);
			logger.success("Docker credentials removed successfully.");
		} else {
			logger.warn("No Docker credentials found to remove.");
		}
	} catch (error) {
		logger.error("Failed to remove Docker credentials:", error);
		throw error;
	}
}
