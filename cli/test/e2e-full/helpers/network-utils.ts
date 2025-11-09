import type { TestLogger } from "./logger";

interface RetryOptions {
	maxAttempts?: number;
	delayMs?: number;
	backoffMultiplier?: number;
}

/**
 * Test HTTP endpoint with retry logic
 */
export async function testHttpEndpoint(
	url: string,
	expectedContent?: string,
	options: RetryOptions = {},
): Promise<boolean> {
	const { maxAttempts = 5, delayMs = 2000, backoffMultiplier = 1.5 } = options;

	let currentDelay = delayMs;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			const response = await fetch(url, {
				method: "GET",
				headers: {
					"User-Agent": "Phala-E2E-Test/1.0",
				},
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			if (expectedContent) {
				const body = await response.text();
				if (!body.includes(expectedContent)) {
					throw new Error(
						`Response does not contain expected content: ${expectedContent}`,
					);
				}
			}

			return true;
		} catch (error) {
			if (attempt === maxAttempts) {
				throw new Error(
					`Failed after ${maxAttempts} attempts: ${error instanceof Error ? error.message : String(error)}`,
				);
			}

			// Wait before retrying
			await new Promise((resolve) => setTimeout(resolve, currentDelay));
			currentDelay *= backoffMultiplier;
		}
	}

	return false;
}

/**
 * Extract public URL from app-id and port
 */
export function buildPublicUrl(
	appId: string,
	port: number,
	gatewayDomain?: string,
): string {
	// Remove app_ prefix if present
	const cleanAppId = appId.replace(/^app_/, "");
	const domain = gatewayDomain || "dstack-prod5.phala.network";
	return `https://${cleanAppId}-${port}.${domain}`;
}

/**
 * Wait for port to be exposed and accessible
 */
export async function waitForPortExposed(
	logger: TestLogger,
	appId: string,
	port: number,
	timeoutMs = 120000,
	gatewayDomain?: string,
): Promise<string> {
	const url = buildPublicUrl(appId, port, gatewayDomain);
	const startTime = Date.now();

	logger.info(`Waiting for port ${port} to be exposed at ${url}`);

	while (Date.now() - startTime < timeoutMs) {
		try {
			const isAccessible = await testHttpEndpoint(url, undefined, {
				maxAttempts: 1,
			});

			if (isAccessible) {
				logger.success(`Port ${port} is now accessible at ${url}`);
				return url;
			}
		} catch (error) {
			// Continue waiting
		}

		// Wait 5 seconds before next check
		await new Promise((resolve) => setTimeout(resolve, 5000));
	}

	throw new Error(
		`Timeout waiting for port ${port} to be exposed (${timeoutMs}ms)`,
	);
}

/**
 * Test endpoint and verify JSON response
 */
export async function testJsonEndpoint<T = unknown>(
	url: string,
	expectedFields?: string[],
	options: RetryOptions = {},
): Promise<T> {
	const { maxAttempts = 5, delayMs = 2000, backoffMultiplier = 1.5 } = options;

	let currentDelay = delayMs;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			const response = await fetch(url, {
				method: "GET",
				headers: {
					"User-Agent": "Phala-E2E-Test/1.0",
					Accept: "application/json",
				},
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();

			// Verify expected fields if provided
			if (expectedFields) {
				for (const field of expectedFields) {
					if (!(field in data)) {
						throw new Error(`Response missing expected field: ${field}`);
					}
				}
			}

			return data as T;
		} catch (error) {
			if (attempt === maxAttempts) {
				throw new Error(
					`Failed after ${maxAttempts} attempts: ${error instanceof Error ? error.message : String(error)}`,
				);
			}

			// Wait before retrying
			await new Promise((resolve) => setTimeout(resolve, currentDelay));
			currentDelay *= backoffMultiplier;
		}
	}

	throw new Error("Unexpected error in testJsonEndpoint");
}
