import { cvmsAttestationCommand } from "./attestation";
import { cvmsGroup } from "./command";
import { cvmsDeleteCommand } from "./delete";
import { cvmsDeviceAllowlistCommand } from "./device-allowlist";
import { cvmsGetCommand } from "./get";
import { cvmsGpuStatusCommand } from "./gpu-status";
import { cvmsInitScriptsCommand } from "./init-scripts";
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
		cvmsDeleteCommand,
		cvmsDeviceAllowlistCommand,
		cvmsGetCommand,
		cvmsGpuStatusCommand,
		cvmsInitScriptsCommand,
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
	subgroups: [],
};

export default cvmsCommands;
