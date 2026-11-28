import type { ZodError } from "zod";

export function formatZodIssues(error: ZodError): string {
	return error.issues
		.map(
			({ path, message }) =>
				`  - ${path.length ? `${path.join(".")}: ` : ""}${message}`,
		)
		.join("\n");
}
