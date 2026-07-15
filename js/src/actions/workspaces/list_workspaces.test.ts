import { describe, expect, it } from "vitest";

import { WorkspaceResponseSchema } from "./list_workspaces";

const base = {
  id: "wks_abc",
  name: "Acme",
  slug: "acme",
  tier: "level_1",
  role: "owner",
  is_default: true,
  created_at: "2026-07-15T00:00:00Z",
};

describe("WorkspaceResponseSchema", () => {
  it("keeps the billing lifecycle state", () => {
    const parsed = WorkspaceResponseSchema.parse({
      ...base,
      billing_status: "abandoned",
      suspended_at: null,
    });

    expect(parsed.billing_status).toBe("abandoned");
    expect(parsed.suspended_at).toBeNull();
  });

  it("defaults billing_status to active, matching the API", () => {
    // The field has a server-side default, so a response may omit it. Parsing to
    // undefined would push that check onto every caller.
    expect(WorkspaceResponseSchema.parse(base).billing_status).toBe("active");
  });

  it("carries suspended_at when the workspace is suspended", () => {
    const parsed = WorkspaceResponseSchema.parse({
      ...base,
      billing_status: "suspended",
      suspended_at: "2026-06-15T00:00:00Z",
    });

    expect(parsed.suspended_at).toBe("2026-06-15T00:00:00Z");
  });

  it("rejects a lifecycle state the API cannot produce", () => {
    expect(() => WorkspaceResponseSchema.parse({ ...base, billing_status: "deleted" })).toThrow();
  });
});
