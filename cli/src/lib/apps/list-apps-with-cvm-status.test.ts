import { describe, test, expect } from "bun:test";
import { collectDisplayCvms } from "./list-apps-with-cvm-status";

const cvm = (vm_uuid: string, name = vm_uuid, status = "running") => ({
	vm_uuid,
	name,
	status,
});

describe("collectDisplayCvms", () => {
	test("emits one row per app by default, annotated with replica count", () => {
		const apps = [
			{
				app_id: "app_a",
				current_cvm: cvm("uuid-a1", "primary"),
				cvms: [cvm("uuid-a1", "primary"), cvm("uuid-a2", "replica")],
				cvm_count: 2,
			},
		];

		const refs = collectDisplayCvms(apps, false);

		expect(refs).toHaveLength(1);
		expect(refs[0]).toMatchObject({
			appId: "app_a",
			replicaIndex: 1,
			replicaCount: 2,
		});
		// Default row is the current CVM, not an arbitrary replica.
		expect(refs[0].cvm.vm_uuid).toBe("uuid-a1");
	});

	test("emits one row per replica when showReplicas is true", () => {
		const apps = [
			{
				app_id: "app_a",
				current_cvm: cvm("uuid-a1"),
				cvms: [cvm("uuid-a1"), cvm("uuid-a2"), cvm("uuid-a3")],
				cvm_count: 3,
			},
		];

		const refs = collectDisplayCvms(apps, true);

		expect(refs).toHaveLength(3);
		expect(refs.map((r) => r.cvm.vm_uuid)).toEqual([
			"uuid-a1",
			"uuid-a2",
			"uuid-a3",
		]);
		expect(refs.map((r) => r.replicaIndex)).toEqual([1, 2, 3]);
		expect(refs.every((r) => r.replicaCount === 3)).toBe(true);
	});

	test("falls back to current_cvm when cvms[] is empty", () => {
		const apps = [
			{
				app_id: "app_legacy",
				current_cvm: cvm("uuid-legacy"),
				cvms: [],
				cvm_count: 0,
			},
		];

		expect(collectDisplayCvms(apps, false)).toHaveLength(1);
		expect(collectDisplayCvms(apps, true)).toHaveLength(1);
		expect(collectDisplayCvms(apps, true)[0].cvm.vm_uuid).toBe("uuid-legacy");
	});

	test("skips apps that have no CVM with a vm_uuid", () => {
		const apps = [
			{ app_id: "app_empty", current_cvm: null, cvms: [], cvm_count: 0 },
			{
				app_id: "app_bad",
				current_cvm: { name: "no-uuid" },
				cvms: [{ vm_uuid: "", name: "blank" }],
			},
		];

		expect(collectDisplayCvms(apps, false)).toHaveLength(0);
		expect(collectDisplayCvms(apps, true)).toHaveLength(0);
	});

	test("derives replicaCount from cvms length when cvm_count is missing or stale", () => {
		const apps = [
			{
				app_id: "app_a",
				current_cvm: cvm("uuid-a1"),
				cvms: [cvm("uuid-a1"), cvm("uuid-a2")],
				// cvm_count omitted
			},
		];

		expect(collectDisplayCvms(apps, false)[0].replicaCount).toBe(2);
	});
});
