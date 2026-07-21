from __future__ import annotations

from typing import Any, Literal

from pydantic import Field

from .base import CloudModel


class FeatureFlag(CloudModel):
    """Feature flag entry returned by bootstrap endpoints.

    ``GET /auth/me`` (API version 2026-01-21) carries account-scoped flags;
    ``GET /workspaces/{slug}`` carries workspace-scoped flags plus the
    viewer's account-scoped flags for browser-session requests.
    """

    name: str
    enabled: bool = True
    options: list[str] | None = None
    reason: str | None = None
    action_text: str | None = None
    action_url: str | None = None
    metadata: dict[str, Any] | None = None


class UserInfo(CloudModel):
    username: str
    email: str
    role: Literal["admin", "user"]
    avatar: str
    email_verified: bool
    totp_enabled: bool
    has_backup_codes: bool
    flag_has_password: bool


class WorkspaceInfo(CloudModel):
    id: str
    name: str
    slug: str | None = None
    tier: str
    role: str
    avatar: str | None = None


class CreditsInfo(CloudModel):
    balance: str | float
    granted_balance: str | float
    is_post_paid: bool
    outstanding_amount: str | float | None = None


class CurrentUserV20260121(CloudModel):
    user: UserInfo
    workspace: WorkspaceInfo
    credits: CreditsInfo
    features: list[FeatureFlag] = Field(default_factory=list)


class CurrentUserV20251028(CloudModel):
    username: str
    email: str
    credits: float
    granted_credits: float
    avatar: str
    team_name: str
    team_tier: str


CurrentUser = CurrentUserV20260121 | CurrentUserV20251028
