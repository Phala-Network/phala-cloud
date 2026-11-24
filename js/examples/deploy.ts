import type { EnvVar, KmsInfo, ProvisionCvmRequest } from "@phala/cloud";
import {
  addComposeHash,
  type Client,
  createClient,
  deployAppAuth,
  encryptEnvVars,
  formatValidationErrors,
  parseEnvVars,
  ValidationError,
  waitForAppEnvEncryptPubKey,
} from "@phala/cloud";
import arg from "arg";
import fs from "fs";
import type { Chain } from "viem";

// ==================================================================
//
// Helper functions
//
// ==================================================================

function assert_not_null<T>(condition: T | null | undefined, message: string): NonNullable<T> {
  if (condition === null || condition === undefined) {
    throw new Error(message);
  }
  return condition!;
}

/**
 * Remove undefined fields from object recursively (for cleaner API requests)
 */
function removeUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) {
      // Recursively clean nested objects
      if (typeof value === "object" && !Array.isArray(value)) {
        result[key] = removeUndefined(value);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

// ==================================================================
//
// Main function
//
// ==================================================================

const typed: Parameters<typeof arg>[0] = {
  "--name": String,
  "--instance-type": String,
  "--disk-size": Number,
  "--region": String,
  "--os-image": String,
  "--kms": String,
  "--private-key": String,
  "--rpc-url": String,
  "--env": String,
  "--uuid": String, // for update
};

async function main(args: arg.Result<typeof typed>) {
  //
  // Input validation.
  //
  if (!args["_"] || args["_"].length === 0 || !args["_"][0]) {
    console.log("Usage: node deploy.ts <path_to_docker_compose_yml>");
    process.exit(1);
  }
  const docker_compose_path = args["_"][0];
  if (!fs.existsSync(docker_compose_path)) {
    console.log("File not found:", docker_compose_path);
    process.exit(1);
  }
  const docker_compose_yml = fs.readFileSync(docker_compose_path, "utf8");

  let env_vars: EnvVar[] = [];
  if (args["--env"]) {
    if (!fs.existsSync(args["--env"])) {
      console.log("File not found:", args["--env"]);
      process.exit(1);
    }
    const env_file = fs.readFileSync(args["--env"], "utf8");
    env_vars = parseEnvVars(env_file);
  }

  // If uuid specified, we considering it already exists and processing update on it.
  const uuid = args["--uuid"];
  const is_update = uuid !== undefined;

  const client = createClient();

  if (is_update) {
    await update_cvm(client, uuid, docker_compose_yml, env_vars, args);
  } else {
    await deploy_new_cvm(client, docker_compose_yml, env_vars, args);
  }
}

async function update_cvm(
  client: Client,
  uuid: string,
  docker_compose_yml: string,
  env_vars: EnvVar[],
  args: arg.Result<typeof typed>,
) {
  const rpc_url = args["--rpc-url"];
  const private_key = args["--private-key"];

  const [cvm, app_compose] = await Promise.all([
    client.getCvmInfo({ id: uuid }),
    client.getCvmComposeFile({ id: uuid }),
  ]);

  // patched the compose_file
  app_compose.docker_compose_file = docker_compose_yml;
  app_compose.allowed_envs = env_vars.map((env) => env.key);

  const provision = await client.provisionCvmComposeFileUpdate({
    uuid: uuid,
    app_compose: app_compose,
  });

  let encrypted_env: string | undefined;
  if (cvm.kms_info && cvm.kms_info.chain_id) {
    // Update with decentralized KMS.
    console.log("Interacting with contract DstackApp");
    if (!private_key) {
      throw new Error("Private key is required for contract DstackApp");
    }

    const receipt = await addComposeHash({
      chain: cvm.kms_info.chain,
      rpcUrl: rpc_url,
      appId: cvm.app_id as `0x${string}`,
      composeHash: provision.compose_hash,
      privateKey: private_key,
    });
    console.log("the receipt: ", receipt);
  } else {
    if (env_vars.length > 0) {
      const encrypted_env_vars = await encryptEnvVars(env_vars, cvm.encrypted_env_pubkey!);
      encrypted_env = encrypted_env_vars;
    }
  }

  await client.commitCvmComposeFileUpdate({
    id: uuid,
    compose_hash: provision.compose_hash,
    encrypted_env: encrypted_env,
    env_keys: env_vars.map((env) => env.key),
  });
}

async function deploy_new_cvm(
  client: Client,
  docker_compose_yml: string,
  env_vars: EnvVar[],
  args: arg.Result<typeof typed>,
) {
  //
  // Step 1: Parse and validate parameters
  //
  const name = args["--name"] || "app";
  const instance_type = args["--instance-type"] || "tdx.small"; // defaults to tdx.small
  const disk_size = args["--disk-size"];
  const region = args["--region"];
  const os_image = args["--os-image"];
  const kms_type = args["--kms"] as "PHALA" | "ETHEREUM" | "BASE" | undefined;
  const private_key = args["--private-key"];
  const rpc_url = args["--rpc-url"];

  // Check if using on-chain KMS
  const is_onchain_kms = kms_type === "ETHEREUM" || kms_type === "BASE";
  if (is_onchain_kms) {
    if (!private_key) {
      throw new Error("--private-key is required for on-chain KMS deployment");
    }
    if (!rpc_url) {
      throw new Error("--rpc-url is required for on-chain KMS deployment");
    }
  }

  //
  // Step 2: Provision CVM (automatic resource selection)
  //
  console.log(`Provisioning CVM with instance type: ${instance_type}`);
  const provision_payload = removeUndefined({
    name,
    instance_type,
    compose_file: {
      docker_compose_file: docker_compose_yml,
      allowed_envs: env_vars.map((e) => e.key),
    },
    disk_size,
    region,
    image: os_image,
    kms: kms_type,
  }) as ProvisionCvmRequest;

  const provision = await client.provisionCvm(provision_payload);
  console.log(`Provisioned: compose_hash=${provision.compose_hash}`);

  //
  // Step 3: Deploy based on KMS type
  //
  let result;

  if (provision.app_id && provision.app_env_encrypt_pubkey) {
    //
    // Centralized KMS (PHALA) - app_id provided by provision
    //
    console.log("Using centralized KMS (PHALA)");
    const encrypted_env_vars =
      env_vars.length > 0
        ? await encryptEnvVars(env_vars, provision.app_env_encrypt_pubkey)
        : undefined;

    result = await client.commitCvmProvision({
      app_id: provision.app_id,
      compose_hash: provision.compose_hash,
      encrypted_env: encrypted_env_vars,
      env_keys: env_vars.map((e) => e.key),
    });
  } else {
    //
    // On-chain KMS (ETHEREUM/BASE) - need to deploy contract to get app_id
    //
    console.log(`Using on-chain KMS (${kms_type})`);

    // Get KMS info from provision response
    const kms_id = assert_not_null(provision.kms_id, "KMS ID not returned from provision");
    const device_id = assert_not_null(provision.device_id, "Device ID not returned from provision");

    // Fetch KMS details
    const kms_list = await client.getKmsList();
    const kms = kms_list.items.find((k) => k.id === kms_id || k.slug === kms_id) as KmsInfo;
    assert_not_null(kms, `KMS ${kms_id} not found`);
    assert_not_null(kms.kms_contract_address, "KMS contract address not found");
    assert_not_null(kms.chain, "KMS chain info not found");

    // Deploy contract to get app_id
    console.log("Deploying AppAuth contract...");
    const deployed_contract = await deployAppAuth({
      chain: kms.chain,
      rpcUrl: rpc_url!,
      kmsContractAddress: kms.kms_contract_address,
      privateKey: private_key!,
      deviceId: device_id,
      composeHash: provision.compose_hash,
    });

    const app_id = assert_not_null(
      deployed_contract.appId,
      "App ID not returned from contract deployment",
    );
    console.log(`Contract deployed: app_id=${app_id}`);

    let encrypted_env_vars: string | undefined;
    if (env_vars.length > 0) {
      const kms_slug = assert_not_null(kms.slug, "KMS slug not found");
      const { public_key } = await waitForAppEnvEncryptPubKey(
        client,
        { app_id, kms: kms_slug },
        { retryLegacyTransientErrors: true },
      );
      encrypted_env_vars = await encryptEnvVars(env_vars, public_key);
    }

    // Commit CVM with contract info
    result = await client.commitCvmProvision({
      app_id: app_id,
      compose_hash: provision.compose_hash,
      encrypted_env: encrypted_env_vars,
      env_keys: env_vars.map((e) => e.key),
      kms_id: kms_slug,
      contract_address: deployed_contract.appAuthAddress,
      deployer_address: deployed_contract.deployer,
    });
  }

  console.log("Deployed!");
  console.log(result);
}

main(arg(typed))
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    // Handle validation errors with detailed field information
    if (error instanceof ValidationError) {
      console.error("\n❌ Validation Error:");
      console.error(`   ${error.message}\n`);
      console.error("   Details:");
      console.error(formatValidationErrors(error.validationErrors));
      console.error("");
    } else {
      // For other errors, show full trace
      console.error("\n❌ Error:");
      console.trace(error);
    }
    process.exit(1);
  });
