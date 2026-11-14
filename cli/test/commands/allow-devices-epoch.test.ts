import { beforeEach, describe, expect, mock, test } from "bun:test";
import { base } from "viem/chains";
import type { CommandContext } from "@/src/core/types";

const APP_CONTRACT = `0x${"cd".repeat(20)}`;
const DEVICE_ID = `0x${"11".repeat(32)}`;
const TX_HASH = `0x${"ab".repeat(32)}`;

// Toggle whether the mocked chain reports the queried devices as allowed.
let mockDevicesAllowed = true;
// The backend allowlist view, replaceable per test.
let mockAllowlistDevices: { device_id: string; status: string; node_name?: string }[] =
	[];

// Capture the interactive prompt's choices; auto-select everything offered.
const promptMock = mock((questions: { choices?: { value: string }[] }[]) =>
	Promise.resolve({
		selected: (questions[0]?.choices ?? []).map((choice) => choice.value),
	}),
);
mock.module("inquirer", () => ({ default: { prompt: promptMock } }));

const getAllowedDevicesMock = mock((args: Record<string, unknown>) =>
	Promise.resolve({
		appAddress: args.appAddress,
		owner: "0x0000000000000000000000000000000000000001",
		allowAnyDevice: false,
		devices: mockDevicesAllowed
			? (args.deviceIds as string[]).map((id) => id.toLowerCase())
			: [],
	}),
);
const addDeviceMock = mock(() =>
	Promise.resolve({
		success: true as const,
		data: { transactionHash: TX_HASH, epochsWritten: [1, 1] },
	}),
);
const removeDeviceMock = mock(() =>
	Promise.resolve({
		success: true as const,
		data: { transactionHash: TX_HASH, epochsWritten: [0, 1] },
	}),
);

// The command module imports the whole @phala/cloud surface; mock it entirely
// (this file runs in its own process under the commit hook, so the mock cannot
// leak into sibling test files).
mock.module("@phala/cloud", () => ({
	SUPPORTED_CHAINS: { 8453: base },
	resolveAppEpochPlan: mock(() =>
		Promise.resolve({ kind: "epoch", currentAppEpoch: 0 }),
	),
	safeGetAppDeviceAllowlist: mock(() =>
		Promise.resolve({
			success: true as const,
			data: {
				is_onchain_kms: true,
				chain_id: 8453,
				app_contract_address: APP_CONTRACT,
				devices: mockAllowlistDevices,
			},
		}),
	),
	safeGetCvmInfo: mock(() => Promise.resolve({ success: true, data: {} })),
	safeGetAvailableNodes: mock(() =>
		Promise.resolve({ success: true as const, data: { nodes: [] } }),
	),
	safeAddDevice: addDeviceMock,
	safeRemoveDevice: removeDeviceMock,
	safeSetAllowAnyDevice: mock(() =>
		Promise.resolve({ success: true as const, data: {} }),
	),
	getAllowedDevices: getAllowedDevicesMock,
}));

mock.module("@/src/lib/client", () => ({
	getClient: mock(() => Promise.resolve({ post: mock() })),
}));

import {
	allowDevicesAddCommand,
	allowDevicesRemoveCommand,
} from "../../src/commands/allow-devices/index";
import {
	allowDevicesAddSchema,
	allowDevicesRemoveSchema,
} from "../../src/commands/allow-devices/command";

function makeContext(): CommandContext {
	return {
		argv: [],
		rawFlags: {},
		rawPositionals: [],
		cwd: process.cwd(),
		env: process.env,
		stdout: { write: mock(() => true) } as unknown as NodeJS.WriteStream,
		stderr: { write: mock(() => true) } as unknown as NodeJS.WriteStream,
		stdin: process.stdin,
		projectConfig: {},
		success() {},
		fail() {},
		failWithError() {},
	} as CommandContext;
}

describe("allow-devices --epoch threading", () => {
	beforeEach(() => {
		getAllowedDevicesMock.mockClear();
		addDeviceMock.mockClear();
		removeDeviceMock.mockClear();
		promptMock.mockClear();
		mockAllowlistDevices = [];
	});

	test("add --epoch --wait verifies the allowlist at the requested epoch", async () => {
		const code = await allowDevicesAddCommand.run(
			allowDevicesAddSchema.parse({
				cvm: "app_test",
				deviceId: DEVICE_ID,
				epoch: 1,
				wait: true,
				privateKey: `0x${"22".repeat(32)}`,
			}),
			makeContext(),
		);

		expect(code).toBe(0);
		expect(addDeviceMock).toHaveBeenCalledWith(
			expect.objectContaining({ epoch: 1 }),
		);
		// The wait must read the same epoch the write targeted; reading the
		// current epoch would time out on a correct write.
		expect(getAllowedDevicesMock).toHaveBeenCalledWith(
			expect.objectContaining({ epoch: 1 }),
		);
	});

	test("add --wait without --epoch reads the default epoch", async () => {
		const code = await allowDevicesAddCommand.run(
			allowDevicesAddSchema.parse({
				cvm: "app_test",
				deviceId: DEVICE_ID,
				wait: true,
				privateKey: `0x${"22".repeat(32)}`,
			}),
			makeContext(),
		);

		expect(code).toBe(0);
		expect(addDeviceMock).toHaveBeenCalledWith(
			expect.objectContaining({ epoch: undefined }),
		);
		expect(getAllowedDevicesMock).toHaveBeenCalledWith(
			expect.objectContaining({ epoch: undefined }),
		);
	});

	test("remove --epoch --wait verifies at the requested epoch", async () => {
		mockDevicesAllowed = false;
		try {
			const code = await allowDevicesRemoveCommand.run(
				allowDevicesRemoveSchema.parse({
					cvm: "app_test",
					deviceId: DEVICE_ID,
					epoch: 1,
					wait: true,
					privateKey: `0x${"22".repeat(32)}`,
				}),
				makeContext(),
			);

			expect(code).toBe(0);
			expect(removeDeviceMock).toHaveBeenCalledWith(
				expect.objectContaining({ epoch: 1 }),
			);
			expect(getAllowedDevicesMock).toHaveBeenCalledWith(
				expect.objectContaining({ epoch: 1 }),
			);
		} finally {
			mockDevicesAllowed = true;
		}
	});

	test("remove -i --epoch offers devices the backend already reports as removed", async () => {
		// The device is removed at the current epoch (backend view) but still
		// allowed at epoch 1 — it must remain an interactive removal candidate
		// for `--epoch 1`, or the historical row can never be revoked from the CLI.
		mockAllowlistDevices = [{ device_id: DEVICE_ID, status: "removed" }];
		mockDevicesAllowed = true;
		try {
			const code = await allowDevicesRemoveCommand.run(
				allowDevicesRemoveSchema.parse({
					cvm: "app_test",
					interactive: true,
					epoch: 1,
					privateKey: `0x${"22".repeat(32)}`,
				}),
				makeContext(),
			);

			expect(code).toBe(0);
			const questions = promptMock.mock.calls[0]?.[0] as {
				choices: { value: string }[];
			}[];
			expect(questions[0]?.choices.map((choice) => choice.value)).toContain(
				DEVICE_ID,
			);
			expect(getAllowedDevicesMock).toHaveBeenCalledWith(
				expect.objectContaining({ epoch: 1, deviceIds: [DEVICE_ID] }),
			);
			expect(removeDeviceMock).toHaveBeenCalledWith(
				expect.objectContaining({ deviceId: DEVICE_ID, epoch: 1 }),
			);
		} finally {
			mockAllowlistDevices = [];
		}
	});
});
