import { createClient as createBaseClient, Client as BaseClient } from "./client";
import type { ClientConfig, ApiVersion, DefaultApiVersion } from "./types/client";
import type { z } from "zod";
import type {
  GetCurrentUserResponse,
  GetCvmListResponse,
  GetCvmInfoResponse,
} from "./types/version-mappings";

import {
  getCurrentUser,
  safeGetCurrentUser,
  type AuthResponse,
  type CurrentUser,
} from "./actions/get_current_user";
import {
  getAvailableNodes,
  safeGetAvailableNodes,
  type AvailableNodes,
} from "./actions/get_available_nodes";
import {
  getCvmCreateResources,
  safeGetCvmCreateResources,
  type CvmCreateResourceGraph,
} from "./actions/get_cvm_create_resources";
import {
  listAllInstanceTypeFamilies,
  safeListAllInstanceTypeFamilies,
  listFamilyInstanceTypes,
  safeListFamilyInstanceTypes,
  type AllFamiliesResponse,
  type FamilyInstanceTypesResponse,
  type ListFamilyInstanceTypesRequest,
  type InstanceType,
} from "./actions/list-instance-types";
import {
  listWorkspaces,
  safeListWorkspaces,
  type ListWorkspacesRequest,
  type ListWorkspaces,
  type WorkspaceResponse,
} from "./actions/workspaces/list_workspaces";
import { getWorkspace, safeGetWorkspace } from "./actions/workspaces/get_workspace";
import { getCvmInfo, safeGetCvmInfo, type GetCvmInfoRequest } from "./actions/cvms/get_cvm_info";
import { getCvmList, safeGetCvmList, type GetCvmListRequest } from "./actions/cvms/get_cvm_list";
import {
  provisionCvm,
  safeProvisionCvm,
  type ProvisionCvmRequest,
  type ProvisionCvm,
} from "./actions/cvms/provision_cvm";
import {
  commitCvmProvision,
  safeCommitCvmProvision,
  type CommitCvmProvisionRequest,
  type CommitCvmProvision,
} from "./actions/cvms/commit_cvm_provision";
import {
  getCvmComposeFile,
  safeGetCvmComposeFile,
  type GetCvmComposeFileRequest,
  type GetCvmComposeFileResult,
} from "./actions/cvms/get_cvm_compose_file";
import {
  provisionCvmComposeFileUpdate,
  safeProvisionCvmComposeFileUpdate,
  type ProvisionCvmComposeFileUpdateRequest,
  type ProvisionCvmComposeFileUpdateResult,
} from "./actions/cvms/provision_cvm_compose_file_update";
import {
  commitCvmComposeFileUpdate,
  safeCommitCvmComposeFileUpdate,
  type CommitCvmComposeFileUpdateRequest,
  type CommitCvmComposeFileUpdate,
} from "./actions/cvms/commit_cvm_compose_file_update";
import {
  updateCvmEnvs,
  safeUpdateCvmEnvs,
  type UpdateCvmEnvsRequest,
  type UpdateCvmEnvsResult,
} from "./actions/cvms/update_cvm_envs";
import {
  updateDockerCompose,
  safeUpdateDockerCompose,
  type UpdateDockerComposeRequest,
  type UpdateDockerComposeResult,
} from "./actions/cvms/update_docker_compose";
import {
  updatePreLaunchScript,
  safeUpdatePreLaunchScript,
  type UpdatePreLaunchScriptRequest,
  type UpdatePreLaunchScriptResult,
} from "./actions/cvms/update_prelaunch_script";
import {
  getCvmPreLaunchScript,
  safeGetCvmPreLaunchScript,
  type GetCvmPreLaunchScriptRequest,
} from "./actions/cvms/get_cvm_prelaunch_script";
import {
  getPreLaunchScriptUpgradeStatus,
  safeGetPreLaunchScriptUpgradeStatus,
  type GetPreLaunchScriptUpgradeStatusRequest,
  type PreLaunchScriptUpgradeStatus,
} from "./actions/cvms/get_prelaunch_script_upgrade_status";
import {
  upgradePreLaunchScript,
  safeUpgradePreLaunchScript,
  type UpgradePreLaunchScriptRequest,
  type UpgradePreLaunchScriptResult,
} from "./actions/cvms/upgrade_prelaunch_script";
import { getKmsInfo, safeGetKmsInfo, type GetKmsInfoRequest } from "./actions/kms/get_kms_info";
import {
  getKmsList,
  safeGetKmsList,
  type GetKmsListRequest,
  type GetKmsListResponse,
} from "./actions/kms/get_kms_list";
import {
  getAppEnvEncryptPubKey,
  safeGetAppEnvEncryptPubKey,
  type GetAppEnvEncryptPubKeyRequest,
  type GetAppEnvEncryptPubKey as GetAppEnvEncryptPubKeyResult,
} from "./actions/kms/get_app_env_encrypt_pubkey";
import {
  nextAppIds,
  safeNextAppIds,
  type NextAppIdsRequest,
  type NextAppIds,
} from "./actions/kms/next_app_ids";
import { startCvm, safeStartCvm, type StartCvmRequest } from "./actions/cvms/start_cvm";
import { stopCvm, safeStopCvm, type StopCvmRequest } from "./actions/cvms/stop_cvm";
import { shutdownCvm, safeShutdownCvm, type ShutdownCvmRequest } from "./actions/cvms/shutdown_cvm";
import { restartCvm, safeRestartCvm, type RestartCvmRequest } from "./actions/cvms/restart_cvm";
import { deleteCvm, safeDeleteCvm, type DeleteCvmRequest } from "./actions/cvms/delete_cvm";
import {
  getCvmStats,
  safeGetCvmStats,
  type GetCvmStatsRequest,
  type CvmSystemInfo,
} from "./actions/cvms/get_cvm_stats";
import {
  getCvmNetwork,
  safeGetCvmNetwork,
  type GetCvmNetworkRequest,
  type CvmNetwork,
} from "./actions/cvms/get_cvm_network";
import {
  getCvmDockerCompose,
  safeGetCvmDockerCompose,
  type GetCvmDockerComposeRequest,
} from "./actions/cvms/get_cvm_docker_compose";
import {
  getCvmContainersStats,
  safeGetCvmContainersStats,
  type GetCvmContainersStatsRequest,
  type CvmContainersStats,
} from "./actions/cvms/get_cvm_containers_stats";
import {
  getCvmAttestation,
  safeGetCvmAttestation,
  type GetCvmAttestationRequest,
  type CvmAttestation,
} from "./actions/cvms/get_cvm_attestation";
import {
  updateCvmResources,
  safeUpdateCvmResources,
  type UpdateCvmResourcesRequest,
} from "./actions/cvms/update_cvm_resources";
import {
  updateCvmVisibility,
  safeUpdateCvmVisibility,
  type UpdateCvmVisibilityRequest,
} from "./actions/cvms/update_cvm_visibility";
import {
  getAvailableOsImages,
  safeGetAvailableOsImages,
  type GetAvailableOSImagesRequest,
  type GetAvailableOSImagesResponse,
} from "./actions/cvms/get_available_os_images";
import {
  updateOsImage,
  safeUpdateOsImage,
  type UpdateOsImageRequest,
} from "./actions/cvms/update_os_image";
import {
  getCvmState,
  safeGetCvmState,
  type GetCvmStateRequest,
  type CvmState,
} from "./actions/cvms/get_cvm_state";

import {
  listSshKeys,
  safeListSshKeys,
  type ListSshKeysResponse,
} from "./actions/ssh_keys/list_ssh_keys";
import {
  importGithubProfileSshKeys,
  safeImportGithubProfileSshKeys,
  type ImportGithubProfileRequest,
  type ImportGithubProfileResponse,
} from "./actions/ssh_keys/import_github_profile";
import {
  createSshKey,
  safeCreateSshKey,
  type CreateSshKeyRequest,
} from "./actions/ssh_keys/create_ssh_key";
import {
  deleteSshKey,
  safeDeleteSshKey,
  type DeleteSshKeyRequest,
} from "./actions/ssh_keys/delete_ssh_key";
import {
  syncGithubSshKeys,
  safeSyncGithubSshKeys,
  type SyncGithubSshKeysResponse,
} from "./actions/ssh_keys/sync_github_ssh_keys";
import type { SshKey } from "./actions/ssh_keys/list_ssh_keys";

import {
  getOsImages,
  safeGetOsImages,
  type GetOsImagesRequest,
  type GetOsImagesResponse,
} from "./actions/os_images/get_os_images";
import {
  getKmsOnChainDetail,
  safeGetKmsOnChainDetail,
  type GetKmsOnChainDetailRequest,
  type GetKmsOnChainDetailResponse,
} from "./actions/kms/get_kms_onchain_detail";

import type { KmsInfo } from "./types/kms_info";
import type { VM } from "./types/cvm_info";

import type { SafeResult } from "./types/client";

/**
 * Create a full-featured Phala Cloud client with all actions
 *
 * This is the default client creation function with all methods built-in.
 * All actions are available as methods on the client instance.
 *
 * @example
 * ```typescript
 * import { createClient } from '@phala/cloud'
 *
 * const client = createClient({ apiKey: 'your-api-key' })
 *
 * // All actions available as methods
 * const user = await client.getCurrentUser()
 * const cvms = await client.getCvmList()
 * const result = await client.provisionCvm({...})
 *
 * // With specific API version
 * const clientV20251028 = createClient({ apiKey: 'your-api-key', version: '2025-10-28' })
 * const cvms = await clientV20251028.getCvmList() // Returns PaginatedCvmInfosV20251028
 * ```
 *
 * For tree-shaking optimization, use `createBaseClient` with individual action imports:
 * ```typescript
 * import { createBaseClient, getCurrentUser } from '@phala/cloud'
 *
 * const client = createBaseClient({ apiKey: 'your-api-key' })
 * const user = await getCurrentUser(client)
 * ```
 *
 * @param config - Client configuration
 * @returns Client extended with all available actions
 */
export function createClient(
  config: ClientConfig<"2026-01-21"> & { version: "2026-01-21" },
): Client<"2026-01-21">;
export function createClient(
  config: ClientConfig<"2025-10-28"> & { version: "2025-10-28" },
): Client<"2025-10-28">;
export function createClient(config?: ClientConfig): Client<DefaultApiVersion>;
export function createClient<V extends ApiVersion = DefaultApiVersion>(
  config: ClientConfig<V> = {} as ClientConfig<V>,
): Client<V> {
  const client = createBaseClient(config) as BaseClient<V>;

  // Type annotation ensures proper type inference for extend()
  const allActions: {
    readonly getCurrentUser: typeof getCurrentUser;
    readonly safeGetCurrentUser: typeof safeGetCurrentUser;
    readonly getAvailableNodes: typeof getAvailableNodes;
    readonly safeGetAvailableNodes: typeof safeGetAvailableNodes;
    readonly getCvmCreateResources: typeof getCvmCreateResources;
    readonly safeGetCvmCreateResources: typeof safeGetCvmCreateResources;
    readonly listAllInstanceTypeFamilies: typeof listAllInstanceTypeFamilies;
    readonly safeListAllInstanceTypeFamilies: typeof safeListAllInstanceTypeFamilies;
    readonly listFamilyInstanceTypes: typeof listFamilyInstanceTypes;
    readonly safeListFamilyInstanceTypes: typeof safeListFamilyInstanceTypes;
    readonly listWorkspaces: typeof listWorkspaces;
    readonly safeListWorkspaces: typeof safeListWorkspaces;
    readonly getWorkspace: typeof getWorkspace;
    readonly safeGetWorkspace: typeof safeGetWorkspace;
    readonly getCvmInfo: typeof getCvmInfo;
    readonly safeGetCvmInfo: typeof safeGetCvmInfo;
    readonly getCvmList: typeof getCvmList;
    readonly safeGetCvmList: typeof safeGetCvmList;
    readonly provisionCvm: typeof provisionCvm;
    readonly safeProvisionCvm: typeof safeProvisionCvm;
    readonly commitCvmProvision: typeof commitCvmProvision;
    readonly safeCommitCvmProvision: typeof safeCommitCvmProvision;
    readonly getCvmComposeFile: typeof getCvmComposeFile;
    readonly safeGetCvmComposeFile: typeof safeGetCvmComposeFile;
    readonly provisionCvmComposeFileUpdate: typeof provisionCvmComposeFileUpdate;
    readonly safeProvisionCvmComposeFileUpdate: typeof safeProvisionCvmComposeFileUpdate;
    readonly commitCvmComposeFileUpdate: typeof commitCvmComposeFileUpdate;
    readonly safeCommitCvmComposeFileUpdate: typeof safeCommitCvmComposeFileUpdate;
    readonly updateCvmEnvs: typeof updateCvmEnvs;
    readonly safeUpdateCvmEnvs: typeof safeUpdateCvmEnvs;
    readonly updateDockerCompose: typeof updateDockerCompose;
    readonly safeUpdateDockerCompose: typeof safeUpdateDockerCompose;
    readonly updatePreLaunchScript: typeof updatePreLaunchScript;
    readonly safeUpdatePreLaunchScript: typeof safeUpdatePreLaunchScript;
    readonly getCvmPreLaunchScript: typeof getCvmPreLaunchScript;
    readonly safeGetCvmPreLaunchScript: typeof safeGetCvmPreLaunchScript;
    readonly getPreLaunchScriptUpgradeStatus: typeof getPreLaunchScriptUpgradeStatus;
    readonly safeGetPreLaunchScriptUpgradeStatus: typeof safeGetPreLaunchScriptUpgradeStatus;
    readonly upgradePreLaunchScript: typeof upgradePreLaunchScript;
    readonly safeUpgradePreLaunchScript: typeof safeUpgradePreLaunchScript;
    readonly startCvm: typeof startCvm;
    readonly safeStartCvm: typeof safeStartCvm;
    readonly stopCvm: typeof stopCvm;
    readonly safeStopCvm: typeof safeStopCvm;
    readonly shutdownCvm: typeof shutdownCvm;
    readonly safeShutdownCvm: typeof safeShutdownCvm;
    readonly restartCvm: typeof restartCvm;
    readonly safeRestartCvm: typeof safeRestartCvm;
    readonly deleteCvm: typeof deleteCvm;
    readonly safeDeleteCvm: typeof safeDeleteCvm;
    readonly getCvmStats: typeof getCvmStats;
    readonly safeGetCvmStats: typeof safeGetCvmStats;
    readonly getCvmNetwork: typeof getCvmNetwork;
    readonly safeGetCvmNetwork: typeof safeGetCvmNetwork;
    readonly getCvmDockerCompose: typeof getCvmDockerCompose;
    readonly safeGetCvmDockerCompose: typeof safeGetCvmDockerCompose;
    readonly getCvmContainersStats: typeof getCvmContainersStats;
    readonly safeGetCvmContainersStats: typeof safeGetCvmContainersStats;
    readonly getCvmAttestation: typeof getCvmAttestation;
    readonly safeGetCvmAttestation: typeof safeGetCvmAttestation;
    readonly updateCvmResources: typeof updateCvmResources;
    readonly safeUpdateCvmResources: typeof safeUpdateCvmResources;
    readonly updateCvmVisibility: typeof updateCvmVisibility;
    readonly safeUpdateCvmVisibility: typeof safeUpdateCvmVisibility;
    readonly getAvailableOsImages: typeof getAvailableOsImages;
    readonly safeGetAvailableOsImages: typeof safeGetAvailableOsImages;
    readonly updateOsImage: typeof updateOsImage;
    readonly safeUpdateOsImage: typeof safeUpdateOsImage;
    readonly getKmsInfo: typeof getKmsInfo;
    readonly safeGetKmsInfo: typeof safeGetKmsInfo;
    readonly getKmsList: typeof getKmsList;
    readonly safeGetKmsList: typeof safeGetKmsList;
    readonly getAppEnvEncryptPubKey: typeof getAppEnvEncryptPubKey;
    readonly safeGetAppEnvEncryptPubKey: typeof safeGetAppEnvEncryptPubKey;
    readonly nextAppIds: typeof nextAppIds;
    readonly safeNextAppIds: typeof safeNextAppIds;
    readonly getCvmState: typeof getCvmState;
    readonly safeGetCvmState: typeof safeGetCvmState;
    readonly listSshKeys: typeof listSshKeys;
    readonly safeListSshKeys: typeof safeListSshKeys;
    readonly importGithubProfileSshKeys: typeof importGithubProfileSshKeys;
    readonly safeImportGithubProfileSshKeys: typeof safeImportGithubProfileSshKeys;
    readonly createSshKey: typeof createSshKey;
    readonly safeCreateSshKey: typeof safeCreateSshKey;
    readonly deleteSshKey: typeof deleteSshKey;
    readonly safeDeleteSshKey: typeof safeDeleteSshKey;
    readonly syncGithubSshKeys: typeof syncGithubSshKeys;
    readonly safeSyncGithubSshKeys: typeof safeSyncGithubSshKeys;
    readonly getOsImages: typeof getOsImages;
    readonly safeGetOsImages: typeof safeGetOsImages;
    readonly getKmsOnChainDetail: typeof getKmsOnChainDetail;
    readonly safeGetKmsOnChainDetail: typeof safeGetKmsOnChainDetail;
  } = {
    getCurrentUser,
    safeGetCurrentUser,
    getAvailableNodes,
    safeGetAvailableNodes,
    getCvmCreateResources,
    safeGetCvmCreateResources,
    listAllInstanceTypeFamilies,
    safeListAllInstanceTypeFamilies,
    listFamilyInstanceTypes,
    safeListFamilyInstanceTypes,
    listWorkspaces,
    safeListWorkspaces,
    getWorkspace,
    safeGetWorkspace,
    getCvmInfo,
    safeGetCvmInfo,
    getCvmList,
    safeGetCvmList,
    provisionCvm,
    safeProvisionCvm,
    commitCvmProvision,
    safeCommitCvmProvision,
    getCvmComposeFile,
    safeGetCvmComposeFile,
    provisionCvmComposeFileUpdate,
    safeProvisionCvmComposeFileUpdate,
    commitCvmComposeFileUpdate,
    safeCommitCvmComposeFileUpdate,
    updateCvmEnvs,
    safeUpdateCvmEnvs,
    updateDockerCompose,
    safeUpdateDockerCompose,
    updatePreLaunchScript,
    safeUpdatePreLaunchScript,
    getCvmPreLaunchScript,
    safeGetCvmPreLaunchScript,
    getPreLaunchScriptUpgradeStatus,
    safeGetPreLaunchScriptUpgradeStatus,
    upgradePreLaunchScript,
    safeUpgradePreLaunchScript,
    startCvm,
    safeStartCvm,
    stopCvm,
    safeStopCvm,
    shutdownCvm,
    safeShutdownCvm,
    restartCvm,
    safeRestartCvm,
    deleteCvm,
    safeDeleteCvm,
    getCvmStats,
    safeGetCvmStats,
    getCvmNetwork,
    safeGetCvmNetwork,
    getCvmDockerCompose,
    safeGetCvmDockerCompose,
    getCvmContainersStats,
    safeGetCvmContainersStats,
    getCvmAttestation,
    safeGetCvmAttestation,
    updateCvmResources,
    safeUpdateCvmResources,
    updateCvmVisibility,
    safeUpdateCvmVisibility,
    getAvailableOsImages,
    safeGetAvailableOsImages,
    updateOsImage,
    safeUpdateOsImage,
    getKmsInfo,
    safeGetKmsInfo,
    getKmsList,
    safeGetKmsList,
    getAppEnvEncryptPubKey,
    safeGetAppEnvEncryptPubKey,
    nextAppIds,
    safeNextAppIds,
    getCvmState,
    safeGetCvmState,
    listSshKeys,
    safeListSshKeys,
    importGithubProfileSshKeys,
    safeImportGithubProfileSshKeys,
    createSshKey,
    safeCreateSshKey,
    deleteSshKey,
    safeDeleteSshKey,
    syncGithubSshKeys,
    safeSyncGithubSshKeys,
    getOsImages,
    safeGetOsImages,
    getKmsOnChainDetail,
    safeGetKmsOnChainDetail,
  };

  return client.extend(allActions) as unknown as Client<V>;
}

/**
 * Extended client type with all action methods
 *
 * This type definition ensures proper type inference for all action methods,
 * including their overload signatures for schema parameters.
 */
export interface Client<V extends ApiVersion = DefaultApiVersion> extends BaseClient<V> {
  // Version switching
  withVersion<NewV extends ApiVersion>(version: NewV): Client<NewV>;

  // Generic request methods (inherited from BaseClient, re-declared for visibility)
  request<T = unknown>(url: string, options?: import("./types/client").RequestOptions): Promise<T>;

  requestFull<T = unknown>(
    url: string,
    options?: import("./types/client").RequestOptions,
  ): Promise<import("./types/client").FullResponse<T>>;

  safeRequestMethod<T = unknown>(
    url: string,
    options?: import("./types/client").RequestOptions,
  ): Promise<SafeResult<T, import("./utils/errors").PhalaCloudError>>;

  safeRequestFull<T = unknown>(
    url: string,
    options?: import("./types/client").RequestOptions,
  ): Promise<
    SafeResult<import("./types/client").FullResponse<T>, import("./utils/errors").PhalaCloudError>
  >;

  // Simple actions (no request parameters, optional schema parameter)
  getCurrentUser(): Promise<GetCurrentUserResponse<V>>;
  getCurrentUser<T extends z.ZodTypeAny>(parameters: { schema: T }): Promise<z.infer<T>>;
  getCurrentUser(parameters: { schema: false }): Promise<unknown>;

  safeGetCurrentUser(): Promise<SafeResult<GetCurrentUserResponse<V>>>;
  safeGetCurrentUser<T extends z.ZodTypeAny>(parameters: { schema: T }): Promise<
    SafeResult<z.infer<T>>
  >;
  safeGetCurrentUser(parameters: { schema: false }): Promise<SafeResult<unknown>>;

  getAvailableNodes(): Promise<AvailableNodes>;
  getAvailableNodes<T extends z.ZodTypeAny>(parameters: { schema: T }): Promise<z.infer<T>>;
  getAvailableNodes(parameters: { schema: false }): Promise<unknown>;

  safeGetAvailableNodes(): Promise<SafeResult<AvailableNodes>>;
  safeGetAvailableNodes<T extends z.ZodTypeAny>(parameters: { schema: T }): Promise<
    SafeResult<z.infer<T>>
  >;
  safeGetAvailableNodes(parameters: { schema: false }): Promise<SafeResult<unknown>>;

  getCvmCreateResources(): Promise<CvmCreateResourceGraph>;
  getCvmCreateResources<T extends z.ZodTypeAny>(parameters: { schema: T }): Promise<z.infer<T>>;
  getCvmCreateResources(parameters: { schema: false }): Promise<unknown>;

  safeGetCvmCreateResources(): Promise<SafeResult<CvmCreateResourceGraph>>;
  safeGetCvmCreateResources<T extends z.ZodTypeAny>(parameters: { schema: T }): Promise<
    SafeResult<z.infer<T>>
  >;
  safeGetCvmCreateResources(parameters: { schema: false }): Promise<SafeResult<unknown>>;

  // Instance type actions - no parameters
  listAllInstanceTypeFamilies(): Promise<AllFamiliesResponse>;
  listAllInstanceTypeFamilies<T extends z.ZodTypeAny>(parameters: { schema: T }): Promise<
    z.infer<T>
  >;
  listAllInstanceTypeFamilies(parameters: { schema: false }): Promise<unknown>;

  safeListAllInstanceTypeFamilies(): Promise<SafeResult<AllFamiliesResponse>>;
  safeListAllInstanceTypeFamilies<T extends z.ZodTypeAny>(parameters: { schema: T }): Promise<
    SafeResult<z.infer<T>>
  >;
  safeListAllInstanceTypeFamilies(parameters: { schema: false }): Promise<SafeResult<unknown>>;

  listFamilyInstanceTypes(
    request: ListFamilyInstanceTypesRequest,
  ): Promise<FamilyInstanceTypesResponse>;
  listFamilyInstanceTypes<T extends z.ZodTypeAny>(
    request: ListFamilyInstanceTypesRequest,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  listFamilyInstanceTypes(
    request: ListFamilyInstanceTypesRequest,
    parameters: { schema: false },
  ): Promise<unknown>;

  safeListFamilyInstanceTypes(
    request: ListFamilyInstanceTypesRequest,
  ): Promise<SafeResult<FamilyInstanceTypesResponse>>;
  safeListFamilyInstanceTypes<T extends z.ZodTypeAny>(
    request: ListFamilyInstanceTypesRequest,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeListFamilyInstanceTypes(
    request: ListFamilyInstanceTypesRequest,
    parameters: { schema: false },
  ): Promise<SafeResult<unknown>>;

  listWorkspaces(request?: ListWorkspacesRequest): Promise<ListWorkspaces>;
  listWorkspaces<T extends z.ZodTypeAny>(
    request: ListWorkspacesRequest | undefined,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  listWorkspaces(
    request: ListWorkspacesRequest | undefined,
    parameters: { schema: false },
  ): Promise<unknown>;

  safeListWorkspaces(request?: ListWorkspacesRequest): Promise<SafeResult<ListWorkspaces>>;
  safeListWorkspaces<T extends z.ZodTypeAny>(
    request: ListWorkspacesRequest | undefined,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeListWorkspaces(
    request: ListWorkspacesRequest | undefined,
    parameters: { schema: false },
  ): Promise<SafeResult<unknown>>;

  getCvmList(request?: GetCvmListRequest): Promise<GetCvmListResponse<V>>;

  safeGetCvmList(request?: GetCvmListRequest): Promise<SafeResult<GetCvmListResponse<V>>>;

  getKmsList(request?: GetKmsListRequest): Promise<GetKmsListResponse>;
  getKmsList<T extends z.ZodTypeAny>(
    request: GetKmsListRequest | undefined,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  getKmsList(
    request: GetKmsListRequest | undefined,
    parameters: { schema: false },
  ): Promise<unknown>;

  safeGetKmsList(request?: GetKmsListRequest): Promise<SafeResult<GetKmsListResponse>>;
  safeGetKmsList<T extends z.ZodTypeAny>(
    request: GetKmsListRequest | undefined,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeGetKmsList(
    request: GetKmsListRequest | undefined,
    parameters: { schema: false },
  ): Promise<SafeResult<unknown>>;

  // Actions with required request parameters
  getWorkspace(teamSlug: string): Promise<WorkspaceResponse>;
  getWorkspace<T extends z.ZodTypeAny>(
    teamSlug: string,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  getWorkspace(teamSlug: string, parameters: { schema: false }): Promise<unknown>;

  safeGetWorkspace(teamSlug: string): Promise<SafeResult<WorkspaceResponse>>;
  safeGetWorkspace<T extends z.ZodTypeAny>(
    teamSlug: string,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeGetWorkspace(teamSlug: string, parameters: { schema: false }): Promise<SafeResult<unknown>>;

  getCvmInfo(request: GetCvmInfoRequest): Promise<GetCvmInfoResponse<V>>;

  safeGetCvmInfo(request: GetCvmInfoRequest): Promise<SafeResult<GetCvmInfoResponse<V>>>;

  getCvmComposeFile(request: GetCvmComposeFileRequest): Promise<GetCvmComposeFileResult>;
  getCvmComposeFile<T extends z.ZodTypeAny>(
    request: GetCvmComposeFileRequest,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  getCvmComposeFile(
    request: GetCvmComposeFileRequest,
    parameters: { schema: false },
  ): Promise<unknown>;

  safeGetCvmComposeFile(
    request: GetCvmComposeFileRequest,
  ): Promise<SafeResult<GetCvmComposeFileResult>>;
  safeGetCvmComposeFile<T extends z.ZodTypeAny>(
    request: GetCvmComposeFileRequest,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeGetCvmComposeFile(
    request: GetCvmComposeFileRequest,
    parameters: { schema: false },
  ): Promise<SafeResult<unknown>>;

  provisionCvm(request: ProvisionCvmRequest): Promise<ProvisionCvm>;
  provisionCvm<T extends z.ZodTypeAny>(
    request: ProvisionCvmRequest,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  provisionCvm(request: ProvisionCvmRequest, parameters: { schema: false }): Promise<unknown>;

  safeProvisionCvm(request: ProvisionCvmRequest): Promise<SafeResult<ProvisionCvm>>;
  safeProvisionCvm<T extends z.ZodTypeAny>(
    request: ProvisionCvmRequest,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeProvisionCvm(
    request: ProvisionCvmRequest,
    parameters: { schema: false },
  ): Promise<SafeResult<unknown>>;

  commitCvmProvision(request: CommitCvmProvisionRequest): Promise<CommitCvmProvision>;
  commitCvmProvision<T extends z.ZodTypeAny>(
    request: CommitCvmProvisionRequest,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  commitCvmProvision(
    request: CommitCvmProvisionRequest,
    parameters: { schema: false },
  ): Promise<unknown>;

  safeCommitCvmProvision(
    request: CommitCvmProvisionRequest,
  ): Promise<SafeResult<CommitCvmProvision>>;
  safeCommitCvmProvision<T extends z.ZodTypeAny>(
    request: CommitCvmProvisionRequest,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeCommitCvmProvision(
    request: CommitCvmProvisionRequest,
    parameters: { schema: false },
  ): Promise<SafeResult<unknown>>;

  provisionCvmComposeFileUpdate(
    request: ProvisionCvmComposeFileUpdateRequest,
  ): Promise<ProvisionCvmComposeFileUpdateResult>;
  provisionCvmComposeFileUpdate<T extends z.ZodTypeAny>(
    request: ProvisionCvmComposeFileUpdateRequest,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  provisionCvmComposeFileUpdate(
    request: ProvisionCvmComposeFileUpdateRequest,
    parameters: { schema: false },
  ): Promise<unknown>;

  safeProvisionCvmComposeFileUpdate(
    request: ProvisionCvmComposeFileUpdateRequest,
  ): Promise<SafeResult<ProvisionCvmComposeFileUpdateResult>>;
  safeProvisionCvmComposeFileUpdate<T extends z.ZodTypeAny>(
    request: ProvisionCvmComposeFileUpdateRequest,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeProvisionCvmComposeFileUpdate(
    request: ProvisionCvmComposeFileUpdateRequest,
    parameters: { schema: false },
  ): Promise<SafeResult<unknown>>;

  commitCvmComposeFileUpdate(
    request: CommitCvmComposeFileUpdateRequest,
  ): Promise<CommitCvmComposeFileUpdate>;
  commitCvmComposeFileUpdate<T extends z.ZodTypeAny>(
    request: CommitCvmComposeFileUpdateRequest,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  commitCvmComposeFileUpdate(
    request: CommitCvmComposeFileUpdateRequest,
    parameters: { schema: false },
  ): Promise<unknown>;

  safeCommitCvmComposeFileUpdate(
    request: CommitCvmComposeFileUpdateRequest,
  ): Promise<SafeResult<CommitCvmComposeFileUpdate>>;
  safeCommitCvmComposeFileUpdate<T extends z.ZodTypeAny>(
    request: CommitCvmComposeFileUpdateRequest,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeCommitCvmComposeFileUpdate(
    request: CommitCvmComposeFileUpdateRequest,
    parameters: { schema: false },
  ): Promise<SafeResult<unknown>>;

  updateCvmEnvs(request: UpdateCvmEnvsRequest): Promise<UpdateCvmEnvsResult>;
  updateCvmEnvs<T extends z.ZodTypeAny>(
    request: UpdateCvmEnvsRequest,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  updateCvmEnvs(request: UpdateCvmEnvsRequest, parameters: { schema: false }): Promise<unknown>;

  safeUpdateCvmEnvs(request: UpdateCvmEnvsRequest): Promise<SafeResult<UpdateCvmEnvsResult>>;
  safeUpdateCvmEnvs<T extends z.ZodTypeAny>(
    request: UpdateCvmEnvsRequest,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeUpdateCvmEnvs(
    request: UpdateCvmEnvsRequest,
    parameters: { schema: false },
  ): Promise<SafeResult<unknown>>;

  updateDockerCompose(request: UpdateDockerComposeRequest): Promise<UpdateDockerComposeResult>;
  updateDockerCompose<T extends z.ZodTypeAny>(
    request: UpdateDockerComposeRequest,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  updateDockerCompose(
    request: UpdateDockerComposeRequest,
    parameters: { schema: false },
  ): Promise<unknown>;

  safeUpdateDockerCompose(
    request: UpdateDockerComposeRequest,
  ): Promise<SafeResult<UpdateDockerComposeResult>>;
  safeUpdateDockerCompose<T extends z.ZodTypeAny>(
    request: UpdateDockerComposeRequest,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeUpdateDockerCompose(
    request: UpdateDockerComposeRequest,
    parameters: { schema: false },
  ): Promise<SafeResult<unknown>>;

  updatePreLaunchScript(
    request: UpdatePreLaunchScriptRequest,
  ): Promise<UpdatePreLaunchScriptResult>;
  updatePreLaunchScript<T extends z.ZodTypeAny>(
    request: UpdatePreLaunchScriptRequest,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  updatePreLaunchScript(
    request: UpdatePreLaunchScriptRequest,
    parameters: { schema: false },
  ): Promise<unknown>;

  safeUpdatePreLaunchScript(
    request: UpdatePreLaunchScriptRequest,
  ): Promise<SafeResult<UpdatePreLaunchScriptResult>>;
  safeUpdatePreLaunchScript<T extends z.ZodTypeAny>(
    request: UpdatePreLaunchScriptRequest,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeUpdatePreLaunchScript(
    request: UpdatePreLaunchScriptRequest,
    parameters: { schema: false },
  ): Promise<SafeResult<unknown>>;

  getCvmPreLaunchScript(request: GetCvmPreLaunchScriptRequest): Promise<string>;
  getCvmPreLaunchScript<T extends z.ZodTypeAny>(
    request: GetCvmPreLaunchScriptRequest,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  getCvmPreLaunchScript(
    request: GetCvmPreLaunchScriptRequest,
    parameters: { schema: false },
  ): Promise<unknown>;

  safeGetCvmPreLaunchScript(request: GetCvmPreLaunchScriptRequest): Promise<SafeResult<string>>;
  safeGetCvmPreLaunchScript<T extends z.ZodTypeAny>(
    request: GetCvmPreLaunchScriptRequest,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeGetCvmPreLaunchScript(
    request: GetCvmPreLaunchScriptRequest,
    parameters: { schema: false },
  ): Promise<SafeResult<unknown>>;

  getPreLaunchScriptUpgradeStatus(
    request: GetPreLaunchScriptUpgradeStatusRequest,
  ): Promise<PreLaunchScriptUpgradeStatus>;
  getPreLaunchScriptUpgradeStatus<T extends z.ZodTypeAny>(
    request: GetPreLaunchScriptUpgradeStatusRequest,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  getPreLaunchScriptUpgradeStatus(
    request: GetPreLaunchScriptUpgradeStatusRequest,
    parameters: { schema: false },
  ): Promise<unknown>;

  safeGetPreLaunchScriptUpgradeStatus(
    request: GetPreLaunchScriptUpgradeStatusRequest,
  ): Promise<SafeResult<PreLaunchScriptUpgradeStatus>>;
  safeGetPreLaunchScriptUpgradeStatus<T extends z.ZodTypeAny>(
    request: GetPreLaunchScriptUpgradeStatusRequest,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeGetPreLaunchScriptUpgradeStatus(
    request: GetPreLaunchScriptUpgradeStatusRequest,
    parameters: { schema: false },
  ): Promise<SafeResult<unknown>>;

  upgradePreLaunchScript(
    request: UpgradePreLaunchScriptRequest,
  ): Promise<UpgradePreLaunchScriptResult>;
  upgradePreLaunchScript<T extends z.ZodTypeAny>(
    request: UpgradePreLaunchScriptRequest,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  upgradePreLaunchScript(
    request: UpgradePreLaunchScriptRequest,
    parameters: { schema: false },
  ): Promise<unknown>;

  safeUpgradePreLaunchScript(
    request: UpgradePreLaunchScriptRequest,
  ): Promise<SafeResult<UpgradePreLaunchScriptResult>>;
  safeUpgradePreLaunchScript<T extends z.ZodTypeAny>(
    request: UpgradePreLaunchScriptRequest,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeUpgradePreLaunchScript(
    request: UpgradePreLaunchScriptRequest,
    parameters: { schema: false },
  ): Promise<SafeResult<unknown>>;

  getKmsInfo(request: GetKmsInfoRequest): Promise<KmsInfo>;
  getKmsInfo<T extends z.ZodTypeAny>(
    request: GetKmsInfoRequest,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  getKmsInfo(request: GetKmsInfoRequest, parameters: { schema: false }): Promise<unknown>;

  safeGetKmsInfo(request: GetKmsInfoRequest): Promise<SafeResult<KmsInfo>>;
  safeGetKmsInfo<T extends z.ZodTypeAny>(
    request: GetKmsInfoRequest,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeGetKmsInfo(
    request: GetKmsInfoRequest,
    parameters: { schema: false },
  ): Promise<SafeResult<unknown>>;

  getAppEnvEncryptPubKey(
    request: GetAppEnvEncryptPubKeyRequest,
  ): Promise<GetAppEnvEncryptPubKeyResult>;
  getAppEnvEncryptPubKey<T extends z.ZodTypeAny>(
    request: GetAppEnvEncryptPubKeyRequest,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  getAppEnvEncryptPubKey(
    request: GetAppEnvEncryptPubKeyRequest,
    parameters: { schema: false },
  ): Promise<unknown>;

  safeGetAppEnvEncryptPubKey(
    request: GetAppEnvEncryptPubKeyRequest,
  ): Promise<SafeResult<GetAppEnvEncryptPubKeyResult>>;
  safeGetAppEnvEncryptPubKey<T extends z.ZodTypeAny>(
    request: GetAppEnvEncryptPubKeyRequest,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeGetAppEnvEncryptPubKey(
    request: GetAppEnvEncryptPubKeyRequest,
    parameters: { schema: false },
  ): Promise<SafeResult<unknown>>;

  nextAppIds(request?: NextAppIdsRequest): Promise<NextAppIds>;
  nextAppIds<T extends z.ZodTypeAny>(
    request: NextAppIdsRequest | undefined,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  nextAppIds(
    request: NextAppIdsRequest | undefined,
    parameters: { schema: false },
  ): Promise<unknown>;

  safeNextAppIds(request?: NextAppIdsRequest): Promise<SafeResult<NextAppIds>>;
  safeNextAppIds<T extends z.ZodTypeAny>(
    request: NextAppIdsRequest | undefined,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeNextAppIds(
    request: NextAppIdsRequest | undefined,
    parameters: { schema: false },
  ): Promise<SafeResult<unknown>>;

  // CVM Lifecycle Operations
  startCvm(request: StartCvmRequest): Promise<VM>;
  startCvm<T extends z.ZodTypeAny>(
    request: StartCvmRequest,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  startCvm(request: StartCvmRequest, parameters: { schema: false }): Promise<unknown>;

  safeStartCvm(request: StartCvmRequest): Promise<SafeResult<VM>>;
  safeStartCvm<T extends z.ZodTypeAny>(
    request: StartCvmRequest,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeStartCvm(
    request: StartCvmRequest,
    parameters: { schema: false },
  ): Promise<SafeResult<unknown>>;

  stopCvm(request: StopCvmRequest): Promise<VM>;
  stopCvm<T extends z.ZodTypeAny>(
    request: StopCvmRequest,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  stopCvm(request: StopCvmRequest, parameters: { schema: false }): Promise<unknown>;

  safeStopCvm(request: StopCvmRequest): Promise<SafeResult<VM>>;
  safeStopCvm<T extends z.ZodTypeAny>(
    request: StopCvmRequest,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeStopCvm(request: StopCvmRequest, parameters: { schema: false }): Promise<SafeResult<unknown>>;

  shutdownCvm(request: ShutdownCvmRequest): Promise<VM>;
  shutdownCvm<T extends z.ZodTypeAny>(
    request: ShutdownCvmRequest,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  shutdownCvm(request: ShutdownCvmRequest, parameters: { schema: false }): Promise<unknown>;

  safeShutdownCvm(request: ShutdownCvmRequest): Promise<SafeResult<VM>>;
  safeShutdownCvm<T extends z.ZodTypeAny>(
    request: ShutdownCvmRequest,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeShutdownCvm(
    request: ShutdownCvmRequest,
    parameters: { schema: false },
  ): Promise<SafeResult<unknown>>;

  restartCvm(request: RestartCvmRequest): Promise<VM>;
  restartCvm<T extends z.ZodTypeAny>(
    request: RestartCvmRequest,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  restartCvm(request: RestartCvmRequest, parameters: { schema: false }): Promise<unknown>;

  safeRestartCvm(request: RestartCvmRequest): Promise<SafeResult<VM>>;
  safeRestartCvm<T extends z.ZodTypeAny>(
    request: RestartCvmRequest,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeRestartCvm(
    request: RestartCvmRequest,
    parameters: { schema: false },
  ): Promise<SafeResult<unknown>>;

  deleteCvm(request: DeleteCvmRequest): Promise<void>;
  deleteCvm<T extends z.ZodTypeAny>(
    request: DeleteCvmRequest,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  deleteCvm(request: DeleteCvmRequest, parameters: { schema: false }): Promise<unknown>;

  safeDeleteCvm(request: DeleteCvmRequest): Promise<SafeResult<void>>;
  safeDeleteCvm<T extends z.ZodTypeAny>(
    request: DeleteCvmRequest,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeDeleteCvm(
    request: DeleteCvmRequest,
    parameters: { schema: false },
  ): Promise<SafeResult<unknown>>;

  // CVM Info/Stats Operations
  getCvmStats(request: GetCvmStatsRequest): Promise<CvmSystemInfo>;
  getCvmStats<T extends z.ZodTypeAny>(
    request: GetCvmStatsRequest,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  getCvmStats(request: GetCvmStatsRequest, parameters: { schema: false }): Promise<unknown>;

  safeGetCvmStats(request: GetCvmStatsRequest): Promise<SafeResult<CvmSystemInfo>>;
  safeGetCvmStats<T extends z.ZodTypeAny>(
    request: GetCvmStatsRequest,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeGetCvmStats(
    request: GetCvmStatsRequest,
    parameters: { schema: false },
  ): Promise<SafeResult<unknown>>;

  getCvmNetwork(request: GetCvmNetworkRequest): Promise<CvmNetwork>;
  getCvmNetwork<T extends z.ZodTypeAny>(
    request: GetCvmNetworkRequest,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  getCvmNetwork(request: GetCvmNetworkRequest, parameters: { schema: false }): Promise<unknown>;

  safeGetCvmNetwork(request: GetCvmNetworkRequest): Promise<SafeResult<CvmNetwork>>;
  safeGetCvmNetwork<T extends z.ZodTypeAny>(
    request: GetCvmNetworkRequest,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeGetCvmNetwork(
    request: GetCvmNetworkRequest,
    parameters: { schema: false },
  ): Promise<SafeResult<unknown>>;

  getCvmDockerCompose(request: GetCvmDockerComposeRequest): Promise<string>;
  getCvmDockerCompose<T extends z.ZodTypeAny>(
    request: GetCvmDockerComposeRequest,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  getCvmDockerCompose(
    request: GetCvmDockerComposeRequest,
    parameters: { schema: false },
  ): Promise<unknown>;

  safeGetCvmDockerCompose(request: GetCvmDockerComposeRequest): Promise<SafeResult<string>>;
  safeGetCvmDockerCompose<T extends z.ZodTypeAny>(
    request: GetCvmDockerComposeRequest,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeGetCvmDockerCompose(
    request: GetCvmDockerComposeRequest,
    parameters: { schema: false },
  ): Promise<SafeResult<unknown>>;

  getCvmContainersStats(request: GetCvmContainersStatsRequest): Promise<CvmContainersStats>;
  getCvmContainersStats<T extends z.ZodTypeAny>(
    request: GetCvmContainersStatsRequest,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  getCvmContainersStats(
    request: GetCvmContainersStatsRequest,
    parameters: { schema: false },
  ): Promise<unknown>;

  safeGetCvmContainersStats(
    request: GetCvmContainersStatsRequest,
  ): Promise<SafeResult<CvmContainersStats>>;
  safeGetCvmContainersStats<T extends z.ZodTypeAny>(
    request: GetCvmContainersStatsRequest,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeGetCvmContainersStats(
    request: GetCvmContainersStatsRequest,
    parameters: { schema: false },
  ): Promise<SafeResult<unknown>>;

  getCvmAttestation(request: GetCvmAttestationRequest): Promise<CvmAttestation>;
  getCvmAttestation<T extends z.ZodTypeAny>(
    request: GetCvmAttestationRequest,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  getCvmAttestation(
    request: GetCvmAttestationRequest,
    parameters: { schema: false },
  ): Promise<unknown>;

  safeGetCvmAttestation(request: GetCvmAttestationRequest): Promise<SafeResult<CvmAttestation>>;
  safeGetCvmAttestation<T extends z.ZodTypeAny>(
    request: GetCvmAttestationRequest,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeGetCvmAttestation(
    request: GetCvmAttestationRequest,
    parameters: { schema: false },
  ): Promise<SafeResult<unknown>>;

  // CVM Update Operations
  updateCvmResources(request: UpdateCvmResourcesRequest): Promise<void>;
  updateCvmResources<T extends z.ZodTypeAny>(
    request: UpdateCvmResourcesRequest,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  updateCvmResources(
    request: UpdateCvmResourcesRequest,
    parameters: { schema: false },
  ): Promise<unknown>;

  safeUpdateCvmResources(request: UpdateCvmResourcesRequest): Promise<SafeResult<void>>;
  safeUpdateCvmResources<T extends z.ZodTypeAny>(
    request: UpdateCvmResourcesRequest,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeUpdateCvmResources(
    request: UpdateCvmResourcesRequest,
    parameters: { schema: false },
  ): Promise<SafeResult<unknown>>;

  updateCvmVisibility(request: UpdateCvmVisibilityRequest): Promise<void>;
  updateCvmVisibility<T extends z.ZodTypeAny>(
    request: UpdateCvmVisibilityRequest,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  updateCvmVisibility(
    request: UpdateCvmVisibilityRequest,
    parameters: { schema: false },
  ): Promise<unknown>;

  safeUpdateCvmVisibility(request: UpdateCvmVisibilityRequest): Promise<SafeResult<void>>;
  safeUpdateCvmVisibility<T extends z.ZodTypeAny>(
    request: UpdateCvmVisibilityRequest,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeUpdateCvmVisibility(
    request: UpdateCvmVisibilityRequest,
    parameters: { schema: false },
  ): Promise<SafeResult<unknown>>;

  // OS Image Operations
  getAvailableOsImages(request: GetAvailableOSImagesRequest): Promise<GetAvailableOSImagesResponse>;
  getAvailableOsImages<T extends z.ZodTypeAny>(
    request: GetAvailableOSImagesRequest,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  getAvailableOsImages(
    request: GetAvailableOSImagesRequest,
    parameters: { schema: false },
  ): Promise<unknown>;

  safeGetAvailableOsImages(
    request: GetAvailableOSImagesRequest,
  ): Promise<SafeResult<GetAvailableOSImagesResponse>>;
  safeGetAvailableOsImages<T extends z.ZodTypeAny>(
    request: GetAvailableOSImagesRequest,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeGetAvailableOsImages(
    request: GetAvailableOSImagesRequest,
    parameters: { schema: false },
  ): Promise<SafeResult<unknown>>;

  updateOsImage(request: UpdateOsImageRequest): Promise<void>;
  updateOsImage<T extends z.ZodTypeAny>(
    request: UpdateOsImageRequest,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  updateOsImage(request: UpdateOsImageRequest, parameters: { schema: false }): Promise<unknown>;

  safeUpdateOsImage(request: UpdateOsImageRequest): Promise<SafeResult<void>>;
  safeUpdateOsImage<T extends z.ZodTypeAny>(
    request: UpdateOsImageRequest,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeUpdateOsImage(
    request: UpdateOsImageRequest,
    parameters: { schema: false },
  ): Promise<SafeResult<unknown>>;

  // CVM State Operations
  getCvmState(request: GetCvmStateRequest): Promise<CvmState>;
  getCvmState<T extends z.ZodTypeAny>(
    request: GetCvmStateRequest,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  getCvmState(request: GetCvmStateRequest, parameters: { schema: false }): Promise<unknown>;

  safeGetCvmState(request: GetCvmStateRequest): Promise<SafeResult<CvmState>>;
  safeGetCvmState<T extends z.ZodTypeAny>(
    request: GetCvmStateRequest,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeGetCvmState(
    request: GetCvmStateRequest,
    parameters: { schema: false },
  ): Promise<SafeResult<unknown>>;

  // SSH Key Operations
  listSshKeys(): Promise<ListSshKeysResponse>;
  listSshKeys<T extends z.ZodTypeAny>(parameters: { schema: T }): Promise<z.infer<T>>;
  listSshKeys(parameters: { schema: false }): Promise<unknown>;

  safeListSshKeys(): Promise<SafeResult<ListSshKeysResponse>>;
  safeListSshKeys<T extends z.ZodTypeAny>(parameters: { schema: T }): Promise<
    SafeResult<z.infer<T>>
  >;
  safeListSshKeys(parameters: { schema: false }): Promise<SafeResult<unknown>>;

  importGithubProfileSshKeys(
    request: ImportGithubProfileRequest,
  ): Promise<ImportGithubProfileResponse>;
  importGithubProfileSshKeys<T extends z.ZodTypeAny>(
    request: ImportGithubProfileRequest,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  importGithubProfileSshKeys(
    request: ImportGithubProfileRequest,
    parameters: { schema: false },
  ): Promise<unknown>;

  safeImportGithubProfileSshKeys(
    request: ImportGithubProfileRequest,
  ): Promise<SafeResult<ImportGithubProfileResponse>>;
  safeImportGithubProfileSshKeys<T extends z.ZodTypeAny>(
    request: ImportGithubProfileRequest,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeImportGithubProfileSshKeys(
    request: ImportGithubProfileRequest,
    parameters: { schema: false },
  ): Promise<SafeResult<unknown>>;

  createSshKey(request: CreateSshKeyRequest): Promise<SshKey>;
  createSshKey<T extends z.ZodTypeAny>(
    request: CreateSshKeyRequest,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  createSshKey(request: CreateSshKeyRequest, parameters: { schema: false }): Promise<unknown>;

  safeCreateSshKey(request: CreateSshKeyRequest): Promise<SafeResult<SshKey>>;
  safeCreateSshKey<T extends z.ZodTypeAny>(
    request: CreateSshKeyRequest,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeCreateSshKey(
    request: CreateSshKeyRequest,
    parameters: { schema: false },
  ): Promise<SafeResult<unknown>>;

  deleteSshKey(request: DeleteSshKeyRequest): Promise<void>;
  deleteSshKey<T extends z.ZodTypeAny>(
    request: DeleteSshKeyRequest,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  deleteSshKey(request: DeleteSshKeyRequest, parameters: { schema: false }): Promise<unknown>;

  safeDeleteSshKey(request: DeleteSshKeyRequest): Promise<SafeResult<void>>;
  safeDeleteSshKey<T extends z.ZodTypeAny>(
    request: DeleteSshKeyRequest,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeDeleteSshKey(
    request: DeleteSshKeyRequest,
    parameters: { schema: false },
  ): Promise<SafeResult<unknown>>;

  syncGithubSshKeys(): Promise<SyncGithubSshKeysResponse>;
  syncGithubSshKeys<T extends z.ZodTypeAny>(parameters: { schema: T }): Promise<z.infer<T>>;
  syncGithubSshKeys(parameters: { schema: false }): Promise<unknown>;

  safeSyncGithubSshKeys(): Promise<SafeResult<SyncGithubSshKeysResponse>>;
  safeSyncGithubSshKeys<T extends z.ZodTypeAny>(parameters: { schema: T }): Promise<
    SafeResult<z.infer<T>>
  >;
  safeSyncGithubSshKeys(parameters: { schema: false }): Promise<SafeResult<unknown>>;

  // OS Images
  getOsImages(request?: GetOsImagesRequest): Promise<GetOsImagesResponse>;
  getOsImages<T extends z.ZodTypeAny>(
    request: GetOsImagesRequest | undefined,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  getOsImages(
    request: GetOsImagesRequest | undefined,
    parameters: { schema: false },
  ): Promise<unknown>;

  safeGetOsImages(request?: GetOsImagesRequest): Promise<SafeResult<GetOsImagesResponse>>;
  safeGetOsImages<T extends z.ZodTypeAny>(
    request: GetOsImagesRequest | undefined,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeGetOsImages(
    request: GetOsImagesRequest | undefined,
    parameters: { schema: false },
  ): Promise<SafeResult<unknown>>;

  // KMS On-Chain Detail
  getKmsOnChainDetail(request: GetKmsOnChainDetailRequest): Promise<GetKmsOnChainDetailResponse>;
  getKmsOnChainDetail<T extends z.ZodTypeAny>(
    request: GetKmsOnChainDetailRequest,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  getKmsOnChainDetail(
    request: GetKmsOnChainDetailRequest,
    parameters: { schema: false },
  ): Promise<unknown>;

  safeGetKmsOnChainDetail(
    request: GetKmsOnChainDetailRequest,
  ): Promise<SafeResult<GetKmsOnChainDetailResponse>>;
  safeGetKmsOnChainDetail<T extends z.ZodTypeAny>(
    request: GetKmsOnChainDetailRequest,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  safeGetKmsOnChainDetail(
    request: GetKmsOnChainDetailRequest,
    parameters: { schema: false },
  ): Promise<SafeResult<unknown>>;
}
