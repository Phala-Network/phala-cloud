from __future__ import annotations

from pydantic import Field

from .models.apps import AppRevisionDetailResponse as AppRevisionDetailResponse
from .models.apps import AppRevisionsResponse as AppRevisionsResponse
from .models.auth import CurrentUserV20251028, CurrentUserV20260121
from .models.base import CloudModel
from .models.cvms import PaginatedCvmInfosV20251028, PaginatedCvmInfosV20260121


class GenericObject(CloudModel):
    pass


class WorkspaceResponse(CloudModel):
    id: str
    name: str
    slug: str | None = None
    tier: str | None = None
    role: str | None = None


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
    kms_id: str | None = None


class CommitCvmProvisionResponse(CloudModel):
    id: int | str
    name: str
    status: str


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


class CvmInfoResponse(CloudModel):
    id: str | int | None = None
    name: str | None = None
    status: str | None = None


class ComposeFileResponse(CloudModel):
    docker_compose_file: str | None = None


class CvmActionResponse(CloudModel):
    id: int | str | None = None
    name: str | None = None
    status: str | None = None


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


class RefreshInstanceIdResponse(CloudModel):
    status: str | None = None


class RefreshInstanceIdsResponse(CloudModel):
    total: int
    scanned: int
    updated: int
    unchanged: int
    skipped: int
    conflicts: int
    errors: int
    items: list[GenericObject] = Field(default_factory=list)


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


class AppAttestationResponse(CloudModel):
    instances: list[GenericObject] = Field(default_factory=list)


CurrentUserResponse = CurrentUserV20260121 | CurrentUserV20251028
PaginatedCvmListResponse = PaginatedCvmInfosV20260121 | PaginatedCvmInfosV20251028
