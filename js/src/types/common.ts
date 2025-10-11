import { z } from "zod";

/**
 * Combines members of an intersection into a readable type
 *
 * @example
 * ```typescript
 * type A = { a: string }
 * type B = { b: number }
 * type Combined = Prettify<A & B>
 * // Result: { a: string; b: number }
 * ```
 */
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

/**
 * Common type for action parameters that control behavior (e.g., schema validation)
 */
export type ActionParameters<T = undefined> = T extends z.ZodSchema
  ? { schema: T }
  : T extends false
    ? { schema: false }
    : { schema?: z.ZodSchema | false };

/**
 * Common type for action return values with schema validation support
 */
export type ActionReturnType<DefaultType, T = undefined> = T extends z.ZodSchema
  ? z.infer<T>
  : T extends false
    ? unknown
    : DefaultType;

// Re-export for convenience
export type { z };
