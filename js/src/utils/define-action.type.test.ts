/**
 * Type-level tests for defineAction and defineSimpleAction
 *
 * These tests verify that the action creators correctly infer types.
 */

import { describe, it, expectTypeOf } from "vitest";
import { z } from "zod";
import { createClient, type Client } from "../client";
import { defineSimpleAction, defineAction } from "./define-action";
import type { SafeResult } from "../client";

describe("defineSimpleAction type inference", () => {
  it("should infer return type from schema", () => {
    const UserSchema = z.object({
      id: z.number(),
      name: z.string(),
    });

    const { action, safeAction } = defineSimpleAction(UserSchema, async (client) => {
      return await client.get("/user");
    });

    // action should have correct overloads
    expectTypeOf(action).toBeFunction();

    // First overload: no parameters
    expectTypeOf(action).parameters.toMatchTypeOf<[Client]>();

    // safeAction should return SafeResult
    expectTypeOf(safeAction).toBeFunction();
    expectTypeOf(safeAction).parameters.toMatchTypeOf<[Client]>();
  });

  it("should support custom schema parameter", () => {
    const UserSchema = z.object({
      id: z.number(),
      name: z.string(),
    });

    const CustomSchema = z.object({
      id: z.number(),
    });

    const { action } = defineSimpleAction(UserSchema, async (client) => {
      return await client.get("/user");
    });

    const client = createClient({ apiKey: "test" });

    // With custom schema
    expectTypeOf(action<typeof CustomSchema>(client, { schema: CustomSchema }))
      .toEqualTypeOf<Promise<{ id: number }>>();
  });

  it("should support schema: false for unknown return", () => {
    const UserSchema = z.object({
      id: z.number(),
    });

    const { action } = defineSimpleAction(UserSchema, async (client) => {
      return await client.get("/user");
    });

    const client = createClient({ apiKey: "test" });

    // With schema: false
    expectTypeOf(action(client, { schema: false }))
      .toEqualTypeOf<Promise<unknown>>();
  });
});

describe("defineAction type inference", () => {
  it("should infer parameter and return types", () => {
    const PostSchema = z.object({
      id: z.number(),
      title: z.string(),
    });

    type GetPostParams = {
      postId: number;
    };

    const { action, safeAction } = defineAction<GetPostParams, typeof PostSchema>(
      PostSchema,
      async (client, params) => {
        return await client.get(`/posts/${params.postId}`);
      }
    );

    const client = createClient({ apiKey: "test" });

    // action should require params
    expectTypeOf(action).toBeFunction();
    expectTypeOf(action).parameters.toMatchTypeOf<[Client, GetPostParams]>();

    // Return type should be inferred from schema
    expectTypeOf(action(client, { postId: 1 }))
      .toEqualTypeOf<Promise<{ id: number; title: string }>>();

    // safeAction should return SafeResult
    expectTypeOf(safeAction(client, { postId: 1 }))
      .toEqualTypeOf<Promise<SafeResult<{ id: number; title: string }>>>();
  });

  it("should support complex parameter types", () => {
    const ResultSchema = z.object({
      success: z.boolean(),
    });

    type ComplexParams = {
      filters: {
        status: string[];
        dateRange: { start: Date; end: Date };
      };
      pagination: {
        page: number;
        limit: number;
      };
    };

    const { action } = defineAction<ComplexParams, typeof ResultSchema>(
      ResultSchema,
      async (client, params) => {
        return await client.post("/search", params);
      }
    );

    const client = createClient({ apiKey: "test" });

    // Should accept complex params
    expectTypeOf(action).parameters.toMatchTypeOf<[Client, ComplexParams]>();
  });

  it("should support optional fields in params", () => {
    const Schema = z.object({
      data: z.string(),
    });

    type Params = {
      required: string;
      optional?: number;
    };

    const { action } = defineAction<Params, typeof Schema>(
      Schema,
      async (client, params) => {
        return await client.get(`/data?q=${params.required}`);
      }
    );

    const client = createClient({ apiKey: "test" });

    // Should accept params with optional fields
    expectTypeOf(action(client, { required: "test" }))
      .toEqualTypeOf<Promise<{ data: string }>>();

    expectTypeOf(action(client, { required: "test", optional: 42 }))
      .toEqualTypeOf<Promise<{ data: string }>>();
  });
});

describe("SafeResult type inference", () => {
  it("should correctly type success and error cases", () => {
    const UserSchema = z.object({
      id: z.number(),
      name: z.string(),
    });

    const { safeAction } = defineSimpleAction(UserSchema, async (client) => {
      return await client.get("/user");
    });

    const client = createClient({ apiKey: "test" });

    type ResultType = Awaited<ReturnType<typeof safeAction>>;

    // Should be a discriminated union
    expectTypeOf<ResultType>().toMatchTypeOf<
      | { success: true; data: { id: number; name: string } }
      | { success: false; error: unknown }
    >();
  });

  it("should preserve custom schema in SafeResult", () => {
    const DefaultSchema = z.object({
      id: z.number(),
      name: z.string(),
    });

    const CustomSchema = z.object({
      id: z.number(),
    });

    const { safeAction } = defineSimpleAction(DefaultSchema, async (client) => {
      return await client.get("/user");
    });

    const client = createClient({ apiKey: "test" });

    // With custom schema
    expectTypeOf(safeAction<typeof CustomSchema>(client, { schema: CustomSchema }))
      .toEqualTypeOf<Promise<SafeResult<{ id: number }>>>();
  });
});

describe("Type narrowing with extend", () => {
  it("should narrow types when using with client.extend()", () => {
    const UserSchema = z.object({
      id: z.number(),
      name: z.string(),
    });

    const { action: getUser } = defineSimpleAction(UserSchema, async (client) => {
      return await client.get("/user");
    });

    // Explicitly type the actions object
    const myActions: {
      readonly getUser: (client: Client) => Promise<z.infer<typeof UserSchema>>;
    } = {
      getUser,
    };

    const client = createClient({ apiKey: "test" }).extend(myActions);

    // Extended method should have correct type
    expectTypeOf(client.getUser).toBeFunction();
    expectTypeOf(client.getUser).parameters.toEqualTypeOf<[]>();
    expectTypeOf(client.getUser).returns.toEqualTypeOf<
      Promise<{ id: number; name: string }>
    >();
  });
});

// Additional type inference tests covering action test patterns
describe("Type inference - schema override scenarios", () => {
  it("should correctly infer type when schema: false", () => {
    const DefaultSchema = z.object({
      id: z.number(),
      name: z.string(),
    });

    const { action, safeAction } = defineSimpleAction(DefaultSchema, async (client) => {
      return await client.get("/data");
    });

    const client = createClient({ apiKey: "test" });

    // action with schema: false should return unknown
    expectTypeOf(action(client, { schema: false })).toEqualTypeOf<Promise<unknown>>();

    // safeAction with schema: false should return SafeResult<unknown>
    expectTypeOf(safeAction(client, { schema: false }))
      .toEqualTypeOf<Promise<SafeResult<unknown>>>();
  });

  it("should correctly infer type with custom schema", () => {
    const DefaultSchema = z.object({
      id: z.number(),
      name: z.string(),
      email: z.string(),
    });

    const CustomSchema = z.object({
      id: z.number(),
      custom_field: z.boolean(),
    });

    const { action, safeAction } = defineSimpleAction(DefaultSchema, async (client) => {
      return await client.get("/data");
    });

    const client = createClient({ apiKey: "test" });

    // action with custom schema should return inferred type from custom schema
    expectTypeOf(action(client, { schema: CustomSchema }))
      .toEqualTypeOf<Promise<{ id: number; custom_field: boolean }>>();

    // safeAction with custom schema should return SafeResult with custom type
    expectTypeOf(safeAction(client, { schema: CustomSchema }))
      .toEqualTypeOf<Promise<SafeResult<{ id: number; custom_field: boolean }>>>();
  });

  it("should handle complex custom schemas", () => {
    const DefaultSchema = z.object({ value: z.string() });

    const ComplexCustomSchema = z.object({
      items: z.array(z.object({ id: z.number(), name: z.string() })),
      meta: z.object({ total: z.number(), page: z.number() }),
      nested: z.object({ deep: z.object({ value: z.boolean() }) }),
    });

    const { action } = defineSimpleAction(DefaultSchema, async (client) => {
      return await client.get("/data");
    });

    const client = createClient({ apiKey: "test" });

    type ExpectedType = {
      items: { id: number; name: string }[];
      meta: { total: number; page: number };
      nested: { deep: { value: boolean } };
    };

    expectTypeOf(action(client, { schema: ComplexCustomSchema }))
      .toEqualTypeOf<Promise<ExpectedType>>();
  });
});

describe("Type inference - with parameters", () => {
  it("should preserve parameter types with default schema", () => {
    const Schema = z.object({
      app_id: z.string(),
      status: z.string(),
    });

    type Params = {
      id: string;
      filters?: { status: string };
    };

    const { action } = defineAction<Params, typeof Schema>(Schema, async (client, params) => {
      return await client.get(`/apps/${params.id}`);
    });

    const client = createClient({ apiKey: "test" });

    // Should preserve parameter types
    expectTypeOf(action).parameters.toMatchTypeOf<
      [Client, Params] | [Client, Params, { schema?: any }]
    >();

    // Return type should be from default schema
    expectTypeOf(action(client, { id: "123" }))
      .toEqualTypeOf<Promise<{ app_id: string; status: string }>>();
  });

  it("should correctly type params with schema: false", () => {
    const Schema = z.object({ value: z.string() });
    type Params = { id: number };

    const { action } = defineAction<Params, typeof Schema>(Schema, async (client, params) => {
      return await client.get(`/items/${params.id}`);
    });

    const client = createClient({ apiKey: "test" });

    // With schema: false, return type should be unknown
    expectTypeOf(action(client, { id: 123 }, { schema: false }))
      .toEqualTypeOf<Promise<unknown>>();
  });

  it("should correctly type params with custom schema", () => {
    const DefaultSchema = z.object({ value: z.string() });
    const CustomSchema = z.object({
      result: z.number(),
      items: z.array(z.string()),
    });

    type Params = { query: string };

    const { action } = defineAction<Params, typeof DefaultSchema>(
      DefaultSchema,
      async (client, params) => {
        return await client.get(`/search?q=${params.query}`);
      }
    );

    const client = createClient({ apiKey: "test" });

    // With custom schema, return type should be from custom schema
    expectTypeOf(action(client, { query: "test" }, { schema: CustomSchema }))
      .toEqualTypeOf<Promise<{ result: number; items: string[] }>>();
  });
});

describe("Type inference - safeAction return types", () => {
  it("should correctly type SafeResult with default schema", () => {
    const Schema = z.object({
      id: z.string(),
      count: z.number(),
    });

    const { safeAction } = defineSimpleAction(Schema, async (client) => {
      return await client.get("/data");
    });

    const client = createClient({ apiKey: "test" });

    type ResultType = Awaited<ReturnType<typeof safeAction>>;

    // Should be discriminated union
    expectTypeOf<ResultType>().toMatchTypeOf<
      | { success: true; data: { id: string; count: number } }
      | { success: false; error: any }
    >();
  });

  it("should correctly type SafeResult with parameters", () => {
    const Schema = z.object({
      items: z.array(z.string()),
      total: z.number(),
    });

    type Params = { page: number; limit: number };

    const { safeAction } = defineAction<Params, typeof Schema>(
      Schema,
      async (client, params) => {
        return await client.get(`/list?page=${params.page}&limit=${params.limit}`);
      }
    );

    const client = createClient({ apiKey: "test" });

    type ResultType = Awaited<ReturnType<typeof safeAction>>;

    expectTypeOf<ResultType>().toMatchTypeOf<
      | { success: true; data: { items: string[]; total: number } }
      | { success: false; error: any }
    >();
  });

  it("should handle union types in schemas", () => {
    const Schema = z.object({
      status: z.union([z.literal("active"), z.literal("inactive"), z.literal("pending")]),
      value: z.union([z.string(), z.number()]),
    });

    const { safeAction } = defineSimpleAction(Schema, async (client) => {
      return await client.get("/status");
    });

    const client = createClient({ apiKey: "test" });

    type ResultType = Awaited<ReturnType<typeof safeAction>>;

    expectTypeOf<ResultType>().toMatchTypeOf<
      | {
          success: true;
          data: {
            status: "active" | "inactive" | "pending";
            value: string | number;
          };
        }
      | { success: false; error: any }
    >();
  });
});

describe("Type inference - array and optional types", () => {
  it("should correctly handle array types", () => {
    const ItemSchema = z.object({
      id: z.string(),
      tags: z.array(z.string()),
      metadata: z.array(z.object({ key: z.string(), value: z.string() })),
    });

    const { action } = defineSimpleAction(ItemSchema, async (client) => {
      return await client.get("/item");
    });

    const client = createClient({ apiKey: "test" });

    expectTypeOf(action(client)).toEqualTypeOf<
      Promise<{
        id: string;
        tags: string[];
        metadata: { key: string, value: string }[];
      }>
    >();
  });

  it("should correctly handle optional and nullable types", () => {
    const Schema = z.object({
      required: z.string(),
      optional: z.string().optional(),
      nullable: z.string().nullable(),
      optionalNullable: z.string().optional().nullable(),
    });

    const { action } = defineSimpleAction(Schema, async (client) => {
      return await client.get("/data");
    });

    const client = createClient({ apiKey: "test" });

    expectTypeOf(action(client)).toEqualTypeOf<
      Promise<{
        required: string;
        optional?: string;
        nullable: string | null;
        optionalNullable?: string | null;
      }>
    >();
  });
});
