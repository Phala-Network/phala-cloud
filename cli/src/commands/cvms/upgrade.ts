import { Command } from 'commander';
import { FetchError } from 'ofetch';
import { upgradeCvm, getCvmByAppId } from '@/src/api/cvms';
import { logger } from '@/src/utils/logger';
import fs from 'node:fs';
import { detectFileInCurrentDir, promptForFile } from '@/src/utils/prompts';
import { parseEnv } from '@/src/utils/secrets';
import { encryptEnvVars, type EnvVar } from '@phala/cloud';
import { deleteSimulatorEndpointEnv } from '@/src/utils/simulator';
import { resolveCvmAppId } from '@/src/utils/cvms';
import { CLOUD_URL } from '@/src/utils/constants';

export const upgradeCommand = new Command()
  .name('upgrade')
  .description('[DEPRECATED] Upgrade a CVM to a new version (use "phala deploy" instead)')
  .argument('[app-id]', 'CVM app ID to upgrade (will prompt for selection if not provided)')
  .option('-c, --compose <compose>', 'Path to new Docker Compose file')
  .option('-e, --env-file <envFile>', 'Path to environment file')
  .option('--debug', 'Enable debug mode', false)
  .action(async (appId, options) => {
    try {
      logger.warn('⚠️  This command is deprecated. Please use "phala deploy" instead.');
      logger.warn('⚠️  This legacy API will be maintained but may have limited support.\n');

      const resolvedAppId = await resolveCvmAppId(appId);

      // Get current CVM configuration
      const spinner = logger.startSpinner(`Fetching current configuration for CVM app_${resolvedAppId}`);
      const currentCvm = await getCvmByAppId(resolvedAppId);
      spinner.stop(true);
      
      if (!currentCvm) {
        logger.error(`CVM with App ID app_${resolvedAppId} not found`);
        process.exit(1);
      }
      
      // If compose path not provided, prompt with examples
      if (!options.compose) {
        const possibleFiles = ['docker-compose.yml', 'docker-compose.yaml'];
        const composeFileName = detectFileInCurrentDir(possibleFiles, 'Detected docker compose file: {path}');
        
        options.compose = await promptForFile(
          'Enter the path to your Docker Compose file:',
          composeFileName,
          'file'
        );
      }
      
      // Update Docker Compose file if provided
      let composeString = '';
      let env_keys = [];
      if (options.compose) {
        try {
          composeString = fs.readFileSync(options.compose, 'utf8');
        } catch (error) {
          logger.error(`Failed to read Docker Compose file: ${error instanceof Error ? error.message : String(error)}`);
          process.exit(1);
        }
      }
      
      // Delete DSTACK_SIMULATOR_ENDPOINT environment variable
      await deleteSimulatorEndpointEnv();
      // Print if they are using a private registry
      if (process.env.DSTACK_DOCKER_USERNAME && process.env.DSTACK_DOCKER_PASSWORD) {
        logger.info("🔐 Using private DockerHub registry credentials...");
      } else if (process.env.DSTACK_AWS_ACCESS_KEY_ID && process.env.DSTACK_AWS_SECRET_ACCESS_KEY && process.env.DSTACK_AWS_REGION && process.env.DSTACK_AWS_ECR_REGISTRY) {
        logger.info(`🔐 Using private AWS ECR registry: ${process.env.DSTACK_AWS_ECR_REGISTRY}`);
      } else {
        logger.info("🔐 Using public DockerHub registry...");
      }

      // Process environment variables if provided
      let encrypted_env: string | undefined = undefined;
      if (options.envFile) {
        let envs: EnvVar[] = [];
        
        // Process environment variables from file
        if (options.envFile) {
          try {
            envs = parseEnv([], options.envFile);
            encrypted_env = await encryptEnvVars(envs, currentCvm.encrypted_env_pubkey);
            env_keys = envs.map(i => i.key)
          } catch (error) {
            logger.error(`Failed to read environment file: ${error instanceof Error ? error.message : String(error)}`);
            process.exit(1);
          }
        }
        
      }

      const vm_config = {
        compose_manifest: {
          docker_compose_file: composeString,
          manifest_version: 1,
          runner: "docker-compose",
          version: "1.0.0",
          features: ["kms", "tproxy-net"],
          name: `app_${resolvedAppId}`,
          allowed_envs: env_keys,
        },
        encrypted_env,
        allow_restart: true,
        env_keys: env_keys,
      };
      
      // Upgrade the CVM
      const upgradeSpinner = logger.startSpinner(`Upgrading CVM app_${resolvedAppId}`);
      const response = await upgradeCvm(resolvedAppId, vm_config);
      
      if (!response) {
        upgradeSpinner.stop(false);
        logger.error('Failed to upgrade CVM');
        process.exit(1);
      }
      upgradeSpinner.stop(true);

      if (response.detail) {
        logger.info(`Details: ${response.detail}`);
      }

      logger.break();
      logger.success(
        `Your CVM is being upgraded. You can check the dashboard for more details:\n${CLOUD_URL}/dashboard/cvms/app_${resolvedAppId}`
      );
    } catch (error) {
      logger.error(`Failed to upgrade CVM: ${error instanceof Error ? error.message : String(error)}`);

      // Multiple ways to check if it's a FetchError:
      // 1. instanceof check (standard but may fail due to module loading)
      // 2. Check constructor.name (works across module boundaries)
      // 3. Check for FetchError-specific properties (status, statusText, data, request)
      const isFetchError = error instanceof FetchError ||
        (error as any)?.constructor?.name === 'FetchError' ||
        (error && typeof error === 'object' && 'status' in error && 'statusText' in error && 'data' in error);

      if (isFetchError) {
        const fetchError = error as FetchError;
        logger.error('=== HTTP Error Details ===');
        logger.error('Status:', fetchError.status);
        logger.error('Status Text:', fetchError.statusText);
        logger.error('URL:', fetchError.request);
        logger.error('Response Body:', JSON.stringify(fetchError.data, null, 2));
        if (options.debug) {
          logger.error('Full Error Object:', error);
        }
      } else if (options.debug) {
        logger.error('Full Error:', error);
      }
      process.exit(1);
    }
  }); 