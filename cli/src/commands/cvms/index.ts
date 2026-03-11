import { cvmsGroup } from "./command";
import { cvmsAttestationCommand } from "./attestation";
import { cvmsCreateCommand } from "./create";
import { cvmsDeleteCommand } from "./delete";
import { cvmsDeviceAllowlistCommand } from "./device-allowlist";
import { cvmsDevicesCommands } from "./devices";
import { cvmsGetCommand } from "./get";
import { cvmsListCommand } from "./list";
import { cvmsListNodesCommand } from "./list-node";
import { cvmsLogsCommand } from "./logs";
import { cvmsReplicateCommand } from "./replicate";
import { cvmsResizeCommand } from "./resize";
import { cvmsRestartCommand } from "./restart";
import { cvmsSerialLogsCommand } from "./serial-logs";
import { cvmsStartCommand } from "./start";
import { cvmsStopCommand } from "./stop";
import { cvmsUpgradeCommand } from "./upgrade";

export const cvmsCommands = {
	group: cvmsGroup,
	commands: [
		cvmsAttestationCommand,
		cvmsCreateCommand,
		cvmsDeleteCommand,
		cvmsDeviceAllowlistCommand,
		cvmsGetCommand,
		cvmsListCommand,
		cvmsListNodesCommand,
		cvmsLogsCommand,
		cvmsReplicateCommand,
		cvmsResizeCommand,
		cvmsRestartCommand,
		cvmsSerialLogsCommand,
		cvmsStartCommand,
		cvmsStopCommand,
		cvmsUpgradeCommand,
	],
	subgroups: [cvmsDevicesCommands],
};

export default cvmsCommands;
