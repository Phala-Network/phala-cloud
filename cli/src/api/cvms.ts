import { safeGetCvmList, safeGetCvmInfo, safeGetCvmComposeFile, type Client } from '@phala/cloud';
import { getClient } from '@/src/lib/client';
import { logger } from '@/src/utils/logger';
import {
  postCvmResponseSchema,
  cvmAttestationResponseSchema,
  getCvmNetworkResponseSchema,
  replicateCvmResponseSchema,
  ReplicateCvmResponse,
} from './types';
import type {
  PostCvmResponse,
  CvmAttestationResponse,
  GetCvmNetworkResponse,
} from './types';
import inquirer from 'inquirer';

/**
 * Check CVM exists for the current user and appId
 * @param appId App ID (with or without app_ prefix)
 * @returns CVM appId string (without app_ prefix) or throws if not found
 */
export async function checkCvmExists(appId: string): Promise<string> {
  const client = await getClient();
  const result = await safeGetCvmList(client);

  if (!result.success) {
    logger.error(`Failed to fetch CVMs: ${result.error.message}`);
    process.exit(1);
  }

  // Normalize input: remove app_ prefix if present
  const cleanAppId = appId.replace(/^app_/, '');

  const cvms = (result.data as any).items;
  const cvm = cvms.find((cvm: any) => cvm.hosted?.app_id === cleanAppId);

  if (!cvm) {
    logger.error(`CVM with App ID app_${cleanAppId} not detected`);
    process.exit(1);
  } else {
    logger.success(`CVM with App ID app_${cleanAppId} detected`);
    return cvm.hosted?.app_id || '';
  }
}

/**
 * Get CVM by App ID using SDK
 * @param appId App ID (with or without app_ prefix)
 * @returns CVM details
 */
export async function getCvmByAppId(appId: string) {
  const client = await getClient();
  // Remove app_ prefix if present, SDK will add it back
  const cleanAppId = appId.replace(/^app_/, '');
  const result = await safeGetCvmInfo(client, { app_id: cleanAppId });

  if (!result.success) {
    throw new Error(result.error.message);
  }

  return result.data;
}

/**
 * Get CVM compose configuration
 */
export async function getCvmComposeConfig(cvmId: string) {
  const client = await getClient();
  const result = await safeGetCvmComposeFile(client, { id: cvmId });

  if (!result.success) {
    throw new Error(result.error.message);
  }

  return result.data;
}

/**
 * Get CVM network information
 * @param appId App ID (with or without app_ prefix)
 * @returns Network information
 */
export async function getCvmNetwork(appId: string): Promise<GetCvmNetworkResponse> {
  const client = await getClient();
  const cleanAppId = appId.replace(/^app_/, '');
  const response = await client.get<GetCvmNetworkResponse>(`cvms/app_${cleanAppId}/network`);
  return getCvmNetworkResponseSchema.parse(response);
}

/**
 * Start a CVM
 * @param appId App ID (with or without app_ prefix)
 * @returns Success status
 */
export async function startCvm(appId: string): Promise<PostCvmResponse> {
  const client = await getClient();
  const cleanAppId = appId.replace(/^app_/, '');
  const response = await client.post<PostCvmResponse>(`cvms/app_${cleanAppId}/start`);
  return postCvmResponseSchema.parse(response);
}

/**
 * Stop a CVM
 * @param appId App ID (with or without app_ prefix)
 * @returns Success status
 */
export async function stopCvm(appId: string): Promise<PostCvmResponse> {
  const client = await getClient();
  const cleanAppId = appId.replace(/^app_/, '');
  const response = await client.post<PostCvmResponse>(`cvms/app_${cleanAppId}/stop`);
  return postCvmResponseSchema.parse(response);
}

/**
 * Restart a CVM
 * @param appId App ID (with or without app_ prefix)
 * @returns Success status
 */
export async function restartCvm(appId: string): Promise<PostCvmResponse> {
  const client = await getClient();
  const cleanAppId = appId.replace(/^app_/, '');
  const response = await client.post<PostCvmResponse>(`cvms/app_${cleanAppId}/restart`);
  return postCvmResponseSchema.parse(response);
}

/**
 * Delete a CVM
 * @param appId App ID (with or without app_ prefix)
 * @returns Success status
 */
export async function deleteCvm(appId: string): Promise<boolean> {
  const client = await getClient();
  const cleanAppId = appId.replace(/^app_/, '');
  await client.delete(`cvms/app_${cleanAppId}`);
  return true;
}

/**
 * Presents a list of CVMs to the user and allows them to select one
 * @returns The selected CVM app ID or undefined if no CVMs exist
 */
export async function selectCvm(): Promise<string | undefined> {
  const listSpinner = logger.startSpinner('Fetching available CVMs');
  const client = await getClient();
  const result = await safeGetCvmList(client);
  listSpinner.stop(true);

  if (!result.success) {
    logger.error(`Failed to fetch CVMs: ${result.error.message}`);
    return undefined;
  }

  const cvms = (result.data as any).items;

  if (!cvms || cvms.length === 0) {
    logger.info('No CVMs found for your account');
    return undefined;
  }

  // Prepare choices for the inquirer prompt
  const choices = cvms.map((cvm: any) => {
    // Handle different API response formats
    const id = cvm.hosted?.app_id || cvm.hosted?.id;
    const name = cvm.name || cvm.hosted?.name;
    const status = cvm.status || cvm.hosted?.status;

    return {
      name: `${name || 'Unnamed'} (${id}) - Status: ${status || 'Unknown'}`,
      value: id
    };
  });

  const { selectedCvm } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedCvm',
      message: 'Select a CVM:',
      choices
    }
  ]);

  return selectedCvm;
}

/**
 * Get attestation information for a CVM
 * @param appId App ID (with or without app_ prefix)
 * @returns Attestation information
 */
export async function getCvmAttestation(appId: string): Promise<CvmAttestationResponse> {
  const client = await getClient();
  const cleanAppId = appId.replace(/^app_/, '');
  const response = await client.get<CvmAttestationResponse>(`cvms/app_${cleanAppId}/attestation`);

  // Attempt to validate and return the response
  try {
    return cvmAttestationResponseSchema.parse(response);
  } catch (validationError) {
    logger.debug(`Validation error: ${validationError instanceof Error ? validationError.message : String(validationError)}`);

    // If validation fails, create a normalized response object
    const normalizedResponse: CvmAttestationResponse = {
      is_online: Boolean(response?.is_online),
      is_public: Boolean(response?.is_public),
      error: typeof response?.error === 'string' ? response.error : null,
      app_certificates: Array.isArray(response?.app_certificates) ? response.app_certificates : null,
      tcb_info: response?.tcb_info || null,
      compose_file: typeof response?.compose_file === 'string' ? response.compose_file : null
    };

    return normalizedResponse;
  }
}

/**
 * Resize payload type
 */
export interface ResizeCvmPayload {
  vcpu?: number;
  memory?: number;
  disk_size?: number;
  allow_restart?: number;
}

/**
 * Replicate a CVM
 * @param appId App ID (with or without app_ prefix)
 */
export async function replicateCvm(
  appId: string,
  payload: {
    teepod_id?: number;
    encrypted_env?: string;
  }
): Promise<ReplicateCvmResponse> {
  const client = await getClient();
  const cleanAppId = appId.replace(/^app_/, '');
  const response = await client.post<ReplicateCvmResponse>(
    `cvms/app_${cleanAppId}/replicas`,
    payload
  );
  return replicateCvmResponseSchema.parse(response);
}

/**
 * Resize a CVM's resources
 * @param appId App ID (with or without app_ prefix)
 * @param vcpu Number of virtual CPUs (optional)
 * @param memory Memory size in MB (optional)
 * @param diskSize Disk size in GB (optional)
 * @param allowRestart Whether to allow restart (1) or not (0) for the resize operation (optional)
 * @returns Success status
 */
export async function resizeCvm(
  appId: string,
  vcpu?: number,
  memory?: number,
  diskSize?: number,
  allowRestart?: number
): Promise<boolean> {
  const client = await getClient();
  const cleanAppId = appId.replace(/^app_/, '');
  // Only include defined parameters in the payload
  const resizePayload: Record<string, unknown> = {};

  if (vcpu !== undefined) resizePayload.vcpu = vcpu;
  if (memory !== undefined) resizePayload.memory = memory;
  if (diskSize !== undefined) resizePayload.disk_size = diskSize;
  if (allowRestart !== undefined) resizePayload.allow_restart = allowRestart;

  // Check if any parameters were provided
  if (Object.keys(resizePayload).length === 0) {
    throw new Error('At least one resource parameter must be provided');
  }

  await client.patch(`cvms/app_${cleanAppId}/resources`, resizePayload);
  return true;
}

// ============================================
// Legacy Functions (for create/upgrade commands)
// These use the old API endpoints
// ============================================

/**
 * VM configuration type
 */
export interface VMConfig {
  [key: string]: unknown;
}

/**
 * Get public key from CVM (Legacy)
 * @deprecated This is a legacy function for create command
 * @param vmConfig VM configuration
 * @returns Public key
 */
export async function getPubkeyFromCvm(vmConfig: VMConfig) {
  const client = await getClient();
  const response = await client.post('cvms/pubkey/from_cvm_configuration', vmConfig);
  return response;
}

/**
 * Create a new CVM (Legacy)
 * @deprecated This is a legacy function, consider using SDK's provisionCvm
 * @param vmConfig VM configuration
 * @returns Created CVM details
 */
export async function createCvm(vmConfig: VMConfig): Promise<PostCvmResponse> {
  const client = await getClient();
  const response = await client.post<PostCvmResponse>('cvms/from_cvm_configuration', vmConfig);
  return postCvmResponseSchema.parse(response);
}

/**
 * Upgrade a CVM (Legacy)
 * @deprecated This is a legacy function, consider using SDK's provisionCvmComposeFileUpdate
 * @param appId App ID (with or without app_ prefix)
 * @param vmConfig VM configuration
 * @returns Upgrade response
 */
export async function upgradeCvm(appId: string, vmConfig: VMConfig) {
  const client = await getClient();
  const cleanAppId = appId.replace(/^app_/, '');
  const response = await client.put(`cvms/app_${cleanAppId}/compose`, vmConfig);
  return response;
}

/**
 * Get all TEEPods with their images (Legacy)
 * @deprecated This is a legacy function for create command, use SDK's safeGetAvailableNodes instead
 * @param v03x_only Only get v0.3.x compatible nodes
 * @returns List of TEEPods with embedded images
 */
export async function getTeepods(v03x_only: boolean = false) {
  const client = await getClient();
  let url = 'teepods/available';
  if (v03x_only) {
    url += '?v03x_only=1';
  }
  const response = await client.get(url);
  return response;
}
