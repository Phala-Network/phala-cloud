import { z } from "zod";
import { type Client, type SafeResult } from "../client";
import { ActionParameters, ActionReturnType } from "../types/common";
import { validateActionParameters, safeValidateActionParameters } from "../utils";

/**
 * Get current user information and validate API token
 *
 * Returns information about the current authenticated user.
 *
 * @example
 * ```typescript
 * import { createClient, getCurrentUser } from '@phala/cloud'
 *
 * const client = createClient({ apiKey: 'your-api-key' })
 * const user = await getCurrentUser(client)
 * // Output: { username: 'alice', email: 'alice@example.com', credits: 1000, ... }
 * ```
 *
 * ## Returns
 *
 * `CurrentUser | unknown`
 *
 * Information about the current user. Return type depends on schema parameter.
 *
 * ## Parameters
 *
 * ### parameters (optional)
 * - **Type:** `GetCurrentUserParameters`
 *
 * Optional behavior parameters for schema validation.
 *
 * ```typescript
 * // Use default schema
 * const user = await getCurrentUser(client)
 *
 * // Return raw data without validation
 * const raw = await getCurrentUser(client, { schema: false })
 *
 * // Use custom schema
 * const customSchema = z.object({ id: z.number(), name: z.string() })
 * const custom = await getCurrentUser(client, { schema: customSchema })
 * ```
 *
 * ## Safe Version
 *
 * Use `safeGetCurrentUser` for error handling without exceptions:
 *
 * ```typescript
 * import { safeGetCurrentUser } from '@phala/cloud'
 *
 * const result = await safeGetCurrentUser(client)
 * if (result.success) {
 *   console.log(result.data.username)
 * } else {
 *   if ("isRequestError" in result.error) {
 *     console.error(`HTTP ${result.error.status}: ${result.error.message}`)
 *   } else {
 *     console.error(`Validation error: ${result.error.issues}`)
 *   }
 * }
 * ```
 */

export const CurrentUserSchema = z
  .object({
    username: z.string(),
    email: z.string(),
    credits: z.number(),
    granted_credits: z.number(),
    avatar: z.string(),
    team_name: z.string(),
    team_tier: z.string(),
  })
  .passthrough();

export type CurrentUser = z.infer<typeof CurrentUserSchema>;

export type GetCurrentUserParameters<T = undefined> = ActionParameters<T>;

export type GetCurrentUserReturnType<T = undefined> = ActionReturnType<CurrentUser, T>;

// Overload without parameters
export function getCurrentUser(client: Client): Promise<CurrentUser>;
// Overload with custom schema
export function getCurrentUser<TSchema extends z.ZodTypeAny>(
  client: Client,
  parameters: { schema: TSchema },
): Promise<z.infer<TSchema>>;
// Overload with schema = false
export function getCurrentUser(client: Client, parameters: { schema: false }): Promise<unknown>;
// Implementation signature
export function getCurrentUser(
  client: Client,
  parameters?: { schema?: z.ZodTypeAny | false },
): Promise<CurrentUser | unknown>;
// Implementation
export async function getCurrentUser(
  client: Client,
  parameters?: { schema?: z.ZodTypeAny | false },
): Promise<CurrentUser | unknown> {
  validateActionParameters(parameters);

  const response = await client.get("/auth/me");

  if (parameters?.schema === false) {
    return response;
  }

  const schema = (parameters?.schema || CurrentUserSchema) as z.ZodTypeAny;
  return schema.parse(response);
}

export async function safeGetCurrentUser<T extends z.ZodTypeAny | false | undefined = undefined>(
  client: Client,
  parameters?: GetCurrentUserParameters<T>,
): Promise<SafeResult<GetCurrentUserReturnType<T>>> {
  const parameterValidationError = safeValidateActionParameters(parameters);
  if (parameterValidationError) {
    return parameterValidationError as SafeResult<GetCurrentUserReturnType<T>>;
  }

  const httpResult = await client.safeGet("/auth/me");
  if (!httpResult.success) {
    return httpResult as SafeResult<GetCurrentUserReturnType<T>>;
  }

  if (parameters?.schema === false) {
    return { success: true, data: httpResult.data } as SafeResult<GetCurrentUserReturnType<T>>;
  }

  const schema = (parameters?.schema || CurrentUserSchema) as z.ZodTypeAny;
  return schema.safeParse(httpResult.data) as SafeResult<GetCurrentUserReturnType<T>>;
}
