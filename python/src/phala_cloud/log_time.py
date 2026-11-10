from __future__ import annotations

import re
from datetime import datetime, timezone

_DURATION_SECONDS = {"s": 1, "m": 60, "h": 60 * 60, "d": 24 * 60 * 60}
_RFC3339 = re.compile(
    r"^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|([+-])(\d{2}):(\d{2}))$"
)


def _parse_rfc3339(value: str) -> float | None:
    match = _RFC3339.match(value)
    if not match:
        return None
    year, month, day, hour, minute, second = (int(match.group(i)) for i in range(1, 7))
    fraction = match.group(7)
    sign = match.group(9)
    offset_hour = int(match.group(10) or 0)
    offset_minute = int(match.group(11) or 0)
    try:
        date = datetime(year, month, day, hour, minute, second, tzinfo=timezone.utc)
    except ValueError:
        return None
    if offset_hour > 23 or offset_minute > 59:
        return None
    fractional = float(f"0.{fraction}") if fraction else 0.0
    offset = 1 if sign == "+" else -1 if sign == "-" else 0
    return (
        date.timestamp() * 1000
        + fractional * 1000
        - offset * (offset_hour * 60 + offset_minute) * 60_000
    )


def _parse_log_time(value: str, now_ms: float) -> float:
    if re.fullmatch(r"-?\d+", value):
        seconds = int(value)
        return seconds * 1000
    relative = re.fullmatch(r"(\d+)([smhd])", value)
    if relative:
        duration = int(relative.group(1)) * _DURATION_SECONDS[relative.group(2)]
        return now_ms - duration * 1000
    rfc3339 = _parse_rfc3339(value)
    if rfc3339 is not None:
        return rfc3339
    raise ValueError(
        f"Invalid log time '{value}'. Use RFC3339, Unix seconds, "
        "or a relative duration such as 10m."
    )


def resolve_log_time_window(
    since: str | int | None,
    until: str | int | None,
    now_ms: float | None = None,
) -> dict[str, int]:
    if now_ms is None:
        now_ms = datetime.now(tz=timezone.utc).timestamp() * 1000
    resolved: dict[str, int] = {}
    if since is not None:
        resolved["since"] = (
            int(since)
            if isinstance(since, int)
            else int(_parse_log_time(str(since), now_ms) // 1000)
        )
    if until is not None:
        resolved["until"] = (
            int(until)
            if isinstance(until, int)
            else int((_parse_log_time(str(until), now_ms) + 999) // 1000)
        )
    return resolved
