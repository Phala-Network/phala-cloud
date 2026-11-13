/**
 * Dev-box injection for `phala deploy --dev-os`.
 *
 * Covers the release decision (resolved from the OS image catalog, never
 * guessed), the compose rewriting itself, and the conflicts the CLI refuses to
 * paper over.
 */

import { describe, expect, test } from "bun:test";
import {
	DEV_BOX_IMAGE,
	type OsImageCatalogEntry,
	composeHasDevBox,
	findOsImage,
	injectDevBoxService,
	parseImageVersion,
	resolveDevOsMode,
} from "./dev-box";

const DEV_BOX_SERVICE = `  dev-box:
    image: ${DEV_BOX_IMAGE}
    restart: unless-stopped
    privileged: true
    pid: host
    network_mode: host
    uts: host
    environment:
      - SSH_AUTHORIZED_KEYS=\${DSTACK_AUTHORIZED_KEYS}
    volumes:
      - /:/host:rslave
      - /var/run/docker.sock:/var/run/docker.sock
      - /dev/pts:/dev/pts
      - ssh-host-keys:/etc/ssh/host-keys
      - home:/root`;

const SERVICES_ONLY = `services:
  app:
    image: nginx`;

function catalogEntry(
	overrides: Partial<OsImageCatalogEntry> & { version: string },
): OsImageCatalogEntry {
	return {
		name: `dstack-${overrides.version}`,
		slug: `dstack-${overrides.version}`,
		version: overrides.version,
		is_dev: false,
		os_image_hash: null,
		...overrides,
	};
}

const CATALOG: OsImageCatalogEntry[] = [
	catalogEntry({
		version: "0.6.0",
		slug: "dstack-0.6.0",
		name: "dstack-0.6.0",
		os_image_hash: "aa".repeat(32),
	}),
	catalogEntry({
		version: "0.5.7",
		slug: "dstack-0.5.7",
		name: "prod-0.5.7",
		os_image_hash: "bb".repeat(32),
	}),
	catalogEntry({
		version: "0.5.7",
		slug: "dstack-dev-0.5.7",
		name: "dev-0.5.7",
		is_dev: true,
	}),
	catalogEntry({ version: "0.5.4", slug: "my-custom-image", name: "custom" }),
];

describe("resolveDevOsMode", () => {
	test("rejects --dev-os without a pinned image", () => {
		expect(() => resolveDevOsMode(undefined, CATALOG)).toThrow(
			/needs an explicit OS image/,
		);
	});

	test("rejects an image the catalog does not know", () => {
		expect(() => resolveDevOsMode("a-custom-slug", CATALOG)).toThrow(
			/not in the OS image catalog/,
		);
		expect(() => resolveDevOsMode("ff".repeat(32), CATALOG)).toThrow(
			/not in the OS image catalog/,
		);
	});

	test("resolves by slug, name and image hash", () => {
		expect(resolveDevOsMode("dstack-0.6.0", CATALOG)).toBe("dev-box");
		expect(resolveDevOsMode("prod-0.5.7", CATALOG)).toBe("dev-image");
		expect(resolveDevOsMode("bb".repeat(32), CATALOG)).toBe("dev-image");
	});

	test("takes the dev-box path from 0.6 on", () => {
		expect(resolveDevOsMode("aa".repeat(32), CATALOG)).toBe("dev-box");
	});

	test("keeps the dev image below 0.6, dev or prod", () => {
		expect(resolveDevOsMode("dstack-0.5.7", CATALOG)).toBe("dev-image");
		expect(resolveDevOsMode("dstack-dev-0.5.7", CATALOG)).toBe("dev-image");
	});

	test("compares releases numerically", () => {
		const catalog = [
			catalogEntry({ version: "0.10.0", slug: "dstack-0.10.0" }),
			catalogEntry({ version: "0.5.10", slug: "dstack-0.5.10" }),
		];
		expect(resolveDevOsMode("dstack-0.10.0", catalog)).toBe("dev-box");
		expect(resolveDevOsMode("dstack-0.5.10", catalog)).toBe("dev-image");
	});

	test("fails when the catalog entry has no usable release", () => {
		const catalog = [catalogEntry({ version: "latest", slug: "latest-image" })];
		expect(() => resolveDevOsMode("latest-image", catalog)).toThrow(
			/no recognizable dstack release/,
		);
	});
});

describe("findOsImage", () => {
	test("refuses an ambiguous name", () => {
		const catalog = [
			catalogEntry({ version: "0.5.7", slug: "a", name: "same" }),
			catalogEntry({ version: "0.6.0", slug: "b", name: "same" }),
		];
		expect(findOsImage(catalog, "same")).toBeUndefined();
	});
});

describe("parseImageVersion", () => {
	test("reads a release", () => {
		expect(parseImageVersion("0.5.7")).toEqual([0, 5, 7]);
		expect(parseImageVersion("0.5.4.1")).toEqual([0, 5, 4]);
		expect(parseImageVersion("0.6.0-rc1")).toEqual([0, 6, 0]);
	});

	test("returns undefined when there is no release", () => {
		expect(parseImageVersion(undefined)).toBeUndefined();
		expect(parseImageVersion("latest")).toBeUndefined();
	});
});

describe("injectDevBoxService", () => {
	test("adds the canonical dev-box service and the volumes it mounts", () => {
		expect(injectDevBoxService(SERVICES_ONLY)).toBe(
			`${SERVICES_ONLY}\n${DEV_BOX_SERVICE}\nvolumes:\n  ssh-host-keys:\n  home:`,
		);
	});

	test("keeps the top-level keys that follow services", () => {
		const injected = injectDevBoxService(
			`${SERVICES_ONLY}\n\nnetworks:\n  default:\n    driver: bridge\n`,
		);

		expect(injected).toContain(DEV_BOX_SERVICE);
		expect(injected).toContain("networks:\n  default:\n    driver: bridge");
		expect(injected.indexOf("dev-box:")).toBeLessThan(
			injected.indexOf("networks:"),
		);
	});

	test("is idempotent when a dev box is already there", () => {
		const once = injectDevBoxService(SERVICES_ONLY);

		expect(composeHasDevBox(once)).toBe(true);
		expect(injectDevBoxService(once)).toBe(once);
	});

	test("accepts a canonical dev box on a pinned dev-box tag", () => {
		const compose = `services:
  ssh:
    image: ghcr.io/dstack-tee/dstack-dev-box:0.6.0
    privileged: "true"
    network_mode: 'host'
    pid: host
    uts: host
`;

		expect(composeHasDevBox(compose)).toBe(true);
		expect(injectDevBoxService(compose)).toBe(compose);
	});

	test("rejects the dev-box image without the dev-box markers", () => {
		const compose = `services:
  ssh:
    image: ${DEV_BOX_IMAGE}
    network_mode: host
`;

		expect(() => injectDevBoxService(compose)).toThrow(
			/uses the dev-box image but is not configured as the dev box/,
		);
	});

	test("rejects a service named dev-box that is not a dev box", () => {
		const compose = `services:
  dev-box:
    image: busybox
`;

		expect(() => injectDevBoxService(compose)).toThrow(/is not a dev box/);
	});

	test("rejects the four markers on another image", () => {
		const compose = `services:
  wireguard:
    image: linuxserver/wireguard
    privileged: true
    network_mode: host
    pid: host
    uts: host
`;

		expect(composeHasDevBox(compose)).toBe(false);
		expect(() => injectDevBoxService(compose)).toThrow(
			/which Phala Cloud reads as the dev box/,
		);
	});

	test("rejects a top-level volume named like one the dev box needs", () => {
		const compose = `services:
  app:
    image: nginx
volumes:
  data:
  home:
`;

		expect(() => injectDevBoxService(compose)).toThrow(
			/already declares a top-level volume named "home"/,
		);
	});

	test("adds the volumes to an existing volumes section", () => {
		const injected = injectDevBoxService(`services:
  app:
    image: nginx
volumes:
  data:
`);

		expect(injected).toContain(
			"volumes:\n  data:\n  ssh-host-keys:\n  home:\n",
		);
	});

	test("follows the file's own indentation", () => {
		const compose = `services:
    app:
        image: nginx`;

		const injected = injectDevBoxService(compose);

		expect(injected).toContain("    dev-box:\n        image: ");
		expect(injected).toContain(
			"        environment:\n            - SSH_AUTHORIZED_KEYS=",
		);
	});

	test("handles a compose with no services section", () => {
		expect(() => injectDevBoxService("name: app\n")).toThrow(
			/no top-level services section/,
		);
	});

	test("refuses a services section written inline", () => {
		expect(() =>
			injectDevBoxService("services: {app: {image: nginx}}\n"),
		).toThrow(/written inline/);
	});

	test("preserves CRLF line endings", () => {
		const compose = "services:\r\n  app:\r\n    image: nginx\r\n";

		const injected = injectDevBoxService(compose);

		expect(injected).toContain("\r\n  dev-box:\r\n");
		expect(injected.replace(/\r\n/g, "")).not.toContain("\n");
	});
});
