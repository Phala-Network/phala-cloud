from __future__ import annotations

import calendar
import math
import re
from datetime import datetime, timezone

# Largest relative duration, matching a signed 64-bit nanosecond count.
_MAX_DURATION_NANOSECONDS = 2**63 - 1
_DURATION_SECONDS = {"s": 1, "m": 60, "h": 60 * 60, "d": 24 * 60 * 60}
_RFC3339 = re.compile(
    r"^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|([+-])(\d{2}):(\d{2}))$"
)


def _parse_rfc3339(value: str) -> tuple[int, bool] | None:
    """Return (whole Unix seconds, has a non-zero fraction) without float rounding."""
    match = _RFC3339.match(value)
    if not match:
        return None
    year, month, day, hour, minute, second = (int(match.group(i)) for i in range(1, 7))
    fraction = match.group(7) or ""
    sign = match.group(9)
    offset_hour = int(match.group(10) or 0)
    offset_minute = int(match.group(11) or 0)
    try:
        date = datetime(year, month, day, hour, minute, second, tzinfo=timezone.utc)
    except ValueError:
        return None
    if offset_hour > 23 or offset_minute > 59:
        return None
    offset = 1 if sign == "+" else -1 if sign == "-" else 0
    seconds = (
        calendar.timegm(date.utctimetuple()) - offset * (offset_hour * 60 + offset_minute) * 60
    )
    return seconds, fraction.strip("0") != ""


def _parse_log_time(value: str, now_ms: float) -> tuple[int, bool]:
    """Return (floor Unix seconds, has a sub-second remainder)."""
    if re.fullmatch(r"-?\d+", value):
        return int(value), False
    relative = re.fullmatch(r"(\d+)([smhd])", value)
    if relative:
        duration = int(relative.group(1)) * _DURATION_SECONDS[relative.group(2)]
        if duration * 1_000_000_000 > _MAX_DURATION_NANOSECONDS:
            raise ValueError(f"Log time '{value}' is too far in the past.")
        total_ms = now_ms - duration * 1000
        seconds = math.floor(total_ms / 1000)
        return seconds, total_ms != seconds * 1000
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
    """Resolve since (floored) and until (ceiled) to whole Unix seconds."""
    if now_ms is None:
        now_ms = datetime.now(tz=timezone.utc).timestamp() * 1000
    resolved: dict[str, int] = {}
    if since is not None:
        resolved["since"] = (
            since if isinstance(since, int) else _parse_log_time(str(since), now_ms)[0]
        )
    if until is not None:
        if isinstance(until, int):
            resolved["until"] = until
        else:
            seconds, has_fraction = _parse_log_time(str(until), now_ms)
            resolved["until"] = seconds + 1 if has_fraction else seconds
    return resolved
