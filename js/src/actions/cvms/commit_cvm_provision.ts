import { z } from "zod";
import { type Client } from "../../client";
import { defineAction } from "../../utils/define-action";

/**
 * Commit CVM Provision (Create CVM from provisioned data)
 *
 * This action creates a CVM using previously provisioned data and encrypted environment variables.
 * It MUST be called after `provisionCvm` to complete the CVM deployment process.
 *
 * ## Two-Step Deployment Flow
 *
 * 1. **Provision** (`provisionCvm`): Prepares resources and returns `compose_hash` (and `app_id` for PHALA KMS)
 * 2. **Commit** (this function): Creates the actual CVM using provisioned data
 *
 * ## KMS Type and app_id Source
 *
 * The `app_id` source depends on the KMS type used during provisioning:
 *
 * - **PHALA KMS** (default): `app_id` is obtained from centralized KMS - returned by `provisionCvm()`
 * - **ETHEREUM/BASE KMS** (on-chain): `app_id` must be obtained by deploying your contract and interacting with the on-chain KMS - NOT provided by `provisionCvm()`
 *
 * @example
 * ```typescript
 * import { createClient, provisionCvm, commitCvmProvision } from '@phala/cloud'
 *
 * const client = createClient();
 *
 * // Example 1: PHALA KMS (default - app_id from provision)
 * const provision = await provisionCvm(client, {
 *   name: "my-cvm",
 *   instance_type: "tdx.small",
 *   kms: "PHALA",  // or omit for default
 *   compose_file: { docker_compose_file: "..." },
 * });
 *
 * // app_id is provided by provision API
 * const cvm = await commitCvmProvision(client, {
 *   app_id: provision.app_id,           // From provision response
 *   compose_hash: provision.compose_hash,
 *   encrypted_env: "...",
 * });
 *
 * // Example 2: On-chain KMS (app_id from contract deployment)
 * const provision = await provisionCvm(client, {
 *   name: "my-cvm",
 *   instance_type: "tdx.small",
 *   kms: "ETHEREUM",  // or "BASE" for Base network
 *   compose_file: { docker_compose_file: "..." },
 * });
 *
 * // Step 1: Deploy your contract and get app_id from on-chain KMS
 * const contractTx = await deployContract({
 *   kmsContract: "0x...",
 *   // ... contract deployment params
 * });
 * const appId = await getAppIdFromKms(contractTx);
 *
 * // Step 2: Commit with app_id from on-chain interaction
 * const cvm = await commitCvmProvision(client, {
 *   app_id: appId,                        // From on-chain KMS, NOT from provision
 *   compose_hash: provision.compose_hash, // From provision response
 *   contract_address: "0x123...",         // Your deployed contract
 *   deployer_address: "0x456...",         // Deployer address
 * });
 * ```
 *
 * ## Returns
 *
 * `CommitCvmProvision | unknown`
 *
 * The created CVM details including id, name, status, and other metadata. Return type depends on schema parameter.
 *
 * ## Required Parameters
 *
 * - **app_id**: Application identifier
 *   - For PHALA KMS: Use `provision.app_id` from `provisionCvm()` response
 *   - For ETHEREUM/BASE KMS (on-chain): Obtain from your on-chain KMS contract deployment
 * - **compose_hash**: Must be obtained from `provisionCvm()` response (used to retrieve provision data from Redis)
 *
 * ## Optional Parameters
 *
 * - **encrypted_env**: Hex-encoded encrypted environment variables
 * - **env_keys**: List of environment variable keys to allow
 * - **kms_id**: KMS instance identifier (if using specific KMS)
 * - **contract_address**: On-chain KMS contract address (required for ETHEREUM/BASE KMS)
 * - **deployer_address**: Deployer address for on-chain verification (required for ETHEREUM/BASE KMS)
 *
 * ## Idempotency
 *
 * This endpoint is idempotent: submitting the same `app_id` + `compose_hash`
 * again returns the existing CVM (safe retry after network timeout). A different
 * `compose_hash` for the same `app_id` throws a `ResourceError` with error code
 * `ERR-03-007` (`CVM_APP_ID_CONFLICT`, HTTP 409).
 *
 * ```typescript
 * import { isAppIdConflictError } from '@phala/cloud'
 *
 * try {
 *   const cvm = await commitCvmProvision(client, payload)
 * } catch (error) {
 *   if (isAppIdConflictError(error)) {
 *     // app_id already used with a different compose_hash
 *   }
 * }
 * ```
 *
 * ## Schema Parameter
 *
 * - **Type:** `ZodSchema | false`
 * - **Default:** `CommitCvmProvisionSchema`
 *
 * Schema to validate the response. Use `false` to return raw data without validation.
 *
 * ```typescript
 * // Use default schema
 * const result = await commitCvmProvision(client, payload)
 *
 * // Return raw data without validation
 * const raw = await commitCvmProvision(client, payload, { schema: false })
 *
 * // Use custom schema
 * const customSchema = z.object({ id: z.number(), name: z.string() })
 * const custom = await commitCvmProvision(client, payload, { schema: customSchema })
 * ```
 *
 * ## Safe Version
 *
 * Use `safeCommitCvmProvision` for error handling without exceptions:
 *
 * ```typescript
 * import { safeCommitCvmProvision } from '@phala/cloud'
 *
 * const result = await safeCommitCvmProvision(client, payload)
 * if (result.success) {
 *   console.log(result.data)
 * } else {
 *   if ("isRequestError" in result.error) {
 *     console.error(`HTTP ${result.error.status}: ${result.error.message}`)
 *   } else {
 *     console.error(`Validation error: ${result.error.issues}`)
 *   }
 * }
 * ```
 */

// Zod schema definition (align with backend VMSchema)
const CommitCvmProvisionBaseSchema = z
  .object({
    name: z.string(),
    status: z.string(),
    teepod_id: z.number(),
    teepod: z
      .object({
        id: z.number(),
        name: z.string(),
      })
      .nullable(),
    app_id: z.string().nullable(),
    vm_uuid: z.string().nullable(),
    instance_id: z.string().nullable(),
    // Deprecated fields - will be removed in next API version
    app_url: z.string().nullable().default(null),
    base_image: z.string().nullable(),
    vcpu: z.number(),
    memory: z.number(),
    disk_size: z.number(),
    manifest_version: z.number().nullable().default(2),
    version: z.string().nullable().default("1.0.0"),
    runner: z.string().nullable().default("docker-compose"),
    docker_compose_file: z.string().nullable(),
    features: z.array(z.string()).nullable().default(["kms", "tproxy-net"]),
    created_at: z.string(),
    encrypted_env_pubkey: z.string().nullable().optional(),
    app_auth_contract_address: z.string().nullable().optional(),
    deployer_address: z.string().nullable().optional(),
  })
  .passthrough();

export const CommitCvmProvisionV20260121Schema = CommitCvmProvisionBaseSchema.extend({
  id: z.number(),
  user_id: z.number().nullable(),
});
export type CommitCvmProvisionV20260121 = z.infer<typeof CommitCvmProvisionV20260121Schema>;

export const CommitCvmProvisionV20260522Schema = CommitCvmProvisionBaseSchema.extend({
  id: z.string(),
  user_id: z.string().nullable(),
});
export type CommitCvmProvisionV20260522 = z.infer<typeof CommitCvmProvisionV20260522Schema>;

export const CommitCvmProvisionAnySchema = z.union([
  CommitCvmProvisionV20260121Schema,
  CommitCvmProvisionV20260522Schema,
]);
export const CommitCvmProvisionSchema = CommitCvmProvisionV20260522Schema;
export type CommitCvmProvision = z.infer<typeof CommitCvmProvisionSchema>;

// Request schema
export const CommitCvmProvisionRequestSchema = z
  .object({
    encrypted_env: z.string().optional().nullable(),
    app_id: z.string(),
    compose_hash: z.string(),
    kms_id: z.string().optional(),
    contract_address: z.string().optional(),
    deployer_address: z.string().optional(),
    env_keys: z.array(z.string()).optional().nullable(),
  })
  .passthrough();

export type CommitCvmProvisionRequest = z.infer<typeof CommitCvmProvisionRequestSchema>;

const { action: commitCvmProvision, safeAction: safeCommitCvmProvision } = defineAction<
  CommitCvmProvisionRequest,
  typeof CommitCvmProvisionSchema
>(CommitCvmProvisionSchema, async (client, payload) => {
  return await client.post("/cvms", payload);
});

export { commitCvmProvision, safeCommitCvmProvision };
