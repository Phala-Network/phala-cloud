from __future__ import annotations

from collections.abc import Callable
from typing import Any

import httpx
import pytest

import phala_cloud
from phala_cloud import (
    CvmFinalityOperationError,
    CvmFinalityTimeoutError,
    CvmFinalityWaitError,
    PhalaCloudError,
)

CVM = "cvm_123"
CID = "corr-1"
LIST = {"cvm_id": CVM, "correlation_id": CID}
FAST = {"timeout": 5.0, "poll_interval": 0.001}


def wait_info(correlation_id: str = CID, phase: str = "awaiting_finality") -> dict[str, Any]:
    return {
        "operation": "update",
        "correlation_id": correlation_id,
        "phase": phase,
        "stage": "safe",
        "stages": ["submitted", "safe", "finalized", "applying"],
        "transaction": None,
        "finality": {
            "block_tag": "finalized",
            "policy_block_number": 10,
            "blocks_remaining": 2,
            "eta_seconds": 24,
        },
    }


def operation(status: str, correlation_id: str = CID, **extra: Any) -> dict[str, Any]:
    return {
        "correlation_id": correlation_id,
        "operation_type": "compose_update",
        "status": status,
        **extra,
    }


def page(*items: dict[str, Any]) -> httpx.Response:
    return httpx.Response(
        200, json={"items": list(items), "next_cursor": None, "total": len(items)}
    )


class Script:
    """Answers each request with the next scripted response and counts the polls."""

    def __init__(self, *responses: httpx.Response | Exception) -> None:
        self.responses = list(responses)
        self.requests: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        assert request.method == "GET"
        assert request.url.path == f"/cvms/{CVM}/operations"
        assert request.url.params["correlation_id"] == CID
        # Keep answering with the last response once the script runs out.
        item = self.responses.pop(0) if len(self.responses) > 1 else self.responses[0]
        if isinstance(item, Exception):
            raise item
        return item


async def call(
    async_client: bool,
    handler: Callable[[httpx.Request], httpx.Response],
    method: str,
    *args: Any,
    **kwargs: Any,
) -> Any:
    transport = httpx.MockTransport(handler)
    if async_client:
        async with httpx.AsyncClient(transport=transport, base_url="https://example.com") as raw:
            client = phala_cloud.AsyncPhalaCloud(http_client=raw)
            return await getattr(client, method)(*args, **kwargs)
    with httpx.Client(transport=transport, base_url="https://example.com") as raw:
        return getattr(phala_cloud.PhalaCloud(http_client=raw), method)(*args, **kwargs)


both_clients = pytest.mark.parametrize("async_client", [False, True])


@both_clients
async def test_completes_after_polls(async_client: bool) -> None:
    script = Script(
        page(operation("in_progress", finality_wait=wait_info())),
        page(operation("in_progress", finality_wait=wait_info(phase="applying"))),
        page(),  # not listed yet: not a terminal result
        page(operation("completed")),
    )
    result = await call(async_client, script, "wait_for_cvm_finality", CVM, CID, **FAST)
    assert result.status == "completed"
    assert result.correlation_id == CID
    assert len(script.requests) == 4


@both_clients
async def test_failed_operation_raises_typed_error(async_client: bool) -> None:
    script = Script(
        page(
            operation("failed", failure_reason="tx_reverted", error_message="Transaction reverted")
        )
    )
    with pytest.raises(CvmFinalityOperationError) as info:
        await call(async_client, script, "wait_for_cvm_finality", CVM, CID, **FAST)
    error = info.value
    assert isinstance(error, CvmFinalityWaitError)
    assert isinstance(error, PhalaCloudError)
    assert error.status == "failed"
    assert error.failure_reason == "tx_reverted"
    assert error.error_message == "Transaction reverted"
    assert error.operation is not None and error.operation.correlation_id == CID
    assert str(error) == "CVM operation corr-1 failed (tx_reverted). Transaction reverted"


@both_clients
async def test_cancelled_operation_raises_typed_error(async_client: bool) -> None:
    script = Script(page(operation("cancelled", failure_reason="cancelled")))
    with pytest.raises(CvmFinalityOperationError) as info:
        await call(async_client, script, "wait_for_cvm_finality", CVM, CID, **FAST)
    assert info.value.status == "cancelled"
    assert info.value.failure_reason == "cancelled"
    assert str(info.value) == "CVM operation corr-1 cancelled."


@both_clients
async def test_timeout_raises_distinguishable_error(async_client: bool) -> None:
    script = Script(page(operation("in_progress", finality_wait=wait_info())))
    with pytest.raises(CvmFinalityTimeoutError) as info:
        await call(
            async_client,
            script,
            "wait_for_cvm_finality",
            CVM,
            CID,
            timeout=0.05,
            poll_interval=0.005,
        )
    assert not isinstance(info.value, CvmFinalityOperationError)
    assert isinstance(info.value, CvmFinalityWaitError)
    assert len(script.requests) >= 2


@both_clients
async def test_other_correlation_ids_are_ignored(async_client: bool) -> None:
    script = Script(
        page(operation("completed", correlation_id="other"), operation("failed", "other-2")),
        page(operation("completed", correlation_id="other"), operation("completed")),
    )
    result = await call(async_client, script, "wait_for_cvm_finality", CVM, CID, **FAST)
    assert result.correlation_id == CID
    assert len(script.requests) == 2


@both_clients
async def test_transient_error_is_retried(async_client: bool) -> None:
    script = Script(
        httpx.Response(503, json={"detail": "unavailable"}, headers={"Retry-After": "0"}),
        page(operation("completed")),
    )
    result = await call(async_client, script, "wait_for_cvm_finality", CVM, CID, **FAST)
    assert result.status == "completed"
    assert len(script.requests) == 2


@both_clients
async def test_network_error_is_retried_and_last_one_is_the_timeout_cause(
    async_client: bool,
) -> None:
    script = Script(httpx.ConnectError("down"), page(operation("completed")))
    result = await call(async_client, script, "wait_for_cvm_finality", CVM, CID, **FAST)
    assert result.status == "completed"

    down = Script(httpx.ConnectError("down"))
    with pytest.raises(CvmFinalityTimeoutError) as info:
        await call(
            async_client,
            down,
            "wait_for_cvm_finality",
            CVM,
            CID,
            timeout=0.03,
            poll_interval=0.005,
        )
    assert isinstance(info.value.__cause__, phala_cloud.RequestError)


@both_clients
async def test_client_error_is_not_retried(async_client: bool) -> None:
    script = Script(httpx.Response(404, json={"detail": "not found"}))
    with pytest.raises(phala_cloud.ApiError) as info:
        await call(async_client, script, "wait_for_cvm_finality", CVM, CID, **FAST)
    assert info.value.status_code == 404
    assert len(script.requests) == 1


@both_clients
async def test_finality_wait_of_another_operation_is_dropped(async_client: bool) -> None:
    script = Script(
        page(
            operation("in_progress", finality_wait=wait_info("other")),
            operation("completed", finality_wait={"unexpected": "shape"}),
        )
    )
    result = await call(async_client, script, "get_cvm_operations", LIST)
    assert result.items[0].finality_wait is None
    assert result.items[1].finality_wait is None
    assert result.items[1].status == "completed"


@both_clients
async def test_get_cvm_operations_sends_query_and_parses_page(async_client: bool) -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(
            200,
            json={
                "items": [operation("in_progress", finality_wait=wait_info())],
                "next_cursor": "c2",
                "total": 7,
            },
        )

    result = await call(
        async_client,
        handler,
        "get_cvm_operations",
        {
            "cvm_id": CVM,
            "correlation_id": CID,
            "limit": 5,
            "cursor": "c1",
            "operation_types": ["compose_update", "resize"],
        },
    )
    params = seen[0].url.params
    assert seen[0].url.path == f"/cvms/{CVM}/operations"
    assert params["correlation_id"] == CID
    assert params["limit"] == "5"
    assert params["cursor"] == "c1"
    assert params.get_list("operation_types") == ["compose_update", "resize"]
    assert "cvm_id" not in params
    assert result.next_cursor == "c2"
    assert result.items[0].finality_wait is not None
    assert result.items[0].finality_wait.phase == "awaiting_finality"


@both_clients
async def test_safe_variants_return_results(async_client: bool) -> None:
    ok = await call(
        async_client,
        Script(page(operation("completed"))),
        "safe_wait_for_cvm_finality",
        CVM,
        CID,
        **FAST,
    )
    assert ok.ok and ok.data.status == "completed"

    failed = await call(
        async_client,
        Script(page(operation("failed", failure_reason="apply_failed"))),
        "safe_wait_for_cvm_finality",
        CVM,
        CID,
        **FAST,
    )
    assert not failed.ok
    assert isinstance(failed.error, CvmFinalityOperationError)

    listed = await call(
        async_client, Script(page(operation("completed"))), "safe_get_cvm_operations", LIST
    )
    assert listed.ok and len(listed.data.items) == 1


@both_clients
async def test_invalid_arguments(async_client: bool) -> None:
    for kwargs in ({"timeout": 0}, {"poll_interval": 0}):
        with pytest.raises(ValueError):
            await call(async_client, Script(page()), "wait_for_cvm_finality", CVM, CID, **kwargs)
    with pytest.raises(ValueError):
        await call(async_client, Script(page()), "wait_for_cvm_finality", CVM, "")


def test_retry_after_is_read_from_the_response() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(429, json={"detail": "slow down"}, headers={"Retry-After": "2"})

    with httpx.Client(
        transport=httpx.MockTransport(handler), base_url="https://example.com"
    ) as raw:
        with pytest.raises(phala_cloud.ApiError) as info:
            phala_cloud.PhalaCloud(http_client=raw).get_cvm_operations({"cvm_id": CVM})
    assert info.value.retry_after == 2.0


def test_function_style_actions() -> None:
    script = Script(page(operation("completed")))
    with httpx.Client(transport=httpx.MockTransport(script), base_url="https://example.com") as raw:
        client = phala_cloud.PhalaCloud(http_client=raw)
        assert phala_cloud.wait_for_cvm_finality(client, CVM, CID, **FAST).status == "completed"
        assert phala_cloud.safe_wait_for_cvm_finality(client, CVM, CID, **FAST).ok
        assert phala_cloud.get_cvm_operations(client, LIST).items
        assert phala_cloud.safe_get_cvm_operations(client, LIST).ok
