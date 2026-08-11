import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolve the published CLI package version for outbound identification.
 *
 * Source layout:  cli/src/utils -> ../../package.json
 * Built layout:   cli/dist/utils -> ../../package.json
 */
function readPackageVersion(): string {
	const here = dirname(fileURLToPath(import.meta.url));
	const candidates = [
		join(here, "../../package.json"),
		join(here, "../package.json"),
	];
	for (const path of candidates) {
		try {
			const pkg = JSON.parse(readFileSync(path, "utf-8")) as {
				version?: string;
			};
			if (pkg.version) {
				return pkg.version;
			}
		} catch {
			// try next candidate
		}
	}
	return "unknown";
}

/** Package version from cli/package.json (e.g. 1.1.21-beta.1). */
export const CLI_PACKAGE_VERSION = readPackageVersion();

/**
 * User-Agent sent on every CLI HTTP request so backend activity logs can
 * distinguish phala CLI traffic from bare Node/SDK clients.
 */
export const CLI_USER_AGENT = `phala-cli/${CLI_PACKAGE_VERSION}`;
