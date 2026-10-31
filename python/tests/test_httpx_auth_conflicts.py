import base64

import httpx
import pytest

from phala_cloud import AsyncPhalaCloud, PhalaCloud, RequestError


@pytest.mark.parametrize("async_client", [False, True])
@pytest.mark.asyncio
async def test_cookie_mode_preserves_httpx_auth(async_client: bool) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["authorization"] == "Basic " + base64.b64encode(b"a:b").decode()
        return httpx.Response(200, json={})

    transport = httpx.MockTransport(handler)
    if async_client:
        async with httpx.AsyncClient(
            transport=transport, base_url="https://api.example", auth=("a", "b")
        ) as raw:
            await AsyncPhalaCloud(http_client=raw, use_cookie_auth=True, api_key="ignored").get(
                "/test"
            )
    else:
        with httpx.Client(
            transport=transport, base_url="https://api.example", auth=("a", "b")
        ) as raw:
            PhalaCloud(http_client=raw, use_cookie_auth=True, api_key="ignored").get("/test")


@pytest.mark.parametrize("async_client", [False, True])
@pytest.mark.asyncio
async def test_sdk_auth_rejects_userinfo_in_injected_base_url(async_client: bool) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("credentials conflict must be rejected before send")

    transport = httpx.MockTransport(handler)
    if async_client:
        async with httpx.AsyncClient(
            transport=transport, base_url="https://a:b@api.example"
        ) as raw:
            client = AsyncPhalaCloud(http_client=raw, api_key="selected")
            with pytest.raises(RequestError):
                await client.get("/test")
            with pytest.raises(RequestError):
                await client.watch_cvm_state(
                    {"cvm_id": "cvm_1", "target": "running", "max_retries": 0}
                )
    else:
        with httpx.Client(transport=transport, base_url="https://a:b@api.example") as raw:
            client_sync = PhalaCloud(http_client=raw, api_key="selected")
            with pytest.raises(RequestError):
                client_sync.get("/test")
            with pytest.raises(RequestError):
                client_sync.watch_cvm_state(
                    {"cvm_id": "cvm_1", "target": "running", "max_retries": 0}
                )


@pytest.mark.parametrize("async_client", [False, True])
@pytest.mark.parametrize("options", [{"api_key": "selected"}, {"bearer_token": "selected"}])
@pytest.mark.asyncio
async def test_httpx_auth_does_not_replace_sdk_identity(
    monkeypatch: pytest.MonkeyPatch, async_client: bool, options: dict[str, str]
) -> None:
    monkeypatch.delenv("PHALA_CLOUD_API_KEY", raising=False)
    monkeypatch.delenv("PHALA_OIDC_TOKEN", raising=False)

    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("credentials conflict must be rejected before send")

    transport = httpx.MockTransport(handler)
    if async_client:
        async with httpx.AsyncClient(
            transport=transport, base_url="https://api.example", auth=("a", "b")
        ) as raw:
            client = AsyncPhalaCloud(http_client=raw, **options)
            for action in (client.request, client.request_full):
                with pytest.raises(RequestError):
                    await action("GET", "/test")
            with pytest.raises(RequestError):
                await client.watch_cvm_state(
                    {"cvm_id": "cvm_1", "target": "running", "max_retries": 0}
                )
        async with httpx.AsyncClient(transport=transport, base_url="https://api.example") as raw:
            client = AsyncPhalaCloud(http_client=raw, **options)
            with pytest.raises(RequestError):
                await client.request("GET", "/test", auth=("a", "b"))
            with pytest.raises(RequestError):
                await client.request("GET", "https://a:b@api.example/test")
    else:
        with httpx.Client(
            transport=transport, base_url="https://api.example", auth=("a", "b")
        ) as raw:
            sync = PhalaCloud(http_client=raw, **options)
            for action_sync in (sync.request, sync.request_full):
                with pytest.raises(RequestError):
                    action_sync("GET", "/test")
            with pytest.raises(RequestError):
                sync.watch_cvm_state({"cvm_id": "cvm_1", "target": "running", "max_retries": 0})
        with httpx.Client(transport=transport, base_url="https://api.example") as raw:
            sync = PhalaCloud(http_client=raw, **options)
            with pytest.raises(RequestError):
                sync.request("GET", "/test", auth=("a", "b"))
            with pytest.raises(RequestError):
                sync.request("GET", "https://a:b@api.example/test")
