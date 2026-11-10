from __future__ import annotations

import httpx
import pytest

from phala_cloud import PhalaCloud
from phala_cloud.logs import (
    CVM_LOGS_INFO_API_VERSION,
    LogAccessError,
    fetch_container_log_entries,
    fetch_cvm_channel_logs,
    fetch_cvm_logs,
    follow_container_log_entries,
    follow_cvm_channel_logs,
    follow_cvm_logs,
)

DETAIL = {
    "logs": {
        "serial": "https://cloud-logs.example/logs/123/node/serial?uid=7&exp=1&kid=test&sig=s",
        "stdout": "https://cloud-logs.example/logs/123/node/stdout?uid=7&exp=1&kid=test&sig=s",
        "stderr": None,
    }
}
COMPOSITION = {
    "containers": [
        {
            "id": "container-id",
            "names": ["/app"],
            "log_endpoint": "https://cloud-logs.example/logs/123/container/app?uid=7&exp=1&kid=test&sig=s",
        }
    ]
}


class _LogState:
    def __init__(self) -> None:
        self.calls: list[str] = []
        self.bodies: list[str | tuple[int, dict[str, object]]] = []

    def api_get(self, path: str) -> object:
        if path.endswith("/composition"):
            return COMPOSITION
        return DETAIL

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.calls.append(str(request.url))
        body = self.bodies[len(self.calls) - 1]
        if isinstance(body, tuple):
            status, payload = body
            return httpx.Response(status, json=payload)
        return httpx.Response(200, text=body)


def _client(state: _LogState) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(state.handler), timeout=None)


def test_node_follow_drops_exact_heartbeat_and_reconnects_with_tail_0() -> None:
    state = _LogState()
    state.bodies = [
        "[vmm heartbeat]\n[teepod heartbeat]\n\ncontains [vmm heartbeat]\n",
        "reconnected\n",
    ]
    with _client(state) as log_http:
        lines: list[str] = []
        for line in follow_cvm_channel_logs(
            api_get=state.api_get, log_http=log_http, cvm_id="app_test", channel="serial", tail=7
        ):
            lines.append(line)
            if line == "reconnected\n":
                break
    assert lines == ["\n", "contains [vmm heartbeat]\n", "reconnected\n"]
    assert "tail=7" in state.calls[0]
    assert "tail=0" in state.calls[1]


def test_network_failures_stop_after_five() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("network unavailable")

    with httpx.Client(transport=httpx.MockTransport(handler), timeout=None) as log_http:
        with pytest.raises(httpx.ConnectError):
            next(
                follow_cvm_channel_logs(
                    api_get=lambda _path: DETAIL,
                    log_http=log_http,
                    cvm_id="app_test",
                    channel="serial",
                )
            )


def test_container_keeps_heartbeat_like_content() -> None:
    state = _LogState()
    state.bodies = [
        '{"channel":"stdout","message":""}\n{"channel":"stderr","message":"[vmm heartbeat]"}\n'
    ]
    with _client(state) as log_http:
        entries = fetch_container_log_entries(
            api_get=state.api_get, log_http=log_http, cvm_id="app_test"
        )
    assert entries == [
        {"channel": "stdout", "message": ""},
        {"channel": "stderr", "message": "[vmm heartbeat]"},
    ]


def test_structured_error_is_not_retried_for_4xx() -> None:
    state = _LogState()
    state.bodies = [
        (
            404,
            {
                "error_code": "ERR-17-004",
                "message": "CVM unavailable",
                "suggestions": ["Check the CVM ID"],
            },
        )
    ]
    with _client(state) as log_http:
        with pytest.raises(LogAccessError) as err:
            fetch_cvm_channel_logs(
                api_get=state.api_get, log_http=log_http, cvm_id="app_test", channel="serial"
            )
    assert err.value.code == "ERR-17-004"
    assert err.value.http_status == 404
    assert err.value.suggestions == ["Check the CVM ID"]
    assert len(state.calls) == 1


def test_expired_signature_gives_up_after_three_refreshes() -> None:
    state = _LogState()
    state.bodies = [(401, {"error_code": "ERR-17-003", "message": "URL expired"})] * 8
    with _client(state) as log_http:
        with pytest.raises(LogAccessError) as err:
            next(
                follow_cvm_channel_logs(
                    api_get=state.api_get, log_http=log_http, cvm_id="app_test", channel="serial"
                )
            )
    assert err.value.code == "ERR-17-003"
    assert len(state.calls) == 4


def test_container_follow_dedupes_boundary_second() -> None:
    repeated = '{"channel":"stdout","message":"2026-11-09T12:00:00.123456789Z repeated"}'
    state = _LogState()
    state.bodies = [
        f"{repeated}\n{repeated}\n",
        f"{repeated}\n{repeated}\n{repeated}\n",
    ]
    with _client(state) as log_http:
        messages: list[str] = []
        for entry in follow_container_log_entries(
            api_get=state.api_get, log_http=log_http, cvm_id="app_test"
        ):
            messages.append(entry["message"])
            if len(messages) == 3:
                break
    assert messages == ["repeated", "repeated", "repeated"]
    assert "timestamps=true" in state.calls[0]
    assert "since=1794225600" in state.calls[1]
    assert "tail=" not in state.calls[1].split("?")[-1]


def test_legacy_client_version_still_resolves_log_urls() -> None:
    versions: list[str | None] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if "cloud-logs.example" in str(request.url):
            return httpx.Response(200, text="ok")
        versions.append(request.headers.get("x-phala-version"))
        return httpx.Response(200, json=DETAIL)

    transport = httpx.MockTransport(handler)
    with httpx.Client(transport=transport, base_url="https://example.com/api/v1") as api:
        with httpx.Client(transport=transport) as log_http:
            client = PhalaCloud(api_key="k", version="2025-10-28", http_client=api)
            text = client.fetch_cvm_logs(
                "app_test",
                {"type": "node", "channel": "serial"},
                log_http=log_http,
            )
    assert text == "ok"
    assert versions == [CVM_LOGS_INFO_API_VERSION]


def test_public_logs_off_raises_err_17_006() -> None:
    def api_get(_path: str) -> object:
        return {"public_logs": False, "logs": {}}

    with httpx.Client() as log_http:
        with pytest.raises(LogAccessError) as err:
            fetch_container_log_entries(api_get=api_get, log_http=log_http, cvm_id="app_test")
    assert err.value.code == "ERR-17-006"
    assert err.value.http_status == 409


def test_follow_rejects_ndjson_on_node() -> None:
    with httpx.Client() as log_http:
        with pytest.raises(ValueError, match="format=ndjson"):
            next(
                follow_cvm_logs(
                    api_get=lambda _path: DETAIL,
                    log_http=log_http,
                    cvm_id="app_test",
                    source={"type": "node", "channel": "serial"},
                    format="ndjson",
                )
            )


def test_node_fetch_rejects_since() -> None:
    with httpx.Client() as log_http:
        with pytest.raises(ValueError, match="since"):
            fetch_cvm_logs(
                api_get=lambda _path: DETAIL,
                log_http=log_http,
                cvm_id="app_test",
                source={"type": "node", "channel": "serial"},
                since=1,
            )
