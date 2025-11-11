import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import chalk from "chalk";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import { logDetailedError } from "@/src/utils/error-handling";
import { logger } from "@/src/utils/logger";
import {
	sshCommandMeta,
	sshCommandSchema,
	type SshCommandInput,
} from "./command";

async function runSshCommand(
	input: SshCommandInput,
	context: CommandContext,
): Promise<number> {
	try {
		const client = await getClient();
		const cvm = await client.getCvmInfo({ id: input.cvmId });

		if (!cvm.gateway_domain && !input.gatewayDomain) {
			logger.error("CVM is not registered on any gateway.");
			return 1;
		}

		// Check if CVM is running
		if (cvm.status !== "running") {
			logger.error(
				`CVM is not running (current status: ${chalk.yellow(cvm.status)})`,
			);
			logger.info("Please start the CVM first using: phala cvms start");
			return 1;
		}

		// Extract gateway domain and instance ID
		const gatewayDomain = input.gatewayDomain ?? cvm.gateway_domain;
		const instanceId = cvm.app_id;

		// Use port from input (defaults to 443)
		const port = input.port;

		// Handle SSH key file
		let keyFile = input.identity;

		if (!keyFile) {
			// Search for default keys
			const defaultKeys = [
				join(homedir(), ".ssh", "id_rsa"),
				join(homedir(), ".ssh", "id_ed25519"),
				join(homedir(), ".ssh", "id_ecdsa"),
				join(homedir(), ".ssh", "id_dsa"),
			];

			for (const key of defaultKeys) {
				if (existsSync(key)) {
					keyFile = key;
					break;
				}
			}

			if (!keyFile) {
				logger.warn(
					"No default SSH key found. SSH will use ssh-agent or prompt for password.",
				);
			}
		} else {
			// Expand ~ to home directory
			if (keyFile.startsWith("~")) {
				keyFile = join(homedir(), keyFile.slice(1));
			}

			// Verify key file exists
			if (!existsSync(keyFile)) {
				logger.error(`SSH key file not found: ${keyFile}`);
				return 1;
			}
		}

		// Construct SSH configuration
		const hostname = `${instanceId}-22.${gatewayDomain}`;
		const user = "root";
		// Suppress openssl certificate verification output in non-verbose mode
		const proxyCommand = input.verbose
			? "openssl s_client -quiet -connect %h:%p"
			: "openssl s_client -quiet -connect %h:%p 2>/dev/null";

		if (input.verbose) {
			logger.info(`Connecting to ${chalk.cyan(hostname)}...`);
		}

		// Build SSH arguments
		const sshArgs: string[] = [
			"-o",
			`ProxyCommand=${proxyCommand}`,
			"-o",
			"StrictHostKeyChecking=no",
			"-o",
			"UserKnownHostsFile=/dev/null",
			"-o",
			"LogLevel=ERROR",
			"-o",
			`ConnectTimeout=${input.timeout}`,
			"-p",
			port,
		];

		// Add key file if available
		if (keyFile) {
			sshArgs.push("-i", keyFile);
		}

		// Add verbose flag if requested
		if (input.verbose) {
			sshArgs.unshift("-v");
			// Remove LogLevel restriction in verbose mode
			const logLevelIndex = sshArgs.indexOf("LogLevel=ERROR");
			if (logLevelIndex > 0) {
				sshArgs.splice(logLevelIndex - 1, 2); // Remove -o and LogLevel=ERROR
			}
		}

		// Add target
		sshArgs.push(`${user}@${hostname}`);

		// Spawn SSH process
		const ssh = spawn("ssh", sshArgs, { stdio: "inherit" });

		// Handle process errors
		ssh.on("error", (error) => {
			logger.break();
			logger.error(`SSH connection failed: ${error.message}`);
		});

		// Handle process exit
		return new Promise<number>((resolve) => {
			ssh.on("close", (code) => {
				logger.break();
				if (code === 0) {
					logger.success("Connection closed");
					resolve(0);
				} else {
					logger.error(`Connection failed with code ${code}`);
					resolve(code ?? 1);
				}
			});
		});
	} catch (error) {
		logger.error("Failed to connect via SSH");
		logDetailedError(error);
		return 1;
	}
}

export const sshCommand = defineCommand({
	path: ["ssh"],
	meta: sshCommandMeta,
	schema: sshCommandSchema,
	handler: runSshCommand,
});

export default sshCommand;
