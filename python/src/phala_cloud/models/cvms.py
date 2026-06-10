from __future__ import annotations

from typing import Any, Literal

from pydantic import Field, computed_field

from .base import AliasModel, CloudModel
from .kms import KmsInfo
from .nodes import DeviceIdEntry

BillingPeriod = Literal["skip", "hourly", "monthly"]
KmsType = Literal["phala", "ethereum", "base", "legacy"]

SUPPORTED_CHAINS: dict[int, dict[str, Any]] = {
    1: {"id": 1, "name": "Ethereum", "network": "mainnet"},
    8453: {"id": 8453, "name": "Base", "network": "base"},
    31337: {"id": 31337, "name": "Anvil", "network": "anvil"},
}


class GetCvmListRequest(CloudModel):
    page: int | None = Field(default=None, ge=1)
    page_size: int | None = Field(default=None, ge=1)
    node_id: int | None = Field(default=None, ge=1)
    teepod_id: int | None = Field(default=None, ge=1)
    user_id: str | None = None


# 2026-01-21
class CvmResourceV20260121(CloudModel):
    instance_type: str | None = None
    vcpu: int | None = None
    memory_in_gb: float | None = None
    disk_in_gb: int | None = None
    gpus: int | None = None
    compute_billing_price: str | None = None
    billing_period: BillingPeriod | None = None


class CvmOsInfoV20260121(CloudModel):
    name: str | None = None
    version: str | None = None
    is_dev: bool | None = None
    os_image_hash: str | None = None


class CvmKmsInfoV20260121(CloudModel):
    chain_id: int | None = None
    dstack_kms_address: str | None = None
    dstack_app_address: str | None = None
    deployer_address: str | None = None
    rpc_endpoint: str | None = None
    encrypted_env_pubkey: str | None = None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def chain(self) -> dict[str, Any] | None:
        if self.chain_id is not None:
            return SUPPORTED_CHAINS.get(self.chain_id)
        return None


class CvmProgressInfoV20260121(CloudModel):
    target: str | None = None
    started_at: str | None = None
    correlation_id: str | None = None


class CvmGatewayInfoV20260121(CloudModel):
    base_domain: str | None = None
    cname: str | None = None


class CvmLogUrlsV20260121(CloudModel):
    serial: str | None = None
    stdout: str | None = None
    stderr: str | None = None
    container_log_base: str | None = None


class NodeRef(CloudModel):
    object_type: Literal["node"] = "node"
    id: int | None = None
    name: str | None = None
    region: str | None = None
    device_id: str | None = None
    device_ids: list[DeviceIdEntry] = Field(default_factory=list)
    ppid: str | None = None
    status: str | None = None
    version: str | None = None


class UserRef(CloudModel):
    object_type: Literal["user"] = "user"
    id: str | None = None
    username: str | None = None
    avatar_url: str | None = None


class WorkspaceRef(CloudModel):
    object_type: Literal["workspace"] = "workspace"
    id: str
    name: str
    slug: str | None = None
    avatar_url: str | None = None


class CvmRef(CloudModel):
    object_type: Literal["cvm"] = "cvm"
    id: str | None = None
    name: str | None = None
    app_id: str | None = None
    vm_uuid: str | None = None


class CvmInfoV20260121(CloudModel):
    id: str
    name: str
    app_id: str | None = None
    vm_uuid: str | None = None
    instance_id: str | None = None
    resource: CvmResourceV20260121
    node_info: NodeRef | None = None
    os: CvmOsInfoV20260121 | None = None
    kms_type: KmsType | None = None
    kms_info: CvmKmsInfoV20260121 | None = None
    status: str
    in_progress: bool = False
    progress: CvmProgressInfoV20260121 | None = None
    compose_hash: str | None = None
    docker_compose_hash: str | None = None
    pre_launch_script_hash: str | None = None
    gateway: CvmGatewayInfoV20260121 | None = None
    logs: CvmLogUrlsV20260121 = Field(default_factory=CvmLogUrlsV20260121)
    services: list | None = Field(default_factory=list)
    endpoints: list | None = None
    public_logs: bool | None = None
    public_sysinfo: bool | None = None
    public_tcbinfo: bool | None = None
    gateway_enabled: bool | None = None
    secure_time: bool | None = None
    listed: bool = False
    storage_fs: str | None = None
    workspace: WorkspaceRef | None = None
    creator: UserRef | None = None
    created_at: str | None = None
    deleted_at: str | None = None
    project_type: str | None = None
    updated_at: str | None = None
    app_url: str | None = None
    base_image: str | None = None
    features: list[str] | None = Field(default_factory=list)
    runner: str | None = None
    manifest_version: str | None = None


class CvmInfoDetailV20260121(CvmInfoV20260121):
    compose_file: str | dict | None = None


class PaginatedCvmInfosV20260121(CloudModel):
    items: list[CvmInfoV20260121]
    total: int
    page: int
    page_size: int
    pages: int


class CvmInfoV20260522(CloudModel):
    id: str
    name: str
    app_id: str | None = None
    vm_uuid: str | None = None
    instance_id: str | None = None
    resource: CvmResourceV20260121
    node_info: NodeRef | None = None
    os: CvmOsInfoV20260121 | None = None
    kms_type: KmsType | None = None
    kms_info: CvmKmsInfoV20260121 | None = None
    status: str
    in_progress: bool = False
    progress: CvmProgressInfoV20260121 | None = None
    compose_hash: str | None = None
    docker_compose_hash: str | None = None
    pre_launch_script_hash: str | None = None
    gateway: CvmGatewayInfoV20260121 | None = None
    logs: CvmLogUrlsV20260121 = Field(default_factory=CvmLogUrlsV20260121)
    services: list | None = Field(default_factory=list)
    endpoints: list | None = None
    public_logs: bool | None = None
    public_sysinfo: bool | None = None
    public_tcbinfo: bool | None = None
    gateway_enabled: bool | None = None
    secure_time: bool | None = None
    listed: bool = False
    storage_fs: str | None = None
    workspace: WorkspaceRef | None = None
    creator: UserRef | None = None
    created_at: str | None = None
    deleted_at: str | None = None
    project_type: str | None = None
    updated_at: str | None = None
    app_url: str | None = None
    base_image: str | None = None
    features: list[str] | None = Field(default_factory=list)
    runner: str | None = None
    manifest_version: str | None = None


class CvmInfoDetailV20260522(CvmInfoV20260522):
    compose_file: str | dict | None = None


class PaginatedCvmInfosV20260522(CloudModel):
    items: list[CvmInfoV20260522]
    total: int
    page: int
    page_size: int
    pages: int


# 2025-10-28 (legacy)
class VmInfoV20251028(CloudModel):
    id: str
    name: str
    status: str
    app_id: str
    instance_id: str | None = None


class CvmInfoV20251028(CloudModel):
    hosted: VmInfoV20251028
    name: str
    status: str
    in_progress: bool = False
    kms_info: KmsInfo | None = None


class PaginatedCvmInfosV20251028(CloudModel):
    items: list[CvmInfoV20251028]
    total: int
    page: int
    page_size: int
    pages: int


class CertificateSubject(CloudModel):
    common_name: str | None = None
    organization: str | None = None
    country: str | None = None
    state: str | None = None
    locality: str | None = None


class CertificateIssuer(CloudModel):
    common_name: str | None = None
    organization: str | None = None
    country: str | None = None


class Certificate(CloudModel):
    subject: CertificateSubject
    issuer: CertificateIssuer
    serial_number: str
    not_before: str
    not_after: str
    version: str
    fingerprint: str
    signature_algorithm: str
    sans: list[str] | None = None
    is_ca: bool
    position_in_chain: int | None = None
    quote: str | None = None
    app_id: str | None = None
    cert_usage: str | None = None


class EventLog(CloudModel):
    imr: int
    event_type: int
    digest: str
    event: str
    event_payload: str


class TcbInfo(CloudModel):
    mrtd: str
    rootfs_hash: str | None = None
    rtmr0: str
    rtmr1: str
    rtmr2: str
    rtmr3: str
    event_log: list[EventLog] = Field(default_factory=list)
    app_compose: str


class CvmAttestation(CloudModel):
    name: str | None = None
    is_online: bool
    is_public: bool = True
    error: str | None = None
    app_certificates: list[Certificate] | None = None
    tcb_info: TcbInfo | None = None
    compose_file: str | None = None


PaginatedCvmInfosAny = (
    PaginatedCvmInfosV20260522 | PaginatedCvmInfosV20260121 | PaginatedCvmInfosV20251028
)
PaginatedCvmInfos = PaginatedCvmInfosV20260522


# Is-Allowed types


class CheckCvmIsAllowedRequest(AliasModel):
    cvm_id: str = Field(..., alias="cvmId")
    compose_hash: str | None = None
    node_id: int | None = None
    device_id: str | None = None


class IsAllowedResultBase(CloudModel):
    app_contract_address: str
    compose_hash: str
    device_id: str
    compose_hash_allowed: bool
    allow_any_device: bool
    device_id_allowed: bool | None = None
    is_allowed: bool
    error: str | None = None


class IsAllowedResultV20260121(IsAllowedResultBase):
    cvm_id: int | None = None


class IsAllowedResultV20260522(IsAllowedResultBase):
    cvm_id: str | None = None


IsAllowedResultAny = IsAllowedResultV20260522 | IsAllowedResultV20260121
IsAllowedResult = IsAllowedResultV20260522


class CheckAppIsAllowedRequest(AliasModel):
    app_id: str = Field(..., alias="appId")
    compose_hash: str
    node_id: int | None = None
    device_id: str | None = None
    chain_id: int | None = None


class CheckAppCvmsIsAllowedRequest(AliasModel):
    app_id: str = Field(..., alias="appId")


class AppCvmsBatchIsAllowedResponseBase(CloudModel):
    is_onchain: bool
    total: int = 0
    allowed_count: int = 0
    denied_count: int = 0
    error_count: int = 0


class AppCvmsBatchIsAllowedResponseV20260121(AppCvmsBatchIsAllowedResponseBase):
    results: list[IsAllowedResultV20260121] = Field(default_factory=list)
    skipped_cvm_ids: list[int] = Field(default_factory=list)


class AppCvmsBatchIsAllowedResponseV20260522(AppCvmsBatchIsAllowedResponseBase):
    results: list[IsAllowedResultV20260522] = Field(default_factory=list)
    skipped_cvm_ids: list[str] = Field(default_factory=list)


class AppCvmsBatchIsAllowedResponseAny(AppCvmsBatchIsAllowedResponseBase):
    results: list[IsAllowedResultV20260522 | IsAllowedResultV20260121] = Field(default_factory=list)
    skipped_cvm_ids: list[int | str] = Field(default_factory=list)


AppCvmsBatchIsAllowedResponse = AppCvmsBatchIsAllowedResponseV20260522
