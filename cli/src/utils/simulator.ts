import { type StdioOptions, execSync, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { logger } from "./logger";

// Configuration for simulator
const SIMULATOR_CONFIG = {
	version: "0.5.3",
	baseUrl: "https://github.com/Dstack-TEE/dstack/releases/download/v0.5.3",
	installDir: path.join(os.homedir(), ".phala-cloud", "simulator"),
	// Default log file path
	defaultLogPath: path.join(
		os.homedir(),
		".phala-cloud",
		"logs",
		"dstack-simulator.log",
	),
	platforms: {
		darwin: {
			filename: "dstack-simulator-0.5.3-aarch64-apple-darwin.tgz",
			extractedFolder: "0.5.3",
			socketPath: path.join(
				os.homedir(),
				".phala-cloud",
				"simulator",
				"0.5.3",
				"dstack.sock",
			),
		},
		linux: {
			filename: "dstack-simulator-0.5.3-x86_64-linux-musl.tgz",
			extractedFolder: "0.5.3",
			socketPath: path.join(
				os.homedir(),
				".phala-cloud",
				"simulator",
				"0.5.3",
				"dstack.sock",
			),
		},
		win32: {
			filename: "dstack-simulator-0.5.3-x86_64-pc-windows-msvc.tgz",
			extractedFolder: "dstack-simulator-0.5.3-x86_64-pc-windows-msvc",
			socketPath: "127.0.0.1:8090",
		},
	},
};

/**
 * Check if the simulator is already installed
 * @returns boolean indicating if simulator is installed
 */
export function isSimulatorInstalled(): boolean {
	try {
		// Check if the main installation directory exists
		if (!fs.existsSync(SIMULATOR_CONFIG.installDir)) {
			return false;
		}

		// Get platform-specific folder name
		const platform = os.platform() as "darwin" | "linux" | "win32";
		if (!SIMULATOR_CONFIG.platforms[platform]) {
			throw new Error(`Unsupported platform: ${platform}`);
		}

		const extractedFolderPath = path.join(
			SIMULATOR_CONFIG.installDir,
			SIMULATOR_CONFIG.platforms[platform].extractedFolder,
		);

		// Check if the extracted folder exists
		if (!fs.existsSync(extractedFolderPath)) {
			return false;
		}

		// Check if the executable exists
		const executableName =
			platform === "win32" ? "dstack-simulator.exe" : "dstack-simulator";
		const executablePath = path.join(extractedFolderPath, executableName);
		return fs.existsSync(executablePath);
	} catch (error) {
		logger.error("Error checking if simulator is installed:", error);
		return false;
	}
}

/**
 * Get the current platform
 * @returns The current platform: 'darwin', 'linux', or 'win32'
 * @throws Error if the platform is not supported
 */
export function getPlatform(): "darwin" | "linux" | "win32" {
	const platform = os.platform() as "darwin" | "linux" | "win32";
	if (!SIMULATOR_CONFIG.platforms[platform]) {
		throw new Error(
			`Unsupported platform: ${platform}. Only darwin, linux, and win32 are supported.`,
		);
	}
	return platform;
}

/**
 * Install the simulator based on the current platform
 * @param progressCallback Optional callback to report progress
 * @returns Promise that resolves when installation is complete
 */
export async function installSimulator(
	progressCallback?: (message: string) => void,
): Promise<void> {
	const log = (message: string) => {
		logger.info(message);
		if (progressCallback) progressCallback(message);
	};

	try {
		const platform = getPlatform();
		const platformConfig = SIMULATOR_CONFIG.platforms[platform];

		// Check if platform is Windows, now we only support darwin and linux
		if (platform === "win32") {
			try {
				// Test if tar is available
				execSync("tar --version", { stdio: "ignore" });
			} catch (error) {
				throw new Error(
					"Windows 10 build 17063 or later is required (includes tar command). Please update your Windows version.",
				);
			}
			throw new Error(
				"Windows platform is currently not supported. Support will be added in a future release.",
			);
		}

		// Create installation directory if it doesn't exist
		if (!fs.existsSync(SIMULATOR_CONFIG.installDir)) {
			logger.info(
				`Creating installation directory at ${SIMULATOR_CONFIG.installDir}`,
			);
			fs.mkdirSync(SIMULATOR_CONFIG.installDir, { recursive: true });
		}

		// Change to the installation directory
		process.chdir(SIMULATOR_CONFIG.installDir);

		// Download the simulator
		const downloadUrl = `${SIMULATOR_CONFIG.baseUrl}/${platformConfig.filename}`;
		logger.info(`Downloading simulator from ${downloadUrl}`);
		execSync(`wget ${downloadUrl}`, { stdio: "inherit" });

		// Create the version-specific directory if it doesn't exist
		const versionDir = path.join(
			SIMULATOR_CONFIG.installDir,
			platformConfig.extractedFolder,
		);
		if (!fs.existsSync(versionDir)) {
			fs.mkdirSync(versionDir, { recursive: true });
		}

		// Extract the archive into the version directory
		logger.info(`Extracting ${platformConfig.filename} to ${versionDir}`);

		// Use the same tar command for all platforms (Windows 10+ includes tar)
		const tarCommand = `tar -xvf "${platformConfig.filename}" -C "${versionDir}" --strip-components=1`;
		logger.debug(`Running: ${tarCommand}`);

		try {
			execSync(tarCommand, { stdio: "inherit" });
			// Clean up the downloaded archive
			fs.unlinkSync(platformConfig.filename);
		} catch (error) {
			logger.error(`Failed to extract ${platformConfig.filename}:`, error);
			throw new Error(
				"Failed to extract simulator archive. Make sure you have sufficient permissions and disk space.",
			);
		}

		logger.success("Simulator installation completed successfully");
	} catch (error) {
		logger.error("Error installing simulator:", error);
		throw new Error(`Failed to install simulator: ${error}`);
	}
}

/**
 * Run the simulator
 * @param options Configuration options for running the simulator
 * @returns A child process representing the running simulator
 */
// PID file path for tracking the running simulator process
const getPidFilePath = () => path.join(os.tmpdir(), "dstack-simulator.pid");

/**
 * Check if socket path is too long (Unix domain sockets have a max length of 104-108 bytes)
 * @param socketPath Socket path to check
 * @returns boolean indicating if path is too long
 */
function isSocketPathTooLong(socketPath: string): boolean {
	// Unix domain sockets typically have a max length of 104-108 bytes
	// Using Buffer.byteLength to get the actual byte length of the string
	return Buffer.byteLength(socketPath, "utf8") > 104;
}

/**
 * Get the PID of the running simulator process
 * @returns PID as number or null if not running
 */
export function getSimulatorPid(): number | null {
	try {
		const pidFile = getPidFilePath();
		if (fs.existsSync(pidFile)) {
			const pid = Number.parseInt(fs.readFileSync(pidFile, "utf-8").trim(), 10);
			// Verify the process is still running
			try {
				process.kill(pid, 0); // Check if process exists
				return pid;
			} catch (e) {
				// Process doesn't exist, clean up stale PID file
				fs.unlinkSync(pidFile);
			}
		}
		return null;
	} catch (error) {
		logger.warn("Error checking simulator PID:", error);
		return null;
	}
}

/**
 * Save the simulator process PID to a file
 * @param pid Process ID to save
 */
function saveSimulatorPid(pid: number, verbose?: boolean): void {
	try {
		const pidFilePath = getPidFilePath();
		if (verbose) {
			logger.info(`Saving simulator PID ${pid} to: ${pidFilePath}`);
		}
		fs.writeFileSync(pidFilePath, pid.toString(), "utf-8");
	} catch (error) {
		logger.warn("Failed to save simulator PID:", error);
	}
}

export async function runSimulator(
	options: {
		background?: boolean;
		logToFile?: boolean;
		logFilePath?: string;
		verbose?: boolean;
	} = {},
): Promise<ReturnType<typeof spawn>> {
	try {
		const platform = getPlatform();
		const platformConfig = SIMULATOR_CONFIG.platforms[platform];
		const extractedFolderPath = path.join(
			SIMULATOR_CONFIG.installDir,
			platformConfig.extractedFolder,
		);

		// Check if simulator is already running
		const existingPid = getSimulatorPid();
		if (existingPid) {
			throw new Error(`Simulator is already running with PID: ${existingPid}`);
		}

		// Check socket path length for Unix platforms
		if (
			platform !== "win32" &&
			isSocketPathTooLong(platformConfig.socketPath)
		) {
			throw new Error(
				`Socket path is too long (${platformConfig.socketPath.length} chars, max 104): ${platformConfig.socketPath}`,
			);
		}

		// Clean up any existing socket file
		if (platform !== "win32" && fs.existsSync(platformConfig.socketPath)) {
			logger.warn(
				`Removing existing socket file: ${platformConfig.socketPath}`,
			);
			try {
				fs.unlinkSync(platformConfig.socketPath);
			} catch (error) {
				logger.warn(`Failed to remove existing socket file: ${error}`);
			}
		}

		// Change to the extracted folder directory
		process.chdir(extractedFolderPath);

		// Start the simulator
		const executableName =
			platform === "win32" ? "dstack-simulator.exe" : "./dstack-simulator";

		// Only log verbose information if verbose flag is set
		if (options.verbose) {
			if (platform !== "win32") {
				logger.info(`Using socket path: ${platformConfig.socketPath}`);
			}
		}

		// Default options
		const runOptions = {
			background: options.background ?? true,
			logToFile: options.logToFile ?? true,
			logFilePath: options.logFilePath ?? SIMULATOR_CONFIG.defaultLogPath,
		};

		// Create log directory if it doesn't exist
		if (runOptions.logToFile) {
			const logDir = path.dirname(runOptions.logFilePath);
			if (!fs.existsSync(logDir)) {
				fs.mkdirSync(logDir, { recursive: true });
			}
			if (options.verbose) {
				logger.info(
					`Simulator logs will be written to: ${runOptions.logFilePath}`,
				);
			}
		}

		if (options.verbose) {
			logger.info(`Starting simulator with: ${executableName}`);
		}

		// Configure stdio based on logging preferences
		const stdio: StdioOptions = runOptions.logToFile
			? [
					"ignore", // stdin
					fs.openSync(runOptions.logFilePath, "a"), // stdout
					fs.openSync(runOptions.logFilePath, "a"), // stderr
				]
			: "inherit";

		// Run the simulator - dstack-simulator doesn't accept any arguments
		const simulatorProcess = spawn(executableName, [], {
			stdio,
			shell: platform === "win32", // Use shell on Windows
			detached: runOptions.background, // Detach process when running in background
		});

		// Close file descriptors if they were opened
		if (runOptions.logToFile && Array.isArray(stdio)) {
			if (typeof stdio[1] === "number") fs.closeSync(stdio[1]);
			if (typeof stdio[2] === "number") fs.closeSync(stdio[2]);
		}

		// Write startup entry to log file with timestamp
		if (runOptions.logToFile) {
			const timestamp = new Date().toISOString();
			const logEntry = `\n=== Simulator started at ${timestamp} ===\nCommand: ${executableName}\n\n`;
			fs.appendFileSync(runOptions.logFilePath, logEntry);
		}

		// Save the PID for later reference
		if (simulatorProcess.pid) {
			saveSimulatorPid(simulatorProcess.pid, options.verbose);
		}

		// If running in background, unref to allow the parent process to exit
		if (runOptions.background) {
			simulatorProcess.unref();
			if (options.verbose) {
				logger.success("Simulator is running in the background");
			}
		}

		await setSimulatorEndpointEnv();
		return simulatorProcess;
	} catch (error) {
		logger.error("Error running simulator:", error);
		throw new Error(`Failed to run simulator: ${error}`);
	}
}

/**
 * Ensures the simulator is installed and running
 * @param options Configuration options for running the simulator
 * @returns A promise that resolves to a child process representing the running simulator
 */
export async function ensureSimulatorRunning(
	options: {
		background?: boolean;
		logToFile?: boolean;
		logFilePath?: string;
		verbose?: boolean;
	} = {},
): Promise<ReturnType<typeof spawn>> {
	if (!isSimulatorInstalled()) {
		if (options.verbose) {
			logger.info("Simulator not installed. Installing now...");
			await installSimulator((message) => {
				if (options.verbose) {
					logger.info(`Installation progress: ${message}`);
				}
			});
		} else {
			await installSimulator();
		}
	}

	if (await isSimulatorRunning()) {
		if (options.verbose) {
			logger.info("Simulator is already running");
		}
		return null;
	}

	if (options.verbose) {
		logger.info("Starting simulator...");
	}
	return await runSimulator(options);
}

/**
 * Check if the simulator is currently running
 * For Unix platforms (Darwin/Linux), checks if the Unix socket exists and is accessible
 * For Windows, tries to connect to the TCP port the simulator should be listening on
 * @returns Promise<boolean> indicating if the simulator is running
 */
export async function isSimulatorRunning(): Promise<boolean> {
	try {
		const platform = getPlatform();
		const platformConfig = SIMULATOR_CONFIG.platforms[platform];

		if (platform === "darwin" || platform === "linux") {
			const socketPath = platformConfig.socketPath;

			// Check if the socket file exists
			if (!fs.existsSync(socketPath)) {
				return false;
			}

			// Try to connect to the socket to verify it's active
			return new Promise<boolean>((resolve) => {
				const client = net
					.createConnection({ path: socketPath })
					.on("connect", () => {
						client.end();
						resolve(true);
					})
					.on("error", () => {
						resolve(false);
					});

				// Set timeout to avoid hanging if socket exists but nothing is listening
				setTimeout(() => {
					client.end();
					resolve(false);
				}, 1000);
			});
		}
		if (platform === "win32") {
			// For Windows, try to connect to the TCP port
			const host = "127.0.0.1";
			const port = 8090;

			return new Promise<boolean>((resolve) => {
				const client = net
					.createConnection({ host, port })
					.on("connect", () => {
						client.end();
						resolve(true);
					})
					.on("error", () => {
						resolve(false);
					});

				// Set timeout to avoid hanging
				setTimeout(() => {
					client.end();
					resolve(false);
				}, 1000);
			});
		}

		return false;
	} catch (error) {
		logger.error("Error checking if simulator is running:", error);
		return false;
	}
}

/**
/**
 * Stops the simulator if it's running
 * @returns Promise<boolean> indicating if the simulator was successfully stopped
 */
export async function stopSimulator(): Promise<boolean> {
	try {
		const pid = getSimulatorPid();
		const isRunning = await isSimulatorRunning();

		if (!isRunning && !pid) {
			logger.info("Simulator is not running");
			return true;
		}

		const platform = getPlatform();
		let success = false;

		if (platform === "win32") {
			// On Windows, try to kill by PID first, then fall back to taskkill
			try {
				if (pid) {
					logger.info(`Stopping simulator process (PID: ${pid})...`);
					process.kill(pid, "SIGTERM");
				} else {
					execSync("taskkill /F /IM dstack-simulator.exe", { stdio: "ignore" });
				}
				success = true;
			} catch (error: unknown) {
				// Process might already be stopped
				const nodeError = error as { code?: string };
				if (nodeError.code !== "ESRCH") {
					// No such process
					logger.error("Failed to stop simulator:", error);
					return false;
				}
				success = true; // Process was already stopped
			}
		} else {
			// On Unix, try to kill by PID first, then fall back to pkill
			try {
				if (pid) {
					logger.info(`Stopping simulator process (PID: ${pid})...`);
					process.kill(pid, "SIGTERM");
				} else {
					execSync("pkill -f dstack-simulator", { stdio: "ignore" });
				}
				success = true;
			} catch (error: unknown) {
				// Process might already be stopped
				const nodeError = error as { code?: string };
				if (nodeError.code !== "ESRCH") {
					// No such process
					logger.error("Failed to stop simulator:", error);
					return false;
				}
				success = true; // Process was already stopped
			}
		}

		// Clean up PID file if it exists
		const pidFile = getPidFilePath();
		if (fs.existsSync(pidFile)) {
			try {
				fs.unlinkSync(pidFile);
			} catch (error) {
				logger.warn("Failed to remove PID file:", error);
			}
		}

		// Clean up environment variable
		await deleteSimulatorEndpointEnv();

		if (success) {
			logger.success("Simulator stopped successfully");
		}

		return success;
	} catch (error) {
		logger.error("Error stopping simulator:", error);
		return false;
	}
}

/**
 * Gets the path to the simulator log file
 * @param customPath Optional custom log file path
 * @returns The path to the log file
 */
export function getSimulatorLogPath(customPath?: string): string {
	return customPath ?? SIMULATOR_CONFIG.defaultLogPath;
}

/**
 * Reads the recent logs from the simulator log file
 * @param options Options for reading logs
 * @returns Recent log content or null if log file doesn't exist
 */
export function getSimulatorLogs(
	options: { logFilePath?: string; maxLines?: number } = {},
): string | null {
	const logFilePath = options.logFilePath ?? SIMULATOR_CONFIG.defaultLogPath;
	const maxLines = options.maxLines ?? 100;

	try {
		if (!fs.existsSync(logFilePath)) {
			return null;
		}

		// Read the log file
		const logContent = fs.readFileSync(logFilePath, "utf8");

		// Split by lines and get the most recent ones
		const lines = logContent.split("\n");
		return lines.slice(-maxLines).join("\n");
	} catch (error) {
		logger.error("Error reading simulator logs:", error);
		return null;
	}
}

/**
 * Gets the simulator endpoint URL based on the current platform
 * @returns The endpoint URL for the simulator
 */
export function getSimulatorEndpoint(): string {
	const platform = getPlatform();
	const platformConfig = SIMULATOR_CONFIG.platforms[platform];

	if (platform === "win32") {
		return "http://127.0.0.1:8090";
	}

	// Use the socket path from platform config, or fallback to default
	const socketPath = platformConfig.socketPath || "/tmp/dstack.sock";
	return `${socketPath}`;
}

/**
 * Sets the DSTACK_SIMULATOR_ENDPOINT environment variable based on the current platform
 * @param options Configuration options for setting the environment variable
 * @returns The endpoint URL that was set
 */
export async function setSimulatorEndpointEnv(
	endpoint?: string,
): Promise<string> {
	try {
		const simulatorEndpoint = getSimulatorEndpoint();
		// Set for the current Node.js process
		const envEndpoint = endpoint || simulatorEndpoint;

		// Set both environment variables
		await execSync(`export DSTACK_SIMULATOR_ENDPOINT=${envEndpoint}`);

		// For TAPPD compatibility, use the same socket path but with tappd.sock
		const tappdEndpoint = envEndpoint.replace(/dstack\.sock$/, "tappd.sock");
		await execSync(`export TAPPD_SIMULATOR_ENDPOINT=${tappdEndpoint}`);

		logger.success("Setting environment for current process...");
		logger.success(`  DSTACK_SIMULATOR_ENDPOINT=${envEndpoint}`);
		logger.success(`  TAPPD_SIMULATOR_ENDPOINT=${tappdEndpoint}`);

		return envEndpoint;
	} catch (error) {
		logger.error(
			"Error setting simulator endpoint environment variable:",
			error,
		);
		throw new Error(`Failed to set simulator endpoint: ${error}`);
	}
}

/**
 * Deletes the simulator endpoint environment variables
 * @returns boolean indicating if deletion was successful
 */
export async function deleteSimulatorEndpointEnv(): Promise<boolean> {
	try {
		await execSync("unset DSTACK_SIMULATOR_ENDPOINT");
		await execSync("unset TAPPD_SIMULATOR_ENDPOINT");
		logger.debug(
			"Deleted simulator endpoint environment variables from current process",
		);
		return true;
	} catch (error) {
		logger.warn(
			"Error while unsetting simulator endpoint environment variables:",
			error,
		);
		return false;
	}
}
