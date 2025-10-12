/**
 * Type-level tests for client.extend()
 *
 * These tests verify that TypeScript correctly infers types at compile time.
 * If types are wrong, this file will fail to compile.
 */

import { describe, it, expectTypeOf } from "vitest";
import { z } from "zod";
import { createClient, type Client } from "./client";
import { defineSimpleAction, defineAction } from "./utils/define-action";
import { getCurrentUser, type CurrentUser } from "./actions/get_current_user";
import { getCvmList, type GetCvmListResponse } from "./actions/get_cvm_list";

describe("client.extend() type inference", () => {
  it("should correctly infer action types", () => {
    const testActions: {
      readonly getCurrentUser: (client: Client) => Promise<CurrentUser>;
      readonly getCvmList: (client: Client) => Promise<GetCvmListResponse>;
     } = {
      getCurrentUser,
      getCvmList,
    };

    const client = createClient({ apiKey: "test" }).extend(testActions);

    // getCurrentUser should return Promise<CurrentUser>
    expectTypeOf(client.getCurrentUser).toBeFunction();
    expectTypeOf(client.getCurrentUser).parameters.toEqualTypeOf<[]>();
    expectTypeOf(client.getCurrentUser).returns.toEqualTypeOf<Promise<CurrentUser>>();
  });

  it("should correctly infer defineSimpleAction types", () => {
    const UserSchema = z.object({
      id: z.number(),
      name: z.string(),
      email: z.string(),
    });

    const { action: getUser } = defineSimpleAction(UserSchema, async (client) => {
      return await client.get("/user");
    });

    const myActions: {
      readonly getUser: (client: Client) => Promise<z.infer<typeof UserSchema>>;
    } = {
      getUser,
    };

    const client = createClient({ apiKey: "test" }).extend(myActions);

    // getUser should return Promise<{ id: number; name: string; email: string }>
    expectTypeOf(client.getUser).toBeFunction();
    expectTypeOf(client.getUser).parameters.toEqualTypeOf<[]>();
    expectTypeOf(client.getUser).returns.toEqualTypeOf<
      Promise<{ id: number; name: string; email: string }>
    >();
  });

  it("should correctly infer defineAction with parameters", () => {
    const PostSchema = z.object({
      id: z.number(),
      title: z.string(),
      content: z.string(),
    });

    type GetPostParams = {
      postId: number;
    };

    const { action: getPost } = defineAction<GetPostParams, typeof PostSchema>(
      PostSchema,
      async (client, params) => {
        return await client.get(`/posts/${params.postId}`);
      }
    );

    const myActions: {
      readonly getPost: (
        client: Client,
        params: GetPostParams
      ) => Promise<z.infer<typeof PostSchema>>;
    } = {
      getPost,
    };

    const client = createClient({ apiKey: "test" }).extend(myActions);

    // getPost should accept GetPostParams and return Promise<Post>
    expectTypeOf(client.getPost).toBeFunction();
    expectTypeOf(client.getPost).parameters.toEqualTypeOf<[GetPostParams]>();
    expectTypeOf(client.getPost).returns.toEqualTypeOf<
      Promise<{ id: number; title: string; content: string }>
    >();
  });

  it("should support chaining multiple extensions", () => {
    const actions1 = {
      action1: (client: Client) => "result1" as const,
    };

    const actions2 = {
      action2: (client: Client) => 42 as const,
    };

    const client = createClient({ apiKey: "test" })
      .extend(actions1)
      .extend(actions2);

    // Both actions should be available with correct types
    expectTypeOf(client.action1).toBeFunction();
    expectTypeOf(client.action1).returns.toEqualTypeOf<"result1">();

    expectTypeOf(client.action2).toBeFunction();
    expectTypeOf(client.action2).returns.toEqualTypeOf<42>();
  });

  it("should handle actions with optional parameters", () => {
    const SearchSchema = z.object({
      results: z.array(z.string()),
    });

    type SearchParams = {
      query: string;
      limit?: number;
    };

    const { action: search } = defineAction<SearchParams, typeof SearchSchema>(
      SearchSchema,
      async (client, params) => {
        return await client.get(`/search?q=${params.query}&limit=${params.limit || 10}`);
      }
    );

    const myActions: {
      readonly search: (
        client: Client,
        params: SearchParams
      ) => Promise<z.infer<typeof SearchSchema>>;
    } = {
      search,
    };

    const client = createClient({ apiKey: "test" }).extend(myActions);

    // search should accept SearchParams with optional limit
    expectTypeOf(client.search).toBeFunction();
    expectTypeOf(client.search).parameters.toEqualTypeOf<[SearchParams]>();
    expectTypeOf(client.search).returns.toEqualTypeOf<
      Promise<{ results: string[] }>
    >();
  });

  it("should preserve base client methods", () => {
    const testActions = {
      getCurrentUser,
    };

    const client = createClient({ apiKey: "test" }).extend(testActions);

    // Base client methods should still be available
    expectTypeOf(client.get).toBeFunction();
    expectTypeOf(client.post).toBeFunction();
    expectTypeOf(client.put).toBeFunction();
    expectTypeOf(client.delete).toBeFunction();
    expectTypeOf(client.safeGet).toBeFunction();
    expectTypeOf(client.safePost).toBeFunction();
  });

  it("should handle actions returning void", () => {
    const actions = {
      doSomething: (client: Client) => Promise.resolve(),
    };

    const client = createClient({ apiKey: "test" }).extend(actions);

    expectTypeOf(client.doSomething).toBeFunction();
    expectTypeOf(client.doSomething).returns.toEqualTypeOf<Promise<void>>();
  });

  it("should handle actions with multiple parameters", () => {
    const actions = {
      updateUser: (client: Client, userId: number, data: { name: string }) =>
        Promise.resolve({ id: userId, ...data }),
    };

    const client = createClient({ apiKey: "test" }).extend(actions);

    expectTypeOf(client.updateUser).toBeFunction();
    expectTypeOf(client.updateUser).parameters.toEqualTypeOf<
      [number, { name: string }]
    >();
    expectTypeOf(client.updateUser).returns.toEqualTypeOf<
      Promise<{ id: number; name: string }>
    >();
  });
});
