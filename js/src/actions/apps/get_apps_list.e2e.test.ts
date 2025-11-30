import { describe, it, expect } from "vitest";
import { createClient } from "../../client";
import { getAppsList, safeGetAppsList } from "./get_apps_list";

describe("getAppsList e2e", () => {
  const client = createClient();

  it("should fetch apps list from real API", async () => {
    const result = await safeGetAppsList(client, { page: 1, page_size: 5 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveProperty("dstack_apps");
      expect(result.data).toHaveProperty("page");
      expect(result.data).toHaveProperty("page_size");
      expect(result.data).toHaveProperty("total");
      expect(result.data).toHaveProperty("total_pages");
      expect(Array.isArray(result.data.dstack_apps)).toBe(true);
    }
  });

  it("should return apps with correct structure", async () => {
    const result = await safeGetAppsList(client, { page: 1, page_size: 1 });

    expect(result.success).toBe(true);
    if (result.success && result.data.dstack_apps.length > 0) {
      const app = result.data.dstack_apps[0];
      expect(app).toHaveProperty("id");
      expect(app).toHaveProperty("name");
      expect(app).toHaveProperty("app_id");
      expect(app).toHaveProperty("created_at");
      expect(app).toHaveProperty("kms_type");
      expect(app).toHaveProperty("cvms");
      expect(app).toHaveProperty("cvm_count");
      expect(Array.isArray(app.cvms)).toBe(true);
    }
  });

  it("should return CVMs with correct structure within apps", async () => {
    const result = await safeGetAppsList(client, { page: 1, page_size: 5 });

    expect(result.success).toBe(true);
    if (result.success) {
      // Find an app with at least one CVM
      const appWithCvm = result.data.dstack_apps.find(
        (app) => app.cvms.length > 0
      );
      if (appWithCvm) {
        const cvm = appWithCvm.cvms[0];
        expect(cvm).toHaveProperty("vm_uuid");
        expect(cvm).toHaveProperty("app_id");
        expect(cvm).toHaveProperty("name");
        expect(cvm).toHaveProperty("status");
        expect(cvm).toHaveProperty("vcpu");
        expect(cvm).toHaveProperty("memory");
        expect(cvm).toHaveProperty("disk_size");
        expect(cvm).toHaveProperty("teepod_id");
        expect(cvm).toHaveProperty("teepod_name");
        expect(cvm).toHaveProperty("region_identifier");
        expect(cvm).toHaveProperty("instance_type");
      }
    }
  });

  it("should support pagination", async () => {
    const page1 = await safeGetAppsList(client, { page: 1, page_size: 2 });
    const page2 = await safeGetAppsList(client, { page: 2, page_size: 2 });

    expect(page1.success).toBe(true);
    expect(page2.success).toBe(true);

    if (page1.success && page2.success) {
      expect(page1.data.page).toBe(1);
      expect(page2.data.page).toBe(2);
      expect(page1.data.page_size).toBe(2);
      expect(page2.data.page_size).toBe(2);
    }
  });

  it("should return only current user's apps (not all platform apps)", async () => {
    // This test verifies that the /apps endpoint returns only the current user's apps
    // even for admin users (unlike /cvms/paginated which returns all CVMs for admins)
    const result = await safeGetAppsList(client, { page: 1, page_size: 100 });

    expect(result.success).toBe(true);
    if (result.success) {
      // For any authenticated user, total should be a reasonable number (not thousands)
      // This is a sanity check - if we're getting thousands of apps, something is wrong
      expect(result.data.total).toBeLessThan(500);
    }
  });
});
