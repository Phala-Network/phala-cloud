import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseWebhookEvent, verifyWebhookSignature } from "./verify-webhook";

function computeSignature(secret: string, timestamp: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

const TEST_SECRET = "whsec_test_secret_123";
const TEST_BODY =
  '{"id":"evt_abc","event":"cvm.created","version":"1","created_at":"2026-01-01T00:00:00Z","workspace":{"id":"ws1","name":"test"},"data":{}}';

describe("verifyWebhookSignature", () => {
  it("returns true for valid signature", () => {
    const ts = Math.floor(Date.now() / 1000).toString();
    const sig = computeSignature(TEST_SECRET, ts, TEST_BODY);
    expect(verifyWebhookSignature({ secret: TEST_SECRET, timestamp: ts, body: TEST_BODY, signature: sig })).toBe(true);
  });

  it("returns false for wrong secret", () => {
    const ts = Math.floor(Date.now() / 1000).toString();
    const sig = computeSignature("wrong_secret", ts, TEST_BODY);
    expect(verifyWebhookSignature({ secret: TEST_SECRET, timestamp: ts, body: TEST_BODY, signature: sig })).toBe(false);
  });

  it("returns false for tampered body", () => {
    const ts = Math.floor(Date.now() / 1000).toString();
    const sig = computeSignature(TEST_SECRET, ts, TEST_BODY);
    expect(verifyWebhookSignature({ secret: TEST_SECRET, timestamp: ts, body: "tampered", signature: sig })).toBe(
      false,
    );
  });

  it("returns false for expired timestamp", () => {
    const ts = (Math.floor(Date.now() / 1000) - 600).toString();
    const sig = computeSignature(TEST_SECRET, ts, TEST_BODY);
    expect(verifyWebhookSignature({ secret: TEST_SECRET, timestamp: ts, body: TEST_BODY, signature: sig })).toBe(
      false,
    );
  });

  it("accepts timestamp at exact boundary", () => {
    const ts = (Math.floor(Date.now() / 1000) - 300).toString();
    const sig = computeSignature(TEST_SECRET, ts, TEST_BODY);
    expect(verifyWebhookSignature({ secret: TEST_SECRET, timestamp: ts, body: TEST_BODY, signature: sig })).toBe(true);
  });

  it("returns false for invalid signature format", () => {
    const ts = Math.floor(Date.now() / 1000).toString();
    expect(
      verifyWebhookSignature({ secret: TEST_SECRET, timestamp: ts, body: TEST_BODY, signature: "invalid" }),
    ).toBe(false);
  });

  it("supports custom tolerance", () => {
    const ts = (Math.floor(Date.now() / 1000) - 400).toString();
    const sig = computeSignature(TEST_SECRET, ts, TEST_BODY);
    expect(
      verifyWebhookSignature({
        secret: TEST_SECRET,
        timestamp: ts,
        body: TEST_BODY,
        signature: sig,
        toleranceSeconds: 500,
      }),
    ).toBe(true);
  });
});

describe("parseWebhookEvent", () => {
  it("parses valid webhook event", () => {
    const ts = Math.floor(Date.now() / 1000).toString();
    const sig = computeSignature(TEST_SECRET, ts, TEST_BODY);
    const event = parseWebhookEvent({
      headers: { "X-Webhook-Timestamp": ts, "X-Webhook-Signature": sig },
      body: TEST_BODY,
      secret: TEST_SECRET,
    });
    expect(event.id).toBe("evt_abc");
    expect(event.event).toBe("cvm.created");
  });

  it("throws on invalid signature", () => {
    const ts = Math.floor(Date.now() / 1000).toString();
    expect(() =>
      parseWebhookEvent({
        headers: { "X-Webhook-Timestamp": ts, "X-Webhook-Signature": "sha256=invalid" },
        body: TEST_BODY,
        secret: TEST_SECRET,
      }),
    ).toThrow("Invalid webhook signature");
  });

  it("handles case-insensitive headers", () => {
    const ts = Math.floor(Date.now() / 1000).toString();
    const sig = computeSignature(TEST_SECRET, ts, TEST_BODY);
    const event = parseWebhookEvent({
      headers: { "x-webhook-timestamp": ts, "x-webhook-signature": sig },
      body: TEST_BODY,
      secret: TEST_SECRET,
    });
    expect(event.event).toBe("cvm.created");
  });

  it("throws on missing headers", () => {
    expect(() => parseWebhookEvent({ headers: {}, body: TEST_BODY, secret: TEST_SECRET })).toThrow(
      "Missing required webhook headers",
    );
  });
});
