import { z } from "zod";
import type { CommandMeta, CommandGroup } from "@/src/core/types";
import {
	interactiveOption,
	privateKeyOption,
	rpcUrlOption,
} from "@/src/core/common-flags";
import { jsonOption } from "@/src/commands/status/command";

// Use a custom cvm argument that does NOT match "cvmId" target,
// so the dispatcher won't intercept -i for CVM interactive selection.
const cvmArgument = {
	name: "cvm",
	description: "CVM or app identifier (UUID, app_id, instance_id, or name)",
	required: true,
	target: "cvm",
};

export const allowDevicesGroup: CommandGroup = {
	path: ["allow-devices"],
	meta: {
		name: "allow-devices",
		description: "Manage on-chain device allowlist for an app contract",
		stability: "unstable",
	},
};

// ── list ────────────────────────────────────────────────────────────

export const allowDevicesListMeta: CommandMeta = {
	name: "list",
	aliases: ["ls"],
	description: "List allowed devices from the on-chain contract",
	stability: "unstable",
	arguments: [cvmArgument],
	options: [rpcUrlOption, jsonOption],
	examples: [
		{
			name: "List devices on-chain",
			value: "phala allow-devices list app_abc123",
		},
	],
};

export const allowDevicesListSchema = z.object({
	cvm: z.string(),
	rpcUrl: z.string().optional(),
	json: z.boolean().default(false),
});

export type AllowDevicesListInput = z.infer<typeof allowDevicesListSchema>;

// ── add ─────────────────────────────────────────────────────────────

export const allowDevicesAddMeta: CommandMeta = {
	name: "add",
	description: "Add devices to the on-chain allowlist",
	stability: "unstable",
	arguments: [
		cvmArgument,
		{
			name: "device_id",
			description:
				"Device ID (bytes32 hex) or node name. Node names are resolved to device IDs from available nodes.",
			required: false,
			target: "deviceId",
		},
	],
	options: [
		privateKeyOption,
		rpcUrlOption,
		{
			name: "wait",
			description:
				"Wait for on-chain state to reflect the change via RPC polling",
			type: "boolean",
			target: "wait",
		},
		jsonOption,
		interactiveOption,
	],
	examples: [
		{
			name: "Add device to allowlist",
			value: "phala allow-devices add app_abc123 0xaabb... --private-key 0x...",
		},
		{
			name: "Interactive multi-select from available nodes",
			value: "phala allow-devices add app_abc123 -i --private-key 0x...",
		},
	],
};

export const allowDevicesAddSchema = z.object({
	cvm: z.string(),
	deviceId: z.string().optional(),
	privateKey: z.string().optional(),
	rpcUrl: z.string().optional(),
	wait: z.boolean().default(false),
	json: z.boolean().default(false),
	interactive: z.boolean().default(false),
});

export type AllowDevicesAddInput = z.infer<typeof allowDevicesAddSchema>;

// ── remove ──────────────────────────────────────────────────────────

export const allowDevicesRemoveMeta: CommandMeta = {
	name: "remove",
	aliases: ["rm"],
	description: "Remove devices from the on-chain allowlist",
	stability: "unstable",
	arguments: [
		cvmArgument,
		{
			name: "device_id",
			description:
				"Device ID (bytes32 hex) or node name. Node names are resolved to device IDs from available nodes.",
			required: false,
			target: "deviceId",
		},
	],
	options: [
		privateKeyOption,
		rpcUrlOption,
		{
			name: "wait",
			description:
				"Wait for on-chain state to reflect the change via RPC polling",
			type: "boolean",
			target: "wait",
		},
		jsonOption,
		interactiveOption,
	],
	examples: [
		{
			name: "Remove device from allowlist",
			value:
				"phala allow-devices remove app_abc123 0xaabb... --private-key 0x...",
		},
		{
			name: "Interactive multi-select from allowed devices",
			value: "phala allow-devices remove app_abc123 -i --private-key 0x...",
		},
	],
};

export const allowDevicesRemoveSchema = z.object({
	cvm: z.string(),
	deviceId: z.string().optional(),
	privateKey: z.string().optional(),
	rpcUrl: z.string().optional(),
	wait: z.boolean().default(false),
	json: z.boolean().default(false),
	interactive: z.boolean().default(false),
});

export type AllowDevicesRemoveInput = z.infer<typeof allowDevicesRemoveSchema>;

// ── allow-any ───────────────────────────────────────────────────────

export const allowDevicesAllowAnyMeta: CommandMeta = {
	name: "allow-any",
	description:
		"Set the allow-any-device flag on the contract. Requires --enable or --disable.",
	stability: "unstable",
	arguments: [cvmArgument],
	options: [
		{
			name: "enable",
			description: "Enable allow-any-device",
			type: "boolean",
			target: "enable",
		},
		{
			name: "disable",
			description: "Disable allow-any-device",
			type: "boolean",
			target: "disable",
		},
		privateKeyOption,
		rpcUrlOption,
		{
			name: "wait",
			description:
				"Wait for on-chain state to reflect the change via RPC polling",
			type: "boolean",
			target: "wait",
		},
		jsonOption,
	],
	examples: [
		{
			name: "Enable allow-any-device",
			value:
				"phala allow-devices allow-any app_abc123 --enable --private-key 0x...",
		},
		{
			name: "Disable allow-any-device",
			value:
				"phala allow-devices allow-any app_abc123 --disable --private-key 0x...",
		},
	],
};

export const allowDevicesAllowAnySchema = z.object({
	cvm: z.string(),
	enable: z.boolean().optional(),
	disable: z.boolean().optional(),
	privateKey: z.string().optional(),
	rpcUrl: z.string().optional(),
	wait: z.boolean().default(false),
	json: z.boolean().default(false),
});

export type AllowDevicesAllowAnyInput = z.infer<
	typeof allowDevicesAllowAnySchema
>;

// ── disallow-any ────────────────────────────────────────────────────

export const allowDevicesDisallowAnyMeta: CommandMeta = {
	name: "disallow-any",
	description:
		"Disable allow-any-device on the contract. Equivalent to `allow-any --disable`.",
	stability: "unstable",
	arguments: [cvmArgument],
	options: [
		privateKeyOption,
		rpcUrlOption,
		{
			name: "wait",
			description:
				"Wait for on-chain state to reflect the change via RPC polling",
			type: "boolean",
			target: "wait",
		},
		jsonOption,
	],
	examples: [
		{
			name: "Disable allow-any-device",
			value: "phala allow-devices disallow-any app_abc123 --private-key 0x...",
		},
	],
};

export const allowDevicesDisallowAnySchema = z.object({
	cvm: z.string(),
	privateKey: z.string().optional(),
	rpcUrl: z.string().optional(),
	wait: z.boolean().default(false),
	json: z.boolean().default(false),
});

export type AllowDevicesDisallowAnyInput = z.infer<
	typeof allowDevicesDisallowAnySchema
>;

// ── toggle-allow-any ────────────────────────────────────────────────

export const allowDevicesToggleAllowAnyMeta: CommandMeta = {
	name: "toggle-allow-any",
	description:
		"Toggle allow-any-device on the contract (or force via --enable/--disable)",
	stability: "unstable",
	arguments: [cvmArgument],
	options: [
		{
			name: "enable",
			description: "Force enable allow-any-device",
			type: "boolean",
			target: "enable",
		},
		{
			name: "disable",
			description: "Force disable allow-any-device",
			type: "boolean",
			target: "disable",
		},
		privateKeyOption,
		rpcUrlOption,
		{
			name: "wait",
			description:
				"Wait for on-chain state to reflect the change via RPC polling",
			type: "boolean",
			target: "wait",
		},
		jsonOption,
	],
	examples: [
		{
			name: "Toggle based on current state",
			value:
				"phala allow-devices toggle-allow-any app_abc123 --private-key 0x...",
		},
		{
			name: "Force enable",
			value:
				"phala allow-devices toggle-allow-any app_abc123 --enable --private-key 0x...",
		},
	],
};

export const allowDevicesToggleAllowAnySchema = z.object({
	cvm: z.string(),
	enable: z.boolean().optional(),
	disable: z.boolean().optional(),
	privateKey: z.string().optional(),
	rpcUrl: z.string().optional(),
	wait: z.boolean().default(false),
	json: z.boolean().default(false),
});

export type AllowDevicesToggleAllowAnyInput = z.infer<
	typeof allowDevicesToggleAllowAnySchema
>;
