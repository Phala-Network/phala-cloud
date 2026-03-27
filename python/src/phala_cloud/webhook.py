"""Webhook signature verification utilities."""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from typing import Any


def verify_webhook_signature(
    *,
    secret: str,
    timestamp: str,
    body: str,
    signature: str,
    tolerance_seconds: int = 300,
) -> bool:
    """Verify an HMAC-SHA256 webhook signature.

    Args:
        secret: Webhook signing secret (e.g. ``whsec_...``).
        timestamp: Value of the ``X-Webhook-Timestamp`` header.
        body: Raw request body string.
        signature: Value of the ``X-Webhook-Signature`` header.
        tolerance_seconds: Maximum age of the timestamp in seconds (default 300).

    Returns:
        ``True`` if the signature is valid and the timestamp is within tolerance.
    """
    try:
        ts = int(timestamp)
    except (ValueError, TypeError):
        return False

    if abs(time.time() - ts) > tolerance_seconds:
        return False

    message = f"{timestamp}.{body}".encode()
    expected = (
        "sha256="
        + hmac.new(
            secret.encode("utf-8"),
            message,
            hashlib.sha256,
        ).hexdigest()
    )

    return hmac.compare_digest(expected, signature)


class WebhookEvent:
    """Parsed webhook event envelope."""

    __slots__ = ("id", "event", "version", "created_at", "workspace", "data", "_raw")

    def __init__(self, raw: dict[str, Any]) -> None:
        self._raw = raw
        self.id: str = raw["id"]
        self.event: str = raw["event"]
        self.version: str = raw.get("version", "1")
        self.created_at: str = raw["created_at"]
        self.workspace: dict[str, str] = raw["workspace"]
        self.data: Any = raw["data"]

    def __repr__(self) -> str:
        return f"WebhookEvent(id={self.id!r}, event={self.event!r})"


def parse_webhook_event(
    *,
    headers: dict[str, str],
    body: str,
    secret: str,
    tolerance_seconds: int = 300,
) -> WebhookEvent:
    """Verify signature and parse a webhook event.

    Args:
        headers: HTTP request headers (case-insensitive lookup).
        body: Raw request body string.
        secret: Webhook signing secret.
        tolerance_seconds: Maximum age of the timestamp in seconds.

    Returns:
        Parsed :class:`WebhookEvent`.

    Raises:
        ValueError: If the signature is invalid, timestamp expired, or headers missing.
    """
    normalised = {k.lower(): v for k, v in headers.items()}
    timestamp = normalised.get("x-webhook-timestamp")
    signature = normalised.get("x-webhook-signature")

    if not timestamp or not signature:
        raise ValueError(
            "Missing required webhook headers: X-Webhook-Timestamp and X-Webhook-Signature"
        )

    if not verify_webhook_signature(
        secret=secret,
        timestamp=timestamp,
        body=body,
        signature=signature,
        tolerance_seconds=tolerance_seconds,
    ):
        raise ValueError("Invalid webhook signature or expired timestamp")

    return WebhookEvent(json.loads(body))
