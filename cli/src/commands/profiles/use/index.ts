import chalk from "chalk";
import inquirer from "inquirer";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import {
	switchProfile,
	listProfiles,
	getCurrentProfile,
	loadCredentialsFile,
} from "@/src/utils/credentials";
import { logger } from "@/src/utils/logger";
import {
	profilesUseCommandMeta,
	profilesUseCommandSchema,
	type ProfilesUseCommandInput,
} from "./command";

function isExitPromptError(error: unknown): boolean {
	return (
		error !== null &&
		typeof error === "object" &&
		"name" in error &&
		(error as { name: string }).name === "ExitPromptError"
	);
}

async function runProfilesUseCommand(
	input: ProfilesUseCommandInput,
	_context: CommandContext,
): Promise<number> {
	try {
		if (input.interactive) {
			return await interactiveSwitch();
		}

		if (!input.profileName) {
			logger.error("Missing required argument: profile-name");
			logger.info("Usage: phala profiles use <profile-name>");
			logger.info("       phala profiles use -i");
			return 1;
		}

		return directSwitch(input.profileName);
	} catch (error) {
		if (isExitPromptError(error)) {
			console.log();
			logger.info("Switch cancelled.");
			return 0;
		}

		const message = error instanceof Error ? error.message : String(error);

		if (message.includes("not found")) {
			logger.error(message);
			const profiles = listProfiles();
			if (profiles.length > 0) {
				logger.info("Available profiles:");
				for (const profile of profiles) {
					console.log(chalk.gray(`  - ${profile}`));
				}
			} else {
				logger.info("No profiles found. Please login first.");
			}
		} else {
			logger.error("Failed to switch profile");
			logger.logDetailedError(error);
		}
		return 1;
	}
}

async function interactiveSwitch(): Promise<number> {
	const profiles = listProfiles();
	const currentProfile = getCurrentProfile();

	if (profiles.length === 0) {
		logger.warn("No profiles found. Please login first.");
		return 1;
	}

	if (profiles.length === 1) {
		logger.info(`Only one profile available: ${profiles[0]}`);
		return 0;
	}

	const credentials = loadCredentialsFile();
	const choices = profiles.map((profile) => {
		const profileInfo = credentials?.profiles[profile];
		const workspace = profileInfo?.workspace?.name || "unknown";
		const isCurrent = currentProfile?.name === profile;
		const marker = isCurrent ? " (current)" : "";
		return {
			name: `${profile} (workspace: ${workspace})${marker}`,
			value: profile,
		};
	});

	const { selectedProfile } = await inquirer.prompt([
		{
			type: "list",
			name: "selectedProfile",
			message: "Select a profile to switch to:",
			choices,
			default: currentProfile?.name,
		},
	]);

	if (selectedProfile === currentProfile?.name) {
		logger.info(`Already using profile "${selectedProfile}"`);
		return 0;
	}

	switchProfile(selectedProfile);
	const newProfile = getCurrentProfile();
	logger.success(`Switched to profile "${selectedProfile}"`);
	if (newProfile?.info.workspace?.name) {
		logger.info(`Workspace: ${newProfile.info.workspace.name}`);
	}
	return 0;
}

function directSwitch(profileName: string): number {
	const currentProfile = getCurrentProfile();

	if (currentProfile?.name === profileName) {
		logger.info(`Already using profile "${profileName}"`);
		return 0;
	}

	switchProfile(profileName);
	const newProfile = getCurrentProfile();
	logger.success(`Switched to profile "${profileName}"`);
	if (newProfile?.info.workspace?.name) {
		logger.info(`Workspace: ${newProfile.info.workspace.name}`);
	}
	return 0;
}

export const profilesUseCommand = defineCommand({
	path: ["profiles", "use"],
	meta: profilesUseCommandMeta,
	schema: profilesUseCommandSchema,
	handler: runProfilesUseCommand,
});

export default profilesUseCommand;
