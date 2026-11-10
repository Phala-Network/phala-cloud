import { describe, expect, test } from "bun:test";
import {
	buildSshOptions,
	formatOpensslProxyArg,
	resolveHttpsProxy,
	sshKeyFingerprint,
} from "./ssh-utils";

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

const HOST = "abc123-22.gateway.example.com";
const DIRECT_PROXY_COMMAND =
	"ProxyCommand=openssl s_client -quiet -connect %h:%p -servername %h -verify_hostname %h -verify_return_error 2>/dev/null";

function proxyCommandFor(env: NodeJS.ProcessEnv): string | undefined {
	return buildSshOptions(false, "30", HOST, env).find((option) =>
		option.startsWith("ProxyCommand="),
	);
}

describe("buildSshOptions", () => {
	test("keeps the direct connection when no proxy is configured", () => {
		expect(buildSshOptions(false, "30", HOST, {})).toEqual([
			"-o",
			DIRECT_PROXY_COMMAND,
			"-o",
			"StrictHostKeyChecking=no",
			"-o",
			"UserKnownHostsFile=/dev/null",
			"-o",
			"ConnectTimeout=30",
		]);
	});

	test("tunnels through HTTPS_PROXY with an explicit port", () => {
		expect(
			proxyCommandFor({ HTTPS_PROXY: "http://proxy.corp.example:3128" }),
		).toBe(
			"ProxyCommand=openssl s_client -quiet -connect %h:%p -servername %h -verify_hostname %h -verify_return_error -proxy proxy.corp.example:3128 2>/dev/null",
		);
	});

	test("keeps stderr visible in verbose mode", () => {
		expect(
			buildSshOptions(true, "30", HOST, {
				HTTPS_PROXY: "http://proxy.corp.example:3128",
			})[1],
		).toBe(
			"ProxyCommand=openssl s_client -quiet -connect %h:%p -servername %h -verify_hostname %h -verify_return_error -proxy proxy.corp.example:3128",
		);
	});

	test("reads the lowercase variable and prefers it over the uppercase one", () => {
		expect(
			proxyCommandFor({ https_proxy: "http://lower.example:8080" }),
		).toContain(" -proxy lower.example:8080");
		expect(
			proxyCommandFor({
				https_proxy: "http://lower.example:8080",
				HTTPS_PROXY: "http://upper.example:8080",
			}),
		).toContain(" -proxy lower.example:8080");
	});

	test("defaults to port 80 and accepts a value without a scheme", () => {
		expect(
			proxyCommandFor({ HTTPS_PROXY: "http://proxy.corp.example" }),
		).toContain(" -proxy proxy.corp.example:80");
		expect(
			proxyCommandFor({ HTTPS_PROXY: "proxy.corp.example:3128" }),
		).toContain(" -proxy proxy.corp.example:3128");
	});

	test("ignores HTTP_PROXY and ALL_PROXY", () => {
		expect(
			proxyCommandFor({
				HTTP_PROXY: "http://proxy.corp.example:3128",
				ALL_PROXY: "http://proxy.corp.example:3128",
			}),
		).toBe(DIRECT_PROXY_COMMAND);
	});

	test("connects directly when NO_PROXY matches the host", () => {
		const proxy = { HTTPS_PROXY: "http://proxy.corp.example:3128" };
		expect(proxyCommandFor({ ...proxy, NO_PROXY: HOST })).toBe(
			DIRECT_PROXY_COMMAND,
		);
		expect(
			proxyCommandFor({ ...proxy, NO_PROXY: "localhost, gateway.example.com" }),
		).toBe(DIRECT_PROXY_COMMAND);
		expect(proxyCommandFor({ ...proxy, no_proxy: ".example.com" })).toBe(
			DIRECT_PROXY_COMMAND,
		);
		expect(proxyCommandFor({ ...proxy, NO_PROXY: "*" })).toBe(
			DIRECT_PROXY_COMMAND,
		);
	});

	test("keeps the proxy when NO_PROXY does not match the host", () => {
		const proxy = { HTTPS_PROXY: "http://proxy.corp.example:3128" };
		for (const noProxy of [
			"localhost,127.0.0.1",
			"le.com",
			"other.example.com",
		]) {
			expect(proxyCommandFor({ ...proxy, NO_PROXY: noProxy })).toContain(
				" -proxy proxy.corp.example:3128",
			);
		}
	});

	test("refuses proxy schemes openssl cannot tunnel through", () => {
		for (const value of [
			"https://proxy.corp.example:3128",
			"socks5://proxy.corp.example:1080",
		]) {
			expect(() => proxyCommandFor({ HTTPS_PROXY: value })).toThrow(
				/Unsupported proxy scheme/,
			);
		}
	});

	test("refuses proxy credentials instead of putting them on the command line", () => {
		expect(() =>
			proxyCommandFor({
				HTTPS_PROXY: "http://user:secret@proxy.corp.example:3128",
			}),
		).toThrow(/credentials/);
	});

	test("shell-quotes a proxy host with shell metacharacters", () => {
		expect(
			proxyCommandFor({ HTTPS_PROXY: "http://a$b.example:3128" }),
		).toContain(" -proxy 'a$b.example:3128'");
	});
});

describe("resolveHttpsProxy", () => {
	test("parses an IPv6 proxy address with and without a port", () => {
		expect(
			resolveHttpsProxy(HOST, { HTTPS_PROXY: "http://[2001:db8::1]:3128" }),
		).toEqual({ host: "2001:db8::1", port: "3128", isIpv6: true });
		expect(
			resolveHttpsProxy(HOST, { HTTPS_PROXY: "http://[2001:db8::1]" }),
		).toEqual({ host: "2001:db8::1", port: "80", isIpv6: true });
	});

	test("returns undefined for an empty value", () => {
		expect(resolveHttpsProxy(HOST, { HTTPS_PROXY: "" })).toBeUndefined();
	});
});

describe("formatOpensslProxyArg", () => {
	const ipv6 = { host: "2001:db8::1", port: "3128", isIpv6: true };

	test("brackets an IPv6 address for OpenSSL", () => {
		expect(formatOpensslProxyArg(ipv6, false)).toBe("[2001:db8::1]:3128");
	});

	test("leaves an IPv6 address unbracketed for LibreSSL", () => {
		expect(formatOpensslProxyArg(ipv6, true)).toBe("2001:db8::1:3128");
	});

	test("leaves a hostname unchanged", () => {
		expect(
			formatOpensslProxyArg(
				{ host: "proxy.corp.example", port: "3128", isIpv6: false },
				true,
			),
		).toBe("proxy.corp.example:3128");
	});
});
