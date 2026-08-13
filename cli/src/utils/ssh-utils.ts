import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { basename, join } from "node:path";
import type { ApiVersion, Client } from "@phala/cloud";
import chalk from "chalk";
import { logger } from "./logger";

/**
 * SHA256 fingerprint of an OpenSSH public key line, in the format
 * `ssh-keygen -lf` and GitHub display.
 *
 * The fingerprint covers the base64-decoded wire-format key blob, not the
 * textual line, so it is independent of the trailing comment. Returns
 * undefined when the line is not a well-formed public key: the blob carries
 * its own algorithm name, and a blob whose name disagrees with the line's
 * first field is not something we should print a fingerprint for.
 */
export function sshKeyFingerprint(publicKeyLine: string): string | undefined {
	const [keyType, blob] = publicKeyLine.trim().split(/\s+/);
	if (!keyType || !blob) {
		return undefined;
	}

	const decoded = Buffer.from(blob, "base64");
	if (decoded.length < 4) {
		return undefined;
	}

	const nameLength = decoded.readUInt32BE(0);
	if (nameLength === 0 || decoded.length < 4 + nameLength) {
		return undefined;
	}
	if (decoded.subarray(4, 4 + nameLength).toString("utf-8") !== keyType) {
		return undefined;
	}

	const digest = createHash("sha256").update(decoded).digest("base64");
	return `SHA256:${digest.replace(/=+$/, "")}`;
}

/**
 * Custom error for CVM not running
 */
export class CvmNotRunningError extends Error {
	constructor(
		public readonly status: string,
		public readonly cvmId: string,
	) {
		super(`CVM is not running (current status: ${chalk.yellow(status)})`);
		this.name = "CvmNotRunningError";
	}
}

/**
 * Custom error for missing gateway
 */
export class NoGatewayError extends Error {
	constructor(public readonly cvmId: string) {
		super("CVM is not registered on any gateway.");
		this.name = "NoGatewayError";
	}
}

/**
 * Parsed gateway domain (hostname and optional port)
 */
export type Gateway = { host: string; port?: string };

/**
 * Parse gateway domain to extract hostname and port
 * Examples: "example.com" -> { host: "example.com" }
 *           "example.com:8443" -> { host: "example.com", port: "8443" }
 */
export function parseGatewayDomain(gatewayDomain: string): Gateway {
	const lastColonIndex = gatewayDomain.lastIndexOf(":");
	if (lastColonIndex > 0) {
		const potentialPort = gatewayDomain.substring(lastColonIndex + 1);
		if (/^\d+$/.test(potentialPort)) {
			return {
				host: gatewayDomain.substring(0, lastColonIndex),
				port: potentialPort,
			};
		}
	}
	return { host: gatewayDomain };
}

/**
 * Find default SSH private key file
 */
export function findDefaultSshKey(): string | undefined {
	const defaultKeys = [
		join(homedir(), ".ssh", "id_rsa"),
		join(homedir(), ".ssh", "id_ed25519"),
		join(homedir(), ".ssh", "id_ecdsa"),
		join(homedir(), ".ssh", "id_dsa"),
	];

	for (const key of defaultKeys) {
		if (existsSync(key)) {
			return key;
		}
	}

	return undefined;
}

/**
 * Get SSH key file - either user-specified or default
 * Throws if specified key doesn't exist
 */
export function getSshKeyFile(specifiedKey?: string): string | undefined {
	if (specifiedKey) {
		// Expand ~ to home directory
		const resolvedPath = specifiedKey.startsWith("~")
			? join(homedir(), specifiedKey.slice(1))
			: specifiedKey;

		if (!existsSync(resolvedPath)) {
			throw new Error(`SSH key file not found: ${resolvedPath}`);
		}
		return resolvedPath;
	}

	return findDefaultSshKey();
}

/**
 * Check if the base image is a dev image (contains "dev" in the name)
 */
export function isDevImage(baseImage: string | null | undefined): boolean {
	if (!baseImage) {
		return false;
	}
	return baseImage.toLowerCase().includes("dev");
}

function resolveGatewayDomain(cvm: unknown): string | undefined {
	if (!cvm || typeof cvm !== "object") {
		return undefined;
	}

	// Legacy: gateway_domain: string | null
	if ("gateway_domain" in cvm) {
		const legacy = (cvm as { gateway_domain?: unknown }).gateway_domain;
		return typeof legacy === "string" && legacy.length > 0 ? legacy : undefined;
	}

	// New: gateway: { base_domain?: string | null }
	const gateway = (cvm as { gateway?: unknown }).gateway;
	if (gateway && typeof gateway === "object") {
		const baseDomain = (gateway as { base_domain?: unknown }).base_domain;
		if (typeof baseDomain === "string" && baseDomain.length > 0) {
			return baseDomain;
		}
	}

	return undefined;
}

function resolveBaseImageAndDevFlag(cvm: unknown): {
	baseImage?: string;
	isDev?: boolean;
} {
	if (!cvm || typeof cvm !== "object") {
		return {};
	}

	// Legacy: base_image: string | null
	if ("base_image" in cvm) {
		const baseImage = (cvm as { base_image?: unknown }).base_image;
		return {
			baseImage: typeof baseImage === "string" ? baseImage : undefined,
			isDev: typeof baseImage === "string" ? isDevImage(baseImage) : undefined,
		};
	}

	// New: os: { name?: string | null; is_dev?: boolean | null }
	const os = (cvm as { os?: unknown }).os;
	if (os && typeof os === "object") {
		const name = (os as { name?: unknown }).name;
		const isDev = (os as { is_dev?: unknown }).is_dev;
		return {
			baseImage: typeof name === "string" ? name : undefined,
			isDev: typeof isDev === "boolean" ? isDev : undefined,
		};
	}

	return {};
}

function resolveInstanceId(
	cvm: unknown,
	fallbackCvmId: string,
): string | undefined {
	if (cvm && typeof cvm === "object" && "app_id" in cvm) {
		const appId = (cvm as { app_id?: unknown }).app_id;
		if (typeof appId === "string" && appId.length > 0) {
			return appId.startsWith("app_") ? appId.slice(4) : appId;
		}
	}

	if (fallbackCvmId.startsWith("app_")) {
		return fallbackCvmId.slice(4);
	}

	// 40-char hex (unprefixed app_id)
	if (/^[0-9a-f]{40}$/i.test(fallbackCvmId)) {
		return fallbackCvmId;
	}

	return undefined;
}

/**
 * Fetch CVM info from API and validate it's ready for connection
 * @throws {NoGatewayError} if CVM has no gateway
 * @throws {CvmNotRunningError} if CVM is not running
 */
export async function fetchCvmInfo<V extends ApiVersion>(
	client: Client<V>,
	cvmId: string,
) {
	const cvm = await client.getCvmInfo({ id: cvmId });

	const gatewayDomain = resolveGatewayDomain(cvm);
	if (!gatewayDomain) {
		throw new NoGatewayError(cvmId);
	}

	if (cvm.status !== "running") {
		throw new CvmNotRunningError(cvm.status, cvmId);
	}

	const { baseImage, isDev } = resolveBaseImageAndDevFlag(cvm);
	const instanceId = resolveInstanceId(cvm, cvmId);
	if (!instanceId) {
		throw new Error("CVM does not have an app_id usable for gateway SSH/SCP.");
	}

	return {
		appId: instanceId,
		gatewayDomain,
		status: cvm.status,
		baseImage,
		isDevImage: isDev,
	};
}

/**
 * Build hostname for SSH/SCP connection
 * Format: {instanceId}-22.{gatewayHost}
 */
export function buildHostname(instanceId: string, gatewayHost: string): string {
	return `${instanceId}-22.${gatewayHost}`;
}

/**
 * Select port with priority: user-specified > gateway port > default
 */
export function selectPort(
	requestedPort: string,
	gatewayPort: string | undefined,
): string {
	// If user explicitly specified a non-default port, use it
	if (requestedPort !== "443") {
		return requestedPort;
	}
	// Otherwise prefer gateway's port if available
	return gatewayPort || "443";
}

/**
 * Escape a string for safe use in shell commands.
 * Uses single quotes and escapes any embedded single quotes.
 */
export function shellEscape(arg: string): string {
	// If the arg contains no special characters, return as-is
	if (/^[a-zA-Z0-9_./:@=-]+$/.test(arg)) {
		return arg;
	}
	// Escape single quotes by ending the quoted string, adding escaped quote, and resuming
	// e.g., "it's" becomes 'it'\''s'
	return `'${arg.replace(/'/g, "'\\''")}'`;
}

/**
 * Check if the system openssl is LibreSSL
 */
export function isLibreSSL(): boolean {
	try {
		const output = execSync("openssl version", { encoding: "utf-8" });
		return output.toLowerCase().includes("libressl");
	} catch {
		return false;
	}
}

/**
 * Check if a key file is an ed25519 key
 */
export function isEd25519Key(keyPath: string): boolean {
	const keyName = basename(keyPath).toLowerCase();
	if (keyName.includes("ed25519")) {
		return true;
	}

	try {
		const content = readFileSync(keyPath, "utf-8");
		// Check for ed25519 in the key content (OpenSSH format)
		return content.includes("ssh-ed25519") || content.includes("ED25519");
	} catch {
		return false;
	}
}

/**
 * Check for LibreSSL + ed25519 compatibility issue on macOS
 * and warn the user if detected
 */
export function checkLibreSSLEd25519Compatibility(keyPath: string): void {
	if (platform() !== "darwin") {
		return;
	}

	if (!isLibreSSL()) {
		return;
	}

	if (!isEd25519Key(keyPath)) {
		return;
	}

	logger.warn(
		"Detected LibreSSL with ed25519 key on macOS. This combination may cause SSH connection issues.",
	);
	logger.info(
		`If·you·experience·problems,·install·OpenSSL·via·Homebrew:·${chalk.cyan("brew·install·openssl")}`,
	);
	logger.info("Then ensure Homebrew's OpenSSL is in your PATH before /usr/bin");
}

/**
 * Build common SSH options for ssh/scp commands
 */
export function buildSshOptions(verbose: boolean, timeout: string): string[] {
	const proxyCommand = verbose
		? "openssl s_client -quiet -connect %h:%p"
		: "openssl s_client -quiet -connect %h:%p 2>/dev/null";

	return [
		"-o",
		`ProxyCommand=${proxyCommand}`,
		"-o",
		"StrictHostKeyChecking=no",
		"-o",
		"UserKnownHostsFile=/dev/null",
		"-o",
		`ConnectTimeout=${timeout}`,
	];
}
