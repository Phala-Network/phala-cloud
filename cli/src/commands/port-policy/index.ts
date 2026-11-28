import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
	type CvmIdInput,
	CvmIdSchema,
	confirmCvmPatch,
	getAppCvms,
	getCvmInfo,
	patchCvm,
} from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import type { CommandContext } from "@/src/core/types";
import { type CliApiClient, getClient } from "@/src/lib/client";
import { runTwoPhaseComposeUpdate } from "@/src/lib/on-chain-update";
import {
	allowGatewayPorts,
	denyGatewayPorts,
	describeGatewayPolicy,
	formatPortPolicyToml,
	type GatewayPortPolicy,
	GUEST_AGENT_PORT,
	gatewayClosures,
	gatewayPolicyEquivalent,
	gatewayPortIsBlocked,
	gatewayPortPolicySchema,
	PORT_POLICY_JSON_EXAMPLE,
	parseGatewayPorts,
	readDeclaredPortPolicy,
	replaceGatewayPorts,
	unlistedPortWarnings,
} from "@/src/lib/port-policy";
import {
	askPortPolicyQuestion,
	canConfirmInteractively,
	confirmGatewayClosures,
	portPolicyErrorGuidance,
} from "@/src/lib/port-policy-confirmation";
import { waitForCvmOperation } from "@/src/utils/cvms";
import {
	acceptedCvmOperationWaitError,
	waitForAcceptedCvmOperation,
} from "@/src/utils/finality";
import { normalizeCliError } from "@/src/utils/logger";
import { formatZodIssues } from "@/src/utils/validation";
import { ZodError } from "zod";
import {
	allowMeta,
	allowSchema,
	denyMeta,
	denySchema,
	type PortPolicyReplaceInput,
	type PortPolicyWriteInput,
	portPolicyGroup,
	replaceMeta,
	replaceSchema,
	showMeta,
	showSchema,
} from "./command";

async function readPolicy(client: CliApiClient, target: CvmIdInput) {
	const cvm = await getCvmInfo(client, { ...target, include_compose: true });
	if (!cvm.vm_uuid)
		throw new Error("Phala Cloud did not return the CVM's VM UUID.");
	const policy = readDeclaredPortPolicy(cvm.compose_file);
	return { cvm, vmUuid: cvm.vm_uuid, policy };
}

type PolicyRead = Awaited<ReturnType<typeof readPolicy>>;

function printablePolicy({ cvm, policy, vmUuid }: PolicyRead) {
	return {
		name: cvm.name,
		vm_uuid: vmUuid,
		compose_hash: cvm.compose_hash ?? null,
		port_policy_declared: policy !== undefined,
		// Always emit a valid replacement object, even when no policy was declared.
		port_policy: policy ?? { restrict_mode: false, ports: [] },
		gateway_enabled: cvm.gateway_enabled,
		in_progress: cvm.in_progress,
		progress: cvm.progress ?? null,
		finality_wait: cvm.finality_wait ?? null,
	};
}

function printPolicy(read: PolicyRead, { stdout }: CommandContext): void {
	const { cvm, vmUuid, policy } = read;
	stdout.write(
		`${cvm.name}\nVM UUID: ${vmUuid}\nCompose hash: ${cvm.compose_hash ?? "unavailable"}\n${describeGatewayPolicy(policy)}\n`,
	);
	if (cvm.gateway_enabled === false)
		stdout.write("The gateway is disabled for this CVM.\n");
	if (cvm.in_progress)
		stdout.write(
			`Pending CVM operation: ${cvm.progress?.target ?? cvm.status}${cvm.progress?.correlation_id ? ` (${cvm.progress.correlation_id})` : ""}\n`,
		);
	if (cvm.finality_wait)
		stdout.write(
			`On-chain update: ${cvm.finality_wait.phase} (${cvm.finality_wait.correlation_id})\n`,
		);
}

async function showAppPolicies(
	context: CommandContext,
	client: CliApiClient,
	rawAppId: string,
	json: boolean,
): Promise<void> {
	const appId = rawAppId.replace(/^(app_|0x)/i, "");
	const instances = await getAppCvms(client, { appId });
	const reads = [];
	for (const { vm_uuid, id, name } of instances) {
		try {
			if (!vm_uuid) throw new Error("This instance has no VM UUID yet.");
			const read = await readPolicy(client, { uuid: vm_uuid });
			if (!sameUuid(vm_uuid, read.vmUuid))
				throw new Error(
					"Phala Cloud returned a different CVM for this identifier.",
				);
			reads.push({ read, row: printablePolicy(read) });
		} catch (error) {
			reads.push({
				read: undefined,
				row: { id, vm_uuid, name, error: normalizeCliError(error).message },
			});
		}
	}
	const first = reads[0]?.read?.policy;
	const consistent =
		reads.length === 0 || reads.some(({ read }) => !read)
			? null
			: reads.every(({ read }) => gatewayPolicyEquivalent(first, read?.policy));
	if (json) {
		context.success({
			app_id: appId,
			policy_consistent: consistent,
			instances: reads.map(({ row }) => row),
		});
		return;
	}
	context.stdout.write(`App ID: ${appId}\n`);
	if (reads.length === 0) context.stdout.write("No instances found.\n");
	for (const { read, row } of reads) {
		context.stdout.write("\n");
		if (read) printPolicy(read, context);
		else if ("error" in row)
			context.stdout.write(
				`${row.name}\nInstance: ${row.vm_uuid ?? row.id}\nPolicy unavailable: ${row.error}\n`,
			);
	}
	context.stdout.write(
		`\nInstance policies: ${consistent === null ? "unknown" : consistent ? "same behavior" : "different behavior"}.\n`,
	);
}

function targetOf(context: CommandContext): CvmIdInput {
	if (!context.cvmId)
		throw new Error(
			"Pass --cvm-id <vm_uuid>, link this project with phala link, or use --interactive.",
		);
	return context.cvmId;
}

function sameUuid(a: string, b: string): boolean {
	return (
		a.replaceAll("-", "").toLowerCase() === b.replaceAll("-", "").toLowerCase()
	);
}

function matchesLinkedProject(
	context: CommandContext,
	{ cvm, vmUuid }: PolicyRead,
): boolean {
	const linked = context.projectConfig.cvm_id;
	if (!linked) return false;
	if (sameUuid(linked, vmUuid) || linked === cvm.id) return true;
	if (linked.startsWith("app_") && cvm.app_id) {
		return (
			linked.slice(4).toLowerCase() ===
			cvm.app_id.replace(/^(app_|0x)/i, "").toLowerCase()
		);
	}
	return (
		linked === cvm.name ||
		(cvm.instance_id != null &&
			linked === `instance_${cvm.instance_id.replace(/^instance_/, "")}`)
	);
}

const show = defineCommand({
	path: [...portPolicyGroup.path, "show"],
	meta: showMeta,
	schema: showSchema,
	handler: async (input, context) => {
		try {
			if (input.appId && (input.cvmId || input.interactive))
				throw new Error(
					"Use --app-id alone, or select one CVM with --cvm-id or --interactive.",
				);
			const client = await getClient(context);
			if (input.appId)
				await showAppPolicies(context, client, input.appId, input.json);
			else {
				const result = await readPolicy(client, targetOf(context));
				if (input.json) context.success(printablePolicy(result));
				else printPolicy(result, context);
			}
			return 0;
		} catch (error) {
			context.failWithError(error, {
				operation: "Read gateway port policy",
				guidance: portPolicyErrorGuidance(
					error,
					input.cvmId ?? context.projectConfig.cvm_id,
				),
			});
			return 1;
		}
	},
});

async function loadReplacementFile(
	file: string,
	context: CommandContext,
): Promise<GatewayPortPolicy> {
	const location = file === "-" ? "stdin" : resolve(context.cwd, file);
	let content: string;
	if (file === "-") {
		const chunks: Buffer[] = [];
		for await (const chunk of context.stdin) chunks.push(Buffer.from(chunk));
		content = Buffer.concat(chunks).toString("utf8");
	} else content = await readFile(location, "utf8");
	try {
		return gatewayPortPolicySchema.parse(JSON.parse(content));
	} catch (error) {
		const detail =
			error instanceof ZodError
				? formatZodIssues(error)
				: error instanceof Error
					? error.message
					: String(error);
		throw new Error(
			`Invalid gateway policy in ${location}:\n${detail}\nExample: ${PORT_POLICY_JSON_EXAMPLE}`,
		);
	}
}

async function replacement(
	input: PortPolicyReplaceInput,
	context: CommandContext,
): Promise<GatewayPortPolicy> {
	const hasPorts = input.ports.length > 0 || input.proxyPorts.length > 0;
	if (input.file) {
		if (input.restrict !== undefined || input.denyAll || hasPorts)
			throw new Error("--file cannot be combined with policy flags.");
		return loadReplacementFile(input.file, context);
	}
	if (input.denyAll) {
		if (input.restrict !== undefined || hasPorts)
			throw new Error("--deny-all cannot be combined with other policy flags.");
		return replaceGatewayPorts(true, [], []);
	}
	if (input.restrict === undefined)
		throw new Error(
			"Use --restrict, --no-restrict, --deny-all, or --file to specify the complete replacement.",
		);
	if (input.restrict && !hasPorts)
		throw new Error("Use --deny-all to block every gateway port.");
	return replaceGatewayPorts(
		input.restrict,
		parseGatewayPorts(input.ports),
		parseGatewayPorts(input.proxyPorts),
	);
}

async function writePolicy(
	input: PortPolicyWriteInput,
	context: CommandContext,
	change: (
		before: GatewayPortPolicy | undefined,
	) => GatewayPortPolicy | Promise<GatewayPortPolicy>,
	options: { hasPolicyArguments: boolean; readsStdin?: boolean },
): Promise<number> {
	let target = input.cvmId ?? context.projectConfig.cvm_id;
	try {
		const resuming =
			input.composeHash !== undefined && input.transactionHash !== undefined;
		if (Boolean(input.composeHash) !== Boolean(input.transactionHash))
			throw new Error(
				"Pass --compose-hash and --transaction-hash together to confirm a prepared update.",
			);
		if (resuming && (input.prepareOnly || options.hasPolicyArguments))
			throw new Error(
				"Confirm the prepared update without --prepare-only or any policy arguments.",
			);
		const interactive =
			!options.readsStdin && canConfirmInteractively(context, input.json);
		const identifier = targetOf(context);
		target = CvmIdSchema.parse(identifier).cvmId;
		const client = await getClient(context);
		const read = await readPolicy(client, identifier);
		const { cvm, vmUuid, policy: before } = read;
		target = vmUuid;
		const after = resuming ? undefined : await change(before);
		if (after && gatewayPolicyEquivalent(before, after)) {
			if (input.json)
				context.success({ status: "no_change", ...printablePolicy(read) });
			else
				context.stdout.write(
					"The gateway already has the requested behavior. No change made.\n",
				);
			return 0;
		}
		const expectedHash = cvm.compose_hash;
		if (!resuming && !expectedHash)
			throw new Error(
				"Phala Cloud did not return the stored compose hash. No policy change was submitted.",
			);
		if (!input.yes && !interactive)
			throw new Error(
				"Pass --yes to confirm this policy update in noninteractive mode.",
			);
		context.stderr.write(
			`${cvm.name}\nVM UUID: ${vmUuid}\nCurrent compose hash: ${expectedHash ?? "unavailable"}\nBefore: ${describeGatewayPolicy(before)}\n`,
		);
		if (after) context.stderr.write(`After: ${describeGatewayPolicy(after)}\n`);
		else
			context.stderr.write(
				`Resume the prepared update for compose hash ${input.composeHash}. Its saved policy will be applied.\n`,
			);
		context.stderr.write(
			"A running CVM may restart. A stopped CVM stays stopped. On-chain KMS can require a transaction and a wait for finality.\n",
		);
		if (after && cvm.finality_wait)
			throw new Error(
				"An on-chain update is already pending. Wait for it to finish or cancel it before changing the policy.",
			);
		if (
			!input.yes &&
			!(await askPortPolicyQuestion(
				context,
				"Continue with this policy update?",
			))
		)
			return 1;
		if (
			after &&
			!(await confirmGatewayClosures(
				context,
				gatewayClosures(before, after, false),
				input.confirmClose,
				interactive,
			))
		)
			return 1;

		const outcome = await runTwoPhaseComposeUpdate({
			phase1: () => {
				if (!after || !expectedHash)
					throw new Error("Missing the policy or its compose hash.");
				return patchCvm(client, {
					uuid: vmUuid,
					expected_compose_hash: expectedHash,
					compose: { port_policy: after },
					guest_agent_gateway_access: gatewayPortIsBlocked(
						after,
						GUEST_AGENT_PORT,
					)
						? "closed"
						: undefined,
					prepareOnly: input.prepareOnly,
					confirmFinalityReplacement: "none",
				});
			},
			phase2: (composeHash, transactionHash) =>
				confirmCvmPatch(client, {
					uuid: vmUuid,
					composeHash,
					transactionHash,
					confirmFinalityReplacement: "none",
				}),
			options: {
				...input,
				privateKey: input.privateKey ?? context.env.PRIVATE_KEY,
				rpcUrl: input.rpcUrl ?? context.env.ETH_RPC_URL,
			},
			followUpLines: (composeHash) => [
				`  phala port-policy replace --cvm-id ${vmUuid} --yes --compose-hash ${composeHash} --transaction-hash <tx-hash>`,
			],
			stdout: context.stdout,
		});
		if (!("correlationId" in outcome)) return 0;
		if (input.prepareOnly && outcome.status !== "no_change") {
			context.stderr.write(
				"The API accepted this update without a separate on-chain registration step. --prepare-only did not defer it.\n",
			);
		}
		for (const warning of unlistedPortWarnings(
			outcome.portPolicyUnlistedPorts,
			vmUuid,
		))
			context.stderr.write(`${warning}\n`);
		const configured = context.projectConfig.port_policy;
		if (
			after &&
			configured &&
			matchesLinkedProject(context, read) &&
			!gatewayPolicyEquivalent(configured, after)
		) {
			context.stderr.write(
				`The next phala deploy from this project will restore the policy in phala.toml. To keep this change, replace the local table with:\n\n${formatPortPolicyToml(after)}\n`,
			);
		}
		const correlationId = outcome.correlationId;
		if (input.wait && correlationId) {
			if (outcome.finalityWait) {
				await waitForAcceptedCvmOperation(
					client,
					vmUuid,
					{
						correlation_id: correlationId,
						finality_wait: outcome.finalityWait,
					},
					{ onProgress: (message) => context.stderr.write(`${message}\n`) },
				);
			} else {
				try {
					await waitForCvmOperation(client, vmUuid, correlationId, 300_000);
				} catch (error) {
					throw acceptedCvmOperationWaitError(error, vmUuid, correlationId);
				}
			}
		}
		if (input.json)
			context.success({
				vm_uuid: vmUuid,
				status:
					input.wait && correlationId
						? "completed"
						: (outcome.status ?? "in_progress"),
				correlation_id: correlationId || null,
				finality_wait: input.wait ? null : (outcome.finalityWait ?? null),
				port_policy_unlisted_ports: outcome.portPolicyUnlistedPorts,
			});
		else if (outcome.status === "no_change")
			context.stdout.write("No policy change was needed.\n");
		else {
			context.stdout.write(
				`Policy update ${input.wait && correlationId ? "completed" : outcome.finalityWait ? "accepted; waiting for on-chain finality" : "accepted"}.\n`,
			);
			if (correlationId)
				context.stdout.write(`Operation ID: ${correlationId}\n`);
			if (!input.wait)
				context.stdout.write(
					`Check the result with phala port-policy show --cvm-id ${vmUuid}.\n`,
				);
		}
		return 0;
	} catch (error) {
		context.failWithError(error, {
			operation: "Change gateway port policy",
			guidance: portPolicyErrorGuidance(error, target),
		});
		return 1;
	}
}

function positionalPorts(values: string[]): number[] {
	if (values.length === 0)
		throw new Error("Pass at least one guest port (for example, 8080).");
	return parseGatewayPorts(values);
}

const allow = defineCommand({
	path: [...portPolicyGroup.path, "allow"],
	meta: allowMeta,
	schema: allowSchema,
	handler: (input, context) =>
		writePolicy(
			input,
			context,
			(before) =>
				allowGatewayPorts(
					before,
					positionalPorts(input.ports),
					input.proxyProtocol,
				),
			{
				hasPolicyArguments:
					input.ports.length > 0 || input.proxyProtocol !== undefined,
			},
		),
});

const deny = defineCommand({
	path: [...portPolicyGroup.path, "deny"],
	meta: denyMeta,
	schema: denySchema,
	handler: (input, context) =>
		writePolicy(
			input,
			context,
			(before) => denyGatewayPorts(before, positionalPorts(input.ports)),
			{ hasPolicyArguments: input.ports.length > 0 },
		),
});

const replace = defineCommand({
	path: [...portPolicyGroup.path, "replace"],
	meta: replaceMeta,
	schema: replaceSchema,
	handler: (input, context) =>
		writePolicy(input, context, () => replacement(input, context), {
			hasPolicyArguments:
				input.restrict !== undefined ||
				input.denyAll ||
				input.file !== undefined ||
				input.ports.length > 0 ||
				input.proxyPorts.length > 0,
			readsStdin: input.file === "-",
		}),
});

export const portPolicyCommands = {
	group: portPolicyGroup,
	commands: [show, allow, deny, replace],
};
