import { describe, expect, test } from "bun:test";
import {
	allowGatewayPorts,
	denyGatewayPorts,
	gatewayClosures,
	gatewayPolicyEquivalent,
	gatewayPortPolicySchema,
	readDeclaredPortPolicy,
	replaceGatewayPorts,
} from "./port-policy";

describe("gateway port policy", () => {
	test("validates inputs without coercing or silently ignoring keys", () => {
		expect(
			gatewayPortPolicySchema.parse({
				restrict_mode: true,
				ports: [{ port: 65535, pp: true }, { port: 1 }],
			}),
		).toEqual({
			restrict_mode: true,
			ports: [
				{ port: 1, pp: false },
				{ port: 65535, pp: true },
			],
		});
		for (const value of [
			{ ports: [] },
			{ restrict_mode: true },
			{ restrict_mode: "on", ports: [] },
			{ restrict_mode: true, ports: [], typo: false },
			{ restrict_mode: true, ports: [{ port: 80, proxy: true }] },
			{ restrict_mode: true, ports: [{ port: 80 }, { port: 80, pp: true }] },
			...[-1, 0, 65536, 80.1, "80", true].map((port) => ({
				restrict_mode: true,
				ports: [{ port }],
			})),
		]) {
			expect(gatewayPortPolicySchema.safeParse(value).success).toBe(false);
		}
	});

	test("distinguishes undeclared policy from a missing compose read", () => {
		expect(readDeclaredPortPolicy({})).toBeUndefined();
		expect(
			readDeclaredPortPolicy('{"port_policy":{"ports":[{"port":80}]}}'),
		).toEqual({
			restrict_mode: false,
			ports: [{ port: 80, pp: false }],
		});
		expect(() => readDeclaredPortPolicy(undefined)).toThrow(
			"return the app compose",
		);
		expect(() => readDeclaredPortPolicy("services: {}")).toThrow(
			"return the app compose",
		);
	});

	test("compares forwarding behavior rather than order or no-op entries", () => {
		const full = replaceGatewayPorts(true, [80], [443]);
		const open = replaceGatewayPorts(false, [80], []);
		expect(
			gatewayPolicyEquivalent(full, {
				...full,
				ports: [...full.ports].reverse(),
			}),
		).toBe(true);
		expect(gatewayPolicyEquivalent(undefined, open)).toBe(true);
		expect(
			gatewayPolicyEquivalent(open, replaceGatewayPorts(false, [], [80])),
		).toBe(false);
		expect(
			gatewayPolicyEquivalent(open, replaceGatewayPorts(true, [], [])),
		).toBe(false);
	});

	test("allow retains existing entries and appends new ports in ascending order", () => {
		const current = {
			restrict_mode: true,
			ports: [
				{ port: 443, pp: true },
				{ port: 80, pp: false },
			],
		};
		expect(allowGatewayPorts(current, [443, 8090, 22]).ports).toEqual([
			{ port: 443, pp: true },
			{ port: 80, pp: false },
			{ port: 22, pp: false },
			{ port: 8090, pp: false },
		]);
		expect(denyGatewayPorts(current, [80]).ports).toEqual([
			{ port: 443, pp: true },
		]);
		expect(() => allowGatewayPorts(undefined, [443])).toThrow(
			"--proxy-protocol",
		);
		expect(() => allowGatewayPorts(undefined, [443])).toThrow(
			"phala port-policy replace --restrict",
		);
		expect(allowGatewayPorts(undefined, [443], false).restrict_mode).toBe(
			false,
		);
		expect(() => denyGatewayPorts(undefined, [443])).toThrow(
			"already forwards all",
		);
	});

	test("confirms only new closures, with a separate deny-all confirmation", () => {
		const denyAll = replaceGatewayPorts(true, [], []);
		const httpOnly = replaceGatewayPorts(true, [80], []);
		expect(gatewayClosures(undefined, denyAll, true)).toEqual(["all"]);
		expect(gatewayClosures(undefined, denyAll, false)).toEqual(["all"]);
		expect(gatewayClosures(httpOnly, denyAll, false)).toEqual(["all"]);
		expect(gatewayClosures(denyAll, denyAll, false)).toEqual([]);
		expect(
			gatewayClosures(undefined, replaceGatewayPorts(true, [8090], []), false),
		).toEqual(["22"]);
	});
});
