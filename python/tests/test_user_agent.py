from __future__ import annotations

import platform
import re
from pathlib import Path

import httpx
import pytest

from phala_cloud.client import PhalaCloud
from phala_cloud.user_agent import default_user_agent, sdk_version


def _pyproject_version() -> str:
    pyproject = Path(__file__).resolve().parents[1] / "pyproject.toml"
    match = re.search(r'^version\s*=\s*"([^"]+)"', pyproject.read_text(), re.M)
    assert match is not None
    return match.group(1)


def test_default_user_agent_format() -> None:
    ua = default_user_agent()
    expected = (
        f"phala-cloud-sdk-python/{_pyproject_version()} "
        f"python/{platform.python_version()} "
        f"httpx/{httpx.__version__}"
    )
    assert ua == expected
    assert ua != "node"
    assert ua != "undici"
    assert not ua.startswith("Bun/")
    assert not ua.startswith("phala-cli/")


def test_sdk_version_comes_from_package_metadata() -> None:
    assert sdk_version() == _pyproject_version()


def test_request_sends_default_user_agent() -> None:
    seen: list[str | None] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.headers.get("user-agent"))
        return httpx.Response(200, json={"ok": True})

    transport = httpx.MockTransport(handler)
    with httpx.Client(transport=transport, base_url="https://example.com") as raw:
        client = PhalaCloud(api_key="k", http_client=raw)
        client.request("GET", "/auth/me")

    assert seen == [default_user_agent()]


def test_caller_user_agent_overrides() -> None:
    seen: list[str | None] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.headers.get("user-agent"))
        return httpx.Response(200, json={"ok": True})

    transport = httpx.MockTransport(handler)
    with httpx.Client(transport=transport, base_url="https://example.com") as raw:
        client = PhalaCloud(
            api_key="k",
            http_client=raw,
            headers={"User-Agent": "MyApp/1.0"},
        )
        client.request("GET", "/auth/me")

    assert seen == ["MyApp/1.0"]


@pytest.mark.parametrize("header_name", ["User-Agent", "user-agent", "USER-AGENT"])
def test_caller_user_agent_overrides_case_insensitive(header_name: str) -> None:
    seen: list[str | None] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.headers.get("user-agent"))
        return httpx.Response(200, json={"ok": True})

    transport = httpx.MockTransport(handler)
    with httpx.Client(transport=transport, base_url="https://example.com") as raw:
        client = PhalaCloud(
            api_key="k",
            http_client=raw,
            headers={header_name: "MyApp/1.0"},
        )
        client.request("GET", "/auth/me")

    assert seen == ["MyApp/1.0"]


_LOG_DETAIL = {
    "public_logs": True,
    "logs": {
        "serial": "https://cloud-logs.example/logs/1/node/serial?uid=7&exp=1&kid=k&sig=s",
        "container_log_base": "https://cloud-logs.example/logs/1/container",
        "auth_query": "uid=7&exp=1&kid=k&sig=s",
    },
}
_LOG_COMPOSITION = {
    "containers": [
        {
            "id": "0123abcd",
            "names": ["/app"],
            "log_endpoint": "https://cloud-logs.example/logs/1/container/app?uid=7&exp=1&kid=k&sig=s",
        }
    ]
}


def _log_ua_handler(seen: dict[str, list[str | None]]) -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "cloud-logs.example":
            seen["logs"].append(request.headers.get("user-agent"))
            return httpx.Response(200, text='{"channel":"stdout","message":"ok\\n"}\n')
        seen["api"].append(request.headers.get("user-agent"))
        if request.url.path.endswith("/composition"):
            return httpx.Response(200, json=_LOG_COMPOSITION)
        return httpx.Response(200, json=_LOG_DETAIL)

    return httpx.MockTransport(handler)


@pytest.mark.parametrize("header_name", [None, "User-Agent", "user-agent", "USER-AGENT"])
def test_log_requests_carry_user_agent(header_name: str | None) -> None:
    from phala_cloud import PhalaCloud as FullClient

    seen: dict[str, list[str | None]] = {"api": [], "logs": []}
    headers = {header_name: "MyApp/1.0"} if header_name else None
    expected = "MyApp/1.0" if header_name else default_user_agent()
    transport = _log_ua_handler(seen)
    with httpx.Client(transport=transport, base_url="https://example.com/api/v1") as raw:
        client = FullClient(api_key="k", http_client=raw, headers=headers)
        client.fetch_cvm_logs("app_x", {"type": "node", "channel": "serial"}, log_http=raw)
        stream = client.follow_cvm_logs("app_x", {"type": "container", "name": "app"}, log_http=raw)
        next(stream)
        stream.close()

    assert seen["api"] == [expected] * 3
    assert seen["logs"] == [expected] * 2


@pytest.mark.parametrize("header_name", [None, "User-Agent", "user-agent", "USER-AGENT"])
async def test_async_log_requests_carry_user_agent(header_name: str | None) -> None:
    from phala_cloud import AsyncPhalaCloud

    seen: dict[str, list[str | None]] = {"api": [], "logs": []}
    headers = {header_name: "MyApp/1.0"} if header_name else None
    expected = "MyApp/1.0" if header_name else default_user_agent()
    transport = _log_ua_handler(seen)
    async with httpx.AsyncClient(transport=transport, base_url="https://example.com/api/v1") as raw:
        client = AsyncPhalaCloud(api_key="k", http_client=raw, headers=headers)
        await client.fetch_cvm_logs("app_x", {"type": "node", "channel": "serial"}, log_http=raw)
        stream = client.follow_cvm_logs("app_x", {"type": "container", "name": "app"}, log_http=raw)
        await stream.__anext__()
        await stream.aclose()

    assert seen["api"] == [expected] * 3
    assert seen["logs"] == [expected] * 2
