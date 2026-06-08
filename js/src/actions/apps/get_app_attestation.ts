import { z } from "zod";
import { CertificateSchema, TcbInfoSchema } from "../cvms/get_cvm_attestation";
import { defineAction } from "../../utils/define-action";

const KmsInfoSchema = z.object({
  contract_address: z.string(),
  chain_id: z.number().nullable(),
  version: z.string(),
  url: z.string(),
  gateway_app_id: z.string().nullable(),
  gateway_app_url: z.string(),
  kms_type: z.string(),
});

const GuestAgentInfoSchema = z
  .object({
    app_id: z.string().optional(),
    instance_id: z.string().optional(),
    app_name: z.string().optional(),
    device_id: z.string().optional(),
  })
  .passthrough()
  .nullable();

export const AppAttestationInstanceSchema = z.object({
  vm_uuid: z.string().nullable().optional(),
  name: z.string().optional(),
  instance_id: z.string().nullable().optional(),
  status: z.string().optional(),
  image_version: z.string().nullable().optional(),
  quote: z.string().nullable().optional(),
  ppid: z.string().optional(),
  ppid_sha256: z.string().nullable().optional(),
  device_id: z.string().optional(),
  fmspc: z.string().nullable().optional(),
  tee_tcb_svn: z.string().nullable().optional(),
  cpusvn: z.string().nullable().optional(),
  pcesvn: z.number().nullable().optional(),
  tcb_info: TcbInfoSchema.nullable().optional(),
  app_certificates: z.array(CertificateSchema).nullable().optional(),
  compose_file: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
});

export type AppAttestationInstance = z.infer<typeof AppAttestationInstanceSchema>;

export const AppAttestationResponseSchema = z.object({
  app_id: z.string(),
  contract_address: z.string(),
  kms_info: KmsInfoSchema,
  instances: z.array(AppAttestationInstanceSchema),
  kms_guest_agent_info: GuestAgentInfoSchema,
  gateway_guest_agent_info: GuestAgentInfoSchema,
  qemu_version: z.string().nullable(),
});

export type AppAttestationResponse = z.infer<typeof AppAttestationResponseSchema>;

export const GetAppAttestationRequestSchema = z
  .object({
    appId: z.string().min(1),
  })
  .strict();

export type GetAppAttestationRequest = z.infer<typeof GetAppAttestationRequestSchema>;

const { action: getAppAttestation, safeAction: safeGetAppAttestation } = defineAction<
  GetAppAttestationRequest,
  typeof AppAttestationResponseSchema
>(AppAttestationResponseSchema, async (client, request) => {
  const { appId } = GetAppAttestationRequestSchema.parse(request);
  return await client.get(`/apps/${appId}/attestations`);
});

export { getAppAttestation, safeGetAppAttestation };
