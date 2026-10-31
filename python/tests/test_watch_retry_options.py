import httpx
import pytest

from phala_cloud import AsyncPhalaCloud, PhalaCloud


@pytest.mark.parametrize("option", ["max_retries", "maxRetries"])
def test_sync_watch_respects_retry_limit(option: str) -> None:
    count = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal count
        count += 1
        if count > 1:
            raise AssertionError("unexpected retry")
        return httpx.Response(200, text="")

    with httpx.Client(
        transport=httpx.MockTransport(handler), base_url="https://example.com"
    ) as raw:
        with pytest.raises(TimeoutError):
            PhalaCloud(http_client=raw).watch_cvm_state(
                {"cvm_id": "cvm_123", "target": "running", option: 0, "retry_delay": 0}
            )
    assert count == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("option", ["max_retries", "maxRetries"])
async def test_async_watch_respects_retry_limit(option: str) -> None:
    count = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal count
        count += 1
        if count > 1:
            raise AssertionError("unexpected retry")
        return httpx.Response(200, text="")

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(handler), base_url="https://example.com"
    ) as raw:
        with pytest.raises(TimeoutError):
            await AsyncPhalaCloud(http_client=raw).watch_cvm_state(
                {"cvm_id": "cvm_123", "target": "running", option: 0, "retry_delay": 0}
            )
    assert count == 1
