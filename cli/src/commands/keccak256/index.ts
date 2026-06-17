import { keccak256 as viemKeccak256, hexToBytes, toHex, type Hex } from "viem";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { keccak256CommandMeta, keccak256CommandSchema } from "./command";
import type { Keccak256CommandInput } from "./command";

function normalizeHex(value: string): Hex {
	const stripped = value.startsWith("0x") ? value.slice(2) : value;
	if (!/^[0-9a-fA-F]*$/.test(stripped) || stripped.length === 0) {
		throw new Error(`Invalid hex value: ${value}`);
	}
	if (stripped.length % 2 !== 0) {
		throw new Error(`Hex value must have even length: ${value}`);
	}
	return `0x${stripped.toLowerCase()}` as Hex;
}

export function concatBytes(arrays: Uint8Array[]): Uint8Array {
	const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const arr of arrays) {
		result.set(arr, offset);
		offset += arr.length;
	}
	return result;
}

export function computeKeccak256(hexValues: string[]): string {
	const parts = hexValues.map((v) => hexToBytes(normalizeHex(v)));
	const concatenated = concatBytes(parts);
	const digest = viemKeccak256(concatenated);
	return digest.slice(2);
}

export function runKeccak256Command(
	input: Keccak256CommandInput,
	context: CommandContext,
): number {
	try {
		const result = computeKeccak256(input.hexValues);
		context.stdout.write(`${result}\n`);
		return 0;
	} catch (error) {
		context.fail(
			error instanceof Error ? error.message : "Failed to compute keccak256",
		);
		return 1;
	}
}

export const keccak256Command = defineCommand({
	path: ["keccak256"],
	meta: keccak256CommandMeta,
	schema: keccak256CommandSchema,
	handler: runKeccak256Command,
});
