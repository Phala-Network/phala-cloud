import { describe, expect, test } from "bun:test";
import { insertIngressService, unifiedDiff } from "./compose-insert";

const ingress = {
	serviceName: "dstack-ingress",
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

describe("insertIngressService", () => {
	test("keeps comments and anchors and adds the service and volume as text", () => {
		const updated = insertIngressService(compose, ingress);

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
		const updated = insertIngressService(withVolume, ingress);
		expect(updated.match(/^\s*cert-data:\s*$/gm)?.length).toBe(1);
		expect(updated).toContain("  dstack-ingress:");

		const missing = insertIngressService(
			`${compose}volumes:\n  other:\n`,
			ingress,
		);
		expect(missing).toContain("  other:\n  cert-data:");
	});

	test("does not redeclare a volume that arrives through a merge key", () => {
		const merged =
			"x-vols: &vols\n  cert-data:\nservices:\n  app:\n    image: nginx\nvolumes:\n  <<: *vols\n";
		const updated = insertIngressService(merged, ingress);
		expect(updated.match(/^\s*cert-data:\s*$/gm)?.length).toBe(1);
	});

	test("follows the file's indentation step", () => {
		const four = "services:\n    app:\n        image: nginx\n";
		const updated = insertIngressService(four, ingress);
		expect(updated).toContain(
			"    dstack-ingress:\n        image: dstacktee/dstack-ingress:latest",
		);
	});

	test("refuses a service name that is already taken", () => {
		const taken = "services:\n  dstack-ingress:\n    image: custom\n";
		expect(() => insertIngressService(taken, ingress)).toThrow(
			/already has a service named "dstack-ingress"/,
		);
	});

	test("refuses an inline services section", () => {
		expect(() => insertIngressService("services: {}\n", ingress)).toThrow(
			/written inline/,
		);
	});
});

describe("unifiedDiff", () => {
	test("is empty for equal texts and shows added lines with context", () => {
		expect(unifiedDiff("f", "a\nb\n", "a\nb\n")).toBe("");
		const diff = unifiedDiff("f.yml", "a\nb\nc\n", "a\nb\nx\nc\n");
		expect(diff).toContain("--- a/f.yml");
		expect(diff).toContain("+x");
		expect(diff).toContain("@@ -1,3 +1,4 @@");
	});
});
