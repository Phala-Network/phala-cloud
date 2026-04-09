import { z } from "zod";
import type { CommandMeta } from "@/src/core/types";

export const profilesCommandMeta: CommandMeta = {
	name: "profiles",
	category: "profile",
	description: "List auth profiles",
	stability: "stable",
	arguments: [],
	options: [],
	aliases: ["list"],
};

export const profilesCommandSchema = z.object({});

export type ProfilesCommandInput = z.infer<typeof profilesCommandSchema>;
