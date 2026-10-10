"""Real-network regression: an API redirect must never forward credentials."""

import json
from collections.abc import Iterator
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread

import httpx
import pytest

from phala_cloud import AsyncPhalaCloud, PhalaCloud
from phala_cloud.errors import ApiError

KEY = "redirect-regression-secret"
STATUSES = [301, 302, 303, 307, 308]
METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]


@dataclass
class Origins:
    api: str = ""
    attacker: str = ""
    status: int = 302
    api_keys: list[str | None] = field(default_factory=list)
    api_bodies: list[bytes] = field(default_factory=list)
    attacker_keys: list[str | None] = field(default_factory=list)


@pytest.fixture
def origins() -> Iterator[Origins]:
    state = Origins()

    class Handler(BaseHTTPRequestHandler):
        def handle_request(self) -> None:
            length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(length)
            is_attacker = self.server is attacker
            if not is_attacker:
                state.api_bodies.append(body)
            keys = state.attacker_keys if is_attacker else state.api_keys
            keys.append(self.headers.get("X-API-Key"))
            redirect = not is_attacker and not self.path.startswith("/ok")
            status = (
                int(self.path.split("/")[-1])
                if self.path.startswith("/redirect/")
                else state.status
            )
            self.send_response(status if redirect else 200)
            if redirect:
                self.send_header("Location", state.attacker + "/stolen")
            streaming = "text/event-stream" in self.headers.get("Accept", "")
            body = (
                b'event: complete\ndata: {"status":"running"}\n\n' if streaming else b'{"ok":true}'
            )
            self.send_header(
                "Content-Type", "text/event-stream" if streaming else "application/json"
            )
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)

        do_GET = do_HEAD = do_POST = do_PUT = do_PATCH = do_DELETE = do_OPTIONS = handle_request

        def log_message(self, *_: object) -> None:
            pass

    attacker = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    api = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    state.api = f"http://127.0.0.1:{api.server_port}"
    state.attacker = f"http://127.0.0.1:{attacker.server_port}"
    threads = [
        Thread(target=server.serve_forever, kwargs={"poll_interval": 0.01})
        for server in (api, attacker)
    ]
    for thread in threads:
        thread.start()
    try:
        yield state
    finally:
        for server in (api, attacker):
            server.shutdown()
            server.server_close()
        for thread in threads:
            thread.join()


@pytest.mark.parametrize("status", STATUSES)
@pytest.mark.parametrize("method", METHODS)
def test_sync_redirect_never_leaks_key(origins: Origins, status: int, method: str) -> None:
    # Control reproduces the pre-fix HTTPX behavior against the same two servers.
    with httpx.Client(
        base_url=origins.api, headers={"X-API-Key": KEY}, follow_redirects=True
    ) as unsafe:
        unsafe.request(method, f"/redirect/{status}")
        assert origins.attacker_keys == [KEY]
        origins.attacker_keys.clear()
        # Supplied client and explicit caller override must not bypass SDK policy.
        with PhalaCloud(api_key=KEY, base_url=origins.api, http_client=unsafe) as client:
            with pytest.raises(ApiError) as error:
                client.request(method, f"/redirect/{status}", follow_redirects=True)
            assert error.value.status_code == status
            assert f"HTTP {status}" in str(error.value)
            assert "trusted final URL" in str(error.value)
            full = client.request_full(method, f"/redirect/{status}", follow_redirects=True)
            assert full["status"] == status and not full["ok"]
            assert unsafe.follow_redirects is True
        assert not unsafe.is_closed
    with PhalaCloud(api_key=KEY, base_url=origins.api) as client:
        with pytest.raises(ApiError):
            client.request(method, f"/redirect/{status}")
        assert client.request("GET", "/ok") == {"ok": True}
    assert origins.api_keys and all(key == KEY for key in origins.api_keys)
    assert origins.attacker_keys == []


@pytest.mark.parametrize("status", STATUSES)
@pytest.mark.parametrize("method", METHODS)
async def test_async_redirect_never_leaks_key(origins: Origins, status: int, method: str) -> None:
    async with httpx.AsyncClient(
        base_url=origins.api, headers={"X-API-Key": KEY}, follow_redirects=True
    ) as unsafe:
        await unsafe.request(method, f"/redirect/{status}")
        assert origins.attacker_keys == [KEY]
        origins.attacker_keys.clear()
        async with AsyncPhalaCloud(api_key=KEY, base_url=origins.api, http_client=unsafe) as client:
            with pytest.raises(ApiError) as error:
                await client.request(method, f"/redirect/{status}", follow_redirects=True)
            assert error.value.status_code == status
            assert f"HTTP {status}" in str(error.value)
            assert "trusted final URL" in str(error.value)
            full = await client.request_full(method, f"/redirect/{status}", follow_redirects=True)
            assert full["status"] == status and not full["ok"]
            assert unsafe.follow_redirects is True
        assert not unsafe.is_closed
    async with AsyncPhalaCloud(api_key=KEY, base_url=origins.api) as client:
        with pytest.raises(ApiError):
            await client.request(method, f"/redirect/{status}")
        assert await client.request("GET", "/ok") == {"ok": True}
    assert origins.api_keys and all(key == KEY for key in origins.api_keys)
    assert origins.attacker_keys == []


@pytest.mark.parametrize("status", STATUSES)
def test_sync_stream_redirect_never_leaks_key(origins: Origins, status: int) -> None:
    origins.status = status
    with httpx.Client(
        base_url=origins.api, headers={"X-API-Key": KEY}, follow_redirects=True
    ) as transport:
        with PhalaCloud(api_key=KEY, http_client=transport) as client:
            with pytest.raises(httpx.HTTPStatusError):
                client.watch_cvm_state({"id": "cvm-test", "target": "running", "max_retries": 0})
        assert transport.follow_redirects is True
    assert origins.api_keys == [KEY]
    assert origins.attacker_keys == []


@pytest.mark.parametrize("custom", [False, True])
def test_sync_nonredirect_preserves_post_and_stream(origins: Origins, custom: bool) -> None:
    with httpx.Client(
        base_url=origins.api + "/ok", headers={"X-API-Key": KEY}, follow_redirects=True
    ) as transport:
        with PhalaCloud(
            api_key=KEY, base_url=origins.api + "/ok", http_client=transport if custom else None
        ) as client:
            assert client.post("/post", json={"hello": "world"}) == {"ok": True}
            assert json.loads(origins.api_bodies[-1]) == {"hello": "world"}
            full = client.request_full("GET", "/full")
            assert full["ok"] and full["data"] == {"ok": True}
            state = client.watch_cvm_state(
                {"id": "cvm-test", "target": "running", "max_retries": 0}
            )
            assert state.status == "running"
            result = client.safe_request_method("GET", origins.api + "/redirect/302")
            assert not result.ok and isinstance(result.error, ApiError)
    assert origins.api_keys == [KEY] * 4
    assert origins.attacker_keys == []


@pytest.mark.parametrize("custom", [False, True])
async def test_async_nonredirect_preserves_post_and_stream(origins: Origins, custom: bool) -> None:
    async with httpx.AsyncClient(
        base_url=origins.api + "/ok", headers={"X-API-Key": KEY}, follow_redirects=True
    ) as transport:
        async with AsyncPhalaCloud(
            api_key=KEY, base_url=origins.api + "/ok", http_client=transport if custom else None
        ) as client:
            assert await client.post("/post", json={"hello": "world"}) == {"ok": True}
            assert json.loads(origins.api_bodies[-1]) == {"hello": "world"}
            full = await client.request_full("GET", "/full")
            assert full["ok"] and full["data"] == {"ok": True}
            state = await client.watch_cvm_state(
                {"id": "cvm-test", "target": "running", "max_retries": 0}
            )
            assert state.status == "running"
            result = await client.safe_request_method("GET", origins.api + "/redirect/302")
            assert not result.ok and isinstance(result.error, ApiError)
    assert origins.api_keys == [KEY] * 4
    assert origins.attacker_keys == []


@pytest.mark.parametrize("status", STATUSES)
async def test_async_stream_redirect_never_leaks_key(origins: Origins, status: int) -> None:
    origins.status = status
    async with httpx.AsyncClient(
        base_url=origins.api, headers={"X-API-Key": KEY}, follow_redirects=True
    ) as transport:
        async with AsyncPhalaCloud(api_key=KEY, http_client=transport) as client:
            with pytest.raises(httpx.HTTPStatusError):
                await client.watch_cvm_state(
                    {"id": "cvm-test", "target": "running", "max_retries": 0}
                )
        assert transport.follow_redirects is True
    assert origins.api_keys == [KEY]
    assert origins.attacker_keys == []
