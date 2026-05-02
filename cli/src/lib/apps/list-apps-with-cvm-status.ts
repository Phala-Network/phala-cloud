import { safeGetAppList, safeGetCvmStatusBatch } from "@phala/cloud";
import type { Client } from "@phala/cloud";
import type { Result } from "@/src/lib/result";

export interface AppsListWithStatusOptions {
	readonly page: number;
	readonly pageSize: number;
	readonly search?: string;
	readonly status?: string[];
	readonly listed?: boolean;
	readonly baseImage?: string;
	readonly instanceType?: string;
	readonly kmsType?: string;
	readonly node?: string;
	readonly region?: string;
}

export interface AppCvmRow {
	readonly appId: string;
	readonly vmUuid?: string | null;
	readonly instanceId?: string | null;
	readonly cvmName: string;
	readonly status: string;
	readonly uptime?: string | null;
}

export interface AppsListWithStatusResult {
	readonly page: number;
	readonly pageSize: number;
	readonly total: number;
	readonly totalPages: number;
	readonly items: readonly AppCvmRow[];
}

function chunk<T>(items: readonly T[], size: number): T[][] {
	if (size <= 0) return [Array.from(items)];
	const result: T[][] = [];
	for (let i = 0; i < items.length; i += size) {
		result.push(items.slice(i, i + size));
	}
	return result;
}

export async function listAppsWithCvmStatus(
	client: Client<"2026-01-21">,
	options: AppsListWithStatusOptions,
): Promise<Result<AppsListWithStatusResult>> {
	const appListResult = await safeGetAppList(client, {
		page: options.page,
		page_size: options.pageSize,
		search: options.search,
		status: options.status,
		listed: options.listed,
		base_image: options.baseImage,
		instance_type: options.instanceType,
		kms_type: options.kmsType,
		node: options.node,
		region: options.region,
	});

	if (!appListResult.success) {
		return { success: false, error: { message: appListResult.error.message } };
	}

	const appList = appListResult.data;
	const apps = appList.dstack_apps ?? [];

	// Only include apps which have a current_cvm
	const appsWithCvm = apps.filter(
		(app) =>
			app.current_cvm &&
			typeof app.current_cvm === "object" &&
			"vm_uuid" in app.current_cvm &&
			!!app.current_cvm.vm_uuid,
	);

	const vmUuids = appsWithCvm
		.map((app) => app.current_cvm?.vm_uuid)
		.filter(
			(uuid): uuid is string => typeof uuid === "string" && uuid.length > 0,
		);

	const statusByUuid: Record<
		string,
		{ status: string; uptime?: string | null; in_progress: boolean }
	> = {};

	for (const uuids of chunk(vmUuids, 100)) {
		const batchResult = await safeGetCvmStatusBatch(client, { vmUuids: uuids });
		if (!batchResult.success) {
			return { success: false, error: { message: batchResult.error.message } };
		}

		for (const [uuid, status] of Object.entries(batchResult.data)) {
			statusByUuid[uuid] = {
				status: status.status,
				uptime: status.uptime,
				in_progress: status.in_progress,
			};
		}
	}

	const rows: AppCvmRow[] = [];
	for (const app of appsWithCvm) {
		const currentCvm = app.current_cvm;
		if (!currentCvm?.vm_uuid) continue;

		const batch = statusByUuid[currentCvm.vm_uuid];
		const status = batch
			? batch.status
			: typeof currentCvm.status === "string"
				? currentCvm.status
				: "unknown";

		rows.push({
			appId: app.app_id,
			vmUuid: currentCvm.vm_uuid ?? null,
			instanceId: currentCvm.instance_id ?? null,
			cvmName: currentCvm.name,
			status,
			uptime: batch?.uptime,
		});
	}

	return {
		success: true,
		data: {
			page: appList.page,
			pageSize: appList.page_size,
			total: appList.total,
			totalPages: appList.total_pages,
			items: rows,
		},
	};
}
