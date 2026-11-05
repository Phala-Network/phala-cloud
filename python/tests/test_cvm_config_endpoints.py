"""Wire contract of the CVM annotations, app launch token and init-script endpoints."""

from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any

import httpx
import pytest

import phala_cloud

_BASE_URL = "https://cloud-api.phala.com/api/v1"
_TOKEN = {"launch_token": "t" * 43, "launch_token_hash": "ab" * 32}
_INIT_SCRIPTS = {
    "items": [
        {"slug": "docker_cleanup", "selected": True, "selectable": True, "reason": None},
        {
            "slug": "env_merge",
            "selected": False,
            "selectable": False,
            "reason": "The env_merge init script is not enabled for this account or workspace.",
        },
    ]
}


class _Recorder:
    def __init__(self, respond: Callable[[httpx.Request], httpx.Response]) -> None:
        self.respond = respond
        self.calls: list[tuple[str, str, Any]] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content) if request.content else None
        self.calls.append((request.method, request.url.path, body))
        return self.respond(request)


async def _run(use_async: bool, recorder: _Recorder, action: str, request: Any) -> Any:
    """Call the client method, the action function and their safe_ variants."""
    transport = httpx.MockTransport(recorder)
    fn = getattr(phala_cloud, action)
    safe_fn = getattr(phala_cloud, f"safe_{action}")
    if use_async:
        async with httpx.AsyncClient(transport=transport, base_url=_BASE_URL) as raw:
            client = phala_cloud.AsyncPhalaCloud(http_client=raw)
            results = [
                await getattr(client, action)(request),
                await fn(client, request),
                (await safe_fn(client, request)).unwrap(),
            ]
    else:
        with httpx.Client(transport=transport, base_url=_BASE_URL) as raw:
            client = phala_cloud.PhalaCloud(http_client=raw)
            results = [
                getattr(client, action)(request),
                fn(client, request),
                safe_fn(client, request).unwrap(),
            ]
    assert all(result == results[0] for result in results)
    return results[0]


@pytest.mark.parametrize("use_async", [False, True])
@pytest.mark.asyncio
async def test_get_cvm_annotations(use_async: bool) -> None:
    recorder = _Recorder(lambda _: httpx.Response(200, json={"annotations": {"tier": "fast"}}))
    result = await _run(use_async, recorder, "get_cvm_annotations", {"id": "cvm-1"})

    assert recorder.calls[0] == ("GET", "/api/v1/cvms/cvm-1/annotations", None)
    assert isinstance(result, phala_cloud.CvmAnnotationsResponse)
    assert result.annotations == {"tier": "fast"}


@pytest.mark.parametrize("use_async", [False, True])
@pytest.mark.asyncio
async def test_update_cvm_annotations_replaces_the_whole_map(use_async: bool) -> None:
    recorder = _Recorder(lambda request: httpx.Response(200, json=json.loads(request.content)))
    result = await _run(
        use_async, recorder, "update_cvm_annotations", {"id": "cvm-1", "annotations": {}}
    )

    assert recorder.calls[0] == ("PUT", "/api/v1/cvms/cvm-1/annotations", {"annotations": {}})
    assert result.annotations == {}


@pytest.mark.parametrize("use_async", [False, True])
@pytest.mark.asyncio
async def test_set_app_launch_token_lets_the_api_generate_one(use_async: bool) -> None:
    recorder = _Recorder(lambda _: httpx.Response(200, json=_TOKEN))
    result = await _run(use_async, recorder, "set_app_launch_token", {"app_id": "abc123"})

    assert recorder.calls[0] == ("POST", "/api/v1/apps/abc123/launch-token", {})
    assert isinstance(result, phala_cloud.AppLaunchTokenResponse)
    assert (result.launch_token, result.launch_token_hash) == (
        _TOKEN["launch_token"],
        _TOKEN["launch_token_hash"],
    )


def test_set_app_launch_token_sends_a_caller_token() -> None:
    recorder = _Recorder(lambda _: httpx.Response(200, json=_TOKEN))
    with httpx.Client(transport=httpx.MockTransport(recorder), base_url=_BASE_URL) as raw:
        phala_cloud.PhalaCloud(http_client=raw).set_app_launch_token(
            {"appId": "abc123", "launch_token": _TOKEN["launch_token"]}
        )

    assert recorder.calls == [
        (
            "POST",
            "/api/v1/apps/abc123/launch-token",
            {"launch_token": _TOKEN["launch_token"]},
        )
    ]


@pytest.mark.parametrize("use_async", [False, True])
@pytest.mark.asyncio
async def test_clear_app_launch_token(use_async: bool) -> None:
    recorder = _Recorder(lambda _: httpx.Response(204))
    result = await _run(use_async, recorder, "clear_app_launch_token", {"app_id": "abc123"})

    assert recorder.calls[0] == ("DELETE", "/api/v1/apps/abc123/launch-token", None)
    assert result is None


@pytest.mark.parametrize("use_async", [False, True])
@pytest.mark.asyncio
async def test_get_cvm_init_scripts(use_async: bool) -> None:
    recorder = _Recorder(lambda _: httpx.Response(200, json=_INIT_SCRIPTS))
    result = await _run(use_async, recorder, "get_cvm_init_scripts", {"id": "cvm-1"})

    assert recorder.calls[0] == ("GET", "/api/v1/cvms/cvm-1/init-scripts", None)
    assert isinstance(result, phala_cloud.CvmInitScriptsResponse)
    assert [(item.slug, item.selected, item.selectable) for item in result.items] == [
        ("docker_cleanup", True, True),
        ("env_merge", False, False),
    ]
    assert result.items[1].reason == _INIT_SCRIPTS["items"][1]["reason"]


@pytest.mark.parametrize("use_async", [False, True])
@pytest.mark.asyncio
async def test_get_cvm_user_config_returns_the_launch_token(use_async: bool) -> None:
    payload = {
        "hostname": "my-app",
        "ssh_authorized_keys": [],
        "default_gateway_domain": "app.example.com",
        "launch_token": _TOKEN["launch_token"],
    }
    recorder = _Recorder(lambda _: httpx.Response(200, json=payload))
    result = await _run(use_async, recorder, "get_cvm_user_config", {"id": "cvm-1"})

    assert "launch_token" in type(result).model_fields
    assert result.launch_token == _TOKEN["launch_token"]
    assert result.default_gateway_domain == "app.example.com"
