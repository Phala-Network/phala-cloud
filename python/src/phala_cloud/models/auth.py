from __future__ import annotations

from typing import Literal

from .base import CloudModel


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
    """Money in the current workspace.

    - ``balance``: the workspace Balance. It pays for CVMs, GPU instances, and Private AI.
    - ``granted_balance``: Gifted credits. They pay for CVMs and GPU instances only,
      before Balance.
    - ``is_post_paid``: CVM usage beyond Balance is charged to the card instead of
      stopping the CVMs.
    - ``outstanding_amount``: what the workspace owes, if anything.
    """

    balance: str | float
    granted_balance: str | float
    is_post_paid: bool
    outstanding_amount: str | float | None = None


class CurrentUserV20260121(CloudModel):
    user: UserInfo
    workspace: WorkspaceInfo
    credits: CreditsInfo


class CurrentUserV20251028(CloudModel):
    username: str
    email: str
    credits: float
    granted_credits: float
    avatar: str
    team_name: str
    team_tier: str


CurrentUser = CurrentUserV20260121 | CurrentUserV20251028
