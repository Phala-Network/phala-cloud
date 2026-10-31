import ssl

import httpx
import pytest

from phala_cloud import AsyncPhalaCloud, AuthError, PhalaCloud, RequestError


@pytest.mark.parametrize("asynchronous", [False, True])
@pytest.mark.parametrize("failure", ["error_eof", "eof", "transport"])
@pytest.mark.parametrize("budget", [0, 1, None])
@pytest.mark.asyncio
async def test_watch_reconnect_budget(asynchronous: bool, failure: str, budget: int | None) -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        if calls == 1:
            if failure == "transport":
                raise httpx.ConnectError("connection lost", request=request)
            if failure == "error_eof":
                return httpx.Response(200, text='event: error\ndata: {"error":"server detail"}\n\n')
            return httpx.Response(200, text="")
        assert calls == 2
        return httpx.Response(200, text='event: complete\ndata: {"status":"running"}\n\n')

    req = {"cvm_id": "cvm_1", "target": "running", "retry_delay": 0}
    if budget is not None:
        req["max_retries"] = budget
    transport = httpx.MockTransport(handler)
    if asynchronous:
        async with httpx.AsyncClient(transport=transport, base_url="https://example.com") as raw:
            client = AsyncPhalaCloud(http_client=raw)
            if budget == 0:
                with pytest.raises(RequestError) as exc:
                    await client.watch_cvm_state(req)
            else:
                assert (await client.watch_cvm_state(req)).status == "running"
    else:
        with httpx.Client(transport=transport, base_url="https://example.com") as raw:
            client_sync = PhalaCloud(http_client=raw)
            if budget == 0:
                with pytest.raises(RequestError) as exc:
                    client_sync.watch_cvm_state(req)
            else:
                assert client_sync.watch_cvm_state(req).status == "running"
    assert calls == (1 if budget == 0 else 2)
    if budget == 0 and failure != "eof":
        assert ("server detail" if failure == "error_eof" else "connection lost") in str(exc.value)


@pytest.mark.parametrize("asynchronous", [False, True])
@pytest.mark.asyncio
async def test_watch_keeps_server_and_transport_diagnostics(asynchronous: bool) -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        if calls == 1:
            return httpx.Response(200, text='event: error\ndata: {"error":"server detail"}\n\n')
        raise httpx.ConnectError("connection lost", request=request)

    req = {"cvm_id": "cvm_1", "target": "running", "max_retries": 1, "retry_delay": 0}
    transport = httpx.MockTransport(handler)
    if asynchronous:
        async with httpx.AsyncClient(transport=transport, base_url="https://example.com") as raw:
            with pytest.raises(RequestError) as exc:
                await AsyncPhalaCloud(http_client=raw).watch_cvm_state(req)
    else:
        with httpx.Client(transport=transport, base_url="https://example.com") as raw:
            with pytest.raises(RequestError) as exc:
                PhalaCloud(http_client=raw).watch_cvm_state(req)
    assert calls == 2
    assert "server detail" in str(exc.value)
    assert "connection lost" in str(exc.value)


@pytest.mark.parametrize("asynchronous", [False, True])
@pytest.mark.asyncio
async def test_watch_nonretryable_httpx_error_stops(asynchronous: bool) -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        raise httpx.UnsupportedProtocol("bad protocol")

    req = {"cvm_id": "cvm_1", "target": "running", "retry_delay": 0}
    transport = httpx.MockTransport(handler)
    if asynchronous:
        async with httpx.AsyncClient(transport=transport, base_url="https://example.com") as raw:
            with pytest.raises(RequestError, match="bad protocol"):
                await AsyncPhalaCloud(http_client=raw).watch_cvm_state(req)
    else:
        with httpx.Client(transport=transport, base_url="https://example.com") as raw:
            with pytest.raises(RequestError, match="bad protocol"):
                PhalaCloud(http_client=raw).watch_cvm_state(req)
    assert calls == 1


@pytest.mark.parametrize("asynchronous", [False, True])
@pytest.mark.asyncio
async def test_watch_certificate_validation_error_is_not_retried(asynchronous: bool) -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        assert calls == 1
        try:
            raise ssl.SSLCertVerificationError("certificate verification failed")
        except ssl.SSLCertVerificationError as error:
            raise httpx.ConnectError("TLS validation failed", request=request) from error

    req = {"cvm_id": "cvm_1", "target": "running", "retry_delay": 0}
    transport = httpx.MockTransport(handler)
    if asynchronous:
        async with httpx.AsyncClient(transport=transport, base_url="https://example.com") as raw:
            with pytest.raises(RequestError, match="TLS validation failed"):
                await AsyncPhalaCloud(http_client=raw).watch_cvm_state(req)
    else:
        with httpx.Client(transport=transport, base_url="https://example.com") as raw:
            with pytest.raises(RequestError, match="TLS validation failed"):
                PhalaCloud(http_client=raw).watch_cvm_state(req)
    assert calls == 1


@pytest.mark.parametrize("asynchronous", [False, True])
@pytest.mark.asyncio
async def test_watch_auth_failure_never_retried(asynchronous: bool) -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(401, json={"detail": "not authorized"})

    req = {"cvm_id": "cvm_1", "target": "running", "max_retries": 2, "retry_delay": 0}
    transport = httpx.MockTransport(handler)
    if asynchronous:
        async with httpx.AsyncClient(transport=transport, base_url="https://example.com") as raw:
            with pytest.raises(AuthError):
                await AsyncPhalaCloud(http_client=raw).watch_cvm_state(req)
    else:
        with httpx.Client(transport=transport, base_url="https://example.com") as raw:
            with pytest.raises(AuthError):
                PhalaCloud(http_client=raw).watch_cvm_state(req)
    assert calls == 1
