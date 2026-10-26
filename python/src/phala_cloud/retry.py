"""Read retry policy shared by the synchronous and asynchronous clients."""

from __future__ import annotations

import asyncio
import math
import threading
import time
from collections.abc import Mapping
from datetime import timezone
from email.utils import parsedate_to_datetime
from typing import Any

import httpx
from tenacity import AsyncRetrying, Retrying, retry_if_result, stop_after_attempt, wait_exponential
from tenacity.nap import sleep, sleep_using_event

from .errors import RequestError

DEFAULT_MAX_RETRIES = 30
MAX_RETRY_DELAY = 20.0
# Match Go's maximum representable time.Duration; never overflow a server wait.
MAX_SERVER_DELAY = (2**63 - 1) / 1_000_000_000


def validate_retries(value: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError("max_retries must be a non-negative integer")
    return value


def retryable_response(response: httpx.Response) -> bool:
    if response.status_code not in (409, 429, 503):
        return False
    if response.status_code == 409:
        try:
            body = response.json()
        except ValueError:
            body = None
        if (
            isinstance(body, dict)
            and isinstance(body.get("error_code"), str)
            and body["error_code"]
        ):
            return False
    return True


def server_delay(response: httpx.Response) -> float | None:
    header = response.headers.get("Retry-After", "").strip()
    if header.isascii() and header.isdecimal():
        # Comparing decimal strings avoids Python's integer string length limit.
        significant = header.lstrip("0") or "0"
        if len(significant) > 10:
            return MAX_SERVER_DELAY
        seconds = min(float(significant), MAX_SERVER_DELAY)
        if seconds > 0:
            return seconds
    elif header:
        try:
            date = parsedate_to_datetime(header)
            if date.tzinfo is None:
                date = date.replace(tzinfo=timezone.utc)
            seconds = date.timestamp() - time.time()
            if seconds > 0:
                return min(seconds, MAX_SERVER_DELAY)
        except (ValueError, TypeError, OverflowError):
            pass
    return None


def replayable_read(method: str, kwargs: Mapping[str, Any]) -> bool:
    if method.upper() not in ("GET", "HEAD") or kwargs.get("files"):
        return False
    # An iterator or file cannot be replayed after HTTPX consumes it.
    content = kwargs.get("content")
    return (content is None or isinstance(content, (str, bytes))) and not kwargs.get("data")


class RetryContext:
    def __init__(
        self,
        max_retries: int,
        operation_timeout: float | None,
        cancel_event: threading.Event | asyncio.Event | None,
        *,
        asynchronous: bool = False,
    ) -> None:
        self.max_retries = validate_retries(max_retries)
        self.asynchronous = asynchronous
        event_type = asyncio.Event if asynchronous else threading.Event
        if cancel_event is not None and not isinstance(cancel_event, event_type):
            raise TypeError(f"cancel_event must be a {event_type.__module__}.Event")
        if operation_timeout is not None and (
            not math.isfinite(operation_timeout) or operation_timeout <= 0
        ):
            raise ValueError("operation_timeout must be positive and finite")
        self.deadline = None if operation_timeout is None else time.monotonic() + operation_timeout
        self.cancel_event = cancel_event

    def policy(self, can_retry: bool) -> Retrying | AsyncRetrying:
        exponential = wait_exponential(multiplier=1, max=MAX_RETRY_DELAY)

        def wait_for_response(state):
            delay = server_delay(state.outcome.result())
            return exponential(state) if delay is None else delay

        engine = AsyncRetrying if self.asynchronous else Retrying
        return engine(
            retry=retry_if_result(lambda response: can_retry and retryable_response(response)),
            stop=stop_after_attempt(self.max_retries + 1),
            wait=wait_for_response,
            sleep=self.wait_async if self.asynchronous else self.wait,
            retry_error_callback=lambda state: state.outcome.result(),
        )

    def remaining(self) -> float | None:
        if self.cancel_event is not None and self.cancel_event.is_set():
            raise RequestError("Operation cancelled")
        if self.deadline is None:
            return None
        remaining = self.deadline - time.monotonic()
        if remaining <= 0:
            raise RequestError("Operation deadline exceeded")
        return remaining

    def request_timeout(self, value: Any) -> httpx.Timeout:
        timeout = httpx.Timeout(value)
        remaining = self.remaining()
        if remaining is None:
            return timeout
        return httpx.Timeout(
            **{
                key: remaining if val is None else min(val, remaining)
                for key, val in timeout.as_dict().items()
            }
        )

    def wait(self, delay: float) -> None:
        until = time.monotonic() + delay
        while True:
            remaining = self.remaining()
            delay = until - time.monotonic()
            if delay <= 0:
                return
            step = min(delay, threading.TIMEOUT_MAX)
            if remaining is not None:
                step = min(step, remaining)
            if isinstance(self.cancel_event, threading.Event):
                sleep_using_event(self.cancel_event)(step)
            else:
                sleep(step)

    async def wait_async(self, delay: float) -> None:
        remaining = self.remaining()
        if remaining is not None:
            delay = min(delay, remaining)
        if isinstance(self.cancel_event, asyncio.Event):
            try:
                await asyncio.wait_for(self.cancel_event.wait(), timeout=delay)
            except asyncio.TimeoutError:
                pass
        else:
            await asyncio.sleep(delay)
        self.remaining()
