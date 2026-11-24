import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { createClient } from "@phala/cloud";
import { getEncryptPubkey } from "./get-encrypt-pubkey";

const appId = `0x${"a1".repeat(20)}`;
const publicKey = "ab".repeat(32);
// Legacy KMS signature for this app ID and public key, using a fixture signer.
const signature =
	"ae3616e3db118c34ea8d787b1b42115a4da47caa6f08a0c6260a75da24610f5c3b8f9ec72dbb0c26c566f5d076c5ab2224b6566c6c2afb7e946203df480c329f00";
const kmsPublicKey =
	"031b84c5567b126440995d3ed5aaba0565d71e1834604819ff9c17f5e9d5dd078f";
const cvm = {
	app_id: appId,
	kms_type: "base",
	kms_info: { chain_id: 8453, k256_pubkey: `0x${kmsPublicKey.toUpperCase()}` },
};
const baseURL = "https://api.example.test";
const client = createClient({ baseURL, retry: 0 });

function signedKey() {
	return Response.json({ public_key: publicKey, signature });
}

function waiting(eta: number | null) {
	const details = Object.entries({
		chain_id: 8453,
		chain_name: "Base",
		registration_block: null,
		policy_block: 50,
		finality_confirmations: null,
		eta_seconds: eta,
	}).map(([field, value]) => ({ field, value }));
	return Response.json(
		{ error_code: "ERR-12-008", message: "Finality pending on Base.", details },
		{ status: 409, headers: { "Retry-After": "0" } },
	);
}

function mockFetch() {
	const transport: {
		fetch: (...args: Parameters<typeof fetch>) => Promise<Response>;
	} = globalThis;
	return spyOn(transport, "fetch");
}

afterEach(() => mock.restore());

describe("getEncryptPubkey", () => {
	test.each([
		[
			{ kms_info: { chain_id: null, encrypted_env_pubkey: "nested" } },
			"nested",
		],
		[{ kms_info: { encrypted_env_pubkey: "nested" } }, "nested"],
		[
			{
				encrypted_env_pubkey: "legacy",
				kms_info: { chain_id: null, encrypted_env_pubkey: null },
			},
			"legacy",
		],
		[
			{
				encrypted_env_pubkey: "legacy",
				kms_info: { chain_id: null, encrypted_env_pubkey: "nested" },
			},
			"nested",
		],
		[{ encrypted_env_pubkey: "legacy", kms_info: null }, "legacy"],
	] as const)(
		"uses the existing centralized key fields (%j)",
		async (fields, expected) => {
			const fetch = mockFetch();
			expect(
				await getEncryptPubkey(client, { kms_type: "phala", ...fields }),
			).toBe(expected);
			expect(fetch).not.toHaveBeenCalled();
		},
	);

	test.each([{ chain_id: null, encrypted_env_pubkey: null }, null])(
		"reports a missing centralized key (%j)",
		async (kms_info) => {
			await expect(getEncryptPubkey(client, { kms_info })).rejects.toThrow(
				"CVM does not have an encryption public key",
			);
		},
	);

	test.each([
		["base", "base"],
		["kms_base_old_node", "kms_base_old_node"],
		[null, "base-contract"],
	] as const)(
		"preserves the KMS selector and verifies a signed key (%s)",
		async (kms_type, selector) => {
			const fetch = mockFetch().mockImplementation(async () => signedKey());
			const result = await getEncryptPubkey(client, {
				...cvm,
				kms_type,
				kms_info: {
					...cvm.kms_info,
					slug: "base-contract",
					id: "kms_unused_node",
				},
			});
			expect(result).toBe(publicKey);
			expect(fetch.mock.calls.map(([url]) => url)).toEqual([
				`${baseURL}/kms/${selector}/pubkey/${appId}`,
			]);
		},
	);

	test("falls back to a string KMS ID but never a numeric output ID", async () => {
		const fetch = mockFetch().mockImplementation(async () => signedKey());
		const legacyCvm = { ...cvm, kms_type: null };
		await expect(
			getEncryptPubkey(client, {
				...legacyCvm,
				kms_info: { ...cvm.kms_info, id: "kms_old_node" },
			}),
		).resolves.toBe(publicKey);
		await expect(
			getEncryptPubkey(client, {
				...legacyCvm,
				kms_info: { ...cvm.kms_info, id: 42 },
			}),
		).rejects.toThrow("KMS type is required");
		expect(fetch.mock.calls.map(([url]) => url)).toEqual([
			`${baseURL}/kms/kms_old_node/pubkey/${appId}`,
		]);
	});

	test("requires an app ID and the KMS signature verification key", async () => {
		mockFetch().mockImplementation(async () => signedKey());
		await expect(
			getEncryptPubkey(client, { ...cvm, app_id: null }),
		).rejects.toThrow("app_id is required");
		await expect(
			getEncryptPubkey(client, { ...cvm, kms_info: { chain_id: 8453 } }),
		).rejects.toThrow("KMS k256_pubkey is required");
	});

	test("rejects a signature from a different KMS", async () => {
		mockFetch().mockImplementation(async () => signedKey());
		await expect(
			getEncryptPubkey(client, {
				...cvm,
				kms_info: { chain_id: 8453, k256_pubkey: "another-kms-key" },
			}),
		).rejects.toThrow("does not match KMS");
	});

	test.each([409, 404])(
		"passes unrelated or legacy HTTP %i errors through",
		async (status) => {
			const message = status === 404 ? "KMS not found" : "Unrelated conflict";
			const fetch = mockFetch().mockImplementation(async () =>
				Response.json({ detail: message }, { status }),
			);
			await expect(getEncryptPubkey(client, cvm)).rejects.toMatchObject({
				message,
				status,
			});
			expect(fetch).toHaveBeenCalledTimes(1);
		},
	);

	test("does not retry or print progress for a definitively unregistered app", async () => {
		const message = "App is not registered on Base.";
		const fetch = mockFetch().mockImplementation(async () =>
			Response.json({ error_code: "ERR-12-009", message }, { status: 404 }),
		);
		const stderr = spyOn(process.stderr, "write").mockImplementation(
			() => true,
		);
		await expect(getEncryptPubkey(client, cvm)).rejects.toMatchObject({
			status: 404,
			message,
		});
		expect(stderr).not.toHaveBeenCalled();
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	test.each([
		[1200, "Estimated time remaining: 1200 seconds."],
		[null, "No finality estimate is available."],
	] as const)(
		"prints exactly one progress line while waiting (ETA: %s)",
		async (eta, suffix) => {
			const fetch = mockFetch()
				.mockImplementationOnce(async () => waiting(eta))
				.mockImplementationOnce(async () => waiting(eta))
				.mockImplementationOnce(async () => signedKey());
			const stderr = spyOn(process.stderr, "write").mockImplementation(
				() => true,
			);
			expect(await getEncryptPubkey(client, cvm)).toBe(publicKey);
			expect(fetch).toHaveBeenCalledTimes(3);
			const output = stderr.mock.calls.map(([value]) => String(value)).join("");
			expect(output.trimEnd().split("\n")).toHaveLength(1);
			expect(output).toContain(
				`Waiting for the KMS environment encryption public key: app registration is not yet finalized on Base. ${suffix}`,
			);
		},
	);
});
