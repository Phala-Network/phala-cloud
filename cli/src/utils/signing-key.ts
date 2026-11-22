import type { Hex } from "viem";

export function resolveSigningKey(value: string | undefined): Hex {
	if (!value) {
		throw new Error(
			"Set PRIVATE_KEY or pass --private-key with the app owner's private key.",
		);
	}
	const hex = value.replace(/^0x/i, "");
	if (!/^[0-9a-f]{64}$/i.test(hex)) {
		throw new Error("The private key must be a 32-byte hex value.");
	}
	return `0x${hex}`;
}

/** Do not forward untrusted RPC errors with signing material intact. */
export function signingError(error: unknown, privateKey: Hex): Error {
	const message =
		error instanceof Error ? error.message : "The transaction failed.";
	const pattern = new RegExp(`(?:0x)?${privateKey.slice(2)}`, "gi");
	return new Error(message.replace(pattern, "[private key hidden]"));
}
