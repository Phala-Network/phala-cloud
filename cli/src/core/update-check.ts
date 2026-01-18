import chalk from "chalk";
import semver from "semver";
import { getConfigValue, saveConfig } from "@/src/utils/config";
import {
	detectPackageManager,
	formatGlobalInstallCommand,
	type RuntimeName,
} from "./package-manager";

export interface UpdateNotice {
	readonly message: string;
	readonly currentVersion: string;
	readonly latestVersion: string;
	readonly packageName: string;
}

export type ConfigValue = string | number | boolean | null | undefined;

export interface UpdateCheckConfigStore {
	get(key: string): ConfigValue;
	save(values: Record<string, ConfigValue>): void;
}

export interface CheckForUpdatesOptions {
	readonly executableName: string;
	readonly packageName: string;
	readonly currentVersion: string;
	readonly runtime: RuntimeName;
	readonly env: NodeJS.ProcessEnv;
	readonly isJson: boolean;
	readonly stderrIsTTY: boolean;
	readonly now?: number;
	readonly timeoutMs?: number;
	readonly ttlMs?: number;
	readonly fetchImpl?: FetchLike;
	readonly configStore?: UpdateCheckConfigStore;
}

export type FetchLike = (
	input: string,
	init?: RequestInit,
) => Promise<Response>;

const DEFAULT_TIMEOUT_MS = 200;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

function isTruthyEnv(value: string | undefined): boolean {
	if (!value) return false;
	return value === "1" || value.toLowerCase() === "true";
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function encodeNpmPackageName(packageName: string): string {
	// Scoped packages need / encoded to %2F for the registry URL.
	return packageName.startsWith("@")
		? packageName.replace("/", "%2F")
		: packageName;
}

function getCurrentChannel(currentVersion: string): string | undefined {
	const parsed = semver.parse(currentVersion);
	const pre = parsed?.prerelease?.[0];
	return typeof pre === "string" && pre.length > 0 ? pre : undefined;
}

function resolveChannel(
	currentVersion: string,
	env: NodeJS.ProcessEnv,
	configStore: UpdateCheckConfigStore,
): string {
	if (isNonEmptyString(env.PHALA_UPDATE_CHANNEL))
		return env.PHALA_UPDATE_CHANNEL;
	const configured = configStore.get("updateCheckChannel");
	if (isNonEmptyString(configured)) return configured;
	return getCurrentChannel(currentVersion) ?? "latest";
}

function normalizeChannel(channel: string): string {
	return channel.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function getChannelConfigKey(key: string, channel: string): string {
	return `${key}_${normalizeChannel(channel)}`;
}

function getNumberConfig(
	store: UpdateCheckConfigStore,
	key: string,
): number | undefined {
	const value = store.get(key);
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === "string") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : undefined;
	}
	return undefined;
}

function defaultConfigStore(): UpdateCheckConfigStore {
	return {
		get(key) {
			return getConfigValue(key) as ConfigValue;
		},
		save(values) {
			saveConfig(values);
		},
	};
}

export function getCachedUpdateNotice(
	options: Omit<
		CheckForUpdatesOptions,
		"fetchImpl" | "timeoutMs" | "ttlMs" | "now"
	>,
): UpdateNotice | null {
	const {
		executableName,
		packageName,
		currentVersion,
		runtime,
		env,
		isJson,
		stderrIsTTY,
		configStore = defaultConfigStore(),
	} = options;

	try {
		if (!stderrIsTTY) return null;
		if (isJson) return null;
		if (isTruthyEnv(env.CI)) return null;
		if (isTruthyEnv(env.PHALA_DISABLE_UPDATE_CHECK)) return null;
		if (configStore.get("disableUpdateNotice") === true) return null;

		const currentValid = semver.valid(currentVersion);
		if (!currentValid) return null;

		const channel = resolveChannel(currentVersion, env, configStore);
		const cachedLatestKey = getChannelConfigKey("updateCheckLatest", channel);
		const cachedLatestRaw =
			configStore.get(cachedLatestKey) ??
			(channel === "latest" ? configStore.get("updateCheckLatest") : undefined);
		const cachedLatest =
			typeof cachedLatestRaw === "string"
				? semver.valid(cachedLatestRaw)
				: null;
		if (!cachedLatest || !semver.gt(cachedLatest, currentValid)) {
			return null;
		}

		const packageManager = detectPackageManager(env, runtime);
		const spec =
			channel === "latest"
				? `${packageName}@latest`
				: `${packageName}@${channel}`;
		const installCommand = formatGlobalInstallCommand(packageManager, spec);

		const message = `${[
			chalk.yellow(
				`Update available: v${currentValid} -> v${cachedLatest}${channel === "latest" ? "" : ` (${channel})`}.`,
			),
			chalk.gray(
				`Update with: "${executableName} self update" (or "${installCommand}").`,
			),
			chalk.gray(
				`Disable with: PHALA_DISABLE_UPDATE_CHECK=1 or "${executableName} config set disableUpdateNotice true".`,
			),
		].join("\n")}\n`;
		return {
			message,
			currentVersion: currentValid,
			latestVersion: cachedLatest,
			packageName,
		};
	} catch {
		return null;
	}
}

export async function checkForUpdates(
	options: CheckForUpdatesOptions,
): Promise<UpdateNotice | null> {
	const {
		executableName,
		packageName,
		currentVersion,
		runtime,
		env,
		isJson,
		stderrIsTTY,
		now = Date.now(),
		timeoutMs = DEFAULT_TIMEOUT_MS,
		ttlMs = DEFAULT_TTL_MS,
		fetchImpl = fetch,
		configStore = defaultConfigStore(),
	} = options;

	try {
		if (!stderrIsTTY) return null;
		if (isJson) return null;
		if (isTruthyEnv(env.CI)) return null;
		if (isTruthyEnv(env.PHALA_DISABLE_UPDATE_CHECK)) return null;
		if (configStore.get("disableUpdateNotice") === true) return null;

		const cached = getCachedUpdateNotice({
			executableName,
			packageName,
			currentVersion,
			runtime,
			env,
			isJson,
			stderrIsTTY,
			configStore,
		});
		if (cached) return cached;

		const channel = resolveChannel(currentVersion, env, configStore);
		const lastAtKey = getChannelConfigKey("updateCheckLastAt", channel);
		const lastAt =
			getNumberConfig(configStore, lastAtKey) ??
			(channel === "latest"
				? getNumberConfig(configStore, "updateCheckLastAt")
				: undefined);
		if (lastAt && now - lastAt < ttlMs) {
			return null;
		}

		const encodedName = encodeNpmPackageName(packageName);
		const url = `https://registry.npmjs.org/${encodedName}`;

		const controller = new AbortController();
		const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
		timeoutHandle.unref?.();

		let response: Response | undefined;
		let latestVersion: string | null = null;
		try {
			response = await fetchImpl(url, {
				signal: controller.signal,
				headers: { accept: "application/json" },
			});
			if (!response.ok) return null;

			const body = (await response.json()) as { "dist-tags"?: unknown };
			if (!body || typeof body !== "object") return null;
			const distTags = (body as { "dist-tags"?: unknown })["dist-tags"];
			if (!distTags || typeof distTags !== "object") return null;

			const selected =
				(distTags as Record<string, unknown>)[channel] ??
				(distTags as Record<string, unknown>).latest;
			if (typeof selected !== "string") return null;

			latestVersion = semver.valid(selected);
			const currentValid = semver.valid(currentVersion);
			if (!latestVersion || !currentValid) return null;

			if (!semver.gt(latestVersion, currentValid)) {
				return null;
			}

			const packageManager = detectPackageManager(env, runtime);
			const spec =
				channel === "latest"
					? `${packageName}@latest`
					: `${packageName}@${channel}`;
			const installCommand = formatGlobalInstallCommand(packageManager, spec);

			const message = `${[
				chalk.yellow(
					`Update available: v${currentValid} -> v${latestVersion}${channel === "latest" ? "" : ` (${channel})`}.`,
				),
				chalk.gray(
					`Update with: "${executableName} self update" (or "${installCommand}").`,
				),
				chalk.gray(
					`Disable with: PHALA_DISABLE_UPDATE_CHECK=1 or "${executableName} config set disableUpdateNotice true".`,
				),
			].join("\n")}\n`;

			return {
				message,
				currentVersion: currentValid,
				latestVersion,
				packageName,
			};
		} finally {
			clearTimeout(timeoutHandle);
			const latestKey = getChannelConfigKey("updateCheckLatest", channel);
			configStore.save({
				[lastAtKey]: now,
				...(latestVersion ? { [latestKey]: latestVersion } : {}),
				...(channel === "latest"
					? {
							updateCheckLastAt: now,
							...(latestVersion ? { updateCheckLatest: latestVersion } : {}),
						}
					: {}),
			});
		}
	} catch {
		return null;
	}
}
