import { z } from "zod";
import type { CommandMeta, CommandGroup } from "@/src/core/types";
import { cvmIdArgument, interactiveOption } from "@/src/core/common-flags";
import { jsonOption } from "@/src/commands/status/command";

export const cvmsDevicesGroup: CommandGroup = {
	path: ["cvms", "devices"],
	meta: {
		name: "devices",
		description: "Manage on-chain device allowlist for a CVM's app contract",
		stability: "unstable",
	},
};

// ── list ────────────────────────────────────────────────────────────

export const cvmsDevicesListMeta: CommandMeta = {
	name: "list",
	description: "List allowed devices from the on-chain contract",
	stability: "unstable",
	arguments: [cvmIdArgument],
	options: [jsonOption, interactiveOption],
	examples: [
		{
			name: "List devices on-chain",
			value: "phala cvms devices list app_abc123",
		},
	],
};

export const cvmsDevicesListSchema = z.object({
	cvmId: z.string().optional(),
	json: z.boolean().default(false),
	interactive: z.boolean().default(false),
});

export type CvmsDevicesListInput = z.infer<typeof cvmsDevicesListSchema>;

// ── add ─────────────────────────────────────────────────────────────

export const cvmsDevicesAddMeta: CommandMeta = {
	name: "add",
	description: "Add a device to the on-chain allowlist",
	stability: "unstable",
	arguments: [
		cvmIdArgument,
		{
			name: "device_id",
			description: "Device ID (bytes32 hex) to add",
			required: true,
			target: "deviceId",
		},
	],
	options: [
		{
			name: "private-key",
			description: "Private key for signing the transaction",
			type: "string",
			target: "privateKey",
			group: "advanced",
		},
		{
			name: "rpc-url",
			description: "Custom RPC URL for the blockchain",
			type: "string",
			target: "rpcUrl",
			group: "advanced",
		},
		jsonOption,
		interactiveOption,
	],
	examples: [
		{
			name: "Add device to allowlist",
			value: "phala cvms devices add app_abc123 0xaabb... --private-key 0x...",
		},
	],
};

export const cvmsDevicesAddSchema = z.object({
	cvmId: z.string().optional(),
	deviceId: z.string().optional(),
	privateKey: z.string().optional(),
	rpcUrl: z.string().optional(),
	json: z.boolean().default(false),
	interactive: z.boolean().default(false),
});

export type CvmsDevicesAddInput = z.infer<typeof cvmsDevicesAddSchema>;

// ── remove ──────────────────────────────────────────────────────────

export const cvmsDevicesRemoveMeta: CommandMeta = {
	name: "remove",
	description: "Remove a device from the on-chain allowlist",
	stability: "unstable",
	arguments: [
		cvmIdArgument,
		{
			name: "device_id",
			description: "Device ID (bytes32 hex) to remove",
			required: true,
			target: "deviceId",
		},
	],
	options: [
		{
			name: "private-key",
			description: "Private key for signing the transaction",
			type: "string",
			target: "privateKey",
			group: "advanced",
		},
		{
			name: "rpc-url",
			description: "Custom RPC URL for the blockchain",
			type: "string",
			target: "rpcUrl",
			group: "advanced",
		},
		jsonOption,
		interactiveOption,
	],
	examples: [
		{
			name: "Remove device from allowlist",
			value:
				"phala cvms devices remove app_abc123 0xaabb... --private-key 0x...",
		},
	],
};

export const cvmsDevicesRemoveSchema = z.object({
	cvmId: z.string().optional(),
	deviceId: z.string().optional(),
	privateKey: z.string().optional(),
	rpcUrl: z.string().optional(),
	json: z.boolean().default(false),
	interactive: z.boolean().default(false),
});

export type CvmsDevicesRemoveInput = z.infer<typeof cvmsDevicesRemoveSchema>;

// ── allow-any ───────────────────────────────────────────────────────

export const cvmsDevicesAllowAnyMeta: CommandMeta = {
	name: "allow-any",
	description: "Toggle the allow-any-device flag on the contract",
	stability: "unstable",
	arguments: [cvmIdArgument],
	options: [
		{
			name: "enable",
			description: "Enable allow-any-device (default)",
			type: "boolean",
			target: "enable",
		},
		{
			name: "disable",
			description: "Disable allow-any-device",
			type: "boolean",
			target: "disable",
		},
		{
			name: "private-key",
			description: "Private key for signing the transaction",
			type: "string",
			target: "privateKey",
			group: "advanced",
		},
		{
			name: "rpc-url",
			description: "Custom RPC URL for the blockchain",
			type: "string",
			target: "rpcUrl",
			group: "advanced",
		},
		jsonOption,
		interactiveOption,
	],
	examples: [
		{
			name: "Enable allow-any-device",
			value:
				"phala cvms devices allow-any app_abc123 --enable --private-key 0x...",
		},
		{
			name: "Disable allow-any-device",
			value:
				"phala cvms devices allow-any app_abc123 --disable --private-key 0x...",
		},
	],
};

export const cvmsDevicesAllowAnySchema = z.object({
	cvmId: z.string().optional(),
	enable: z.boolean().optional(),
	disable: z.boolean().optional(),
	privateKey: z.string().optional(),
	rpcUrl: z.string().optional(),
	json: z.boolean().default(false),
	interactive: z.boolean().default(false),
});

export type CvmsDevicesAllowAnyInput = z.infer<
	typeof cvmsDevicesAllowAnySchema
>;
