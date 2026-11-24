import { describe, expect, test } from "bun:test";
import { execa, parseCommandString } from "execa";
import path from "node:path";
import { config } from "dotenv";

// Load environment variables from .env file
config();

// Skip if no API key provided
const TEST_API_KEY =
	process.env.PHALA_CLOUD_API_KEY || process.env.PHALA_API_KEY;
const skipTests = !TEST_API_KEY;

// Path to the compiled CLI binary
const CLI_PATH = path.join(__dirname, "../../dist/index.js");
const CLI_CMD = `bun ${CLI_PATH}`;

if (skipTests) {
	console.log("\n⚠️  Nodes list test skipped!");
	console.log(
		"Set PHALA_CLOUD_API_KEY environment variable to run this test.\n",
	);
}

describe.skipIf(skipTests)("Phala Cloud CLI - Nodes List E2E Test", () => {
	test("nodes list --json returns valid JSON with at least one node", async () => {
		const fullCommand = `${CLI_CMD} nodes list --json`;

		const [file, ...args] = parseCommandString(fullCommand);
		const result = await execa(file, args, {
			env: {
				...process.env,
				PHALA_CLOUD_API_KEY: TEST_API_KEY,
			},
		});

		// Parse JSON output
		const nodesResult = JSON.parse(result.stdout);

		// Verify structure
		expect(nodesResult).toHaveProperty("nodes");
		expect(Array.isArray(nodesResult.nodes)).toBe(true);

		// Verify at least one node is available
		expect(nodesResult.nodes.length).toBeGreaterThan(0);

		// Verify each node has required fields
		for (const node of nodesResult.nodes) {
			expect(node).toHaveProperty("teepod_id");
			expect(node).toHaveProperty("name");
			expect(node).toHaveProperty("region_identifier");
			expect(node).toHaveProperty("images");
			expect(Array.isArray(node.images)).toBe(true);
			expect(node.images.length).toBeGreaterThan(0);
		}
	});
});
