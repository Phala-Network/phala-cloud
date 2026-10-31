import asyncio

import httpx
import pytest

from phala_cloud import AsyncPhalaCloud, AuthError, PhalaCloud, RequestError


@pytest.mark.parametrize("async_client", [False, True])
@pytest.mark.parametrize("response", ["http", "event", "network", "eof"])
@pytest.mark.asyncio
async def test_watch_permanent_errors_are_typed_and_not_retried(
    async_client: bool, response: str
) -> None:
    count = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal count
        count += 1
        if response == "http":
            return httpx.Response(401, json={"detail": "unauthorized"})
        if response == "network":
            raise httpx.ConnectError("offline", request=request)
        if response == "eof":
            return httpx.Response(200, text="")
        return httpx.Response(
            200,
            text=(
                'event: state\ndata: {"status":"running"}\n\n'
                'event: error\ndata: {"error":"invalid cvm"}\n\n'
            ),
        )

    transport = httpx.MockTransport(handler)
    expected = AuthError if response == "http" else RequestError
    req = {"cvm_id": "cvm_1", "target": "running", "max_retries": 0, "retry_delay": 0}
    if async_client:
        async with httpx.AsyncClient(transport=transport, base_url="https://api.example") as raw:
            with pytest.raises(expected) as exc:
                await AsyncPhalaCloud(http_client=raw).watch_cvm_state(req)
    else:
        with httpx.Client(transport=transport, base_url="https://api.example") as raw:
            with pytest.raises(expected) as exc:
                PhalaCloud(http_client=raw).watch_cvm_state(req)
    assert count == 1
    if response == "event":
        assert "invalid cvm" in str(exc.value)


@pytest.mark.parametrize("async_client", [False, True])
@pytest.mark.parametrize("timeout_event", [False, True])
@pytest.mark.asyncio
async def test_raw_running_state_never_completes_watch_without_complete_event(
    async_client: bool, timeout_event: bool
) -> None:
    count = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal count
        count += 1
        if count > 1:
            return httpx.Response(200, text='event: complete\ndata: {"status":"running"}\n\n')
        state = 'event: state\ndata: {"status":"running","boot_progress":"booting"}\n\n'
        timeout = 'event: timeout\ndata: {"error":"timeout"}\n\n' if timeout_event else ""
        return httpx.Response(200, text=state + timeout)

    transport = httpx.MockTransport(handler)
    req = {
        "cvm_id": "cvm_1",
        "target": "running",
        "max_retries": 1 if timeout_event else 0,
        "retry_delay": 0,
    }
    if async_client:
        async with httpx.AsyncClient(transport=transport, base_url="https://api.example") as raw:
            client = AsyncPhalaCloud(http_client=raw)
            if timeout_event:
                assert (await client.watch_cvm_state(req)).status == "running"
            else:
                with pytest.raises(RequestError, match="ended before completion"):
                    await client.watch_cvm_state(req)
    else:
        with httpx.Client(transport=transport, base_url="https://api.example") as raw:
            client_sync = PhalaCloud(http_client=raw)
            if timeout_event:
                assert client_sync.watch_cvm_state(req).status == "running"
            else:
                with pytest.raises(RequestError, match="ended before completion"):
                    client_sync.watch_cvm_state(req)
    assert count == (2 if timeout_event else 1)


@pytest.mark.parametrize("async_client", [False, True])
@pytest.mark.asyncio
async def test_watch_continues_after_transient_error_event(async_client: bool) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            text=(
                'event: state\ndata: {"status":"starting"}\n\n'
                'event: error\ndata: {"error":"temporary backend error"}\n\n'
                'event: state\ndata: {"status":"running"}\n\n'
                'event: complete\ndata: {"status":"running"}\n\n'
            ),
        )

    transport = httpx.MockTransport(handler)
    req = {"cvm_id": "cvm_1", "target": "running", "max_retries": 0}
    if async_client:
        async with httpx.AsyncClient(transport=transport, base_url="https://api.example") as raw:
            result = await AsyncPhalaCloud(http_client=raw).watch_cvm_state(req)
    else:
        with httpx.Client(transport=transport, base_url="https://api.example") as raw:
            result = PhalaCloud(http_client=raw).watch_cvm_state(req)
    assert result.status == "running"


@pytest.mark.parametrize("async_client", [False, True])
@pytest.mark.parametrize("delay_name", ["retry_delay", "retryDelay"])
@pytest.mark.asyncio
async def test_watch_retries_timeout_then_completes(async_client: bool, delay_name: str) -> None:
    count = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal count
        count += 1
        assert request.extensions["timeout"]["read"] == 310
        if count == 1:
            return httpx.Response(200, text='event: timeout\ndata: {"error":"timeout"}\n\n')
        return httpx.Response(200, text='event: complete\ndata: {"status":"running"}\n\n')

    req = {"cvm_id": "cvm_1", "target": "running", "max_retries": 1, delay_name: 0}
    transport = httpx.MockTransport(handler)
    if async_client:
        async with httpx.AsyncClient(transport=transport, base_url="https://api.example") as raw:
            result = await AsyncPhalaCloud(http_client=raw).watch_cvm_state(req)
    else:
        with httpx.Client(transport=transport, base_url="https://api.example") as raw:
            result = PhalaCloud(http_client=raw).watch_cvm_state(req)
    assert result.status == "running"
    assert count == 2


@pytest.mark.asyncio
async def test_timeout_event_reconnects_without_waiting_for_stream_to_close() -> None:
    closed = asyncio.Event()
    count = 0

    class TimeoutStream(httpx.AsyncByteStream):
        async def __aiter__(self):
            yield b'event: timeout\ndata: {"error":"timeout"}\n\n'
            await asyncio.Event().wait()

        async def aclose(self) -> None:
            closed.set()

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal count
        count += 1
        if count == 1:
            return httpx.Response(200, stream=TimeoutStream())
        return httpx.Response(200, text='event: complete\ndata: {"status":"running"}\n\n')

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(handler), base_url="https://api.example"
    ) as raw:
        result = await asyncio.wait_for(
            AsyncPhalaCloud(http_client=raw).watch_cvm_state(
                {"cvm_id": "cvm_1", "target": "running", "max_retries": 1, "retry_delay": 0}
            ),
            1,
        )
    assert result.status == "running"
    assert count == 2 and closed.is_set()


@pytest.mark.asyncio
async def test_watch_cancellation_closes_stream() -> None:
    started = asyncio.Event()
    closed = asyncio.Event()

    class BlockingStream(httpx.AsyncByteStream):
        async def __aiter__(self):
            started.set()
            await asyncio.Event().wait()
            yield b""

        async def aclose(self) -> None:
            closed.set()

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, stream=BlockingStream())

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(handler), base_url="https://api.example"
    ) as raw:
        task = asyncio.create_task(
            AsyncPhalaCloud(http_client=raw).watch_cvm_state(
                {"cvm_id": "cvm_1", "target": "running"}
            )
        )
        await asyncio.wait_for(started.wait(), 1)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        assert closed.is_set()
