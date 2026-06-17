import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
	computeKeccak256,
	computeKeccak256Raw,
} from "../../src/commands/keccak256sum/index";

// ── computeKeccak256 ──────────────────────────────────────────────────

describe("computeKeccak256", () => {
	test("mr_config_id v2 test vector", () => {
		const composeHash =
			"4f475ed201ac079f2e4760fb7554763edcc97c48132d554666a2ec3fd2c9e099";
		const appId = "8d8f406cf93e1cf54207fbf99c9bc437dd4d6aef";
		const keyProvider = "0x02";
		const keyProviderId =
			"3059301306072a8648ce3d020106082a8648ce3d030107034200048844eb42ccdf8c52fd4f174f362fcb9bbd19c45fd48f1edec2d8f1ca23536ec1a74021b4cee610c074f8294d431b2b7fee2c39e5333fdaf0a4522d43fb159d9f";

		const result = computeKeccak256([
			composeHash,
			appId,
			keyProvider,
			keyProviderId,
		]);

		expect(result).toBe(
			"dd0db3893b8c47b5e4098d7630d22959a1423af536890d10aaf3f0a7b169921b",
		);
	});

	test("accepts 0x-prefixed inputs", () => {
		const result = computeKeccak256([
			"0x4f475ed201ac079f2e4760fb7554763edcc97c48132d554666a2ec3fd2c9e099",
			"0x8d8f406cf93e1cf54207fbf99c9bc437dd4d6aef",
			"0x02",
			"0x3059301306072a8648ce3d020106082a8648ce3d030107034200048844eb42ccdf8c52fd4f174f362fcb9bbd19c45fd48f1edec2d8f1ca23536ec1a74021b4cee610c074f8294d431b2b7fee2c39e5333fdaf0a4522d43fb159d9f",
		]);

		expect(result).toBe(
			"dd0db3893b8c47b5e4098d7630d22959a1423af536890d10aaf3f0a7b169921b",
		);
	});

	test("single input", () => {
		const result = computeKeccak256(["0xdeadbeef"]);
		expect(result).toHaveLength(64);
	});

	test("rejects invalid hex", () => {
		expect(() => computeKeccak256(["not-hex"])).toThrow("Invalid hex value");
	});

	test("rejects odd-length hex", () => {
		expect(() => computeKeccak256(["abc"])).toThrow("even length");
	});
});

// ── computeKeccak256Raw ───────────────────────────────────────────────

describe("computeKeccak256Raw", () => {
	test("empty input produces known keccak256 of empty bytes", () => {
		const result = computeKeccak256Raw(new Uint8Array(0));
		expect(result).toBe(
			"c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
		);
	});
});

// ── check mode parsing ────────────────────────────────────────────────

describe("check mode (runKeccak256sumCommand)", () => {
	const {
		runKeccak256sumCommand,
	} = require("../../src/commands/keccak256sum/index");

	let tmpFile: string;

	function makeContext(overrides?: { stdinIsTTY?: boolean }) {
		const out: string[] = [];
		const err: string[] = [];
		return {
			out,
			err,
			ctx: {
				argv: [],
				rawFlags: {},
				rawPositionals: [],
				cwd: process.cwd(),
				env: process.env,
				stdout: {
					write: (s: string) => out.push(s),
					isTTY: false,
				} as unknown as NodeJS.WriteStream,
				stderr: {
					write: (s: string) => err.push(s),
					isTTY: false,
				} as unknown as NodeJS.WriteStream,
				stdin: {
					isTTY: overrides?.stdinIsTTY ?? true,
				} as unknown as NodeJS.ReadStream,
				projectConfig: {},
				success: () => {},
				fail: (msg: string) => err.push(msg),
			},
		};
	}

	beforeEach(() => {
		tmpFile = join(tmpdir(), `keccak256sum-test-${Date.now()}.txt`);
	});

	afterEach(() => {
		try {
			unlinkSync(tmpFile);
		} catch {}
	});

	test("-c verifies correct checksum", async () => {
		const hash = computeKeccak256(["deadbeef"]);
		writeFileSync(tmpFile, `${hash}  deadbeef\n`);

		const { ctx, out } = makeContext();
		const code = await runKeccak256sumCommand(
			{ hexValues: [tmpFile], check: true, quiet: false, status: false },
			ctx,
		);
		expect(code).toBe(0);
		expect(out.join("")).toContain("OK");
	});

	test("-c detects wrong checksum", async () => {
		writeFileSync(tmpFile, `${"aa".repeat(32)}  deadbeef\n`);

		const { ctx, out, err } = makeContext();
		const code = await runKeccak256sumCommand(
			{ hexValues: [tmpFile], check: true, quiet: false, status: false },
			ctx,
		);
		expect(code).toBe(1);
		expect(out.join("")).toContain("FAILED");
		expect(err.join("")).toContain("WARNING");
	});

	test("-c --quiet suppresses OK", async () => {
		const hash = computeKeccak256(["deadbeef"]);
		writeFileSync(tmpFile, `${hash}  deadbeef\n`);

		const { ctx, out } = makeContext();
		const code = await runKeccak256sumCommand(
			{ hexValues: [tmpFile], check: true, quiet: true, status: false },
			ctx,
		);
		expect(code).toBe(0);
		expect(out.join("")).toBe("");
	});

	test("-c --status suppresses all output", async () => {
		writeFileSync(tmpFile, `${"aa".repeat(32)}  deadbeef\n`);

		const { ctx, out, err } = makeContext();
		const code = await runKeccak256sumCommand(
			{ hexValues: [tmpFile], check: true, quiet: false, status: true },
			ctx,
		);
		expect(code).toBe(1);
		expect(out.join("")).toBe("");
		expect(err.join("")).toBe("");
	});

	test("-c skips comment and empty lines", async () => {
		const hash = computeKeccak256(["deadbeef"]);
		writeFileSync(tmpFile, `# comment\n\n${hash}  deadbeef\n`);

		const { ctx, out } = makeContext();
		const code = await runKeccak256sumCommand(
			{ hexValues: [tmpFile], check: true, quiet: false, status: false },
			ctx,
		);
		expect(code).toBe(0);
		expect(out.join("")).toContain("OK");
	});

	test("-c with multi-part hex input", async () => {
		const hash = computeKeccak256(["aabb", "ccdd"]);
		writeFileSync(tmpFile, `${hash}  aabb ccdd\n`);

		const { ctx, out } = makeContext();
		const code = await runKeccak256sumCommand(
			{ hexValues: [tmpFile], check: true, quiet: false, status: false },
			ctx,
		);
		expect(code).toBe(0);
		expect(out.join("")).toContain("OK");
	});

	test("no args + TTY stdin shows usage", async () => {
		const { ctx, err } = makeContext({ stdinIsTTY: true });
		const code = await runKeccak256sumCommand(
			{ hexValues: [], check: false, quiet: false, status: false },
			ctx,
		);
		expect(code).toBe(1);
		expect(err.join("")).toContain("Usage:");
	});

	test("positional args output md5sum-style format", async () => {
		const { ctx, out } = makeContext();
		const code = await runKeccak256sumCommand(
			{ hexValues: ["deadbeef"], check: false, quiet: false, status: false },
			ctx,
		);
		expect(code).toBe(0);
		const output = out.join("");
		expect(output).toMatch(/^[0-9a-f]{64}\s{2}deadbeef\n$/);
	});
});
