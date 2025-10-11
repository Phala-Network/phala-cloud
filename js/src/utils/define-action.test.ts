import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { defineSimpleAction, defineAction } from "./define-action";
import { createClient } from "../client";

describe("defineSimpleAction", () => {
  it("should return action and safeAction functions", () => {
    const schema = z.object({ value: z.string() });
    const { action, safeAction } = defineSimpleAction(schema, async (client) => ({
      value: "test",
    }));

    expect(typeof action).toBe("function");
    expect(typeof safeAction).toBe("function");
  });

  it("action should parse response with default schema", async () => {
    const schema = z.object({
      username: z.string(),
      email: z.string(),
    });

    const { action } = defineSimpleAction(schema, async (client) => {
      return await client.get("/auth/me");
    });

    const client = createClient({
      apiKey: "test",
      baseURL: "https://test.com",
    });

    vi.spyOn(client, "get").mockResolvedValue({
      username: "alice",
      email: "alice@example.com",
    });

    const user = await action(client);

    expect(user.username).toBe("alice");
    expect(user.email).toBe("alice@example.com");
  });

  it("action should support custom schema", async () => {
    const defaultSchema = z.object({
      username: z.string(),
      email: z.string(),
    });

    const { action } = defineSimpleAction(defaultSchema, async (client) => {
      return await client.get("/auth/me");
    });

    const client = createClient({
      apiKey: "test",
      baseURL: "https://test.com",
    });

    vi.spyOn(client, "get").mockResolvedValue({
      id: "123",
      username: "alice",
      email: "alice@example.com",
    });

    const customSchema = z.object({ id: z.string() });
    const result = await action(client, { schema: customSchema });

    expect(result.id).toBe("123");
    // Type should only have id property
    expect(result).toEqual({ id: "123" });
  });

  it("action should support schema: false", async () => {
    const defaultSchema = z.object({
      username: z.string(),
    });

    const { action } = defineSimpleAction(defaultSchema, async (client) => {
      return await client.get("/auth/me");
    });

    const client = createClient({
      apiKey: "test",
      baseURL: "https://test.com",
    });

    const rawResponse = { username: "alice", extra: "data" };
    vi.spyOn(client, "get").mockResolvedValue(rawResponse);

    const result = await action(client, { schema: false });

    expect(result).toEqual(rawResponse);
  });

  it("safeAction should return SafeResult on success", async () => {
    const schema = z.object({
      username: z.string(),
    });

    const { safeAction } = defineSimpleAction(schema, async (client) => {
      return await client.get("/auth/me");
    });

    const client = createClient({
      apiKey: "test",
      baseURL: "https://test.com",
    });

    vi.spyOn(client, "get").mockResolvedValue({
      username: "alice",
    });

    const result = await safeAction(client);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.username).toBe("alice");
    }
  });

  it("safeAction should return SafeResult on error", async () => {
    const schema = z.object({
      username: z.string(),
    });

    const { safeAction } = defineSimpleAction(schema, async (client) => {
      throw new Error("Network error");
    });

    const client = createClient({
      apiKey: "test",
      baseURL: "https://test.com",
    });

    const result = await safeAction(client);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe("Network error");
    }
  });
});

describe("defineAction", () => {
  it("should handle parameters correctly", async () => {
    const schema = z.object({
      app_id: z.string(),
      name: z.string(),
    });

    type GetCvmParams = {
      cvmId: string;
    };

    const { action } = defineAction<GetCvmParams, typeof schema>(schema, async (client, params) => {
      return await client.get(`/cvms/${params.cvmId}`);
    });

    const client = createClient({
      apiKey: "test",
      baseURL: "https://test.com",
    });

    vi.spyOn(client, "get").mockResolvedValue({
      app_id: "app-123",
      name: "My App",
    });

    const cvm = await action(client, { cvmId: "cvm-123" });

    expect(cvm.app_id).toBe("app-123");
    expect(cvm.name).toBe("My App");
  });

  it("should support custom schema with parameters", async () => {
    const defaultSchema = z.object({
      app_id: z.string(),
      name: z.string(),
    });

    type Params = { cvmId: string };

    const { action } = defineAction<Params, typeof defaultSchema>(
      defaultSchema,
      async (client, params) => {
        return await client.get(`/cvms/${params.cvmId}`);
      },
    );

    const client = createClient({
      apiKey: "test",
      baseURL: "https://test.com",
    });

    vi.spyOn(client, "get").mockResolvedValue({
      id: "123",
      app_id: "app-123",
      name: "My App",
    });

    const customSchema = z.object({ id: z.string(), name: z.string() });
    const result = await action(client, { cvmId: "cvm-123" }, { schema: customSchema });

    expect(result.id).toBe("123");
    expect(result.name).toBe("My App");
  });

  it("safeAction with parameters should work", async () => {
    const schema = z.object({
      app_id: z.string(),
    });

    type Params = { cvmId: string };

    const { safeAction } = defineAction<Params, typeof schema>(schema, async (client, params) => {
      return await client.get(`/cvms/${params.cvmId}`);
    });

    const client = createClient({
      apiKey: "test",
      baseURL: "https://test.com",
    });

    vi.spyOn(client, "get").mockResolvedValue({
      app_id: "app-123",
    });

    const result = await safeAction(client, { cvmId: "cvm-123" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.app_id).toBe("app-123");
    }
  });
});

// Common functionality tests that apply to all actions
describe("defineAction - schema validation (common for all actions)", () => {
  it("action should throw on invalid response data", async () => {
    const schema = z.object({
      id: z.string(),
      count: z.number(),
    });

    const { action } = defineSimpleAction(schema, async (client) => {
      return await client.get("/data");
    });

    const client = createClient({
      apiKey: "test",
      baseURL: "https://test.com",
    });

    vi.spyOn(client, "get").mockResolvedValue({
      id: 123, // should be string
      count: "invalid", // should be number
    });

    await expect(action(client)).rejects.toThrow();
  });

  it("safeAction should return validation error on invalid response", async () => {
    const schema = z.object({
      id: z.string(),
      count: z.number(),
    });

    const { safeAction } = defineSimpleAction(schema, async (client) => {
      return await client.get("/data");
    });

    const client = createClient({
      apiKey: "test",
      baseURL: "https://test.com",
    });

    vi.spyOn(client, "get").mockResolvedValue({
      id: 123, // should be string
      count: "invalid", // should be number
    });

    const result = await safeAction(client);

    expect(result.success).toBe(false);
    if (!result.success) {
      if (!("isRequestError" in result.error)) {
        expect(result.error.issues).toBeDefined();
        expect(Array.isArray(result.error.issues)).toBe(true);
      }
    }
  });

  it("action should throw when custom schema validation fails", async () => {
    const defaultSchema = z.object({ value: z.string() });
    const { action } = defineSimpleAction(defaultSchema, async (client) => {
      return await client.get("/data");
    });

    const client = createClient({
      apiKey: "test",
      baseURL: "https://test.com",
    });

    vi.spyOn(client, "get").mockResolvedValue({
      required_field: 123,
    });

    const customSchema = z.object({
      required_field: z.string(), // expects string, gets number
    });

    await expect(action(client, { schema: customSchema })).rejects.toThrow();
  });

  it("safeAction should return error when custom schema validation fails", async () => {
    const defaultSchema = z.object({ value: z.string() });
    const { safeAction } = defineSimpleAction(defaultSchema, async (client) => {
      return await client.get("/data");
    });

    const client = createClient({
      apiKey: "test",
      baseURL: "https://test.com",
    });

    vi.spyOn(client, "get").mockResolvedValue({
      required_field: 123,
    });

    const customSchema = z.object({
      required_field: z.string(),
    });

    const result = await safeAction(client, { schema: customSchema });

    expect(result.success).toBe(false);
    if (!result.success) {
      if (!("isRequestError" in result.error)) {
        expect(result.error.issues).toBeDefined();
      }
    }
  });
});

describe("defineAction - error handling (common for all actions)", () => {
  it("action should throw HTTP errors", async () => {
    const schema = z.object({ value: z.string() });
    const { action } = defineSimpleAction(schema, async (client) => {
      return await client.get("/data");
    });

    const client = createClient({
      apiKey: "test",
      baseURL: "https://test.com",
    });

    const error = new Error("Not found");
    (error as any).isRequestError = true;
    (error as any).status = 404;
    vi.spyOn(client, "get").mockRejectedValue(error);

    await expect(action(client)).rejects.toThrow("Not found");
  });

  it("safeAction should return HTTP errors with isRequestError", async () => {
    const schema = z.object({ value: z.string() });
    const { safeAction } = defineSimpleAction(schema, async (client) => {
      return await client.get("/data");
    });

    const client = createClient({
      apiKey: "test",
      baseURL: "https://test.com",
    });

    const error = new Error("Service unavailable");
    (error as any).isRequestError = true;
    (error as any).status = 503;
    vi.spyOn(client, "get").mockRejectedValue(error);

    const result = await safeAction(client);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe("Service unavailable");
      if ("isRequestError" in result.error) {
        expect(result.error.isRequestError).toBe(true);
        expect(result.error.status).toBe(503);
      }
    }
  });

  it("safeAction should preserve ZodError with issues field", async () => {
    const schema = z.object({
      email: z.string().email(),
      age: z.number().min(0),
    });

    const { safeAction } = defineSimpleAction(schema, async (client) => {
      return await client.get("/data");
    });

    const client = createClient({
      apiKey: "test",
      baseURL: "https://test.com",
    });

    vi.spyOn(client, "get").mockResolvedValue({
      email: "invalid-email",
      age: -1,
    });

    const result = await safeAction(client);

    expect(result.success).toBe(false);
    if (!result.success) {
      if (!("isRequestError" in result.error)) {
        expect(result.error.issues).toBeDefined();
        expect(Array.isArray(result.error.issues)).toBe(true);
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("defineAction - schema override (common for all actions)", () => {
  it("action with schema: false should return raw response", async () => {
    const defaultSchema = z.object({ value: z.string() });
    const { action } = defineSimpleAction(defaultSchema, async (client) => {
      return await client.get("/data");
    });

    const client = createClient({
      apiKey: "test",
      baseURL: "https://test.com",
    });

    const rawResponse = {
      value: "test",
      extra_field: 123,
      nested: { data: "should be preserved" },
    };
    vi.spyOn(client, "get").mockResolvedValue(rawResponse);

    const result = await action(client, { schema: false });

    expect(result).toEqual(rawResponse);
  });

  it("safeAction with schema: false should return raw response", async () => {
    const defaultSchema = z.object({ value: z.string() });
    const { safeAction } = defineSimpleAction(defaultSchema, async (client) => {
      return await client.get("/data");
    });

    const client = createClient({
      apiKey: "test",
      baseURL: "https://test.com",
    });

    const rawResponse = { any: "data", works: true };
    vi.spyOn(client, "get").mockResolvedValue(rawResponse);

    const result = await safeAction(client, { schema: false });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(rawResponse);
    }
  });

  it("action with custom schema should use custom validation", async () => {
    const defaultSchema = z.object({ value: z.string() });
    const { action } = defineSimpleAction(defaultSchema, async (client) => {
      return await client.get("/data");
    });

    const client = createClient({
      apiKey: "test",
      baseURL: "https://test.com",
    });

    vi.spyOn(client, "get").mockResolvedValue({
      id: "123",
      name: "Test",
      ignored_field: "will be ignored",
    });

    const customSchema = z.object({
      id: z.string(),
      name: z.string(),
    });

    const result = await action(client, { schema: customSchema });

    expect(result).toEqual({ id: "123", name: "Test" });
  });

  it("safeAction with custom schema should use custom validation", async () => {
    const defaultSchema = z.object({ value: z.string() });
    const { safeAction } = defineSimpleAction(defaultSchema, async (client) => {
      return await client.get("/data");
    });

    const client = createClient({
      apiKey: "test",
      baseURL: "https://test.com",
    });

    vi.spyOn(client, "get").mockResolvedValue({
      count: 42,
      items: ["a", "b"],
    });

    const customSchema = z.object({
      count: z.number(),
      items: z.array(z.string()),
    });

    const result = await safeAction(client, { schema: customSchema });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.count).toBe(42);
      expect(result.data.items).toEqual(["a", "b"]);
    }
  });
});

describe("defineAction - with parameters - common patterns", () => {
  it("action with params should throw on validation error", async () => {
    const schema = z.object({ result: z.string() });
    type Params = { id: string };

    const { action } = defineAction<Params, typeof schema>(schema, async (client, params) => {
      return await client.get(`/items/${params.id}`);
    });

    const client = createClient({
      apiKey: "test",
      baseURL: "https://test.com",
    });

    vi.spyOn(client, "get").mockResolvedValue({
      result: 123, // should be string
    });

    await expect(action(client, { id: "test-id" })).rejects.toThrow();
  });

  it("safeAction with params should return validation error", async () => {
    const schema = z.object({ result: z.string() });
    type Params = { id: string };

    const { safeAction } = defineAction<Params, typeof schema>(schema, async (client, params) => {
      return await client.get(`/items/${params.id}`);
    });

    const client = createClient({
      apiKey: "test",
      baseURL: "https://test.com",
    });

    vi.spyOn(client, "get").mockResolvedValue({
      result: 123,
    });

    const result = await safeAction(client, { id: "test-id" });

    expect(result.success).toBe(false);
    if (!result.success) {
      if (!("isRequestError" in result.error)) {
        expect(result.error.issues).toBeDefined();
      }
    }
  });

  it("action with params and schema: false should return raw", async () => {
    const schema = z.object({ result: z.string() });
    type Params = { id: string };

    const { action } = defineAction<Params, typeof schema>(schema, async (client, params) => {
      return await client.get(`/items/${params.id}`);
    });

    const client = createClient({
      apiKey: "test",
      baseURL: "https://test.com",
    });

    const rawResponse = { anything: "goes", here: 123 };
    vi.spyOn(client, "get").mockResolvedValue(rawResponse);

    const result = await action(client, { id: "test-id" }, { schema: false });

    expect(result).toEqual(rawResponse);
  });

  it("safeAction with params and custom schema should work", async () => {
    const defaultSchema = z.object({ value: z.string() });
    type Params = { id: string };

    const { safeAction } = defineAction<Params, typeof defaultSchema>(
      defaultSchema,
      async (client, params) => {
        return await client.get(`/items/${params.id}`);
      },
    );

    const client = createClient({
      apiKey: "test",
      baseURL: "https://test.com",
    });

    vi.spyOn(client, "get").mockResolvedValue({
      custom_id: "123",
      custom_name: "Test",
    });

    const customSchema = z.object({
      custom_id: z.string(),
      custom_name: z.string(),
    });

    const result = await safeAction(client, { id: "test" }, { schema: customSchema });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.custom_id).toBe("123");
      expect(result.data.custom_name).toBe("Test");
    }
  });
});
