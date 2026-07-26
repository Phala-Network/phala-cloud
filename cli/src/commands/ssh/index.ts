import { spawn } from "node:child_process";
import chalk from "chalk";
import { CvmIdSchema } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import { logger } from "@/src/utils/logger";
import {
	CvmNotRunningError,
	NoGatewayError,
	buildHostname,
	buildSshOptions,
	checkLibreSSLEd25519Compatibility,
	fetchCvmInfo,
	findDefaultSshKey,
	isDevImage,
	parseGatewayDomain,
	selectPort,
	shellEscape,
} from "@/src/utils/ssh-utils";
import {
	sshCommandMeta,
	sshCommandSchema,
	type SshCommandInput,
} from "./command";

/**
 * Check if pass-through args contain blocked options
 * Currently only -o ProxyCommand is blocked as it would break the TLS gateway connection
 */
function containsBlockedOption(args: string[]): string | null {
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		// Check -o ProxyCommand=...
		if (arg === "-o" && i + 1 < args.length) {
			const nextArg = args[i + 1];
			if (nextArg.toLowerCase().startsWith("proxycommand")) {
				return "-o ProxyCommand";
			}
		}
		// Check -oProxyCommand=... (combined form)
		if (arg.toLowerCase().startsWith("-oproxycommand")) {
			return "-o ProxyCommand";
		}
	}
	return null;
}

async function runSshCommand(
	input: SshCommandInput,
	context: CommandContext,
): Promise<number> {
	try {
		// Get CVM ID from context (already resolved with priority: interactive > --cvm-id > phala.toml)
		if (!context.cvmId) {
			context.fail(
				"No CVM ID provided. Either pass a CVM ID as argument or configure it in phala.toml.",
			);
			return 1;
		}

		const { cvmId } = CvmIdSchema.parse(context.cvmId);

		// Check for blocked options in pass-through args
		const passThroughArgs = input["--"] ?? [];
		const blockedOption = containsBlockedOption(passThroughArgs);
		if (blockedOption) {
			logger.error(
				`${blockedOption} is not allowed as it would break the TLS gateway connection.`,
			);
			return 1;
		}

		// Resolve gateway domain and port from config hierarchy
		const configGatewayDomain =
			input.gatewayDomain ?? context.projectConfig.gateway_domain;
		const requestedPort =
			input.port !== "443"
				? input.port
				: (context.projectConfig.gateway_port?.toString() ?? "443");

		// Fetch CVM info from API if gateway not provided
		let instanceId: string;
		let gatewayDomain: string;

		if (!configGatewayDomain) {
			try {
				const client = await getClient(context);
				const cvmInfo = await fetchCvmInfo(client, cvmId);
				instanceId = cvmInfo.appId;
				gatewayDomain = cvmInfo.gatewayDomain;

				// Warn if not a dev image
				const devImage = cvmInfo.isDevImage ?? isDevImage(cvmInfo.baseImage);
				if (devImage === false) {
					logger.warn(
						"This CVM is not using a dev image. SSH access may not be available.",
					);
				}
			} catch (error) {
				if (error instanceof NoGatewayError || error instanceof CvmNotRunningError) {
					context.failWithError(error, {
						operation: "SSH connect",
						debug: Boolean((input as { debug?: boolean }).debug),
						guidance: (
							error instanceof CvmNotRunningError
								? "Please start the CVM first using: phala cvms start"
								: undefined
						),
					});
				} else {
					context.failWithError(error, {
						operation: "SSH connect",
						debug: Boolean((input as { debug?: boolean }).debug),
					});
				}
				return 1;
			}
		} else {
			gatewayDomain = configGatewayDomain;
			// Extract instance ID from cvmId (remove "app_" prefix if present)
			instanceId = cvmId.startsWith("app_") ? cvmId.substring(4) : cvmId;
		}

		// Parse gateway and select port
		const gateway = parseGatewayDomain(gatewayDomain);
		const port = selectPort(requestedPort, gateway.port);
		const hostname = buildHostname(instanceId, gateway.host);

		// Check for LibreSSL + ed25519 compatibility issue on macOS
		const defaultKey = findDefaultSshKey();
		if (defaultKey) {
			checkLibreSSLEd25519Compatibility(defaultKey);
		}

		if (input.verbose) {
			logger.info(`Connecting to ${chalk.cyan(hostname)}:${port}...`);
		}

		// Build SSH arguments
		// SSH format: ssh [options] destination [command]
		// We need to split pass-through into options vs command
		const sshOptions = buildSshOptions(input.verbose, input.timeout);
		const { options: ptOptions, command: ptCommand } =
			splitPassThroughArgs(passThroughArgs);

		const finalArgs: string[] = [];
		if (input.verbose) {
			finalArgs.push("-v");
		}
		finalArgs.push(
			...sshOptions,
			"-p",
			port,
			...ptOptions,
			`root@${hostname}`,
			...ptCommand,
		);

		// Dry run: print the command and exit
		if (input.dryRun) {
			const escapedArgs = finalArgs.map((arg) => shellEscape(arg));
			context.stdout.write(`ssh ${escapedArgs.join(" ")}\n`);
			return 0;
		}

		// Spawn SSH process
		const ssh = spawn("ssh", finalArgs, { stdio: "inherit" });

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
		if (error instanceof Error) {
			logger.error(error.message);
		} else {
			logger.error(String(error));
		}
		return 1;
	}
}

/**
 * Split pass-through args into SSH options and remote command
 * SSH options start with - and some take arguments
 */
function splitPassThroughArgs(args: string[]): {
	options: string[];
	command: string[];
} {
	const options: string[] = [];
	const command: string[] = [];

	// SSH options that take an argument
	const optionsWithArg = new Set([
		"-b",
		"-c",
		"-D",
		"-E",
		"-e",
		"-F",
		"-I",
		"-i",
		"-J",
		"-L",
		"-l",
		"-m",
		"-O",
		"-o",
		"-P",
		"-p",
		"-R",
		"-S",
		"-W",
		"-w",
	]);

	let i = 0;
	let inCommand = false;

	while (i < args.length) {
		const arg = args[i];

		if (inCommand) {
			command.push(arg);
			i++;
			continue;
		}

		if (arg.startsWith("-")) {
			options.push(arg);
			// Check if this option takes an argument
			// Handle both -o value and -ovalue forms
			const optFlag = arg.length === 2 ? arg : arg.slice(0, 2);
			if (
				optionsWithArg.has(optFlag) &&
				arg.length === 2 &&
				i + 1 < args.length
			) {
				// Option takes argument and it's separate (e.g., -o ProxyCommand)
				i++;
				options.push(args[i]);
			}
			i++;
		} else {
			// First non-option argument starts the command
			inCommand = true;
			command.push(arg);
			i++;
		}
	}

	return { options, command };
}

export const sshCommand = defineCommand({
	path: ["ssh"],
	meta: sshCommandMeta,
	schema: sshCommandSchema,
	handler: runSshCommand,
});

export default sshCommand;
