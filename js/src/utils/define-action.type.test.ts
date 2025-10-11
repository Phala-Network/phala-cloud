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
