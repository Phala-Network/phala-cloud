// API URLs, CLOUD_API_URL now deprecated, use sdk instead
export const CLOUD_URL = process.env.CLOUD_URL || "https://cloud.phala.com";

// CLI Version
export const CLI_VERSION = "0.0.1";

// TEE Simulator
export const TEE_SIMULATOR = "phalanetwork/tappd-simulator:latest";

// Default resource configurations
export const DEFAULT_VCPU = 1;
export const DEFAULT_MEMORY = 2048; // MB
export const DEFAULT_DISK_SIZE = 40; // GB

// Default TEEPod Image
export const DEFAULT_IMAGE = "dstack-0.3.6";
