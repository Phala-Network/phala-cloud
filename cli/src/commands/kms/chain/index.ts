import { safeGetKmsOnChainDetail } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import { printTable } from "@/src/lib/table";
import { logger } from "@/src/utils/logger";
import {
	kmsChainCommandMeta,
	kmsChainCommandSchema,
	type KmsChainCommandInput,
} from "./command";

// Block explorer base URL per chain id, for linking contract addresses.
const CHAIN_EXPLORERS: Record<number, string> = {
	1: "https://etherscan.io",
	8453: "https://basescan.org",
};

function explorerUrl(chainId: number, address: string): string | null {
	const base = CHAIN_EXPLORERS[chainId];
	return base ? `${base}/address/${address}` : null;
}

function formatAllowed(allowed: boolean | null | undefined): string {
	if (allowed === true) return "yes";
	if (allowed === false) return "no";
	return "-";
}

// Descending semver-ish comparison: split on ".", compare numerically segment
// by segment so 0.5.10 sorts above 0.5.4.1 above 0.5.4.
function compareVersionDesc(a: string, b: string): number {
	const pa = a.split(".").map((s) => Number.parseInt(s, 10) || 0);
	const pb = b.split(".").map((s) => Number.parseInt(s, 10) || 0);
	const len = Math.max(pa.length, pb.length);
	for (let i = 0; i < len; i++) {
		const diff = (pb[i] ?? 0) - (pa[i] ?? 0);
		if (diff !== 0) return diff;
	}
	return 0;
}

function createChainHandler(chain: string) {
	return async function runKmsChainCommand(
		input: KmsChainCommandInput,
		context: CommandContext,
	): Promise<number> {
		try {
			const client = await getClient(context);

			const result = await safeGetKmsOnChainDetail(client, {
				chain,
			});

			if (!result.success) {
				context.fail(result.error.message);
				return 1;
			}

			const data = result.data;

			if (input.json) {
				context.success(data);
				return 0;
			}

			if (data.contracts.length === 0) {
				logger.info(`No KMS contracts found on ${chain}`);
				return 0;
			}

			const LABEL_WIDTH = 13;
			const kv = (label: string, value: string) => {
				console.log(`${label.padEnd(LABEL_WIDTH)}${value}`);
			};

			data.contracts.forEach((contract, index) => {
				if (index > 0) console.log("");

				kv("Contract", contract.contract_address);
				const contractUrl = explorerUrl(
					contract.chain_id,
					contract.contract_address,
				);
				if (contractUrl) kv("", contractUrl);

				if (contract.gateway_contract_address) {
					kv("Gateway", contract.gateway_contract_address);
					const gatewayUrl = explorerUrl(
						contract.chain_id,
						contract.gateway_contract_address,
					);
					if (gatewayUrl) kv("", gatewayUrl);
				}

				kv("K256 pubkey", contract.k256_pubkey ?? "-");
				kv("CA pubkey", contract.ca_pubkey ?? "-");

				console.log("");
				console.log("Devices");
				if (contract.devices.length > 0) {
					const deviceColumns = ["DEVICE_ID", "NODE", "ON_CHAIN"] as const;
					const deviceRows = contract.devices.map((d) => ({
						DEVICE_ID: d.device_id,
						NODE:
							typeof d.node_name === "string" && d.node_name.length > 0
								? d.node_name
								: "-",
						ON_CHAIN: formatAllowed(d.on_chain_allowed),
					}));
					printTable(deviceColumns, deviceRows);
				} else {
					console.log("  none");
				}

				console.log("");
				console.log("OS Images");
				if (contract.os_images.length > 0) {
					const imageColumns = [
						"NAME",
						"VERSION",
						"OS_IMAGE_HASH",
						"ON_CHAIN",
					] as const;
					const imageRows = [...contract.os_images]
						.sort((a, b) => compareVersionDesc(a.version, b.version))
						.map((img) => ({
							NAME: img.name,
							VERSION: img.version,
							OS_IMAGE_HASH: img.os_image_hash ?? "-",
							ON_CHAIN: formatAllowed(img.on_chain_allowed),
						}));
					printTable(imageColumns, imageRows);
				} else {
					console.log("  none");
				}
			});

			return 0;
		} catch (error) {
			logger.logDetailedError(error);
			context.fail(
				`Failed to get KMS details for ${chain}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			return 1;
		}
	};
}

export const kmsEthereumCommand = defineCommand({
	path: ["kms", "ethereum"],
	meta: kmsChainCommandMeta("ethereum"),
	schema: kmsChainCommandSchema,
	handler: createChainHandler("ethereum"),
});

export const kmsBaseCommand = defineCommand({
	path: ["kms", "base"],
	meta: kmsChainCommandMeta("base"),
	schema: kmsChainCommandSchema,
	handler: createChainHandler("base"),
});
