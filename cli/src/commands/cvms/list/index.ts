import chalk from "chalk";
import { safeGetAppCvms, safeGetCvmStatusBatch } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import { listAppsWithCvmStatus } from "@/src/lib/apps/list-apps-with-cvm-status";
import { printTable } from "@/src/lib/table";
import { logger } from "@/src/utils/logger";

import {
	cvmsListCommandMeta,
	cvmsListCommandSchema,
	type CvmsListCommandInput,
} from "./command";

interface AppScopedListResult {
	page: number;
	pageSize: number;
	total: number;
	totalPages: number;
	items: Array<{
		appId: string;
		vmUuid?: string | null;
		instanceId?: string | null;
		cvmName: string;
		status: string;
		uptime?: string | null;
	}>;
}

function formatStatus(status: string): string {
	if (status.toLowerCase().endsWith("ing")) return chalk.yellow(status);
	if (status === "running") return chalk.green(status);
	if (status === "stopped") return chalk.red(status);
	return chalk.yellow(status);
}

function getAppScopedVmUuid(cvm: Record<string, unknown>): string | null {
	if (typeof cvm.vm_uuid === "string" && cvm.vm_uuid.length > 0) {
		return cvm.vm_uuid;
	}

	const hosted = cvm.hosted;
	if (
		hosted &&
		typeof hosted === "object" &&
		"id" in hosted &&
		typeof hosted.id === "string" &&
		hosted.id.length > 0
	) {
		return hosted.id;
	}

	return null;
}

function getAppScopedInstanceId(cvm: Record<string, unknown>): string | null {
	if (typeof cvm.instance_id === "string" && cvm.instance_id.length > 0) {
		return cvm.instance_id;
	}

	const hosted = cvm.hosted;
	if (
		hosted &&
		typeof hosted === "object" &&
		"instance_id" in hosted &&
		typeof hosted.instance_id === "string" &&
		hosted.instance_id.length > 0
	) {
		return hosted.instance_id;
	}

	return null;
}

function getAppScopedAppId(cvm: Record<string, unknown>): string | null {
	if (typeof cvm.app_id === "string" && cvm.app_id.length > 0) {
		return cvm.app_id;
	}

	const hosted = cvm.hosted;
	if (
		hosted &&
		typeof hosted === "object" &&
		"app_id" in hosted &&
		typeof hosted.app_id === "string" &&
		hosted.app_id.length > 0
	) {
		return hosted.app_id;
	}

	return null;
}

function matchesAppScopedFilters(
	cvm: Record<string, unknown>,
	input: CvmsListCommandInput,
): boolean {
	if (input.search) {
		const needle = input.search.toLowerCase();
		const haystacks = [
			typeof cvm.name === "string" ? cvm.name : "",
			getAppScopedAppId(cvm) ?? "",
			getAppScopedVmUuid(cvm) ?? "",
			getAppScopedInstanceId(cvm) ?? "",
		];
		if (!haystacks.some((value) => value.toLowerCase().includes(needle))) {
			return false;
		}
	}

	if (
		input.status &&
		input.status.length > 0 &&
		(typeof cvm.status !== "string" || !input.status.includes(cvm.status))
	) {
		return false;
	}

	if (input.listed !== undefined && Boolean(cvm.listed) !== input.listed) {
		return false;
	}

	if (
		input.baseImage &&
		(!cvm.os ||
			typeof cvm.os !== "object" ||
			!("name" in cvm.os) ||
			cvm.os.name !== input.baseImage)
	) {
		return false;
	}

	if (
		input.instanceType &&
		(!cvm.resource ||
			typeof cvm.resource !== "object" ||
			!("instance_type" in cvm.resource) ||
			cvm.resource.instance_type !== input.instanceType)
	) {
		return false;
	}

	if (input.kmsType && cvm.kms_type !== input.kmsType) {
		return false;
	}

	if (
		input.node &&
		(!cvm.node_info ||
			typeof cvm.node_info !== "object" ||
			!("name" in cvm.node_info) ||
			cvm.node_info.name !== input.node)
	) {
		return false;
	}

	if (
		input.region &&
		!((cvm.node_info &&
			typeof cvm.node_info === "object" &&
			"region" in cvm.node_info &&
			cvm.node_info.region === input.region) ||
			(cvm.node &&
				typeof cvm.node === "object" &&
				"region_identifier" in cvm.node &&
				cvm.node.region_identifier === input.region))
	) {
		return false;
	}

	return true;
}

async function listCvmsForApp(
	input: CvmsListCommandInput,
): Promise<AppScopedListResult> {
	const client = await getClient();
	const appId = input.appId?.replace(/^app_/, "");
	if (!appId) {
		throw new Error("App ID is required");
	}

	const cvmsResult = await safeGetAppCvms(client as never, { appId });
	if (!cvmsResult.success) {
		throw new Error(cvmsResult.error.message);
	}

	const filtered = cvmsResult.data.filter((cvm) =>
		matchesAppScopedFilters(cvm as Record<string, unknown>, input),
	);

	const vmUuids = filtered
		.map((cvm) => getAppScopedVmUuid(cvm as Record<string, unknown>))
		.filter(
			(uuid): uuid is string => typeof uuid === "string" && uuid.length > 0,
		);

	const statusBatch =
		vmUuids.length > 0
			? await safeGetCvmStatusBatch(client as never, { vmUuids })
			: { success: true as const, data: {} };

	if (!statusBatch.success) {
		throw new Error(statusBatch.error.message);
	}

	const start = (input.page - 1) * input.pageSize;
	const paged = filtered.slice(start, start + input.pageSize);

	return {
		page: input.page,
		pageSize: input.pageSize,
		total: filtered.length,
		totalPages: filtered.length === 0 ? 1 : Math.ceil(filtered.length / input.pageSize),
		items: paged.map((cvm) => {
			const normalized = cvm as Record<string, unknown>;
			const vmUuid = getAppScopedVmUuid(normalized);
			const batch = vmUuid ? statusBatch.data[vmUuid] : undefined;
			return {
				appId: getAppScopedAppId(normalized) ?? `app_${appId}`,
				vmUuid,
				instanceId: getAppScopedInstanceId(normalized),
				cvmName: cvm.name,
				status: batch?.status ?? cvm.status,
				uptime: batch?.uptime,
			};
		}),
	};
}

async function runCvmsListCommand(
	input: CvmsListCommandInput,
	context: CommandContext,
): Promise<number> {
	try {
		const data = input.appId
			? await listCvmsForApp(input)
			: await (async () => {
					const client = await getClient();
					const result = await listAppsWithCvmStatus(client as never, {
						page: input.page,
						pageSize: input.pageSize,
						search: input.search,
						status: input.status,
						listed: input.listed,
						baseImage: input.baseImage,
						instanceType: input.instanceType,
						kmsType: input.kmsType,
						node: input.node,
						region: input.region,
					});

					if (result.success === false) {
						throw new Error(result.error.message);
					}

					return result.data;
				})();

		if (input.json) {
			context.success(data);
			return 0;
		}

		const columns = ["APP_ID", "VM_UUID", "INSTANCE_ID", "CVM", "STATUS", "UPTIME"] as const;
		const rows = data.items.map((item) => ({
			APP_ID: item.appId,
			VM_UUID: item.vmUuid ?? "-",
			INSTANCE_ID: item.instanceId ?? "-",
			CVM: item.cvmName,
			STATUS: formatStatus(item.status),
			UPTIME: item.uptime ?? "-",
		}));

		if (rows.length === 0) {
			logger.info("No CVMs found");
			return 0;
		}

		printTable(columns, rows);
		logger.info(`Page ${data.page}/${data.totalPages} (total ${data.total})`);
		return 0;
	} catch (error) {
		logger.logDetailedError(error);
		context.fail(
			`Failed to list CVMs: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
		return 1;
	}
}

export const cvmsListCommand = defineCommand({
	path: ["cvms", "list"],
	meta: cvmsListCommandMeta,
	schema: cvmsListCommandSchema,
	handler: runCvmsListCommand,
});

export default cvmsListCommand;
