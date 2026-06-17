import { describe, expect, test } from "bun:test";
import { computeKeccak256 } from "../../src/commands/keccak256/index";

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
