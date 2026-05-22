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
