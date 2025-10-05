import { Command } from 'commander';
import { removeApiKey, saveApiKey } from '@/src/utils/credentials';
import { logger } from '@/src/utils/logger';
import prompts from 'prompts';
import { safeGetCurrentUser } from '@phala/cloud';
import { getClientWithKey } from '@/src/lib/client';
import { CLOUD_URL } from '@/src/utils/constants';

export const loginCommand = new Command()
  .name('login')
  .description('Set the API key for authentication')
  .argument('[api-key]', 'Phala Cloud API key to set')
  .action(async (apiKey?: string): Promise<void> => {
    try {
      let checkUserInfo;
      // If no API key is provided, prompt for it
      if (!apiKey) {
        const response = await prompts({
          type: 'password',
          name: 'apiKey',
          message: 'Enter your API key:',
          validate: async (value) => {
            if (value.length === 0) {
              return 'API key cannot be empty';
            }
            try {
              await saveApiKey(value);
              const client = await getClientWithKey(value);
              const result = await safeGetCurrentUser(client);
              if (!result.success || !result.data.username) {
                await removeApiKey();
                throw new Error('Invalid API key');
              }
              checkUserInfo = result.data;
            } catch (error) {
              throw new Error('Invalid API key');
            }
            return true;
          }
        });
        
        apiKey = response.apiKey;
      } else {
        await saveApiKey(apiKey);
        // Validate the API key
        const client = await getClientWithKey(apiKey);
        const result = await safeGetCurrentUser(client);
        if (!result.success || !result.data.username) {
          await removeApiKey();
          throw new Error('Invalid API key');
        }
        checkUserInfo = result.data;
      }
      
      logger.success(`Welcome ${checkUserInfo.username}! API key validated and saved successfully`);
      logger.break();
      logger.info(`Open in Web UI at ${CLOUD_URL}/dashboard/`);
    } catch (error) {
      logger.error(`Failed to set API key: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 