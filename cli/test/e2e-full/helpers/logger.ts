import fs from "node:fs";
import path from "node:path";

const LOG_DIR = path.join(__dirname, "../logs");

export interface TestLogger {
	info: (message: string, ...args: unknown[]) => void;
	success: (message: string, ...args: unknown[]) => void;
	error: (message: string, ...args: unknown[]) => void;
	warn: (message: string, ...args: unknown[]) => void;
	step: (stepName: string, details?: Record<string, unknown>) => void;
	saveArtifact: (name: string, content: string) => void;
	getLogPath: () => string;
}

/**
 * Create a test logger that logs to both console and file
 */
export function createTestLogger(testName: string): TestLogger {
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const logFileName = `${testName}-${timestamp}.log`;
	const logPath = path.join(LOG_DIR, logFileName);

	// Ensure log directory exists
	if (!fs.existsSync(LOG_DIR)) {
		fs.mkdirSync(LOG_DIR, { recursive: true });
	}

	// Create write stream
	const logStream = fs.createWriteStream(logPath, { flags: "a" });

	const formatTimestamp = () => {
		return new Date().toISOString();
	};

	const writeLog = (level: string, message: string, ...args: unknown[]) => {
		const formattedArgs = args.length > 0 ? ` ${JSON.stringify(args)}` : "";
		const logLine = `[${formatTimestamp()}] [${level}] ${message}${formattedArgs}\n`;

		// Write to console
		console.log(logLine.trim());

		// Write to file
		logStream.write(logLine);
	};

	return {
		info: (message: string, ...args: unknown[]) => {
			writeLog("INFO", message, ...args);
		},

		success: (message: string, ...args: unknown[]) => {
			writeLog("SUCCESS", `✅ ${message}`, ...args);
		},

		error: (message: string, ...args: unknown[]) => {
			writeLog("ERROR", `❌ ${message}`, ...args);
		},

		warn: (message: string, ...args: unknown[]) => {
			writeLog("WARN", `⚠️  ${message}`, ...args);
		},

		step: (stepName: string, details?: Record<string, unknown>) => {
			const separator = "=".repeat(80);
			writeLog("STEP", `\n${separator}`);
			writeLog("STEP", `STEP: ${stepName}`);
			if (details) {
				writeLog("STEP", "Details:", details);
			}
			writeLog("STEP", separator);
		},

		saveArtifact: (name: string, content: string) => {
			const artifactPath = path.join(LOG_DIR, `${testName}-${name}-${timestamp}.json`);
			try {
				fs.writeFileSync(artifactPath, content);
				writeLog("INFO", `Artifact saved: ${artifactPath}`);
			} catch (error) {
				writeLog("ERROR", `Failed to save artifact: ${error}`);
			}
		},

		getLogPath: () => logPath,
	};
}

/**
 * Log error with full context, including HTTP response details
 */
export function logError(
	logger: TestLogger,
	error: unknown,
	context: string,
): void {
	logger.error(`${context}`);

	// Check if it's a FetchError (from throwing API)
	const errorObj = error as any;
	const isFetchError =
		errorObj &&
		typeof errorObj === "object" &&
		"status" in errorObj &&
		"statusText" in errorObj;

	if (isFetchError) {
		// HTTP error from API
		logger.error(`HTTP ${errorObj.status}: ${errorObj.message || errorObj.statusText}`);
		if (errorObj.data !== undefined && errorObj.data !== null) {
			logger.error("Response body:", errorObj.data);
		}
		if (errorObj.stack) {
			logger.error("Stack trace:", errorObj.stack);
		}
	} else if (error instanceof Error) {
		// Regular error
		logger.error(`Error: ${error.message}`);
		if (error.stack) {
			logger.error("Stack trace:", error.stack);
		}
		// Log the full error object to capture any additional properties
		logger.error("Full error object:", error);
	} else {
		// Unknown error type
		logger.error("Error:", String(error));
		logger.error("Full error object:", error);
	}
}
