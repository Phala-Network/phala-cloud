import httpx
import pytest

from phala_cloud import AsyncPhalaCloud, PhalaCloud


def test_with_version_preserves_sync_client_and_injected_transport() -> None:
    versions: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        versions.append(request.headers["x-phala-version"])
        return httpx.Response(200, json={"ok": True})

    with httpx.Client(
        transport=httpx.MockTransport(handler), base_url="https://example.com"
    ) as raw:
        original = PhalaCloud(http_client=raw, version="2025-10-28")
        clone = original.with_version("2026-01-21")
        assert isinstance(clone, PhalaCloud)
        assert hasattr(clone, "list_workspaces")
        assert original.get("/custom") == {"ok": True}
        assert clone.get("/custom") == {"ok": True}
        assert original.get("/custom") == {"ok": True}
        clone.close()
        assert original.get("/custom") == {"ok": True}
        assert versions == ["2025-10-28", "2026-01-21", "2025-10-28", "2025-10-28"]


@pytest.mark.asyncio
async def test_with_version_preserves_async_client_and_injected_transport() -> None:
    versions: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        versions.append(request.headers["x-phala-version"])
        return httpx.Response(200, json={"ok": True})

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(handler), base_url="https://example.com"
    ) as raw:
        original = AsyncPhalaCloud(http_client=raw, version="2025-10-28")
        clone = original.with_version("2026-01-21")
        assert isinstance(clone, AsyncPhalaCloud)
        assert hasattr(clone, "list_workspaces")
        assert await original.get("/custom") == {"ok": True}
        assert await clone.get("/custom") == {"ok": True}
        assert await original.get("/custom") == {"ok": True}
        await clone.aclose()
        assert await original.get("/custom") == {"ok": True}
        assert versions == ["2025-10-28", "2026-01-21", "2025-10-28", "2025-10-28"]
