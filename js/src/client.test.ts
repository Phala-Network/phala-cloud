import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { createClient, Client } from "./client";
import { type SafeResult, type ClientConfig } from "./types";
import { PhalaCloudError, RequestError } from "./utils";
import { getErrorMessage } from "./utils";
import { ofetch } from "ofetch";

// Mock ofetch module
vi.mock("ofetch", async () => {
	const actual = await vi.importActual<typeof import("ofetch")>("ofetch");
	return {
		...actual,
		ofetch: {
			...actual.ofetch,
			create: vi.fn(),
		},
	};
});

describe("RequestError", () => {
	test("should create error with all properties", () => {
		const error = new RequestError("Test error", {
			status: 404,
			statusText: "Not Found",
			data: { message: "Resource not found" },
			detail: "Detailed error message",
			code: "E404",
			type: "NotFound",
		});

		expect(error.name).toBe("RequestError");
		expect(error.message).toBe("Test error");
		expect(error.status).toBe(404);
		expect(error.statusText).toBe("Not Found");
		expect(error.data).toEqual({ message: "Resource not found" });
		expect(error.detail).toBe("Detailed error message");
		expect(error.code).toBe("E404");
		expect(error.type).toBe("NotFound");
	});

	test("should create error with minimal properties", () => {
		const error = new RequestError("Simple error");

		expect(error.name).toBe("RequestError");
		expect(error.message).toBe("Simple error");
		expect(error.detail).toBe("Simple error");
		expect(error.status).toBe(0); // Default status when not provided
		expect(error.statusText).toBe("Unknown Error"); // Default statusText when not provided
		expect(error.code).toBeUndefined();
	});

	test("should implement ApiError interface", () => {
		const error = new RequestError("Test", { detail: "Test detail" });

		// Should have all required ApiError properties
		expect(error.detail).toBeDefined();
		expect(
			typeof error.detail === "string" || typeof error.detail === "object",
		).toBe(true);
	});

	describe("fromFetchError", () => {
		test("should create RequestError from FetchError with parsed data", () => {
			const fetchError = {
				message: "API Error",
				status: 400,
				statusText: "Bad Request",
				data: {
					detail: "Validation failed",
					code: "VALIDATION_ERROR",
					type: "ValidationError",
				},
				request: "/api/test",
				response: {} as Response,
			} as any;

			const error = RequestError.fromFetchError(fetchError);

			expect(error.message).toBe("API Error");
			expect(error.status).toBe(400);
			expect(error.statusText).toBe("Bad Request");
			expect(error.detail).toBe("Validation failed");
			expect(error.code).toBe("VALIDATION_ERROR");
			expect(error.type).toBe("ValidationError");
		});

		test("should handle FetchError with unparseable data", () => {
			const fetchError = {
				message: "Network Error",
				status: 500,
				statusText: "Internal Server Error",
				data: "Invalid JSON",
				request: "/api/test",
				response: {} as Response,
			} as any;

			const error = RequestError.fromFetchError(fetchError);

			expect(error.message).toBe("Network Error");
			expect(error.status).toBe(500);
			// Preserve original error message as detail (was previously
			// overwritten with the unhelpful "Unknown API error" placeholder).
			expect(error.detail).toBe("Network Error");
			expect(error.code).toBe("500");
		});

		test("should handle undefined values correctly", () => {
			const fetchError = {
				message: "Test Error",
				status: undefined,
				statusText: undefined,
				data: undefined,
				request: undefined,
				response: undefined,
			} as any;

			const error = RequestError.fromFetchError(fetchError);

			expect(error.status).toBe(0); // Default status when undefined
			expect(error.statusText).toBe("Unknown Error"); // Default statusText when undefined
			expect(error.request).toBeUndefined();
			expect(error.response).toBeUndefined();
		});
	});

	describe("fromError", () => {
		test("should create RequestError from generic Error", () => {
			const genericError = new Error("Something went wrong");
			const error = RequestError.fromError(genericError, "/api/test");

			expect(error.message).toBe("Something went wrong");
			expect(error.detail).toBe("Something went wrong");
			expect(error.request).toBe("/api/test");
		});

		test("should handle undefined request", () => {
			const genericError = new Error("Test error");
			const error = RequestError.fromError(genericError);

			expect(error.request).toBeUndefined();
		});
	});
});

describe("ClientConfig", () => {
	test("should extend FetchOptions", () => {
		const config: ClientConfig = {
			apiKey: "test-key",
			baseURL: "https://api.example.com",
			timeout: 5000,
			// FetchOptions properties
			headers: { "Custom-Header": "value" },
			retry: 3,
			retryDelay: 1000,
		};

		expect(config.apiKey).toBe("test-key");
		expect(config.baseURL).toBe("https://api.example.com");
		expect(config.timeout).toBe(5000);
		expect(config.headers).toEqual({ "Custom-Header": "value" });
		expect(config.retry).toBe(3);
		expect(config.retryDelay).toBe(1000);
	});

	test("should require apiKey", () => {
		// This test ensures the type system enforces apiKey requirement
		const config: ClientConfig = {
			apiKey: "required-key",
		};

		expect(config.apiKey).toBe("required-key");
	});
});

describe("Client", () => {
	let mockFetchInstance: any;
	let client: Client;

	beforeEach(() => {
		mockFetchInstance = vi.fn();
		mockFetchInstance.mockResolvedValue({ success: true });

		(ofetch.create as any).mockReturnValue(mockFetchInstance);

		client = createClient({
			apiKey: "test-api-key",
			baseURL: "https://api.test.com",
			timeout: 10000,
		});
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("constructor", () => {
		test("should create client with correct configuration", () => {
			// Clear previous mocks for this isolated test
			vi.clearAllMocks();

			const config: ClientConfig = {
				apiKey: "test-key",
				baseURL: "https://custom.api.com",
				timeout: 15000,
				headers: { Custom: "header" },
			};

			createClient(config);

			expect(ofetch.create).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: "https://custom.api.com",
					timeout: 15000,
					headers: expect.objectContaining({
						"X-API-Key": "test-key",
						"Content-Type": "application/json",
						Custom: "header",
					}),
					onResponseError: expect.any(Function),
				}),
			);
		});

		test("should use default values when not provided", () => {
			// Clear previous mocks for this isolated test
			vi.clearAllMocks();

			// Ensure environment variable does not affect this test
			const oldPrefix = process.env.PHALA_CLOUD_API_PREFIX;
			delete process.env.PHALA_CLOUD_API_PREFIX;

			const config: ClientConfig = {
				apiKey: "test-key",
			};

			createClient(config);

			expect(ofetch.create).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: "https://cloud-api.phala.com/api/v1",
					timeout: 60000,
					headers: expect.objectContaining({
						"X-API-Key": "test-key",
						"Content-Type": "application/json",
					}),
					onResponseError: expect.any(Function),
				}),
			);

			// Restore environment variable
			if (oldPrefix !== undefined) process.env.PHALA_CLOUD_API_PREFIX = oldPrefix;
		});

		test("should provide access to raw ofetch instance", () => {
			expect(client.raw).toBe(mockFetchInstance);
		});
	});

	describe("HTTP methods (direct)", () => {
		interface TestResponse {
			id: string;
			name: string;
		}

		test("get method should call ofetch with correct parameters", async () => {
			const mockResponse: TestResponse = { id: "1", name: "test" };
			mockFetchInstance.mockResolvedValue(mockResponse);

			const result = await client.get<TestResponse>("/users/1", {
				query: { include: "profile" },
			});

			expect(mockFetchInstance).toHaveBeenCalledWith("/users/1", {
				query: { include: "profile" },
				method: "GET",
			});
			expect(result).toEqual(mockResponse);
		});

		test("post method should call ofetch with body", async () => {
			const mockResponse: TestResponse = { id: "2", name: "new user" };
			const requestBody = { name: "new user", email: "test@example.com" };
			mockFetchInstance.mockResolvedValue(mockResponse);

			const result = await client.post<TestResponse>("/users", requestBody, {
				headers: { Custom: "header" },
			});

			expect(mockFetchInstance).toHaveBeenCalledWith("/users", {
				headers: { Custom: "header" },
				method: "POST",
				body: requestBody,
			});
			expect(result).toEqual(mockResponse);
		});

		test("put method should work correctly", async () => {
			const mockResponse: TestResponse = { id: "1", name: "updated" };
			const requestBody = { name: "updated" };
			mockFetchInstance.mockResolvedValue(mockResponse);

			const result = await client.put<TestResponse>("/users/1", requestBody);

			expect(mockFetchInstance).toHaveBeenCalledWith("/users/1", {
				method: "PUT",
				body: requestBody,
			});
			expect(result).toEqual(mockResponse);
		});

		test("patch method should work correctly", async () => {
			const mockResponse: TestResponse = { id: "1", name: "patched" };
			const requestBody = { name: "patched" };
			mockFetchInstance.mockResolvedValue(mockResponse);

			const result = await client.patch<TestResponse>("/users/1", requestBody);

			expect(mockFetchInstance).toHaveBeenCalledWith("/users/1", {
				method: "PATCH",
				body: requestBody,
			});
			expect(result).toEqual(mockResponse);
		});

		test("delete method should work correctly", async () => {
			mockFetchInstance.mockResolvedValue({ success: true });

			const result = await client.delete("/users/1");

			expect(mockFetchInstance).toHaveBeenCalledWith("/users/1", {
				method: "DELETE",
			});
			expect(result).toEqual({ success: true });
		});

		test("should throw error when ofetch throws", async () => {
			const fetchError = new Error("Network error");
			mockFetchInstance.mockRejectedValue(fetchError);

			await expect(client.get("/users")).rejects.toThrow("Network error");
		});
	});

	describe("Safe HTTP methods", () => {
		interface TestResponse {
			id: string;
			name: string;
		}

		test("safeGet should return success result", async () => {
			const mockResponse: TestResponse = { id: "1", name: "test" };
			mockFetchInstance.mockResolvedValue(mockResponse);

			const result = await client.safeGet<TestResponse>("/users/1");

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toEqual(mockResponse);
				expect(result.error).toBeUndefined();
			}
		});

		test("safeGet should return error result when fetch fails", async () => {
			const fetchError = {
				message: "Not Found",
				status: 404,
				data: { detail: "User not found" },
			};
			mockFetchInstance.mockRejectedValue(fetchError);

			const result = await client.safeGet<TestResponse>("/users/999");

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toBeInstanceOf(PhalaCloudError);
				expect(result.error.message).toBe("User not found"); // Uses detail message
				expect(result.data).toBeUndefined();
			}
		});

		test("safePost should return success result", async () => {
			const mockResponse: TestResponse = { id: "2", name: "created" };
			const requestBody = { name: "created" };
			mockFetchInstance.mockResolvedValue(mockResponse);

			const result = await client.safePost<TestResponse>("/users", requestBody);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toEqual(mockResponse);
			}
		});

		test("safePut should handle errors correctly", async () => {
			const fetchError = new Error("Validation failed");
			mockFetchInstance.mockRejectedValue(fetchError);

			const result = await client.safePut("/users/1", { name: "test" });

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toBeInstanceOf(PhalaCloudError);
				expect(result.error.message).toBe("Validation failed");
			}
		});

		test("safePatch should work correctly", async () => {
			const mockResponse = { success: true };
			mockFetchInstance.mockResolvedValue(mockResponse);

			const result = await client.safePatch("/users/1", { name: "patched" });

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toEqual(mockResponse);
			}
		});

		test("safeDelete should work correctly", async () => {
			const mockResponse = { deleted: true };
			mockFetchInstance.mockResolvedValue(mockResponse);

			const result = await client.safeDelete("/users/1");

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toEqual(mockResponse);
			}
		});

		test("should handle unknown error types", async () => {
			const unknownError = { weird: "error object" };
			mockFetchInstance.mockRejectedValue(unknownError);

			const result = await client.safeGet("/test");

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toBeInstanceOf(PhalaCloudError);
				expect(result.error.message).toBe("Unknown error occurred");
			}
		});
	});

	describe("SafeResult type structure", () => {
		test("should have correct success result structure", async () => {
			mockFetchInstance.mockResolvedValue({ data: "test" });

			const result = await client.safeGet("/test");

			// Type assertion tests
			if (result.success) {
				expect(result.data).toBeDefined();
				expect(result.error).toBeUndefined();
			}
		});

		test("should have correct error result structure", async () => {
			mockFetchInstance.mockRejectedValue(new Error("Test error"));

			const result = await client.safeGet("/test");

			// Type assertion tests
			if (!result.success) {
				expect(result.error).toBeDefined();
				expect(result.data).toBeUndefined();
			}
		});
	});
});

describe("createClient", () => {
	test("should return Client instance", () => {
		const client = createClient({
			apiKey: "test-key",
		});

		expect(client).toBeInstanceOf(Client);
	});

	test("should pass config to Client constructor", () => {
		const config: ClientConfig = {
			apiKey: "test-key",
			baseURL: "https://test.com",
			timeout: 5000,
		};

		const client = createClient(config);

		expect(client.config).toEqual({
			...config,
			version: "2026-05-22", // Default version is added
		});
	});
});

describe("getErrorMessage", () => {
	test("should extract string detail", () => {
		const error = { detail: "Simple error message" };
		expect(getErrorMessage(error)).toBe("Simple error message");
	});

	test("should extract message from array detail", () => {
		const error = {
			detail: [
				{ msg: "First error", type: "validation" },
				{ msg: "Second error", type: "format" },
			],
		};
		expect(getErrorMessage(error)).toBe("First error");
	});

	test("should handle empty array detail", () => {
		const error = { detail: [] };
		expect(getErrorMessage(error)).toBe("Validation error");
	});

	test("should stringify object detail", () => {
		const error = { detail: { field: "name", issue: "required" } };
		expect(getErrorMessage(error)).toBe('{"field":"name","issue":"required"}');
	});

	test("should handle null detail", () => {
		const error = { detail: null as any };
		expect(getErrorMessage(error)).toBe("Unknown error occurred");
	});

	test("should handle undefined detail", () => {
		const error = { detail: undefined as any };
		expect(getErrorMessage(error)).toBe("Unknown error occurred");
	});
});

describe("Type safety and API design", () => {
	test("SafeResult should provide proper type narrowing", () => {
		// This is a compile-time test to ensure proper type narrowing
		const successResult: SafeResult<{ id: number }> = {
			success: true,
			data: { id: 1 },
		};

		const errorResult: SafeResult<{ id: number }> = {
			success: false,
			error: new RequestError("Test error"),
		};

		// Type narrowing should work correctly
		if (successResult.success) {
			expect(successResult.data.id).toBe(1);
			// successResult.error should not be accessible here
		}

		if (!errorResult.success) {
			expect(errorResult.error).toBeInstanceOf(RequestError);
			// errorResult.data should not be accessible here
		}
	});

	test("ClientConfig should properly extend FetchOptions", () => {
		// Compile-time test to ensure proper inheritance
		const config: ClientConfig = {
			apiKey: "required",
			// All these should be valid FetchOptions properties
			baseURL: "https://api.example.com",
			timeout: 5000,
			headers: { Authorization: "Bearer token" },
			query: { version: "v1" },
			retry: 3,
			retryDelay: 1000,
			onRequest: async () => {},
			onResponse: async () => {},
			onRequestError: async () => {},
			onResponseError: async () => {},
		};

		expect(config.apiKey).toBe("required");
	});

	test("All HTTP methods should have consistent signatures", () => {
		const client = createClient({ apiKey: "test" });

		// All methods should accept the same base parameters
		const request = "/test";
		const options = { headers: { Custom: "header" } };
		const body = { data: "test" };

		// These should all be valid method signatures
		expect(typeof client.get).toBe("function");
		expect(typeof client.post).toBe("function");
		expect(typeof client.put).toBe("function");
		expect(typeof client.patch).toBe("function");
		expect(typeof client.delete).toBe("function");

		expect(typeof client.safeGet).toBe("function");
		expect(typeof client.safePost).toBe("function");
		expect(typeof client.safePut).toBe("function");
		expect(typeof client.safePatch).toBe("function");
		expect(typeof client.safeDelete).toBe("function");
	});
});

describe("Client Event System", () => {
	let mockFetchInstance: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockFetchInstance = vi.fn();
		vi.mocked(ofetch.create).mockReturnValue(mockFetchInstance as any);
	});

	test("should expose on/off/once methods", () => {
		const client = createClient({ apiKey: "test-key" });

		expect(typeof client.on).toBe("function");
		expect(typeof client.off).toBe("function");
		expect(typeof client.once).toBe("function");
	});

	test("should emit error events when request fails", async () => {
		const errorHandler = vi.fn();
		const client = createClient({ apiKey: "test-key" });

		client.on("error", errorHandler);

		// Mock a failed request
		mockFetchInstance.mockRejectedValueOnce({
			data: { detail: "Not found" },
			status: 404,
			statusText: "Not Found",
		});

		await expect(client.get("/test")).rejects.toThrow();
		expect(errorHandler).toHaveBeenCalledOnce();
		expect(errorHandler.mock.calls[0][0]).toHaveProperty("status", 404);
	});

	test("should support wildcard event listener", async () => {
		const wildcardHandler = vi.fn();
		const client = createClient({ apiKey: "test-key" });

		client.on("*", wildcardHandler);

		// Mock a failed request
		mockFetchInstance.mockRejectedValueOnce({
			data: { detail: "Validation error" },
			status: 422,
		});

		await expect(client.post("/test", {})).rejects.toThrow();
		expect(wildcardHandler).toHaveBeenCalledOnce();
		expect(wildcardHandler.mock.calls[0][0]).toBe("error");
	});

	test("should remove event listener with off()", async () => {
		const errorHandler = vi.fn();
		const client = createClient({ apiKey: "test-key" });

		client.on("error", errorHandler);
		client.off("error", errorHandler);

		// Mock a failed request
		mockFetchInstance.mockRejectedValueOnce({
			data: { detail: "Not found" },
			status: 404,
		});

		await expect(client.get("/test")).rejects.toThrow();
		expect(errorHandler).not.toHaveBeenCalled();
	});

	test("should only trigger once() listener one time", async () => {
		const errorHandler = vi.fn();
		const client = createClient({ apiKey: "test-key" });

		client.once("error", errorHandler);

		// Mock two failed requests
		mockFetchInstance.mockRejectedValue({
			data: { detail: "Error" },
			status: 500,
		});

		await expect(client.get("/test1")).rejects.toThrow();
		await expect(client.get("/test2")).rejects.toThrow();

		expect(errorHandler).toHaveBeenCalledOnce();
	});

	test("should support multiple listeners", async () => {
		const handler1 = vi.fn();
		const handler2 = vi.fn();
		const client = createClient({ apiKey: "test-key" });

		client.on("error", handler1);
		client.on("error", handler2);

		// Mock a failed request
		mockFetchInstance.mockRejectedValueOnce({
			data: { detail: "Error" },
			status: 500,
		});

		await expect(client.get("/test")).rejects.toThrow();
		expect(handler1).toHaveBeenCalledOnce();
		expect(handler2).toHaveBeenCalledOnce();
	});
});
