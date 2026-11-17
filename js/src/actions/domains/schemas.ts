import { z } from "zod";

/** A DNS record the owner of a domain has to publish. */
export const ExpectedDnsRecordSchema = z.object({
  record_type: z.string(),
  query_name: z.string(),
  expected_value: z.string(),
});

export type ExpectedDnsRecord = z.infer<typeof ExpectedDnsRecordSchema>;

export const RoutingStatusSchema = z.enum(["ok", "fail", "skipped"]);

export type RoutingStatus = z.infer<typeof RoutingStatusSchema>;

/** A custom domain bound to an app. */
export const AppDomainSchema = z.object({
  id: z.string(),
  domain: z.string(),
  port: z.number().int(),
  dns_verified_at: z.string().nullable().optional(),
  dns_error: z.string().nullable().optional(),
  routing_status: RoutingStatusSchema.nullable().optional(),
  routing_checked_at: z.string().nullable().optional(),
  dns_zone: z.string().nullable().optional(),
  dns_provider: z.string().nullable().optional(),
  created_at: z.string(),
  expected_records: z.array(ExpectedDnsRecordSchema).default([]),
});

export type AppDomain = z.infer<typeof AppDomainSchema>;

/** A domain in the workspace-wide list; one item per (domain, app) binding. */
export const WorkspaceDomainSchema = AppDomainSchema.extend({
  app_id: z.string(),
  app_name: z.string().nullable().optional(),
});

export type WorkspaceDomain = z.infer<typeof WorkspaceDomainSchema>;

/** Result of checking one expected DNS record against live DNS. */
export const DnsRecordCheckSchema = z.object({
  record_type: z.string(),
  query_name: z.string(),
  expected_value: z.string(),
  actual_value: z.string().nullable().optional(),
  is_valid: z.boolean(),
  warning_message: z.string().nullable().optional(),
});

export type DnsRecordCheck = z.infer<typeof DnsRecordCheckSchema>;

/** Gateway nodes the change was pushed to, and any problems on the way. */
export const DomainSyncSchema = z.object({
  nodes: z.array(z.unknown()).default([]),
  warnings: z.array(z.unknown()).default([]),
});

export type DomainSync = z.infer<typeof DomainSyncSchema>;

/** Port the domain is served on over HTTPS. */
export const DomainPortSchema = z.number().int().min(1).max(65535);

export const AppIdSchema = z.string().min(1);
export const DomainIdSchema = z.string().min(1);
