#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dispatchCommand } from "./core/dispatcher";
import { migrateStorage } from "./core/migrate-storage";
import { CommandRegistry } from "./core/registry";
import { apiCommand } from "./commands/api";
import { authCommands } from "./commands/auth";
import { configCommands } from "./commands/config";
import { cvmsCommands } from "./commands/cvms";
import { deployCommand } from "./commands/deploy";
import { docsCommands } from "./commands/docs";
import { envsCommands } from "./commands/envs";
import { helpCommand } from "./commands/help";
import { linkCommand } from "./commands/link";
import { loginCommand } from "./commands/login";
import { logoutCommand } from "./commands/logout";
import { kmsCommands } from "./commands/kms";
import { nodesCommands } from "./commands/nodes";
import { osImagesCommand } from "./commands/os-images";
import { simulatorCommands } from "./commands/simulator";
import { statusCommand } from "./commands/status";
import {
	profilesCommand,
	profilesUseCommand,
	profilesRenameCommand,
	profilesDeleteCommand,
	profilesRefreshCommand,
} from "./commands/profiles";
import { switchCommand } from "./commands/switch";
import { completionCommand } from "./commands/completion";
import { sshCommand } from "./commands/ssh";
import { cpCommand } from "./commands/cp";
import { psCommand } from "./commands/ps";
import { logsCommand } from "./commands/logs";
import { selfCommands } from "./commands/self";
import { appsCommand } from "./commands/apps";
import { instancesGroup } from "./commands/instances/command";
import { instancesLsCommand } from "./commands/instances/ls";
import { instancesAddCommand } from "./commands/instances/add";
import { instancesRmCommand } from "./commands/instances/rm";
import { instanceTypesCommand } from "./commands/instance-types";
import { cvmsRuntimeConfigCommand } from "./commands/cvms/runtime-config";
import { sshKeysCommands } from "./commands/ssh-keys";
import { whoamiCommand } from "./commands/whoami";
import { allowDevicesCommands } from "./commands/allow-devices";
import { keccak256sumCommand } from "./commands/keccak256sum";
import { detectRuntimeFromProcess } from "./core/package-manager";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJsonPath = join(__dirname, "../package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

// __GIT_INFO__ is replaced at compile time by tsup/esbuild
declare const __GIT_INFO__: string;
const gitInfo = typeof __GIT_INFO__ !== "undefined" ? __GIT_INFO__ : "";
const version = `v${packageJson.version}${gitInfo}`;
const runtime = detectRuntimeFromProcess();

const registry = new CommandRegistry();

// Top-level commands
registry.registerCommand(deployCommand);
registry.registerCommand(appsCommand);
registry.registerGroup(instancesGroup);
registry.registerCommand(instancesLsCommand);
registry.registerCommand(instancesAddCommand);
registry.registerCommand(instancesRmCommand);
registry.registerCommand(instanceTypesCommand);
registry.registerCommand(linkCommand);
registry.registerCommand(sshCommand);
registry.registerCommand(cpCommand);
registry.registerCommand(psCommand);
registry.registerCommand(logsCommand);
registry.registerCommand(cvmsRuntimeConfigCommand);
registry.registerCommand(loginCommand);
registry.registerCommand(logoutCommand);
registry.registerCommand(profilesCommand);
registry.registerCommand(profilesUseCommand);
registry.registerCommand(profilesRenameCommand);
registry.registerCommand(profilesDeleteCommand);
registry.registerCommand(profilesRefreshCommand);
registry.registerCommand(switchCommand);
registry.registerCommand(apiCommand);
registry.registerCommand(statusCommand);
registry.registerCommand(whoamiCommand);
registry.registerCommand(completionCommand);
registry.registerCommand(osImagesCommand);
registry.registerCommand(keccak256sumCommand);
registry.registerCommand(helpCommand);

// Command groups + subcommands
registry.registerGroup(selfCommands.group);
for (const command of selfCommands.commands) {
	registry.registerCommand(command);
}

registry.registerGroup(authCommands.group);
for (const command of authCommands.commands) {
	registry.registerCommand(command);
}

registry.registerGroup(configCommands.group);
for (const command of configCommands.commands) {
	registry.registerCommand(command);
}

registry.registerGroup(docsCommands.group);
for (const command of docsCommands.commands) {
	registry.registerCommand(command);
}

registry.registerGroup(cvmsCommands.group);
for (const command of cvmsCommands.commands) {
	registry.registerCommand(command);
}
for (const subgroup of cvmsCommands.subgroups ?? []) {
	registry.registerGroup(subgroup.group);
	for (const command of subgroup.commands) {
		registry.registerCommand(command);
	}
}

registry.registerGroup(envsCommands.group);
for (const command of envsCommands.commands) {
	registry.registerCommand(command);
}

registry.registerGroup(sshKeysCommands.group);
for (const command of sshKeysCommands.commands) {
	registry.registerCommand(command);
}

registry.registerGroup(kmsCommands.group);
for (const command of kmsCommands.commands) {
	registry.registerCommand(command);
}

registry.registerGroup(nodesCommands.group);
for (const command of nodesCommands.commands) {
	registry.registerCommand(command);
}

registry.registerGroup(simulatorCommands.group);
for (const command of simulatorCommands.commands) {
	registry.registerCommand(command);
}

registry.registerGroup(allowDevicesCommands.group);
for (const command of allowDevicesCommands.commands) {
	registry.registerCommand(command);
}

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

async function main(): Promise<void> {
	await migrateStorage({ env: process.env, stderr: process.stderr });

	const exitCode = await dispatchCommand({
		registry,
		argv: process.argv.slice(2),
		executableName: packageJson.name ?? "phala",
		version,
		packageName: packageJson.name ?? "phala",
		packageVersion: packageJson.version,
		runtime,
		cwd: process.cwd(),
		env: process.env,
		stdout: process.stdout,
		stderr: process.stderr,
		stdin: process.stdin,
	});

	process.exit(exitCode);
}

main().catch((error) => {
	console.error("An error occurred:", error);
	process.exit(1);
});
