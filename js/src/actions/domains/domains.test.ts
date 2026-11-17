import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "../../client";
import { listDomains, safeListDomains } from "./list_domains";
import { listAppDomains } from "./list_app_domains";
import { getAppDomainGuide } from "./get_app_domain_guide";
import { preflightAppDomain, safePreflightAppDomain } from "./preflight_app_domain";
import { createAppDomain } from "./create_app_domain";
import { verifyAppDomain } from "./verify_app_domain";
import { deleteAppDomain } from "./delete_app_domain";
import { mergeAppDomainIngress } from "./merge_app_domain_ingress";

const APP_ID = "50b0e827cc6c53f4010b57e588a18c5ef9388cc1";

const domainFields = {
  id: "dom_abc",
  domain: "app.example.com",
  port: 443,
  dns_verified_at: null,
  dns_error: "CNAME not found",
  routing_status: null,
  routing_checked_at: null,
  dns_zone: "example.com",
  dns_provider: "cloudflare",
  created_at: "2026-11-01T00:00:00Z",
  expected_records: [
    {
      record_type: "CNAME",
      query_name: "app.example.com",
      expected_value: "gateway.dstack-pha-prod5.phala.network",
    },
  ],
};

const sync = { nodes: [], warnings: [] };

describe("domain actions", () => {
  let client: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockClient: Client;

  beforeEach(() => {
    client = { get: vi.fn(), post: vi.fn(), delete: vi.fn() };
    mockClient = client as unknown as Client;
  });

  describe("listDomains", () => {
    const page = {
      items: [{ ...domainFields, app_id: APP_ID, app_name: "demo" }],
      page: 1,
      page_size: 20,
      total: 1,
      total_pages: 1,
    };

    it("sends filters as query params to GET /domains", async () => {
      client.get.mockResolvedValue(page);
      const result = await listDomains(mockClient, {
        page: 1,
        page_size: 20,
        app_id: APP_ID,
        domain: "app.example.com",
      });
      expect(client.get).toHaveBeenCalledWith("/domains", {
        params: { page: 1, page_size: 20, app_id: APP_ID, domain: "app.example.com" },
      });
      expect(result.items[0]?.app_name).toBe("demo");
    });

    it("works without a request", async () => {
      client.get.mockResolvedValue(page);
      await listDomains(mockClient);
      expect(client.get).toHaveBeenCalledWith("/domains", { params: {} });
    });

    it("rejects a page size above 100", async () => {
      await expect(listDomains(mockClient, { page_size: 101 })).rejects.toThrow();
      expect(client.get).not.toHaveBeenCalled();
    });

    it("safe variant reports a malformed response", async () => {
      client.get.mockResolvedValue({ items: "nope" });
      const result = await safeListDomains(mockClient);
      expect(result.success).toBe(false);
    });
  });

  it("listAppDomains calls GET /apps/{id}/domains", async () => {
    client.get.mockResolvedValue({ items: [domainFields] });
    const result = await listAppDomains(mockClient, { appId: APP_ID });
    expect(client.get).toHaveBeenCalledWith(`/apps/${APP_ID}/domains`);
    expect(result.items[0]?.expected_records[0]?.record_type).toBe("CNAME");
  });

  it("getAppDomainGuide calls GET /apps/{id}/domains/guide", async () => {
    client.get.mockResolvedValue({
      gateway_domain_suffix: "dstack-pha-prod5.phala.network",
      app_id: APP_ID,
      txt_required: true,
      ingress_configured: false,
    });
    const guide = await getAppDomainGuide(mockClient, { appId: APP_ID });
    expect(client.get).toHaveBeenCalledWith(`/apps/${APP_ID}/domains/guide`);
    expect(guide.txt_required).toBe(true);
  });

  describe("preflightAppDomain", () => {
    const response = {
      domain: "app.example.com",
      port: 443,
      is_valid: false,
      records: [
        {
          record_type: "CNAME",
          query_name: "app.example.com",
          expected_value: "gateway.example.net",
          actual_value: null,
          is_valid: false,
          warning_message: null,
        },
      ],
    };

    it("posts the body without the app id", async () => {
      client.post.mockResolvedValue(response);
      const result = await preflightAppDomain(mockClient, {
        appId: APP_ID,
        domain: "app.example.com",
        port: 443,
      });
      expect(client.post).toHaveBeenCalledWith(`/apps/${APP_ID}/domains/preflight`, {
        domain: "app.example.com",
        port: 443,
      });
      expect(result.is_valid).toBe(false);
    });

    it("rejects an out-of-range port", async () => {
      const result = await safePreflightAppDomain(mockClient, {
        appId: APP_ID,
        domain: "app.example.com",
        port: 70000,
      });
      expect(result.success).toBe(false);
      expect(client.post).not.toHaveBeenCalled();
    });

    it("surfaces an API failure through the safe variant", async () => {
      client.post.mockRejectedValue(Object.assign(new Error("slow down"), { status: 429 }));
      const result = await safePreflightAppDomain(mockClient, {
        appId: APP_ID,
        domain: "app.example.com",
        port: 443,
      });
      expect(result.success).toBe(false);
      if (!result.success) expect((result.error as { status?: number }).status).toBe(429);
    });
  });

  it("createAppDomain posts to /apps/{id}/domains", async () => {
    client.post.mockResolvedValue({ ...domainFields, sync });
    const result = await createAppDomain(mockClient, {
      appId: APP_ID,
      domain: "app.example.com",
      port: 8443,
      turnstile_token: "tok",
    });
    expect(client.post).toHaveBeenCalledWith(`/apps/${APP_ID}/domains`, {
      domain: "app.example.com",
      port: 8443,
      turnstile_token: "tok",
    });
    expect(result.sync.warnings).toEqual([]);
  });

  it("verifyAppDomain posts to the verify path", async () => {
    client.post.mockResolvedValue({ ...domainFields, records: [] });
    const result = await verifyAppDomain(mockClient, { appId: APP_ID, domainId: "dom_abc" });
    expect(client.post).toHaveBeenCalledWith(`/apps/${APP_ID}/domains/dom_abc/verify`, {});
    expect(result.records).toEqual([]);
  });

  it("deleteAppDomain calls DELETE on the domain path", async () => {
    client.delete.mockResolvedValue({ ...domainFields, sync });
    const result = await deleteAppDomain(mockClient, { appId: APP_ID, domainId: "dom_abc" });
    expect(client.delete).toHaveBeenCalledWith(`/apps/${APP_ID}/domains/dom_abc`);
    expect(result.id).toBe("dom_abc");
  });

  describe("mergeAppDomainIngress", () => {
    it("posts the compose text and parses the merge result", async () => {
      client.post.mockResolvedValue({
        docker_compose_file: "services: {}",
        already_configured: false,
        required_env_keys: ["CLOUDFLARE_API_TOKEN"],
        warnings: [],
        ingress_service_name: "dstack-ingress",
        ingress_service: { image: "dstacktee/dstack-ingress" },
        top_level_volumes: { "cert-data": {} },
      });
      const result = await mergeAppDomainIngress(mockClient, {
        appId: APP_ID,
        domain: "app.example.com",
        port: 443,
        dns_provider: "cloudflare",
        docker_compose_file: "services: {}",
      });
      expect(client.post).toHaveBeenCalledWith(`/apps/${APP_ID}/domains/ingress-merge`, {
        domain: "app.example.com",
        port: 443,
        dns_provider: "cloudflare",
        docker_compose_file: "services: {}",
      });
      expect(result.required_env_keys).toEqual(["CLOUDFLARE_API_TOKEN"]);
      expect(result.ingress_service_name).toBe("dstack-ingress");
    });

    it("accepts an already-configured result without a service", async () => {
      client.post.mockResolvedValue({
        docker_compose_file: "x",
        already_configured: true,
        required_env_keys: [],
        warnings: [],
        ingress_service_name: null,
        ingress_service: null,
        top_level_volumes: {},
      });
      const result = await mergeAppDomainIngress(mockClient, {
        appId: APP_ID,
        domain: "app.example.com",
        port: 443,
      });
      expect(result.already_configured).toBe(true);
    });
  });
});
