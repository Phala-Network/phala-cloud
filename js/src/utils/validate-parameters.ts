import type { SafeResult } from "../client";
import type { z } from "zod";

/**
 * Validates action parameters, specifically the schema parameter
 *
 * @param parameters - The parameters to validate
 * @throws Error if schema parameter is invalid (for non-safe functions)
 */
export function validateActionParameters(parameters?: { schema?: z.ZodTypeAny | false }): void {
  if (parameters?.schema !== undefined && parameters?.schema !== false) {
    if (
      typeof parameters.schema !== "object" ||
      parameters.schema === null ||
      !("parse" in parameters.schema) ||
      typeof parameters.schema.parse !== "function"
    ) {
      throw new Error("Invalid schema: must be a Zod schema object, false, or undefined");
    }
  }
}

/**
 * Validates action parameters for safe functions
 *
 * @param parameters - The parameters to validate
 * @returns SafeResult with error if validation fails, undefined if validation passes
 */
export function safeValidateActionParameters<ReturnType>(parameters?: {
  schema?: z.ZodTypeAny | false;
}): SafeResult<ReturnType> | undefined {
  if (parameters?.schema !== undefined && parameters?.schema !== false) {
    if (
      typeof parameters.schema !== "object" ||
      parameters.schema === null ||
      !("parse" in parameters.schema) ||
      typeof parameters.schema.parse !== "function"
    ) {
      return {
        success: false,
        error: {
          name: "ZodError",
          message: "Invalid schema: must be a Zod schema object, false, or undefined",
          issues: [
            {
              code: "invalid_type",
              expected: "object",
              received: typeof parameters.schema,
              path: ["schema"],
              message: "Invalid schema: must be a Zod schema object, false, or undefined",
            },
          ],
        },
      } as SafeResult<ReturnType>;
    }
  }
  return undefined;
}
