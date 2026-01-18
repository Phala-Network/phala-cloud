import type { CommandGroup } from "@/src/core/types";

export const selfGroup: CommandGroup = {
	path: ["self"],
	meta: {
		name: "self",
		description: "Self management commands",
		stability: "stable",
	},
};
