import { Command } from 'commander';
import { FetchError } from 'ofetch'
import { encryptEnvVars, type EnvVar } from '@phala/cloud';
import { getClient } from '@/src/lib/client';
import { logger } from '@/src/utils/logger';
import { getTeepods, getPubkeyFromCvm, createCvm } from '@/src/api/cvms';
import type { TEEPod, Image } from '@/src/api/types';
import { DEFAULT_VCPU, DEFAULT_MEMORY, DEFAULT_DISK_SIZE, CLOUD_URL, DEFAULT_IMAGE } from '@/src/utils/constants';

import fs from 'node:fs';
import path from 'node:path';
import inquirer from 'inquirer';
import { parseEnv } from '@/src/utils/secrets';
import { detectFileInCurrentDir, promptForFile } from '@/src/utils/prompts';
import { deleteSimulatorEndpointEnv } from '@/src/utils/simulator';

export const createCommand = new Command()
  .name('create')
  .description('[DEPRECATED] Create a new CVM (use "phala deploy" instead)')
  .option('-n, --name <name>', 'Name of the CVM')
  .option('-c, --compose <compose>', 'Path to Docker Compose file')
  .option('--vcpu <vcpu>', `Number of vCPUs, default is ${DEFAULT_VCPU}`)
  .option('--memory <memory>', `Memory in MB, default is ${DEFAULT_MEMORY}`)
  .option('--disk-size <diskSize>', `Disk size in GB, default is ${DEFAULT_DISK_SIZE}`)
  .option('--teepod-id <teepodId>', 'TEEPod ID to use. If not provided, it will be selected from the list of available TEEPods.')
  .option('--image <image>', 'Version of dstack image to use. If not provided, it will be selected from the list of available images for the selected TEEPod.')
  .option('-e, --env-file <envFile>', 'Path to environment file')
  .option('--skip-env', 'Skip environment variable prompt', false)
  .option('--debug', 'Enable debug mode', false)
  .action(async (options) => {
    try {
      logger.warn('⚠️  This command is deprecated. Please use "phala deploy" instead.');
      logger.warn('⚠️  This legacy API will be maintained but may have limited support.\n');

      // Prompt for required options if not provided
      if (!options.name) {
        const { name } = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Enter a name for the CVM:',
            validate: (input) => {
              if (!input.trim()) {
                return 'CVM name is required';
              }
              if (input.trim().length > 20) {
                return 'CVM name must be less than 20 characters';
              } 
              if (input.trim().length < 3) {
                return 'CVM name must be at least 3 characters';
              } 
              if (!/^[a-zA-Z0-9_-]+$/.test(input)) {
                return 'CVM name must contain only letters, numbers, underscores, and hyphens';
              }
              return true;
            }
          }
        ]);
        options.name = name;
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

      const composePath = path.resolve(options.compose);
      if (!fs.existsSync(composePath)) {
        logger.error(`Docker Compose file not found: ${composePath}`);
        process.exit(1);
      }
      const composeString = fs.readFileSync(composePath, 'utf8');

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

      // Process environment variables
      let envs: EnvVar[] = [];

      // Process environment variables from file
      if (options.envFile) {
        try {
          envs = parseEnv([], options.envFile);
        } catch (error) {
          logger.error(`Failed to read environment file: ${error instanceof Error ? error.message : String(error)}`);
          process.exit(1);
        }
      } else if (!options.skipEnv) {
        // Prompt to input env file or skip
        const { shouldSkip } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'shouldSkip',
            message: 'Do you want to skip environment variable prompt?',
            default: true
          }
        ]);
      
        if (shouldSkip) {
          logger.info('Skipping environment variable prompt');
        } else {
          const envVars = await promptForFile(
            'Enter the path to your environment file:',
            '.env',
            'file',
          );
          envs = parseEnv([], envVars);
        }
      }

      const vcpu = Number(options.vcpu) || DEFAULT_VCPU;
      const memory = Number(options.memory) || DEFAULT_MEMORY;
      const diskSize = Number(options.diskSize) || DEFAULT_DISK_SIZE;

      if (Number.isNaN(vcpu) || vcpu <= 0) {
        logger.error(`Invalid number of vCPUs: ${vcpu}`);
        process.exit(1);
      }

      if (Number.isNaN(memory) || memory <= 0) {
        logger.error(`Invalid memory: ${memory}`);
        process.exit(1);
      }

      if (Number.isNaN(diskSize) || diskSize <= 0) {
        logger.error(`Invalid disk size: ${diskSize}`);
        process.exit(1);
      }

      const teepodsSpinner = logger.startSpinner('Fetching available TEEPods');
      const teepods = await getTeepods(true);
      teepodsSpinner.stop(true);
      if (teepods.nodes.length === 0) {
        logger.error('No TEEPods available. Please try again later.');
        process.exit(1);
      }

      let selectedTeepod: TEEPod;
      // Fetch available TEEPods
      if (!options.teepodId) {
        selectedTeepod = teepods.nodes[0];
        if (!selectedTeepod) {
          logger.error('Failed to find default TEEPod');
          process.exit(1);
        }
      } else {
        selectedTeepod = teepods.nodes.find(pod => pod.teepod_id === Number(options.teepodId));
        if (!selectedTeepod) {
          logger.error('Failed to find selected TEEPod');
          process.exit(1);
        }
      }

      let selectedImage: Image;
      if (!options.image) {
        selectedImage = selectedTeepod.images?.find(image => image.name === DEFAULT_IMAGE);
        if (!selectedImage) {
          logger.error(`Failed to find default image ${DEFAULT_IMAGE}`);
          process.exit(1);
        }
      } else {
        selectedImage = selectedTeepod.images?.find(image => image.name === options.image);
        if (!selectedImage) {
          logger.error(`Failed to find selected image: ${options.image}`);
          process.exit(1);
        }
      }

      // Prepare VM configuration
      const vmConfig = {
        teepod_id: selectedTeepod.teepod_id,
        name: options.name,
        image: selectedImage.name,
        vcpu: vcpu,
        memory: memory,
        disk_size: diskSize,
        compose_manifest: {
          docker_compose_file: composeString,
          docker_config: {
            url: '',
            username: '',
            password: '',
          },
          features: ['kms', 'tproxy-net'],
          kms_enabled: true,
          manifest_version: 2,
          name: options.name,
          public_logs: true,
          public_sysinfo: true,
          tproxy_enabled: true,
        },
        listed: false,
      };

      // Get public key from CVM
      const spinner = logger.startSpinner('Getting public key from CVM');
      const pubkey = await getPubkeyFromCvm(vmConfig);
      spinner.stop(true);

      if (!pubkey) {
        logger.error('Failed to get public key from CVM');
        process.exit(1);
      }

      // Encrypt environment variables
      const encryptSpinner = logger.startSpinner('Encrypting environment variables');
      const encrypted_env = await encryptEnvVars(envs, pubkey.app_env_encrypt_pubkey);
      encryptSpinner.stop(true);

      if (options.debug) {
        logger.debug('Public key:', pubkey.app_env_encrypt_pubkey);
        logger.debug('Encrypted environment variables:', encrypted_env);
        logger.debug('Environment variables:', JSON.stringify(envs));
      }

      // Create the CVM
      const createSpinner = logger.startSpinner('Creating CVM');
      const response = await createCvm({
        ...vmConfig,
        encrypted_env,
        app_env_encrypt_pubkey: pubkey.app_env_encrypt_pubkey,
        app_id_salt: pubkey.app_id_salt,
      });
      createSpinner.stop(true);

      if (!response) {
        logger.error('Failed to create CVM');
        process.exit(1);
      }

      logger.success('CVM created successfully');
      logger.break();
      const tableData = {
        'CVM ID': response.id,
        'Name': response.name,
        'Status': response.status,
        'App ID': `app_${response.app_id}`,
        'App URL': response.app_url ? response.app_url : `${CLOUD_URL}/dashboard/cvms/app_${response.app_id}`,
      };
      logger.keyValueTable(tableData, {
        borderStyle: 'rounded'
      });

      logger.info('');
      logger.success(`Your CVM is being created. You can check its status with:\nphala cvms get app_${response.app_id}`);
    } catch (error) {
      console.log('')
      if (error instanceof FetchError) {
        console.error('Status:', error.status);
        console.error('Status Text:', error.statusText);
        console.error(error.data)
      } else {
        console.error(error)
      }
      process.exit(1);
    }
  }); 