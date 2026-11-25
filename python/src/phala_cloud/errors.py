from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from .models.cvms import CvmOperation


class PhalaCloudError(Exception):
    """Base error for all SDK exceptions."""


class RequestError(PhalaCloudError):
    """Network/transport level failure."""


class ApiError(PhalaCloudError):
    """HTTP error returned by Phala Cloud API."""

    def __init__(
        self,
        *,
        status_code: int,
        message: str,
        code: str | None = None,
        detail: Any | None = None,
        request_id: str | None = None,
        retry_after: float | None = None,
    ) -> None:
        self.status_code = status_code
        self.code = code
        self.detail = detail
        self.request_id = request_id
        # Seconds from the Retry-After response header, when the server sent one.
        self.retry_after = retry_after
        super().__init__(message)


class AuthError(ApiError):
    """Authentication/authorization error (401/403)."""


class BusinessError(ApiError):
    """Business logic error (400, 409, etc.)."""


class ConflictError(BusinessError):
    """409 Conflict — transient, may be retryable.

    A 409 without a structured error_code typically indicates a transient
    conflict (e.g., operation in progress). A 409 WITH an error_code
    (returned as ResourceError) is a deterministic business error.
    """


class ServerError(ApiError):
    """Server-side error (500+)."""


class ResourceError(BusinessError):
    """Structured error with error code, suggestions, and links."""

    def __init__(
        self,
        *,
        status_code: int,
        message: str,
        code: str | None = None,
        detail: Any | None = None,
        request_id: str | None = None,
        retry_after: float | None = None,
        error_code: str | None = None,
        structured_details: list[dict[str, Any]] | None = None,
        suggestions: list[str] | None = None,
        links: list[dict[str, str]] | None = None,
    ) -> None:
        self.error_code = error_code
        self.structured_details = structured_details
        self.suggestions = suggestions
        self.links = links
        super().__init__(
            status_code=status_code,
            message=message,
            code=code,
            detail=detail,
            request_id=request_id,
            retry_after=retry_after,
        )


class CvmFinalityReplacementRequiredError(ResourceError):
    """412 ERR-03-067: this update would replace one that is still waiting for finality.

    ``correlation_id`` names the waiting update and ``stage`` is where it stands
    (for example "submitted", "safe" or "finalized"). Wait for it with
    ``wait_for_cvm_finality``, or send ``correlation_id`` as
    ``confirm_finality_replacement`` to replace it.
    """

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        fields = {
            item["field"]: item.get("value")
            for item in self.structured_details or []
            if isinstance(item, dict) and "field" in item
        }
        self.correlation_id = str(fields.get("correlation_id") or "")
        self.stage = str(fields.get("stage") or "")


class ValidationError(PhalaCloudError):
    """Response validation failed (Pydantic)."""


class CvmFinalityWaitError(PhalaCloudError):
    """Waiting for an on-chain CVM operation ended without it completing.

    The operation itself is not cancelled by this error.
    """

    def __init__(
        self,
        message: str,
        *,
        operation: CvmOperation | None = None,
    ) -> None:
        self.operation = operation
        super().__init__(message)


class CvmFinalityOperationError(CvmFinalityWaitError):
    """The operation ended as failed or cancelled."""

    def __init__(self, message: str, *, operation: CvmOperation) -> None:
        super().__init__(message, operation=operation)
        # "failed" or "cancelled".
        self.status = operation.status
        self.failure_reason = operation.failure_reason
        self.error_message = operation.error_message


class CvmFinalityTimeoutError(CvmFinalityWaitError):
    """The local wait timed out. The operation may still be in progress."""
