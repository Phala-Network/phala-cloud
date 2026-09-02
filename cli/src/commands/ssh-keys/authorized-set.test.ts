import type { CvmSshKey } from "@phala/cloud";
import { describe, expect, it } from "vitest";
import { keyIds, keysToRevoke, sameKeyIds } from "./authorized-set";

const alice: CvmSshKey = {
	id: "sshkey_a",
	owner_user_id: "usr_a",
	owner_username: "alice",
	owner_email: "alice@example.com",
	added_by_user_id: "usr_a",
	name: "laptop",
	public_key: "ssh-ed25519 AAAA",
	fingerprint: "SHA256:a",
	key_type: "ssh-ed25519",
};

const bob: CvmSshKey = {
	id: "sshkey_b",
	owner_user_id: "usr_b",
	owner_username: "bob",
	owner_email: "bob@example.com",
	added_by_user_id: "usr_a",
	name: "work",
	public_key: "ssh-ed25519 BBBB",
	fingerprint: "SHA256:b",
	key_type: "ssh-ed25519",
};

describe("keysToRevoke", () => {
	it("drops every key owned by the nickname", () => {
		expect(keysToRevoke([alice, bob], "alice", undefined)).toEqual([alice]);
	});

	it("drops a key by id", () => {
		expect(keysToRevoke([alice, bob], undefined, "sshkey_b")).toEqual([bob]);
	});

	it("returns nothing when the nickname is not authorized", () => {
		expect(keysToRevoke([alice], "bob", undefined)).toEqual([]);
	});
});

describe("sameKeyIds", () => {
	it("ignores order", () => {
		expect(sameKeyIds(keyIds([alice, bob]), ["sshkey_b", "sshkey_a"])).toBe(
			true,
		);
	});
});
