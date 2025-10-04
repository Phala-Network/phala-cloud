import { createClient } from '@phala/cloud';
import { logger } from '@/src/utils/logger';
import {
  cvmInstanceSchema,
  getCvmByAppIdResponseSchema,
  getPubkeyFromCvmResponseSchema,
  postCvmResponseSchema,
  upgradeCvmResponseSchema,
  cvmAttestationResponseSchema,
  getCvmNetworkResponseSchema,
  replicateCvmResponseSchema,
  ReplicateCvmResponse,
  CvmComposeConfig,
  cvmComposeConfigSchema,
} from './types';
import type {
  CvmInstance,
  GetCvmByAppIdResponse,
  GetPubkeyFromCvmResponse,
  PostCvmResponse,
  UpgradeCvmResponse,
  CvmAttestationResponse,
  GetCvmNetworkResponse,
} from './types';
import inquirer from 'inquirer';
import { z } from 'zod';
import { getApiKey } from '@/src/utils/credentials';

/**
 * Get all CVMs for the current user
 * @returns List of CVMs
 */
export async function getCvms(): Promise<CvmInstance[]> {
  try {
    const apiKey = getApiKey();
    const apiClient = createClient({ apiKey: apiKey });
    const response = await apiClient.get<CvmInstance[]>('cvms?user_id=0');
    return z.array(cvmInstanceSchema).parse(response);
  } catch (error) {
    throw new Error(`Failed to get CVMs: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * VM configuration type
 */
export interface VMConfig {
  // Add specific properties as needed
  [key: string]: unknown;
}

/**
 * Update payload type
 */
export interface UpdateCvmPayload {
  app_id: string;
  [key: string]: unknown;
}

/**
 * Check CVM exists for the current user and appId
 * @param appId App ID
 * @returns CVM appId string or null if it doesn't exist
 */
export async function checkCvmExists(appId: string): Promise<string> {
  const cvms = await getCvms();
  const cvm = cvms.find(cvm => (cvm.hosted?.app_id === appId || `app_${cvm.hosted?.app_id}` === appId));
  if (!cvm) {
    logger.error(`CVM with App ID app_${appId} not detected`);
    process.exit(1);
  } else {
    logger.success(`CVM with App ID app_${appId} detected`);
    return cvm.hosted?.app_id || '';
  }
}

/**
 * Get a CVM by App ID
 * @param appId App ID
 * @returns CVM details
 */
export async function getCvmByAppId(appId: string): Promise<GetCvmByAppIdResponse> {
  try {
    const apiKey = getApiKey();
    const apiClient = createClient({ apiKey: apiKey });
    const response = await apiClient.get<GetCvmByAppIdResponse>(`cvms/app_${appId}`);
    return getCvmByAppIdResponseSchema.parse(response);
  } catch (error) {
    throw new Error(`Failed to get CVM by App ID: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get public key from CVM
 * @param vmConfig VM configuration
 * @returns Public key
 */
export async function getPubkeyFromCvm(vmConfig: VMConfig): Promise<GetPubkeyFromCvmResponse> {
  const apiKey = getApiKey();
  const apiClient = createClient({ apiKey: apiKey });
  const response = await apiClient.post<GetPubkeyFromCvmResponse>('cvms/pubkey/from_cvm_configuration', vmConfig);
  return getPubkeyFromCvmResponseSchema.parse(response);
}

/**
 * Get network information for a CVM
 * @param appId App ID
 * @returns Network information
 */
export async function getCvmNetwork(appId: string): Promise<GetCvmNetworkResponse> {
  try {
    const apiKey = getApiKey();
    const apiClient = createClient({ apiKey: apiKey });
    const response = await apiClient.get<GetCvmNetworkResponse>(`cvms/app_${appId}/network`);
    return getCvmNetworkResponseSchema.parse(response);
  } catch (error) {
    throw new Error(`Failed to get network information for CVM: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Create a new CVM
 * @param vmConfig VM configuration
 * @returns Created CVM details
 */
export async function createCvm(vmConfig: VMConfig): Promise<PostCvmResponse> {
  try {
    const apiKey = getApiKey();
    const apiClient = createClient({ apiKey: apiKey });
    const response = await apiClient.post<PostCvmResponse>('cvms/from_cvm_configuration', vmConfig);
    return postCvmResponseSchema.parse(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('Schema validation error:', JSON.stringify(error.errors, null, 2));
      logger.error('API response:', JSON.stringify(error.format(), null, 2));
      throw new Error(`Response validation failed: ${JSON.stringify(error.errors)}`);
    }
    throw new Error(`Failed to create CVM: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Start a CVM
 * @param appId App ID
 * @returns Success status
 */
export async function startCvm(appId: string): Promise<PostCvmResponse> {
  try {
    const apiKey = getApiKey();
    const apiClient = createClient({ apiKey: apiKey });
    const response = await apiClient.post<PostCvmResponse>(`cvms/app_${appId}/start`);
    return postCvmResponseSchema.parse(response);
  } catch (error) {
    throw new Error(`Failed to start CVM: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Stop a CVM
 * @param appId App ID
 * @returns Success status
 */
export async function stopCvm(appId: string): Promise<PostCvmResponse> {
  try {
    const apiKey = getApiKey();
    const apiClient = createClient({ apiKey: apiKey });
    const response = await apiClient.post<PostCvmResponse>(`cvms/app_${appId}/stop`);
    return postCvmResponseSchema.parse(response);
  } catch (error) {
    throw new Error(`Failed to stop CVM: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Restart a CVM
 * @param appId App ID
 * @returns Success status
 */
export async function restartCvm(appId: string): Promise<PostCvmResponse> {
  try {
    const apiKey = getApiKey();
    const apiClient = createClient({ apiKey: apiKey });
    const response = await apiClient.post<PostCvmResponse>(`cvms/app_${appId}/restart`);
    return postCvmResponseSchema.parse(response);
  } catch (error) {
    throw new Error(`Failed to restart CVM: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Upgrade a CVM
 * @param appId App ID
 * @param vmConfig VM configuration
 * @returns Upgrade response
 */
export async function upgradeCvm(appId: string, vmConfig: VMConfig): Promise<UpgradeCvmResponse> {
  const apiKey = getApiKey();
  const apiClient = createClient({ apiKey: apiKey });
  const response = await apiClient.put<UpgradeCvmResponse>(`cvms/app_${appId}/compose`, vmConfig);
  return upgradeCvmResponseSchema.parse(response);
}

/**
 * Delete a CVM
 * @param appId App ID
 * @returns Success status
 */
export async function deleteCvm(appId: string): Promise<boolean> {
  try {
    const apiKey = getApiKey();
    const apiClient = createClient({ apiKey: apiKey });
    await apiClient.delete(`cvms/app_${appId}`);
    return true;
  } catch (error) {
    throw new Error(`Failed to delete CVM: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Update a CVM
 * @param updatePayload Update payload
 * @returns Updated CVM details
 */
export async function updateCvm(updatePayload: UpdateCvmPayload): Promise<unknown> {
  try {
    const apiKey = getApiKey();
    const apiClient = createClient({ apiKey: apiKey });
    const response = await apiClient.put(`cvms/app_${updatePayload.app_id}`, updatePayload);
    return response;
  } catch (error) {
    throw new Error(`Failed to update CVM: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Presents a list of CVMs to the user and allows them to select one
 * @returns The selected CVM app ID or undefined if no CVMs exist
 */
export async function selectCvm(): Promise<string | undefined> {
  const listSpinner = logger.startSpinner('Fetching available CVMs');
  const cvms = await getCvms();
  listSpinner.stop(true);
  
  if (!cvms || cvms.length === 0) {
    logger.info('No CVMs found for your account');
    return undefined;
  }
  
  // Prepare choices for the inquirer prompt
  const choices = cvms.map(cvm => {
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
 * @param appId App ID
 * @returns Attestation information
 */
export async function getCvmAttestation(appId: string): Promise<CvmAttestationResponse> {
  try {
    const apiKey = getApiKey();
    const apiClient = createClient({ apiKey: apiKey });
    const response = await apiClient.get<CvmAttestationResponse>(`cvms/app_${appId}/attestation`);
    
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
  } catch (error) {
    throw new Error(`Failed to get attestation information: ${error instanceof Error ? error.message : String(error)}`);
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
 * Resize a CVM's resources
 * @param appId App ID
 * @param vcpu Number of virtual CPUs (optional)
 * @param memory Memory size in MB (optional)
 * @param diskSize Disk size in GB (optional)
 * @param allowRestart Whether to allow restart (1) or not (0) for the resize operation (optional)
 * @returns Success status
 */
/**
 * Create a replica of an existing CVM
 * @param appId App ID of the CVM to replicate
 * @param payload Replication payload
 * @returns New CVM details
 */
/**
 * Get CVM compose configuration
 */
export async function getCvmComposeConfig(cvmId: string): Promise<CvmComposeConfig> {
  try {
    const apiKey = getApiKey();
    const apiClient = createClient({ apiKey: apiKey });
    const response = await apiClient.get<CvmComposeConfig>(
      `cvms/${cvmId}/compose`
    );
    return cvmComposeConfigSchema.parse(response);
  } catch (error) {
    throw new Error(
      `Failed to get CVM compose config: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Replicate a CVM
 */
export async function replicateCvm(
  appId: string,
  payload: {
    teepod_id?: number;
    encrypted_env?: string;
  }
): Promise<ReplicateCvmResponse> {
  try {
    const apiKey = getApiKey();
    const apiClient = createClient({ apiKey: apiKey });
    const response = await apiClient.post<ReplicateCvmResponse>(
      `cvms/${appId}/replicas`,
      payload
    );
    return replicateCvmResponseSchema.parse(response);
  } catch (error) {
    throw new Error(
      `Failed to replicate CVM: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function resizeCvm(
  appId: string, 
  vcpu?: number, 
  memory?: number, 
  diskSize?: number, 
  allowRestart?: number
): Promise<boolean> {
  try {
    const apiKey = getApiKey();
    const apiClient = createClient({ apiKey: apiKey });
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

    await apiClient.patch(`cvms/app_${appId}/resources`, resizePayload);
    return true;
  } catch (error) {
    throw new Error(`Failed to resize CVM: ${error instanceof Error ? error.message : String(error)}`);
  }
} 