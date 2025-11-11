import { z } from "zod";
import type { CommandMeta } from "@/src/core/types";

export const sshCommandMeta: CommandMeta = {
	name: "ssh",
	description: "Connect to a CVM via SSH",
	arguments: [
		{
			name: "cvm-id",
			description:
				"CVM ID (app_id or UUID). If not provided, reads from phala.toml",
			required: false,
			target: "cvmId",
		},
	],
	options: [
		{
			name: "identity",
			shorthand: "i",
			description: "SSH identity file (private key)",
			type: "string",
			target: "identity",
		},
		{
			name: "port",
			shorthand: "p",
			description: "SSH port (default: 443)",
			type: "string",
			target: "port",
		},
		{
			name: "gateway-domain",
			shorthand: "g",
			description: "Gateway domain (default: from API)",
			type: "string",
			target: "gatewayDomain",
		},
		{
			name: "timeout",
			shorthand: "t",
			description: "Connection timeout in seconds (default: 30)",
			type: "string",
			target: "timeout",
		},
		{
			name: "verbose",
			shorthand: "v",
			description: "Show verbose SSH connection details",
			type: "boolean",
			target: "verbose",
		},
	],
	examples: [
		{
			name: "Connect using app_id from phala.toml",
			value: "phala ssh",
		},
		{
			name: "Connect to a CVM by ID",
			value: "phala ssh app_123",
		},
		{
			name: "Connect with custom SSH key",
			value: "phala ssh app_123 -i ~/.ssh/custom_key",
		},
		{
			name: "Connect with custom port",
			value: "phala ssh app_123 -p 16185",
		},
		{
			name: "Connect with custom gateway domain",
			value: "phala ssh app_123 -g dstack-dev-v05x.phatfn.xyz -p 16185",
		},
		{
			name: "Connect with custom timeout",
			value: "phala ssh app_123 -t 60",
		},
		{
			name: "Connect with verbose output",
			value: "phala ssh app_123 -v",
		},
	],
};

export const sshCommandSchema = z.object({
	cvmId: z.string().optional(),
	identity: z.string().optional(),
	port: z.string().default("443"),
	gatewayDomain: z.string().optional(),
	timeout: z.string().default("30"),
	verbose: z.boolean().default(false),
});

export type SshCommandInput = z.infer<typeof sshCommandSchema>;
