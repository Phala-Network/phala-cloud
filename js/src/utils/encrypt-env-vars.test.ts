import { describe, expect, it } from "vitest";
import { encryptEnvVars } from "./index";

describe("encryptEnvVars", () => {
  it("rejects a malformed hex public key", async () => {
    await expect(
      encryptEnvVars([{ key: "FOO", value: "bar" }], "not-a-hex-key"),
    ).rejects.toThrow();
  });

  it("encrypts with a valid X25519 public key", async () => {
    const publicKey = "11".repeat(32);
    const encrypted = await encryptEnvVars(
      [{ key: "FOO", value: "bar" }],
      publicKey,
    );
    expect(encrypted).toMatch(/^[0-9a-f]+$/);
  });
});
