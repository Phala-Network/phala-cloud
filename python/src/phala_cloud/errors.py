from __future__ import annotations

from typing import Any


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
    ) -> None:
        self.status_code = status_code
        self.code = code
        self.detail = detail
        self.request_id = request_id
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
        )


class ValidationError(PhalaCloudError):
    """Response validation failed (Pydantic)."""
