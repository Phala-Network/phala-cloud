"""CVM log helpers (fetch and follow) shared by the sync and async clients.

The protocol logic is I/O-free: a lookup coroutine resolves a fresh signed URL,
decoders turn response text into delivered items, and a retry policy decides
what happens after each connection. The sync and async drivers only move bytes.
"""

from __future__ import annotations

import asyncio
import json
import re
import threading
import time
from collections.abc import AsyncGenerator, AsyncIterator, Awaitable, Callable, Generator, Iterator
from contextlib import asynccontextmanager, contextmanager
from dataclasses import dataclass, field
from typing import Any, Generic, Literal, Protocol, TypedDict, TypeVar, cast

import httpx

from .errors import ApiError, ResourceError
from .log_time import _parse_rfc3339, resolve_log_time_window
from .user_agent import default_user_agent

__all__ = [
    "CvmLogEntry",
    "CvmLogSource",
    "LogAccessError",
    "LogFollowIterator",
    "afetch_cvm_logs",
    "afollow_cvm_logs",
    "fetch_cvm_logs",
    "follow_cvm_logs",
    "resolve_log_time_window",
]

# API version that introduced CVMInfo.logs. Pinned so older clients still get URLs.
CVM_LOGS_INFO_API_VERSION = "2026-01-21"

T = TypeVar("T")
T_co = TypeVar("T_co", covariant=True)

CvmLogChannel = Literal["serial", "stdout", "stderr"]
CvmLogFormat = Literal["text", "ndjson"]
LogChannel = Literal["stdout", "stderr", "stdin", "console"]

SyncApiGet = Callable[[str], Any]
AsyncApiGet = Callable[[str], Awaitable[Any]]


class NodeLogSource(TypedDict):
    type: Literal["node"]
    channel: CvmLogChannel


class ContainerLogSource(TypedDict, total=False):
    type: Literal["container"]
    name: str
    matchContainerIdPrefix: bool


CvmLogSource = NodeLogSource | ContainerLogSource


class CvmLogEntry(TypedDict):
    channel: LogChannel
    message: str


_LOG_CHANNELS = {"stdout", "stderr", "stdin", "console"}
_HEARTBEATS = frozenset({"[vmm heartbeat]", "[teepod heartbeat]"})
# Same rule as the gateway: 1-128 characters, first one alphanumeric.
_CONTAINER_NAME_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,127}")
# Every ANSI escape: OSC (ended by BEL or ESC \\), CSI incl. private modes, two-byte ESC.
_ANSI_RE = re.compile(r"\x1b(?:\][^\x07\x1b]*(?:\x07|\x1b\\)|\[[0-?]*[ -/]*[@-~]|[ -/]*[0-~])")
_GATEWAY_TEXT_ERROR_RE = re.compile(r"^\[error\] (ERR-17-\d{3}) (.*)$")
_TIMESTAMP_RE = re.compile(
    r"^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})) (.*)$", re.S
)
_JSON = json.JSONDecoder()

_EMPTY_STREAM_END_MESSAGE = (
    "log stream keeps ending without new output; the container may have stopped"
)
# Idle connections longer than this that end cleanly are not treated as stopped.
EMPTY_STREAM_QUIET_SECONDS = 10
_MAX_CONSECUTIVE_FAILURES = 5
_MAX_EMPTY_ENDS = 5
_MAX_EXPIRED_RETRIES = 3
# Minimum gap between connection starts. A node can answer 200 with one error line
# and end at once; that counts as output and would otherwise reconnect in a hot loop.
_MIN_CONNECTION_INTERVAL_SECONDS = 1.0

# Indirections so tests can control time without patching the global time module.
_monotonic = time.monotonic
_wall_clock = time.time


def _wait_sync(stop: threading.Event, seconds: float) -> bool:
    """Wait unless stopped first; True when stopped."""
    return stop.wait(seconds)


async def _wait_async(seconds: float) -> None:
    await asyncio.sleep(seconds)


def _reconnect_delay(delay: float, started_at: float) -> float:
    return max(delay, _MIN_CONNECTION_INTERVAL_SECONDS - (_monotonic() - started_at))


def _backoff_delay(attempt: int) -> float:
    # Clamp before the power so a long run of retries never overflows.
    return min(0.25 * 2 ** (min(max(attempt, 1), 6) - 1), 5.0)


class LogAccessError(ResourceError):
    """Structured log-gateway error.

    ``http_status`` is the real HTTP status for HTTP errors and ``None`` for
    errors read from a 200 response body (guest records, gateway in-stream errors).
    ``from_stream_body`` marks terminal stream conditions that are never retried.
    """

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        http_status: int | None = None,
        suggestions: list[str] | None = None,
        details: list[dict[str, Any]] | None = None,
        links: list[dict[str, str]] | None = None,
        request_id: str | None = None,
        from_stream_body: bool = False,
    ) -> None:
        status = 0 if from_stream_body else (http_status or 0)
        super().__init__(
            status_code=status,
            message=message,
            code=code,
            error_code=code,
            request_id=request_id,
            structured_details=details,
            suggestions=list(suggestions or []),
            links=links,
        )
        self.http_status = status or None
        self.from_stream_body = from_stream_body


class _GatewayStreamError(LogAccessError):
    """Gateway error reported inside a 200 stream; retried like a network failure."""


# --- errors -----------------------------------------------------------------


def _dict_list(value: object) -> list[dict[str, Any]] | None:
    if not isinstance(value, list):
        return None
    return [item for item in value if isinstance(item, dict)]


def _error_from_envelope(
    envelope: dict[str, Any],
    *,
    http_status: int | None,
    fallback_message: str,
    error_type: type[LogAccessError] = LogAccessError,
) -> LogAccessError:
    code = envelope.get("error_code")
    message = envelope.get("message")
    request_id = envelope.get("request_id")
    raw_suggestions = envelope.get("suggestions")
    suggestions = (
        [item for item in raw_suggestions if isinstance(item, str)]
        if isinstance(raw_suggestions, list)
        else []
    )
    return error_type(
        message if isinstance(message, str) else fallback_message,
        code=code if isinstance(code, str) else None,
        http_status=http_status,
        suggestions=suggestions,
        details=_dict_list(envelope.get("details")),
        links=_dict_list(envelope.get("links")),
        request_id=request_id if isinstance(request_id, str) else None,
    )


def _http_error(response: httpx.Response) -> LogAccessError:
    try:
        envelope = json.loads(response.text)
    except ValueError:
        envelope = {}
    return _error_from_envelope(
        envelope if isinstance(envelope, dict) else {},
        http_status=response.status_code,
        fallback_message=f"HTTP {response.status_code}",
    )


def _guest_error(message: str) -> LogAccessError:
    return LogAccessError(message, code="ERR-17-009", from_stream_body=True)


def _guest_error_message(record: object) -> str | None:
    if (
        isinstance(record, dict)
        and isinstance(record.get("error"), str)
        and "channel" not in record
        and "message" not in record
    ):
        return record["error"]
    return None


def _raise_leading_guest_error(text: str) -> None:
    """Raise when text starts with a guest ``{"error"}`` record, glued or not."""
    stripped = text.lstrip()
    if not stripped.startswith("{"):
        return
    try:
        record, _end = _JSON.raw_decode(stripped)
    except json.JSONDecodeError:
        return
    message = _guest_error_message(record)
    if message is not None:
        raise _guest_error(message)


def _raise_gateway_text_error(line: str) -> None:
    match = _GATEWAY_TEXT_ERROR_RE.match(line.strip())
    if match:
        raise _GatewayStreamError(match.group(2), code=match.group(1))


def _client_error(message: str) -> LogAccessError:
    """Invalid caller input, raised before any request."""
    return LogAccessError(message, code="ERR-17-001")


def _resolve_times(since: str | int | None, until: str | int | None) -> dict[str, int]:
    try:
        return resolve_log_time_window(since, until)
    except ValueError as exc:
        raise _client_error(str(exc)) from exc


def _container_logs_disabled() -> LogAccessError:
    return LogAccessError("Container logs are disabled", code="ERR-17-006", http_status=409)


# --- output shaping ---------------------------------------------------------


def _apply_ansi(text: str, ansi: bool) -> str:
    return text if ansi else _ANSI_RE.sub("", text)


def _split_timestamp(message: str) -> tuple[int, str] | None:
    """Return (unix second, message without timestamp) for a timestamped message."""
    match = _TIMESTAMP_RE.match(message)
    if not match:
        return None
    parsed = _parse_rfc3339(match.group(1))
    if parsed is None:
        return None
    return parsed[0], match.group(2)


def _strip_timestamp(message: str) -> str:
    parsed = _split_timestamp(message)
    return parsed[1] if parsed else message


def _line_ending(line: str) -> str:
    if line.endswith("\r\n"):
        return "\r\n"
    return "\n" if line.endswith("\n") else ""


@dataclass
class _Cursor:
    """Reconnect cursor: last timestamp second plus boundary de-dupe counts."""

    since: int | None = None
    boundary_second: int | None = None
    boundary_counts: dict[str, int] = field(default_factory=dict)
    replay_counts: dict[str, int] = field(default_factory=dict)

    def begin_connection(self) -> None:
        self.replay_counts = dict(self.boundary_counts)

    def accept(self, key: str, stamped_message: str) -> bool:
        """Record a delivered record; False when it replays the boundary second."""
        parsed = _split_timestamp(stamped_message)
        if parsed is None:
            return True
        second = parsed[0]
        if self.boundary_second is not None and second < self.boundary_second:
            return True
        if second == self.boundary_second:
            replay = self.replay_counts.get(key, 0)
            if replay > 0:
                self.replay_counts[key] = replay - 1
                return False
        else:
            self.boundary_second = second
            self.boundary_counts.clear()
        self.since = second if self.since is None else max(self.since, second)
        self.boundary_counts[key] = self.boundary_counts.get(key, 0) + 1
        return True


class _LineBuffer:
    def __init__(self) -> None:
        self.pending = ""

    def feed(self, chunk: str) -> list[str]:
        self.pending += chunk
        if "\n" not in self.pending:
            return []
        *lines, self.pending = self.pending.split("\n")
        return [line + "\n" for line in lines]

    def finish(self) -> list[str]:
        rest, self.pending = self.pending, ""
        return [rest] if rest else []


class _Decoder(Protocol[T_co]):
    def feed(self, chunk: str) -> Iterator[T_co]: ...

    def finish(self) -> Iterator[T_co]: ...


class _NodeTextDecoder:
    """Node (serial/stdout/stderr) text: drops heartbeats, raises gateway errors."""

    def __init__(self, *, ansi: bool) -> None:
        self._ansi = ansi
        self._lines = _LineBuffer()

    def feed(self, chunk: str) -> Iterator[str]:
        yield from self._emit(self._lines.feed(chunk))

    def finish(self) -> Iterator[str]:
        yield from self._emit(self._lines.finish())

    def _emit(self, lines: list[str]) -> Iterator[str]:
        for line in lines:
            ending = _line_ending(line)
            content = line[: len(line) - len(ending)]
            if content in _HEARTBEATS:
                continue
            _raise_gateway_text_error(content)
            yield _apply_ansi(line, self._ansi)


class _ContainerTextDecoder:
    """Container text: raises gateway and guest errors, de-dupes, strips timestamps."""

    def __init__(self, *, ansi: bool, keep_timestamps: bool, cursor: _Cursor | None) -> None:
        self._ansi = ansi
        self._keep_timestamps = keep_timestamps
        self._cursor = cursor
        self._lines = _LineBuffer()
        # Application lines may be JSON like {"error": ...}; only the start of the
        # body can be told apart as a guest error record.
        self._at_body_start = True

    def feed(self, chunk: str) -> Iterator[str]:
        yield from self._emit(self._lines.feed(chunk))
        if self._at_body_start:
            # A guest error is written without a newline; do not wait for one.
            _raise_leading_guest_error(self._lines.pending)

    def finish(self) -> Iterator[str]:
        yield from self._emit(self._lines.finish())

    def _emit(self, lines: list[str]) -> Iterator[str]:
        for line in lines:
            ending = _line_ending(line)
            content = line[: len(line) - len(ending)]
            _raise_gateway_text_error(content)
            if self._at_body_start:
                _raise_leading_guest_error(content)
                self._at_body_start = False
            if self._cursor is not None and not self._cursor.accept(content, content):
                continue
            out = content if self._keep_timestamps else _strip_timestamp(content)
            yield _apply_ansi(out + ending, self._ansi)


def _entry_from_record(record: object) -> CvmLogEntry:
    if not isinstance(record, dict):
        raise LogAccessError("Invalid NDJSON log record.")
    guest = _guest_error_message(record)
    if guest is not None:
        raise _guest_error(guest)
    if isinstance(record.get("error_code"), str):
        raise _error_from_envelope(
            record,
            http_status=None,
            fallback_message="The log stream ended with an error.",
            error_type=_GatewayStreamError,
        )
    channel = record.get("channel")
    message = record.get("message")
    if channel not in _LOG_CHANNELS or not isinstance(message, str):
        raise LogAccessError("Invalid NDJSON log record.")
    return {"channel": channel, "message": message}


class _NdjsonDecoder:
    """Streaming NDJSON decoder; records may be glued without a newline."""

    def __init__(self, *, ansi: bool, keep_timestamps: bool, cursor: _Cursor | None) -> None:
        self._ansi = ansi
        self._keep_timestamps = keep_timestamps
        self._cursor = cursor
        self._buffer = ""

    def feed(self, chunk: str) -> Iterator[CvmLogEntry]:
        self._buffer += chunk
        yield from self._drain(final=False)

    def finish(self) -> Iterator[CvmLogEntry]:
        yield from self._drain(final=True)

    def _drain(self, *, final: bool) -> Iterator[CvmLogEntry]:
        buffer = self._buffer
        pos = 0
        try:
            while True:
                while pos < len(buffer) and buffer[pos] in " \t\r\n":
                    pos += 1
                if pos >= len(buffer):
                    return
                try:
                    record, end = _JSON.raw_decode(buffer, pos)
                except json.JSONDecodeError as exc:
                    # Compact JSON never spans a newline: without one, wait for more.
                    if not final and buffer.find("\n", pos) < 0:
                        return
                    raise LogAccessError("Invalid NDJSON log record.") from exc
                pos = end
                entry = _entry_from_record(record)
                stamped = entry["message"]
                if self._cursor is not None and not self._cursor.accept(
                    json.dumps([entry["channel"], stamped]), stamped
                ):
                    continue
                message = stamped if self._keep_timestamps else _strip_timestamp(stamped)
                yield {"channel": entry["channel"], "message": _apply_ansi(message, self._ansi)}
        finally:
            self._buffer = buffer[pos:]


def _decode_all(decoder: _Decoder[T], text: str) -> list[T]:
    return [*decoder.feed(text), *decoder.finish()]


# --- URL lookup -------------------------------------------------------------

# Yields API paths, receives each decoded JSON response, returns the log URL.
_Lookup = Generator[str, Any, str]


def _build_log_url(
    base_url: str,
    *,
    since: int | None = None,
    until: int | None = None,
    follow: bool = False,
    tail: int | str | None = None,
    timestamps: bool = False,
    ansi: bool = False,
    format: CvmLogFormat | None = None,
) -> str:
    # Appended raw: the gateway rejects any '%' in the request target.
    params: list[str] = []
    if since is not None:
        params.append(f"since={since}")
    if until is not None:
        params.append(f"until={until}")
    if follow:
        params.append("follow=true")
    if tail is not None:
        params.append(f"tail={tail}")
    if timestamps:
        params.append("timestamps=true")
    if ansi:
        params.append("ansi=true")
    if format:
        params.append(f"format={format}")
    if not params:
        return base_url
    separator = "&" if "?" in base_url else "?"
    return f"{base_url}{separator}{'&'.join(params)}"


def _node_endpoint_lookup(cvm_id: str, channel: CvmLogChannel) -> _Lookup:
    info = yield f"/cvms/{cvm_id}"
    endpoint = (info.get("logs") or {}).get(channel)
    if not endpoint:
        raise LogAccessError(f"No {channel} log endpoint available for CVM '{cvm_id}'")
    return str(endpoint)


def _safe_container_slug(name: str) -> str:
    if not _CONTAINER_NAME_RE.fullmatch(name) or ".." in name:
        raise _client_error(
            f"Invalid container name '{name}'. Use 1-128 letters, digits, '_', '.', and '-', "
            "starting with a letter or digit, without '..'."
        )
    return name


def _join_container_log_url(base: str, name: str, auth_query: str | None) -> str:
    url = f"{base.rstrip('/')}/{_safe_container_slug(name)}"
    if not auth_query:
        return url
    return f"{url}{'&' if '?' in url else '?'}{auth_query}"


def _container_names(container: dict[str, Any]) -> list[str]:
    return [str(name) for name in container.get("names") or []]


def _container_slug(container: dict[str, Any]) -> str | None:
    names = _container_names(container)
    if names:
        return names[0].removeprefix("/")
    container_id = container.get("id")
    return str(container_id) if container_id else None


def _resolve_container(composition: dict[str, Any], name: str | None, match_prefix: bool) -> str:
    """Resolve the container slug: exact name first, then a unique ID prefix, else default."""
    containers: list[dict[str, Any]] = composition.get("containers") or []
    composition_error = composition.get("error")
    if not (isinstance(composition_error, str) and composition_error):
        composition_error = None
    not_found = LogAccessError("Container not found", code="ERR-17-007")

    def slug_of(container: dict[str, Any]) -> str:
        return _container_slug(container) or name or "app"

    if name:
        names = {name, f"/{name}"}
        exact = [c for c in containers if names & set(_container_names(c))]
        if exact:
            return name
        if match_prefix:
            prefixed = [c for c in containers if str(c.get("id") or "").startswith(name)]
            if len(prefixed) > 1:
                labels = ", ".join(slug_of(c) for c in prefixed)
                raise _client_error(f"Ambiguous container prefix '{name}': {labels}")
            if prefixed:
                return slug_of(prefixed[0])
        if not containers and composition_error:
            raise LogAccessError(composition_error)
        raise not_found

    if composition_error:
        raise LogAccessError(composition_error)
    if not containers:
        raise not_found
    return slug_of(containers[0])


def _container_url(cvm_id: str, info: dict[str, Any], slug: str) -> str:
    logs = info.get("logs") or {}
    base = logs.get("container_log_base")
    if not base:
        raise LogAccessError(f"No log endpoints available for CVM '{cvm_id}'")
    return _join_container_log_url(base, slug, logs.get("auth_query"))


def _container_endpoint_lookup(
    cvm_id: str,
    name: str | None,
    match_prefix: bool,
    slug: str | None = None,
) -> Generator[str, Any, tuple[str, str]]:
    """One CVM-info lookup; composition only when the container is not resolved yet."""
    info = yield f"/cvms/{cvm_id}"
    if isinstance(info, dict) and info.get("public_logs") is False:
        raise _container_logs_disabled()
    if slug is None:
        composition = yield f"/cvms/{cvm_id}/composition"
        slug = _resolve_container(composition, name, match_prefix)
    return _container_url(cvm_id, info, slug), slug


def _run_lookup(lookup: _Lookup, api_get: SyncApiGet) -> str:
    try:
        path = next(lookup)
        while True:
            path = lookup.send(api_get(path))
    except StopIteration as done:
        return str(done.value)


async def _arun_lookup(lookup: _Lookup, api_get: AsyncApiGet) -> str:
    try:
        path = next(lookup)
        while True:
            path = lookup.send(await api_get(path))
    except StopIteration as done:
        return str(done.value)


# --- request plans ----------------------------------------------------------


def _assert_node_options(
    *, timestamps: bool, since: object, until: object, format: CvmLogFormat | None
) -> None:
    unsupported = [
        name
        for name, present in (
            ("timestamps", timestamps),
            ("since", since is not None),
            ("until", until is not None),
            ("format=ndjson", format == "ndjson"),
        )
        if present
    ]
    if unsupported:
        raise _client_error(f"{', '.join(unsupported)} not supported for serial/stdout/stderr logs")


def _container_options(
    source: CvmLogSource, container_match_prefix: bool
) -> tuple[str | None, bool]:
    container = cast(ContainerLogSource, source)
    name = container.get("name")
    if name:
        _safe_container_slug(name)
    return name, container.get("matchContainerIdPrefix", container_match_prefix)


@dataclass
class _FetchPlan:
    lookup: Callable[[], _Lookup]
    decode: Callable[[str], str | list[CvmLogEntry]]


def _fetch_plan(
    *,
    cvm_id: str,
    source: CvmLogSource,
    tail: int | str | None,
    since: str | int | None,
    until: str | int | None,
    timestamps: bool,
    ansi: bool,
    format: CvmLogFormat | None,
    container_match_prefix: bool,
) -> _FetchPlan:
    if source["type"] == "node":
        _assert_node_options(timestamps=timestamps, since=since, until=until, format=format)
        channel = source["channel"]

        def node_lookup() -> _Lookup:
            endpoint = yield from _node_endpoint_lookup(cvm_id, channel)
            return _build_log_url(endpoint, tail=tail, ansi=ansi)

        return _FetchPlan(
            node_lookup, lambda text: "".join(_decode_all(_NodeTextDecoder(ansi=ansi), text))
        )

    name, match_prefix = _container_options(source, container_match_prefix)
    times = _resolve_times(since, until)
    text = format == "text"

    def container_lookup() -> _Lookup:
        endpoint, _container = yield from _container_endpoint_lookup(cvm_id, name, match_prefix)
        return _build_log_url(
            endpoint,
            since=times.get("since"),
            until=times.get("until"),
            tail=tail,
            timestamps=timestamps,
            ansi=ansi and text,
            # Without an explicit format, NDJSON is fetched and joined into text.
            format="text" if text else "ndjson",
        )

    def decode(body: str) -> str | list[CvmLogEntry]:
        if text:
            decoder = _ContainerTextDecoder(ansi=ansi, keep_timestamps=True, cursor=None)
            return "".join(_decode_all(decoder, body))
        entries = _decode_all(_NdjsonDecoder(ansi=ansi, keep_timestamps=True, cursor=None), body)
        if format == "ndjson":
            return entries
        return "".join(entry["message"] for entry in entries)

    return _FetchPlan(container_lookup, decode)


class _FollowPlan(Protocol[T_co]):
    stops_on_empty_ends: bool

    def lookup(self) -> _Lookup: ...

    def on_connected(self, now: float) -> None: ...

    def decoder(self) -> _Decoder[T_co]: ...

    def window_reached(self, now: float) -> bool: ...


class _NodeFollowPlan:
    stops_on_empty_ends = False

    def __init__(
        self, *, cvm_id: str, channel: CvmLogChannel, tail: int | str | None, ansi: bool
    ) -> None:
        self._cvm_id = cvm_id
        self._channel = channel
        self._tail = tail
        self._ansi = ansi
        self._accepted = False

    def lookup(self) -> _Lookup:
        endpoint = yield from _node_endpoint_lookup(self._cvm_id, self._channel)
        tail = 0 if self._accepted else self._tail
        return _build_log_url(endpoint, tail=tail, follow=True, ansi=self._ansi)

    def on_connected(self, now: float) -> None:
        self._accepted = True

    def decoder(self) -> _Decoder[str]:
        return _NodeTextDecoder(ansi=self._ansi)

    def window_reached(self, now: float) -> bool:
        return False


class _ContainerFollowPlan:
    stops_on_empty_ends = True

    def __init__(
        self,
        *,
        cvm_id: str,
        name: str | None,
        match_prefix: bool,
        tail: int | str | None,
        times: dict[str, int],
        timestamps: bool,
        ansi: bool,
        text: bool,
    ) -> None:
        self._cvm_id = cvm_id
        self._name = name
        self._match_prefix = match_prefix
        self._tail = tail
        self._since = times.get("since")
        self._until = times.get("until")
        self._timestamps = timestamps
        self._ansi = ansi
        self._text = text
        self._cursor = _Cursor()
        self._first_200_second: int | None = None
        self._container: str | None = None

    def _reconnect_since(self) -> int | None:
        if self._cursor.since is not None:
            return self._cursor.since
        # Without a cursor the caller's since stands; otherwise the first-200 second.
        return self._since if self._since is not None else self._first_200_second

    def lookup(self) -> _Lookup:
        # Resolve the name once per follow; later rounds only refresh the signed URL.
        endpoint, self._container = yield from _container_endpoint_lookup(
            self._cvm_id, self._name, self._match_prefix, self._container
        )
        accepted = self._first_200_second is not None
        return _build_log_url(
            endpoint,
            since=self._reconnect_since() if accepted else self._since,
            until=self._until,
            follow=True,
            # The caller's tail applies only until the first 200 is accepted.
            tail="all" if accepted else self._tail,
            timestamps=True,
            ansi=self._ansi and self._text,
            format="text" if self._text else "ndjson",
        )

    def on_connected(self, now: float) -> None:
        if self._first_200_second is None:
            self._first_200_second = int(now)

    def decoder(self) -> _Decoder[str | CvmLogEntry]:
        self._cursor.begin_connection()
        if self._text:
            return _ContainerTextDecoder(
                ansi=self._ansi, keep_timestamps=self._timestamps, cursor=self._cursor
            )
        return _NdjsonDecoder(
            ansi=self._ansi, keep_timestamps=self._timestamps, cursor=self._cursor
        )

    def window_reached(self, now: float) -> bool:
        if self._until is None:
            return False
        cursor_since = self._cursor.since
        return (cursor_since is not None and cursor_since >= self._until) or now >= self._until


def _follow_plan(
    *,
    cvm_id: str,
    source: CvmLogSource,
    tail: int | str | None,
    since: str | int | None,
    until: str | int | None,
    timestamps: bool,
    ansi: bool,
    format: CvmLogFormat | None,
    container_match_prefix: bool,
) -> _FollowPlan[str | CvmLogEntry]:
    if source["type"] == "node":
        _assert_node_options(timestamps=timestamps, since=since, until=until, format=format)
        return _NodeFollowPlan(cvm_id=cvm_id, channel=source["channel"], tail=tail, ansi=ansi)
    name, match_prefix = _container_options(source, container_match_prefix)
    return _ContainerFollowPlan(
        cvm_id=cvm_id,
        name=name,
        match_prefix=match_prefix,
        tail=tail,
        times=_resolve_times(since, until),
        timestamps=timestamps,
        ansi=ansi,
        text=format == "text",
    )


# --- retry policy -----------------------------------------------------------

_ErrorKind = Literal["stop", "failure", "expired"]


def _classify_error(error: Exception) -> _ErrorKind:
    if isinstance(error, LogAccessError):
        if error.from_stream_body:
            return "stop"
        status = error.http_status
        if status is None:
            # Gateway errors inside a 200 stream are transient; client-side and other
            # body errors (invalid record, composition, container resolution) are final.
            return "failure" if isinstance(error, _GatewayStreamError) else "stop"
        if status == 401 and error.code == "ERR-17-003":
            return "expired"
        if error.code in ("ERR-17-002", "ERR-17-011") or status == 429 or status >= 500:
            return "failure"
        return "stop"
    if isinstance(error, ApiError):
        return "failure" if error.status_code == 429 or error.status_code >= 500 else "stop"
    if isinstance(error, httpx.RequestError | OSError):
        return "failure"
    return "stop"


class _RetryPolicy:
    """Counters and reconnect decisions for one follow session."""

    def __init__(self, *, stops_on_empty_ends: bool) -> None:
        self._stops_on_empty_ends = stops_on_empty_ends
        self._failures = 0
        self._expired_retries = 0
        self._empty_ends = 0

    def after_clean_end(self, *, delivered: bool, duration: float) -> float:
        """Delay before reconnecting; raises when quick empty ends repeat."""
        self._expired_retries = 0
        if delivered:
            self._failures = 0
            self._empty_ends = 0
            return 0.0
        if duration >= EMPTY_STREAM_QUIET_SECONDS:
            self._empty_ends = 0
            return 0.0
        self._empty_ends += 1
        if self._stops_on_empty_ends and self._empty_ends >= _MAX_EMPTY_ENDS:
            raise LogAccessError(_EMPTY_STREAM_END_MESSAGE, from_stream_body=True)
        return _backoff_delay(self._empty_ends)

    def after_error(self, error: Exception, *, delivered: bool) -> float | None:
        """Delay before reconnecting, or None when the error must be raised."""
        self._empty_ends = 0
        kind = _classify_error(error)
        if kind == "stop":
            return None
        if kind == "expired":
            self._expired_retries += 1
            return None if self._expired_retries > _MAX_EXPIRED_RETRIES else 0.0
        if delivered:
            self._failures = 0
            self._expired_retries = 0
        self._failures += 1
        if self._failures >= _MAX_CONSECUTIVE_FAILURES:
            return None
        return _backoff_delay(self._failures)


# --- drivers ----------------------------------------------------------------


def _log_headers(user_agent: str | None) -> dict[str, str]:
    return {"User-Agent": user_agent or default_user_agent()}


@contextmanager
def _sync_log_client(log_http: httpx.Client | None) -> Iterator[httpx.Client]:
    if log_http is not None:
        yield log_http
        return
    with httpx.Client(timeout=None, follow_redirects=False) as client:
        yield client


@asynccontextmanager
async def _async_log_client(log_http: httpx.AsyncClient | None) -> AsyncIterator[httpx.AsyncClient]:
    if log_http is not None:
        yield log_http
        return
    async with httpx.AsyncClient(timeout=None, follow_redirects=False) as client:
        yield client


@dataclass
class _Connection:
    delivered: bool = False
    connected_at: float = 0.0


class LogFollowIterator(Generic[T]):
    """Iterator over a followed log stream.

    ``close()`` stops it promptly, including from another thread while it waits
    to reconnect. Also usable as a context manager.
    """

    def __init__(self, start: Callable[[threading.Event], Iterator[T]]) -> None:
        self._stop = threading.Event()
        self._iterator = start(self._stop)

    def __iter__(self) -> LogFollowIterator[T]:
        return self

    def __next__(self) -> T:
        return next(self._iterator)

    def close(self) -> None:
        self._stop.set()
        close = getattr(self._iterator, "close", None)
        if close is None:
            return
        try:
            close()
        except ValueError:
            # Running in another thread: it returns at its next wait or record.
            pass

    def __enter__(self) -> LogFollowIterator[T]:
        return self

    def __exit__(self, *_: object) -> None:
        self.close()


def _follow_sync(
    plan: _FollowPlan[T],
    api_get: SyncApiGet,
    log_http: httpx.Client | None,
    headers: dict[str, str],
    stop: threading.Event,
) -> Iterator[T]:
    retry = _RetryPolicy(stops_on_empty_ends=plan.stops_on_empty_ends)
    with _sync_log_client(log_http) as client:
        while not stop.is_set():
            started_at = _monotonic()
            conn = _Connection()
            try:
                url = _run_lookup(plan.lookup(), api_get)
                with client.stream("GET", url, headers=headers, timeout=None) as response:
                    if not response.is_success:
                        response.read()
                        raise _http_error(response)
                    conn.connected_at = _monotonic()
                    plan.on_connected(_wall_clock())
                    decoder = plan.decoder()
                    for chunk in response.iter_text():
                        for item in decoder.feed(chunk):
                            if stop.is_set():
                                return
                            conn.delivered = True
                            yield item
                    for item in decoder.finish():
                        if stop.is_set():
                            return
                        conn.delivered = True
                        yield item
            except Exception as error:
                if stop.is_set():
                    return
                delay = retry.after_error(error, delivered=conn.delivered)
                if delay is None:
                    raise
            else:
                if plan.window_reached(_wall_clock()):
                    return
                delay = retry.after_clean_end(
                    delivered=conn.delivered, duration=_monotonic() - conn.connected_at
                )
            delay = _reconnect_delay(delay, started_at)
            if delay > 0 and _wait_sync(stop, delay):
                return


async def _follow_async(
    plan: _FollowPlan[T],
    api_get: AsyncApiGet,
    log_http: httpx.AsyncClient | None,
    headers: dict[str, str],
) -> AsyncGenerator[T, None]:
    retry = _RetryPolicy(stops_on_empty_ends=plan.stops_on_empty_ends)
    async with _async_log_client(log_http) as client:
        while True:
            started_at = _monotonic()
            conn = _Connection()
            try:
                url = await _arun_lookup(plan.lookup(), api_get)
                async with client.stream("GET", url, headers=headers, timeout=None) as response:
                    if not response.is_success:
                        await response.aread()
                        raise _http_error(response)
                    conn.connected_at = _monotonic()
                    plan.on_connected(_wall_clock())
                    decoder = plan.decoder()
                    async for chunk in response.aiter_text():
                        for item in decoder.feed(chunk):
                            conn.delivered = True
                            yield item
                    for item in decoder.finish():
                        conn.delivered = True
                        yield item
            except Exception as error:
                delay = retry.after_error(error, delivered=conn.delivered)
                if delay is None:
                    raise
            else:
                if plan.window_reached(_wall_clock()):
                    return
                delay = retry.after_clean_end(
                    delivered=conn.delivered, duration=_monotonic() - conn.connected_at
                )
            delay = _reconnect_delay(delay, started_at)
            if delay > 0:
                await _wait_async(delay)


# --- public API -------------------------------------------------------------


def fetch_cvm_logs(
    *,
    api_get: SyncApiGet,
    log_http: httpx.Client | None = None,
    cvm_id: str,
    source: CvmLogSource,
    tail: int | str | None = None,
    since: str | int | None = None,
    until: str | int | None = None,
    timestamps: bool = False,
    ansi: bool = False,
    format: CvmLogFormat | None = None,
    container_match_prefix: bool = True,
    user_agent: str | None = None,
) -> str | list[CvmLogEntry]:
    plan = _fetch_plan(
        cvm_id=cvm_id,
        source=source,
        tail=tail,
        since=since,
        until=until,
        timestamps=timestamps,
        ansi=ansi,
        format=format,
        container_match_prefix=container_match_prefix,
    )
    url = _run_lookup(plan.lookup(), api_get)
    with _sync_log_client(log_http) as client:
        response = client.get(url, headers=_log_headers(user_agent), timeout=None)
    if not response.is_success:
        raise _http_error(response)
    return plan.decode(response.text)


async def afetch_cvm_logs(
    *,
    api_get: AsyncApiGet,
    log_http: httpx.AsyncClient | None = None,
    cvm_id: str,
    source: CvmLogSource,
    tail: int | str | None = None,
    since: str | int | None = None,
    until: str | int | None = None,
    timestamps: bool = False,
    ansi: bool = False,
    format: CvmLogFormat | None = None,
    container_match_prefix: bool = True,
    user_agent: str | None = None,
) -> str | list[CvmLogEntry]:
    plan = _fetch_plan(
        cvm_id=cvm_id,
        source=source,
        tail=tail,
        since=since,
        until=until,
        timestamps=timestamps,
        ansi=ansi,
        format=format,
        container_match_prefix=container_match_prefix,
    )
    url = await _arun_lookup(plan.lookup(), api_get)
    async with _async_log_client(log_http) as client:
        response = await client.get(url, headers=_log_headers(user_agent), timeout=None)
    if not response.is_success:
        raise _http_error(response)
    return plan.decode(response.text)


def follow_cvm_logs(
    *,
    api_get: SyncApiGet,
    log_http: httpx.Client | None = None,
    cvm_id: str,
    source: CvmLogSource,
    tail: int | str | None = None,
    since: str | int | None = None,
    until: str | int | None = None,
    timestamps: bool = False,
    ansi: bool = False,
    format: CvmLogFormat | None = None,
    container_match_prefix: bool = True,
    user_agent: str | None = None,
) -> LogFollowIterator[str | CvmLogEntry]:
    """Follow a log stream. Node and container text yield lines; container NDJSON yields entries."""
    plan = _follow_plan(
        cvm_id=cvm_id,
        source=source,
        tail=tail,
        since=since,
        until=until,
        timestamps=timestamps,
        ansi=ansi,
        format=format,
        container_match_prefix=container_match_prefix,
    )
    headers = _log_headers(user_agent)
    return LogFollowIterator(lambda stop: _follow_sync(plan, api_get, log_http, headers, stop))


def afollow_cvm_logs(
    *,
    api_get: AsyncApiGet,
    log_http: httpx.AsyncClient | None = None,
    cvm_id: str,
    source: CvmLogSource,
    tail: int | str | None = None,
    since: str | int | None = None,
    until: str | int | None = None,
    timestamps: bool = False,
    ansi: bool = False,
    format: CvmLogFormat | None = None,
    container_match_prefix: bool = True,
    user_agent: str | None = None,
) -> AsyncGenerator[str | CvmLogEntry, None]:
    """Async variant of follow_cvm_logs; stop it with aclose() or task cancellation."""
    plan = _follow_plan(
        cvm_id=cvm_id,
        source=source,
        tail=tail,
        since=since,
        until=until,
        timestamps=timestamps,
        ansi=ansi,
        format=format,
        container_match_prefix=container_match_prefix,
    )
    return _follow_async(plan, api_get, log_http, _log_headers(user_agent))


# Single-purpose wrappers kept for existing callers.


def fetch_cvm_channel_logs(
    *,
    api_get: SyncApiGet,
    log_http: httpx.Client | None = None,
    cvm_id: str,
    channel: CvmLogChannel,
    tail: int | str | None = None,
    since: str | int | None = None,
    until: str | int | None = None,
    timestamps: bool = False,
    ansi: bool = False,
    format: CvmLogFormat | None = None,
) -> str:
    text = fetch_cvm_logs(
        api_get=api_get,
        log_http=log_http,
        cvm_id=cvm_id,
        source={"type": "node", "channel": channel},
        tail=tail,
        since=since,
        until=until,
        timestamps=timestamps,
        ansi=ansi,
        format=format,
    )
    return cast(str, text)


def follow_cvm_channel_logs(
    *,
    api_get: SyncApiGet,
    log_http: httpx.Client | None = None,
    cvm_id: str,
    channel: CvmLogChannel,
    tail: int | str | None = None,
    since: str | int | None = None,
    until: str | int | None = None,
    timestamps: bool = False,
    ansi: bool = False,
    format: CvmLogFormat | None = None,
) -> LogFollowIterator[str | CvmLogEntry]:
    return follow_cvm_logs(
        api_get=api_get,
        log_http=log_http,
        cvm_id=cvm_id,
        source={"type": "node", "channel": channel},
        tail=tail,
        since=since,
        until=until,
        timestamps=timestamps,
        ansi=ansi,
        format=format,
    )


def fetch_container_log_entries(
    *,
    api_get: SyncApiGet,
    log_http: httpx.Client | None = None,
    cvm_id: str,
    container: str | None = None,
    match_prefix: bool = True,
    tail: int | str | None = None,
    since: str | int | None = None,
    until: str | int | None = None,
    timestamps: bool = False,
    ansi: bool = False,
) -> list[CvmLogEntry]:
    source: ContainerLogSource = {"type": "container", "matchContainerIdPrefix": match_prefix}
    if container:
        source["name"] = container
    entries = fetch_cvm_logs(
        api_get=api_get,
        log_http=log_http,
        cvm_id=cvm_id,
        source=source,
        tail=tail,
        since=since,
        until=until,
        timestamps=timestamps,
        ansi=ansi,
        format="ndjson",
    )
    return cast(list[CvmLogEntry], entries)


def follow_container_log_entries(
    *,
    api_get: SyncApiGet,
    log_http: httpx.Client | None = None,
    cvm_id: str,
    container: str | None = None,
    match_prefix: bool = True,
    tail: int | str | None = None,
    since: str | int | None = None,
    until: str | int | None = None,
    timestamps: bool = False,
    ansi: bool = False,
) -> LogFollowIterator[str | CvmLogEntry]:
    source: ContainerLogSource = {"type": "container", "matchContainerIdPrefix": match_prefix}
    if container:
        source["name"] = container
    return follow_cvm_logs(
        api_get=api_get,
        log_http=log_http,
        cvm_id=cvm_id,
        source=source,
        tail=tail,
        since=since,
        until=until,
        timestamps=timestamps,
        ansi=ansi,
        format="ndjson",
    )
