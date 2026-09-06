import { describe, expect, test } from "bun:test";
import type { CvmSshKey } from "@phala/cloud";
import { keyIds, keysToRevoke, sameKeyIds } from "./authorized-set";

const alice: CvmSshKey = {
	id: "sshkey_a",
	owner_user_id: "usr_a",
	owner_username: "alice",
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
	added_by_user_id: "usr_a",
	name: "work",
	public_key: "ssh-ed25519 BBBB",
	fingerprint: "SHA256:b",
	key_type: "ssh-ed25519",
};

describe("keysToRevoke", () => {
	test("drops every key owned by the nickname", () => {
		expect(keysToRevoke([alice, bob], "alice", undefined)).toEqual([alice]);
	});

	test("drops a key by id", () => {
		expect(keysToRevoke([alice, bob], undefined, "sshkey_b")).toEqual([bob]);
	});

	test("returns nothing when the nickname is not authorized", () => {
		expect(keysToRevoke([alice], "bob", undefined)).toEqual([]);
	});
});

describe("sameKeyIds", () => {
	test("ignores order", () => {
		expect(sameKeyIds(keyIds([alice, bob]), ["sshkey_b", "sshkey_a"])).toBe(
			true,
		);
	});
});
