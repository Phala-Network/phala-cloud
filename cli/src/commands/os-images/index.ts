import { safeGetOsImages } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import { printTable } from "@/src/lib/table";
import { logger } from "@/src/utils/logger";
import {
	osImagesCommandMeta,
	osImagesCommandSchema,
	type OsImagesCommandInput,
} from "./command";

async function runOsImagesCommand(
	input: OsImagesCommandInput,
	context: CommandContext,
): Promise<number> {
	try {
		const client = await getClient(context);

		const isDev = input.dev ? true : input.prod ? false : undefined;

		const fetchPage = async (page: number) =>
			await safeGetOsImages(client, {
				page,
				page_size: input.pageSize,
				is_dev: isDev,
			});

		const firstPageResult = await fetchPage(input.page);
		if (!firstPageResult.success) {
			context.failWithError(firstPageResult.error.cause ?? firstPageResult.error, {
				operation: "List OS images",
				debug: Boolean((input as { debug?: boolean }).debug),
			});
			return 1;
		}

		let data = firstPageResult.data;
		if (input.all && data.pages > data.page) {
			const allItems = [...data.items];
			for (let page = data.page + 1; page <= data.pages; page++) {
				const pageResult = await fetchPage(page);
				if (!pageResult.success) {
			context.failWithError(pageResult.error.cause ?? pageResult.error, {
				operation: "List OS images",
				debug: Boolean((input as { debug?: boolean }).debug),
			});
			return 1;
		}
				allItems.push(...pageResult.data.items);
			}
			data = {
				...data,
				items: allItems,
				page_size: allItems.length,
				page: 1,
				pages: 1,
			};
		}

		if (input.json) {
			context.success(data);
			return 0;
		}

		const columns = ["NAME", "VERSION", "OS_IMAGE_HASH", "DEV", "GPU"] as const;

		const rows = data.items.map((img) => ({
			NAME: img.name,
			VERSION: img.version,
			OS_IMAGE_HASH: img.os_image_hash ?? "-",
			DEV: img.is_dev ? "yes" : "no",
			GPU: img.requires_gpu ? "yes" : "no",
		}));

		if (rows.length === 0) {
			logger.info("No OS images found");
			return 0;
		}

		printTable(columns, rows);
		logger.info(`Total: ${data.total}`);
		return 0;
	} catch (error) {
		context.failWithError(error, {
			operation: "List OS images",
			debug: Boolean((input as { debug?: boolean }).debug),
		});
		return 1;
	}
}

export const osImagesCommand = defineCommand({
	path: ["os-images"],
	meta: osImagesCommandMeta,
	schema: osImagesCommandSchema,
	handler: runOsImagesCommand,
});

export default osImagesCommand;
