import { createClient, type Client } from '@phala/cloud';
import { getApiKey } from '@/src/utils/credentials';

/**
 * Get a configured API client with automatic API key resolution
 * @returns Promise resolving to configured Client instance
 */
export async function getClient(): Promise<Client> {
  const apiKey = getApiKey();
  return createClient({ apiKey });
}

/**
 * Get a configured API client with custom API key
 * @param apiKey - Custom API key to use
 * @returns Promise resolving to configured Client instance
 */
export async function getClientWithKey(apiKey: string): Promise<Client> {
  return createClient({ apiKey });
}
