import { z } from "zod";

// Docker Config Schema
export const dockerConfigSchema = z.object({
	password: z.string(),
	registry: z.string().nullable(),
	username: z.string(),
});

// Compose File Schema
export const composeFileSchema = z
	.object({
		docker_compose_file: z.string(),
		docker_config: dockerConfigSchema.optional().nullable(),
		features: z.array(z.string()),
		kms_enabled: z.boolean(),
		manifest_version: z.number(),
		name: z.string(),
		public_logs: z.boolean(),
		public_sysinfo: z.boolean(),
		runner: z.string().optional(),
		salt: z.string().nullable().optional(),
		tproxy_enabled: z.boolean(),
		version: z.string().optional(),
	})
	.passthrough();

// POST request CVM Response Schema
export const postCvmResponseSchema = z.object({
	id: z.number(),
	name: z.string(),
	status: z.string(),
	teepod_id: z.number().nullable(),
	teepod: z
		.object({
			id: z.number(),
			name: z.string(),
		})
		.nullable(),
	user_id: z.number(),
	app_id: z.string(),
	vm_uuid: z.string().nullable(),
	instance_id: z.string().nullable(),
	app_url: z.string().nullable(),
	base_image: z.string(),
	vcpu: z.number(),
	memory: z.number(),
	disk_size: z.number(),
	manifest_version: z.number(),
	version: z.string().nullable(),
	runner: z.string(),
	docker_compose_file: z.string(),
	features: z.array(z.string()).nullable(),
	created_at: z.string(),
	encrypted_env_pubkey: z.string(),
});

// Encrypted Env Item Schema
export const encryptedEnvItemSchema = z.object({
	key: z.string(),
	value: z.string(),
});

// Get CVM Network Response Schema
export const getCvmNetworkResponseSchema = z.object({
	is_online: z.boolean(),
	is_public: z.boolean(),
	error: z.string().nullable(),
	internal_ip: z.string(),
	latest_handshake: z.string(),
	public_urls: z.array(
		z.object({
			app: z.string(),
			instance: z.string(),
		}),
	),
});

// Type exports
export type DockerConfig = z.infer<typeof dockerConfigSchema>;
export type ComposeFile = z.infer<typeof composeFileSchema>;
export type PostCvmResponse = z.infer<typeof postCvmResponseSchema>;
export type EncryptedEnvItem = z.infer<typeof encryptedEnvItemSchema>;
export type CvmAttestationResponse = z.infer<
	typeof cvmAttestationResponseSchema
>;
export type GetCvmNetworkResponse = z.infer<typeof getCvmNetworkResponseSchema>;
/**
 * Certificate naming information
 */
export interface CertificateNameInfo {
	common_name: string | null;
	organization: string | null;
	country: string | null;
	state?: string | null;
	locality?: string | null;
}

/**
 * Certificate data structure
 */
export interface CertificateInfo {
	subject: CertificateNameInfo;
	issuer: CertificateNameInfo;
	serial_number: string;
	not_before: string;
	not_after: string;
	version: string;
	fingerprint: string;
	signature_algorithm: string;
	sans: string | null;
	is_ca: boolean;
	position_in_chain: number;
	quote: string | null;
}

/**
 * Event log entry
 */
export interface TCBEventLogEntry {
	imr: number;
	event_type: number;
	digest: string;
	event: string;
	event_payload: string;
}

/**
 * Trusted Computing Base (TCB) information
 */
export interface TCBInfo {
	mrtd: string;
	rootfs_hash: string;
	rtmr0: string;
	rtmr1: string;
	rtmr2: string;
	rtmr3: string;
	event_log: TCBEventLogEntry[];
}

// Replicate CVM Response Schema
export const replicateCvmResponseSchema = z.object({
	id: z.number(),
	name: z.string(),
	status: z.string(),
	teepod_id: z.number(),
	teepod: z.object({
		id: z.number(),
		name: z.string(),
	}),
	user_id: z.number(),
	app_id: z.string(),
	vm_uuid: z.string(),
	instance_id: z.string().nullable(),
	app_url: z.string().nullable(),
	base_image: z.string(),
	vcpu: z.number(),
	memory: z.number(),
	disk_size: z.number(),
	manifest_version: z.number(),
	version: z.string().nullable(),
	runner: z.string(),
	docker_compose_file: z.string(),
	features: z.array(z.string()).nullable(),
	created_at: z.string(),
	encrypted_env_pubkey: z.string(),
});

export type ReplicateCvmResponse = z.infer<typeof replicateCvmResponseSchema>;

export const cvmAttestationResponseSchema = z.object({
	is_online: z.boolean(),
	is_public: z.boolean(),
	error: z.string().nullable(),
	app_certificates: z
		.array(
			z.object({
				subject: z.object({
					common_name: z.string().nullable(),
					organization: z.string().nullable(),
					country: z.string().nullable(),
					state: z.string().nullable().optional(),
					locality: z.string().nullable().optional(),
				}),
				issuer: z.object({
					common_name: z.string().nullable(),
					organization: z.string().nullable(),
					country: z.string().nullable(),
				}),
				serial_number: z.string(),
				not_before: z.string(),
				not_after: z.string(),
				version: z.string(),
				fingerprint: z.string(),
				signature_algorithm: z.string(),
				sans: z.string().nullable(),
				is_ca: z.boolean(),
				position_in_chain: z.number(),
				quote: z.string().nullable(),
			}),
		)
		.nullable(),
	tcb_info: z
		.object({
			mrtd: z.string(),
			rootfs_hash: z.string(),
			rtmr0: z.string(),
			rtmr1: z.string(),
			rtmr2: z.string(),
			rtmr3: z.string(),
			event_log: z.array(
				z.object({
					imr: z.number(),
					event_type: z.number(),
					digest: z.string(),
					event: z.string(),
					event_payload: z.string(),
				}),
			),
		})
		.nullable(),
	compose_file: z.string().nullable(),
});
// ============================================
// Legacy Types (for create/upgrade commands)
// ============================================

// Image Schema
export const imageSchema = z.object({
	name: z.string(),
	description: z.string().optional(),
	version: z.array(z.number()).optional(),
	is_dev: z.boolean().optional(),
	os_image_hash: z.string().nullable().optional(),
	rootfs_hash: z.string().optional(),
	shared_ro: z.boolean().optional(),
	cmdline: z.string().optional(),
	kernel: z.string().optional(),
	initrd: z.string().optional(),
	hda: z.string().nullable().optional(),
	rootfs: z.string().optional(),
	bios: z.string().optional(),
});

// TEEPod Schema with extended properties
export const teepodSchema = z.object({
	teepod_id: z.number().nullable(),
	id: z.number().optional(),
	name: z.string(),
	listed: z.boolean().optional(),
	resource_score: z.number().optional(),
	remaining_vcpu: z.number().optional(),
	remaining_memory: z.number().optional(),
	remaining_cvm_slots: z.number().optional(),
	images: z.array(imageSchema).optional(),
	region_identifier: z.string().optional(),
	dedicated_for_team_id: z.number().nullable().optional(),
	support_onchain_kms: z.boolean().optional(),
	fmspc: z.string().nullable().optional(),
	device_id: z.string().nullable().optional(),
});

export type TEEPod = z.infer<typeof teepodSchema>;
export type Image = z.infer<typeof imageSchema>;

// TEEPod Response Schema
export interface TeepodResponse {
	nodes: TEEPod[];
	kms_list?: KmsListItem[];
}

// KMS List Item
export interface KmsListItem {
	id?: string;
	slug?: string | null;
	url: string;
	version: string;
	chain_id?: number | null;
	kms_contract_address?: string | null;
	gateway_app_id?: string | null;
}

// Pubkey Response
export interface PubkeyResponse {
	app_env_encrypt_pubkey: string;
	app_id_salt: string;
}

// CVM Info Response (from SDK)
export interface CvmInfoResponse {
	id: number;
	name: string;
	status: string;
	app_id: string;
	vcpu: number;
	memory: number;
	disk_size: number;
	base_image: string;
	encrypted_env_pubkey: string;
	env_pubkey?: string;
}

// Upgrade Response
export interface UpgradeResponse {
	detail?: string;
	[key: string]: unknown;
}

// User Info Response
export interface UserInfoResponse {
	username: string;
	[key: string]: unknown;
}

// CVM List Response
export interface CvmListResponse {
	items: unknown[];
	[key: string]: unknown;
}

// Available Nodes Response
export interface AvailableNodesResponse {
	nodes: TEEPod[];
	kms_list?: KmsListItem[];
}

// CVM Compose Config Response
export interface CvmComposeConfigResponse {
	env_pubkey: string;
	[key: string]: unknown;
}
