import { z } from "zod";
import {
	cvmIdOption,
	interactiveOption,
	privateKeyOption,
	rpcUrlOption,
	transactionHashOption,
} from "@/src/core/common-flags";
import type {
	CommandGroup,
	CommandMeta,
	CommandOption,
} from "@/src/core/types";
import { portClosureSchema } from "@/src/lib/port-policy";
import { confirmPortClosureOption } from "@/src/lib/port-policy-confirmation";

export const portPolicyGroup: CommandGroup = {
	path: ["port-policy"],
	meta: {
		name: "port-policy",
		description: "Read or change the gateway port policy of a CVM",
		category: "manage",
		stability: "unstable",
	},
};

const targeting = [cvmIdOption, interactiveOption];
const readSchema = z.object({
	cvmId: z.string().optional(),
	interactive: z.boolean().default(false),
	json: z.boolean().default(false),
});

const writeOptions: readonly CommandOption[] = [
	...targeting,
	{ name: "yes", type: "boolean", description: "Confirm the policy update" },
	confirmPortClosureOption,
	{
		name: "wait",
		type: "boolean",
		description: "Wait for the update to complete",
	},
	{
		name: "prepare-only",
		type: "boolean",
		description: "Prepare an on-chain update without signing it",
	},
	{
		name: "compose-hash",
		type: "string",
		description: "Compose hash from a prepared update",
	},
	transactionHashOption,
	privateKeyOption,
	rpcUrlOption,
];

const writeSchema = readSchema.extend({
	yes: z.boolean().default(false),
	confirmClose: z.array(portClosureSchema).default([]),
	wait: z.boolean().default(false),
	prepareOnly: z.boolean().default(false),
	composeHash: z.string().min(1).optional(),
	transactionHash: z.string().min(1).optional(),
	privateKey: z.string().optional(),
	rpcUrl: z.string().optional(),
});

export type PortPolicyWriteInput = z.output<typeof writeSchema>;

function commandMeta(
	name: string,
	description: string,
	options: readonly CommandOption[],
): CommandMeta {
	return {
		name,
		description,
		options,
		stability: "unstable",
		interactiveCvmSelection: { identifier: "uuid" },
	};
}

export const showMeta: CommandMeta = {
	...commandMeta("show", "Show declared gateway policy and pending updates", [
		...targeting,
		{
			name: "app-id",
			type: "string",
			description: "Read the policy of every instance in this app",
		},
	]),
	interactiveCvmSelection: { identifier: "uuid", skipWhenOption: "appId" },
};
export const showSchema = readSchema.extend({
	appId: z.string().min(1).optional(),
});

const portArgument = [
	{
		name: "port",
		target: "ports",
		description: "One or more guest ports (1–65535)",
		variadic: true,
	},
] as const;

export const allowMeta = {
	...commandMeta(
		"allow",
		"Allow ports or change their PROXY protocol setting",
		[
			...writeOptions,
			{
				name: "proxy-protocol",
				negatedName: "no-proxy-protocol",
				type: "boolean",
				description: "Turn PROXY protocol on or off for these ports",
			},
		],
	),
	arguments: portArgument,
};
export const allowSchema = writeSchema.extend({
	ports: z.array(z.string()).default([]),
	proxyProtocol: z.boolean().optional(),
});

export const denyMeta = {
	...commandMeta(
		"deny",
		"Remove ports from a restricted gateway policy",
		writeOptions,
	),
	arguments: portArgument,
};
export const denySchema = writeSchema.extend({
	ports: z.array(z.string()).default([]),
});

export const replaceMeta = commandMeta(
	"replace",
	"Replace the complete gateway port policy",
	[
		...writeOptions,
		{
			name: "restrict",
			negatedName: "no-restrict",
			type: "boolean",
			description: "Forward only listed ports, or forward all ports",
		},
		{
			name: "port",
			target: "ports",
			type: "string[]",
			description: "Port without PROXY protocol (repeatable)",
		},
		{
			name: "proxy-protocol-port",
			target: "proxyPorts",
			type: "string[]",
			description: "Port with PROXY protocol (repeatable)",
		},
		{ name: "deny-all", type: "boolean", description: "Forward no ports" },
		{
			name: "file",
			type: "string",
			argumentName: "path|-",
			description: "Read the full JSON policy from a file or stdin",
		},
	],
);
export const replaceSchema = writeSchema.extend({
	restrict: z.boolean().optional(),
	ports: z.array(z.string()).default([]),
	proxyPorts: z.array(z.string()).default([]),
	denyAll: z.boolean().default(false),
	file: z.string().min(1).optional(),
});
export type PortPolicyReplaceInput = z.output<typeof replaceSchema>;
