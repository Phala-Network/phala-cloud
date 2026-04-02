import { describe, expect, test } from "bun:test";
import { requireReplicaVmUuid } from "./index";

describe("requireReplicaVmUuid", () => {
	test("removes hyphens from replica vm_uuid", () => {
		expect(requireReplicaVmUuid("123e4567-e89b-12d3-a456-426614174000")).toBe(
			"123e4567e89b12d3a456426614174000",
		);
	});

	test("throws when replica vm_uuid is missing", () => {
		expect(() => requireReplicaVmUuid(null)).toThrow(
			"Replica response missing vm_uuid",
		);
	});
});
