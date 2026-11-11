from __future__ import annotations

import asyncio
import json
import threading
import time
from collections.abc import AsyncIterator, Callable, Iterator
from dataclasses import dataclass, field
from typing import Any

import httpx
import pytest

import phala_cloud.logs as logs
from phala_cloud import AsyncPhalaCloud, PhalaCloud
from phala_cloud.client import DEFAULT_API_VERSION
from phala_cloud.errors import ApiError
from phala_cloud.logs import (
    CVM_LOGS_INFO_API_VERSION,
    LogAccessError,
    afetch_cvm_logs,
    afollow_cvm_logs,
    fetch_cvm_logs,
    follow_cvm_logs,
)

# 2026-11-09T12:00:00Z
BASE_SECOND = 1_794_225_600
SIGNED_QUERY = "uid=7&exp=1&kid=test&sig=a/b+c="
NODE_SERIAL_URL = f"https://cloud-logs.example/logs/123/node/serial?{SIGNED_QUERY}"
CONTAINER_URL = f"https://cloud-logs.example/logs/123/container/app?{SIGNED_QUERY}"
CONTAINER_LOG_BASE = "https://cloud-logs.example/logs/123/container"
DETAIL: dict[str, Any] = {
    "public_logs": True,
    "logs": {
        "serial": NODE_SERIAL_URL,
        "stdout": None,
        "stderr": None,
        "container_log_base": CONTAINER_LOG_BASE,
        "auth_query": SIGNED_QUERY,
    },
}
COMPOSITION: dict[str, Any] = {
    "containers": [{"id": "0123abcd", "names": ["/app"], "log_endpoint": CONTAINER_URL}]
}
NODE: logs.CvmLogSource = {"type": "node", "channel": "serial"}
CONTAINER: logs.CvmLogSource = {"type": "container", "name": "app"}
GUEST_DOCKER_ERROR = (
    "Docker responded with status code 501: configured logging driver does not support reading"
)
MODES = ["sync", "async"]


def stamp(second: int, text: str) -> str:
    return f"2026-11-09T12:00:{second:02d}.000000001Z {text}"


def record(message: str, channel: str = "stdout") -> str:
    return json.dumps({"channel": channel, "message": message}) + "\n"


@dataclass
class Reply:
    status: int = 200
    chunks: tuple[str, ...] = ()
    payload: dict[str, Any] | None = None
    read_error: bool = False
    idle_seconds: float = 0.0


def body(*chunks: str, read_error: bool = False, idle_seconds: float = 0.0) -> Reply:
    return Reply(chunks=chunks, read_error=read_error, idle_seconds=idle_seconds)


def http_error(status: int, code: str, message: str = "gateway error", **extra: Any) -> Reply:
    return Reply(status=status, payload={"error_code": code, "message": message, **extra})


@dataclass
class FakeClock:
    monotonic: float = 1_000.0
    wall: float = BASE_SECOND + 0.5


class _Body(httpx.SyncByteStream, httpx.AsyncByteStream):
    def __init__(self, reply: Reply, clock: FakeClock) -> None:
        self._reply = reply
        self._clock = clock

    def _end(self) -> None:
        self._clock.monotonic += self._reply.idle_seconds
        self._clock.wall += self._reply.idle_seconds
        if self._reply.read_error:
            raise httpx.ReadError("connection reset by peer")

    def __iter__(self) -> Iterator[bytes]:
        for chunk in self._reply.chunks:
            yield chunk.encode()
        self._end()

    async def __aiter__(self) -> AsyncIterator[bytes]:
        for chunk in self._reply.chunks:
            yield chunk.encode()
        self._end()


@dataclass
class LogServer:
    """Scripted log gateway plus the two CVM API endpoints the helpers read."""

    replies: list[Reply]
    clock: FakeClock
    detail: dict[str, Any] = field(default_factory=lambda: DETAIL)
    composition: dict[str, Any] = field(default_factory=lambda: COMPOSITION)
    api_calls: list[str] = field(default_factory=list)
    log_calls: list[str] = field(default_factory=list)
    user_agents: list[str | None] = field(default_factory=list)
    requested: threading.Event = field(default_factory=threading.Event)

    def api_get(self, path: str) -> Any:
        self.api_calls.append(path)
        return self.composition if path.endswith("/composition") else self.detail

    async def aapi_get(self, path: str) -> Any:
        return self.api_get(path)

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.log_calls.append(str(request.url))
        self.user_agents.append(request.headers.get("user-agent"))
        self.requested.set()
        if not self.replies:
            raise AssertionError("unexpected extra log request")
        reply = self.replies.pop(0)
        if reply.payload is not None:
            return httpx.Response(reply.status, json=reply.payload)
        return httpx.Response(reply.status, stream=_Body(reply, self.clock))

    @property
    def transport(self) -> httpx.MockTransport:
        return httpx.MockTransport(self.handler)


# The real backoff, kept before the autouse fixture below replaces it.
REAL_BACKOFF_DELAY = logs._backoff_delay


@pytest.fixture(autouse=True)
def backoffs(monkeypatch: pytest.MonkeyPatch) -> list[int]:
    """Record every backoff attempt number and skip the real wait."""
    attempts: list[int] = []

    def record_attempt(attempt: int) -> float:
        attempts.append(attempt)
        return 0.0

    monkeypatch.setattr(logs, "_backoff_delay", record_attempt)
    return attempts


@pytest.fixture(autouse=True)
def clock(monkeypatch: pytest.MonkeyPatch) -> FakeClock:
    fake = FakeClock()
    monkeypatch.setattr(logs, "_monotonic", lambda: fake.monotonic)
    monkeypatch.setattr(logs, "_wall_clock", lambda: fake.wall)
    return fake


REAL_WAIT_SYNC = logs._wait_sync
REAL_WAIT_ASYNC = logs._wait_async


@pytest.fixture(autouse=True)
def waits(monkeypatch: pytest.MonkeyPatch, clock: FakeClock) -> list[float]:
    """Record reconnect waits and advance the fake monotonic clock instead of sleeping."""
    recorded: list[float] = []

    def wait_sync(_stop: threading.Event, seconds: float) -> bool:
        recorded.append(seconds)
        clock.monotonic += seconds
        return False

    async def wait_async(seconds: float) -> None:
        wait_sync(threading.Event(), seconds)

    monkeypatch.setattr(logs, "_wait_sync", wait_sync)
    monkeypatch.setattr(logs, "_wait_async", wait_async)
    return recorded


def use_real_waits(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(logs, "_wait_sync", REAL_WAIT_SYNC)
    monkeypatch.setattr(logs, "_wait_async", REAL_WAIT_ASYNC)


def run_follow(
    server: LogServer,
    mode: str,
    *,
    limit: int | None = None,
    **options: Any,
) -> tuple[list[Any], Exception | None]:
    options.setdefault("cvm_id", "app_test")
    if mode == "sync":
        items: list[Any] = []
        error: Exception | None = None
        with httpx.Client(transport=server.transport) as log_http:
            stream = follow_cvm_logs(api_get=server.api_get, log_http=log_http, **options)
            try:
                for item in stream:
                    items.append(item)
                    if limit is not None and len(items) >= limit:
                        break
            except Exception as exc:
                error = exc
            finally:
                stream.close()
        return items, error

    async def run() -> tuple[list[Any], Exception | None]:
        items: list[Any] = []
        error: Exception | None = None
        async with httpx.AsyncClient(transport=server.transport) as log_http:
            stream = afollow_cvm_logs(api_get=server.aapi_get, log_http=log_http, **options)
            try:
                async for item in stream:
                    items.append(item)
                    if limit is not None and len(items) >= limit:
                        break
            except Exception as exc:
                error = exc
            finally:
                await stream.aclose()
        return items, error

    return asyncio.run(run())


def run_fetch(server: LogServer, mode: str, **options: Any) -> Any:
    options.setdefault("cvm_id", "app_test")
    if mode == "sync":
        with httpx.Client(transport=server.transport) as log_http:
            return fetch_cvm_logs(api_get=server.api_get, log_http=log_http, **options)

    async def run() -> Any:
        async with httpx.AsyncClient(transport=server.transport) as log_http:
            return await afetch_cvm_logs(api_get=server.aapi_get, log_http=log_http, **options)

    return asyncio.run(run())


# --- retry / stop rules -----------------------------------------------------


@pytest.mark.parametrize("mode", MODES)
@pytest.mark.parametrize(
    ("source", "fmt", "line"),
    [
        (CONTAINER, None, json.dumps({"error_code": "ERR-17-008", "message": "upstream failed"})),
        (CONTAINER, "text", "[error] ERR-17-008 upstream failed"),
        (NODE, None, "[error] ERR-17-008 upstream failed"),
    ],
)
def test_repeated_in_stream_error_after_200_stops_after_five(
    mode: str,
    source: logs.CvmLogSource,
    fmt: str | None,
    line: str,
    clock: FakeClock,
    backoffs: list[int],
) -> None:
    server = LogServer([body(line + "\n")] * 5, clock)
    items, error = run_follow(server, mode, source=source, format=fmt)
    assert items == []
    assert isinstance(error, LogAccessError)
    assert error.code == "ERR-17-008"
    assert str(error) == "upstream failed"
    assert error.http_status is None
    assert len(server.log_calls) == 5
    assert backoffs == [1, 2, 3, 4]


@pytest.mark.parametrize("mode", MODES)
@pytest.mark.parametrize("breakage", ["read_error", "in_stream_error"])
def test_partial_output_then_failure_counts_as_recovered(
    mode: str, breakage: str, clock: FakeClock, backoffs: list[int]
) -> None:
    first = record(stamp(1, "first\n"))
    if breakage == "read_error":
        broken = body(first, read_error=True)
    else:
        gateway_error = json.dumps({"error_code": "ERR-17-008", "message": "upstream failed"})
        broken = body(first + gateway_error + "\n")
    server = LogServer(
        [
            http_error(503, "ERR-17-012"),
            http_error(503, "ERR-17-012"),
            broken,
            body(record(stamp(2, "second\n"))),
        ],
        clock,
    )
    items, error = run_follow(server, mode, source=CONTAINER, limit=2)
    assert error is None
    assert [item["message"] for item in items] == ["first\n", "second\n"]
    # Two failures back off 1, 2; the failure after delivered output restarts at 1.
    assert backoffs == [1, 2, 1]
    assert "tail=all" in server.log_calls[3]
    assert f"since={BASE_SECOND + 1}" in server.log_calls[3]


@pytest.mark.parametrize("mode", MODES)
def test_empty_ends_interleaved_with_failures(
    mode: str, clock: FakeClock, backoffs: list[int]
) -> None:
    server = LogServer(
        [body(), body(), http_error(503, "ERR-17-012"), body(), body(), body(), body(), body()],
        clock,
    )
    items, error = run_follow(server, mode, source=CONTAINER)
    assert items == []
    assert isinstance(error, LogAccessError)
    assert "keeps ending without new output" in str(error)
    assert error.http_status is None
    # The failure resets the empty-end counter, so five more empty ends are needed.
    assert backoffs == [1, 2, 1, 1, 2, 3, 4]
    assert len(server.log_calls) == 8


@pytest.mark.parametrize("mode", MODES)
def test_empty_ends_do_not_reset_failure_counter(
    mode: str, clock: FakeClock, backoffs: list[int]
) -> None:
    failure = http_error(503, "ERR-17-012", "unavailable")
    server = LogServer(
        [failure, body(), failure, body(), failure, body(), failure, body(), failure], clock
    )
    items, error = run_follow(server, mode, source=CONTAINER)
    assert isinstance(error, LogAccessError)
    assert error.http_status == 503
    assert backoffs == [1, 1, 2, 1, 3, 1, 4, 1]
    assert len(server.log_calls) == 9


@pytest.mark.parametrize("mode", MODES)
def test_quick_empty_ends_stop_after_five(mode: str, clock: FakeClock) -> None:
    server = LogServer([body()] * 5, clock)
    _items, error = run_follow(server, mode, source=CONTAINER)
    assert isinstance(error, LogAccessError)
    assert str(error) == (
        "log stream keeps ending without new output; the container may have stopped"
    )
    assert len(server.log_calls) == 5


@pytest.mark.parametrize("mode", MODES)
def test_node_quick_empty_ends_back_off_but_never_stop(
    mode: str, clock: FakeClock, backoffs: list[int]
) -> None:
    server = LogServer(
        [body()] * 7 + [body(idle_seconds=11), body(), body("after quiet period\n")], clock
    )
    items, error = run_follow(server, mode, source=NODE, limit=1)
    assert error is None
    assert items == ["after quiet period\n"]
    # Seven quick empty ends back off (capped by the delay function, never a stop);
    # the long idle end reconnects immediately and resets the count.
    assert backoffs == [1, 2, 3, 4, 5, 6, 7, 1]
    assert len(server.log_calls) == 10


@pytest.mark.parametrize("mode", MODES)
def test_node_end_with_records_reconnects_immediately(
    mode: str, clock: FakeClock, backoffs: list[int]
) -> None:
    server = LogServer([body("one\n"), body("two\n")], clock)
    items, error = run_follow(server, mode, source=NODE, limit=2)
    assert error is None
    assert items == ["one\n", "two\n"]
    assert backoffs == []


@pytest.mark.parametrize("mode", MODES)
def test_long_idle_eof_keeps_following(mode: str, clock: FakeClock, backoffs: list[int]) -> None:
    server = LogServer([body(idle_seconds=11)] * 6 + [body(record("awake\n"))], clock)
    items, error = run_follow(server, mode, source=CONTAINER, limit=1)
    assert error is None
    assert items == [{"channel": "stdout", "message": "awake\n"}]
    assert backoffs == []


@pytest.mark.parametrize("mode", MODES)
def test_tail_0_quiet_reconnect_uses_first_200_second(mode: str, clock: FakeClock) -> None:
    server = LogServer(
        [http_error(503, "ERR-17-012"), body(), body(record("later\n"))],
        clock,
    )
    items, error = run_follow(server, mode, source=CONTAINER, tail=0, limit=1)
    assert error is None
    assert items == [{"channel": "stdout", "message": "later\n"}]
    # The caller's tail is kept until a 200 is accepted.
    for url in server.log_calls[:2]:
        assert "tail=0" in url
        assert "since=" not in url
    assert "tail=all" in server.log_calls[2]
    assert f"since={BASE_SECOND}" in server.log_calls[2]


@pytest.mark.parametrize("mode", MODES)
def test_quiet_reconnect_keeps_later_caller_since(mode: str, clock: FakeClock) -> None:
    server = LogServer([body(), body(record("later\n"))], clock)
    _items, error = run_follow(
        server, mode, source=CONTAINER, since=BASE_SECOND + 30, tail=0, limit=1
    )
    assert error is None
    assert f"since={BASE_SECOND + 30}" in server.log_calls[0]
    assert f"since={BASE_SECOND + 30}" in server.log_calls[1]


@pytest.mark.parametrize("mode", MODES)
def test_reconnect_without_records_keeps_earlier_caller_since(mode: str, clock: FakeClock) -> None:
    # since=100 is long before the first 200; a reconnect must not move it to now.
    server = LogServer([body(read_error=True), body(record("later\n"))], clock)
    _items, error = run_follow(server, mode, source=CONTAINER, since=100, tail="all", limit=1)
    assert error is None
    for url in server.log_calls:
        assert "since=100&" in url
        assert "tail=all" in url


@pytest.mark.parametrize("mode", MODES)
def test_reconnect_after_records_dedupes_boundary_second(mode: str, clock: FakeClock) -> None:
    repeated = record(stamp(0, "repeated\n"))
    server = LogServer(
        [body(repeated + repeated), body(repeated + repeated + repeated)],
        clock,
    )
    items, error = run_follow(server, mode, source=CONTAINER, limit=3)
    assert error is None
    assert [item["message"] for item in items] == ["repeated\n"] * 3
    assert "timestamps=true" in server.log_calls[0]
    assert "tail=all" in server.log_calls[1]
    assert f"since={BASE_SECOND}" in server.log_calls[1]


@pytest.mark.parametrize("mode", MODES)
def test_text_reconnect_dedupes_and_strips_timestamps(mode: str, clock: FakeClock) -> None:
    first = stamp(1, "one\n") + stamp(2, "two\n")
    server = LogServer([body(first), body(stamp(2, "two\n") + stamp(3, "three"))], clock)
    items, error = run_follow(server, mode, source=CONTAINER, format="text", limit=3)
    assert error is None
    assert items == ["one\n", "two\n", "three"]
    assert f"since={BASE_SECOND + 2}" in server.log_calls[1]
    assert "format=text" in server.log_calls[1]


@pytest.mark.parametrize("mode", MODES)
@pytest.mark.parametrize("fmt", [None, "text"])
def test_until_reached_by_cursor_finishes_without_error(
    mode: str, fmt: str | None, clock: FakeClock
) -> None:
    clock.wall = BASE_SECOND - 100  # wall clock before the window end
    lines = [stamp(1, "one\n"), stamp(2, "two\n")]
    payload = "".join(lines) if fmt == "text" else "".join(record(line) for line in lines)
    server = LogServer([body(payload)], clock)
    items, error = run_follow(server, mode, source=CONTAINER, format=fmt, until=BASE_SECOND + 2)
    assert error is None
    assert len(items) == 2
    assert f"until={BASE_SECOND + 2}" in server.log_calls[0]
    assert len(server.log_calls) == 1


@pytest.mark.parametrize("mode", MODES)
def test_clean_end_after_until_finishes_without_error(mode: str, clock: FakeClock) -> None:
    clock.wall = BASE_SECOND + 60
    server = LogServer([body()], clock)
    items, error = run_follow(server, mode, source=CONTAINER, until=BASE_SECOND + 10)
    assert error is None
    assert items == []
    assert len(server.log_calls) == 1


@pytest.mark.parametrize("mode", MODES)
@pytest.mark.parametrize("fmt", [None, "text"])
def test_until_passed_on_clean_end_never_reports_stopped(
    mode: str, fmt: str | None, clock: FakeClock
) -> None:
    # No record reaches until; four quick empty ends follow, and the fifth clean
    # end happens after until. Without the until rule it would be the
    # "may have stopped" error.
    payload = stamp(1, "one\n") if fmt == "text" else record(stamp(1, "one\n"))
    server = LogServer([body(payload)] + [body()] * 4 + [body(idle_seconds=3)], clock)
    items, error = run_follow(server, mode, source=CONTAINER, format=fmt, until=BASE_SECOND + 3)
    assert error is None
    assert len(items) == 1
    assert clock.wall >= BASE_SECOND + 3
    assert len(server.log_calls) == 6


@pytest.mark.parametrize("mode", MODES)
def test_node_rejects_until(mode: str, clock: FakeClock) -> None:
    server = LogServer([], clock)
    with pytest.raises(LogAccessError, match="until") as err:
        run_follow(server, mode, source=NODE, until=BASE_SECOND)
    assert err.value.code == "ERR-17-001"
    assert err.value.http_status is None


@pytest.mark.parametrize("mode", MODES)
def test_429_is_retried(mode: str, clock: FakeClock, backoffs: list[int]) -> None:
    server = LogServer(
        [http_error(429, "ERR-17-011", "too many streams"), body(record("ok\n"))], clock
    )
    items, error = run_follow(server, mode, source=CONTAINER, limit=1)
    assert error is None
    assert items == [{"channel": "stdout", "message": "ok\n"}]
    assert backoffs == [1]


@pytest.mark.parametrize("mode", MODES)
def test_401_err_17_002_refetches_and_counts_as_failure(
    mode: str, clock: FakeClock, backoffs: list[int]
) -> None:
    server = LogServer([http_error(401, "ERR-17-002", "bad signature"), body("ok\n")], clock)
    items, error = run_follow(server, mode, source=NODE, limit=1)
    assert error is None
    assert items == ["ok\n"]
    assert backoffs == [1]
    # One CVM info lookup per connection.
    assert server.api_calls == ["/cvms/app_test", "/cvms/app_test"]


@pytest.mark.parametrize("mode", MODES)
def test_401_err_17_003_refetches_up_to_three_times(
    mode: str, clock: FakeClock, backoffs: list[int]
) -> None:
    server = LogServer([http_error(401, "ERR-17-003", "URL expired")] * 4, clock)
    _items, error = run_follow(server, mode, source=NODE)
    assert isinstance(error, LogAccessError)
    assert error.code == "ERR-17-003"
    assert error.http_status == 401
    assert len(server.log_calls) == 4
    assert len(server.api_calls) == 4
    assert backoffs == []


@pytest.mark.parametrize("mode", MODES)
def test_other_4xx_stops(mode: str, clock: FakeClock) -> None:
    server = LogServer([http_error(404, "ERR-17-004", "CVM unavailable")], clock)
    _items, error = run_follow(server, mode, source=CONTAINER)
    assert isinstance(error, LogAccessError)
    assert error.http_status == 404
    assert len(server.log_calls) == 1


@pytest.mark.parametrize("mode", MODES)
def test_http_502_err_17_009_is_retried(mode: str, clock: FakeClock) -> None:
    server = LogServer([http_error(502, "ERR-17-009", "Guest agent unreachable")] * 5, clock)
    _items, error = run_follow(server, mode, source=CONTAINER)
    assert isinstance(error, LogAccessError)
    assert error.http_status == 502
    assert len(server.log_calls) == 5


@pytest.mark.parametrize("mode", MODES)
def test_network_failures_stop_after_five(mode: str, clock: FakeClock) -> None:
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(str(request.url))
        raise httpx.ConnectError("network unavailable")

    server = LogServer([], clock)
    server.handler = handler  # type: ignore[method-assign]
    _items, error = run_follow(server, mode, source=NODE)
    assert isinstance(error, httpx.ConnectError)
    assert len(calls) == 5


@pytest.mark.parametrize("mode", MODES)
@pytest.mark.parametrize(
    ("source", "composition"),
    [
        ({"type": "container", "name": "nope"}, COMPOSITION),
        ({"type": "container"}, {"containers": []}),
    ],
)
def test_missing_container_is_err_17_007_and_not_retried(
    mode: str, source: logs.CvmLogSource, composition: dict[str, Any], clock: FakeClock
) -> None:
    server = LogServer([], clock, composition=composition)
    with pytest.raises(LogAccessError) as err:
        run_fetch(server, mode, source=source)
    _items, error = run_follow(server, mode, source=source)
    for value in (err.value, error):
        assert isinstance(value, LogAccessError)
        assert value.code == "ERR-17-007"
        assert str(value) == "Container not found"
        assert value.http_status is None
    # One lookup round each for fetch and follow; follow does not retry.
    assert server.api_calls == ["/cvms/app_test", "/cvms/app_test/composition"] * 2
    assert server.log_calls == []


@pytest.mark.parametrize("mode", MODES)
def test_ambiguous_container_prefix_is_err_17_001_with_candidates(
    mode: str, clock: FakeClock
) -> None:
    composition = {
        "containers": [
            {"id": "abc123", "names": ["/web"], "log_endpoint": CONTAINER_URL},
            {"id": "abc456", "names": ["/worker"], "log_endpoint": CONTAINER_URL},
        ]
    }
    server = LogServer([], clock, composition=composition)
    source: logs.CvmLogSource = {"type": "container", "name": "abc"}
    with pytest.raises(LogAccessError) as err:
        run_fetch(server, mode, source=source)
    _items, error = run_follow(server, mode, source=source)
    for value in (err.value, error):
        assert isinstance(value, LogAccessError)
        assert value.code == "ERR-17-001"
        assert value.http_status is None
        assert str(value) == "Ambiguous container prefix 'abc': web, worker"
    assert len(server.api_calls) == 4
    assert server.log_calls == []


@pytest.mark.parametrize("mode", MODES)
def test_missing_node_endpoint_is_a_log_access_error(mode: str, clock: FakeClock) -> None:
    server = LogServer([], clock)
    source: logs.CvmLogSource = {"type": "node", "channel": "stderr"}
    with pytest.raises(LogAccessError, match="No stderr log endpoint"):
        run_fetch(server, mode, source=source)
    _items, error = run_follow(server, mode, source=source)
    assert isinstance(error, LogAccessError)
    assert server.log_calls == []


@pytest.mark.parametrize("mode", MODES)
@pytest.mark.parametrize("source", [NODE, CONTAINER])
def test_connections_start_at_least_one_second_apart(
    mode: str, source: logs.CvmLogSource, clock: FakeClock, waits: list[float]
) -> None:
    # The VMM can answer 200 with a single error-looking line and end at once.
    # That counts as output, yet the next connection must not start immediately.
    line = "vmm: guest is not running\n"
    payload = line if source is NODE else record(line)
    starts: list[float] = []
    server = LogServer([body(payload), body(payload), body(payload)], clock)
    handler = server.handler

    def timed_handler(request: httpx.Request) -> httpx.Response:
        starts.append(clock.monotonic)
        return handler(request)

    server.handler = timed_handler  # type: ignore[method-assign]
    items, error = run_follow(server, mode, source=source, limit=3)
    assert error is None
    assert len(items) == 3
    assert waits == [1.0, 1.0]
    assert [later - earlier for earlier, later in zip(starts, starts[1:], strict=False)] == [
        1.0,
        1.0,
    ]


@pytest.mark.parametrize("mode", MODES)
def test_slow_connection_reconnects_without_extra_wait(
    mode: str, clock: FakeClock, waits: list[float]
) -> None:
    server = LogServer([body("one\n", idle_seconds=2), body("two\n")], clock)
    items, error = run_follow(server, mode, source=NODE, limit=2)
    assert error is None
    assert items == ["one\n", "two\n"]
    assert waits == []


@pytest.mark.parametrize("mode", MODES)
def test_backoff_longer_than_interval_is_kept(
    monkeypatch: pytest.MonkeyPatch, mode: str, clock: FakeClock, waits: list[float]
) -> None:
    monkeypatch.setattr(logs, "_backoff_delay", lambda _attempt: 4.0)
    server = LogServer([http_error(503, "ERR-17-012"), body("ok\n")], clock)
    items, error = run_follow(server, mode, source=NODE, limit=1)
    assert error is None
    assert waits == [4.0]


@pytest.mark.parametrize("mode", MODES)
def test_bare_200_does_not_reset_expired_counter(mode: str, clock: FakeClock) -> None:
    expired = http_error(401, "ERR-17-003", "URL expired")
    # A 200 that fails before any record is not a recovery for the expired counter.
    server = LogServer([expired] * 3 + [body(read_error=True), expired], clock)
    _items, error = run_follow(server, mode, source=NODE)
    assert isinstance(error, LogAccessError)
    assert error.code == "ERR-17-003"
    assert len(server.log_calls) == 5


@pytest.mark.parametrize("mode", MODES)
@pytest.mark.parametrize("recovery", ["records", "clean_end"])
def test_expired_counter_resets_after_records_or_clean_end(
    mode: str, recovery: str, clock: FakeClock
) -> None:
    expired = http_error(401, "ERR-17-003", "URL expired")
    middle = body("x\n", read_error=True) if recovery == "records" else body()
    server = LogServer([expired] * 3 + [middle] + [expired] * 3 + [body("y\n")], clock)
    items, error = run_follow(server, mode, source=NODE, limit=2 if recovery == "records" else 1)
    assert error is None
    assert items[-1] == "y\n"
    assert len(server.log_calls) == 8


@pytest.mark.parametrize("mode", MODES)
@pytest.mark.parametrize("status", [301, 302, 304, 307])
def test_non_2xx_log_response_is_an_error(mode: str, status: int, clock: FakeClock) -> None:
    server = LogServer([Reply(status=status, chunks=("moved",))] * 2, clock)
    with pytest.raises(LogAccessError) as err:
        run_fetch(server, mode, source=NODE)
    assert err.value.http_status == status
    assert str(err.value) == f"HTTP {status}"
    _items, error = run_follow(server, mode, source=NODE)
    assert isinstance(error, LogAccessError)
    assert error.http_status == status


@pytest.mark.parametrize("mode", MODES)
def test_http_error_without_envelope_uses_status_message(mode: str, clock: FakeClock) -> None:
    server = LogServer([Reply(status=500, chunks=("<html>oops</html>",))], clock)
    with pytest.raises(LogAccessError) as err:
        run_fetch(server, mode, source=NODE)
    assert str(err.value) == "HTTP 500"
    assert err.value.code is None
    assert err.value.http_status == 500


@pytest.mark.parametrize("mode", MODES)
@pytest.mark.parametrize(
    ("source", "options"),
    [
        (NODE, {"timestamps": True}),
        (NODE, {"since": "10m"}),
        (NODE, {"format": "ndjson"}),
        (CONTAINER, {"since": "yesterday"}),
        (CONTAINER, {"until": "999999999999999999999d"}),
        (CONTAINER, {"since": "106752d"}),
    ],
)
def test_client_validation_errors_are_err_17_001_before_any_request(
    mode: str, source: logs.CvmLogSource, options: dict[str, Any], clock: FakeClock
) -> None:
    server = LogServer([], clock)
    for run in (run_fetch, run_follow):
        with pytest.raises(LogAccessError) as err:
            run(server, mode, source=source, **options)
        assert err.value.code == "ERR-17-001"
        assert err.value.http_status is None
    assert server.api_calls == []
    assert server.log_calls == []


def test_relative_time_at_duration_limit_is_accepted() -> None:
    # 106751 days fits a signed 64-bit nanosecond duration; 106752 days does not.
    resolved = logs.resolve_log_time_window("106751d", None, now_ms=0)
    assert resolved == {"since": -106751 * 86_400}
    with pytest.raises(ValueError, match="too far"):
        logs.resolve_log_time_window("106752d", None, now_ms=0)


@pytest.mark.parametrize("mode", MODES)
@pytest.mark.parametrize(
    ("source", "slug"),
    [
        ({"type": "container", "name": "app"}, "app"),
        ({"type": "container", "name": "0123"}, "app"),  # ID prefix
        ({"type": "container"}, "app"),  # default container
    ],
)
def test_follow_resolves_container_once_then_only_refreshes_info(
    mode: str, source: logs.CvmLogSource, slug: str, clock: FakeClock
) -> None:
    signed = [f"uid=7&exp={n}&kid=test&sig=s{n}" for n in range(4)]
    infos = [
        {**DETAIL, "logs": {"container_log_base": CONTAINER_LOG_BASE, "auth_query": query}}
        for query in signed
    ]
    server = LogServer([body(record(f"line {n}\n")) for n in range(4)], clock)
    api_get = server.api_get

    def rotating_api_get(path: str) -> Any:
        if path.endswith("/composition"):
            return api_get(path)
        server.api_calls.append(path)
        return infos[server.api_calls.count("/cvms/app_test") - 1]

    server.api_get = rotating_api_get  # type: ignore[method-assign]
    items, error = run_follow(server, mode, source=source, limit=4)
    assert error is None
    assert len(items) == 4
    # 1 composition + 1 info per connection, across 3 reconnects.
    assert server.api_calls.count("/cvms/app_test/composition") == 1
    assert server.api_calls.count("/cvms/app_test") == 4
    for url, query in zip(server.log_calls, signed, strict=True):
        assert url.startswith(f"{CONTAINER_LOG_BASE}/{slug}?{query}&")


@pytest.mark.parametrize("mode", MODES)
def test_missing_log_base_is_an_error_on_fetch_and_follow(mode: str, clock: FakeClock) -> None:
    # The composition still lists a signed log_endpoint; it must not be used.
    detail = {**DETAIL, "logs": {"serial": NODE_SERIAL_URL}}
    server = LogServer([], clock, detail=detail)
    with pytest.raises(LogAccessError) as err:
        run_fetch(server, mode, source=CONTAINER)
    _items, error = run_follow(server, mode, source=CONTAINER)
    for value in (err.value, error):
        assert isinstance(value, LogAccessError)
        assert str(value) == "No log endpoints available for CVM 'app_test'"
        assert value.http_status is None
    assert server.log_calls == []


# --- guest records and channels ---------------------------------------------


@pytest.mark.parametrize("mode", MODES)
def test_glued_guest_error_in_ndjson_follow(mode: str, clock: FakeClock) -> None:
    server = LogServer(
        [body('{"error":"x"}{"channel":"stdout","message":"y\\n"}\n')] * 2,
        clock,
    )
    items, error = run_follow(server, mode, source=CONTAINER)
    assert items == []
    assert isinstance(error, LogAccessError)
    assert error.code == "ERR-17-009"
    assert str(error) == "x"
    assert error.http_status is None
    assert len(server.log_calls) == 1


@pytest.mark.parametrize("mode", MODES)
def test_guest_error_split_across_chunks_after_record(mode: str, clock: FakeClock) -> None:
    first = record(stamp(1, "a\n"))
    server = LogServer(
        [body(first + '{"err', 'or":"x"}' + record(stamp(2, "y\n")))],
        clock,
    )
    items, error = run_follow(server, mode, source=CONTAINER)
    assert items == [{"channel": "stdout", "message": "a\n"}]
    assert isinstance(error, LogAccessError)
    assert error.code == "ERR-17-009"


@pytest.mark.parametrize("mode", MODES)
def test_glued_guest_error_in_text_follow(mode: str, clock: FakeClock) -> None:
    glued = json.dumps({"error": GUEST_DOCKER_ERROR}) + stamp(1, "y\n")
    server = LogServer([body(glued)], clock)
    items, error = run_follow(server, mode, source=CONTAINER, format="text")
    assert items == []
    assert isinstance(error, LogAccessError)
    assert error.code == "ERR-17-009"
    assert str(error) == GUEST_DOCKER_ERROR
    assert len(server.log_calls) == 1


@pytest.mark.parametrize("mode", MODES)
def test_text_error_json_after_body_start_is_application_output(
    mode: str, clock: FakeClock
) -> None:
    app_line = '{"error":"timeout"}\n'
    server = LogServer([body("starting\n" + app_line), body(stamp(0, "a\n") + app_line)], clock)
    assert run_fetch(server, mode, source=CONTAINER, format="text") == "starting\n" + app_line
    items, error = run_follow(server, mode, source=CONTAINER, format="text", limit=2)
    assert error is None
    assert items == ["a\n", app_line]


@pytest.mark.parametrize("mode", MODES)
def test_ndjson_guest_error_mid_stream_still_stops(mode: str, clock: FakeClock) -> None:
    server = LogServer([body(record("a\n") + '{"error":"x"}\n')], clock)
    items, error = run_follow(server, mode, source=CONTAINER)
    assert items == [{"channel": "stdout", "message": "a\n"}]
    assert isinstance(error, LogAccessError)
    assert error.code == "ERR-17-009"


@pytest.mark.parametrize("mode", MODES)
def test_text_guest_error_without_newline_stops_while_stream_open(
    mode: str, clock: FakeClock
) -> None:
    # The guest writes the record without a newline; the read then fails, which
    # would be retried if the error were not detected from the pending buffer.
    server = LogServer([body('{"error":"x"}', read_error=True)], clock)
    _items, error = run_follow(server, mode, source=CONTAINER, format="text")
    assert isinstance(error, LogAccessError)
    assert error.code == "ERR-17-009"
    assert len(server.log_calls) == 1


@pytest.mark.parametrize("mode", MODES)
def test_glued_guest_error_in_fetch(mode: str, clock: FakeClock) -> None:
    server = LogServer([body('{"error":"x"}{"channel":"stdout","message":"y\\n"}\n')], clock)
    with pytest.raises(LogAccessError) as err:
        run_fetch(server, mode, source=CONTAINER, format="ndjson")
    assert err.value.code == "ERR-17-009"
    assert str(err.value) == "x"


@pytest.mark.parametrize("mode", MODES)
def test_fetch_text_guest_error_without_newline(mode: str, clock: FakeClock) -> None:
    server = LogServer([body(json.dumps({"error": GUEST_DOCKER_ERROR}))], clock)
    with pytest.raises(LogAccessError) as err:
        run_fetch(server, mode, source=CONTAINER, format="text")
    assert err.value.code == "ERR-17-009"
    assert str(err.value) == GUEST_DOCKER_ERROR


@pytest.mark.parametrize("mode", MODES)
def test_console_and_stdin_channels(mode: str, clock: FakeClock) -> None:
    payload = record("boot\n", "console") + record("typed\n", "stdin") + record("", "stdout")
    server = LogServer([body(payload), body(payload)], clock)
    expected = [
        {"channel": "console", "message": "boot\n"},
        {"channel": "stdin", "message": "typed\n"},
        {"channel": "stdout", "message": ""},
    ]
    assert run_fetch(server, mode, source=CONTAINER, format="ndjson") == expected
    items, error = run_follow(server, mode, source=CONTAINER, limit=3)
    assert error is None
    assert items == expected


@pytest.mark.parametrize("mode", MODES)
def test_container_keeps_heartbeat_like_content(mode: str, clock: FakeClock) -> None:
    server = LogServer([body(record("[vmm heartbeat]", "stderr"))], clock)
    entries = run_fetch(server, mode, source=CONTAINER, format="ndjson")
    assert entries == [{"channel": "stderr", "message": "[vmm heartbeat]"}]


@pytest.mark.parametrize("mode", MODES)
def test_node_drops_exact_heartbeats_and_reconnects_with_tail_0(
    mode: str, clock: FakeClock
) -> None:
    text = "[vmm heartbeat]\n[teepod heartbeat]\n\ncontains [vmm heartbeat]\n"
    server = LogServer([body(text), body("reconnected\n"), body(text)], clock)
    items, error = run_follow(server, mode, source=NODE, tail=7, limit=3)
    assert error is None
    assert items == ["\n", "contains [vmm heartbeat]\n", "reconnected\n"]
    assert "tail=7" in server.log_calls[0]
    assert "tail=0" in server.log_calls[1]
    assert run_fetch(server, mode, source=NODE) == "\ncontains [vmm heartbeat]\n"


# --- errors -----------------------------------------------------------------


ENVELOPE_EXTRAS: dict[str, Any] = {
    "suggestions": ["Check the CVM ID"],
    "details": [{"field": "cvm", "message": "unknown"}],
    "links": [{"rel": "docs", "href": "https://docs.example/logs"}],
    "request_id": "req-123",
}


def _assert_envelope_kept(error: LogAccessError) -> None:
    assert error.suggestions == ["Check the CVM ID"]
    assert error.structured_details == [{"field": "cvm", "message": "unknown"}]
    assert error.links == [{"rel": "docs", "href": "https://docs.example/logs"}]
    assert error.request_id == "req-123"


@pytest.mark.parametrize("mode", MODES)
def test_http_error_keeps_envelope(mode: str, clock: FakeClock) -> None:
    server = LogServer([http_error(404, "ERR-17-004", "CVM unavailable", **ENVELOPE_EXTRAS)], clock)
    with pytest.raises(LogAccessError) as err:
        run_fetch(server, mode, source=NODE)
    assert str(err.value) == "CVM unavailable"
    assert err.value.code == "ERR-17-004"
    assert err.value.http_status == 404
    _assert_envelope_kept(err.value)


@pytest.mark.parametrize("mode", MODES)
def test_in_stream_record_keeps_envelope_without_http_status(mode: str, clock: FakeClock) -> None:
    line = json.dumps({"error_code": "ERR-17-010", "message": "timed out", **ENVELOPE_EXTRAS})
    server = LogServer([body(line + "\n")], clock)
    with pytest.raises(LogAccessError) as err:
        run_fetch(server, mode, source=CONTAINER, format="ndjson")
    assert str(err.value) == "timed out"
    assert err.value.http_status is None
    assert err.value.status_code == 0
    _assert_envelope_kept(err.value)


@pytest.mark.parametrize("mode", MODES)
def test_composition_error_is_surfaced(mode: str, clock: FakeClock) -> None:
    server = LogServer([], clock, composition={"containers": None, "error": "CVM is stopped"})
    with pytest.raises(LogAccessError, match="CVM is stopped"):
        run_fetch(server, mode, source={"type": "container"})
    assert server.log_calls == []


# --- URLs -------------------------------------------------------------------


@pytest.mark.parametrize("mode", MODES)
def test_signed_query_is_appended_raw(mode: str, clock: FakeClock) -> None:
    server = LogServer([body("ok\n")], clock)
    run_fetch(server, mode, source=NODE, tail=5)
    assert server.log_calls == [f"{NODE_SERIAL_URL}&tail=5"]
    assert "%" not in server.log_calls[0]


@pytest.mark.parametrize("mode", MODES)
def test_container_url_is_built_from_log_base(mode: str, clock: FakeClock) -> None:
    detail = {
        **DETAIL,
        "logs": {
            "container_log_base": "https://cloud-logs.example/logs/123/container/",
            "auth_query": SIGNED_QUERY,
        },
    }
    # The composition log_endpoint is ignored; the URL comes from the CVM info.
    composition = {
        "containers": [
            {"id": "0123abcd", "names": ["/web.1"], "log_endpoint": "https://other.example/x"}
        ]
    }
    server = LogServer([body("ok\n")], clock, detail=detail, composition=composition)
    run_fetch(server, mode, source={"type": "container", "name": "web.1"}, format="text")
    assert server.log_calls == [
        f"https://cloud-logs.example/logs/123/container/web.1?{SIGNED_QUERY}&format=text"
    ]


def test_backoff_delay_saturates_without_overflow() -> None:
    assert REAL_BACKOFF_DELAY(1) == 0.25
    assert REAL_BACKOFF_DELAY(5) == 4.0
    assert REAL_BACKOFF_DELAY(2000) == 5.0


@pytest.mark.parametrize("mode", MODES)
def test_exact_name_match_uses_the_callers_name(mode: str, clock: FakeClock) -> None:
    detail = {
        **DETAIL,
        "logs": {
            "container_log_base": "https://cloud-logs.example/logs/123/container/",
            "auth_query": SIGNED_QUERY,
        },
    }
    # The caller names the container by its second name; that name is used as given.
    composition = {"containers": [{"id": "0123abcd", "names": ["/primary", "/alias"]}]}
    server = LogServer([body("ok\n")], clock, detail=detail, composition=composition)
    run_fetch(server, mode, source={"type": "container", "name": "alias"}, format="text")
    assert server.log_calls == [
        f"https://cloud-logs.example/logs/123/container/alias?{SIGNED_QUERY}&format=text"
    ]


@pytest.mark.parametrize("mode", MODES)
@pytest.mark.parametrize("composition", [{"containers": None, "error": None}, {"containers": []}])
def test_named_container_with_empty_composition_is_not_found(
    mode: str, composition: dict[str, Any], clock: FakeClock
) -> None:
    server = LogServer([], clock, composition=composition)
    source: logs.CvmLogSource = {"type": "container", "name": "web.1"}
    with pytest.raises(LogAccessError) as err:
        run_fetch(server, mode, source=source)
    _items, error = run_follow(server, mode, source=source)
    for value in (err.value, error):
        assert isinstance(value, LogAccessError)
        assert value.code == "ERR-17-007"
        assert str(value) == "Container not found"
    assert server.log_calls == []


@pytest.mark.parametrize("mode", MODES)
@pytest.mark.parametrize(
    "name",
    [
        *["-app", ".app", "_app", "/app", "a" * 129, "a b", "a/b"],
        *["app\n", "\u00e9t\u00e9", "a..b", "app.."],
    ],
)
def test_container_name_rule_matches_gateway(mode: str, name: str, clock: FakeClock) -> None:
    server = LogServer([], clock)
    with pytest.raises(LogAccessError, match="Invalid container name"):
        run_fetch(server, mode, source={"type": "container", "name": name})
    with pytest.raises(LogAccessError, match="Invalid container name"):
        run_follow(server, mode, source={"type": "container", "name": name})
    assert server.api_calls == []
    assert server.log_calls == []


@pytest.mark.parametrize("mode", MODES)
@pytest.mark.parametrize("name", ["a", "0app", "web.1", "a.b.c", "my_app-2", "a" * 128])
def test_container_name_rule_accepts_valid_names(mode: str, name: str, clock: FakeClock) -> None:
    composition = {
        "containers": [
            {"id": "0123abcd", "names": [f"/{name.lstrip('/')}"], "log_endpoint": CONTAINER_URL}
        ]
    }
    server = LogServer([body(record("ok\n"))], clock, composition=composition)
    assert run_fetch(server, mode, source={"type": "container", "name": name}) == "ok\n"


@pytest.mark.parametrize("mode", MODES)
def test_invalid_container_name_fails_before_any_request(mode: str, clock: FakeClock) -> None:
    server = LogServer([], clock)
    with pytest.raises(LogAccessError, match="Invalid container name"):
        run_fetch(server, mode, source={"type": "container", "name": "a/b"})
    with pytest.raises(LogAccessError, match="Invalid container name"):
        run_follow(server, mode, source={"type": "container", "name": "a%20b"})
    assert server.api_calls == []
    assert server.log_calls == []


# --- ANSI -------------------------------------------------------------------

RED = "\x1b[31m"
RESET = "\x1b[0m"


@pytest.mark.parametrize("mode", MODES)
def test_ndjson_strips_ansi_and_never_sends_ansi(mode: str, clock: FakeClock) -> None:
    payload = record(f"{RED}red{RESET}\n")
    server = LogServer([body(payload)] * 4, clock)
    stripped = [{"channel": "stdout", "message": "red\n"}]
    raw = [{"channel": "stdout", "message": f"{RED}red{RESET}\n"}]
    assert run_fetch(server, mode, source=CONTAINER, format="ndjson") == stripped
    assert run_fetch(server, mode, source=CONTAINER, format="ndjson", ansi=True) == raw
    assert run_follow(server, mode, source=CONTAINER, limit=1) == (stripped, None)
    assert run_follow(server, mode, source=CONTAINER, ansi=True, limit=1) == (raw, None)
    assert all("ansi=" not in url for url in server.log_calls)


@pytest.mark.parametrize("mode", MODES)
@pytest.mark.parametrize("source", [NODE, CONTAINER])
def test_text_strips_ansi_unless_requested(
    mode: str, source: logs.CvmLogSource, clock: FakeClock
) -> None:
    line = stamp(1, f"{RED}red{RESET}\n") if source is CONTAINER else f"{RED}red{RESET}\n"
    server = LogServer([body(line)] * 4, clock)
    fmt = "text" if source is CONTAINER else None
    assert run_follow(server, mode, source=source, format=fmt, limit=1) == (["red\n"], None)
    assert "ansi=" not in server.log_calls[-1]
    items, _error = run_follow(server, mode, source=source, format=fmt, ansi=True, limit=1)
    assert items == [f"{RED}red{RESET}\n"]
    assert "ansi=true" in server.log_calls[-1]
    fetched = run_fetch(server, mode, source=source, format="text", timestamps=False)
    assert fetched.endswith("red\n") and RED not in fetched


@pytest.mark.parametrize("mode", MODES)
def test_default_format_with_ansi_keeps_escapes(mode: str, clock: FakeClock) -> None:
    colored = record(f"{RED}red{RESET}\n")
    server = LogServer([body(colored), body(colored), body(f"{RED}red{RESET}\n")], clock)
    items, error = run_follow(server, mode, source=CONTAINER, ansi=True, limit=1)
    assert error is None
    assert items == [{"channel": "stdout", "message": f"{RED}red{RESET}\n"}]
    assert run_fetch(server, mode, source=CONTAINER, ansi=True) == f"{RED}red{RESET}\n"
    for url in server.log_calls[:2]:
        assert "format=ndjson" in url
        assert "ansi=" not in url
    run_fetch(server, mode, source=CONTAINER, format="text", ansi=True)
    assert "format=text" in server.log_calls[2]
    assert "ansi=true" in server.log_calls[2]


@pytest.mark.parametrize("mode", MODES)
def test_default_container_fetch_joins_ndjson_messages(mode: str, clock: FakeClock) -> None:
    payload = (
        record(f"{RED}one{RESET}\n")
        + record("", "stdout")
        + record("err\n", "stderr")
        + record("no newline")
    )
    server = LogServer([body(payload)], clock)
    text = run_fetch(server, mode, source=CONTAINER)
    # Messages are joined exactly as received: no added newlines, ANSI stripped.
    assert text == "one\nerr\nno newline"
    assert "format=ndjson" in server.log_calls[0]
    assert "ansi=" not in server.log_calls[0]


ESCAPES = (
    "\x1b[1;31mred\x1b[0m"  # SGR
    "\x1b[?25l\x1b[2K\x1b[?25h"  # CSI incl. private modes
    "\x1b]8;;https://example.com\x07link\x1b]8;;\x07"  # OSC 8 ended by BEL
    "\x1b]8;;https://example.com\x1b\\st\x1b]8;;\x1b\\"  # OSC 8 ended by ESC backslash
    "\x1b7\x1b(B\x1b8"  # two-byte and charset sequences
    " done\n"
)
ESCAPES_STRIPPED = "redlinkst done\n"


@pytest.mark.parametrize("mode", MODES)
@pytest.mark.parametrize(
    ("source", "fmt", "payload"),
    [
        (CONTAINER, None, record(ESCAPES)),
        (CONTAINER, "text", ESCAPES),
        (NODE, None, ESCAPES),
    ],
)
def test_ansi_strip_removes_every_escape_sequence(
    mode: str, source: logs.CvmLogSource, fmt: str | None, payload: str, clock: FakeClock
) -> None:
    server = LogServer([body(payload)] * 4, clock)
    fetch_format = "text" if source is NODE else fmt
    assert run_fetch(server, mode, source=source, format=fetch_format) == ESCAPES_STRIPPED
    assert run_fetch(server, mode, source=source, format=fetch_format, ansi=True) == ESCAPES
    items, error = run_follow(server, mode, source=source, format=fmt, limit=1)
    assert error is None
    delivered = items[0] if isinstance(items[0], str) else items[0]["message"]
    assert delivered == ESCAPES_STRIPPED
    items, error = run_follow(server, mode, source=source, format=fmt, ansi=True, limit=1)
    delivered = items[0] if isinstance(items[0], str) else items[0]["message"]
    assert delivered == ESCAPES


@pytest.mark.parametrize("mode", MODES)
def test_node_guest_shaped_output_is_delivered(mode: str, clock: FakeClock) -> None:
    # Guest error records exist only on container streams; on node streams this is
    # ordinary process output.
    line = '{"error":"x"}{"channel":"stdout","message":"y"}\n'
    server = LogServer([body(line), body(line)], clock)
    assert run_fetch(server, mode, source=NODE) == line
    items, error = run_follow(server, mode, source=NODE, limit=1)
    assert error is None
    assert items == [line]


@pytest.mark.parametrize(
    ("value", "since", "until"),
    [
        ("2026-11-10T00:00:00.000000001Z", 1_794_268_800, 1_794_268_801),
        ("2026-11-10T00:00:00.000000000Z", 1_794_268_800, 1_794_268_800),
        ("2026-11-10T00:00:00Z", 1_794_268_800, 1_794_268_800),
        ("2026-11-10T08:00:00.5+08:00", 1_794_268_800, 1_794_268_801),
        ("2026-11-09T23:59:59.999999999Z", 1_794_268_799, 1_794_268_800),
    ],
)
def test_rfc3339_fraction_floors_since_and_ceils_until_exactly(
    value: str, since: int, until: int
) -> None:
    assert logs.resolve_log_time_window(value, value) == {"since": since, "until": until}


# --- public logs ------------------------------------------------------------


@pytest.mark.parametrize("mode", MODES)
def test_public_logs_off_fetch_and_follow(mode: str, clock: FakeClock) -> None:
    server = LogServer([], clock, detail={"public_logs": False, "logs": {}})
    with pytest.raises(LogAccessError) as err:
        run_fetch(server, mode, source=CONTAINER, format="ndjson")
    assert err.value.code == "ERR-17-006"
    assert err.value.http_status == 409
    _items, error = run_follow(server, mode, source=CONTAINER)
    assert isinstance(error, LogAccessError)
    assert error.code == "ERR-17-006"
    assert server.api_calls == ["/cvms/app_test", "/cvms/app_test"]
    assert server.log_calls == []


# --- cancellation -----------------------------------------------------------


def test_sync_close_during_backoff_returns_promptly(
    monkeypatch: pytest.MonkeyPatch, clock: FakeClock
) -> None:
    use_real_waits(monkeypatch)
    monkeypatch.setattr(logs, "_backoff_delay", lambda _attempt: 30.0)
    server = LogServer([http_error(503, "ERR-17-012")] * 2, clock)
    outcome: dict[str, Any] = {}
    with httpx.Client(transport=server.transport) as log_http:
        stream = follow_cvm_logs(
            api_get=server.api_get, log_http=log_http, cvm_id="app_test", source=CONTAINER
        )

        def consume() -> None:
            try:
                outcome["items"] = list(stream)
            except Exception as exc:
                outcome["error"] = exc

        worker = threading.Thread(target=consume)
        worker.start()
        assert server.requested.wait(5)
        time.sleep(0.1)  # let the worker enter the backoff wait
        started = time.monotonic()
        stream.close()
        worker.join(5)
    assert not worker.is_alive()
    assert time.monotonic() - started < 2
    assert outcome == {"items": []}
    assert len(server.log_calls) == 1


async def test_async_cancel_during_backoff_returns_promptly(
    monkeypatch: pytest.MonkeyPatch, clock: FakeClock
) -> None:
    use_real_waits(monkeypatch)
    monkeypatch.setattr(logs, "_backoff_delay", lambda _attempt: 30.0)
    server = LogServer([http_error(503, "ERR-17-012")] * 2, clock)
    async with httpx.AsyncClient(transport=server.transport) as log_http:
        stream = afollow_cvm_logs(
            api_get=server.aapi_get, log_http=log_http, cvm_id="app_test", source=CONTAINER
        )

        async def consume() -> None:
            async for _item in stream:
                pass

        task = asyncio.create_task(consume())
        while not server.log_calls:
            await asyncio.sleep(0.01)
        await asyncio.sleep(0.05)
        started = time.monotonic()
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await asyncio.wait_for(task, 2)
    assert time.monotonic() - started < 2
    assert len(server.log_calls) == 1


# --- client methods ---------------------------------------------------------


def _client_transport(
    server: LogServer, versions: list[str | None]
) -> Callable[[httpx.Request], httpx.Response]:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "cloud-logs.example":
            return server.handler(request)
        versions.append(request.headers.get("x-phala-version"))
        return httpx.Response(200, json=server.api_get(request.url.path.removeprefix("/api/v1")))

    return handler


def test_legacy_client_version_still_resolves_log_urls(clock: FakeClock) -> None:
    server = LogServer([body("ok\n")], clock)
    versions: list[str | None] = []
    transport = httpx.MockTransport(_client_transport(server, versions))
    with httpx.Client(transport=transport, base_url="https://example.com/api/v1") as api:
        client = PhalaCloud(api_key="k", version="2025-10-28", http_client=api)
        text = client.fetch_cvm_logs("app_test", NODE, log_http=api)
    assert text == "ok\n"
    assert versions == [CVM_LOGS_INFO_API_VERSION]


async def test_async_client_fetch_and_follow(clock: FakeClock) -> None:
    server = LogServer([body(record("one\n")), body(record("two\n"))], clock)
    versions: list[str | None] = []
    transport = httpx.MockTransport(_client_transport(server, versions))
    async with httpx.AsyncClient(transport=transport, base_url="https://example.com/api/v1") as api:
        client = AsyncPhalaCloud(api_key="k", http_client=api)
        entries = await client.fetch_cvm_logs("app_test", CONTAINER, format="ndjson", log_http=api)
        followed = client.follow_cvm_logs("app_test", CONTAINER, log_http=api)
        first = await followed.__anext__()
        await followed.aclose()
    assert entries == [{"channel": "stdout", "message": "one\n"}]
    assert first == {"channel": "stdout", "message": "two\n"}
    # CVM info is pinned for the logs field; composition uses the client's version.
    assert versions == [CVM_LOGS_INFO_API_VERSION, DEFAULT_API_VERSION] * 2


@pytest.mark.parametrize("mode", MODES)
def test_non_2xx_lookup_is_an_error(mode: str, clock: FakeClock) -> None:
    server = LogServer([], clock)

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "cloud-logs.example":
            return server.handler(request)
        return httpx.Response(302, headers={"Location": "https://elsewhere.example/"})

    transport = httpx.MockTransport(handler)
    base_url = "https://example.com/api/v1"
    if mode == "sync":
        with httpx.Client(transport=transport, base_url=base_url) as api:
            with pytest.raises(ApiError) as err:
                PhalaCloud(api_key="k", http_client=api).fetch_cvm_logs("app_test", NODE)
    else:

        async def run() -> None:
            async with httpx.AsyncClient(transport=transport, base_url=base_url) as api:
                await AsyncPhalaCloud(api_key="k", http_client=api).fetch_cvm_logs("app_test", NODE)

        with pytest.raises(ApiError) as err:
            asyncio.run(run())
    assert err.value.status_code == 302
    assert server.log_calls == []
