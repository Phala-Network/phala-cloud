import os from "node:os";
import path from "node:path";
import fs from "fs-extra";

// Define the directory and file for storing configuration
const PHALA_CLOUD_DIR = path.join(os.homedir(), ".phala-cloud");
const CONFIG_FILE = path.join(PHALA_CLOUD_DIR, "config.json");

type ConfigValue = string | number | boolean | null | undefined;
type Config = Record<string, ConfigValue>;

// Default configuration
const DEFAULT_CONFIG: Config = {
	apiUrl: "https://cloud-api.phala.network",
	cloudUrl: "https://cloud.phala.com",
	defaultTeepodId: 3,
	defaultImage: "dstack-dev-0.3.5",
	defaultVcpu: 1,
	defaultMemory: 2048,
	defaultDiskSize: 20,
};

// Ensure the .phala-cloud directory exists
function ensureDirectoryExists(): void {
	if (!fs.existsSync(PHALA_CLOUD_DIR)) {
		try {
			fs.mkdirSync(PHALA_CLOUD_DIR, { recursive: true });
		} catch (error) {
			throw new Error(
				`Failed to create directory ${PHALA_CLOUD_DIR}: ${String(error)}`,
			);
		}
	}
}

// Load configuration
export function loadConfig(): Config {
	try {
		if (fs.existsSync(CONFIG_FILE)) {
			const configData = fs.readFileSync(CONFIG_FILE, "utf8");
			return { ...DEFAULT_CONFIG, ...JSON.parse(configData) };
		}
		return DEFAULT_CONFIG;
	} catch (error) {
		return DEFAULT_CONFIG;
	}
}

// Save configuration
export function saveConfig(config: Config): void {
	ensureDirectoryExists();
	try {
		fs.writeFileSync(
			CONFIG_FILE,
			JSON.stringify({ ...loadConfig(), ...config }, null, 2),
			{ mode: 0o600 }, // Restrict permissions to user only
		);
	} catch (error) {
		throw new Error(`Failed to save configuration: ${String(error)}`);
	}
}

// Get a configuration value
export function getConfigValue(key: string): ConfigValue {
	const config = loadConfig();
	return config[key];
}

// Set a configuration value
export function setConfigValue(key: string, value: ConfigValue): void {
	const config = loadConfig();
	config[key] = value;
	saveConfig(config);
}

// List all configuration values
export function listConfigValues(): Config {
	return loadConfig();
}
