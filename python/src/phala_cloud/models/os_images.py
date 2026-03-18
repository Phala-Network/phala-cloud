from __future__ import annotations

from pydantic import Field

from .base import CloudModel


class OSImagePublic(CloudModel):
    name: str
    slug: str
    version: str
    os_image_hash: str | None = None
    is_dev: bool
    requires_gpu: bool


class GetOsImagesRequest(CloudModel):
    page: int | None = Field(default=None, ge=1)
    page_size: int | None = Field(default=None, ge=1)
    is_dev: bool | None = None


class GetOsImagesResponse(CloudModel):
    items: list[OSImagePublic]
    total: int
    page: int
    page_size: int
    pages: int
