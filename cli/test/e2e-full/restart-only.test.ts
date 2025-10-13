import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { execaCommand } from "execa";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@phala/cloud";
import { safeGetCurrentUser, safeGetAvailableNodes } from "@phala/cloud";
import { createTestLogger, logError, type TestLogger } from "./helpers/logger";
import {
	waitForCvmStatus,
	waitForCvmNetwork,
	getCvmDetails,
	cleanupCvm,
	getCvmSerialLogs,
} from "./helpers/cvm-lifecycle";
import {
	testJsonEndpoint,
	waitForPortExposed,
	buildPublicUrl,
} from "./helpers/network-utils";

// Skip if no API key provided
const TEST_API_KEY =
	process.env.PHALA_CLOUD_API_KEY || process.env.PHALA_API_KEY;
const skipTests = !TEST_API_KEY;

// Skip auto-deletion if SKIP_CLEANUP env var is set
const SKIP_CLEANUP = process.env.SKIP_CLEANUP === "true";

if (skipTests) {
	console.log("\n⚠️  E2E Restart-only tests skipped!");
	console.log(
		"Set PHALA_CLOUD_API_KEY environment variable to run these tests.\n",
	);
}

describe.skipIf(skipTests)(
	"Phala Cloud CLI - Restart-Only E2E Test",
	() => {
		let logger: TestLogger;
		let appId: string | undefined;
		let vmUuid: string | undefined;
		const testName = `phala-e2e-restart-${Date.now()}`;

		beforeAll(async () => {
			logger = createTestLogger("restart-only");
			logger.step("E2E Restart Test Starting", {
				testName,
				timestamp: new Date().toISOString(),
				apiKeyProvided: !!TEST_API_KEY,
				skipCleanup: SKIP_CLEANUP,
			});
		});

		afterAll(async () => {
			if (SKIP_CLEANUP) {
				logger.warn("⚠️  SKIP_CLEANUP=true - Skipping afterAll cleanup");
				if (appId) {
					logger.info(`CVM still running: ${appId} (${vmUuid})`);
				}
			} else if (appId) {
				logger.step("Cleanup: Deleting test CVM");
				try {
					await cleanupCvm(logger, appId, TEST_API_KEY);
				} catch (error) {
					logger.warn(`Cleanup failed: ${error}`);
				}
			}

			logger.step("E2E Restart Test Completed", {
				logPath: logger.getLogPath(),
			});
		});

		// Phase 1: Setup & Authentication
		test(
			"Phase 1: Verify authentication and user info",
			async () => {
				logger.step("Phase 1: Setup & Authentication");

				const client = createClient({ apiKey: TEST_API_KEY });
				const result = await safeGetCurrentUser(client);

				if (!result.success) {
					logger.error("Failed to authenticate", result.error);
					throw new Error("Authentication failed");
				}

				const userInfo = result.data as {
					username?: string;
					team_name?: string;
					email?: string;
				};

				logger.success("Authentication successful");
				logger.info("User info:", {
					username: userInfo.username,
					team: userInfo.team_name,
					email: userInfo.email,
				});

				expect(userInfo.username).toBeDefined();
				expect(result.success).toBe(true);
			},
			{ timeout: 300000 }, // 5 minutes
		);

		// Phase 2: Pre-deployment Checks
		test(
			"Phase 2: Verify available nodes and dstack API",
			async () => {
				logger.step("Phase 2: Pre-deployment Checks");

				const client = createClient({ apiKey: TEST_API_KEY });
				const result = await safeGetAvailableNodes(client);

				if (!result.success) {
					logger.error("Failed to get available nodes", result.error);
					throw new Error("Failed to get available nodes");
				}

				const nodesData = result.data as { nodes?: unknown[] };
				const nodes = nodesData.nodes || [];

				logger.success(`Found ${nodes.length} available nodes`);
				logger.info("Nodes:", nodes);

				expect(nodes.length).toBeGreaterThan(0);
				expect(result.success).toBe(true);
			},
			{ timeout: 180000 }, // 3 minutes
		);

		// Phase 3: Deploy New CVM
		test(
			"Phase 3: Deploy new CVM using CLI",
			async () => {
				logger.step("Phase 3: Deploy New CVM");

				// Build test Docker image first
				logger.info("Building test Docker image...");
				const buildCmd = `docker build -t phala-e2e-test:v1.0.0 ${path.join(__dirname, "fixtures/test-app")}`;

				try {
					const { stdout, stderr } = await execaCommand(buildCmd);
					logger.info("Docker build output:", { stdout, stderr });
				} catch (error) {
					logError(logger, error, "Docker build failed");
					throw error;
				}

				logger.success("Docker image built successfully");

				// Create temporary .env file
				const envPath = path.join(__dirname, "fixtures/test-app/.env");
				fs.writeFileSync(
					envPath,
					"BUILD_VERSION=1.0.0\nTEST_ENV_VAR=e2e-testing\n",
				);

				// Deploy using CLI
				logger.info("Deploying CVM via CLI...");

				const deployCmd = `phala deploy -n ${testName} -c ${path.join(__dirname, "fixtures/test-app/docker-compose.yml")} -e ${envPath} --json`;

				try {
					const { stdout } = await execaCommand(deployCmd, {
						env: {
							...process.env,
							PHALA_CLOUD_API_KEY: TEST_API_KEY,
						},
					});

					logger.info("Deploy output:", stdout);

					// Parse JSON output
					const jsonMatch = stdout.match(/\{[\s\S]*\}/);
					if (!jsonMatch) {
						throw new Error(`No JSON found in output: ${stdout}`);
					}
					const deployResult = JSON.parse(jsonMatch[0]);
					logger.saveArtifact("deploy-result", JSON.stringify(deployResult, null, 2));

					if (deployResult.success) {
						appId = deployResult.app_id;
						vmUuid = deployResult.vm_uuid;

						logger.success("CVM deployed successfully", {
							appId,
							vmUuid,
							dashboardUrl: deployResult.dashboard_url,
						});

						expect(appId).toBeDefined();
						expect(vmUuid).toBeDefined();
					} else {
						throw new Error(`Deployment failed: ${deployResult.error}`);
					}
				} catch (error) {
					logError(logger, error, "Deployment failed");
					throw error;
				}

				// Cleanup temp env file
				fs.unlinkSync(envPath);
			},
			{ timeout: 600000 }, // 10 minutes
		);

		// Phase 4: Verify Initial Deployment
		test(
			"Phase 4: Verify CVM is running and accessible",
			async () => {
				if (!appId || !vmUuid) {
					throw new Error("CVM not deployed yet");
				}

				logger.step("Phase 4: Verify Initial Deployment");

				// Wait for CVM to be running
				await waitForCvmStatus(logger, vmUuid, "running", 300000, TEST_API_KEY);

				// Get CVM details
				const cvmDetails = await getCvmDetails(vmUuid, TEST_API_KEY);
				logger.info("CVM details:", cvmDetails);

				const cvm = cvmDetails as {
					vcpu?: number;
					memory?: number;
					disk_size?: number;
					status?: string;
				};

				expect(cvm.status).toBe("running");
				logger.success("CVM is running");
			},
			{ timeout: 600000 }, // 10 minutes
		);

		// Phase 5: SKIP UPDATE - Go directly to power management

		// Phase 6: Power Management (Restart Test)
		test(
			"Phase 6: Test restart with retry logic",
			async () => {
				if (!appId || !vmUuid) {
					throw new Error("CVM not deployed yet");
				}

				logger.step("Phase 6: Test Restart");

				// Test restart
				logger.info("Restarting CVM...");
				const restartCmd = `phala cvms restart ${appId}`;

				try {
					const { stdout, stderr } = await execaCommand(restartCmd, {
						env: {
							...process.env,
							PHALA_CLOUD_API_KEY: TEST_API_KEY,
						},
					});
					logger.success("Restart command executed");
					logger.info("Restart output:", { stdout, stderr });

					// Wait for running status after restart
					await waitForCvmStatus(
						logger,
						vmUuid,
						"running",
						300000,
						TEST_API_KEY,
					);
					logger.success("CVM restarted successfully");
				} catch (error) {
					logError(logger, error, "Restart failed");
					throw error;
				}

				logger.success("Phase 6 completed: Restart verified");
			},
			{ timeout: 600000 }, // 10 minutes
		);

		// Phase 7: Cleanup
		test(
			"Phase 7: Delete CVM and verify cleanup",
			async () => {
				if (!appId) {
					logger.warn("No CVM to delete");
					return;
				}

				logger.step("Phase 7: Cleanup");

				if (SKIP_CLEANUP) {
					logger.warn("⚠️  SKIP_CLEANUP=true - Skipping Phase 7 deletion");
					logger.info(`CVM still running: ${appId} (${vmUuid})`);
					logger.info("Manual cleanup required: phala cvms delete <app-id> -y");
					return;
				}

				// Delete CVM
				logger.info(`Deleting CVM ${appId}...`);
				const deleteCmd = `phala cvms delete ${appId} -y`;

				try {
					await execaCommand(deleteCmd, {
						env: {
							...process.env,
							PHALA_CLOUD_API_KEY: TEST_API_KEY,
						},
					});
					logger.success("Delete command executed");

					// Wait a bit for deletion to process
					await new Promise((resolve) => setTimeout(resolve, 10000));

					logger.success("CVM deletion initiated");
				} catch (error) {
					logError(logger, error, "Delete failed");
					throw error;
				}

				logger.success("Phase 7 completed: Cleanup successful");

				// Mark appId as undefined so afterAll doesn't try to clean up again
				appId = undefined;
			},
			{ timeout: 300000 }, // 5 minutes
		);
	},
);
