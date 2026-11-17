import type { CommandGroup } from "@/src/core/types";

export const domainsGroup: CommandGroup = {
	path: ["domains"],
	meta: {
		name: "domains",
		description: "Manage custom domains of your apps",
		stability: "unstable",
		category: "manage",
	},
};
