import type { CommandGroup } from "@/src/core/types";

export const docsGroup: CommandGroup = {
	path: ["docs"],
	meta: {
		name: "docs",
		category: "advanced",
		description:
			"Search and read the live Phala documentation (docs.phala.com) from the terminal",
		stability: "unstable",
	},
};
