import { createInterface } from "node:readline/promises";
import type { CommandContext, CommandOption } from "@/src/core/types";
import { normalizeCliError } from "@/src/utils/logger";
import type { PortClosure } from "./port-policy";

export const confirmPortClosureOption: CommandOption = {
	name: "confirm-close",
	type: "string[]",
	argumentName: "8090|22|all",
	description:
		"Confirm newly blocking a gateway port or all ports (repeatable)",
	target: "confirmClose",
};

const closureWarnings: Record<PortClosure, string> = {
	"8090":
		"Blocking gateway port 8090 prevents Phala Cloud from reading logs, status, and attestation data from this CVM. To keep Cloud access and block public access instead, change guest agent access in the console.",
	"22": "Blocking gateway port 22 can cut off SSH through the gateway.",
	all: "This policy blocks every gateway port, including SSH. Phala Cloud will no longer be able to read logs, status, or attestation data from this CVM.",
};

export function canConfirmInteractively(
	context: CommandContext,
	json: boolean,
): boolean {
	return !json && context.stdin.isTTY === true && context.stderr.isTTY === true;
}

export async function askPortPolicyQuestion(
	context: CommandContext,
	message: string,
): Promise<boolean> {
	const prompt = createInterface({
		input: context.stdin,
		output: context.stderr,
	});
	try {
		return /^(y|yes)$/i.test(
			(await prompt.question(`${message} [y/N] `)).trim(),
		);
	} finally {
		prompt.close();
	}
}

export async function confirmGatewayClosures(
	context: CommandContext,
	closures: readonly PortClosure[],
	confirmed: readonly PortClosure[],
	interactive: boolean,
): Promise<boolean> {
	const isConfirmed = (closure: PortClosure) =>
		confirmed.includes("all") || confirmed.includes(closure);
	const missing = closures.filter((closure) => !isConfirmed(closure));
	if (missing.length > 0 && !interactive) {
		throw new Error(
			`${missing.map((closure) => closureWarnings[closure]).join("\n")}\nPass ${missing.map((closure) => `--confirm-close ${closure}`).join(" ")} to continue.`,
		);
	}
	for (const closure of closures) {
		context.stderr.write(`${closureWarnings[closure]}\n`);
		if (
			!isConfirmed(closure) &&
			!(await askPortPolicyQuestion(
				context,
				`Confirm closing ${closure === "all" ? "all gateway ports" : `gateway port ${closure}`}?`,
			))
		) {
			return false;
		}
	}
	return true;
}

export function portPolicyErrorGuidance(
	error: unknown,
	cvmId?: string,
): string | undefined {
	const normalized = normalizeCliError(error);
	switch (normalized.errorCode) {
		case "ERR-03-010": {
			const appId = cvmId?.replace(/^(app_|0x)/i, "") ?? "<app-id>";
			return `More than one CVM matched. Run phala instances ls --app-id ${appId}, then pass --cvm-id <vm_uuid> or set uuid in phala.toml.`;
		}
		case "ERR-03-069":
			return "The change would block gateway port 8090 without confirmation. Include port 8090 in the policy, or rerun with --confirm-close 8090.";
		case "ERR-03-070":
			return "The requested closure of port 8090 cannot take effect. Use a dstack OS image of version 0.5.9 or later and a restricted policy that leaves port 8090 out.";
		case "ERR-03-072":
			return `Rerun phala port-policy show${cvmId ? ` --cvm-id ${cvmId}` : ""}, review the current policy, and retry.`;
		default:
			return undefined;
	}
}
