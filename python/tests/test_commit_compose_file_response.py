"""commit_cvm_compose_file_update returns the accepted update, not None."""

from __future__ import annotations

from typing import Any

import httpx
import pytest

from phala_cloud import AsyncPhalaCloud, PhalaCloud

REQUEST = {"cvm_id": "cvm-1", "compose_hash": "0xabc"}
ACCEPTED = {
    "status": "in_progress",
    "message": "CVM update initiated",
    "correlation_id": "corr-1",
    "finality_wait": {
        "operation": "update",
        "correlation_id": "corr-1",
        "phase": "awaiting_finality",
        "stage": "safe",
    },
}


async def commit(use_async: bool, response: httpx.Response) -> tuple[Any, httpx.Request]:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return response

    transport = httpx.MockTransport(handler)
    base_url = "https://example.com"
    if use_async:
        async with httpx.AsyncClient(transport=transport, base_url=base_url) as raw:
            result = await AsyncPhalaCloud(http_client=raw).commit_cvm_compose_file_update(REQUEST)
    else:
        with httpx.Client(transport=transport, base_url=base_url) as raw:
            result = PhalaCloud(http_client=raw).commit_cvm_compose_file_update(REQUEST)
    return result, seen[0]


@pytest.mark.parametrize("use_async", [False, True], ids=["sync", "async"])
@pytest.mark.asyncio
async def test_accepted_update_keeps_correlation_id_and_finality_wait(use_async: bool) -> None:
    result, request = await commit(use_async, httpx.Response(202, json=ACCEPTED))

    assert (request.method, request.url.path) == ("PATCH", "/cvms/cvm-1/compose_file")
    assert result.correlation_id == "corr-1"
    assert result.status == "in_progress"
    assert result.model_dump()["finality_wait"]["phase"] == "awaiting_finality"


@pytest.mark.parametrize("use_async", [False, True], ids=["sync", "async"])
@pytest.mark.asyncio
async def test_empty_body_returns_none(use_async: bool) -> None:
    result, _ = await commit(use_async, httpx.Response(202))

    assert result is None
