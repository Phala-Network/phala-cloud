import type { CommandGroup } from "@/src/core/types";

export const appsInstancesGroup: CommandGroup = {
	path: ["apps", "instances"],
	meta: {
		name: "instances",
		description: "Manage app instances",
		stability: "unstable",
	},
};
