import { spawn } from "node:child_process";
import chalk from "chalk";
import { CvmIdSchema } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import { logger } from "@/src/utils/logger";
import { parse_cvm_id } from "@/src/utils/project-config";
import {
	CvmNotRunningError,
	NoGatewayError,
	buildHostname,
	buildSshOptions,
	checkLibreSSLEd25519Compatibility,
	fetchCvmInfo,
	getSshKeyFile,
	isDevImage,
	parseGatewayDomain,
	selectPort,
	shellEscape,
} from "@/src/utils/ssh-utils";
import { cpCommandMeta, cpCommandSchema, type CpCommandInput } from "./command";

interface PathInfo {
	isRemote: boolean;
	cvmId?: string;
	path: string;
}

function parsePath(pathStr: string): PathInfo {
	const remoteMatch = pathStr.match(/^([^:]+):(.+)$/);
	if (remoteMatch) {
		return {
			isRemote: true,
			cvmId: remoteMatch[1],
			path: remoteMatch[2],
		};
	}
	return {
		isRemote: false,
		path: pathStr,
	};
}

async function runCpCommand(
	input: CpCommandInput,
	context: CommandContext,
): Promise<number> {
	try {
		const source = parsePath(input.source);
		const destination = parsePath(input.destination);

		// Validate: exactly one side must be remote
		if (source.isRemote === destination.isRemote) {
			logger.error(
				"Either source or destination must be a remote path in format: cvm-id:path",
			);
			logger.info("Examples:");
			logger.info("  phala cp ./local.txt app_123:/root/remote.txt");
			logger.info("  phala cp app_123:/root/remote.txt ./local.txt");
			return 1;
		}

		// Get CVM ID from remote path or fallback to context
		const remotePath = source.isRemote ? source : destination;
		let cvmId: string | undefined;

		if (remotePath.cvmId) {
			// If CVM ID is explicitly provided in path (e.g., app_123:path), parse it
			cvmId = parse_cvm_id(remotePath.cvmId);
		} else if (context.cvmId) {
			// Otherwise use context.cvmId (already resolved with priority: interactive > --cvm-id > phala.toml)
			cvmId = CvmIdSchema.parse(context.cvmId).cvmId;
		}

		if (!cvmId) {
			context.fail(
				"No CVM ID provided. Either use format cvm-id:path or configure it in phala.toml.",
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
						"This CVM is not using a dev image. SCP access may not be available.",
					);
				}
			} catch (error) {
				if (error instanceof NoGatewayError || error instanceof CvmNotRunningError) {
					context.failWithError(error, {
						operation: "Copy file",
						debug: Boolean((input as { debug?: boolean }).debug),
						guidance: (
							error instanceof CvmNotRunningError
								? "Please start the CVM first using: phala cvms start"
								: undefined
						),
					});
				} else {
					context.failWithError(error, {
						operation: "Copy file",
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

		// Get SSH key file
		const keyFile = getSshKeyFile(input.identity);
		if (!keyFile) {
			logger.warn(
				"No default SSH key found. SCP will use ssh-agent or prompt for password.",
			);
		} else {
			// Check for LibreSSL + ed25519 compatibility issue on macOS
			checkLibreSSLEd25519Compatibility(keyFile);
		}

		if (input.verbose) {
			logger.info(`Connecting to ${chalk.cyan(hostname)}:${port}...`);
		}

		// Build SCP arguments (SCP uses -P for port, not -p)
		const sshOptions = buildSshOptions(input.verbose, "30");
		const scpArgs: string[] = [...sshOptions, "-P", port];

		if (input.verbose) {
			scpArgs.unshift("-v");
		}

		if (keyFile) {
			scpArgs.push("-i", keyFile);
		}

		if (input.recursive) {
			scpArgs.push("-r");
		}

		// Construct source and destination with proper format
		const scpSource = source.isRemote
			? `root@${hostname}:${source.path}`
			: source.path;
		const scpDestination = destination.isRemote
			? `root@${hostname}:${destination.path}`
			: destination.path;

		scpArgs.push(scpSource, scpDestination);

		// Dry run: print the command and exit
		if (input.dryRun) {
			const escapedArgs = scpArgs.map((arg) => shellEscape(arg));
			context.stdout.write(`scp ${escapedArgs.join(" ")}\n`);
			return 0;
		}

		const direction = source.isRemote ? "download" : "upload";
		const localPath = source.isRemote ? destination.path : source.path;
		const remotePath_ = source.isRemote ? source.path : destination.path;

		logger.info(
			`${direction === "upload" ? "Uploading" : "Downloading"} ${chalk.cyan(localPath)} ${direction === "upload" ? "to" : "from"} ${chalk.cyan(remotePath_)}...`,
		);

		// Spawn SCP process
		const scp = spawn("scp", scpArgs, { stdio: "inherit" });

		// Handle process errors
		scp.on("error", (error) => {
			logger.break();
			logger.error(`SCP failed: ${error.message}`);
		});

		// Handle process exit
		return new Promise<number>((resolve) => {
			scp.on("close", (code) => {
				logger.break();
				if (code === 0) {
					logger.success(
						`${direction === "upload" ? "Upload" : "Download"} completed`,
					);
					resolve(0);
				} else {
					logger.error(`Transfer failed with code ${code}`);
					resolve(code ?? 1);
				}
			});
		});
	} catch (error) {
		logger.error("Failed to copy file via SCP");
		if (error instanceof Error) {
			logger.error(error.message);
		}
		return 1;
	}
}

export const cpCommand = defineCommand({
	path: ["cp"],
	meta: cpCommandMeta,
	schema: cpCommandSchema,
	handler: runCpCommand,
});

export default cpCommand;
