import { describe, expect, test } from "bun:test";
import { RequestError, ResourceError } from "@phala/cloud";

import {
	buildJsonCliError,
	normalizeCliError,
	renderHumanCliError,
	type CliErrorEnvelope,
} from "./logger";

const INCIDENT_REQUEST_ID = "73bdba99d0d36a8086bcc9593d39ff67";
const INCIDENT_URL =
	"https://cloud-api.phala.network/api/v1/cvms/f768b03a-427d-4bf5-af31-171d4edba6b2";

function makeIncidentRequestError(): RequestError {
	const response = {
		error: "Internal Server Error",
		request_id: INCIDENT_REQUEST_ID,
	};

	return new RequestError("[PATCH] request failed", {
		status: 500,
		statusText: "Internal Server Error",
		data: response,
		detail: "Internal Server Error",
		request: new URL(INCIDENT_URL),
		requestMethod: "PATCH",
		requestId: INCIDENT_REQUEST_ID,
	});
}

function countOccurrences(haystack: string, needle: string): number {
	if (needle.length === 0) return 0;
	let count = 0;
	let index = 0;
	while (true) {
		const found = haystack.indexOf(needle, index);
		if (found === -1) return count;
		count += 1;
		index = found + needle.length;
	}
}

describe("CLI error envelope", () => {
	test("normalizes generic 500 RequestError with body request ID", () => {
		const error = makeIncidentRequestError();
		const envelope = normalizeCliError(error);

		expect(envelope.message).toBe("Internal Server Error");
		expect(envelope.requestId).toBe(INCIDENT_REQUEST_ID);
		expect(envelope.httpStatus).toBe(500);
		expect(envelope.statusText).toBe("Internal Server Error");
		expect(envelope.request).toEqual({
			method: "PATCH",
			url: INCIDENT_URL,
		});
		expect(envelope.response).toEqual({
			error: "Internal Server Error",
			request_id: INCIDENT_REQUEST_ID,
		});
	});

	test("builds exact JSON envelope for incident 500", () => {
		const envelope = normalizeCliError(makeIncidentRequestError());
		const json = buildJsonCliError(envelope, { operation: "CVM update" });

		expect(json).toEqual({
			success: false,
			error: "Internal Server Error",
			operation: "CVM update",
			request_id: INCIDENT_REQUEST_ID,
			http_status: 500,
			status_text: "Internal Server Error",
			request: {
				method: "PATCH",
				url: INCIDENT_URL,
			},
			response: {
				error: "Internal Server Error",
				request_id: INCIDENT_REQUEST_ID,
			},
		});
	});

	test("renders human failure block once without response or stack by default", () => {
		const envelope = normalizeCliError(makeIncidentRequestError());
		const human = renderHumanCliError(envelope, { operation: "CVM update" });

		const expectedLines = [
			"CVM update failed.",
			"Message: Internal Server Error",
			`Request: PATCH ${INCIDENT_URL}`,
			"HTTP: 500 Internal Server Error",
			`Request ID: ${INCIDENT_REQUEST_ID}`,
		];

		for (const line of expectedLines) {
			expect(countOccurrences(human, line)).toBe(1);
		}
		expect(human).not.toContain("Response:");
		expect(human).not.toContain("Stack:");
	});

	test("debug human output includes complete response and stack", () => {
		const error = makeIncidentRequestError();
		const envelope = normalizeCliError(error);
		const human = renderHumanCliError(envelope, {
			operation: "CVM update",
			debug: true,
		});

		expect(human).toContain("Response:");
		expect(human).toContain(`"request_id": "${INCIDENT_REQUEST_ID}"`);
		expect(human).toContain("Stack:");
		expect(human).toContain(error.stack ?? "RequestError");
	});

	test("preserves header-derived request ID on RequestError", () => {
		const error = new RequestError("[GET] failed", {
			status: 502,
			statusText: "Bad Gateway",
			data: { error: "upstream" },
			detail: "upstream",
			request: "https://cloud-api.phala.network/api/v1/cvms",
			requestMethod: "GET",
			requestId: "header-rid-001",
		});

		const envelope = normalizeCliError(error);
		expect(envelope.requestId).toBe("header-rid-001");
		expect(buildJsonCliError(envelope).request_id).toBe("header-rid-001");
	});

	test("normalizes ResourceError structured fields", () => {
		const response = {
			error_code: "ERR-02-009",
			message: "The selected instance type is incompatible",
			details: [
				{
					field: "instance_type",
					message: "This instance type does not support the selected image",
				},
			],
			suggestions: ["Choose a compatible instance type"],
			links: [
				{
					label: "View instance types",
					url: "https://cloud.phala.com/instances",
				},
			],
			request_id: "abc123",
		};

		const error = new ResourceError(response.message, {
			status: 400,
			statusText: "Bad Request",
			detail: response,
			requestId: "abc123",
			request: new URL(
				"https://cloud-api.phala.network/api/v1/cvms/f768b03a-427d-4bf5-af31-171d4edba6b2",
			),
			requestMethod: "PATCH",
			data: response,
			errorCode: "ERR-02-009",
			structuredDetails: response.details,
			suggestions: response.suggestions,
			links: response.links,
		});

		const envelope = normalizeCliError(error);
		const json = buildJsonCliError(envelope, { operation: "CVM update" });
		const human = renderHumanCliError(envelope, { operation: "CVM update" });

		expect(json).toEqual({
			success: false,
			error: "The selected instance type is incompatible",
			operation: "CVM update",
			error_code: "ERR-02-009",
			request_id: "abc123",
			http_status: 400,
			status_text: "Bad Request",
			request: {
				method: "PATCH",
				url: INCIDENT_URL,
			},
			details: response.details,
			suggestions: response.suggestions,
			links: response.links,
			response,
		});

		expect(human).toContain("CVM update failed.");
		expect(human).toContain(
			"Error [ERR-02-009]: The selected instance type is incompatible",
		);
		expect(human).toContain(`Request: PATCH ${INCIDENT_URL}`);
		expect(human).toContain("HTTP: 400 Bad Request");
		expect(human).toContain("Request ID: abc123");
		expect(human).toContain("Details:");
		expect(human).toContain(
			"- This instance type does not support the selected image",
		);
		expect(human).toContain("Suggestions:");
		expect(human).toContain("- Choose a compatible instance type");
		expect(human).toContain("Learn more:");
		expect(human).toContain(
			"- View instance types: https://cloud.phala.com/instances",
		);
	});

	test("normalizes RequestError.detail structured object", () => {
		const detail = {
			error_code: "ERR-01-001",
			message: "Instance type missing",
			request_id: "detail-rid",
			details: [{ message: "missing type" }],
			suggestions: ["pick a type"],
		};
		const error = new RequestError("[POST] failed", {
			status: 400,
			statusText: "Bad Request",
			data: detail,
			detail,
			request: "https://cloud-api.phala.network/api/v1/cvms",
			requestMethod: "POST",
			requestId: "detail-rid",
		});

		const envelope = normalizeCliError(error);
		expect(envelope.errorCode).toBe("ERR-01-001");
		expect(envelope.message).toBe("Instance type missing");
		expect(envelope.details).toEqual([{ message: "missing type" }]);
		expect(envelope.suggestions).toEqual(["pick a type"]);
	});

	test("unwraps ResultError-style cause while keeping outer message fallback", () => {
		const cause = makeIncidentRequestError();
		const wrapper = {
			message: "Failed to update CVM",
			cause,
		};

		const envelope = normalizeCliError(wrapper);
		expect(envelope.message).toBe("Internal Server Error");
		expect(envelope.requestId).toBe(INCIDENT_REQUEST_ID);
		expect(envelope.httpStatus).toBe(500);
	});

	test("timeout keeps code and omits fabricated HTTP fields", () => {
		const error = new RequestError(
			"Request timed out. The server did not respond in time.",
			{
				status: 0,
				statusText: "Request Timeout",
				detail: "Request timed out. The server did not respond in time.",
				request: INCIDENT_URL,
				requestMethod: "PATCH",
				code: "TIMEOUT",
			},
		);

		const envelope = normalizeCliError(error);
		const json = buildJsonCliError(envelope);

		expect(envelope.message).toContain("timed out");
		expect(envelope.httpStatus).toBeUndefined();
		expect(envelope.requestId).toBeUndefined();
		expect(json.http_status).toBeUndefined();
		expect(json.request_id).toBeUndefined();
		expect(json.request).toEqual({ method: "PATCH", url: INCIDENT_URL });
	});

	test("network failure omits response and request ID", () => {
		const error = new RequestError("[GET] https://example.test: <no response>", {
			status: 0,
			statusText: "Unknown Error",
			detail: "[GET] https://example.test: <no response>",
			request: "https://example.test/api",
			requestMethod: "GET",
		});

		const envelope = normalizeCliError(error);
		const json = buildJsonCliError(envelope);

		expect(envelope.httpStatus).toBeUndefined();
		expect(envelope.requestId).toBeUndefined();
		expect(envelope.response).toBeUndefined();
		expect(json.response).toBeUndefined();
		expect(json.request_id).toBeUndefined();
	});

	test("plain Error keeps message only", () => {
		const error = new Error("compose file not found");
		const envelope = normalizeCliError(error);
		const json = buildJsonCliError(envelope, { operation: "Deploy" });
		const human = renderHumanCliError(envelope, { operation: "Deploy" });

		expect(envelope.message).toBe("compose file not found");
		expect(envelope.httpStatus).toBeUndefined();
		expect(json).toEqual({
			success: false,
			error: "compose file not found",
			operation: "Deploy",
		});
		expect(human).toContain("Deploy failed.");
		expect(human).toContain("Message: compose file not found");
		expect(human).not.toContain("HTTP:");
		expect(human).not.toContain("Request ID:");
	});

	test("unknown thrown value becomes readable string", () => {
		const envelope = normalizeCliError(42);
		expect(envelope.message).toBe("42");
		expect(buildJsonCliError(envelope)).toEqual({
			success: false,
			error: "42",
		});
	});

	test("preserves full URL and request ID without truncation", () => {
		const longId = "a".repeat(128);
		const longUrl = `${INCIDENT_URL}?token=${"b".repeat(200)}`;
		const error = new RequestError("boom", {
			status: 500,
			statusText: "Internal Server Error",
			data: { error: "boom", request_id: longId },
			detail: "boom",
			request: longUrl,
			requestMethod: "PATCH",
			requestId: longId,
		});

		const envelope = normalizeCliError(error);
		const human = renderHumanCliError(envelope, { operation: "CVM update" });
		const json = buildJsonCliError(envelope);

		expect(envelope.requestId).toBe(longId);
		expect(envelope.request?.url).toBe(longUrl);
		expect(human).toContain(longId);
		expect(human).toContain(longUrl);
		expect(json.request_id).toBe(longId);
		expect(json.request?.url).toBe(longUrl);
	});

	test("JSON includes complete response when data exists", () => {
		const data = {
			error: "Internal Server Error",
			request_id: INCIDENT_REQUEST_ID,
			extra: { nested: true, count: 2 },
		};
		const error = new RequestError("fail", {
			status: 500,
			statusText: "Internal Server Error",
			data,
			detail: "Internal Server Error",
			requestId: INCIDENT_REQUEST_ID,
		});

		const json = buildJsonCliError(normalizeCliError(error));
		expect(json.response).toEqual(data);
	});

	test("JSON stack is present only with debug", () => {
		const error = makeIncidentRequestError();
		const envelope = normalizeCliError(error);

		expect(buildJsonCliError(envelope).stack).toBeUndefined();
		expect(buildJsonCliError(envelope, { debug: true }).stack).toBe(
			error.stack,
		);
	});

	test("does not emit null or empty filler fields", () => {
		const envelope: CliErrorEnvelope = {
			message: "plain",
		};
		const json = buildJsonCliError(envelope);
		expect(Object.keys(json).sort()).toEqual(["error", "success"]);
		expect(json).not.toHaveProperty("request_id");
		expect(json).not.toHaveProperty("details");
		expect(json).not.toHaveProperty("suggestions");
		expect(json).not.toHaveProperty("links");
		expect(json).not.toHaveProperty("response");
	});

	test("never serializes request headers or body", () => {
		const error = new RequestError("fail", {
			status: 500,
			statusText: "Internal Server Error",
			data: { error: "x" },
			detail: "x",
			request: new Request(INCIDENT_URL, {
				method: "PATCH",
				headers: {
					Authorization: "Bearer secret-token",
					"X-API-Key": "secret-key",
				},
				body: JSON.stringify({ password: "secret" }),
			}),
			requestMethod: "PATCH",
			requestId: INCIDENT_REQUEST_ID,
		});

		const envelope = normalizeCliError(error);
		const human = renderHumanCliError(envelope, { debug: true });
		const json = JSON.stringify(buildJsonCliError(envelope, { debug: true }));

		expect(human).not.toContain("secret-token");
		expect(human).not.toContain("secret-key");
		expect(human).not.toContain("password");
		expect(json).not.toContain("secret-token");
		expect(json).not.toContain("secret-key");
		expect(json).not.toContain("password");
		expect(envelope.request?.url).toBe(INCIDENT_URL);
	});

	test("human guidance is optional and only for human mode", () => {
		const envelope = normalizeCliError(makeIncidentRequestError());
		const human = renderHumanCliError(envelope, {
			operation: "CVM update",
			guidance:
				"Check the CVM status before retrying. Include the Request ID when contacting support.",
		});
		const json = buildJsonCliError(envelope, { operation: "CVM update" });

		expect(human).toContain(
			"Check the CVM status before retrying. Include the Request ID when contacting support.",
		);
		expect(JSON.stringify(json)).not.toContain("Check the CVM status");
	});

	test("does not map numeric HTTP code to error_code", () => {
		const error = new RequestError("server exploded", {
			status: 500,
			statusText: "Internal Server Error",
			data: { error: "server exploded" },
			detail: "server exploded",
			code: "500",
			requestId: INCIDENT_REQUEST_ID,
		});

		const envelope = normalizeCliError(error);
		expect(envelope.errorCode).toBeUndefined();
		expect(buildJsonCliError(envelope).error_code).toBeUndefined();
	});
});
