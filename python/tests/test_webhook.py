"""Tests for webhook signature verification."""

from __future__ import annotations

import hashlib
import hmac
import time

import pytest

from phala_cloud.webhook import (
    WebhookEvent,
    parse_webhook_event,
    verify_webhook_signature,
)

TEST_SECRET = "whsec_test_secret_123"
TEST_BODY = (
    '{"id":"evt_abc","event":"cvm.created","version":"1",'
    '"created_at":"2026-01-01T00:00:00Z",'
    '"workspace":{"id":"ws1","name":"test"},"data":{}}'
)


def _sign(secret: str, timestamp: str, body: str) -> str:
    message = f"{timestamp}.{body}".encode()
    sig = hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()
    return f"sha256={sig}"


def _verify(*, ts: str, body: str = TEST_BODY, sig: str | None = None, **kw):
    if sig is None:
        sig = _sign(TEST_SECRET, ts, body)
    return verify_webhook_signature(
        secret=kw.pop("secret", TEST_SECRET),
        timestamp=ts,
        body=body,
        signature=sig,
        **kw,
    )


class TestVerifyWebhookSignature:
    def test_valid(self):
        assert _verify(ts=str(int(time.time()))) is True

    def test_wrong_secret(self):
        ts = str(int(time.time()))
        sig = _sign("wrong", ts, TEST_BODY)
        assert _verify(ts=ts, sig=sig) is False

    def test_tampered_body(self):
        ts = str(int(time.time()))
        sig = _sign(TEST_SECRET, ts, TEST_BODY)
        assert _verify(ts=ts, body="tampered", sig=sig) is False

    def test_expired_timestamp(self):
        assert _verify(ts=str(int(time.time()) - 600)) is False

    def test_boundary_timestamp(self):
        assert _verify(ts=str(int(time.time()) - 299)) is True

    def test_invalid_timestamp(self):
        result = verify_webhook_signature(
            secret=TEST_SECRET,
            timestamp="abc",
            body=TEST_BODY,
            signature="sha256=x",
        )
        assert result is False

    def test_custom_tolerance(self):
        assert (
            _verify(
                ts=str(int(time.time()) - 400),
                tolerance_seconds=500,
            )
            is True
        )


class TestParseWebhookEvent:
    def test_valid(self):
        ts = str(int(time.time()))
        sig = _sign(TEST_SECRET, ts, TEST_BODY)
        event = parse_webhook_event(
            headers={"X-Webhook-Timestamp": ts, "X-Webhook-Signature": sig},
            body=TEST_BODY,
            secret=TEST_SECRET,
        )
        assert isinstance(event, WebhookEvent)
        assert event.id == "evt_abc"
        assert event.event == "cvm.created"

    def test_case_insensitive_headers(self):
        ts = str(int(time.time()))
        sig = _sign(TEST_SECRET, ts, TEST_BODY)
        event = parse_webhook_event(
            headers={"x-webhook-timestamp": ts, "x-webhook-signature": sig},
            body=TEST_BODY,
            secret=TEST_SECRET,
        )
        assert event.event == "cvm.created"

    def test_invalid_signature(self):
        ts = str(int(time.time()))
        with pytest.raises(ValueError, match="Invalid webhook signature"):
            parse_webhook_event(
                headers={
                    "X-Webhook-Timestamp": ts,
                    "X-Webhook-Signature": "sha256=bad",
                },
                body=TEST_BODY,
                secret=TEST_SECRET,
            )

    def test_missing_headers(self):
        with pytest.raises(ValueError, match="Missing required"):
            parse_webhook_event(headers={}, body=TEST_BODY, secret=TEST_SECRET)

    def test_repr(self):
        ts = str(int(time.time()))
        sig = _sign(TEST_SECRET, ts, TEST_BODY)
        event = parse_webhook_event(
            headers={"X-Webhook-Timestamp": ts, "X-Webhook-Signature": sig},
            body=TEST_BODY,
            secret=TEST_SECRET,
        )
        assert "evt_abc" in repr(event)
