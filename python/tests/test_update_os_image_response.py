"""update_os_image returns the accepted update, not None."""

from __future__ import annotations

import httpx
import pytest

from phala_cloud import AsyncPhalaCloud, PhalaCloud

REQUEST = {"cvm_id": "cvm-1", "os_image_name": "dstack-0.6.0"}
ACCEPTED = {"message": "OS image update initiated", "correlation_id": "corr-9", "status": "ok"}


@pytest.mark.parametrize("use_async", [False, True], ids=["sync", "async"])
@pytest.mark.parametrize(
    ("body", "correlation_id"),
    [(ACCEPTED, "corr-9"), (None, None)],
    ids=["body", "empty"],
)
@pytest.mark.asyncio
async def test_update_os_image_returns_the_accepted_update(
    use_async: bool, body: dict[str, str] | None, correlation_id: str | None
) -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(202, json=body) if body else httpx.Response(202)

    transport = httpx.MockTransport(handler)
    base_url = "https://example.com"
    if use_async:
        async with httpx.AsyncClient(transport=transport, base_url=base_url) as raw:
            result = await AsyncPhalaCloud(http_client=raw).update_os_image(REQUEST)
    else:
        with httpx.Client(transport=transport, base_url=base_url) as raw:
            result = PhalaCloud(http_client=raw).update_os_image(REQUEST)

    assert (seen[0].method, seen[0].url.path) == ("PATCH", "/cvms/cvm-1/os-image")
    assert (result.correlation_id if result else None) == correlation_id
