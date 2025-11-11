#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dispatchCommand } from "./core/dispatcher";
import { CommandRegistry } from "./core/registry";
import { authCommands } from "./commands/auth";
import { configCommands } from "./commands/config";
import { cvmsCommands } from "./commands/cvms";
import { deployCommand } from "./commands/deploy";
import { dockerCommands } from "./commands/docker";
import { loginCommand } from "./commands/login";
import { nodesCommands } from "./commands/nodes";
import { simulatorCommands } from "./commands/simulator";
import { statusCommand } from "./commands/status";
import { completionCommand } from "./commands/completion";
import { sshCommand } from "./commands/ssh";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJsonPath = join(__dirname, "../package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
const version = `v${packageJson.version}`;

const registry = new CommandRegistry();
registry.registerCommand(statusCommand);
registry.registerCommand(deployCommand);
registry.registerCommand(loginCommand);
registry.registerCommand(completionCommand);
registry.registerCommand(sshCommand);
registry.registerGroup(authCommands.group);
for (const command of authCommands.commands) {
	registry.registerCommand(command);
}
registry.registerGroup(configCommands.group);
for (const command of configCommands.commands) {
	registry.registerCommand(command);
}
registry.registerGroup(cvmsCommands.group);
for (const command of cvmsCommands.commands) {
	registry.registerCommand(command);
}
registry.registerGroup(dockerCommands.group);
for (const command of dockerCommands.commands) {
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

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

async function main(): Promise<void> {
	const exitCode = await dispatchCommand({
		registry,
		argv: process.argv.slice(2),
		executableName: packageJson.name ?? "phala",
		version,
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
