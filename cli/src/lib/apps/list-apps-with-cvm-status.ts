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
	// When true, emit one row per replica CVM instead of one row per app.
	readonly showReplicas?: boolean;
}

export interface AppCvmRow {
	readonly appId: string;
	readonly cvmName: string;
	readonly vmUuid: string;
	readonly status: string;
	readonly uptime?: string | null;
	// 1-based position of this CVM within its app's replica set.
	readonly replicaIndex: number;
	// Total number of CVMs (replicas) belonging to the app.
	readonly replicaCount: number;
}

// Structural subset of the app-list payload this module relies on. Kept
// minimal so the row-selection logic stays pure and unit-testable without
// depending on a specific API-version schema.
interface CvmLike {
	readonly vm_uuid?: string | null;
	readonly name: string;
	readonly status?: unknown;
}

interface AppLike {
	readonly app_id: string;
	readonly current_cvm?: CvmLike | null;
	readonly cvms?: readonly CvmLike[];
	readonly cvm_count?: number;
}

export interface DisplayCvmRef {
	readonly appId: string;
	readonly cvm: CvmLike;
	readonly replicaIndex: number;
	readonly replicaCount: number;
}

function hasVmUuid(cvm: CvmLike | null | undefined): cvm is CvmLike {
	return !!cvm && typeof cvm.vm_uuid === "string" && cvm.vm_uuid.length > 0;
}

/**
 * Select which CVMs to display for each app.
 *
 * The app-list payload already carries every replica CVM in `app.cvms` and a
 * `app.cvm_count`, but the list view historically rendered only
 * `app.current_cvm`, silently hiding the other replicas. This resolves the set
 * of CVMs to show:
 *   - `showReplicas` off (default): one row per app (the current CVM, falling
 *     back to the first known CVM), annotated with the true replica count.
 *   - `showReplicas` on: one row per replica CVM, each with its 1-based index.
 *
 * Pure and side-effect free so it can be unit tested directly.
 */
export function collectDisplayCvms(
	apps: readonly AppLike[],
	showReplicas: boolean,
): DisplayCvmRef[] {
	const refs: DisplayCvmRef[] = [];
	for (const app of apps) {
		const allCvms = (app.cvms ?? []).filter(hasVmUuid);
		const fallback = hasVmUuid(app.current_cvm) ? [app.current_cvm] : [];
		const cvms = allCvms.length > 0 ? allCvms : fallback;
		if (cvms.length === 0) continue;

		const replicaCount =
			typeof app.cvm_count === "number" && app.cvm_count > cvms.length
				? app.cvm_count
				: cvms.length;

		if (showReplicas) {
			cvms.forEach((cvm, index) => {
				refs.push({
					appId: app.app_id,
					cvm,
					replicaIndex: index + 1,
					replicaCount,
				});
			});
		} else {
			const primary = hasVmUuid(app.current_cvm) ? app.current_cvm : cvms[0];
			refs.push({
				appId: app.app_id,
				cvm: primary,
				replicaIndex: 1,
				replicaCount,
			});
		}
	}
	return refs;
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
	client: Client<"2026-05-22">,
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
		return {
			success: false,
			error: {
				message: appListResult.error.message,
				cause: appListResult.error,
			},
		};
	}

	const appList = appListResult.data;
	const apps = appList.dstack_apps ?? [];

	const refs = collectDisplayCvms(apps, options.showReplicas ?? false);

	const vmUuids = [
		...new Set(
			refs
				.map((ref) => ref.cvm.vm_uuid)
				.filter(
					(uuid): uuid is string => typeof uuid === "string" && uuid.length > 0,
				),
		),
	];

	const statusByUuid: Record<
		string,
		{ status: string; uptime?: string | null; in_progress: boolean }
	> = {};

	for (const uuids of chunk(vmUuids, 100)) {
		const batchResult = await safeGetCvmStatusBatch(client, { vmUuids: uuids });
		if (!batchResult.success) {
			return {
				success: false,
				error: {
					message: batchResult.error.message,
					cause: batchResult.error,
				},
			};
		}

		for (const [uuid, status] of Object.entries(batchResult.data)) {
			statusByUuid[uuid] = {
				status: status.status,
				uptime: status.uptime,
				in_progress: status.in_progress,
			};
		}
	}

	const rows: AppCvmRow[] = refs.map((ref) => {
		const uuid = ref.cvm.vm_uuid ?? "";
		const batch = uuid ? statusByUuid[uuid] : undefined;
		const status = batch
			? batch.status
			: typeof ref.cvm.status === "string"
				? ref.cvm.status
				: "unknown";

		return {
			appId: ref.appId,
			cvmName: ref.cvm.name,
			vmUuid: uuid,
			status,
			uptime: batch?.uptime,
			replicaIndex: ref.replicaIndex,
			replicaCount: ref.replicaCount,
		};
	});

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
