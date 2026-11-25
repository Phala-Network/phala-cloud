"""X-Confirm-Finality-Replacement: request field, wire header and the 412 error."""

from __future__ import annotations

import json
from typing import Any

import httpx
import pytest

from phala_cloud import (
    AsyncPhalaCloud,
    CvmFinalityReplacementRequiredError,
    PhalaCloud,
    ResourceError,
)

HEADER = "x-confirm-finality-replacement"
ACCEPTED = {"message": "CVM update initiated", "correlation_id": "corr-2", "status": "in_progress"}
REQUIRED = {
    "error_code": "ERR-03-067",
    "message": "Confirm that you want to replace the pending CVM update.",
    "details": [
        {"field": "correlation_id", "value": "corr-1"},
        {"field": "stage", "value": "safe"},
    ],
}
ID = {"cvm_id": "cvm-1"}

# method, request, HTTP method, path. Every Python method that calls a route
# which reads the header.
ROUTES: list[tuple[str, dict[str, Any], str, str]] = [
    ("patch_cvm", {**ID, "public_logs": True}, "PATCH", "/cvms/cvm-1"),
    ("update_cvm_resources", {**ID, "vcpu": 4}, "PATCH", "/cvms/cvm-1"),
    (
        "update_cvm_visibility",
        {**ID, "public_sysinfo": True, "public_logs": True},
        "PATCH",
        "/cvms/cvm-1",
    ),
    (
        "confirm_cvm_patch",
        {**ID, "compose_hash": "0xabc", "transaction_hash": "0xdef"},
        "PATCH",
        "/cvms/cvm-1",
    ),
    (
        "update_docker_compose",
        {**ID, "docker_compose_file": "services: {}"},
        "PATCH",
        "/cvms/cvm-1/docker-compose",
    ),
    (
        "update_pre_launch_script",
        {**ID, "pre_launch_script": "echo hi"},
        "PATCH",
        "/cvms/cvm-1/pre-launch-script",
    ),
    (
        "upgrade_pre_launch_script",
        ID,
        "POST",
        "/cvms/cvm-1/pre-launch-script/upgrade-to-latest-official",
    ),
    ("update_cvm_envs", {**ID, "encrypted_env": "00"}, "PATCH", "/cvms/cvm-1/envs"),
    (
        "commit_cvm_compose_file_update",
        {**ID, "compose_hash": "0xabc"},
        "PATCH",
        "/cvms/cvm-1/compose_file",
    ),
    ("commit_cvm_update", {**ID, "token": "one-time"}, "POST", "/cvms/cvm-1/commit-update"),
]
ROUTE_IDS = [route[0] for route in ROUTES]


class Server:
    """Answers 412 while the header is "none", 202 otherwise, and records requests."""

    def __init__(self, payload: dict[str, Any] = REQUIRED) -> None:
        self.payload = payload
        self.requests: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if request.headers.get(HEADER) == "none":
            return httpx.Response(412, json=self.payload)
        return httpx.Response(202, json=ACCEPTED)


async def call(use_async: bool, server: Server, name: str, request: dict[str, Any]) -> Any:
    transport = httpx.MockTransport(server)
    base_url = "https://example.com"
    if use_async:
        async with httpx.AsyncClient(transport=transport, base_url=base_url) as raw:
            return await getattr(AsyncPhalaCloud(http_client=raw), name)(request)
    with httpx.Client(transport=transport, base_url=base_url) as raw:
        return getattr(PhalaCloud(http_client=raw), name)(request)


@pytest.mark.parametrize("use_async", [False, True], ids=["sync", "async"])
@pytest.mark.parametrize(("name", "request_body", "method", "path"), ROUTES, ids=ROUTE_IDS)
@pytest.mark.asyncio
async def test_header_is_sent_only_when_the_field_is_set(
    use_async: bool, name: str, request_body: dict[str, Any], method: str, path: str
) -> None:
    server = Server()
    await call(use_async, server, name, request_body)
    await call(use_async, server, name, {**request_body, "confirm_finality_replacement": "corr-1"})
    omitted, confirmed = server.requests

    assert (omitted.method, omitted.url.path) == (method, path)
    assert HEADER not in omitted.headers
    assert (confirmed.method, confirmed.url.path) == (method, path)
    assert confirmed.headers[HEADER] == "corr-1"
    # The field is a header, never part of a JSON body.
    assert b"confirm_finality_replacement" not in confirmed.content


@pytest.mark.parametrize("use_async", [False, True], ids=["sync", "async"])
@pytest.mark.parametrize(("name", "request_body", "method", "path"), ROUTES, ids=ROUTE_IDS)
@pytest.mark.asyncio
async def test_none_asks_the_server_to_require_confirmation(
    use_async: bool, name: str, request_body: dict[str, Any], method: str, path: str
) -> None:
    server = Server()
    with pytest.raises(CvmFinalityReplacementRequiredError):
        await call(
            use_async, server, name, {**request_body, "confirm_finality_replacement": "none"}
        )

    assert server.requests[0].headers[HEADER] == "none"


@pytest.mark.parametrize("use_async", [False, True], ids=["sync", "async"])
@pytest.mark.asyncio
async def test_412_is_parsed_into_the_typed_error(use_async: bool) -> None:
    server = Server()
    with pytest.raises(CvmFinalityReplacementRequiredError) as caught:
        await call(
            use_async,
            server,
            "patch_cvm",
            {**ID, "public_logs": True, "confirm_finality_replacement": "none"},
        )

    error = caught.value
    assert isinstance(error, ResourceError)
    assert error.status_code == 412
    assert error.error_code == "ERR-03-067"
    assert error.correlation_id == "corr-1"
    assert error.stage == "safe"


@pytest.mark.parametrize("use_async", [False, True], ids=["sync", "async"])
@pytest.mark.asyncio
async def test_safe_result_carries_the_typed_error(use_async: bool) -> None:
    result = await call(
        use_async,
        Server(),
        "safe_patch_cvm",
        {**ID, "public_logs": True, "confirm_finality_replacement": "none"},
    )

    assert result.ok is False
    assert isinstance(result.error, CvmFinalityReplacementRequiredError)
    assert result.error.correlation_id == "corr-1"


@pytest.mark.parametrize("use_async", [False, True], ids=["sync", "async"])
@pytest.mark.asyncio
async def test_other_412_errors_stay_plain_resource_errors(use_async: bool) -> None:
    other = {"error_code": "ERR-03-999", "message": "Other", "details": []}
    with pytest.raises(ResourceError) as caught:
        await call(
            use_async,
            Server(other),
            "patch_cvm",
            {**ID, "public_logs": True, "confirm_finality_replacement": "none"},
        )

    assert not isinstance(caught.value, CvmFinalityReplacementRequiredError)


@pytest.mark.parametrize("use_async", [False, True], ids=["sync", "async"])
@pytest.mark.asyncio
async def test_retry_with_the_correlation_id_goes_through(use_async: bool) -> None:
    server = Server()
    update = {**ID, "public_logs": True}
    with pytest.raises(CvmFinalityReplacementRequiredError) as caught:
        await call(
            use_async, server, "patch_cvm", {**update, "confirm_finality_replacement": "none"}
        )

    retried = await call(
        use_async,
        server,
        "patch_cvm",
        {**update, "confirm_finality_replacement": caught.value.correlation_id},
    )

    assert server.requests[-1].headers[HEADER] == "corr-1"
    assert json.loads(server.requests[-1].content) == {"public_logs": True}
    assert retried["correlation_id"] == "corr-2"
