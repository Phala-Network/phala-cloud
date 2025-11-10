/**
 * v1.0.40 Interface Baseline Specification
 *
 * This file documents the ACTUAL CLI interface from phala@1.0.40
 * (installed from npm and tested on 2025-11-09) to ensure
 * backward compatibility in newer versions.
 *
 * IMPORTANT: This is the REAL v1.0.40 interface, not assumptions.
 */

export interface FlagSpec {
	long: string;
	short?: string;
	required: boolean;
	description?: string;
}

export interface CommandSpec {
	name: string;
	description?: string;
	flags: Record<string, FlagSpec>;
	defaults?: Record<string, unknown>;
	hasHelp: boolean;
}

/**
 * Complete interface specification for v1.0.40
 */
export const v1_0_40_interface = {
	// Top-level commands
	commands: {
		status: {
			name: "status",
			hasHelp: true,
			flags: {
				json: { long: "--json", short: "-j", required: false },
				debug: { long: "--debug", short: "-d", required: false },
				apiKey: { long: "--api-key", required: false }, // v1.0.40 used --api-key
			},
		} as CommandSpec,

		// NOTE: v1.0.40 did NOT have a top-level 'login' command
		// It only had 'auth login'. The current version added this as a shortcut.

		deploy: {
			name: "deploy",
			hasHelp: true,
			flags: {
				name: { long: "--name", short: "-n", required: false },
				compose: { long: "--compose", short: "-c", required: false },
				envFile: { long: "--env-file", short: "-e", required: false },
				vcpu: { long: "--vcpu", required: false },
				memory: { long: "--memory", required: false },
				diskSize: { long: "--disk-size", required: false },
				image: { long: "--image", required: false },
				nodeId: { long: "--node-id", required: false },
				uuid: { long: "--uuid", required: false },
				json: { long: "--json", required: false },
				noJson: { long: "--no-json", required: false }, // v1.0.40 HAD THIS
				debug: { long: "--debug", required: false },
				apiKey: { long: "--api-key", required: false }, // v1.0.40 used --api-key
				interactive: { long: "--interactive", short: "-i", required: false },
				kmsId: { long: "--kms-id", required: false },
				preLaunchScript: { long: "--pre-launch-script", required: false },
				privateKey: { long: "--private-key", required: false },
				rpcUrl: { long: "--rpc-url", required: false },
			},
			defaults: {
				vcpu: 1,
				memory: 2048,
				diskSize: 40,
			},
		} as CommandSpec,

		// NOTE: v1.0.40 did NOT have 'completion' command
		// This was added in current version
	},

	// Auth subcommands
	authCommands: {
		login: {
			name: "auth login",
			hasHelp: true,
			flags: {},
		} as CommandSpec,

		logout: {
			name: "auth logout",
			hasHelp: true,
			flags: {},
		} as CommandSpec,

		status: {
			name: "auth status",
			hasHelp: true,
			flags: {
				json: { long: "--json", short: "-j", required: false },
				debug: { long: "--debug", short: "-d", required: false },
			},
		} as CommandSpec,
	},

	// CVMs subcommands
	cvmsCommands: {
		create: {
			name: "cvms create",
			hasHelp: true,
			flags: {
				name: { long: "--name", short: "-n", required: false },
				compose: { long: "--compose", short: "-c", required: false },
				envFile: { long: "--env-file", short: "-e", required: false },
				vcpu: { long: "--vcpu", required: false },
				memory: { long: "--memory", required: false },
				diskSize: { long: "--disk-size", required: false },
				teepodId: { long: "--teepod-id", required: false },
				image: { long: "--image", required: false },
				skipEnv: { long: "--skip-env", required: false },
				debug: { long: "--debug", required: false },
			},
			defaults: {
				vcpu: 1,
				memory: 2048,
				diskSize: 40,
			},
		} as CommandSpec,

		list: {
			name: "cvms list",
			hasHelp: true,
			aliases: ["cvms ls"],
			flags: {
				json: { long: "--json", short: "-j", required: false },
			},
		} as CommandSpec,

		get: {
			name: "cvms get",
			hasHelp: true,
			flags: {
				json: { long: "--json", short: "-j", required: false },
			},
		} as CommandSpec,

		delete: {
			name: "cvms delete",
			hasHelp: true,
			flags: {
				force: { long: "--force", short: "-f", required: false },
			},
		} as CommandSpec,

		start: {
			name: "cvms start",
			hasHelp: true,
			flags: {},
		} as CommandSpec,

		stop: {
			name: "cvms stop",
			hasHelp: true,
			flags: {},
		} as CommandSpec,

		restart: {
			name: "cvms restart",
			hasHelp: true,
			flags: {},
		} as CommandSpec,

		resize: {
			name: "cvms resize",
			hasHelp: true,
			flags: {
				vcpu: { long: "--vcpu", short: "-v", required: false },
				memory: { long: "--memory", short: "-m", required: false },
				diskSize: { long: "--disk-size", short: "-d", required: false },
				allowRestart: { long: "--allow-restart", short: "-r", required: false },
				yes: { long: "--yes", short: "-y", required: false },
				// NOTE: v1.0.40 did NOT have --json flag on resize
				// This was added in current version
			},
		} as CommandSpec,

		upgrade: {
			name: "cvms upgrade",
			hasHelp: true,
			flags: {
				compose: { long: "--compose", short: "-c", required: false },
				envFile: { long: "--env-file", short: "-e", required: false },
				debug: { long: "--debug", required: false },
			},
		} as CommandSpec,

		replicate: {
			name: "cvms replicate",
			hasHelp: true,
			flags: {
				teepodId: { long: "--teepod-id", required: false },
				envFile: { long: "--env-file", short: "-e", required: false },
			},
		} as CommandSpec,

		attestation: {
			name: "cvms attestation",
			hasHelp: true,
			flags: {
				json: { long: "--json", short: "-j", required: false },
			},
		} as CommandSpec,

		listNodes: {
			name: "cvms list-nodes",
			hasHelp: true,
			flags: {},
		} as CommandSpec,
	},

	// Docker subcommands
	dockerCommands: {
		login: {
			name: "docker login",
			hasHelp: true,
			flags: {
				registry: { long: "--registry", required: false },
				username: { long: "--username", required: false },
				password: { long: "--password", required: false },
			},
		} as CommandSpec,

		build: {
			name: "docker build",
			hasHelp: true,
			flags: {
				image: { long: "--image", short: "-i", required: true },
				tag: { long: "--tag", short: "-t", required: true },
				file: { long: "--file", short: "-f", required: false },
			},
		} as CommandSpec,

		push: {
			name: "docker push",
			hasHelp: true,
			flags: {
				image: { long: "--image", short: "-i", required: true },
			},
		} as CommandSpec,

		generate: {
			name: "docker generate",
			hasHelp: true,
			flags: {
				image: { long: "--image", short: "-i", required: true },
				envFile: { long: "--env-file", short: "-e", required: false },
				output: { long: "--output", short: "-o", required: false },
				template: { long: "--template", required: false },
			},
		} as CommandSpec,
	},

	// Simulator subcommands
	simulatorCommands: {
		start: {
			name: "simulator start",
			hasHelp: true,
			flags: {},
		} as CommandSpec,

		stop: {
			name: "simulator stop",
			hasHelp: true,
			flags: {},
		} as CommandSpec,

		status: {
			name: "simulator",
			hasHelp: true,
			flags: {},
		} as CommandSpec,
	},

	// Nodes commands
	nodesCommands: {
		list: {
			name: "nodes list",
			hasHelp: true,
			aliases: ["nodes ls", "nodes"],
			flags: {
				json: { long: "--json", short: "-j", required: false },
			},
		} as CommandSpec,
	},

	// Config subcommands
	configCommands: {
		get: {
			name: "config get",
			hasHelp: true,
			flags: {},
		} as CommandSpec,

		set: {
			name: "config set",
			hasHelp: true,
			flags: {},
		} as CommandSpec,

		list: {
			name: "config list",
			hasHelp: true,
			aliases: ["config ls"],
			flags: {
				json: { long: "--json", short: "-j", required: false },
			},
		} as CommandSpec,
	},
};

/**
 * Get all commands from the baseline
 */
export function getAllCommands(): string[] {
	const commands: string[] = [];

	// Add top-level commands
	for (const cmd of Object.values(v1_0_40_interface.commands)) {
		commands.push(cmd.name);
	}

	// Add subcommands
	for (const group of [
		v1_0_40_interface.authCommands,
		v1_0_40_interface.cvmsCommands,
		v1_0_40_interface.dockerCommands,
		v1_0_40_interface.simulatorCommands,
		v1_0_40_interface.nodesCommands,
		v1_0_40_interface.configCommands,
	]) {
		for (const cmd of Object.values(group)) {
			commands.push(cmd.name);
		}
	}

	return commands;
}

/**
 * Get a command spec by name
 */
export function getCommandSpec(commandName: string): CommandSpec | undefined {
	// Check all command groups
	for (const group of [
		v1_0_40_interface.commands,
		v1_0_40_interface.authCommands,
		v1_0_40_interface.cvmsCommands,
		v1_0_40_interface.dockerCommands,
		v1_0_40_interface.simulatorCommands,
		v1_0_40_interface.nodesCommands,
		v1_0_40_interface.configCommands,
	]) {
		for (const cmd of Object.values(group)) {
			if (cmd.name === commandName) {
				return cmd;
			}
		}
	}

	return undefined;
}
