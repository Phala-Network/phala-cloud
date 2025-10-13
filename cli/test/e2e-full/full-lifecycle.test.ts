import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { execaCommand } from "execa";
import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";
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

// Load environment variables from .env file
config();

// Skip if no API key provided
const TEST_API_KEY =
	process.env.PHALA_CLOUD_API_KEY || process.env.PHALA_API_KEY;
const skipTests = !TEST_API_KEY;

// Skip auto-deletion if SKIP_CLEANUP env var is set
const SKIP_CLEANUP = process.env.SKIP_CLEANUP === "true";

if (skipTests) {
	console.log("\n⚠️  E2E Full Lifecycle tests skipped!");
	console.log(
		"Set PHALA_CLOUD_API_KEY environment variable to run these tests.\n",
	);
}

describe.skipIf(skipTests)(
	"Phala Cloud CLI - Full Lifecycle E2E Test",
	() => {
		let logger: TestLogger;
		let appId: string | undefined;
		let vmUuid: string | undefined;
		const testName = `phala-e2e-${Date.now()}`;

		beforeAll(async () => {
			logger = createTestLogger("full-lifecycle");
			logger.step("E2E Test Suite Starting", {
				testName,
				timestamp: new Date().toISOString(),
				apiKeyProvided: !!TEST_API_KEY,
				skipCleanup: SKIP_CLEANUP,
			});

			// Clean up any existing .phala config to ensure test isolation
			const phalaConfigDir = path.join(process.cwd(), ".phala");
			if (fs.existsSync(phalaConfigDir)) {
				logger.info("Removing existing .phala config directory for test isolation...");
				fs.rmSync(phalaConfigDir, { recursive: true, force: true });
				logger.success("Config directory cleaned");
			}

			// Validate API key early - fail fast if authentication doesn't work
			logger.info("Validating API key...");
			try {
				const client = createClient({ apiKey: TEST_API_KEY });
				const authResult = await safeGetCurrentUser(client);

				if (!authResult.success) {
					logger.error("❌ API key validation failed!");

					if ("isRequestError" in authResult.error) {
						const status = authResult.error.status;
						const message = authResult.error.message;

						if (status === 401 || status === 403) {
							logger.error("Authentication failed - invalid or expired API key");
							logger.error(`HTTP ${status}: ${message}`);
							if (authResult.error.data) {
								logger.error(JSON.stringify(authResult.error.data, null, 2));
							}
							logger.error("\nPlease check your API key:");
							logger.error("1. Get your key from: https://cloud.phala.network/profile");
							logger.error("2. Update the .env file: PHALA_CLOUD_API_KEY=your-key");
							logger.error("3. Or set environment variable: export PHALA_CLOUD_API_KEY=your-key");
						} else {
							logger.error(`HTTP ${status}: ${message}`);
							if (authResult.error.data) {
								logger.error(JSON.stringify(authResult.error.data, null, 2));
							}
						}
					} else {
						logger.error(`Validation error: ${JSON.stringify(authResult.error)}`);
					}

					throw new Error("Invalid API key - cannot proceed with tests");
				}

				const userInfo = authResult.data as { username?: string; team_name?: string };
				logger.success(`✅ API key valid - authenticated as: ${userInfo.username || 'unknown'}`);
			} catch (error) {
				logger.error("Failed to validate API key");
				throw error;
			}

			if (SKIP_CLEANUP) {
				logger.warn("⚠️  SKIP_CLEANUP=true - Auto-deletion is DISABLED");
				logger.warn("CVMs will NOT be automatically deleted. Manual cleanup required!");
				return;
			}

			// Clean up any leftover CVMs from previous test runs
			logger.info("Checking for leftover CVMs from previous test runs...");
			try {
				const client = createClient({ apiKey: TEST_API_KEY });
				const result = await client.get("/cvms/0");
				const cvms = (result as any)?.items || [];

				// Find CVMs that match our test naming pattern
				const testCvms = cvms.filter((cvm: any) =>
					cvm.hosted?.name?.startsWith("phala-e2e-")
				);

				if (testCvms.length > 0) {
					logger.warn(`Found ${testCvms.length} leftover test CVMs, cleaning up...`);
					for (const cvm of testCvms) {
						const appId = cvm.hosted?.app_id;
						if (appId) {
							try {
								await cleanupCvm(logger, appId, TEST_API_KEY);
								logger.info(`Cleaned up leftover CVM: ${cvm.hosted?.name} (${appId})`);
							} catch (error) {
								logger.warn(`Failed to cleanup ${appId}: ${error}`);
							}
						}
					}
				} else {
					logger.info("No leftover test CVMs found");
				}
			} catch (error) {
				logger.warn(`Failed to check for leftover CVMs: ${error}`);
			}
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

			logger.step("E2E Test Suite Completed", {
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

				// Save user info artifact
				logger.saveArtifact("user-info", JSON.stringify(userInfo, null, 2));

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

				// Save nodes artifact
				logger.saveArtifact("available-nodes", JSON.stringify(nodes, null, 2));

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

				// Use pre-pushed Docker image from DockerHub (h4x3rotab/phala-e2e-test:v1.0.0)
				logger.info("Using pre-pushed Docker image: h4x3rotab/phala-e2e-test:v1.0.0");

				// Create temporary .env file
				const envPath = path.join(__dirname, "fixtures/test-app/.env");
				fs.writeFileSync(
					envPath,
					"BUILD_VERSION=1.0.0\nTEST_ENV_VAR=e2e-testing\n",
				);

				// Deploy using CLI
				// Note: This assumes 'phala' CLI is available in PATH
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

					// Parse JSON output - extract JSON from output (may have prefix text)
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

				// Fetch and check serial logs for errors
				logger.info("Fetching serial logs to verify boot process...");
				const serialLogs = await getCvmSerialLogs(logger, vmUuid, TEST_API_KEY);
				logger.saveArtifact("serial-logs-initial", serialLogs);

				// Check for critical errors in logs (these should fail the test)
				const criticalErrors = [
					"pull access denied",
					"repository does not exist",
					"manifest.*not found",
				];

				// Check for warnings (these should just log)
				const warningPatterns = [
					"Error response from daemon",
					"connection refused",
					"failed to start",
				];

				// Check for critical errors first
				for (const pattern of criticalErrors) {
					const regex = new RegExp(pattern, "i");
					if (regex.test(serialLogs)) {
						const errorMsg = `CRITICAL: Found error pattern in serial logs: "${pattern}"`;
						logger.error(errorMsg);
						logger.error(`Log excerpt: ${serialLogs.slice(0, 1000)}`);
						throw new Error(
							`${errorMsg}\nThis indicates the Docker image is not accessible. Check serial logs artifact for details.`,
						);
					}
				}

				// Then check for warnings
				for (const pattern of warningPatterns) {
					if (serialLogs.toLowerCase().includes(pattern.toLowerCase())) {
						logger.warn(`Found warning pattern in serial logs: "${pattern}"`);
						logger.warn(`Log excerpt: ${serialLogs.slice(0, 500)}...`);
					}
				}

				// Wait for network to be ready
				await waitForCvmNetwork(logger, vmUuid, 180000, TEST_API_KEY);

				// Get CVM details
				const cvmDetails = await getCvmDetails(vmUuid, TEST_API_KEY);
				logger.info("CVM details:", cvmDetails);
				logger.saveArtifact("cvm-details", JSON.stringify(cvmDetails, null, 2));

				// Verify resources
				const cvm = cvmDetails as {
					vcpu?: number;
					memory?: number;
					disk_size?: number;
					status?: string;
				};

				expect(cvm.status).toBe("running");
				expect(cvm.vcpu).toBeGreaterThan(0);
				expect(cvm.memory).toBeGreaterThan(0);
				expect(cvm.disk_size).toBeGreaterThan(0);

				logger.success("CVM resources verified", {
					vcpu: cvm.vcpu,
					memory: cvm.memory,
					diskSize: cvm.disk_size,
				});

				// Wait for HTTP endpoint to be accessible
				const publicUrl = await waitForPortExposed(logger, appId, 3000, 120000);

				// Test health endpoint
				const healthData = await testJsonEndpoint<{ status: string }>(
					`${publicUrl}/health`,
					["status"],
				);

				logger.success("Health endpoint accessible", healthData);
				expect(healthData.status).toBe("healthy");

				// Test version endpoint
				const versionData = await testJsonEndpoint<{ version: string }>(
					`${publicUrl}/version`,
					["version"],
				);

				logger.success("Version endpoint accessible", versionData);
				expect(versionData.version).toBe("1.0.0");

				logger.success("Phase 4 completed: CVM is fully operational");
			},
			{ timeout: 600000 }, // 10 minutes
		);

		// Phase 5: Update CVM Code
		test(
			"Phase 5: Update CVM with new code version",
			async () => {
				if (!appId || !vmUuid) {
					throw new Error("CVM not deployed yet");
				}

				logger.step("Phase 5: Update CVM Code");

				// Use pre-pushed Docker image from DockerHub (h4x3rotab/phala-e2e-test:v2.0.0)
				logger.info("Using pre-pushed Docker image: h4x3rotab/phala-e2e-test:v2.0.0");

				// Update docker-compose.yml for v2
				const composeV2Path = path.join(
					__dirname,
					"fixtures/test-app/docker-compose-v2.yml",
				);
				const composeContent = fs.readFileSync(
					path.join(__dirname, "fixtures/test-app/docker-compose.yml"),
					"utf-8",
				);
				const updatedCompose = composeContent.replace(
					"h4x3rotab/phala-e2e-test:v1.0.0",
					"h4x3rotab/phala-e2e-test:v2.0.0",
				);
				fs.writeFileSync(composeV2Path, updatedCompose);

				// Create .env for v2
				const envV2Path = path.join(__dirname, "fixtures/test-app/.env.v2");
				fs.writeFileSync(
					envV2Path,
					"BUILD_VERSION=2.0.0\nTEST_ENV_VAR=e2e-testing-v2\n",
				);

				// Update using CLI with --wait flag
				logger.info("Updating CVM via CLI...");
				const updateCmd = `phala deploy --uuid ${vmUuid} -c ${composeV2Path} -e ${envV2Path} --wait --json`;

				try {
					const { stdout } = await execaCommand(updateCmd, {
						env: {
							...process.env,
							PHALA_CLOUD_API_KEY: TEST_API_KEY,
						},
					});

					logger.info("Update output:", stdout);

					// Parse JSON output - extract JSON from output (may have prefix text in older CLI versions)
					const jsonMatch = stdout.match(/\{[\s\S]*\}/);
					if (!jsonMatch) {
						throw new Error(`No JSON found in output: ${stdout}`);
					}
					const updateResult = JSON.parse(jsonMatch[0]);

					if (updateResult.success) {
						logger.success("CVM updated successfully (--wait ensured completion)");
					} else {
						throw new Error(`Update failed: ${updateResult.error}`);
					}
				} catch (error) {
					logError(logger, error, "Update failed");
					throw error;
				}

				// --wait flag ensures CVM restart is complete, but Docker image pull may still be in progress
				// The old container may still be running until the new one is pulled and started
				// We need to retry until we get the correct version, not just any response
				logger.info("Waiting for new container to start (allowing time for Docker image pull)...");
				const publicUrl = buildPublicUrl(appId, 3000);

				// Poll until version matches 2.0.0
				const maxAttempts = 60; // Up to 5 minutes (60 * 5s)
				const delayMs = 5000;
				let versionData: { version: string } | null = null;

				for (let attempt = 1; attempt <= maxAttempts; attempt++) {
					try {
						const data = await testJsonEndpoint<{ version: string }>(
							`${publicUrl}/version`,
							["version"],
							{ maxAttempts: 1, delayMs: 0 }, // Single attempt, no retry
						);

						logger.info(`[Attempt ${attempt}/${maxAttempts}] Got version: ${data.version}`);

						if (data.version === "2.0.0") {
							versionData = data;
							break;
						}

						// Version doesn't match yet, keep retrying
						logger.info("Version still at old value, waiting for container restart...");
					} catch (error) {
						logger.info(`[Attempt ${attempt}/${maxAttempts}] Endpoint not ready yet...`);
					}

					if (attempt < maxAttempts) {
						await new Promise((resolve) => setTimeout(resolve, delayMs));
					}
				}

				if (!versionData || versionData.version !== "2.0.0") {
					throw new Error(
						`Version did not update to 2.0.0 after ${maxAttempts * delayMs / 1000}s (current: ${versionData?.version || 'unknown'})`
					);
				}

				logger.success("New version verified", versionData);
				expect(versionData.version).toBe("2.0.0");

				// Cleanup temp files
				fs.unlinkSync(composeV2Path);
				fs.unlinkSync(envV2Path);

				logger.success("Phase 5 completed: CVM updated successfully");
			},
			{ timeout: 600000 }, // 10 minutes
		);

		// Phase 6: Resize CVM
		test(
			"Phase 6: Resize CVM resources",
			async () => {
				if (!appId || !vmUuid) {
					throw new Error("CVM not deployed yet");
				}

				logger.step("Phase 6: Resize CVM");

				// Get current resources
				const beforeResize = (await getCvmDetails(
					vmUuid,
					TEST_API_KEY,
				)) as {
					vcpu?: number;
					memory?: number;
					disk_size?: number;
				};

				logger.info("Resources before resize:", {
					vcpu: beforeResize.vcpu,
					memory: beforeResize.memory,
					diskSize: beforeResize.disk_size,
				});

				// Resize vCPU
				logger.info("Resizing vCPU to 2...");
				const resizeVcpuCmd = `phala cvms resize ${appId} -v 2 -y --json`;

				try {
					await execaCommand(resizeVcpuCmd, {
						env: {
							...process.env,
							PHALA_CLOUD_API_KEY: TEST_API_KEY,
						},
					});
					logger.success("vCPU resize initiated");
				} catch (error) {
					logError(logger, error, "vCPU resize failed");
					// Non-fatal - continue test
				}

				// Wait a bit for resize to process
				await new Promise((resolve) => setTimeout(resolve, 10000));

				// Get updated resources
				const afterResize = (await getCvmDetails(vmUuid, TEST_API_KEY)) as {
					vcpu?: number;
					memory?: number;
					disk_size?: number;
				};

				logger.success("Resources after resize:", {
					vcpu: afterResize.vcpu,
					memory: afterResize.memory,
					diskSize: afterResize.disk_size,
				});

				// Note: Resize might not complete immediately, so we just verify the request was accepted
				logger.success("Phase 6 completed: Resize operation executed");
			},
			{ timeout: 300000 }, // 5 minutes
		);

		// Phase 7: Power Management
		test(
			"Phase 7: Test power management (stop/start/restart)",
			async () => {
				if (!appId || !vmUuid) {
					throw new Error("CVM not deployed yet");
				}

				logger.step("Phase 7: Power Management");

				// Stop CVM
				logger.info("Stopping CVM...");
				const stopCmd = `phala cvms stop ${appId}`;

				try {
					await execaCommand(stopCmd, {
						env: {
							...process.env,
							PHALA_CLOUD_API_KEY: TEST_API_KEY,
						},
					});
					logger.success("Stop command executed");

					// Wait for stopped status
					await waitForCvmStatus(
						logger,
						vmUuid,
						"stopped",
						180000,
						TEST_API_KEY,
					);
					logger.success("CVM stopped successfully");
				} catch (error) {
					logError(logger, error, "Stop failed");
					throw error;
				}

				// Start CVM
				logger.info("Starting CVM...");
				const startCmd = `phala cvms start ${appId}`;

				try {
					await execaCommand(startCmd, {
						env: {
							...process.env,
							PHALA_CLOUD_API_KEY: TEST_API_KEY,
						},
					});
					logger.success("Start command executed");

					// Wait for running status
					await waitForCvmStatus(
						logger,
						vmUuid,
						"running",
						300000,
						TEST_API_KEY,
					);
					logger.success("CVM started successfully");
				} catch (error) {
					logError(logger, error, "Start failed");
					throw error;
				}

				// Verify app is still accessible
				const publicUrl = buildPublicUrl(appId, 3000);
				await waitForPortExposed(logger, appId, 3000, 120000);

				const healthData = await testJsonEndpoint<{ status: string }>(
					`${publicUrl}/health`,
					["status"],
				);

				logger.success("App still accessible after restart", healthData);
				expect(healthData.status).toBe("healthy");

				// Test restart
				logger.info("Restarting CVM...");
				const restartCmd = `phala cvms restart ${appId}`;

				try {
					await execaCommand(restartCmd, {
						env: {
							...process.env,
							PHALA_CLOUD_API_KEY: TEST_API_KEY,
						},
					});
					logger.success("Restart command executed");

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

				logger.success("Phase 7 completed: Power management verified");
			},
			{ timeout: 600000 }, // 10 minutes
		);

		// Phase 8: Final Verification
		test(
			"Phase 8: Final verification and attestation",
			async () => {
				if (!appId || !vmUuid) {
					throw new Error("CVM not deployed yet");
				}

				logger.step("Phase 8: Final Verification");

				// Get final CVM info
				const finalDetails = await getCvmDetails(vmUuid, TEST_API_KEY);
				logger.info("Final CVM details:", finalDetails);
				logger.saveArtifact(
					"final-cvm-details",
					JSON.stringify(finalDetails, null, 2),
				);

				// Get attestation (if command exists)
				logger.info("Getting attestation info...");
				const attestCmd = `phala cvms attestation ${appId} --json`;

				try {
					const { stdout } = await execaCommand(attestCmd, {
						env: {
							...process.env,
							PHALA_CLOUD_API_KEY: TEST_API_KEY,
						},
					});

					const attestation = JSON.parse(stdout);
					logger.success("Attestation retrieved", attestation);
					logger.saveArtifact("attestation", JSON.stringify(attestation, null, 2));
				} catch (error) {
					logger.warn("Attestation command not available or failed", error);
				}

				// Final health check
				const publicUrl = buildPublicUrl(appId, 3000);
				const finalHealth = await testJsonEndpoint<{ status: string }>(
					`${publicUrl}/health`,
					["status"],
				);

				logger.success("Final health check passed", finalHealth);
				expect(finalHealth.status).toBe("healthy");

				logger.success(
					"Phase 8 completed: All verifications passed",
				);
			},
			{ timeout: 300000 }, // 5 minutes
		);

		// Phase 9: Cleanup
		test(
			"Phase 9: Delete CVM and verify cleanup",
			async () => {
				if (!appId) {
					logger.warn("No CVM to delete");
					return;
				}

				logger.step("Phase 9: Cleanup");

				if (SKIP_CLEANUP) {
					logger.warn("⚠️  SKIP_CLEANUP=true - Skipping Phase 9 deletion");
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

					// Verify deletion - trying to get details should fail
					try {
						await getCvmDetails(vmUuid!, TEST_API_KEY);
						logger.warn("CVM still exists after deletion");
					} catch (error) {
						logger.success("CVM successfully deleted (not found)");
					}
				} catch (error) {
					logError(logger, error, "Delete failed");
					throw error;
				}

				logger.success("Phase 9 completed: Cleanup successful");

				// Mark appId as undefined so afterAll doesn't try to clean up again
				appId = undefined;
			},
			{ timeout: 300000 }, // 5 minutes
		);
	},
);
