/**
 * The recorded `--dev-os` choice.
 *
 * A create records how the flag was satisfied so a later update can repeat it;
 * the dev box only ever exists in the payload, never in the compose file on
 * disk. The record lives in the CLI state file, keyed per CVM.
 */

import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import { getStateFilePath } from "@/src/utils/state";
import { logger } from "@/src/utils/logger";
import {
	forgetDevOsMode,
	recallDevOsMode,
	rememberDevOsMode,
} from "./dev-os-selection";

describe("recorded dev OS mode", () => {
	const previousDir = process.env.PHALA_CLOUD_DIR;
	let stateDir: string;

	beforeEach(async () => {
		stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "phala-dev-os-"));
		process.env.PHALA_CLOUD_DIR = stateDir;
	});

	afterEach(async () => {
		if (previousDir === undefined) {
			process.env.PHALA_CLOUD_DIR = undefined;
		} else {
			process.env.PHALA_CLOUD_DIR = previousDir;
		}
		await fs.remove(stateDir);
	});

	test("records and returns the mode per CVM", () => {
		rememberDevOsMode("cvm-a", "dev-box");
		rememberDevOsMode("cvm-b", "dev-image");

		expect(recallDevOsMode("cvm-a")).toBe("dev-box");
		expect(recallDevOsMode("cvm-b")).toBe("dev-image");
		expect(recallDevOsMode("cvm-c")).toBeUndefined();
	});

	test("writes to the CLI state file, not the project directory", () => {
		rememberDevOsMode("cvm-a", "dev-box");

		const state = fs.readJsonSync(getStateFilePath()) as Record<
			string,
			unknown
		>;
		expect(state["deploy.devOsMode.cvm-a"]).toBe("dev-box");
	});

	test("ignores a value it does not recognise", () => {
		fs.outputFileSync(
			getStateFilePath(),
			JSON.stringify({ "deploy.devOsMode.cvm-a": "maybe" }),
		);

		expect(recallDevOsMode("cvm-a")).toBeUndefined();
	});

	test("forgets the record, so a later update adds nothing back", () => {
		rememberDevOsMode("cvm-a", "dev-box");
		forgetDevOsMode("cvm-a");

		expect(recallDevOsMode("cvm-a")).toBeUndefined();
	});

	test("a failed write warns instead of failing the deployment", () => {
		// A regular file where the state directory should be: creating the
		// directory fails, and the deploy must not.
		fs.outputFileSync(path.join(stateDir, "blocked"), "");
		process.env.PHALA_CLOUD_DIR = path.join(stateDir, "blocked");
		const warn = spyOn(logger, "warn").mockImplementation(() => {});
		try {
			expect(() => rememberDevOsMode("cvm-a", "dev-box")).not.toThrow();
			expect(warn).toHaveBeenCalled();
			expect(recallDevOsMode("cvm-a")).toBeUndefined();
		} finally {
			warn.mockRestore();
		}
	});
});
