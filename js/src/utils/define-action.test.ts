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
