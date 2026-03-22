from __future__ import annotations

import os
from collections.abc import Mapping
from typing import Any, Literal, TypeVar

import httpx
from pydantic import ValidationError as PydanticValidationError

from .errors import (
    ApiError,
    AuthError,
    BusinessError,
    ConflictError,
    PhalaCloudError,
    RequestError,
    ResourceError,
    ServerError,
    ValidationError,
)
from .models import (
    AvailableNodes,
    CurrentUser,
    CurrentUserV20251028,
    CurrentUserV20260121,
    GetCvmListRequest,
    GetKmsListRequest,
    GetKmsListResponse,
    PaginatedCvmInfos,
    PaginatedCvmInfosV20251028,
    PaginatedCvmInfosV20260121,
)
from .result import SafeResult

ApiVersion = Literal["2025-10-28", "2026-01-21"]
SUPPORTED_API_VERSIONS: tuple[ApiVersion, ...] = ("2025-10-28", "2026-01-21")
DEFAULT_API_VERSION: ApiVersion = "2026-01-21"
DEFAULT_BASE_URL = "https://cloud-api.phala.com/api/v1"

T = TypeVar("T")


class _BaseConfig:
    def __init__(
        self,
        *,
        api_key: str | None,
        base_url: str,
        version: ApiVersion,
        timeout: float,
        use_cookie_auth: bool,
        headers: Mapping[str, str] | None,
    ) -> None:
        self.api_key = api_key
        self.base_url = base_url
        self.version = version
        self.timeout = timeout
        self.use_cookie_auth = use_cookie_auth
        self.headers = dict(headers or {})

    @property
    def request_headers(self) -> dict[str, str]:
        result: dict[str, str] = {
            "X-Phala-Version": self.version,
            "Content-Type": "application/json",
        }
        result.update(self.headers)
        if not self.use_cookie_auth and self.api_key:
            result["X-API-Key"] = self.api_key
        return result


class AsyncPhalaCloud:
    """Async Phala Cloud client.

    Prefer this in async apps (FastAPI, asyncio scripts, workers).
    """

    def __init__(
        self,
        *,
        api_key: str | None = None,
        base_url: str | None = None,
        version: ApiVersion = DEFAULT_API_VERSION,
        timeout: float = 30.0,
        use_cookie_auth: bool = False,
        headers: Mapping[str, str] | None = None,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        resolved_version = version if version in SUPPORTED_API_VERSIONS else DEFAULT_API_VERSION
        resolved_key = api_key or os.getenv("PHALA_CLOUD_API_KEY")
        resolved_base_url = base_url or os.getenv("PHALA_CLOUD_API_PREFIX") or DEFAULT_BASE_URL

        self.config = _BaseConfig(
            api_key=resolved_key,
            base_url=resolved_base_url,
            version=resolved_version,
            timeout=timeout,
            use_cookie_auth=use_cookie_auth,
            headers=headers,
        )
        self._client = http_client or httpx.AsyncClient(
            base_url=self.config.base_url,
            timeout=self.config.timeout,
            headers=self.config.request_headers,
            follow_redirects=True,
        )
        self._owns_client = http_client is None

    async def __aenter__(self) -> AsyncPhalaCloud:
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    def with_version(self, version: ApiVersion) -> AsyncPhalaCloud:
        return AsyncPhalaCloud(
            api_key=self.config.api_key,
            base_url=self.config.base_url,
            version=version,
            timeout=self.config.timeout,
            use_cookie_auth=self.config.use_cookie_auth,
            headers=self.config.headers,
        )

    async def request(self, method: str, path: str, **kwargs: Any) -> Any:
        try:
            response = await self._client.request(method.upper(), path, **kwargs)
        except httpx.HTTPError as exc:
            raise RequestError(str(exc)) from exc
        return self._decode_or_raise(response)

    async def request_full(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        try:
            response = await self._client.request(method.upper(), path, **kwargs)
        except httpx.HTTPError as exc:
            raise RequestError(str(exc)) from exc

        data = None
        if response.content:
            content_type = response.headers.get("content-type", "")
            data = response.json() if "application/json" in content_type else response.text

        return {
            "status": response.status_code,
            "status_text": response.reason_phrase,
            "headers": dict(response.headers),
            "data": data,
            "ok": response.is_success,
        }

    async def get(self, path: str, *, params: Mapping[str, Any] | None = None) -> Any:
        return await self.request("GET", path, params=params)

    async def post(self, path: str, *, json: Any | None = None) -> Any:
        return await self.request("POST", path, json=json)

    async def safe(self, fn: Any, *args: Any, **kwargs: Any) -> SafeResult[Any]:
        try:
            data = await fn(*args, **kwargs)
            return SafeResult(ok=True, data=data)
        except (PhalaCloudError, PydanticValidationError) as exc:
            return SafeResult(ok=False, error=exc)

    async def safe_request_method(self, method: str, path: str, **kwargs: Any) -> SafeResult[Any]:
        return await self.safe(self.request, method, path, **kwargs)

    async def safe_request_full(
        self, method: str, path: str, **kwargs: Any
    ) -> SafeResult[dict[str, Any]]:
        return await self.safe(self.request_full, method, path, **kwargs)

    async def get_current_user(self) -> CurrentUser:
        data = await self.get("/auth/me")
        return self._parse_current_user(data)

    async def safe_get_current_user(self) -> SafeResult[CurrentUser]:
        return await self.safe(self.get_current_user)

    async def get_available_nodes(self) -> AvailableNodes:
        data = await self.get("/teepods/available")
        return self._validate(AvailableNodes, data)

    async def safe_get_available_nodes(self) -> SafeResult[AvailableNodes]:
        return await self.safe(self.get_available_nodes)

    async def get_cvm_list(
        self,
        request: GetCvmListRequest | Mapping[str, Any] | None = None,
    ) -> PaginatedCvmInfos:
        req = self._coerce(GetCvmListRequest, request)
        data = await self.get("/cvms/paginated", params=req.model_dump(exclude_none=True))
        if self.config.version == "2025-10-28":
            return self._validate(PaginatedCvmInfosV20251028, data)
        return self._validate(PaginatedCvmInfosV20260121, data)

    async def safe_get_cvm_list(
        self,
        request: GetCvmListRequest | Mapping[str, Any] | None = None,
    ) -> SafeResult[PaginatedCvmInfos]:
        return await self.safe(self.get_cvm_list, request)

    async def get_kms_list(
        self,
        request: GetKmsListRequest | Mapping[str, Any] | None = None,
    ) -> GetKmsListResponse:
        req = self._coerce(GetKmsListRequest, request)
        data = await self.get("/kms", params=req.model_dump(exclude_none=True))
        return self._validate(GetKmsListResponse, data)

    async def safe_get_kms_list(
        self,
        request: GetKmsListRequest | Mapping[str, Any] | None = None,
    ) -> SafeResult[GetKmsListResponse]:
        return await self.safe(self.get_kms_list, request)

    def _decode_or_raise(self, response: httpx.Response) -> Any:
        if response.status_code >= 400:
            raise self._to_api_error(response)
        if not response.content:
            return None
        content_type = response.headers.get("content-type", "")
        if "application/json" in content_type:
            return response.json()
        return response.text

    def _to_api_error(self, response: httpx.Response) -> ApiError:
        payload: Any | None = None
        message = response.text
        code: str | None = None
        try:
            payload = response.json()
            if isinstance(payload, dict):
                message = str(payload.get("message") or payload.get("detail") or message)
                maybe_code = payload.get("code")
                code = str(maybe_code) if maybe_code is not None else None
        except Exception:
            pass

        status = response.status_code
        base_kwargs: dict[str, Any] = {
            "status_code": status,
            "message": message,
            "code": code,
            "detail": payload,
        }

        # Structured error (has error_code field)
        if isinstance(payload, dict) and "error_code" in payload:
            return ResourceError(
                **base_kwargs,
                error_code=payload.get("error_code"),
                structured_details=payload.get("details"),
                suggestions=payload.get("suggestions"),
                links=payload.get("links"),
            )

        if status in (401, 403):
            return AuthError(**base_kwargs)
        if status >= 500:
            return ServerError(**base_kwargs)
        if status == 409:
            return ConflictError(**base_kwargs)
        if status >= 400:
            return BusinessError(**base_kwargs)

        return ApiError(**base_kwargs)

    def _validate(self, model_type: type[T], data: Any) -> T:
        try:
            return model_type.model_validate(data)
        except PydanticValidationError as exc:
            raise ValidationError(str(exc)) from exc

    def _parse_current_user(self, data: Any) -> CurrentUser:
        if self.config.version == "2025-10-28":
            return self._validate(CurrentUserV20251028, data)
        return self._validate(CurrentUserV20260121, data)

    def _coerce(self, model_type: type[T], data: T | Mapping[str, Any] | None) -> T:
        if data is None:
            return model_type.model_validate({})
        if isinstance(data, model_type):
            return data
        return model_type.model_validate(data)


class PhalaCloud:
    """Sync Phala Cloud client.

    REPL-friendly default client for scripts and notebooks.
    """

    def __init__(
        self,
        *,
        api_key: str | None = None,
        base_url: str | None = None,
        version: ApiVersion = DEFAULT_API_VERSION,
        timeout: float = 30.0,
        use_cookie_auth: bool = False,
        headers: Mapping[str, str] | None = None,
        http_client: httpx.Client | None = None,
    ) -> None:
        resolved_version = version if version in SUPPORTED_API_VERSIONS else DEFAULT_API_VERSION
        resolved_key = api_key or os.getenv("PHALA_CLOUD_API_KEY")
        resolved_base_url = base_url or os.getenv("PHALA_CLOUD_API_PREFIX") or DEFAULT_BASE_URL

        self.config = _BaseConfig(
            api_key=resolved_key,
            base_url=resolved_base_url,
            version=resolved_version,
            timeout=timeout,
            use_cookie_auth=use_cookie_auth,
            headers=headers,
        )
        self._client = http_client or httpx.Client(
            base_url=self.config.base_url,
            timeout=self.config.timeout,
            headers=self.config.request_headers,
            follow_redirects=True,
        )
        self._owns_client = http_client is None

    def __enter__(self) -> PhalaCloud:
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    def with_version(self, version: ApiVersion) -> PhalaCloud:
        return PhalaCloud(
            api_key=self.config.api_key,
            base_url=self.config.base_url,
            version=version,
            timeout=self.config.timeout,
            use_cookie_auth=self.config.use_cookie_auth,
            headers=self.config.headers,
        )

    def request(self, method: str, path: str, **kwargs: Any) -> Any:
        try:
            response = self._client.request(method.upper(), path, **kwargs)
        except httpx.HTTPError as exc:
            raise RequestError(str(exc)) from exc
        return self._decode_or_raise(response)

    def request_full(self, method: str, path: str, **kwargs: Any) -> dict[str, Any]:
        try:
            response = self._client.request(method.upper(), path, **kwargs)
        except httpx.HTTPError as exc:
            raise RequestError(str(exc)) from exc

        data = None
        if response.content:
            content_type = response.headers.get("content-type", "")
            data = response.json() if "application/json" in content_type else response.text

        return {
            "status": response.status_code,
            "status_text": response.reason_phrase,
            "headers": dict(response.headers),
            "data": data,
            "ok": response.is_success,
        }

    def get(self, path: str, *, params: Mapping[str, Any] | None = None) -> Any:
        return self.request("GET", path, params=params)

    def post(self, path: str, *, json: Any | None = None) -> Any:
        return self.request("POST", path, json=json)

    def safe(self, fn: Any, *args: Any, **kwargs: Any) -> SafeResult[Any]:
        try:
            data = fn(*args, **kwargs)
            return SafeResult(ok=True, data=data)
        except (PhalaCloudError, PydanticValidationError) as exc:
            return SafeResult(ok=False, error=exc)

    def safe_request_method(self, method: str, path: str, **kwargs: Any) -> SafeResult[Any]:
        return self.safe(self.request, method, path, **kwargs)

    def safe_request_full(
        self, method: str, path: str, **kwargs: Any
    ) -> SafeResult[dict[str, Any]]:
        return self.safe(self.request_full, method, path, **kwargs)

    def get_current_user(self) -> CurrentUser:
        data = self.get("/auth/me")
        return self._parse_current_user(data)

    def safe_get_current_user(self) -> SafeResult[CurrentUser]:
        return self.safe(self.get_current_user)

    def get_available_nodes(self) -> AvailableNodes:
        data = self.get("/teepods/available")
        return self._validate(AvailableNodes, data)

    def safe_get_available_nodes(self) -> SafeResult[AvailableNodes]:
        return self.safe(self.get_available_nodes)

    def get_cvm_list(
        self,
        request: GetCvmListRequest | Mapping[str, Any] | None = None,
    ) -> PaginatedCvmInfos:
        req = self._coerce(GetCvmListRequest, request)
        data = self.get("/cvms/paginated", params=req.model_dump(exclude_none=True))
        if self.config.version == "2025-10-28":
            return self._validate(PaginatedCvmInfosV20251028, data)
        return self._validate(PaginatedCvmInfosV20260121, data)

    def safe_get_cvm_list(
        self,
        request: GetCvmListRequest | Mapping[str, Any] | None = None,
    ) -> SafeResult[PaginatedCvmInfos]:
        return self.safe(self.get_cvm_list, request)

    def get_kms_list(
        self,
        request: GetKmsListRequest | Mapping[str, Any] | None = None,
    ) -> GetKmsListResponse:
        req = self._coerce(GetKmsListRequest, request)
        data = self.get("/kms", params=req.model_dump(exclude_none=True))
        return self._validate(GetKmsListResponse, data)

    def safe_get_kms_list(
        self,
        request: GetKmsListRequest | Mapping[str, Any] | None = None,
    ) -> SafeResult[GetKmsListResponse]:
        return self.safe(self.get_kms_list, request)

    def _decode_or_raise(self, response: httpx.Response) -> Any:
        if response.status_code >= 400:
            raise self._to_api_error(response)
        if not response.content:
            return None
        content_type = response.headers.get("content-type", "")
        if "application/json" in content_type:
            return response.json()
        return response.text

    def _to_api_error(self, response: httpx.Response) -> ApiError:
        payload: Any | None = None
        message = response.text
        code: str | None = None
        try:
            payload = response.json()
            if isinstance(payload, dict):
                message = str(payload.get("message") or payload.get("detail") or message)
                maybe_code = payload.get("code")
                code = str(maybe_code) if maybe_code is not None else None
        except Exception:
            pass

        status = response.status_code
        base_kwargs: dict[str, Any] = {
            "status_code": status,
            "message": message,
            "code": code,
            "detail": payload,
        }

        # Structured error (has error_code field)
        if isinstance(payload, dict) and "error_code" in payload:
            return ResourceError(
                **base_kwargs,
                error_code=payload.get("error_code"),
                structured_details=payload.get("details"),
                suggestions=payload.get("suggestions"),
                links=payload.get("links"),
            )

        if status in (401, 403):
            return AuthError(**base_kwargs)
        if status >= 500:
            return ServerError(**base_kwargs)
        if status == 409:
            return ConflictError(**base_kwargs)
        if status >= 400:
            return BusinessError(**base_kwargs)

        return ApiError(**base_kwargs)

    def _validate(self, model_type: type[T], data: Any) -> T:
        try:
            return model_type.model_validate(data)
        except PydanticValidationError as exc:
            raise ValidationError(str(exc)) from exc

    def _parse_current_user(self, data: Any) -> CurrentUser:
        if self.config.version == "2025-10-28":
            return self._validate(CurrentUserV20251028, data)
        return self._validate(CurrentUserV20260121, data)

    def _coerce(self, model_type: type[T], data: T | Mapping[str, Any] | None) -> T:
        if data is None:
            return model_type.model_validate({})
        if isinstance(data, model_type):
            return data
        return model_type.model_validate(data)


def create_client(**kwargs: Any) -> PhalaCloud:
    return PhalaCloud(**kwargs)


def create_async_client(**kwargs: Any) -> AsyncPhalaCloud:
    return AsyncPhalaCloud(**kwargs)
