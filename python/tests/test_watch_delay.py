import httpx
import pytest

from phala_cloud import AsyncPhalaCloud, PhalaCloud


@pytest.mark.parametrize("asynchronous", [False, True])
@pytest.mark.parametrize("delay_name", ["retry_delay", "retryDelay"])
@pytest.mark.asyncio
async def test_watch_uses_nonzero_retry_delay(
    monkeypatch: pytest.MonkeyPatch, asynchronous: bool, delay_name: str
) -> None:
    delays: list[float] = []
    calls = 0

    def sync_sleep(self: PhalaCloud, seconds: float) -> None:
        delays.append(seconds)

    async def async_sleep(self: AsyncPhalaCloud, seconds: float) -> None:
        delays.append(seconds)

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        if calls == 1:
            return httpx.Response(200, text='event: timeout\ndata: {"error":"timeout"}\n\n')
        return httpx.Response(200, text='event: complete\ndata: {"status":"running"}\n\n')

    req = {"cvm_id": "cvm_1", "target": "running", "max_retries": 1, delay_name: 0.75}
    transport = httpx.MockTransport(handler)
    if asynchronous:
        monkeypatch.setattr(AsyncPhalaCloud, "_sleep", async_sleep)
        async with httpx.AsyncClient(transport=transport, base_url="https://example.com") as raw:
            result = await AsyncPhalaCloud(http_client=raw).watch_cvm_state(req)
    else:
        monkeypatch.setattr(PhalaCloud, "_sleep", sync_sleep)
        with httpx.Client(transport=transport, base_url="https://example.com") as raw:
            result = PhalaCloud(http_client=raw).watch_cvm_state(req)
    assert result.status == "running"
    assert calls == 2
    assert delays == [0.75]
