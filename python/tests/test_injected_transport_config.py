import httpx
import pytest

from phala_cloud import AsyncPhalaCloud, PhalaCloud


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
