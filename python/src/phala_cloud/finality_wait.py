"""Shared logic of the sync and async `wait_for_cvm_finality`."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel
from pydantic import ValidationError as PydanticValidationError

from .errors import (
    ApiError,
    CvmFinalityOperationError,
    CvmFinalityTimeoutError,
    RequestError,
    ValidationError,
)
from .models.cvms import CvmOperation

DEFAULT_FINALITY_TIMEOUT = 30 * 60.0
DEFAULT_FINALITY_POLL_INTERVAL = 15.0

# Statuses that may pass on their own: request timeout, too early, rate limit.
_TRANSIENT_STATUSES = frozenset({408, 425, 429})


class _RawOperations(BaseModel):
    items: list[Any]


def plain(data: Any) -> Any:
    """The client wraps `/cvms/...` responses in a generic model; unwrap it."""
    return data.model_dump() if isinstance(data, BaseModel) else data


def check_wait_arguments(correlation_id: str, timeout: float, poll_interval: float) -> None:
    if not correlation_id:
        raise ValueError("correlation_id is required")
    if timeout <= 0:
        raise ValueError("timeout must be greater than 0")
    if poll_interval <= 0:
        raise ValueError("poll_interval must be greater than 0")


def is_transient(error: Exception) -> bool:
    """Network failures, 408, 425, 429 and 5xx are retried. Other errors are final."""
    if isinstance(error, RequestError):
        return True
    return isinstance(error, ApiError) and (
        error.status_code in _TRANSIENT_STATUSES or error.status_code >= 500
    )


def retry_after_seconds(error: Exception) -> float:
    """Server retry guidance. JS honors it for 429 and 5xx only."""
    if isinstance(error, ApiError) and (error.status_code == 429 or error.status_code >= 500):
        return error.retry_after or 0.0
    return 0.0


def find_operation(data: Any, correlation_id: str) -> CvmOperation | None:
    """Pick the operation with this correlation ID. Other items are not validated."""
    try:
        raw = _RawOperations.model_validate(plain(data))
        match = next(
            (
                item
                for item in raw.items
                if isinstance(item, dict) and item.get("correlation_id") == correlation_id
            ),
            None,
        )
        return None if match is None else CvmOperation.model_validate(match)
    except PydanticValidationError as exc:
        raise ValidationError(str(exc)) from exc


def terminal_error(operation: CvmOperation) -> CvmFinalityOperationError | None:
    """Error for a failed or cancelled operation, None for any other status."""
    if operation.status not in ("failed", "cancelled"):
        return None
    reason = operation.failure_reason
    detail = f" ({reason})" if reason and reason != operation.status else ""
    message = f"CVM operation {operation.correlation_id} {operation.status}{detail}."
    if operation.error_message:
        message = f"{message} {operation.error_message}"
    return CvmFinalityOperationError(message, operation=operation)


def timeout_error(
    correlation_id: str, timeout: float, last_transient: Exception | None
) -> CvmFinalityTimeoutError:
    error = CvmFinalityTimeoutError(
        f"Stopped waiting for CVM operation {correlation_id} after {timeout:g} s. "
        "The operation may still be in progress."
    )
    error.__cause__ = last_transient
    return error
