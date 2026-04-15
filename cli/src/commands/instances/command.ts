import type { CommandGroup } from "@/src/core/types";

export const instancesGroup: CommandGroup = {
	path: ["instances"],
	meta: {
		name: "instances",
		description: "Manage app instances",
		stability: "unstable",
	},
};
