from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class CloudModel(BaseModel):
    """Base model with forward-compatible parsing (allow unknown fields)."""

    model_config = ConfigDict(extra="allow")


class AliasModel(BaseModel):
    """Base model for request types that use field aliases (e.g. alias='cvmId').

    Enables population by both the alias and the Python field name.
    """

    model_config = ConfigDict(populate_by_name=True)
