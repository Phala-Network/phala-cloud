from __future__ import annotations

from typing import Literal

from pydantic import Field

from .models.apps import AppRevisionDetailResponse as AppRevisionDetailResponse
from .models.apps import AppRevisionsResponse as AppRevisionsResponse
from .models.auth import CurrentUserV20251028, CurrentUserV20260121
from .models.base import CloudModel
from .models.cvms import (
    Certificate,
    PaginatedCvmInfosV20251028,
    PaginatedCvmInfosV20260121,
    PaginatedCvmInfosV20260522,
    TcbInfo,
)


class GenericObject(CloudModel):
    pass


class WorkspaceResponse(CloudModel):
    id: str
    name: str
    slug: str | None = None
    avatar_url: str | None = None
    description: str | None = None
    tier: str | None = None
    role: str | None = None
    is_default: bool | None = None
    created_at: str | None = None
    confidential_models_enabled: bool | None = None
    # Billing lifecycle state. A suspended workspace still runs but owes money;
    # an abandoned one is closed and read-only until its balance is settled.
    billing_status: Literal["active", "suspended", "abandoned"] = "active"
    # When the workspace was suspended. None unless billing_status is suspended.
    suspended_at: str | None = None


class ListWorkspacesResponse(CloudModel):
    data: list[WorkspaceResponse] = Field(default_factory=list)
    pagination: GenericObject | None = None


class InstanceTypesAllResponse(CloudModel):
    result: list[GenericObject] = Field(default_factory=list)


class InstanceTypesFamilyResponse(CloudModel):
    items: list[GenericObject] = Field(default_factory=list)
    total: int | None = None
    family: str | None = None


class ProvisionCvmResponse(CloudModel):
    app_id: str | None = None
    app_env_encrypt_pubkey: str | None = None
    compose_hash: str
    kms_info: GenericObject | None = None
    fmspc: str | None = None
    device_id: str | None = None
    os_image_hash: str | None = None
    instance_type: str | None = None
    node_id: int | None = None
    # Deprecated: identifies a KMS node, not the on-chain KMS contract.
    # Use kms_contract_id instead.
    kms_id: str | None = None
    kms_contract_id: str | None = None


class ProvisionCvmComposeFileUpdateResult(CloudModel):
    app_id: str | None = None
    device_id: str | None = None
    compose_hash: str
    kms_info: GenericObject | None = None
    compose_hash_registered: bool = False
    # True when the submitted compose matched the deployed one, meaning the
    # commit step is a no-op and can be skipped.
    compose_unchanged: bool = False


class CommitCvmProvisionResponseBase(CloudModel):
    name: str
    status: str


class CommitCvmProvisionResponseV20260121(CommitCvmProvisionResponseBase):
    id: int


class CommitCvmProvisionResponseV20260522(CommitCvmProvisionResponseBase):
    id: str


CommitCvmProvisionResponse = CommitCvmProvisionResponseV20260522


class ComposeHashPreconditionResponse(CloudModel):
    status: str = "precondition_required"
    message: str
    compose_hash: str
    app_id: str
    device_id: str
    kms_info: GenericObject | None = None


class InProgressResponse(CloudModel):
    status: str = "in_progress"
    message: str | None = None
    correlation_id: str | None = None


class CvmStateResponse(CloudModel):
    id: str | None = None
    instance_id: str | None = None
    name: str | None = None
    status: str


class AppFilterOptionsResponse(CloudModel):
    statuses: list[str] = Field(default_factory=list)
    image_versions: list[str] = Field(default_factory=list)
    instance_types: list[str] = Field(default_factory=list)
    kms_slugs: list[str] = Field(default_factory=list)
    kms_types: list[str] = Field(default_factory=list)
    regions: list[str] = Field(default_factory=list)
    nodes: list[str] = Field(default_factory=list)


class SshKeyResponse(CloudModel):
    id: str
    name: str
    public_key: str


class ImportGithubProfileResponse(CloudModel):
    github_username: str
    keys_added: int
    keys_skipped: int
    errors: list[str] = Field(default_factory=list)


class SyncGithubSshKeysResponse(CloudModel):
    synced_count: int
    keys_added: int
    keys_updated: int
    keys_removed: int
    errors: list[str] = Field(default_factory=list)


class AppEnvPubkeyResponse(CloudModel):
    public_key: str
    signature: str


class NextAppIdsResponse(CloudModel):
    app_ids: list[GenericObject] = Field(default_factory=list)


class WorkspaceNodesResponse(CloudModel):
    items: list[GenericObject] = Field(default_factory=list)
    total: int | None = None
    page: int | None = None
    page_size: int | None = None
    pages: int | None = None


class WorkspaceQuotasResponse(CloudModel):
    team_slug: str | None = None
    tier: str | None = None
    quotas: GenericObject | None = None
    reserved_nodes: GenericObject | None = None
    reserved_gpu: GenericObject | None = None
    as_of: str | None = None


class CvmInfoResponseBase(CloudModel):
    name: str | None = None
    status: str | None = None


class CvmInfoResponseV20260121(CvmInfoResponseBase):
    id: int | None = None


class CvmInfoResponseV20260522(CvmInfoResponseBase):
    id: str | None = None


CvmInfoResponse = CvmInfoResponseV20260522


class ComposeFileResponse(CloudModel):
    docker_compose_file: str | None = None


class CvmActionResponseBase(CloudModel):
    name: str | None = None
    status: str | None = None


class CvmActionResponseV20260121(CvmActionResponseBase):
    id: int | None = None


class CvmActionResponseV20260522(CvmActionResponseBase):
    id: str | None = None


CvmActionResponse = CvmActionResponseV20260522


class CvmStatsResponse(CloudModel):
    is_online: bool | None = None
    status: str | None = None


class CvmNetworkResponse(CloudModel):
    is_online: bool | None = None


class CvmContainersResponse(CloudModel):
    is_online: bool | None = None


class CvmAttestationResponse(CloudModel):
    is_online: bool | None = None


class CvmVisibilityResponse(CloudModel):
    status: str | None = None


class CvmUserConfigResponse(CloudModel):
    hostname: str | None = None
    ssh_authorized_keys: list[str] = Field(default_factory=list)


class RefreshInstanceIdResponseBase(CloudModel):
    identifier: str
    status: str
    old_instance_id: str | None = None
    new_instance_id: str | None = None
    source: str
    verified_with_gateway: bool
    reason: str | None = None


class RefreshInstanceIdResponseV20260121(RefreshInstanceIdResponseBase):
    cvm_id: int | None = None


class RefreshInstanceIdResponseV20260522(RefreshInstanceIdResponseBase):
    cvm_id: str | None = None


RefreshInstanceIdResponse = RefreshInstanceIdResponseV20260522


class RefreshInstanceIdsResponseBase(CloudModel):
    total: int
    scanned: int
    updated: int
    unchanged: int
    skipped: int
    conflicts: int
    errors: int


class RefreshInstanceIdsResponseV20260121(RefreshInstanceIdsResponseBase):
    items: list[RefreshInstanceIdResponseV20260121] = Field(default_factory=list)


class RefreshInstanceIdsResponseV20260522(RefreshInstanceIdsResponseBase):
    items: list[RefreshInstanceIdResponseV20260522] = Field(default_factory=list)


RefreshInstanceIdsResponse = RefreshInstanceIdsResponseV20260522


class AppListResponse(CloudModel):
    items: list[GenericObject] = Field(default_factory=list)
    total: int | None = None
    page: int | None = None
    page_size: int | None = None
    pages: int | None = None


class AppInfoResponse(CloudModel):
    id: str | None = None
    name: str | None = None


# AppRevisionsResponse and AppRevisionDetailResponse are imported from models.apps


class AppAttestationKmsInfo(CloudModel):
    contract_address: str
    chain_id: int | None = None
    version: str
    url: str
    gateway_app_id: str | None = None
    gateway_app_url: str
    kms_type: str


class AppAttestationInstance(CloudModel):
    vm_uuid: str | None = None
    name: str | None = None
    instance_id: str | None = None
    status: str | None = None
    image_version: str | None = None
    quote: str | None = None
    ppid: str | None = None
    ppid_sha256: str | None = None
    device_id: str | None = None
    fmspc: str | None = None
    tee_tcb_svn: str | None = None
    mr_config_id: str | None = None
    cpusvn: str | None = None
    pcesvn: int | None = None
    tcb_info: TcbInfo | None = None
    app_certificates: list[Certificate] | None = None
    compose_file: str | None = None
    eventlog: list[GenericObject] = Field(default_factory=list)
    error: str | None = None


class AppAttestationResponse(CloudModel):
    app_id: str | None = None
    contract_address: str | None = None
    kms_info: AppAttestationKmsInfo | None = None
    instances: list[AppAttestationInstance] = Field(default_factory=list)
    kms_guest_agent_info: GenericObject | None = None
    gateway_guest_agent_info: GenericObject | None = None
    qemu_version: str | None = None


CurrentUserResponse = CurrentUserV20260121 | CurrentUserV20251028
PaginatedCvmListResponse = (
    PaginatedCvmInfosV20260522 | PaginatedCvmInfosV20260121 | PaginatedCvmInfosV20251028
)
