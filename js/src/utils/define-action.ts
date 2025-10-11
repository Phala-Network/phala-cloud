import { z } from "zod";
import { type Client, type SafeResult } from "../client";
import { validateActionParameters, safeValidateActionParameters } from "./validate-parameters";

/**
 * Defines an action that takes no additional parameters (only client + optional schema)
 *
 * Usage preserves full type inference:
 * - action(client) → returns TDefault (inferred from schema)
 * - action(client, { schema: CustomSchema }) → returns z.infer<CustomSchema>
 * - action(client, { schema: false }) → returns unknown
 */
export function defineSimpleAction<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  fn: (client: Client) => Promise<unknown>,
) {
  type TDefault = z.infer<TSchema>;

  // Overloaded signatures for perfect type inference
  function action(client: Client): Promise<TDefault>;
  function action<T extends z.ZodTypeAny>(
    client: Client,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  function action(client: Client, parameters: { schema: false }): Promise<unknown>;
  function action<T extends z.ZodTypeAny | false | undefined = undefined>(
    client: Client,
    parameters?: { schema?: T },
  ): Promise<T extends z.ZodTypeAny ? z.infer<T> : T extends false ? unknown : TDefault> {
    return _actionImpl(client, parameters);
  }

  async function _actionImpl<T extends z.ZodTypeAny | false | undefined = undefined>(
    client: Client,
    parameters?: { schema?: T },
  ): Promise<T extends z.ZodTypeAny ? z.infer<T> : T extends false ? unknown : TDefault> {
    validateActionParameters(parameters);

    const response = await fn(client);

    if (parameters?.schema === false) {
      return response as T extends z.ZodTypeAny ? z.infer<T> : T extends false ? unknown : TDefault;
    }

    const actualSchema = (parameters?.schema || schema) as z.ZodTypeAny;
    return actualSchema.parse(response) as T extends z.ZodTypeAny
      ? z.infer<T>
      : T extends false
        ? unknown
        : TDefault;
  }

  // Safe variant overloads
  function safeAction(client: Client): Promise<SafeResult<TDefault>>;
  function safeAction<T extends z.ZodTypeAny>(
    client: Client,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  function safeAction(client: Client, parameters: { schema: false }): Promise<SafeResult<unknown>>;
  function safeAction<T extends z.ZodTypeAny | false | undefined = undefined>(
    client: Client,
    parameters?: { schema?: T },
  ): Promise<
    SafeResult<T extends z.ZodTypeAny ? z.infer<T> : T extends false ? unknown : TDefault>
  > {
    return _safeActionImpl(client, parameters);
  }

  async function _safeActionImpl<T extends z.ZodTypeAny | false | undefined = undefined>(
    client: Client,
    parameters?: { schema?: T },
  ): Promise<
    SafeResult<T extends z.ZodTypeAny ? z.infer<T> : T extends false ? unknown : TDefault>
  > {
    type ReturnType = T extends z.ZodTypeAny ? z.infer<T> : T extends false ? unknown : TDefault;
    const parameterValidationError = safeValidateActionParameters<ReturnType>(parameters);
    if (parameterValidationError) {
      return parameterValidationError;
    }

    const httpResult = await (async () => {
      try {
        const data = await fn(client);
        return { success: true, data } as const;
      } catch (error) {
        if (error && typeof error === "object" && "isRequestError" in error) {
          return { success: false, error } as const;
        }
        // Preserve ZodError structure with issues
        if (error && typeof error === "object" && "issues" in error) {
          return { success: false, error } as const;
        }
        return {
          success: false,
          error: {
            name: "Error",
            message: error instanceof Error ? error.message : String(error),
          },
        } as const;
      }
    })();

    if (!httpResult.success) {
      return httpResult as SafeResult<
        T extends z.ZodTypeAny ? z.infer<T> : T extends false ? unknown : TDefault
      >;
    }

    if (parameters?.schema === false) {
      return { success: true, data: httpResult.data } as SafeResult<
        T extends z.ZodTypeAny ? z.infer<T> : T extends false ? unknown : TDefault
      >;
    }

    const actualSchema = (parameters?.schema || schema) as z.ZodTypeAny;
    return actualSchema.safeParse(httpResult.data) as SafeResult<
      T extends z.ZodTypeAny ? z.infer<T> : T extends false ? unknown : TDefault
    >;
  }

  return {
    action,
    safeAction,
  };
}

/**
 * Defines an action with parameters
 */
export function defineAction<TParams, TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  fn: (client: Client, params: TParams) => Promise<unknown>,
) {
  type TDefault = z.infer<TSchema>;

  // Overloaded signatures
  function action(client: Client, params: TParams): Promise<TDefault>;
  function action<T extends z.ZodTypeAny>(
    client: Client,
    params: TParams,
    parameters: { schema: T },
  ): Promise<z.infer<T>>;
  function action(client: Client, params: TParams, parameters: { schema: false }): Promise<unknown>;
  function action<T extends z.ZodTypeAny | false | undefined = undefined>(
    client: Client,
    params: TParams,
    parameters?: { schema?: T },
  ): Promise<T extends z.ZodTypeAny ? z.infer<T> : T extends false ? unknown : TDefault> {
    return _actionImpl(client, params, parameters);
  }

  async function _actionImpl<T extends z.ZodTypeAny | false | undefined = undefined>(
    client: Client,
    params: TParams,
    parameters?: { schema?: T },
  ): Promise<T extends z.ZodTypeAny ? z.infer<T> : T extends false ? unknown : TDefault> {
    validateActionParameters(parameters);

    const response = await fn(client, params);

    if (parameters?.schema === false) {
      return response as T extends z.ZodTypeAny ? z.infer<T> : T extends false ? unknown : TDefault;
    }

    const actualSchema = (parameters?.schema || schema) as z.ZodTypeAny;
    return actualSchema.parse(response) as T extends z.ZodTypeAny
      ? z.infer<T>
      : T extends false
        ? unknown
        : TDefault;
  }

  // Safe variant overloads
  function safeAction(client: Client, params: TParams): Promise<SafeResult<TDefault>>;
  function safeAction<T extends z.ZodTypeAny>(
    client: Client,
    params: TParams,
    parameters: { schema: T },
  ): Promise<SafeResult<z.infer<T>>>;
  function safeAction(
    client: Client,
    params: TParams,
    parameters: { schema: false },
  ): Promise<SafeResult<unknown>>;
  function safeAction<T extends z.ZodTypeAny | false | undefined = undefined>(
    client: Client,
    params: TParams,
    parameters?: { schema?: T },
  ): Promise<
    SafeResult<T extends z.ZodTypeAny ? z.infer<T> : T extends false ? unknown : TDefault>
  > {
    return _safeActionImpl(client, params, parameters);
  }

  async function _safeActionImpl<T extends z.ZodTypeAny | false | undefined = undefined>(
    client: Client,
    params: TParams,
    parameters?: { schema?: T },
  ): Promise<
    SafeResult<T extends z.ZodTypeAny ? z.infer<T> : T extends false ? unknown : TDefault>
  > {
    type ReturnType = T extends z.ZodTypeAny ? z.infer<T> : T extends false ? unknown : TDefault;
    const parameterValidationError = safeValidateActionParameters<ReturnType>(parameters);
    if (parameterValidationError) {
      return parameterValidationError;
    }

    const httpResult = await (async () => {
      try {
        const data = await fn(client, params);
        return { success: true, data } as const;
      } catch (error) {
        if (error && typeof error === "object" && "isRequestError" in error) {
          return { success: false, error } as const;
        }
        // Preserve ZodError structure with issues
        if (error && typeof error === "object" && "issues" in error) {
          return { success: false, error } as const;
        }
        return {
          success: false,
          error: {
            name: "Error",
            message: error instanceof Error ? error.message : String(error),
          },
        } as const;
      }
    })();

    if (!httpResult.success) {
      return httpResult as SafeResult<
        T extends z.ZodTypeAny ? z.infer<T> : T extends false ? unknown : TDefault
      >;
    }

    if (parameters?.schema === false) {
      return { success: true, data: httpResult.data } as SafeResult<
        T extends z.ZodTypeAny ? z.infer<T> : T extends false ? unknown : TDefault
      >;
    }

    const actualSchema = (parameters?.schema || schema) as z.ZodTypeAny;
    return actualSchema.safeParse(httpResult.data) as SafeResult<
      T extends z.ZodTypeAny ? z.infer<T> : T extends false ? unknown : TDefault
    >;
  }

  return {
    action,
    safeAction,
  };
}
