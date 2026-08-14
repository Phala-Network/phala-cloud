import { safeGetCvmUserConfig } from "@phala/cloud";
import { defineCommand } from "@/src/core/define-command";
import { isInJsonMode } from "@/src/core/json-mode";
import type { CommandContext } from "@/src/core/types";
import { getClient } from "@/src/lib/client";
import { sshKeyFingerprint } from "@/src/utils/ssh-utils";
import {
	cvmsRuntimeConfigCommandMeta,
	cvmsRuntimeConfigCommandSchema,
	type CvmsRuntimeConfigCommandInput,
} from "./command";

async function runCvmsRuntimeConfigCommand(
	input: CvmsRuntimeConfigCommandInput,
	context: CommandContext,
): Promise<number> {
	if (!context.cvmId) {
		context.fail(
			"No CVM ID provided. Either pass a CVM ID as argument or configure it in phala.toml.",
		);
		return 1;
	}

	try {
		const client = await getClient(context);
		const result = await safeGetCvmUserConfig(client, context.cvmId);

		if (!result.success) {
			context.failWithError(result.error.cause ?? result.error, {
				operation: "Get runtime config",
				debug: Boolean((input as { debug?: boolean }).debug),
			});
			return 1;
		}

		const config = result.data;

		if (isInJsonMode()) {
			context.success(config);
			return 0;
		}

		console.log(`Hostname:       ${config.hostname ?? "-"}`);
		console.log(`Gateway Domain: ${config.default_gateway_domain ?? "-"}`);
		console.log(
			`SSH Keys:       ${config.ssh_authorized_keys.length > 0 ? `${config.ssh_authorized_keys.length} key(s)` : "none"}`,
		);

		if (config.ssh_authorized_keys.length > 0) {
			console.log();
			console.log("SSH Authorized Keys:");
			for (const key of config.ssh_authorized_keys) {
				// The fingerprint is what `phala ssh-keys list`, GitHub, and the
				// CVM boot log all show, so print it above the key it belongs to.
				console.log(`  ${sshKeyFingerprint(key) ?? "SHA256:<unrecognized>"}`);
				console.log(`    ${key}`);
			}
		}

		return 0;
	} catch (error) {
		context.failWithError(error, {
			operation: "Get runtime config",
			debug: Boolean((input as { debug?: boolean }).debug),
		});
		return 1;
	}
}

export const cvmsRuntimeConfigCommand = defineCommand({
	path: ["runtime-config"],
	meta: cvmsRuntimeConfigCommandMeta,
	schema: cvmsRuntimeConfigCommandSchema,
	handler: runCvmsRuntimeConfigCommand,
});
