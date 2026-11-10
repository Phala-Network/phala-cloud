from __future__ import annotations

import json
import re
import time
from collections.abc import Callable, Iterator, Mapping
from typing import Any, Literal, TypedDict
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import httpx

from .errors import ResourceError
from .log_time import _parse_rfc3339, resolve_log_time_window

__all__ = [
    "CvmLogEntry",
    "CvmLogSource",
    "LogAccessError",
    "fetch_cvm_logs",
    "follow_cvm_logs",
    "resolve_log_time_window",
]

# API version that introduced CVMInfo.logs. Pinned so older clients still get URLs.
CVM_LOGS_INFO_API_VERSION = "2026-01-21"

CvmLogChannel = Literal["serial", "stdout", "stderr"]
CvmLogFormat = Literal["text", "ndjson"]
LogChannel = Literal["stdout", "stderr"]


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


_LOG_ERROR_HTTP_STATUS = {
    "ERR-17-001": 400,
    "ERR-17-002": 401,
    "ERR-17-003": 401,
    "ERR-17-004": 404,
    "ERR-17-005": 409,
    "ERR-17-006": 409,
    "ERR-17-007": 404,
    "ERR-17-008": 502,
    "ERR-17-009": 502,
    "ERR-17-010": 504,
    "ERR-17-011": 429,
    "ERR-17-012": 503,
    "ERR-17-013": 404,
}


class LogAccessError(ResourceError):
    """Structured log-gateway error."""

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        http_status: int | None = None,
        suggestions: list[str] | None = None,
        from_stream_body: bool = False,
    ) -> None:
        if from_stream_body:
            status = 0
        else:
            status = http_status or (code and _LOG_ERROR_HTTP_STATUS.get(code)) or 0
        details = message
        if suggestions:
            details += "\nSuggestions:\n" + "\n".join(f"- {item}" for item in suggestions)
        super().__init__(
            status_code=status,
            message=details,
            code=code,
            error_code=code,
            suggestions=suggestions,
        )
        self.http_status = status or None
        self.from_stream_body = from_stream_body


def _build_log_url(base_url: str, options: Mapping[str, Any]) -> str:
    params: list[tuple[str, str]] = []
    if options.get("since") is not None:
        params.append(("since", str(options["since"])))
    if options.get("until") is not None:
        params.append(("until", str(options["until"])))
    if options.get("follow"):
        params.append(("follow", "true"))
    if options.get("tail") is not None:
        params.append(("tail", str(options["tail"])))
    if options.get("timestamps"):
        params.append(("timestamps", "true"))
    if options.get("ansi"):
        params.append(("ansi", "true"))
    if options.get("format"):
        params.append(("format", str(options["format"])))
    if not params:
        return base_url
    parts = urlsplit(base_url)
    query = urlencode(list(parse_qsl(parts.query, keep_blank_values=True)) + params)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, query, parts.fragment))


def _raise_response_error(response: httpx.Response) -> None:
    try:
        envelope = response.json()
    except Exception:
        envelope = {}
    if not isinstance(envelope, dict):
        envelope = {}
    suggestions = [item for item in envelope.get("suggestions") or [] if isinstance(item, str)]
    raise LogAccessError(
        str(envelope.get("message") or f"HTTP {response.status_code}"),
        code=envelope.get("error_code") if isinstance(envelope.get("error_code"), str) else None,
        http_status=response.status_code,
        suggestions=suggestions,
    )


def _throw_text_stream_error(line: str) -> None:
    match = re.match(r"^\[error\] (ERR-17-\d{3}) (.*)$", line.strip())
    if match:
        raise LogAccessError(match.group(2), code=match.group(1))


def _parse_timestamped_message(message: str) -> dict[str, Any]:
    match = re.match(
        r"^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})) (.*)$",
        message,
        re.S,
    )
    if not match:
        return {}
    stamp = match.group(1)
    parsed_ms = _parse_rfc3339(stamp)
    if parsed_ms is None:
        return {}
    return {
        "timestamp": stamp,
        "second": int(parsed_ms // 1000),
        "message": match.group(2),
    }


def _guest_agent_error_message(text: str) -> str | None:
    trimmed = text.strip()
    if not trimmed:
        return None
    try:
        parsed = json.loads(trimmed)
    except json.JSONDecodeError:
        return None
    if not isinstance(parsed, dict):
        return None
    if isinstance(parsed.get("error"), str) and "channel" not in parsed and "message" not in parsed:
        return parsed["error"]
    return None


def _throw_if_guest_agent_error(text: str) -> None:
    message = _guest_agent_error_message(text)
    if message is not None:
        raise LogAccessError(message, code="ERR-17-009", from_stream_body=True)


_EMPTY_STREAM_END_MESSAGE = (
    "log stream keeps ending without new output; the container may have stopped"
)


def _note_empty_stream_end(empty_ends: int) -> int:
    empty_ends += 1
    if empty_ends >= 5:
        raise LogAccessError(_EMPTY_STREAM_END_MESSAGE, from_stream_body=True)
    time.sleep(min(0.25 * 2 ** (empty_ends - 1), 5))
    return empty_ends


def _parse_ndjson_line(line: str) -> CvmLogEntry | None:
    trimmed = line.strip()
    if not trimmed:
        return None
    try:
        parsed = json.loads(trimmed)
    except json.JSONDecodeError as exc:
        raise LogAccessError("Invalid NDJSON log record.") from exc
    guest = _guest_agent_error_message(trimmed)
    if guest is not None:
        raise LogAccessError(guest, code="ERR-17-009", from_stream_body=True)
    if isinstance(parsed.get("error_code"), str):
        suggestions = [item for item in parsed.get("suggestions") or [] if isinstance(item, str)]
        raise LogAccessError(
            str(parsed.get("message") or "The log stream ended with an error."),
            code=parsed["error_code"],
            suggestions=suggestions,
        )
    if parsed.get("channel") not in {"stdout", "stderr"} or not isinstance(
        parsed.get("message"), str
    ):
        raise LogAccessError("Invalid NDJSON log record.")
    return {"channel": parsed["channel"], "message": parsed["message"]}


def _parse_ndjson_entries(text: str) -> list[CvmLogEntry]:
    entries: list[CvmLogEntry] = []
    for line in text.splitlines():
        entry = _parse_ndjson_line(line)
        if entry:
            entries.append(entry)
    return entries


def _assert_node_options(options: Mapping[str, Any]) -> None:
    unsupported = [
        name
        for name, present in (
            ("timestamps", options.get("timestamps")),
            ("since", options.get("since") is not None),
            ("until", options.get("until") is not None),
            ("format=ndjson", options.get("format") == "ndjson"),
        )
        if present
    ]
    if unsupported:
        raise ValueError(f"{', '.join(unsupported)} not supported for serial/stdout/stderr logs")


def _get_node_endpoint(api_get: Callable[[str], Any], cvm_id: str, channel: CvmLogChannel) -> str:
    info = api_get(f"/cvms/{cvm_id}")
    endpoint = (info.get("logs") or {}).get(channel)
    if not endpoint:
        raise ValueError(f"No {channel} log endpoint available for CVM '{cvm_id}'")
    return str(endpoint)


def _container_logs_disabled() -> LogAccessError:
    return LogAccessError(
        "Container logs are disabled",
        code="ERR-17-006",
        http_status=409,
    )


def _assert_container_logs_enabled(api_get: Callable[[str], Any], cvm_id: str) -> None:
    info = api_get(f"/cvms/{cvm_id}")
    if isinstance(info, dict) and info.get("public_logs") is False:
        raise _container_logs_disabled()


def _get_container_endpoint(
    api_get: Callable[[str], Any],
    cvm_id: str,
    container_name: str | None = None,
    match_prefix: bool = True,
) -> str:
    composition = api_get(f"/cvms/{cvm_id}/composition")
    containers = composition.get("containers") or []
    if not containers:
        raise ValueError(f"No containers found for CVM '{cvm_id}'")
    if container_name:
        containers = [
            item
            for item in containers
            if container_name in (item.get("names") or [])
            or f"/{container_name}" in (item.get("names") or [])
            or (match_prefix and str(item.get("id") or "").startswith(container_name))
        ]
        if not containers:
            raise ValueError(f"Container '{container_name}' not found in CVM '{cvm_id}'")
    container = next((item for item in containers if item.get("log_endpoint")), None)
    if not container or not container.get("log_endpoint"):
        raise ValueError(f"No log endpoints available for CVM '{cvm_id}'")
    return str(container["log_endpoint"])


def _error_http_status(error: BaseException) -> int | None:
    if isinstance(error, LogAccessError):
        return error.http_status
    return None


def _iter_follow_responses(
    resolve_url: Callable[[], str],
    log_http: httpx.Client,
    refresh: Callable[[], None] | None = None,
) -> Iterator[httpx.Response]:
    failure_count = 0
    expired_retries = 0
    while True:
        try:
            url = resolve_url()
            with log_http.stream("GET", url, timeout=None) as response:
                if response.status_code >= 400:
                    response.read()
                    _raise_response_error(response)
                failure_count = 0
                yield response
                expired_retries = 0
        except LogAccessError as error:
            if error.from_stream_body:
                raise
            if error.code == "ERR-17-003":
                expired_retries += 1
                if expired_retries > 3:
                    raise
                if refresh is not None:
                    refresh()
                continue
            status = error.http_status
            if status is not None and status < 500:
                raise
            if status is None:
                raise
            failure_count += 1
            if failure_count >= 5:
                raise
            time.sleep(min(0.25 * 2 ** (failure_count - 1), 5))
        except (httpx.HTTPError, OSError):
            failure_count += 1
            if failure_count >= 5:
                raise
            time.sleep(min(0.25 * 2 ** (failure_count - 1), 5))


def _consume_node_text(response: httpx.Response, on_data: Callable[[str], None]) -> None:
    buffer = ""
    for chunk in response.iter_text():
        buffer += chunk
        while "\n" in buffer:
            line, buffer = buffer.split("\n", 1)
            content = line
            if content not in {"[vmm heartbeat]", "[teepod heartbeat]"}:
                _throw_text_stream_error(content)
                on_data(line + "\n")
    if buffer and buffer not in {"[vmm heartbeat]", "[teepod heartbeat]"}:
        _throw_text_stream_error(buffer)
        on_data(buffer)


def fetch_cvm_channel_logs(
    *,
    api_get: Callable[[str], Any],
    log_http: httpx.Client,
    cvm_id: str,
    channel: CvmLogChannel,
    tail: int | str | None = None,
    since: str | int | None = None,
    until: str | int | None = None,
    timestamps: bool = False,
    ansi: bool = False,
    format: CvmLogFormat | None = None,
) -> str:
    _assert_node_options(
        {
            "timestamps": timestamps,
            "since": since,
            "until": until,
            "format": format,
        }
    )
    url = _build_log_url(_get_node_endpoint(api_get, cvm_id, channel), {"tail": tail, "ansi": ansi})
    response = log_http.get(url, timeout=None)
    if response.status_code >= 400:
        _raise_response_error(response)
    return response.text


def follow_cvm_channel_logs(
    *,
    api_get: Callable[[str], Any],
    log_http: httpx.Client,
    cvm_id: str,
    channel: CvmLogChannel,
    tail: int | str | None = None,
    since: str | int | None = None,
    until: str | int | None = None,
    timestamps: bool = False,
    ansi: bool = False,
    format: CvmLogFormat | None = None,
) -> Iterator[str]:
    _assert_node_options(
        {
            "timestamps": timestamps,
            "since": since,
            "until": until,
            "format": format,
        }
    )
    first = True

    def resolve_url() -> str:
        nonlocal first
        current_tail: int | str | None = tail if first else 0
        first = False
        return _build_log_url(
            _get_node_endpoint(api_get, cvm_id, channel),
            {"tail": current_tail, "follow": True, "ansi": ansi},
        )

    for response in _iter_follow_responses(
        resolve_url, log_http, refresh=lambda: api_get(f"/cvms/{cvm_id}")
    ):
        buffer = ""
        for chunk in response.iter_text():
            buffer += chunk
            while "\n" in buffer:
                line, buffer = buffer.split("\n", 1)
                if line not in {"[vmm heartbeat]", "[teepod heartbeat]"}:
                    _throw_text_stream_error(line)
                    yield line + "\n"
        if buffer and buffer not in {"[vmm heartbeat]", "[teepod heartbeat]"}:
            _throw_text_stream_error(buffer)
            yield buffer


def fetch_container_log_entries(
    *,
    api_get: Callable[[str], Any],
    log_http: httpx.Client,
    cvm_id: str,
    container: str | None = None,
    match_prefix: bool = True,
    tail: int | str | None = None,
    since: str | int | None = None,
    until: str | int | None = None,
    timestamps: bool = False,
    ansi: bool = False,
    log_format: CvmLogFormat = "ndjson",
) -> list[CvmLogEntry]:
    times = resolve_log_time_window(since, until)
    _assert_container_logs_enabled(api_get, cvm_id)
    url = _build_log_url(
        _get_container_endpoint(api_get, cvm_id, container, match_prefix),
        {**times, "tail": tail, "timestamps": timestamps, "ansi": ansi, "format": log_format},
    )
    response = log_http.get(url, timeout=None)
    if response.status_code >= 400:
        _raise_response_error(response)
    return _parse_ndjson_entries(response.text)


def follow_container_log_entries(
    *,
    api_get: Callable[[str], Any],
    log_http: httpx.Client,
    cvm_id: str,
    container: str | None = None,
    match_prefix: bool = True,
    tail: int | str | None = None,
    since: str | int | None = None,
    until: str | int | None = None,
    timestamps: bool = False,
) -> Iterator[CvmLogEntry]:
    times = resolve_log_time_window(since, until)
    _assert_container_logs_enabled(api_get, cvm_id)
    state = {
        "since": times.get("since"),
        "boundary_second": None,
        "boundary_counts": {},
        "replay_counts": {},
        "first": True,
    }

    def resolve_url() -> str:
        current_tail = tail if state["first"] else None
        state["first"] = False
        state["replay_counts"] = dict(state["boundary_counts"])
        return _build_log_url(
            _get_container_endpoint(api_get, cvm_id, container, match_prefix),
            {
                "since": state["since"],
                "until": times.get("until"),
                "tail": current_tail,
                "follow": True,
                "timestamps": True,
                "format": "ndjson",
            },
        )

    def emit(line: str) -> CvmLogEntry | None:
        entry = _parse_ndjson_line(line)
        if not entry:
            return None
        parsed = _parse_timestamped_message(entry["message"])
        formatted: CvmLogEntry = (
            entry
            if timestamps
            else {
                "channel": entry["channel"],
                "message": parsed["message"] if parsed.get("timestamp") else entry["message"],
            }
        )
        second = parsed.get("second")
        if second is None or not parsed.get("timestamp"):
            return formatted
        key = json.dumps([entry["channel"], entry["message"]])
        boundary_second = state["boundary_second"]
        replay_counts: dict[str, int] = state["replay_counts"]  # type: ignore[assignment]
        boundary_counts: dict[str, int] = state["boundary_counts"]  # type: ignore[assignment]
        if boundary_second is not None and second < boundary_second:
            return formatted
        if second == boundary_second:
            replay = replay_counts.get(key, 0)
            if replay > 0:
                replay_counts[key] = replay - 1
                return None
        elif boundary_second is None or second > boundary_second:
            state["boundary_second"] = second
            boundary_counts.clear()
        state["since"] = max(state["since"] or second, second)
        boundary_counts[key] = boundary_counts.get(key, 0) + 1
        return formatted

    empty_ends = 0
    for response in _iter_follow_responses(
        resolve_url, log_http, refresh=lambda: _assert_container_logs_enabled(api_get, cvm_id)
    ):
        delivered = 0
        buffer = ""
        for chunk in response.iter_text():
            buffer += chunk
            while "\n" in buffer:
                line, buffer = buffer.split("\n", 1)
                item = emit(line)
                if item is not None:
                    delivered += 1
                    yield item
        if buffer.strip():
            item = emit(buffer)
            if item is not None:
                delivered += 1
                yield item
        if delivered:
            empty_ends = 0
        else:
            empty_ends = _note_empty_stream_end(empty_ends)


def _follow_container_text(
    *,
    api_get: Callable[[str], Any],
    log_http: httpx.Client,
    cvm_id: str,
    container: str | None,
    match_prefix: bool,
    tail: int | str | None,
    since: str | int | None,
    until: str | int | None,
    timestamps: bool,
    ansi: bool,
) -> Iterator[str]:
    times = resolve_log_time_window(since, until)
    _assert_container_logs_enabled(api_get, cvm_id)
    state: dict[str, Any] = {
        "since": times.get("since"),
        "boundary_second": None,
        "boundary_counts": {},
        "replay_counts": {},
        "first": True,
    }

    def resolve_url() -> str:
        current_tail = tail if state["first"] else None
        state["first"] = False
        state["replay_counts"] = dict(state["boundary_counts"])
        return _build_log_url(
            _get_container_endpoint(api_get, cvm_id, container, match_prefix),
            {
                "since": state["since"],
                "until": times.get("until"),
                "tail": current_tail,
                "follow": True,
                "timestamps": True,
                "ansi": ansi,
                "format": "text",
            },
        )

    def emit_line(line: str) -> str | None:
        _throw_if_guest_agent_error(line)
        parsed = _parse_timestamped_message(line)
        out = line if timestamps else (parsed["message"] if parsed.get("timestamp") else line)
        second = parsed.get("second")
        if second is None or not parsed.get("timestamp"):
            return out
        key = line
        boundary_second = state["boundary_second"]
        replay_counts: dict[str, int] = state["replay_counts"]
        boundary_counts: dict[str, int] = state["boundary_counts"]
        if boundary_second is not None and second < boundary_second:
            return out
        if second == boundary_second:
            replay = replay_counts.get(key, 0)
            if replay > 0:
                replay_counts[key] = replay - 1
                return None
        elif boundary_second is None or second > boundary_second:
            state["boundary_second"] = second
            boundary_counts.clear()
        state["since"] = max(state["since"] or second, second)
        boundary_counts[key] = boundary_counts.get(key, 0) + 1
        return out

    empty_ends = 0
    for response in _iter_follow_responses(
        resolve_url, log_http, refresh=lambda: _assert_container_logs_enabled(api_get, cvm_id)
    ):
        delivered = 0
        buffer = ""
        for chunk in response.iter_text():
            buffer += chunk
            while "\n" in buffer:
                line, buffer = buffer.split("\n", 1)
                item = emit_line(line)
                if item is not None:
                    delivered += 1
                    yield item + "\n"
        if buffer:
            item = emit_line(buffer)
            if item is not None:
                delivered += 1
                yield item
        if delivered:
            empty_ends = 0
        else:
            empty_ends = _note_empty_stream_end(empty_ends)


def fetch_cvm_logs(
    *,
    api_get: Callable[[str], Any],
    log_http: httpx.Client,
    cvm_id: str,
    source: CvmLogSource,
    tail: int | str | None = None,
    since: str | int | None = None,
    until: str | int | None = None,
    timestamps: bool = False,
    ansi: bool = False,
    format: CvmLogFormat = "text",
    container_match_prefix: bool = True,
) -> str | list[CvmLogEntry]:
    if source["type"] == "node":
        return fetch_cvm_channel_logs(
            api_get=api_get,
            log_http=log_http,
            cvm_id=cvm_id,
            channel=source["channel"],
            tail=tail,
            since=since,
            until=until,
            timestamps=timestamps,
            ansi=ansi,
            format=format,
        )
    if format == "ndjson":
        return fetch_container_log_entries(
            api_get=api_get,
            log_http=log_http,
            cvm_id=cvm_id,
            container=source.get("name"),
            match_prefix=source.get("matchContainerIdPrefix", container_match_prefix),
            tail=tail,
            since=since,
            until=until,
            timestamps=timestamps,
            ansi=ansi,
            log_format="ndjson",
        )
    times = resolve_log_time_window(since, until)
    _assert_container_logs_enabled(api_get, cvm_id)
    url = _build_log_url(
        _get_container_endpoint(
            api_get,
            cvm_id,
            source.get("name"),
            source.get("matchContainerIdPrefix", container_match_prefix),
        ),
        {**times, "tail": tail, "timestamps": timestamps, "ansi": ansi, "format": "text"},
    )
    response = log_http.get(url, timeout=None)
    if response.status_code >= 400:
        _raise_response_error(response)
    text = response.text
    _throw_if_guest_agent_error(text)
    return text


def follow_cvm_logs(
    *,
    api_get: Callable[[str], Any],
    log_http: httpx.Client,
    cvm_id: str,
    source: CvmLogSource,
    tail: int | str | None = None,
    since: str | int | None = None,
    until: str | int | None = None,
    timestamps: bool = False,
    ansi: bool = False,
    format: CvmLogFormat | None = None,
    container_match_prefix: bool = True,
) -> Iterator[str | CvmLogEntry]:
    if source["type"] == "node":
        yield from follow_cvm_channel_logs(
            api_get=api_get,
            log_http=log_http,
            cvm_id=cvm_id,
            channel=source["channel"],
            tail=tail,
            since=since,
            until=until,
            timestamps=timestamps,
            ansi=ansi,
            format=format,
        )
        return
    if format == "text":
        yield from _follow_container_text(
            api_get=api_get,
            log_http=log_http,
            cvm_id=cvm_id,
            container=source.get("name"),
            match_prefix=source.get("matchContainerIdPrefix", container_match_prefix),
            tail=tail,
            since=since,
            until=until,
            timestamps=timestamps,
            ansi=ansi,
        )
        return
    yield from follow_container_log_entries(
        api_get=api_get,
        log_http=log_http,
        cvm_id=cvm_id,
        container=source.get("name"),
        match_prefix=source.get("matchContainerIdPrefix", container_match_prefix),
        tail=tail,
        since=since,
        until=until,
        timestamps=timestamps,
    )
