/**
 * Deploy Handler Tests
 *
 * Tests for the buildProvisionPayload function to ensure
 * proper handling of --dev-os / --no-dev-os flags.
 */

import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import { buildCommandSchemaInput } from "@/src/core/input-builder";
import { parseCommandArguments } from "@/src/core/parser";
import type { CommandContext } from "@/src/core/types";
import { logger } from "@/src/utils/logger";
import { deployCommandMeta, deployCommandSchema } from "./command";
import {
	applyForceStopOption,
	assertUpdatableOptions,
	buildProvisionPayload,
	buildUpdatePatchBody,
	composeForDevOs,
	readSshPubkey,
	resolveSshKeyChannel,
	runDeploy,
} from "./handler";
import { composeHasDevBox } from "./dev-box";

describe("deploy node selection", () => {
	test("parses --node and no longer exposes --node-id", () => {
		const parsed = parseCommandArguments(
			["--node", "usw5"],
			deployCommandMeta.options,
		);
		const input = buildCommandSchemaInput(deployCommandMeta, parsed);
		expect(deployCommandSchema.parse(input.options).node).toBe("usw5");
		expect(
			deployCommandMeta.options?.some((option) => option.name === "node"),
		).toBe(true);
		expect(deployCommandSchema.safeParse({ node: "" }).success).toBe(false);
		expect(
			deployCommandMeta.options?.some((option) => option.name === "node-id"),
		).toBe(false);
	});
});

/** The backend's dev box, written by hand with its own volume names. */
const CUSTOM_VOLUME_DEV_BOX = `services:
  app:
    image: nginx
  ssh:
    image: ghcr.io/dstack-tee/dstack-dev-box:sha-7725235@sha256:0dc661ea51fcbd70007d117b9e60883d9a96bac510a80683f5bdd6b7947b0291
    privileged: true
    pid: host
    network_mode: host
    uts: host
    environment:
      - MY_KEYS=\${DSTACK_AUTHORIZED_KEYS}
    volumes:
      - /:/host:rslave
      - my-host-keys:/etc/ssh/host-keys
      - my-home:/root
volumes:
  my-host-keys:
  my-home:
`;

describe("deploy --dev-os SSH key channels", () => {
	const sshPubkey = "ssh-ed25519 AAAA local@example";

	async function withTempHome(
		run: (homeDir: string) => Promise<void>,
		hasLocalKey: boolean,
	) {
		const tempDir = await fs.mkdtemp(path.join(import.meta.dir, ".ssh-key-"));
		const homedir = spyOn(os, "homedir").mockReturnValue(tempDir);
		const info = spyOn(logger, "info").mockImplementation(() => {});
		const warn = spyOn(logger, "warn").mockImplementation(() => {});
		try {
			if (hasLocalKey) {
				await fs.outputFile(
					path.join(tempDir, ".ssh", "id_ed25519.pub"),
					sshPubkey,
				);
			}
			await run(tempDir);
		} finally {
			homedir.mockRestore();
			info.mockRestore();
			warn.mockRestore();
			await fs.remove(tempDir);
		}
	}

	test("does not pick up a local key for a 0.6 dev box", async () => {
		await withTempHome(async () => {
			expect(await readSshPubkey({ devOs: true }, "dev-box")).toBeUndefined();
			expect(
				await readSshPubkey({ devOs: true, image: "dstack-0.6.0" }, "dev-box"),
			).toBeUndefined();
		}, true);
	});

	test("does not fail when a 0.6 dev box has no local key", async () => {
		await withTempHome(async () => {
			expect(await readSshPubkey({ devOs: true }, "dev-box")).toBeUndefined();
		}, false);
	});

	test("injects an explicit --ssh-pubkey into a 0.6 dev box", async () => {
		await withTempHome(async (homeDir) => {
			const keyPath = path.join(homeDir, "explicit.pub");
			await fs.outputFile(keyPath, `${sshPubkey}\n`);

			expect(
				await readSshPubkey({ devOs: true, sshPubkey: keyPath }, "dev-box"),
			).toBe(sshPubkey);
		}, true);
	});

	test("still requires a key for a dev OS image below 0.6", async () => {
		await withTempHome(async () => {
			let failure: unknown;
			try {
				await readSshPubkey(
					{ devOs: true, image: "dstack-0.5.7" },
					"dev-image",
				);
			} catch (error) {
				failure = error;
			}
			expect((failure as Error).message).toContain(
				"SSH public key is required for a dev OS image",
			);
		}, false);
	});

	test("reads the local key for a dev OS image below 0.6", async () => {
		await withTempHome(async () => {
			expect(
				await readSshPubkey(
					{ devOs: true, image: "dstack-0.5.7" },
					"dev-image",
				),
			).toBe(sshPubkey);
		}, true);
	});

	const HAND_WRITTEN_DEV_BOX = `services:
  app:
    image: nginx
  ssh:
    image: ghcr.io/dstack-tee/dstack-dev-box:sha-7725235@sha256:0dc661ea51fcbd70007d117b9e60883d9a96bac510a80683f5bdd6b7947b0291
    privileged: true
    pid: host
    network_mode: host
    uts: host
    environment:
      - SSH_AUTHORIZED_KEYS=\${DSTACK_AUTHORIZED_KEYS}
    volumes:
      - /:/host:rslave
      - ssh-host-keys:/etc/ssh/host-keys
      - home:/root
volumes:
  ssh-host-keys:
  home:
`;

	test("treats a hand-written dev box with custom volumes as the dev-box channel", async () => {
		// The backend grants SSH access on the four markers alone, so this is the
		// dev-box channel even though it is not the shape the CLI injects.
		expect(composeHasDevBox(CUSTOM_VOLUME_DEV_BOX)).toBe(false);

		const channel = resolveSshKeyChannel(undefined, CUSTOM_VOLUME_DEV_BOX);
		expect(channel).toBe("dev-box");
		await withTempHome(async () => {
			expect(
				await readSshPubkey({ image: "dstack-0.6.0" }, channel),
			).toBeUndefined();
		}, true);
	});

	test("unwraps an --app-compose document before deciding the channel", async () => {
		const payload = JSON.stringify({
			name: "raw",
			docker_compose_file: HAND_WRITTEN_DEV_BOX,
		});

		const channel = resolveSshKeyChannel(undefined, payload);
		expect(channel).toBe("dev-box");
		await withTempHome(async () => {
			expect(
				await readSshPubkey({ image: "dstack-0.6.0" }, channel),
			).toBeUndefined();
		}, true);
	});

	test("treats a hand-written dev box as the dev-box channel without --dev-os", async () => {
		// `--image` 0.6 with the user's own dev-box service and no `--dev-os`: the
		// compose still sends keys through user_config, so a frozen env copy would
		// survive a revocation.
		const channel = resolveSshKeyChannel(undefined, HAND_WRITTEN_DEV_BOX);
		expect(channel).toBe("dev-box");
		await withTempHome(async () => {
			expect(
				await readSshPubkey({ image: "dstack-0.6.0" }, channel),
			).toBeUndefined();
		}, true);
	});

	test("keeps the legacy env path for a dev OS image, dev box or not", async () => {
		expect(resolveSshKeyChannel("dev-image", HAND_WRITTEN_DEV_BOX)).toBe(
			"dev-image",
		);
		await withTempHome(async () => {
			expect(
				await readSshPubkey(
					{ devOs: true, image: "dstack-0.5.7" },
					resolveSshKeyChannel("dev-image", HAND_WRITTEN_DEV_BOX),
				),
			).toBe(sshPubkey);
		}, true);
	});

	test("reads the local key when the compose carries no dev box", async () => {
		const channel = resolveSshKeyChannel(
			undefined,
			"services:\n  app:\n    image: nginx\n",
		);
		expect(channel).toBe("none");
		await withTempHome(async () => {
			expect(await readSshPubkey({}, channel)).toBe(sshPubkey);
		}, true);
	});

	test("takes the dev-box channel from the flag even when the compose is opaque", () => {
		// `--app-compose` is a whole-document payload the line parser cannot read.
		expect(
			resolveSshKeyChannel(
				"dev-box",
				'{"docker_compose_file": "services: {}"}',
			),
		).toBe("dev-box");
	});
});

describe("deploy --no-pre-launch-script", () => {
	const sshPubkey = "ssh-rsa test-public-key";
	test.each([
		{ options: { noPreLaunchScript: true }, expected: undefined },
		{ options: {}, expected: sshPubkey },
	])("implicit SSH key: %j", async ({ options, expected }) => {
		const tempDir = await fs.mkdtemp(path.join(import.meta.dir, ".ssh-key-"));
		const homedir = spyOn(os, "homedir").mockReturnValue(tempDir);
		const info = spyOn(logger, "info").mockImplementation(() => {});
		try {
			await fs.outputFile(path.join(tempDir, ".ssh", "id_rsa.pub"), sshPubkey);
			expect(await readSshPubkey(options)).toBe(expected);
		} finally {
			homedir.mockRestore();
			info.mockRestore();
			await fs.remove(tempDir);
		}
	});

	test("parses the flag as a boolean option", () => {
		const parsedArguments = parseCommandArguments(
			["--no-pre-launch-script"],
			deployCommandMeta.options,
		);
		const schemaInput = buildCommandSchemaInput(
			deployCommandMeta,
			parsedArguments,
		);

		expect(schemaInput.options.noPreLaunchScript).toBe(true);
		expect(
			deployCommandSchema.parse(schemaInput.options).noPreLaunchScript,
		).toBe(true);
	});

	test("rejects combining the flag with --pre-launch-script", async () => {
		const result = deployCommandSchema.safeParse({
			noPreLaunchScript: true,
			preLaunchScript: "setup.sh",
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0]?.message).toContain(
				"--no-pre-launch-script cannot be used with --pre-launch-script",
			);
		}

		let failure: unknown;
		const context = {
			env: {},
			projectConfig: {},
			stdout: { write: () => true },
			stderr: { write: () => true },
			failWithError: (error: unknown) => {
				failure = error;
			},
		} as unknown as CommandContext;
		const exitCode = await runDeploy(
			{
				noPreLaunchScript: true,
				preLaunchScript: "setup.sh",
			} as Parameters<typeof runDeploy>[0],
			context,
		);

		expect(exitCode).toBe(1);
		expect(failure).toBeInstanceOf(Error);
		expect((failure as Error).message).toContain(
			"--no-pre-launch-script cannot be used with --pre-launch-script",
		);
	});

	test("sends an explicit empty pre-launch script on create", () => {
		const payload = buildProvisionPayload(
			{ noPreLaunchScript: true },
			"test-cvm",
			"services: {}",
			[],
			{
				publicLogs: true,
				publicSysinfo: true,
				publicTcbinfo: true,
				secureTime: false,
				listed: false,
			},
		);

		expect(payload).toEqual({
			name: "test-cvm",
			compose_file: {
				name: "",
				docker_compose_file: "services: {}",
				allowed_envs: [],
				public_logs: true,
				public_sysinfo: true,
				public_tcbinfo: true,
				secure_time: false,
				pre_launch_script: "",
			},
			listed: false,
			kms: "PHALA",
		});
	});

	test("sends an explicit empty pre-launch script on update", () => {
		const patchBody = buildUpdatePatchBody(
			{ uuid: "cvm-123", noPreLaunchScript: true },
			"services: {}",
		);

		expect(patchBody).toEqual({
			id: "cvm-123",
			docker_compose_file: "services: {}",
			pre_launch_script: "",
		});
	});

	test("omits an empty script file from update requests", () => {
		const patchBody = buildUpdatePatchBody(
			{ uuid: "cvm-123" },
			"services: {}",
			"",
		);

		expect(patchBody).toEqual({
			id: "cvm-123",
			docker_compose_file: "services: {}",
		});
	});
});

describe("deploy --force-stop", () => {
	test("parses the optional update flag", () => {
		const input = deployCommandSchema.parse({ forceStop: true });
		expect(input.forceStop).toBe(true);
	});

	test("forces an update to stop without graceful shutdown", () => {
		const patchBody: Record<string, unknown> = {};
		applyForceStopOption(patchBody, true);
		expect(patchBody.allow_force_stop).toBe(true);
		expect(patchBody.shutdown_timeout).toBeUndefined();
	});

	test("keeps the default update behavior unchanged", () => {
		const patchBody: Record<string, unknown> = {};
		applyForceStopOption(patchBody, false);
		expect(patchBody.allow_force_stop).toBeUndefined();
		expect(patchBody.shutdown_timeout).toBeUndefined();
	});
});

describe("buildProvisionPayload", () => {
	const defaultName = "test-cvm";
	const defaultDockerCompose =
		"version: '3'\nservices:\n  app:\n    image: nginx";
	const defaultEnvs = [{ key: "NODE_ENV", value: "production" }];
	const defaultPrivacySettings = {
		publicLogs: true,
		publicSysinfo: true,
		publicTcbinfo: true,
		secureTime: false,
		listed: false,
	};

	describe("prefer_dev flag handling (--dev-os / --no-dev-os)", () => {
		test("should select a dev image below dstack 0.6 (--dev-os)", () => {
			const options = {
				devOs: true,
				image: "dstack-0.5.7",
			};

			const payload = buildProvisionPayload(
				options,
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
				undefined,
				undefined,
				undefined,
				"dev-image",
			);

			expect(payload.prefer_dev).toBe(true);
		});

		test("should not select a dev image from dstack 0.6 on (--dev-os)", () => {
			const options = {
				devOs: true,
				image: "dstack-0.6.0",
			};

			const payload = buildProvisionPayload(
				options,
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
				undefined,
				undefined,
				undefined,
				"dev-box",
			);

			// 0.6+ has no dev image: the dev-box service carries SSH instead.
			expect(payload.prefer_dev).toBe(false);
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
				node: "usw5",
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
				undefined,
				undefined,
				undefined,
				"dev-image",
			);

			expect(payload.instance_type).toBe("tdx.small");
			expect(payload.vcpu).toBe(2);
			expect(payload.memory).toBe(4096); // 4G = 4096MB
			expect(payload.disk_size).toBe(50); // 50G = 50GB
			expect(payload.node).toBe("usw5");
			expect(payload.node_id).toBeUndefined();
			expect(payload.teepod_id).toBeUndefined();
			expect(payload.region).toBe("us-west");
			expect(payload.image).toBe("dstack-dev-0.5.0");
			// --kms-id is deprecated and now a no-op; it is no longer sent.
			expect(payload.kms_id).toBeUndefined();
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

		test("ignores deprecatedKmsId (kms_id is a no-op) but keeps kms type", () => {
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
			// --kms-id is deprecated and now a no-op; it is no longer sent.
			expect(payload.kms_id).toBeUndefined();
		});

		test("should include CVM resource matching v2 fields when specified", () => {
			const options = {
				kms: "base",
				kmsContract: "0xbase",
				kmsContractId: "contract_1",
				keyProviderMode: "local" as const,
				skipGateway: true,
			};

			const payload = buildProvisionPayload(
				options,
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
			);

			expect(payload.kms).toBe("BASE");
			expect(payload.kms_contract).toBe("0xbase");
			expect(payload.kms_contract_id).toBe("contract_1");
			expect(payload.key_provider_mode).toBe("local");
			expect(payload.skip_gateway).toBe(true);
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
				image: "dstack-0.5.7",
			};

			const payload = buildProvisionPayload(
				options,
				defaultName,
				defaultDockerCompose,
				defaultEnvs,
				defaultPrivacySettings,
				undefined,
				undefined,
				undefined,
				"dev-image",
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

			expect((payload.compose_file as Record<string, unknown>).storage_fs).toBe(
				"ext4",
			);
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

			expect((payload.compose_file as Record<string, unknown>).storage_fs).toBe(
				"zfs",
			);
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
				publicTcbinfo: true,
				secureTime: false,
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

describe("deploy --dev-os compose preparation", () => {
	const LOCAL_COMPOSE = "services:\n  app:\n    image: nginx\n";

	test("adds the canonical dev box to a compose without one", () => {
		const prepared = composeForDevOs(LOCAL_COMPOSE, "dev-box");

		expect(prepared.added).toBe(true);
		expect(prepared.compose).toContain("dev-box:");
		expect(
			buildUpdatePatchBody({ uuid: "cvm-1" }, prepared.compose)
				.docker_compose_file,
		).toContain("dev-box:");
	});

	test.each([
		[
			"the markers on another image",
			`services:
  app:
    image: nginx
    privileged: true
    pid: host
    network_mode: host
    uts: host
`,
		],
		[
			"a dev box whose entrypoint runs something else",
			`services:
  app:
    image: nginx
    privileged: true
    pid: host
    network_mode: host
    uts: host
    command: ["sleep", "infinity"]
`,
		],
		[
			"a dev box parked behind a profile",
			`services:
  app:
    image: nginx
    privileged: true
    pid: host
    network_mode: host
    uts: host
    profiles: [debug]
`,
		],
		["the dev-box image without its mounts", CUSTOM_VOLUME_DEV_BOX],
	])("refuses --dev-os when %s is not a usable dev box", (_label, compose) => {
		// An explicit --dev-os asks for a dev box; a payload that only carries
		// the markers is reported, never accepted as if SSH were already there.
		expect(() => composeForDevOs(compose, "dev-box")).toThrow();
	});

	test("adds nothing when the mode is not the dev box", () => {
		expect(composeForDevOs(LOCAL_COMPOSE, "dev-image")).toEqual({
			compose: LOCAL_COMPOSE,
			added: false,
		});
		expect(composeForDevOs(LOCAL_COMPOSE, undefined)).toEqual({
			compose: LOCAL_COMPOSE,
			added: false,
		});
	});

	test("applying the dev box twice is idempotent", () => {
		const once = composeForDevOs(LOCAL_COMPOSE, "dev-box");
		const twice = composeForDevOs(once.compose, "dev-box");

		expect(twice.added).toBe(false);
		expect(twice.compose).toBe(once.compose);
	});

	test("--dev-os is no longer create-only", () => {
		expect(() => assertUpdatableOptions({ devOs: true })).not.toThrow();
		expect(() => assertUpdatableOptions({ devOs: false })).not.toThrow();
	});
});
