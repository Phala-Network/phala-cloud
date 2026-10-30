from __future__ import annotations

from collections.abc import Mapping

from pydantic import BaseModel, ConfigDict, Field, model_validator


class CloudModel(BaseModel):
    """Base model with forward-compatible parsing (allow unknown fields)."""

    model_config = ConfigDict(extra="allow")


class NodeSelectionRequest(BaseModel):
    """Select a physical node by name."""

    node: str | None = Field(default=None, min_length=1)

    @model_validator(mode="before")
    @classmethod
    def _reject_legacy_node_selection(cls, value: object) -> object:
        if isinstance(value, Mapping):
            removed = {"node_id", "teepod_id"} & value.keys()
            if removed:
                raise ValueError(f"Use node instead of {', '.join(sorted(removed))}")
        return value


class AliasModel(BaseModel):
    """Base model for request types that use field aliases (e.g. alias='cvmId').

    Enables population by both the alias and the Python field name.
    """

    model_config = ConfigDict(populate_by_name=True)
