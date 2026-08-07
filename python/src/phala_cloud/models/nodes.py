from __future__ import annotations

from pydantic import Field

from .base import CloudModel
from .kms import KmsInfo


class AvailableOSImage(CloudModel):
    name: str
    is_dev: bool
    version: tuple[int, int, int] | tuple[int, int, int, int]
    os_image_hash: str | None = None


class DeviceIdEntry(CloudModel):
    device_id: str
    algorithm_version: str
    enabled: bool


class TeepodCapacity(CloudModel):
    teepod_id: int
    name: str
    listed: bool
    resource_score: float
    remaining_vcpu: float
    remaining_memory: float
    remaining_cvm_slots: float
    images: list[AvailableOSImage]
    support_onchain_kms: bool | None = None
    fmspc: str | None = None
    device_id: str | None = None
    device_ids: list[DeviceIdEntry] = Field(default_factory=list)
    region_identifier: str | None = None
    default_kms: str | None = None
    kms_list: list[str] = Field(default_factory=list)


class ResourceThreshold(CloudModel):
    max_instances: int | None = None
    max_vcpu: int | None = None
    max_memory: int | None = None
    max_disk: int | None = None


class GpuAvailability(CloudModel):
    has_reserved_gpus: bool = False
    reserved_gpu_count: int = 0
    has_public_gpus: bool = False
    public_gpu_count: int = 0


class AvailableNodes(CloudModel):
    tier: str
    capacity: ResourceThreshold
    nodes: list[TeepodCapacity]
    kms_list: list[KmsInfo]
    gpu_availability: GpuAvailability | None = None


class CvmCreateKmsResourceV20260121(CloudModel):
    id: int | str
    slug: str | None = None
    url: str
    version: str | None = None
    kms_type: str
    chain_id: int | None = None
    kms_contract_id: int | str | None = None
    kms_contract_address: str | None = None
    gateway_app_id: str | None = None
    supported_os_images: list[str] = Field(default_factory=list)


class CvmCreateNodeKmsRelationV20260121(CloudModel):
    teepod_id: int
    kms_id: int | str
    kms_type: str
    kms_contract_id: int | str | None = None
    kms_contract_address: str | None = None
    supported_os_images: list[str] = Field(default_factory=list)


class CvmCreateGatewayResourceV20260121(CloudModel):
    id: int | str
    teepod_id: int | None = None
    kms_contract_id: int | str
    rpc_url: str | None = None
    domain_suffix: str | None = None
    enabled: bool


class CvmCreateKmsResourceV20260522(CvmCreateKmsResourceV20260121):
    id: str
    kms_contract_id: str | None = None


class CvmCreateNodeKmsRelationV20260522(CvmCreateNodeKmsRelationV20260121):
    kms_id: str
    kms_contract_id: str | None = None


class CvmCreateGatewayResourceV20260522(CvmCreateGatewayResourceV20260121):
    id: str
    kms_contract_id: str


CvmCreateKmsResource = CvmCreateKmsResourceV20260522
CvmCreateNodeKmsRelation = CvmCreateNodeKmsRelationV20260522
CvmCreateGatewayResource = CvmCreateGatewayResourceV20260522


class CvmCreateInstanceTypeResource(CloudModel):
    id: str
    name: str
    vcpu: int
    memory_mb: int
    default_disk_size_gb: int
    requires_gpu: bool
    requires_gpu_count: int
    family: str | None = None
    display_order: int | None = None


class CvmCreateResourceGraphV20260121(CloudModel):
    tier: str
    capacity: ResourceThreshold
    nodes: list[TeepodCapacity]
    kms_nodes: list[CvmCreateKmsResourceV20260121]
    node_kms_relations: list[CvmCreateNodeKmsRelationV20260121]
    gateway_nodes: list[CvmCreateGatewayResourceV20260121]
    instance_types: list[CvmCreateInstanceTypeResource]
    gpu_availability: GpuAvailability = Field(default_factory=GpuAvailability)


class CvmCreateResourceGraphV20260522(CloudModel):
    tier: str
    capacity: ResourceThreshold
    nodes: list[TeepodCapacity]
    kms_nodes: list[CvmCreateKmsResourceV20260522]
    node_kms_relations: list[CvmCreateNodeKmsRelationV20260522]
    gateway_nodes: list[CvmCreateGatewayResourceV20260522]
    instance_types: list[CvmCreateInstanceTypeResource]
    gpu_availability: GpuAvailability = Field(default_factory=GpuAvailability)


CvmCreateResourceGraph = CvmCreateResourceGraphV20260522
CvmCreateResourceGraphAny = CvmCreateResourceGraphV20260522 | CvmCreateResourceGraphV20260121
