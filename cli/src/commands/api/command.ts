import { z } from "zod";
import { commonAuthOptions } from "@/src/core/common-flags";
import type { CommandMeta } from "@/src/core/types";

export const HTTP_METHODS = [
	"GET",
	"POST",
	"PUT",
	"PATCH",
	"DELETE",
	"HEAD",
	"OPTIONS",
] as const;

export const apiCommandMeta: CommandMeta = {
	name: "api",
	category: "advanced",
	description: `Make an authenticated HTTP request to Phala Cloud API.

The endpoint should be an API path like "/cvms" or "/users/me".

Use -f key=value to add query parameters (appended to the URL for any method).
Use -F key=value or -F key:=value to add body fields (sent as JSON body).
-F supports both string values (key=value) and typed JSON values (key:=value
for numbers, booleans, null, arrays, objects). Both -f and -F support @file
syntax: -f q=@query.txt, -F config:=@data.json.

Use -d to send raw request body data (cURL-style). If the value is valid JSON,
it will be sent as JSON automatically.

Use --input to send a JSON file as request body, or --input - to read from stdin.

-f (query) can be combined with -F/-d/--input (body). -F, -d, and --input
are mutually exclusive.

Use -q to filter JSON output with jq syntax (built-in, no jq installation needed).

ENVIRONMENT VARIABLES

  PHALA_CLOUD_API_KEY       Override the API key (useful for CI/CD)
  PHALA_CLOUD_API_PREFIX    Override the API base URL`,
	stability: "unstable",
	arguments: [
		{
			name: "endpoint",
			description: "API endpoint path",
			required: true,
		},
	],
	options: [
		...commonAuthOptions,
		{
			name: "method",
			shorthand: "X",
			description: "HTTP method (default: GET)",
			type: "string",
			target: "method",
		},
		{
			name: "query",
			shorthand: "f",
			description:
				"Query parameter: key=value (use key=@file to read from file)",
			type: "string[]",
			target: "query",
		},
		{
			name: "field",
			shorthand: "F",
			description:
				"Body field: key=value (string) or key:=value (typed JSON). Supports @file",
			type: "string[]",
			target: "field",
		},
		{
			name: "header",
			shorthand: "H",
			description: "HTTP header: key:value",
			type: "string[]",
			target: "header",
		},
		{
			name: "data",
			shorthand: "d",
			description: "Request body data (cURL-style)",
			type: "string[]",
			target: "data",
		},
		{
			name: "input",
			description: 'Read body from file (use "-" for stdin)',
			type: "string",
			target: "input",
		},
		{
			name: "include",
			shorthand: "i",
			description: "Print response headers",
			type: "boolean",
			target: "include",
		},
		{
			name: "jq",
			shorthand: "q",
			description: "Filter output with jq expression",
			type: "string",
			target: "jq",
		},
		{
			name: "silent",
			description: "Don't print response body",
			type: "boolean",
			target: "silent",
		},
	],
	examples: [
		{
			name: "List CVMs",
			value: "phala api /cvms",
		},
		{
			name: "Get CVM by app ID",
			value: "phala api /cvms/app_xxx",
		},
		{
			name: "Filter with jq",
			value: "phala api /cvms -q '.items[].name'",
		},
		{
			name: "GET with query params",
			value: "phala api /endpoint -f status=active -f page=2",
		},
		{
			name: "POST with body fields",
			value: "phala api /endpoint -X POST -F name=foo -F count:=10",
		},
		{
			name: "POST with cURL-style -d",
			value: `phala api /endpoint -X POST -d '{"foo":"bar"}'`,
		},
		{
			name: "POST from file",
			value: "phala api /endpoint -X POST --input data.json",
		},
		{
			name: "Query params + body combined",
			value: "phala api /endpoint -X POST -f page=1 -F name=foo",
		},
		{
			name: "Body field from file",
			value: "phala api /endpoint -X POST -F config:=@settings.json",
		},
		{
			name: "Show response headers",
			value: "phala api /cvms -i",
		},
	],
};

export const apiCommandSchema = z.object({
	endpoint: z.string(),
	method: z
		.enum(HTTP_METHODS)
		.default("GET")
		.transform((v) => v.toUpperCase() as (typeof HTTP_METHODS)[number]),
	query: z.array(z.string()).optional(),
	field: z.array(z.string()).optional(),
	header: z.array(z.string()).optional(),
	data: z.array(z.string()).optional(),
	input: z.string().optional(),
	include: z.boolean().default(false),
	jq: z.string().optional(),
	silent: z.boolean().default(false),
	apiToken: z.string().optional(),
});

export type ApiCommandInput = z.infer<typeof apiCommandSchema>;
