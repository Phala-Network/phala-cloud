import { describe, expect, test } from "bun:test";
import { unifiedDiff } from "./compose-file";
import { insertComposeService } from "./compose-text";

const ingress = {
	name: "dstack-ingress",
	service: {
		image: "dstacktee/dstack-ingress:latest",
		ports: ["443:443"],
		environment: ["DOMAIN=app.example.com", "TARGET_ENDPOINT=http://app:80"],
		volumes: ["cert-data:/etc/letsencrypt"],
	},
	volumes: { "cert-data": {} },
};

const compose = `# my stack
x-common: &common
  restart: unless-stopped # keep it up

services:
  app:
    <<: *common
    image: nginx # web
    ports:
      - "8080:80"

# trailing note
`;

describe("insertComposeService", () => {
	test("keeps comments and anchors and adds the service and volume as text", () => {
		const updated = insertComposeService(compose, ingress);

		expect(updated).toContain("# my stack");
		expect(updated).toContain("x-common: &common");
		expect(updated).toContain("restart: unless-stopped # keep it up");
		expect(updated).toContain("    <<: *common");
		expect(updated).toContain("image: nginx # web");
		expect(updated).toContain("# trailing note");
		expect(updated).toContain(
			[
				"  dstack-ingress:",
				"    image: dstacktee/dstack-ingress:latest",
				"    ports:",
				"      - 443:443",
			].join("\n"),
		);
		expect(updated).toContain("volumes:\n  cert-data:");
		// The original text is a subsequence: only lines were added.
		const removed = unifiedDiff("f", compose, updated)
			.split("\n")
			.filter((line) => line.startsWith("-") && !line.startsWith("---"));
		expect(removed).toEqual([]);
	});

	test("adds a volume only when it is missing", () => {
		const withVolume = `${compose}volumes:\n  cert-data:\n  other:\n`;
		const updated = insertComposeService(withVolume, ingress);
		expect(updated.match(/^\s*cert-data:\s*$/gm)?.length).toBe(1);
		expect(updated).toContain("  dstack-ingress:");

		const missing = insertComposeService(
			`${compose}volumes:\n  other:\n`,
			ingress,
		);
		expect(missing).toContain("  other:\n  cert-data:");
	});

	test("does not redeclare a volume that arrives through a merge key", () => {
		const merged =
			"x-vols: &vols\n  cert-data:\nservices:\n  app:\n    image: nginx\nvolumes:\n  <<: *vols\n";
		const updated = insertComposeService(merged, ingress);
		expect(updated.match(/^\s*cert-data:\s*$/gm)?.length).toBe(1);
	});

	test("follows the file's indentation step", () => {
		const four = "services:\n    app:\n        image: nginx\n";
		const updated = insertComposeService(four, ingress);
		expect(updated).toContain(
			"    dstack-ingress:\n        image: dstacktee/dstack-ingress:latest",
		);
	});

	test("refuses a service name that is already taken", () => {
		const taken = "services:\n  dstack-ingress:\n    image: custom\n";
		expect(() => insertComposeService(taken, ingress)).toThrow(
			/already has a service named "dstack-ingress"/,
		);
	});

	test("refuses an inline services section", () => {
		expect(() => insertComposeService("services: {}\n", ingress)).toThrow(
			/written inline/,
		);
	});
});

describe("insertComposeService formatting", () => {
	test("keeps CRLF line endings and the missing final newline", () => {
		const crlf = "services:\r\n  app:\r\n    image: nginx";
		const updated = insertComposeService(crlf, ingress);
		expect(updated.replace(/\r\n/g, "")).not.toContain("\n");
		expect(updated.endsWith("\r\n")).toBe(false);
		expect(updated).toContain("\r\n  dstack-ingress:\r\n");
	});

	test("keeps a final newline", () => {
		const updated = insertComposeService(compose, ingress);
		expect(updated.endsWith("# trailing note\n")).toBe(true);
	});

	test("adds a volumes section when there is none, with its value", () => {
		const updated = insertComposeService(
			"services:\n  app:\n    image: nginx\n",
			{ ...ingress, volumes: { data: { driver: "local" } } },
		);
		expect(updated).toContain("volumes:\n  data:\n    driver: local\n");
	});

	test("refuses a compose without services and an invalid one", () => {
		expect(() => insertComposeService("name: app\n", ingress)).toThrow(
			/no top-level services section/,
		);
		expect(() => insertComposeService("services: [\n", ingress)).toThrow(
			/not valid YAML/,
		);
	});

	test("refuses a volumes section that is not a mapping", () => {
		expect(() =>
			insertComposeService(
				"services:\n  app:\n    image: nginx\nvolumes: []\n",
				ingress,
			),
		).toThrow(/"volumes" section is not a mapping/);
	});
});
