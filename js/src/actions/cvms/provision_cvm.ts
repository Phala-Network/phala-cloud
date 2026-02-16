import { z } from "zod";
import { type Client } from "../../client";
import { KmsInfoSchema } from "../../types/kms_info";
import { validateComposePayloadSize } from "../../types/app_compose";
import { defineAction } from "../../utils/define-action";
import { isValidHostname } from "../../utils/hostname";

/**
 * Provision a CVM
 *
 * Performs a pre-deployment eligibility check, validating whether the requested resources
 * are available and the user has sufficient permissions to deploy. Returns provision data
 * including `app_id`, encryption public key (`app_env_encrypt_pubkey`), and `compose_hash`
 * required for the subsequent `commitCvmProvision` call.
 *
 * ## Automatic Resource Selection
 *
 * The new matching engine automatically selects optimal resources based on your requirements:
 * - **Node Selection**: Specify `node_id` or `region`, or omit both for automatic best-match selection
 * - **OS Image**: Specify exact image name or let system choose the latest stable version
 * - **KMS**: Choose KMS type via `kms` parameter (defaults to PHALA) or specify `kms_id` directly
 *
 * @example
 * ```typescript
 * import { createClient, provisionCvm, commitCvmProvision } from '@phala/cloud'
 *
 * const client = createClient();
 *
 * // Example 1: Minimal configuration with auto-selection
 * const provision = await provisionCvm(client, {
 *   name: 'my-app',              // Unique in workspace level
 *   instance_type: 'tdx.small',
 *   compose_file: {
 *     docker_compose_file: `
 * services:
 *   demo:
 *     image: leechael/phala-cloud-bun-starter:latest
 *     ports:
 *       - "80:3000"
 *     volumes:
 *       - /var/run/dstack.sock:/var/run/dstack.sock
 * `,
 *   },
 * });
 *
 * // Example 2: With region preference
 * const provision = await provisionCvm(client, {
 *   name: 'my-app',
 *   instance_type: 'tdx.medium',
 *   region: 'us-east',            // Filter by region
 *   compose_file: { /* ... *\/ },
 * });
 *
 * // Example 3: With specific node and KMS type
 * const provision = await provisionCvm(client, {
 *   name: 'my-app',
 *   node_id: 123,                 // Specific node
 *   kms: 'PHALA',                 // KMS type (PHALA, BASE, ETHERUEM)
 *   disk_size: 40,
 *   image: 'dstack-0.5.5',
 *   compose_file: { /* ... *\/ },
 * });
 *
 * // Example 4: Manual nonce specification (Advanced - PHALA KMS only)
 * import { nextAppIds } from '@phala/cloud';
 *
 * // Step 1: Predict next available app_id and nonce
 * const prediction = await nextAppIds(client, { counts: 1 });
 * const { app_id, nonce } = prediction.app_ids[0];
 *
 * console.log(`Predicted app_id: ${app_id}, nonce: ${nonce}`);
 *
 * // Step 2: Provision with the predicted nonce and app_id
 * const provision = await provisionCvm(client, {
 *   name: 'my-app-with-manual-nonce',
 *   instance_type: 'tdx.small',
 *   kms: 'PHALA',                 // Required: only works with PHALA KMS
 *   nonce: nonce,                 // Use predicted nonce
 *   app_id: app_id,               // Use predicted app_id
 *   compose_file: { /* ... *\/ },
 * });
 *
 * console.log(provision.app_id);
 * console.log(provision.compose_hash); // Required for commitCvmProvision
 * ```
 *
 * ## Required Parameters
 *
 * - **name**: CVM instance name
 * - **compose_file**: Docker Compose configuration with `docker_compose_file` field
 *
 * ## Optional Parameters
 *
 * ### Instance Type
 * - **instance_type**: Instance type identifier (default: "tdx.small")
 *   - Use `listAllInstanceTypeFamilies()` or `listFamilyInstanceTypes()` to discover available types
 *   - Examples: "tdx.small", "tdx.medium", "tdx.large"
 *   - Omit to use the default small instance type
 *
 * ### Manual Nonce Specification (Advanced - PHALA KMS only)
 * - **nonce**: User-specified nonce for deterministic app_id generation
 * - **app_id**: Expected app_id (must match the nonce)
 * - Workflow:
 *   1. Call `nextAppIds()` to predict available app_ids and nonces
 *   2. Use the predicted `nonce` and `app_id` in provision request
 *   3. System validates that the app_id matches the nonce
 * - When `nonce` is provided:
 *   - `app_id` MUST also be provided
 *   - Only works with PHALA KMS type
 *   - Use case: Predicting app_id before deployment for smart contract integration
 * - If both omitted, system automatically generates the next available nonce
 *
 * ### Node Selection (all optional - system auto-selects if omitted)
 * - **node_id**: Specific node ID to deploy on
 * - **region**: Region preference (e.g., "us-east", "eu-west")
 * - If both omitted, system automatically selects the best available node
 *
 * ### OS Image Selection
 * - **image**: OS image name (optional)
 *   - Omit to let the system automatically select the latest stable image
 *   - Specify a specific image name if needed (e.g., "dstack-0.5.5")
 *
 * ### KMS Configuration
 * - **kms**: KMS type - "PHALA" (default), "ETHEREUM", or "BASE"
 * - **kms_contract**: (Advanced) Specific KMS contract address
 *   - Omit to let the system automatically select an appropriate KMS contract
 *   - Specify only when: migrating KMS contracts, or selecting a specific contract on networks with multiple deployments
 *
 * ### Other Options
 * - **disk_size**: Disk size in GB (optional)
 *   - Each instance type has a default disk size
 *   - Specify only if you need a different size than the default
 * - **env_keys**: List of allowed environment variable keys
 * - **listed**: Whether the CVM is publicly listed (default: true)
 *
 * ## Returns
 *
 * Provision data object containing:
 * - **app_id**: Application identifier (required for commit step)
 * - **app_env_encrypt_pubkey**: Public key for encrypting environment variables
 * - **compose_hash**: Hash identifying this provision (required for commit step)
 * - **device_id**: Device identifier for attestation
 * - **fmspc**: Firmware Security Patch Configuration value
 * - **os_image_hash**: Hash of the selected OS image
 * - **instance_type**: The matched instance type identifier
 *
 * ## Safe Version
 *
 * Use `safeProvisionCvm` for error handling without exceptions:
 *
 * ```typescript
 * const result = await safeProvisionCvm(client, app_compose);
 * if (result.success) {
 *   console.log(result.data.app_id);
 *   console.log(result.data.compose_hash);
 * } else {
 *   console.error('Failed to provision CVM:', result.error.message);
 * }
 * ```
 */

// Zod schema definition (align with backend, use .optional()/.nullable() for optional fields)
export const ProvisionCvmSchema = z
  .object({
    app_id: z.string().nullable().optional(),
    app_env_encrypt_pubkey: z.string().nullable().optional(),
    compose_hash: z.string(),
    kms_info: KmsInfoSchema.nullable().optional(),
    fmspc: z.string().nullable().optional(),
    device_id: z.string().nullable().optional(),
    os_image_hash: z.string().nullable().optional(),
    instance_type: z.string().nullable().optional(),
    teepod_id: z.number().nullable().optional(), // Will be transformed to node_id
    node_id: z.number().nullable().optional(),
    kms_id: z.string().nullable().optional(),
  })
  .passthrough()
  .transform((data) => {
    // Transform teepod_id to node_id (only when using this schema)
    if ("teepod_id" in data && data.teepod_id !== undefined) {
      const { teepod_id, ...rest } = data;
      return { ...rest, node_id: teepod_id };
    }
    return data;
  });

export type ProvisionCvm = z.infer<typeof ProvisionCvmSchema>;

// Request schema (for reference, not used directly in function signature)
const NAME_VALIDATION_MESSAGE =
  "Name must be 5-63 characters, start with letter, and contain only letters/numbers/hyphens";
export const ProvisionCvmRequestSchema = z
  .object({
    node_id: z.number().optional(), // recommended - optional, system auto-selects if not specified
    teepod_id: z.number().optional(), // deprecated, for compatibility
    region: z.string().optional(), // optional - region filter for auto-selection
    name: z
      .string()
      .min(5, NAME_VALIDATION_MESSAGE)
      .max(63, NAME_VALIDATION_MESSAGE)
      .refine((val) => isValidHostname(val), NAME_VALIDATION_MESSAGE),
    instance_type: z.string().optional(), // optional, defaults to "tdx.small" when no resource params specified
    image: z.string().optional(),
    vcpu: z.number().optional(), // deprecated, use instance_type instead
    memory: z.number().optional(), // deprecated, use instance_type instead
    disk_size: z.number().optional(),
    compose_file: z
      .object({
        allowed_envs: z.array(z.string()).optional(),
        pre_launch_script: z.string().optional(),
        docker_compose_file: z.string().optional(),
        name: z.string().optional().default(""), // optional with default empty string
        kms_enabled: z.boolean().optional(),
        public_logs: z.boolean().optional(),
        public_sysinfo: z.boolean().optional(),
        gateway_enabled: z.boolean().optional(), // recommended
        tproxy_enabled: z.boolean().optional(), // deprecated, for compatibility
        storage_fs: z.enum(["ext4", "zfs"]).optional(),
      })
      .superRefine((data, ctx) => {
        validateComposePayloadSize(data.docker_compose_file, data.pre_launch_script, ctx);
      }),
    listed: z.boolean().optional(),
    kms_id: z.string().optional(),
    kms: z.enum(["PHALA", "ETHEREUM", "BASE"]).optional(), // KMS type selection (defaults to PHALA)
    kms_contract: z.string().optional(), // KMS contract address for on-chain KMS
    env_keys: z.array(z.string()).optional(),
    // Manual nonce specification (Advanced - PHALA KMS only)
    nonce: z.number().optional(), // User-specified nonce for deterministic app_id generation
    app_id: z.string().optional(), // Expected app_id (must match calculated app_id from nonce)
  })
  .passthrough()
  .transform((data) => {
    // Smart default: only set instance_type to "tdx.small" when no resource params are specified
    // This allows vcpu/memory (deprecated) to work correctly with backend matching
    if (!data.instance_type && !data.vcpu && !data.memory) {
      return { ...data, instance_type: "tdx.small" };
    }
    return data;
  });

export type ProvisionCvmRequest = z.input<typeof ProvisionCvmRequestSchema> & {
  node_id?: number; // recommended
  teepod_id?: number; // deprecated
  compose_file?: {
    gateway_enabled?: boolean; // recommended
    tproxy_enabled?: boolean; // deprecated
    [key: string]: unknown;
  };
  nonce?: number; // Manual nonce specification (Advanced - PHALA KMS only)
  app_id?: string; // Expected app_id (must match calculated app_id from nonce)
};

// Helper functions
function handleGatewayCompatibility(appCompose: ProvisionCvmRequest): ProvisionCvmRequest {
  if (!appCompose.compose_file) {
    return appCompose;
  }

  const composeFile = { ...appCompose.compose_file };

  // If both are provided, prefer gateway_enabled
  if (
    typeof composeFile.gateway_enabled === "boolean" &&
    typeof composeFile.tproxy_enabled === "boolean"
  ) {
    delete composeFile.tproxy_enabled;
  }
  // If only tproxy_enabled is provided, convert to gateway_enabled and warn
  else if (
    typeof composeFile.tproxy_enabled === "boolean" &&
    typeof composeFile.gateway_enabled === "undefined"
  ) {
    composeFile.gateway_enabled = composeFile.tproxy_enabled;
    delete composeFile.tproxy_enabled;
    if (typeof window !== "undefined" ? window.console : globalThis.console) {
      console.warn(
        "[phala/cloud] tproxy_enabled is deprecated, please use gateway_enabled instead. See docs for migration.",
      );
    }
  }

  return {
    ...appCompose,
    compose_file: composeFile,
  };
}

// The teepod_id -> node_id transformation is now handled by the schema's .transform()
// This way, when users specify { schema: false }, they get the raw response
const { action: provisionCvm, safeAction: safeProvisionCvm } = defineAction<
  ProvisionCvmRequest,
  typeof ProvisionCvmSchema
>(ProvisionCvmSchema, async (client, appCompose) => {
  const validated = ProvisionCvmRequestSchema.parse(appCompose);
  const body = handleGatewayCompatibility(validated);

  let requestBody = { ...body };
  if (typeof body.node_id === "number") {
    requestBody = { ...body, teepod_id: body.node_id };
    delete requestBody.node_id;
  } else if (typeof body.teepod_id === "number") {
    console.warn("[phala/cloud] teepod_id is deprecated, please use node_id instead.");
  }

  return await client.post("/cvms/provision", requestBody);
});

export { provisionCvm, safeProvisionCvm };
