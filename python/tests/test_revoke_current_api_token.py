import httpx
import pytest

import phala_cloud


def test_revoke_token_sync() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "DELETE"
        assert request.url.path == "/tokens/self"
        return httpx.Response(204)

    with httpx.Client(
        transport=httpx.MockTransport(handler), base_url="https://example.com"
    ) as raw:
        client = phala_cloud.PhalaCloud(http_client=raw)
        assert phala_cloud.revoke_current_api_token(client) is None
        assert phala_cloud.safe_revoke_current_api_token(client).unwrap() is None


@pytest.mark.asyncio
async def test_revoke_token_async() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "DELETE"
        assert request.url.path == "/tokens/self"
        return httpx.Response(204)

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(handler), base_url="https://example.com"
    ) as raw:
        client = phala_cloud.AsyncPhalaCloud(http_client=raw)
        assert await phala_cloud.revoke_current_api_token(client) is None
        assert (await phala_cloud.safe_revoke_current_api_token(client)).unwrap() is None
