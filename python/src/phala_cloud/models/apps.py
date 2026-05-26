from __future__ import annotations

from pydantic import Field

from .base import CloudModel
from .cvms import CvmInfoV20260121, CvmInfoV20260522, CvmRef, UserRef, WorkspaceRef


class AppProfileV20260121(CloudModel):
    display_name: str | None = None
    avatar_url: str | None = None
    description: str | None = None
    custom_domain: str | None = None


class DstackAppFullResponseV20260121(CloudModel):
    id: str
    name: str
    app_id: str
    app_provision_type: str | None = None
    app_icon_url: str | None = None
    created_at: str
    kms_type: str
    profile: AppProfileV20260121 | None = None
    current_cvm: CvmInfoV20260121 | None = None
    cvms: list[CvmInfoV20260121] = Field(default_factory=list)
    cvm_count: int = 0


class DstackAppListResponseV20260121(CloudModel):
    dstack_apps: list[DstackAppFullResponseV20260121] = Field(default_factory=list)
    page: int
    page_size: int
    total: int
    total_pages: int


class DstackAppFullResponseV20260522(CloudModel):
    id: str
    name: str
    app_id: str
    app_provision_type: str | None = None
    app_icon_url: str | None = None
    created_at: str
    kms_type: str
    profile: AppProfileV20260121 | None = None
    current_cvm: CvmInfoV20260522 | None = None
    cvms: list[CvmInfoV20260522] = Field(default_factory=list)
    cvm_count: int = 0


class DstackAppListResponseV20260522(CloudModel):
    dstack_apps: list[DstackAppFullResponseV20260522] = Field(default_factory=list)
    page: int
    page_size: int
    total: int
    total_pages: int


class AppRevisionResponse(CloudModel):
    revision_id: str
    app_id: str
    vm_uuid: str
    compose_hash: str
    created_at: str
    trace_id: str | None = None
    operation_type: str
    triggered_by: UserRef | None = None
    cvm: CvmRef | None = None
    workspace: WorkspaceRef | None = None


class AppRevisionDetailResponse(CloudModel):
    revision_id: str
    app_id: str
    vm_uuid: str
    compose_hash: str
    compose_file: str | dict | None = None
    encrypted_env: str | None = None
    user_config: str | None = None
    created_at: str
    trace_id: str | None = None
    operation_type: str
    triggered_by: UserRef | None = None
    cvm: CvmRef | None = None
    workspace: WorkspaceRef | None = None


class AppRevisionsResponse(CloudModel):
    revisions: list[AppRevisionResponse] = Field(default_factory=list)
    total: int
    page: int
    page_size: int
    total_pages: int


class DeviceAllowlistItemBase(CloudModel):
    device_id: str
    node_name: str | None = None
    allowed_onchain: bool
    status: str


class DeviceAllowlistItemV20260121(DeviceAllowlistItemBase):
    cvm_ids: list[int] = Field(default_factory=list)


class DeviceAllowlistItemV20260522(DeviceAllowlistItemBase):
    cvm_ids: list[str] = Field(default_factory=list)


DeviceAllowlistItemAny = DeviceAllowlistItemV20260522 | DeviceAllowlistItemV20260121
DeviceAllowlistItem = DeviceAllowlistItemV20260522


class DeviceAllowlistResponseBase(CloudModel):
    is_onchain_kms: bool
    allow_any_device: bool | None = None
    chain_id: int | None = None
    app_contract_address: str | None = None


class DeviceAllowlistResponseV20260121(DeviceAllowlistResponseBase):
    devices: list[DeviceAllowlistItemV20260121] = Field(default_factory=list)


class DeviceAllowlistResponseV20260522(DeviceAllowlistResponseBase):
    devices: list[DeviceAllowlistItemV20260522] = Field(default_factory=list)


class DeviceAllowlistResponseAny(DeviceAllowlistResponseBase):
    devices: list[DeviceAllowlistItemV20260522 | DeviceAllowlistItemV20260121] = Field(
        default_factory=list
    )


DeviceAllowlistResponse = DeviceAllowlistResponseV20260522
