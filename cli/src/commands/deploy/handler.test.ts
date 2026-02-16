/**
 * Deploy Handler Tests
 *
 * Tests for the buildProvisionPayload function to ensure
 * proper handling of --dev-os / --no-dev-os flags.
 */

import { describe, test, expect } from "bun:test";
import { buildProvisionPayload } from "./handler";

describe("buildProvisionPayload", () => {
	const defaultName = "test-cvm";
	const defaultDockerCompose =
		"version: '3'\nservices:\n  app:\n    image: nginx";
	const defaultEnvs = [{ key: "NODE_ENV", value: "production" }];
	const defaultPrivacySettings = {
		publicLogs: true,
		publicSysinfo: true,
		listed: false,
	};

	describe("prefer_dev flag handling (--dev-os / --no-dev-os)", () => {
		test("should set prefer_dev to true when devOs is true (--dev-os)", () => {
			const options = {
				devOs: true,
			};

			const payload = buildProvisionPayload(
				options,
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
			);

			expect(payload.prefer_dev).toBe(true);
		});

		test("should set prefer_dev to false when devOs is false (--no-dev-os)", () => {
			const options = {
				devOs: false,
			};

			const payload = buildProvisionPayload(
				options,
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
			);

			expect(payload.prefer_dev).toBe(false);
		});

		test("should not include prefer_dev when devOs is undefined", () => {
			const options = {};

			const payload = buildProvisionPayload(
				options,
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
			);

			expect("prefer_dev" in payload).toBe(false);
		});
	});

	describe("basic payload structure", () => {
		test("should include name and compose_file in payload", () => {
			const options = {};

			const payload = buildProvisionPayload(
				options,
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
			);

			expect(payload.name).toBe(defaultName);
			expect(payload.compose_file).toBeDefined();
			expect(
				(payload.compose_file as Record<string, unknown>).docker_compose_file,
			).toBe(defaultDockerCompose);
			expect(
				(payload.compose_file as Record<string, unknown>).allowed_envs,
			).toEqual(["NODE_ENV"]);
		});

		test("should include optional fields when specified", () => {
			const options = {
				instanceType: "tdx.small",
				vcpu: "2",
				memory: "4G",
				diskSize: "50G",
				nodeId: "123",
				region: "us-west",
				image: "dstack-dev-0.5.0",
				kmsId: "phala",
				devOs: true,
			};

			const payload = buildProvisionPayload(
				options,
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
			);

			expect(payload.instance_type).toBe("tdx.small");
			expect(payload.vcpu).toBe(2);
			expect(payload.memory).toBe(4096); // 4G = 4096MB
			expect(payload.disk_size).toBe(50); // 50G = 50GB
			expect(payload.teepod_id).toBe(123);
			expect(payload.region).toBe("us-west");
			expect(payload.image).toBe("dstack-dev-0.5.0");
			expect(payload.kms_id).toBe("phala");
			expect(payload.prefer_dev).toBe(true);
		});

		test("should default kms to PHALA when not specified", () => {
			const options = {};

			const payload = buildProvisionPayload(
				options,
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
			);

			expect(payload.kms).toBe("PHALA");
		});

		test("should set kms to PHALA when kms is 'phala'", () => {
			const options = {
				kms: "phala",
			};

			const payload = buildProvisionPayload(
				options,
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
			);

			expect(payload.kms).toBe("PHALA");
		});

		test("should set kms to ETHEREUM when kms is 'ethereum'", () => {
			const options = {
				kms: "ethereum",
			};

			const payload = buildProvisionPayload(
				options,
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
			);

			expect(payload.kms).toBe("ETHEREUM");
		});

		test("should set kms to ETHEREUM when kms is 'eth' (alias)", () => {
			const options = {
				kms: "eth",
			};

			const payload = buildProvisionPayload(
				options,
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
			);

			expect(payload.kms).toBe("ETHEREUM");
		});

		test("should set kms to BASE when kms is 'base'", () => {
			const options = {
				kms: "base",
			};

			const payload = buildProvisionPayload(
				options,
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
			);

			expect(payload.kms).toBe("BASE");
		});

		test("should use preResolvedKmsSelection when provided", () => {
			const options = {
				kms: "ethereum", // This would normally set kms to "ETHEREUM"
			};

			// Pass a pre-resolved selection that overrides the options
			const payload = buildProvisionPayload(
				options,
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
				{ kmsType: "BASE", deprecatedKmsId: undefined }, // Override to "BASE"
			);

			expect(payload.kms).toBe("BASE");
		});

		test("should include deprecatedKmsId when provided via preResolvedKmsSelection", () => {
			const options = {};

			const payload = buildProvisionPayload(
				options,
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
				{ kmsType: "PHALA", deprecatedKmsId: "custom-kms" },
			);

			expect(payload.kms).toBe("PHALA");
			expect(payload.kms_id).toBe("custom-kms");
		});

		test("should default to prefer_dev=false when using BASE KMS", () => {
			const options = {
				kms: "base",
			};

			const payload = buildProvisionPayload(
				options,
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
			);

			expect(payload.kms).toBe("BASE");
			expect(payload.prefer_dev).toBe(false);
		});

		test("should default to prefer_dev=false when using ETHEREUM KMS", () => {
			const options = {
				kms: "ethereum",
			};

			const payload = buildProvisionPayload(
				options,
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
			);

			expect(payload.kms).toBe("ETHEREUM");
			expect(payload.prefer_dev).toBe(false);
		});

		test("should allow --dev-os to override on-chain KMS default", () => {
			const options = {
				kms: "base",
				devOs: true,
			};

			const payload = buildProvisionPayload(
				options,
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
			);

			expect(payload.kms).toBe("BASE");
			expect(payload.prefer_dev).toBe(true);
		});

		test("should not include optional fields when not specified (except kms which defaults to PHALA)", () => {
			const options = {};

			const payload = buildProvisionPayload(
				options,
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
			);

			expect("instance_type" in payload).toBe(false);
			expect("vcpu" in payload).toBe(false);
			expect("memory" in payload).toBe(false);
			expect("disk_size" in payload).toBe(false);
			expect("teepod_id" in payload).toBe(false);
			expect("region" in payload).toBe(false);
			expect("image" in payload).toBe(false);
			expect("kms_id" in payload).toBe(false);
			expect("prefer_dev" in payload).toBe(false);
			// kms always has a value (defaults to PHALA)
			expect(payload.kms).toBe("PHALA");
		});
	});

	describe("empty envs handling", () => {
		test("should handle empty envs array", () => {
			const options = {};

			const payload = buildProvisionPayload(
				options,
				defaultName,
				defaultDockerCompose,
				[],
				defaultPrivacySettings,
			);

			expect(
				(payload.compose_file as Record<string, unknown>).allowed_envs,
			).toEqual([]);
		});
	});

	describe("vcpu/memory without instance_type (deprecated params)", () => {
		test("should include vcpu/memory but NOT instance_type when only vcpu/memory specified", () => {
			const options = {
				vcpu: "4",
				memory: "8G",
			};

			const payload = buildProvisionPayload(
				options,
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
			);

			// vcpu/memory should be included
			expect(payload.vcpu).toBe(4);
			expect(payload.memory).toBe(8192); // 8G = 8192MB

			// instance_type should NOT be included (let backend match based on vcpu/memory)
			expect("instance_type" in payload).toBe(false);
		});

		test("should include only vcpu when memory not specified", () => {
			const options = {
				vcpu: "4",
			};

			const payload = buildProvisionPayload(
				options,
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
			);

			expect(payload.vcpu).toBe(4);
			expect("memory" in payload).toBe(false);
			expect("instance_type" in payload).toBe(false);
		});

		test("should include only memory when vcpu not specified", () => {
			const options = {
				memory: "8G",
			};

			const payload = buildProvisionPayload(
				options,
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
			);

			expect(payload.memory).toBe(8192);
			expect("vcpu" in payload).toBe(false);
			expect("instance_type" in payload).toBe(false);
		});

		test("should parse memory with different units correctly", () => {
			// Test MB unit
			let payload = buildProvisionPayload(
				{ memory: "2048MB" },
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
			);
			expect(payload.memory).toBe(2048);

			// Test GB unit
			payload = buildProvisionPayload(
				{ memory: "4GB" },
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
			);
			expect(payload.memory).toBe(4096);

			// Test G shorthand
			payload = buildProvisionPayload(
				{ memory: "2G" },
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
			);
			expect(payload.memory).toBe(2048);

			// Test numeric only (defaults to MB)
			payload = buildProvisionPayload(
				{ memory: "1024" },
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
			);
			expect(payload.memory).toBe(1024);
		});
	});

	describe("customAppId and nonce handling", () => {
		test("should include app_id and nonce in payload for PHALA KMS", () => {
			const options = {
				customAppId: "af457f534bb2154fcb9da3a0f29254659b504768",
				nonce: "12345",
				kms: "phala",
			};

			const payload = buildProvisionPayload(
				options,
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
			);

			expect(payload.app_id).toBe("af457f534bb2154fcb9da3a0f29254659b504768");
			expect(payload.nonce).toBe(12345);
		});

		test("should include app_id without nonce for ETHEREUM KMS", () => {
			const options = {
				customAppId: "af457f534bb2154fcb9da3a0f29254659b504768",
				kms: "ethereum",
			};

			const payload = buildProvisionPayload(
				options,
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
			);

			expect(payload.app_id).toBe("af457f534bb2154fcb9da3a0f29254659b504768");
			expect("nonce" in payload).toBe(false);
		});

		test("should include app_id without nonce for BASE KMS", () => {
			const options = {
				customAppId: "af457f534bb2154fcb9da3a0f29254659b504768",
				kms: "base",
			};

			const payload = buildProvisionPayload(
				options,
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
			);

			expect(payload.app_id).toBe("af457f534bb2154fcb9da3a0f29254659b504768");
			expect("nonce" in payload).toBe(false);
		});

		test("should not include app_id or nonce in payload when neither is specified", () => {
			const options = {};

			const payload = buildProvisionPayload(
				options,
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
			);

			expect("app_id" in payload).toBe(false);
			expect("nonce" in payload).toBe(false);
		});

		test("should throw error when customAppId specified without nonce for PHALA KMS", () => {
			const options = {
				customAppId: "af457f534bb2154fcb9da3a0f29254659b504768",
				kms: "phala",
			};

			expect(() =>
				buildProvisionPayload(
					options,
					defaultName,
					defaultDockerCompose,
					defaultEnvs,
					defaultPrivacySettings,
				),
			).toThrow(
				"--nonce is required when using --custom-app-id with PHALA KMS",
			);
		});

		test("should throw error when customAppId specified without nonce for default KMS (PHALA)", () => {
			// When kms is not specified, it defaults to PHALA
			const options = {
				customAppId: "af457f534bb2154fcb9da3a0f29254659b504768",
				// kms not specified - defaults to PHALA
			};

			expect(() =>
				buildProvisionPayload(
					options,
					defaultName,
					defaultDockerCompose,
					defaultEnvs,
					defaultPrivacySettings,
				),
			).toThrow(
				"--nonce is required when using --custom-app-id with PHALA KMS",
			);
		});

		test("should throw error when only nonce is specified without customAppId", () => {
			const options = {
				nonce: "12345",
			};

			expect(() =>
				buildProvisionPayload(
					options,
					defaultName,
					defaultDockerCompose,
					defaultEnvs,
					defaultPrivacySettings,
				),
			).toThrow("--nonce requires --custom-app-id to be specified");
		});

		test("should throw error when nonce is not a valid number", () => {
			const options = {
				customAppId: "af457f534bb2154fcb9da3a0f29254659b504768",
				nonce: "abc",
				kms: "phala",
			};

			expect(() =>
				buildProvisionPayload(
					options,
					defaultName,
					defaultDockerCompose,
					defaultEnvs,
					defaultPrivacySettings,
				),
			).toThrow('Invalid nonce value: "abc". Nonce must be a valid number.');
		});
	});

	describe("storage_fs handling", () => {
		test("should include storage_fs in compose_file when fs is 'ext4'", () => {
			const options = {
				fs: "ext4",
			};

			const payload = buildProvisionPayload(
				options,
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
			);

			expect(
				(payload.compose_file as Record<string, unknown>).storage_fs,
			).toBe("ext4");
		});

		test("should include storage_fs in compose_file when fs is 'zfs'", () => {
			const options = {
				fs: "zfs",
			};

			const payload = buildProvisionPayload(
				options,
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
			);

			expect(
				(payload.compose_file as Record<string, unknown>).storage_fs,
			).toBe("zfs");
		});

		test("should not include storage_fs in compose_file when fs is not specified", () => {
			const options = {};

			const payload = buildProvisionPayload(
				options,
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
			);

			expect(
				"storage_fs" in (payload.compose_file as Record<string, unknown>),
			).toBe(false);
		});
	});

	describe("pre-launch script handling", () => {
		test("should include pre_launch_script in compose_file when provided", () => {
			const options = {};
			const scriptContent = "#!/bin/bash\necho hello";

			const payload = buildProvisionPayload(
				options,
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
				undefined,
				scriptContent,
			);

			expect(
				(payload.compose_file as Record<string, unknown>).pre_launch_script,
			).toBe(scriptContent);
		});

		test("should not include pre_launch_script when not provided", () => {
			const options = {};

			const payload = buildProvisionPayload(
				options,
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
			);

			expect(
				"pre_launch_script" in
					(payload.compose_file as Record<string, unknown>),
			).toBe(false);
		});

		test("should not include pre_launch_script when empty string", () => {
			const options = {};

			const payload = buildProvisionPayload(
				options,
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
				undefined,
				"",
			);

			expect(
				"pre_launch_script" in
					(payload.compose_file as Record<string, unknown>),
			).toBe(false);
		});
	});

	describe("privacy settings", () => {
		test("should include public_logs and public_sysinfo in compose_file", () => {
			const options = {};
			const privacySettings = {
				publicLogs: true,
				publicSysinfo: false,
				listed: true,
			};

			const payload = buildProvisionPayload(
				options,
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				privacySettings,
			);

			expect(
				(payload.compose_file as Record<string, unknown>).public_logs,
			).toBe(true);
			expect(
				(payload.compose_file as Record<string, unknown>).public_sysinfo,
			).toBe(false);
			expect(payload.listed).toBe(true);
		});

		test("should include default privacy settings", () => {
			const options = {};

			const payload = buildProvisionPayload(
				options,
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
			);

			expect(
				(payload.compose_file as Record<string, unknown>).public_logs,
			).toBe(true);
			expect(
				(payload.compose_file as Record<string, unknown>).public_sysinfo,
			).toBe(true);
			expect(payload.listed).toBe(false);
		});
	});
});
