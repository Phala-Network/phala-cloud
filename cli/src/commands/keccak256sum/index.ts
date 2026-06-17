import { readFileSync } from "node:fs";
import { keccak256 as viemKeccak256, hexToBytes, type Hex } from "viem";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { keccak256sumCommandMeta, keccak256sumCommandSchema } from "./command";
import type { Keccak256sumCommandInput } from "./command";

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

export function computeKeccak256Raw(data: Uint8Array): string {
	return viemKeccak256(data).slice(2);
}

async function readStdin(stdin: NodeJS.ReadStream): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of stdin) {
		chunks.push(Buffer.from(chunk as Uint8Array));
	}
	return Buffer.concat(chunks).toString("utf-8").trim();
}

function runCheckMode(
	filePath: string,
	options: { quiet: boolean; status: boolean },
	context: CommandContext,
): number {
	let content: string;
	try {
		content = readFileSync(filePath, "utf-8");
	} catch {
		context.fail(`${filePath}: No such file`);
		return 1;
	}

	const lines = content.split("\n");
	let failures = 0;
	let checked = 0;

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;

		const match = trimmed.match(/^([0-9a-fA-F]{64})\s{2}(.+)$/);
		if (!match) {
			if (!options.status) {
				context.stderr.write(
					`keccak256sum: ${filePath}: improperly formatted line\n`,
				);
			}
			failures++;
			continue;
		}

		const [, expectedHash, hexInput] = match;
		const label = hexInput;

		if (hexInput === "-") {
			if (!options.status) {
				context.stderr.write(
					"keccak256sum: -: cannot verify stdin from checksum file\n",
				);
			}
			continue;
		}

		const hexValues = hexInput.split(/\s+/).filter(Boolean);

		try {
			const actual = computeKeccak256(hexValues);
			checked++;
			if (actual === expectedHash.toLowerCase()) {
				if (!options.quiet && !options.status) {
					context.stdout.write(`${label}: OK\n`);
				}
			} else {
				failures++;
				if (!options.status) {
					context.stdout.write(`${label}: FAILED\n`);
				}
			}
		} catch {
			failures++;
			if (!options.status) {
				context.stdout.write(`${label}: FAILED\n`);
			}
		}
	}

	if (failures > 0 && !options.status) {
		context.stderr.write(
			`keccak256sum: WARNING: ${failures} computed checksum(s) did NOT match\n`,
		);
	}

	return failures > 0 ? 1 : 0;
}

export async function runKeccak256sumCommand(
	input: Keccak256sumCommandInput,
	context: CommandContext,
): Promise<number> {
	if (input.check) {
		if (input.hexValues.length === 0) {
			context.fail("No checksum file specified");
			return 1;
		}
		return runCheckMode(
			input.hexValues[0],
			{ quiet: input.quiet, status: input.status },
			context,
		);
	}

	if (input.hexValues.length > 0) {
		try {
			const hash = computeKeccak256(input.hexValues);
			const label = input.hexValues.join(" ");
			context.stdout.write(`${hash}  ${label}\n`);
			return 0;
		} catch (error) {
			context.fail(
				error instanceof Error ? error.message : "Failed to compute keccak256",
			);
			return 1;
		}
	}

	if (context.stdin.isTTY) {
		context.stderr.write(
			"Usage: phala keccak256sum [options] <hex-value> [hex-value ...]\n\nCompute or verify keccak256 checksums of hex inputs.\nRead from stdin when no arguments are given.\n",
		);
		return 1;
	}

	try {
		const raw = await readStdin(context.stdin);
		const parts = raw.split(/\s+/).filter(Boolean);
		let hash: string;
		if (parts.length === 0) {
			hash = computeKeccak256Raw(new Uint8Array(0));
		} else {
			hash = computeKeccak256(parts);
		}
		context.stdout.write(`${hash}  -\n`);
		return 0;
	} catch (error) {
		context.fail(
			error instanceof Error ? error.message : "Failed to compute keccak256",
		);
		return 1;
	}
}

export const keccak256sumCommand = defineCommand({
	path: ["keccak256sum"],
	meta: keccak256sumCommandMeta,
	schema: keccak256sumCommandSchema,
	handler: runKeccak256sumCommand,
});
