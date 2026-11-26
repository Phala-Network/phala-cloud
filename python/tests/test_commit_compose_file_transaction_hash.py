"""commit_cvm_compose_file_update sends transaction_hash only when it is given."""

from __future__ import annotations

import json
from typing import Any

import httpx
import pytest

from phala_cloud import AsyncPhalaCloud, PhalaCloud

REQUEST = {"cvm_id": "cvm-1", "compose_hash": "0xabc"}


async def sent_body(use_async: bool, request: dict[str, Any]) -> dict[str, Any]:
    seen: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        seen.append(req)
        return httpx.Response(202)

    transport = httpx.MockTransport(handler)
    base_url = "https://example.com"
    if use_async:
        async with httpx.AsyncClient(transport=transport, base_url=base_url) as raw:
            await AsyncPhalaCloud(http_client=raw).commit_cvm_compose_file_update(request)
    else:
        with httpx.Client(transport=transport, base_url=base_url) as raw:
            PhalaCloud(http_client=raw).commit_cvm_compose_file_update(request)
    body: dict[str, Any] = json.loads(seen[0].content)
    return body


@pytest.mark.parametrize("use_async", [False, True], ids=["sync", "async"])
@pytest.mark.parametrize("value", ["0xdef", "already-registered"])
@pytest.mark.asyncio
async def test_transaction_hash_is_sent_when_given(use_async: bool, value: str) -> None:
    body = await sent_body(use_async, {**REQUEST, "transaction_hash": value})

    assert body["transaction_hash"] == value
    assert body["compose_hash"] == "0xabc"


@pytest.mark.parametrize("use_async", [False, True], ids=["sync", "async"])
@pytest.mark.asyncio
async def test_transaction_hash_is_absent_when_not_given(use_async: bool) -> None:
    body = await sent_body(use_async, REQUEST)

    assert "transaction_hash" not in body
