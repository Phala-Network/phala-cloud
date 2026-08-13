import { describe, expect, test } from "bun:test";
import { sshKeyFingerprint } from "./ssh-utils";

// Expected values are the output of `ssh-keygen -lf` on these keys.
const ED25519_KEY =
	"ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIH7vLrIFkHq5zjUNZ/I4j6/2vDx7owNsNUiqAp6tPJ18 test@example.com";
const ED25519_FINGERPRINT =
	"SHA256:6OKoIHh0+L2URA+iptwZ1EF3NlwXZ6o0BW9/bnoR7ds";

const RSA_KEY =
	"ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDM3iYNhA9nVhgNeGMEkL/rLQ2L6eQclAAvtBeElRGBBzKRO+DvmCUS57CNwjVHoJyMgirSx8y6w0YD4swQSgQgF4p64z6FMwQN4c11OHlF0Wz1G507svHHkl7Xlt9idVoxoyaCCAQ3syfe/UH6KnOO7Jh20BNMOAZgWgQPs6AphRG33pjoWs7aacj2tN11JaKjWCRD2quNJ9UNjLLkfEFkbhZXYmATMWLRaoW+GZt3/FNIZkOlQYM/RnVZDtVlUNogXMXIFqu54FbnWJ4Siqw97RYvQkvVFSf55pxl6Db7oBjMqOAcesTtg6TRsgHpYttss1ysP5NdNt3UNxEUi+C9 test@example.com";
const RSA_FINGERPRINT = "SHA256:LxIr2ZUyQLBZtTcELwmpjnhrYTYL/4ZUhXb2ngIo0RU";

const ECDSA_KEY =
	"ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBF0o88ifz1VGALnUksu7dS/DcErWjT33SF1kx9ZtCoZ8lEo0wlGnD84sMgdlbJwi8BuH8L2rNGFhXtmbdccTs9Q= test@example.com";
const ECDSA_FINGERPRINT = "SHA256:9jqE2lho2dCTmQlTBVOtpgSAqi7wFgjrbVStzvDZx+M";

describe("sshKeyFingerprint", () => {
	test("matches ssh-keygen -lf for ed25519, rsa and ecdsa", () => {
		expect(sshKeyFingerprint(ED25519_KEY)).toBe(ED25519_FINGERPRINT);
		expect(sshKeyFingerprint(RSA_KEY)).toBe(RSA_FINGERPRINT);
		expect(sshKeyFingerprint(ECDSA_KEY)).toBe(ECDSA_FINGERPRINT);
	});

	test("ignores the comment and surrounding whitespace", () => {
		const [keyType, blob] = ED25519_KEY.split(" ");
		expect(sshKeyFingerprint(`  ${keyType} ${blob}  `)).toBe(
			ED25519_FINGERPRINT,
		);
		expect(sshKeyFingerprint(`${keyType} ${blob} someone-else@laptop`)).toBe(
			ED25519_FINGERPRINT,
		);
	});

	test("returns undefined instead of a fingerprint for a malformed line", () => {
		expect(sshKeyFingerprint("")).toBeUndefined();
		expect(sshKeyFingerprint("ssh-ed25519")).toBeUndefined();
		expect(sshKeyFingerprint("ssh-ed25519 not-base64")).toBeUndefined();
	});

	test("rejects a blob whose algorithm disagrees with the line", () => {
		const blob = ED25519_KEY.split(" ")[1];
		expect(sshKeyFingerprint(`ssh-rsa ${blob}`)).toBeUndefined();
	});
});
