import base64

import httpx
import pytest

from phala_cloud import AsyncPhalaCloud, PhalaCloud, RequestError


@pytest.mark.parametrize("async_client", [False, True])
@pytest.mark.asyncio
async def test_environment_api_key_precedes_explicit_bearer(
    monkeypatch: pytest.MonkeyPatch, async_client: bool
) -> None:
    monkeypatch.setenv("PHALA_CLOUD_API_KEY", "environment-key")

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["x-api-key"] == "environment-key"
        assert "authorization" not in request.headers
        return httpx.Response(200, json={})

    transport = httpx.MockTransport(handler)
    if async_client:
        async with httpx.AsyncClient(transport=transport, base_url="https://example.com") as raw:
            await AsyncPhalaCloud(http_client=raw, bearer_token="explicit-token").get("/custom")
    else:
        with httpx.Client(transport=transport, base_url="https://example.com") as raw:
            PhalaCloud(http_client=raw, bearer_token="explicit-token").get("/custom")


@pytest.mark.parametrize("async_client", [False, True])
@pytest.mark.asyncio
async def test_oidc_workspace_and_api_key_precedence(
    monkeypatch: pytest.MonkeyPatch, async_client: bool
) -> None:
    monkeypatch.setenv("PHALA_OIDC_TOKEN", "env-token")
    monkeypatch.setenv("PHALA_CLOUD_WORKSPACE", " env-workspace ")
    monkeypatch.delenv("PHALA_CLOUD_API_KEY", raising=False)
    seen: list[httpx.Headers] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.headers)
        return httpx.Response(200, json={})

    transport = httpx.MockTransport(handler)
    if async_client:
        async with httpx.AsyncClient(transport=transport, base_url="https://example.com") as raw:
            await AsyncPhalaCloud(http_client=raw).get("/custom")
            await (
                AsyncPhalaCloud(http_client=raw, bearer_token="explicit", workspace=" wks ")
                .with_version("2026-01-21")
                .get("/custom")
            )
            await AsyncPhalaCloud(http_client=raw, api_key="key").get("/custom")
            await AsyncPhalaCloud(http_client=raw, use_cookie_auth=True).get("/custom")
            with pytest.raises(RequestError):
                await AsyncPhalaCloud(http_client=raw).watch_cvm_state(
                    {"cvm_id": "cvm_123", "target": "running", "max_retries": 0}
                )
    else:
        with httpx.Client(transport=transport, base_url="https://example.com") as raw:
            PhalaCloud(http_client=raw).get("/custom")
            PhalaCloud(http_client=raw, bearer_token="explicit", workspace=" wks ").with_version(
                "2026-01-21"
            ).get("/custom")
            PhalaCloud(http_client=raw, api_key="key").get("/custom")
            PhalaCloud(http_client=raw, use_cookie_auth=True).get("/custom")
            with pytest.raises(RequestError):
                PhalaCloud(http_client=raw).watch_cvm_state(
                    {"cvm_id": "cvm_123", "target": "running", "max_retries": 0}
                )
    assert seen[0]["authorization"] == "Bearer env-token"
    assert seen[0]["x-phala-workspace"] == "env-workspace"
    assert seen[1]["authorization"] == "Bearer explicit"
    assert seen[1]["x-phala-workspace"] == "wks"
    assert seen[2]["x-api-key"] == "key"
    assert "authorization" not in seen[2]
    assert "authorization" not in seen[3]
    assert "x-api-key" not in seen[3]
    assert seen[4]["authorization"] == "Bearer env-token"
    assert seen[4]["x-phala-workspace"] == "env-workspace"


@pytest.mark.parametrize("async_client", [False, True])
@pytest.mark.asyncio
async def test_api_key_and_custom_authorization_header_are_both_sent(
    monkeypatch: pytest.MonkeyPatch, async_client: bool
) -> None:
    monkeypatch.delenv("PHALA_CLOUD_API_KEY", raising=False)
    monkeypatch.delenv("PHALA_OIDC_TOKEN", raising=False)
    seen: list[httpx.Headers] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.headers)
        return httpx.Response(200, json={})

    transport = httpx.MockTransport(handler)
    headers = {"Authorization": "Basic x"}
    if async_client:
        async with httpx.AsyncClient(transport=transport, base_url="https://api.example") as raw:
            await AsyncPhalaCloud(api_key="k", headers=headers, http_client=raw).get("/custom")
    else:
        with httpx.Client(transport=transport, base_url="https://api.example") as raw:
            PhalaCloud(api_key="k", headers=headers, http_client=raw).get("/custom")

    assert seen[0]["x-api-key"] == "k"
    assert seen[0]["authorization"] == "Basic x"


@pytest.mark.parametrize("async_client", [False, True])
@pytest.mark.asyncio
async def test_cookie_mode_preserves_httpx_auth_and_caller_headers(async_client: bool) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["authorization"] == "Basic " + base64.b64encode(b"a:b").decode()
        assert request.headers["x-api-key"] == "custom-key"
        return httpx.Response(200, json={})

    transport = httpx.MockTransport(handler)
    headers = {"X-API-Key": "custom-key"}
    if async_client:
        async with httpx.AsyncClient(
            transport=transport, base_url="https://api.example", auth=("a", "b"), headers=headers
        ) as raw:
            await AsyncPhalaCloud(http_client=raw, use_cookie_auth=True, api_key="ignored").get(
                "/test"
            )
    else:
        with httpx.Client(
            transport=transport, base_url="https://api.example", auth=("a", "b"), headers=headers
        ) as raw:
            PhalaCloud(http_client=raw, use_cookie_auth=True, api_key="ignored").get("/test")


@pytest.mark.parametrize("async_client", [False, True])
@pytest.mark.asyncio
async def test_injected_client_owns_base_url_and_timeout(async_client: bool) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == "https://raw.example/custom"
        assert request.extensions["timeout"]["read"] == 17
        return httpx.Response(200, json={})

    transport = httpx.MockTransport(handler)
    if async_client:
        async with httpx.AsyncClient(
            transport=transport, base_url="https://raw.example", timeout=17
        ) as raw:
            await AsyncPhalaCloud(http_client=raw, base_url="https://sdk.example", timeout=2).get(
                "/custom"
            )
    else:
        with httpx.Client(transport=transport, base_url="https://raw.example", timeout=17) as raw:
            PhalaCloud(http_client=raw, base_url="https://sdk.example", timeout=2).get("/custom")
