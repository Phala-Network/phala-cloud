import { z } from "zod";

export const GUEST_AGENT_PORT = 8090;
export const PORT_POLICY_TOML_EXAMPLE = `[port_policy]
restrict_mode = true
ports = [{ port = 8090 }, { port = 8080, pp = true }]`;
export const PORT_POLICY_JSON_EXAMPLE =
	'{"restrict_mode":true,"ports":[{"port":8090},{"port":8080,"pp":true}]}';

const portNumber = z.number().int().min(1).max(65535);
const gatewayPort = z.strictObject({
	port: portNumber,
	pp: z.boolean().default(false),
});

const policyShape = z.strictObject({
	restrict_mode: z.boolean(),
	ports: z.array(gatewayPort).superRefine((ports, ctx) => {
		const seen = new Set<number>();
		for (const [i, entry] of ports.entries()) {
			if (seen.has(entry.port)) {
				ctx.addIssue({
					code: "custom",
					path: [i, "port"],
					message: `Port ${entry.port} is listed more than once.`,
				});
			}
			seen.add(entry.port);
		}
	}),
});

export const gatewayPortPolicySchema = policyShape.transform((policy) => ({
	...policy,
	ports: [...policy.ports].sort((a, b) => a.port - b.port),
}));

export type GatewayPortPolicy = z.output<typeof policyShape>;

/** Read the declared policy, not any override. An absent compose is not an absent policy. */
export function readDeclaredPortPolicy(
	compose: unknown,
): GatewayPortPolicy | undefined {
	const unavailable =
		"Phala Cloud did not return the app compose. Cannot read the declared port policy.";
	let value: unknown = compose;
	if (typeof value === "string") {
		try {
			value = JSON.parse(value);
		} catch {
			throw new Error(unavailable);
		}
	}
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new Error(unavailable);
	}
	const policy = "port_policy" in value ? value.port_policy : undefined;
	if (policy == null) return undefined;
	const parsed = policyShape
		.extend({
			restrict_mode: z.boolean().default(false),
			ports: policyShape.shape.ports.default([]),
		})
		.safeParse(policy);
	if (!parsed.success) {
		throw new Error(
			"The declared gateway port policy is not valid. Check the app compose before changing it.",
		);
	}
	return parsed.data;
}

export function gatewayPortIsBlocked(
	policy: GatewayPortPolicy | undefined,
	port: number,
): boolean {
	return (
		!!policy?.restrict_mode &&
		!policy.ports.some((entry) => entry.port === port)
	);
}

export function gatewayPolicyEquivalent(
	before: GatewayPortPolicy | undefined,
	after: GatewayPortPolicy | undefined,
): boolean {
	const restrict = before?.restrict_mode ?? false;
	if (restrict !== (after?.restrict_mode ?? false)) return false;
	const active = (policy: GatewayPortPolicy | undefined) =>
		(policy?.ports ?? []).filter(({ pp }) => restrict || pp);
	const previous = active(before);
	const next = new Map(active(after).map(({ port, pp }) => [port, pp]));
	return (
		previous.length === next.size &&
		previous.every(({ port, pp }) => next.get(port) === pp)
	);
}

export function parseGatewayPort(value: string): number {
	if (!/^\d+$/.test(value) || !portNumber.safeParse(Number(value)).success) {
		throw new Error(
			`Invalid port '${value}'. Use an integer from 1 to 65535 (for example, 8080).`,
		);
	}
	return Number(value);
}

export function parseGatewayPorts(values: string[]): number[] {
	const seen = new Set<number>();
	for (const value of values) {
		const port = parseGatewayPort(value);
		if (seen.has(port))
			throw new Error(`Port ${port} is listed more than once.`);
		seen.add(port);
	}
	return [...seen].sort((a, b) => a - b);
}

export function replaceGatewayPorts(
	restrict: boolean,
	ports: number[],
	proxyPorts: number[],
): GatewayPortPolicy {
	const proxy = new Set(proxyPorts);
	return gatewayPortPolicySchema.parse({
		restrict_mode: restrict,
		ports: [...new Set([...ports, ...proxyPorts])].map((port) => ({
			port,
			pp: proxy.has(port),
		})),
	});
}

export function allowGatewayPorts(
	policy: GatewayPortPolicy | undefined,
	ports: number[],
	proxyProtocol?: boolean,
): GatewayPortPolicy {
	if (!policy?.restrict_mode && proxyProtocol === undefined) {
		throw new Error(
			"The gateway already forwards all ports. Use --proxy-protocol or --no-proxy-protocol to change PROXY protocol on these ports. To restrict which ports are forwarded, use phala port-policy replace --restrict.",
		);
	}
	const additions = new Set(ports);
	const entries = (policy?.ports ?? []).map((entry) =>
		additions.delete(entry.port) && proxyProtocol !== undefined
			? { ...entry, pp: proxyProtocol }
			: entry,
	);
	return {
		restrict_mode: policy?.restrict_mode ?? false,
		ports: [
			...entries,
			...[...additions]
				.sort((a, b) => a - b)
				.map((port) => ({ port, pp: proxyProtocol ?? false })),
		],
	};
}

export function denyGatewayPorts(
	policy: GatewayPortPolicy | undefined,
	ports: number[],
): GatewayPortPolicy {
	if (!policy?.restrict_mode) {
		throw new Error(
			"The gateway already forwards all ports. Use port-policy replace --restrict with the ports you want to allow.",
		);
	}
	const denied = new Set(ports);
	return {
		restrict_mode: true,
		ports: policy.ports.filter(({ port }) => !denied.has(port)),
	};
}

export const portClosureSchema = z.enum(["8090", "22", "all"]);
export type PortClosure = z.infer<typeof portClosureSchema>;

export function gatewayClosures(
	before: GatewayPortPolicy | undefined,
	after: GatewayPortPolicy,
	creating: boolean,
): PortClosure[] {
	const newlyBlocks = (port: number) =>
		gatewayPortIsBlocked(after, port) && !gatewayPortIsBlocked(before, port);
	const deniesAll = (policy: GatewayPortPolicy | undefined) =>
		policy?.restrict_mode && policy.ports.length === 0;
	if (deniesAll(after)) return deniesAll(before) ? [] : ["all"];
	const closures: PortClosure[] = [];
	if (newlyBlocks(GUEST_AGENT_PORT)) closures.push("8090");
	if (!creating && newlyBlocks(22)) closures.push("22");
	return closures;
}

export function describeGatewayPolicy(
	policy: GatewayPortPolicy | undefined,
): string {
	if (!policy)
		return "No policy declared. The gateway forwards all ports without PROXY protocol.";
	if (policy.restrict_mode && policy.ports.length === 0)
		return "The gateway forwards no ports.";
	const format = ({ port, pp }: GatewayPortPolicy["ports"][number]) =>
		`${port}${pp ? " (PROXY protocol)" : ""}`;
	if (policy.restrict_mode)
		return `The gateway forwards only these ports: ${policy.ports.map(format).join(", ")}.`;
	const proxy = policy.ports.filter(({ pp }) => pp).map(({ port }) => port);
	return proxy.length === 0
		? "The gateway forwards all ports without PROXY protocol."
		: `The gateway forwards all ports. PROXY protocol is enabled on ${proxy.join(", ")}.`;
}

export function formatPortPolicyToml(policy: GatewayPortPolicy): string {
	const ports = [...policy.ports]
		.sort((a, b) => a.port - b.port)
		.map(({ port, pp }) => `{ port = ${port}${pp ? ", pp = true" : ""} }`);
	return `[port_policy]\nrestrict_mode = ${policy.restrict_mode}\nports = [${ports.join(", ")}]`;
}

export function unlistedPortWarnings(
	ports: readonly number[] | undefined,
	vmUuid: string,
): string[] {
	return (ports ?? []).map(
		(port) =>
			`Published port ${port} is not allowed by the gateway policy. To allow it, run phala port-policy allow ${port} --cvm-id ${vmUuid}.`,
	);
}
