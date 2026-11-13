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
	composeHasDevBoxMarkers,
	findOsImage,
	injectDevBoxService,
	isCanonicalDevBoxService,
	parseImageVersion,
	resolveDevOsPlan,
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

describe("resolveDevOsPlan", () => {
	test("rejects --dev-os without a pinned image", () => {
		expect(() => resolveDevOsPlan(undefined, CATALOG)).toThrow(
			/needs an explicit OS image/,
		);
	});

	test("rejects an image the catalog does not know", () => {
		expect(() => resolveDevOsPlan("a-custom-slug", CATALOG)).toThrow(
			/not in the OS image catalog/,
		);
		expect(() => resolveDevOsPlan("ff".repeat(32), CATALOG)).toThrow(
			/not in the OS image catalog/,
		);
	});

	test("resolves by slug, name and image hash", () => {
		expect(resolveDevOsPlan("dstack-0.6.0", CATALOG)).toEqual({
			mode: "dev-box",
			image: "dstack-0.6.0",
		});
		expect(resolveDevOsPlan("prod-0.5.7", CATALOG)).toEqual({
			mode: "dev-image",
			image: "dstack-dev-0.5.7",
		});
		expect(resolveDevOsPlan("bb".repeat(32), CATALOG)).toEqual({
			mode: "dev-image",
			image: "dstack-dev-0.5.7",
		});
	});

	test("takes the dev-box path from 0.6 on", () => {
		expect(resolveDevOsPlan("aa".repeat(32), CATALOG).mode).toBe("dev-box");
	});

	test("below 0.6 deploys the dev image, not the production one", () => {
		// The backend ignores prefer_dev when the request names an image, so
		// sending the production slug would deploy a CVM with no sshd.
		expect(resolveDevOsPlan("dstack-0.5.7", CATALOG).image).toBe(
			"dstack-dev-0.5.7",
		);
		expect(resolveDevOsPlan("dstack-dev-0.5.7", CATALOG).image).toBe(
			"dstack-dev-0.5.7",
		);
	});

	test("matches a dev variant by name when the catalog flag is missing", () => {
		const catalog = [
			catalogEntry({ version: "0.5.6", slug: "dstack-0.5.6" }),
			catalogEntry({ version: "0.5.6", slug: "dev-0.5.6", is_dev: false }),
		];
		expect(resolveDevOsPlan("dstack-0.5.6", catalog).image).toBe("dev-0.5.6");
	});

	test("fails when a release below 0.6 has no dev variant", () => {
		// "my-custom-image" is 0.5.4, and the catalog has no dev image of it.
		expect(() => resolveDevOsPlan("my-custom-image", CATALOG)).toThrow(
			/no dev variant of "0.5.4"/,
		);
	});

	test("fails when the dev variant is ambiguous", () => {
		const catalog = [
			catalogEntry({ version: "0.5.7", slug: "dstack-0.5.7" }),
			catalogEntry({ version: "0.5.7", slug: "dev-a-0.5.7", is_dev: true }),
			catalogEntry({ version: "0.5.7", slug: "dev-b-0.5.7", is_dev: true }),
		];
		expect(() => resolveDevOsPlan("dstack-0.5.7", catalog)).toThrow(
			/2 dev variants of dstack 0.5.7/,
		);
	});

	test("compares releases numerically", () => {
		const catalog = [
			catalogEntry({ version: "0.10.0", slug: "dstack-0.10.0" }),
			catalogEntry({ version: "0.5.10", slug: "dstack-0.5.10" }),
			catalogEntry({ version: "0.5.10", slug: "dev-0.5.10", is_dev: true }),
		];
		expect(resolveDevOsPlan("dstack-0.10.0", catalog).mode).toBe("dev-box");
		expect(resolveDevOsPlan("dstack-0.5.10", catalog)).toEqual({
			mode: "dev-image",
			image: "dev-0.5.10",
		});
	});

	test("fails when the catalog entry has no usable release", () => {
		const catalog = [catalogEntry({ version: "latest", slug: "latest-image" })];
		expect(() => resolveDevOsPlan("latest-image", catalog)).toThrow(
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

	test("does not accept another tag of the dev-box image as canonical", () => {
		// The pin is exact on purpose: another tag is another build, and the dev
		// box is the container that grants SSH access to the host.
		const compose = `services:
  ssh:
    image: ghcr.io/dstack-tee/dstack-dev-box:0.6.0
    privileged: true
    network_mode: 'host'
    pid: "host"
    uts: host
    environment:
      - SSH_AUTHORIZED_KEYS=\${DSTACK_AUTHORIZED_KEYS}
    volumes:
      - /:/host:rslave
      - ssh-host-keys:/etc/ssh/host-keys
      - home:/root
`;

		expect(composeHasDevBox(compose)).toBe(false);
		expect(() => injectDevBoxService(compose)).toThrow(
			/uses the dev-box image but is not configured as the dev box/,
		);
	});

	test("accepts long-syntax mounts on the pinned image", () => {
		const compose = `services:
  ssh:
    image: ${DEV_BOX_IMAGE}
    privileged: true
    pid: host
    network_mode: host
    uts: host
    environment:
      SSH_AUTHORIZED_KEYS: \${DSTACK_AUTHORIZED_KEYS}
    volumes:
      - type: bind
        source: /
        target: /host
      - type: volume
        source: ssh-host-keys
        target: /etc/ssh/host-keys
      - type: volume
        source: home
        target: /root
`;

		expect(composeHasDevBox(compose)).toBe(true);
		expect(injectDevBoxService(compose)).toBe(compose);
	});

	test("does not count a quoted privileged value, which is a string", () => {
		const compose = `services:
  ssh:
    image: ${DEV_BOX_IMAGE}
    privileged: "true"
    pid: host
    network_mode: host
    uts: host
`;

		expect(composeHasDevBox(compose)).toBe(false);
		expect(() => injectDevBoxService(compose)).toThrow(
			/uses the dev-box image but is not configured as the dev box/,
		);
	});

	test("does not read a quoted privileged value as a dev-box marker on another image", () => {
		const compose = `services:
  wireguard:
    image: linuxserver/wireguard
    privileged: "true"
    pid: host
    network_mode: host
    uts: host
`;

		expect(composeHasDevBox(compose)).toBe(false);
		expect(injectDevBoxService(compose)).toContain("  dev-box:\n");
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

	test.each([
		["profiles", "    profiles: [debug]\n"],
		["a block-style profiles list", "    profiles:\n      - debug\n"],
		["a command", '    command: ["sleep", "infinity"]\n'],
		["an entrypoint", "    entrypoint: /bin/sh\n"],
		// In compose an empty entrypoint replaces the image's with nothing, which
		// leaves no sshd running. Only absent/null means unset here.
		["an empty entrypoint list", "    entrypoint: []\n"],
		["an empty entrypoint string", '    entrypoint: ""\n'],
	])("does not treat a dev box with %s as canonical", (_label, extra) => {
		const compose = `services:
  ssh:
    image: ${DEV_BOX_IMAGE}
    privileged: true
    pid: host
    network_mode: host
    uts: host
${extra}    environment:
      - SSH_AUTHORIZED_KEYS=\${DSTACK_AUTHORIZED_KEYS}
    volumes:
      - /:/host:rslave
      - ssh-host-keys:/etc/ssh/host-keys
      - home:/root
`;

		expect(composeHasDevBox(compose)).toBe(false);
		expect(() => injectDevBoxService(compose)).toThrow(
			/uses the dev-box image but is not configured as the dev box/,
		);
	});

	test("treats a null entrypoint as unset", () => {
		const compose = `services:
  ssh:
    image: ${DEV_BOX_IMAGE}
    privileged: true
    pid: host
    network_mode: host
    uts: host
    entrypoint: null
    environment:
      - SSH_AUTHORIZED_KEYS=\${DSTACK_AUTHORIZED_KEYS}
    volumes:
      - /:/host:rslave
      - ssh-host-keys:/etc/ssh/host-keys
      - home:/root
`;

		expect(composeHasDevBox(compose)).toBe(true);
	});

	test("keeps working with a blank command, which says nothing", () => {
		const compose = `services:
  ssh:
    image: ${DEV_BOX_IMAGE}
    privileged: true
    pid: host
    network_mode: host
    uts: host
    command: ""
    profiles: []
    environment:
      - SSH_AUTHORIZED_KEYS=\${DSTACK_AUTHORIZED_KEYS}
    volumes:
      - /:/host:rslave
      - ssh-host-keys:/etc/ssh/host-keys
      - home:/root
`;

		expect(composeHasDevBox(compose)).toBe(true);
	});

	test("does not treat a dev box without the SSH_AUTHORIZED_KEYS template as canonical", () => {
		const compose = `services:
  ssh:
    image: ${DEV_BOX_IMAGE}
    privileged: true
    pid: host
    network_mode: host
    uts: host
    environment:
      - DSTACK_AUTHORIZED_KEYS=\${DSTACK_AUTHORIZED_KEYS}
    volumes:
      - /:/host:rslave
      - ssh-host-keys:/etc/ssh/host-keys
      - home:/root
`;

		expect(composeHasDevBox(compose)).toBe(false);
		expect(() => injectDevBoxService(compose)).toThrow(
			/uses the dev-box image but is not configured as the dev box/,
		);
	});

	test.each([
		[
			"the host filesystem",
			"- ssh-host-keys:/etc/ssh/host-keys\n      - home:/root",
		],
		["the host keys volume", "- /:/host:rslave\n      - home:/root"],
		[
			"the home volume",
			"- /:/host:rslave\n      - ssh-host-keys:/etc/ssh/host-keys",
		],
	])("does not treat a dev box without %s as canonical", (_label, mounts) => {
		const compose = `services:
  ssh:
    image: ${DEV_BOX_IMAGE}
    privileged: true
    pid: host
    network_mode: host
    uts: host
    environment:
      - SSH_AUTHORIZED_KEYS=\${DSTACK_AUTHORIZED_KEYS}
    volumes:
      ${mounts}
`;

		expect(composeHasDevBox(compose)).toBe(false);
		expect(() => injectDevBoxService(compose)).toThrow(
			/uses the dev-box image but is not configured as the dev box/,
		);
	});

	test("does not accept a lookalike image repository", () => {
		const compose = `services:
  ssh:
    image: ghcr.io/dstack-tee/dstack-dev-box-mirror:latest
    privileged: true
    pid: host
    network_mode: host
    uts: host
    environment:
      - SSH_AUTHORIZED_KEYS=\${DSTACK_AUTHORIZED_KEYS}
    volumes:
      - /:/host:rslave
      - ssh-host-keys:/etc/ssh/host-keys
      - home:/root
`;

		expect(composeHasDevBox(compose)).toBe(false);
		// The markers still make the backend read it as the dev box, so the CLI
		// refuses to author it rather than skipping the injection silently.
		expect(() => injectDevBoxService(compose)).toThrow(
			/which Phala Cloud reads as the dev box/,
		);
	});

	test("reports no dev box for a compose it cannot follow instead of throwing", () => {
		expect(composeHasDevBox("services: {app: {image: nginx}}\n")).toBe(false);
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

	test("rejects a volume the compose inherits through a merge key", () => {
		// `volumes: {<<: *storage}` already owns `home`; appending a bare `home:`
		// would replace the operator's production volume with an empty default.
		const compose = `x-volumes: &storage
  home:
    external: true
    name: production-data
services:
  web:
    image: nginx
    volumes:
      - home:/data
volumes:
  <<: *storage
`;

		expect(() => injectDevBoxService(compose)).toThrow(
			/already declares a top-level volume named "home"/,
		);
	});

	test("adds its volumes beside ones inherited through a merge key", () => {
		const compose = `x-volumes: &storage
  data:
    driver: local
services:
  web:
    image: nginx
volumes:
  <<: *storage
`;

		const injected = injectDevBoxService(compose);

		// The merge stays where it is; the two new names are appended to it, and
		// `data` still comes from the anchor.
		expect(injected).toContain(
			"volumes:\n  <<: *storage\n  ssh-host-keys:\n  home:\n",
		);
		expect(composeHasDevBox(compose)).toBe(false);
		expect(composeHasDevBox(injected)).toBe(true);
		expect(composeHasDevBoxMarkers(injected)).toBe(true);
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

	test("adds the service to a services block that opens with an anchor", () => {
		const injected = injectDevBoxService(`services: &all
  app:
    image: nginx
`);

		expect(injected).toContain("  dev-box:\n");
		expect(composeHasDevBox(injected)).toBe(true);
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

/**
 * Detection works on the parsed YAML, so the shapes a line scanner gets wrong —
 * anchors and merge keys, flow mappings, inline comments, the boolean spellings
 * PyYAML accepts — are read the way the backend reads them.
 */
describe("dev-box detection on parsed YAML", () => {
	test("sees a dev box whose fields come from a merge key", () => {
		const compose = `x-dev-box: &dev-box
  image: ${DEV_BOX_IMAGE}
  privileged: true
  pid: host
  network_mode: host
  uts: host
services:
  app:
    image: nginx
  ssh:
    <<: *dev-box
    environment:
      - SSH_AUTHORIZED_KEYS=\${DSTACK_AUTHORIZED_KEYS}
    volumes:
      - /:/host:rslave
      - ssh-host-keys:/etc/ssh/host-keys
      - home:/root
`;

		expect(composeHasDevBox(compose)).toBe(true);
		// Already there once: never a second copy.
		expect(injectDevBoxService(compose)).toBe(compose);
	});

	test("sees a dev box written as a flow mapping", () => {
		const compose = `services:
  app:
    image: nginx
  ssh: {image: "${DEV_BOX_IMAGE}", privileged: true, pid: host, network_mode: host, uts: host, environment: ["SSH_AUTHORIZED_KEYS=\${DSTACK_AUTHORIZED_KEYS}"], volumes: ["/:/host:rslave", "ssh-host-keys:/etc/ssh/host-keys", "home:/root"]}
`;

		expect(composeHasDevBox(compose)).toBe(true);
		expect(injectDevBoxService(compose)).toBe(compose);
	});

	test.each([
		["True"],
		["TRUE"],
		// YAML 1.1 booleans, which PyYAML resolves on the backend.
		["yes"],
		["on"],
	])("reads %s as the privileged boolean", (flag) => {
		const compose = `services:
  ssh:
    image: ${DEV_BOX_IMAGE}
    privileged: ${flag}
    pid: host
    network_mode: host
    uts: host
    environment:
      - SSH_AUTHORIZED_KEYS=\${DSTACK_AUTHORIZED_KEYS}
    volumes:
      - /:/host:rslave
      - ssh-host-keys:/etc/ssh/host-keys
      - home:/root
`;

		expect(composeHasDevBox(compose)).toBe(true);
	});

	test("does not read a quoted boolean spelling as privileged", () => {
		const compose = `services:
  ssh:
    image: ${DEV_BOX_IMAGE}
    privileged: "yes"
    pid: host
    network_mode: host
    uts: host
    environment:
      - SSH_AUTHORIZED_KEYS=\${DSTACK_AUTHORIZED_KEYS}
    volumes:
      - /:/host:rslave
      - ssh-host-keys:/etc/ssh/host-keys
      - home:/root
`;

		expect(composeHasDevBox(compose)).toBe(false);
	});

	test("ignores an inline comment after a marker", () => {
		const compose = `services:
  ssh:
    image: ${DEV_BOX_IMAGE}
    privileged: true # run as root
    pid: host # share the host PID namespace
    network_mode: host
    uts: host
    environment:
      - SSH_AUTHORIZED_KEYS=\${DSTACK_AUTHORIZED_KEYS} # merged by the entrypoint
    volumes:
      - /:/host:rslave
      - ssh-host-keys:/etc/ssh/host-keys
      - home:/root
`;

		expect(composeHasDevBox(compose)).toBe(true);
	});

	test("reads a repeated key the way PyYAML does, last value wins", () => {
		const compose = `services:
  ssh:
    image: busybox
    image: ${DEV_BOX_IMAGE}
    privileged: true
    pid: host
    network_mode: host
    uts: host
    environment:
      - SSH_AUTHORIZED_KEYS=\${DSTACK_AUTHORIZED_KEYS}
    volumes:
      - /:/host:rslave
      - ssh-host-keys:/etc/ssh/host-keys
      - home:/root
`;

		expect(composeHasDevBox(compose)).toBe(true);
	});

	test("refuses to add a second dev box to YAML it cannot parse", () => {
		const broken = "services:\n  ssh:\n    image: [unclosed\n";

		expect(composeHasDevBox(broken)).toBe(false);
		expect(() => injectDevBoxService(broken)).toThrow(/not valid YAML/);
	});
});

/**
 * The backend's own rule, used for the SSH key channel: the four markers alone,
 * never the canonical shape or the image.
 */
describe("composeHasDevBoxMarkers", () => {
	const MARKED_BOX = `services:
  app:
    image: nginx
  ssh:
    image: ghcr.io/dstack-tee/dstack-dev-box:latest
    privileged: true
    pid: host
    network_mode: host
    uts: host
    environment:
      - MY_KEYS=\${DSTACK_AUTHORIZED_KEYS}
    volumes:
      - /:/host:rslave
      - my-keys:/etc/ssh/host-keys
      - my-home:/root
`;

	test("sees a dev box the canonical check refuses", () => {
		// Custom volume names and a custom env name: the CLI would not have
		// written it, but the backend still grants SSH through it.
		expect(composeHasDevBox(MARKED_BOX)).toBe(false);
		expect(composeHasDevBoxMarkers(MARKED_BOX)).toBe(true);
	});

	test("needs all four markers", () => {
		const threeMarkers = MARKED_BOX.replace("    uts: host\n", "");
		expect(composeHasDevBoxMarkers(threeMarkers)).toBe(false);
	});

	test("does not count a quoted privileged value", () => {
		const quoted = MARKED_BOX.replace("privileged: true", 'privileged: "true"');
		expect(composeHasDevBoxMarkers(quoted)).toBe(false);
	});

	test("resolves merge keys before reading the markers", () => {
		const compose = `x-box: &box
  privileged: true
  pid: host
  network_mode: host
  uts: host
services:
  ssh:
    <<: *box
    image: ghcr.io/dstack-tee/dstack-dev-box:latest
`;
		expect(composeHasDevBoxMarkers(compose)).toBe(true);
	});

	test("unwraps an --app-compose document", () => {
		const payload = JSON.stringify({
			name: "raw",
			docker_compose_file: MARKED_BOX,
		});
		expect(composeHasDevBoxMarkers(payload)).toBe(true);
	});

	test("does not treat unrelated JSON as a dev box", () => {
		expect(composeHasDevBoxMarkers(JSON.stringify({ name: "raw" }))).toBe(
			false,
		);
	});
});

/**
 * The env binding, not the env name: the dev box only delivers the platform's
 * keys when the whole value is `DSTACK_AUTHORIZED_KEYS` itself, which is what
 * the launch form's `bindsAuthorizedKeys` requires too.
 */
describe("dev-box SSH_AUTHORIZED_KEYS binding", () => {
	/** A canonical dev box whose `environment` is the argument. */
	function service(environment: unknown) {
		return {
			image: DEV_BOX_IMAGE,
			privileged: true,
			pid: "host",
			network_mode: "host",
			uts: "host",
			environment,
			volumes: [
				"/:/host:rslave",
				"ssh-host-keys:/etc/ssh/host-keys",
				"home:/root",
			],
		};
	}

	test.each([
		["list, braced", ["SSH_AUTHORIZED_KEYS=${DSTACK_AUTHORIZED_KEYS}"]],
		["list, bare", ["SSH_AUTHORIZED_KEYS=$DSTACK_AUTHORIZED_KEYS"]],
		[
			"list, default when unset or empty",
			["SSH_AUTHORIZED_KEYS=${DSTACK_AUTHORIZED_KEYS:-fallback}"],
		],
		[
			"map, default when unset",
			{ SSH_AUTHORIZED_KEYS: "${DSTACK_AUTHORIZED_KEYS-fallback}" },
		],
	])("accepts %s", (_label, environment) => {
		expect(isCanonicalDevBoxService(service(environment))).toBe(true);
	});

	test.each([
		[
			"the alternate value form",
			["SSH_AUTHORIZED_KEYS=${DSTACK_AUTHORIZED_KEYS:+not-a-key}"],
		],
		[
			"the bare alternate form",
			["SSH_AUTHORIZED_KEYS=${DSTACK_AUTHORIZED_KEYS+x}"],
		],
		[
			"the error form",
			["SSH_AUTHORIZED_KEYS=${DSTACK_AUTHORIZED_KEYS:?missing}"],
		],
		[
			"the bare error form",
			["SSH_AUTHORIZED_KEYS=${DSTACK_AUTHORIZED_KEYS?missing}"],
		],
		["the escaped literal", ["SSH_AUTHORIZED_KEYS=$${DSTACK_AUTHORIZED_KEYS}"]],
		[
			"a suffix smuggled past the closing brace",
			["SSH_AUTHORIZED_KEYS=${DSTACK_AUTHORIZED_KEYS:-}suffix}"],
		],
		[
			"a nested expression as the default",
			["SSH_AUTHORIZED_KEYS=${DSTACK_AUTHORIZED_KEYS:-${OTHER}}"],
		],
		[
			"a nested expression in the bare default form",
			["SSH_AUTHORIZED_KEYS=${DSTACK_AUTHORIZED_KEYS-${OTHER}}"],
		],
		["a prefix", ["SSH_AUTHORIZED_KEYS=key-${DSTACK_AUTHORIZED_KEYS}"]],
		["a suffix", ["SSH_AUTHORIZED_KEYS=${DSTACK_AUTHORIZED_KEYS}-end"]],
		["an empty value", ["SSH_AUTHORIZED_KEYS="]],
		["another variable", ["SSH_AUTHORIZED_KEYS=${SOME_OTHER_VAR}"]],
		["a list entry with no binding", ["SSH_AUTHORIZED_KEYS"]],
		["a map entry with no value", { SSH_AUTHORIZED_KEYS: null }],
	])("rejects %s", (_label, environment) => {
		expect(isCanonicalDevBoxService(service(environment))).toBe(false);
	});

	test("a non-canonical binding is refused, not skipped as a dev box", () => {
		const compose = `services:
  ssh:
    image: ${DEV_BOX_IMAGE}
    privileged: true
    pid: host
    network_mode: host
    uts: host
    environment:
      - SSH_AUTHORIZED_KEYS=\${DSTACK_AUTHORIZED_KEYS:+not-a-key}
    volumes:
      - /:/host:rslave
      - ssh-host-keys:/etc/ssh/host-keys
      - home:/root
`;

		expect(composeHasDevBox(compose)).toBe(false);
		expect(() => injectDevBoxService(compose)).toThrow(
			/uses the dev-box image but is not configured as the dev box/,
		);
	});
});
