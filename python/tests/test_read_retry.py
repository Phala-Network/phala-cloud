import asyncio
import json
import threading
from email.utils import formatdate
from pathlib import Path

import httpx
import pytest

from phala_cloud import ApiError, AsyncPhalaCloud, PhalaCloud, RequestError
from phala_cloud import retry as policy

CONTRACT = json.loads((Path(__file__).parents[2] / "go/testdata/read-retry.json").read_text())
CASES = CONTRACT["cases"]


class Clock:
    now = 0.0

    def monotonic(self):
        return self.now

    def time(self):
        return 1767225600 + self.now


@pytest.mark.parametrize("case", CASES, ids=lambda case: case["name"])
@pytest.mark.parametrize("asynchronous", [False, True], ids=["sync", "async"])
async def test_shared_read_retry_contract(case, asynchronous, monkeypatch):
    clock = Clock()
    monkeypatch.setattr(policy, "time", clock)
    cancel = asyncio.Event() if asynchronous else threading.Event()
    calls = []

    def wait(ctx, delay):
        remaining = ctx.remaining()
        if remaining is not None:
            delay = min(delay, remaining)
        if "cancel_after" in case and clock.now + delay >= case["cancel_after"]:
            clock.now = case["cancel_after"]
            cancel.set()
        else:
            clock.now += delay
        ctx.remaining()

    async def wait_async(ctx, delay):
        wait(ctx, delay)

    monkeypatch.setattr(policy.RetryContext, "wait", wait)
    monkeypatch.setattr(policy.RetryContext, "wait_async", wait_async)

    def handle(request):
        calls.append(clock.now)
        assert request.headers["X-Phala-Version"] == "2026-06-23"
        reply = case["responses"][min(len(calls) - 1, len(case["responses"]) - 1)]
        headers = {}
        if "retry_after" in reply:
            headers["Retry-After"] = reply["retry_after"]
        if "http_date_seconds" in reply:
            headers["Retry-After"] = formatdate(
                clock.time() + reply["http_date_seconds"], usegmt=True
            )
        body = {"ok": True}
        if "error_code" in reply:
            body["error_code"] = reply["error_code"]
        return httpx.Response(reply["status"], headers=headers, json=body)

    config = {
        "max_retries": case.get("max_retries", CONTRACT["default_max_retries"]),
        "operation_timeout": case.get("operation_timeout"),
        "timeout": CONTRACT["request_timeout"],
    }
    options = {"cancel_event": cancel} if "cancel_after" in case else {}
    caught = None
    try:
        if asynchronous:
            async with httpx.AsyncClient(
                transport=httpx.MockTransport(handle),
                base_url="https://example.invalid",
                headers={"X-Phala-Version": "2026-06-23"},
                timeout=30,
            ) as raw:
                client = AsyncPhalaCloud(http_client=raw, **config)
                await client.request(case["method"], "/retry-contract", **options)
        else:
            with httpx.Client(
                transport=httpx.MockTransport(handle),
                base_url="https://example.invalid",
                headers={"X-Phala-Version": "2026-06-23"},
                timeout=30,
            ) as raw:
                client = PhalaCloud(http_client=raw, **config)
                client.request(case["method"], "/retry-contract", **options)
    except (ApiError, RequestError) as error:
        caught = error
    assert calls == case["expected_times"]
    if "expected_error" in case:
        assert isinstance(caught, RequestError)
        assert case["expected_error"] in str(caught).lower()
    elif case["expected_status"] >= 400:
        assert isinstance(caught, ApiError)
        assert caught.status_code == case["expected_status"]
    else:
        assert caught is None


async def test_native_async_cancellation_interrupts_retry_wait():
    first = asyncio.Event()
    calls = 0

    def handle(request):
        nonlocal calls
        calls += 1
        first.set()
        return httpx.Response(429, headers={"Retry-After": "60"}, json={})

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(handle), base_url="https://example.invalid"
    ) as raw:
        client = AsyncPhalaCloud(http_client=raw)
        task = asyncio.create_task(client.get("/retry-contract"))
        await first.wait()
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
    assert calls == 1


def test_sync_cancellation_interrupts_retry_wait():
    first = threading.Event()
    cancel = threading.Event()
    errors = []
    calls = 0

    def handle(request):
        nonlocal calls
        calls += 1
        first.set()
        return httpx.Response(429, headers={"Retry-After": "60"}, json={})

    def run():
        with httpx.Client(
            transport=httpx.MockTransport(handle), base_url="https://example.invalid"
        ) as raw:
            try:
                PhalaCloud(http_client=raw).request("GET", "/retry-contract", cancel_event=cancel)
            except RequestError as error:
                errors.append(error)

    thread = threading.Thread(target=run)
    thread.start()
    try:
        assert first.wait(2)
        cancel.set()
        thread.join(2)
        assert not thread.is_alive()
        assert len(errors) == 1 and "cancelled" in str(errors[0])
        assert calls == 1
    finally:
        cancel.set()
        thread.join(2)


@pytest.mark.parametrize("asynchronous", [False, True])
async def test_native_operation_deadline_interrupts_backoff(asynchronous):
    def handle(request):
        return httpx.Response(429, headers={"Retry-After": "60"}, json={})

    if asynchronous:
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(handle), base_url="https://example.invalid"
        ) as raw:
            with pytest.raises(RequestError, match="deadline"):
                await AsyncPhalaCloud(http_client=raw, operation_timeout=0.01).get("/test")
    else:
        with httpx.Client(
            transport=httpx.MockTransport(handle), base_url="https://example.invalid"
        ) as raw:
            with pytest.raises(RequestError, match="deadline"):
                PhalaCloud(http_client=raw, operation_timeout=0.01).get("/test")


@pytest.mark.parametrize("asynchronous", [False, True])
async def test_full_response_uses_the_read_retry_policy(asynchronous, monkeypatch):
    calls = 0
    delays = []

    def handle(request):
        nonlocal calls
        calls += 1
        return httpx.Response(429, json={"detail": "Rate limit exceeded"})

    def wait(ctx, delay):
        delays.append(delay)

    async def wait_async(ctx, delay):
        wait(ctx, delay)

    monkeypatch.setattr(policy.RetryContext, "wait", wait)
    monkeypatch.setattr(policy.RetryContext, "wait_async", wait_async)
    if asynchronous:
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(handle), base_url="https://example.invalid"
        ) as raw:
            result = await AsyncPhalaCloud(http_client=raw, max_retries=2).request_full(
                "GET", "/test"
            )
    else:
        with httpx.Client(
            transport=httpx.MockTransport(handle), base_url="https://example.invalid"
        ) as raw:
            result = PhalaCloud(http_client=raw, max_retries=2).request_full("GET", "/test")
    assert result["status"] == 429 and result["ok"] is False
    assert calls == 3 and delays == [1, 2]


@pytest.mark.parametrize("asynchronous", [False, True])
async def test_already_cancelled_operation_sends_no_request(asynchronous):
    cancel = asyncio.Event() if asynchronous else threading.Event()
    cancel.set()

    def handle(request):
        pytest.fail("cancelled operation sent a request")

    if asynchronous:
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(handle), base_url="https://example.invalid"
        ) as raw:
            with pytest.raises(RequestError, match="cancelled"):
                await AsyncPhalaCloud(http_client=raw).request("GET", "/test", cancel_event=cancel)
    else:
        with httpx.Client(
            transport=httpx.MockTransport(handle), base_url="https://example.invalid"
        ) as raw:
            with pytest.raises(RequestError, match="cancelled"):
                PhalaCloud(http_client=raw).request("GET", "/test", cancel_event=cancel)
