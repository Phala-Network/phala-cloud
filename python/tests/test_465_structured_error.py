from __future__ import annotations

import httpx
import pytest

from phala_cloud import AsyncPhalaCloud, PhalaCloud
from phala_cloud.errors import ApiError, ResourceError


def _make_structured_465_response() -> httpx.Response:
    return httpx.Response(
        465,
        json={
            "error_code": "ERR-01-005",
            "message": "Compose hash registration required on-chain",
            "request_id": "rid-body-123",
            "details": [
                {"field": "compose_hash", "value": "0xhash123", "message": None},
                {"field": "app_id", "value": "0xapp456", "message": None},
                {"field": "device_id", "value": "0xdevice789", "message": None},
                {
                    "field": "kms_info",
                    "value": {
                        "id": "kms_test",
                        "slug": "kms-base-prod9",
                        "url": "https://kms.example.com",
                        "version": "v0.5.7",
                        "chain_id": 8453,
                        "kms_contract_address": "0xkms123",
                        "gateway_app_id": "0xgateway456",
                    },
                    "message": None,
                },
            ],
            "suggestions": ["Register the compose hash on-chain"],
            "links": [{"url": "https://docs.example.com", "label": "Docs"}],
        },
    )


def _make_legacy_465_response() -> httpx.Response:
    return httpx.Response(
        465,
        json={
            "message": "need hash",
            "compose_hash": "legacy_hash",
            "app_id": "legacy_app",
            "device_id": "legacy_device",
            "kms_info": {"id": "legacy_kms"},
        },
    )


class Test465StructuredErrorSync:
    def test_update_cvm_envs_structured(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return _make_structured_465_response()

        transport = httpx.MockTransport(handler)
        with httpx.Client(
            transport=transport, base_url="https://cloud-api.phala.com/api/v1"
        ) as raw:
            c = PhalaCloud(http_client=raw)
            out = c.update_cvm_envs({"id": "c1", "encrypted_env": "x"})
            assert out.status == "precondition_required"
            assert out.compose_hash == "0xhash123"
            assert out.app_id == "0xapp456"
            assert out.device_id == "0xdevice789"
            assert out.kms_info["id"] == "kms_test"

    def test_update_docker_compose_structured(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return _make_structured_465_response()

        transport = httpx.MockTransport(handler)
        with httpx.Client(
            transport=transport, base_url="https://cloud-api.phala.com/api/v1"
        ) as raw:
            c = PhalaCloud(http_client=raw)
            out = c.update_docker_compose({"id": "c1", "docker_compose_file": "services: {}"})
            assert out.status == "precondition_required"
            assert out.compose_hash == "0xhash123"
            assert out.app_id == "0xapp456"

    def test_update_pre_launch_script_structured(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return _make_structured_465_response()

        transport = httpx.MockTransport(handler)
        with httpx.Client(
            transport=transport, base_url="https://cloud-api.phala.com/api/v1"
        ) as raw:
            c = PhalaCloud(http_client=raw)
            out = c.update_pre_launch_script({"id": "c1", "pre_launch_script": "#!/bin/sh"})
            assert out.status == "precondition_required"
            assert out.compose_hash == "0xhash123"
            assert out.app_id == "0xapp456"

    def test_update_cvm_envs_legacy_flat(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return _make_legacy_465_response()

        transport = httpx.MockTransport(handler)
        with httpx.Client(
            transport=transport, base_url="https://cloud-api.phala.com/api/v1"
        ) as raw:
            c = PhalaCloud(http_client=raw)
            out = c.update_cvm_envs({"id": "c1", "encrypted_env": "x"})
            assert out.status == "precondition_required"
            assert out.compose_hash == "legacy_hash"
            assert out.app_id == "legacy_app"
            assert out.device_id == "legacy_device"
            assert out.kms_info["id"] == "legacy_kms"

    def test_non_465_error_is_raised(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(500, json={"message": "boom"})

        transport = httpx.MockTransport(handler)
        with httpx.Client(
            transport=transport, base_url="https://cloud-api.phala.com/api/v1"
        ) as raw:
            c = PhalaCloud(http_client=raw)
            with pytest.raises(ApiError):
                c.update_cvm_envs({"id": "c1", "encrypted_env": "x"})

    def test_structured_error_exposes_body_request_id(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                400,
                json={
                    "error_code": "ERR-01-005",
                    "message": "Compose hash registration required on-chain",
                    "request_id": "rid-body-123",
                },
                headers={"X-Request-ID": "rid-header-456"},
            )

        transport = httpx.MockTransport(handler)
        with httpx.Client(
            transport=transport, base_url="https://cloud-api.phala.com/api/v1"
        ) as raw:
            c = PhalaCloud(http_client=raw)
            with pytest.raises(ResourceError) as exc_info:
                c.get("/test")

        assert exc_info.value.request_id == "rid-body-123"


class Test465StructuredErrorAsync:
    @pytest.mark.anyio
    async def test_update_cvm_envs_structured(self) -> None:
        async def handler(request: httpx.Request) -> httpx.Response:
            return _make_structured_465_response()

        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(
            transport=transport, base_url="https://cloud-api.phala.com/api/v1"
        ) as raw:
            c = AsyncPhalaCloud(http_client=raw)
            out = await c.update_cvm_envs({"id": "c1", "encrypted_env": "x"})
            assert out.status == "precondition_required"
            assert out.compose_hash == "0xhash123"
            assert out.app_id == "0xapp456"
            assert out.device_id == "0xdevice789"
            assert out.kms_info["id"] == "kms_test"

    @pytest.mark.anyio
    async def test_update_docker_compose_structured(self) -> None:
        async def handler(request: httpx.Request) -> httpx.Response:
            return _make_structured_465_response()

        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(
            transport=transport, base_url="https://cloud-api.phala.com/api/v1"
        ) as raw:
            c = AsyncPhalaCloud(http_client=raw)
            out = await c.update_docker_compose({"id": "c1", "docker_compose_file": "services: {}"})
            assert out.status == "precondition_required"
            assert out.compose_hash == "0xhash123"
            assert out.app_id == "0xapp456"

    @pytest.mark.anyio
    async def test_update_pre_launch_script_structured(self) -> None:
        async def handler(request: httpx.Request) -> httpx.Response:
            return _make_structured_465_response()

        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(
            transport=transport, base_url="https://cloud-api.phala.com/api/v1"
        ) as raw:
            c = AsyncPhalaCloud(http_client=raw)
            out = await c.update_pre_launch_script({"id": "c1", "pre_launch_script": "#!/bin/sh"})
            assert out.status == "precondition_required"
            assert out.compose_hash == "0xhash123"
            assert out.app_id == "0xapp456"

    @pytest.mark.anyio
    async def test_update_cvm_envs_legacy_flat(self) -> None:
        async def handler(request: httpx.Request) -> httpx.Response:
            return _make_legacy_465_response()

        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(
            transport=transport, base_url="https://cloud-api.phala.com/api/v1"
        ) as raw:
            c = AsyncPhalaCloud(http_client=raw)
            out = await c.update_cvm_envs({"id": "c1", "encrypted_env": "x"})
            assert out.status == "precondition_required"
            assert out.compose_hash == "legacy_hash"
            assert out.app_id == "legacy_app"
            assert out.device_id == "legacy_device"
            assert out.kms_info["id"] == "legacy_kms"

    @pytest.mark.anyio
    async def test_non_465_error_is_raised(self) -> None:
        async def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(500, json={"message": "boom"})

        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(
            transport=transport, base_url="https://cloud-api.phala.com/api/v1"
        ) as raw:
            c = AsyncPhalaCloud(http_client=raw)
            with pytest.raises(ApiError):
                await c.update_cvm_envs({"id": "c1", "encrypted_env": "x"})

    @pytest.mark.anyio
    async def test_structured_error_exposes_header_request_id(self) -> None:
        async def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                400,
                json={
                    "error_code": "ERR-01-005",
                    "message": "Compose hash registration required on-chain",
                },
                headers={"X-Request-ID": "rid-header-456"},
            )

        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(
            transport=transport, base_url="https://cloud-api.phala.com/api/v1"
        ) as raw:
            c = AsyncPhalaCloud(http_client=raw)
            with pytest.raises(ResourceError) as exc_info:
                await c.get("/test")

        assert exc_info.value.request_id == "rid-header-456"
