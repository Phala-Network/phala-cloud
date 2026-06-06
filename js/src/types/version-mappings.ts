/**
 * Version-specific type mappings for API responses
 *
 * This file contains conditional types that map API versions to their
 * corresponding response types, enabling TypeScript to infer the correct
 * types based on the client's API version.
 */

import type { CurrentUserV20260121 } from "../credentials/current_user_v20260121";
import type { CurrentUserV20251028 } from "../credentials/current_user_v20251028";
import type {
  AppCvmsBatchIsAllowedResponseV20260121,
  AppCvmsBatchIsAllowedResponseV20260522,
} from "../actions/apps/check_app_cvms_is_allowed";
import type {
  DeviceAllowlistResponseV20260121,
  DeviceAllowlistResponseV20260522,
} from "../actions/apps/get_app_device_allowlist";
import type {
  IsAllowedResultV20260121,
  IsAllowedResultV20260522,
} from "../actions/cvms/check_cvm_is_allowed";
import type {
  InstanceIdRefreshResultV20260121,
  InstanceIdRefreshResultV20260522,
} from "../actions/cvms/refresh_cvm_instance_id";
import type {
  RefreshCvmInstanceIdsResponseV20260121,
  RefreshCvmInstanceIdsResponseV20260522,
} from "../actions/cvms/refresh_cvm_instance_ids";
import type {
  CommitCvmProvisionV20260121,
  CommitCvmProvisionV20260522,
} from "../actions/cvms/commit_cvm_provision";
import type {
  DstackAppListResponseV20251028,
  DstackAppWithCvmResponseV20251028,
} from "./app_info_v20251028";
import type {
  DstackAppListResponseV20260121,
  DstackAppListResponseV20260522,
  DstackAppWithCvmResponseV20260121,
  DstackAppWithCvmResponseV20260522,
} from "./app_info_v20260121";
import type { ApiVersion } from "./client";
import type {
  CvmDetailV20251028,
  CvmInfoV20251028,
  PaginatedCvmInfosV20251028,
} from "./cvm_info_v20251028";
import type { VMForVersion } from "./cvm_info";
import type {
  CvmInfoDetailV20260121,
  CvmInfoDetailV20260522,
  CvmInfoV20260121,
  CvmInfoV20260522,
  PaginatedCvmInfosV20260121,
  PaginatedCvmInfosV20260522,
} from "./cvm_info_v20260121";

/**
 * Maps API version to the auth/me response type
 */
export type GetCurrentUserResponse<V extends ApiVersion> = V extends "2026-05-22"
  ? CurrentUserV20260121
  : V extends "2026-01-21"
    ? CurrentUserV20260121
    : V extends "2025-10-28"
      ? CurrentUserV20251028
      : CurrentUserV20260121;

/**
 * Maps API version to the paginated CVM list response type
 */
export type GetCvmListResponse<V extends ApiVersion> = V extends "2026-05-22"
  ? PaginatedCvmInfosV20260522
  : V extends "2026-01-21"
    ? PaginatedCvmInfosV20260121
    : V extends "2025-10-28"
      ? PaginatedCvmInfosV20251028
      : PaginatedCvmInfosV20260121;

/**
 * Maps API version to the CVM info detail response type
 */
export type GetCvmInfoResponse<V extends ApiVersion> = V extends "2026-05-22"
  ? CvmInfoDetailV20260522
  : V extends "2026-01-21"
    ? CvmInfoDetailV20260121
    : V extends "2025-10-28"
      ? CvmDetailV20251028
      : CvmInfoDetailV20260121;

/**
 * Maps API version to the app list response type
 */
export type GetAppListResponse<V extends ApiVersion> = V extends "2026-05-22"
  ? DstackAppListResponseV20260522
  : V extends "2026-01-21"
    ? DstackAppListResponseV20260121
    : V extends "2025-10-28"
      ? DstackAppListResponseV20251028
      : DstackAppListResponseV20260121;

/**
 * Maps API version to the app info response type
 */
export type GetAppInfoResponse<V extends ApiVersion> = V extends "2026-05-22"
  ? DstackAppWithCvmResponseV20260522
  : V extends "2026-01-21"
    ? DstackAppWithCvmResponseV20260121
    : V extends "2025-10-28"
      ? DstackAppWithCvmResponseV20251028
      : DstackAppWithCvmResponseV20260121;

/**
 * Maps API version to the app CVMs list response type
 */
export type GetAppCvmsResponse<V extends ApiVersion> = V extends "2026-05-22"
  ? CvmInfoV20260522[]
  : V extends "2026-01-21"
    ? CvmInfoV20260121[]
    : V extends "2025-10-28"
      ? CvmInfoV20251028[]
      : CvmInfoV20260121[];

/**
 * Maps API version to the CVM lifecycle action response type (start/stop/restart/shutdown/replicate)
 */
export type CvmLifecycleResponse<V extends ApiVersion> = VMForVersion<V>;

/**
 * Maps API version to the commit CVM provision response type
 */
export type CommitCvmProvisionResponse<V extends ApiVersion> = V extends "2026-01-21"
  ? CommitCvmProvisionV20260121
  : CommitCvmProvisionV20260522;

/**
 * Maps API version to the check CVM is-allowed response type
 */
export type CheckCvmIsAllowedResponse<V extends ApiVersion> = V extends "2026-01-21"
  ? IsAllowedResultV20260121
  : IsAllowedResultV20260522;

/**
 * Maps API version to the app batch is-allowed response type
 */
export type CheckAppCvmsIsAllowedResponse<V extends ApiVersion> = V extends "2026-01-21"
  ? AppCvmsBatchIsAllowedResponseV20260121
  : AppCvmsBatchIsAllowedResponseV20260522;

/**
 * Maps API version to the device allowlist response type
 */
export type GetAppDeviceAllowlistResponse<V extends ApiVersion> = V extends "2026-01-21"
  ? DeviceAllowlistResponseV20260121
  : DeviceAllowlistResponseV20260522;

/**
 * Maps API version to the refresh CVM instance ID response type
 */
export type RefreshCvmInstanceIdResponse<V extends ApiVersion> = V extends "2026-01-21"
  ? InstanceIdRefreshResultV20260121
  : InstanceIdRefreshResultV20260522;

/**
 * Maps API version to the batch refresh CVM instance IDs response type
 * Note: defined as RefreshCvmInstanceIdsVersionedResponse to avoid conflict with the
 * concrete exported type RefreshCvmInstanceIdsResponse from the action module.
 */
export type RefreshCvmInstanceIdsVersionedResponse<V extends ApiVersion> = V extends "2026-01-21"
  ? RefreshCvmInstanceIdsResponseV20260121
  : RefreshCvmInstanceIdsResponseV20260522;
