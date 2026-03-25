import { createHmac, timingSafeEqual } from "node:crypto";

/** Webhook event envelope */
export interface WebhookEvent<T = unknown> {
  id: string;
  event: string;
  version: string;
  created_at: string;
  workspace: { id: string; name: string };
  data: T;
}

/**
 * Verify an HMAC-SHA256 webhook signature.
 *
 * @returns true if signature is valid and timestamp is within tolerance
 */
export function verifyWebhookSignature(params: {
  secret: string;
  timestamp: string;
  body: string;
  signature: string;
  toleranceSeconds?: number;
}): boolean {
  const { secret, timestamp, body, signature, toleranceSeconds = 300 } = params;

  // Check timestamp tolerance
  const ts = parseInt(timestamp, 10);
  if (Number.isNaN(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > toleranceSeconds) return false;

  // Compute expected signature
  const expected = `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;

  // Constant-time comparison with buffer length check to prevent RangeError
  const expectedBuf = Buffer.from(expected, "utf-8");
  const actualBuf = Buffer.from(signature, "utf-8");
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * Parse and verify a webhook event from HTTP request headers and body.
 *
 * @throws Error if signature is invalid, timestamp is expired, or headers are missing
 */
export function parseWebhookEvent<T = unknown>(params: {
  headers: Record<string, string | string[] | undefined>;
  body: string;
  secret: string;
  toleranceSeconds?: number;
}): WebhookEvent<T> {
  const { headers, body, secret, toleranceSeconds } = params;

  // Case-insensitive header lookup
  const normalised: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    normalised[key.toLowerCase()] = Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
  }

  const timestamp = normalised["x-webhook-timestamp"];
  const signature = normalised["x-webhook-signature"];

  if (!timestamp || !signature) {
    throw new Error(
      "Missing required webhook headers: X-Webhook-Timestamp and X-Webhook-Signature",
    );
  }

  const valid = verifyWebhookSignature({ secret, timestamp, body, signature, toleranceSeconds });
  if (!valid) {
    throw new Error("Invalid webhook signature or expired timestamp");
  }

  return JSON.parse(body) as WebhookEvent<T>;
}
