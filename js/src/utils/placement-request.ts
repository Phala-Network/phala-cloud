import { z } from "zod";

/** Reject legacy placement keys before object schemas strip unknown fields. */
export function placementRequest<T extends z.ZodTypeAny>(schema: T) {
  return z
    .unknown()
    .superRefine((data, ctx) => {
      if (data !== null && typeof data === "object") {
        for (const key of ["node_id", "teepod_id"]) {
          if (key in data) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [key],
              message: `Use node instead of ${key}`,
            });
          }
        }
      }
    })
    .pipe(schema);
}
