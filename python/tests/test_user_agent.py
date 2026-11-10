from __future__ import annotations

import platform
import re
from pathlib import Path

import httpx

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
