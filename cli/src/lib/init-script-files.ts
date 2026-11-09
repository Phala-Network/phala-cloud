import fs from "node:fs";
import {
	INIT_SCRIPT_SLUGS,
	isInitScriptSlug,
	type InitScriptSlug,
} from "@/src/commands/deploy/command";

export const MAX_INIT_SCRIPT_FILES = 5;

export function unknownInitScriptSlugMessage(value: string): string {
	return `${value} is not a known init script slug (${INIT_SCRIPT_SLUGS.join(", ")})`;
}

export function partitionInitScriptValues(values: string[] | undefined): {
	slugs: InitScriptSlug[];
	files: string[];
} {
	const slugs: InitScriptSlug[] = [];
	const files: string[] = [];
	for (const value of values ?? []) {
		if (isInitScriptSlug(value)) slugs.push(value);
		else files.push(value);
	}
	return { slugs, files };
}

export function assertInitScriptFilesExist(paths: string[]): void {
	for (const filePath of paths) {
		if (!fs.existsSync(filePath)) {
			throw new Error(
				`${unknownInitScriptSlugMessage(filePath)}, and no such file was found.`,
			);
		}
	}
}

export function readInitScriptFiles(paths: string[]): string[] {
	if (paths.length > MAX_INIT_SCRIPT_FILES) {
		throw new Error(
			`At most ${MAX_INIT_SCRIPT_FILES} init script files are accepted.`,
		);
	}
	assertInitScriptFilesExist(paths);
	return paths.map((filePath) => fs.readFileSync(filePath, "utf8"));
}
