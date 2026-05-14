from __future__ import annotations

from pydantic import Field

from .base import CloudModel
from .kms import KmsInfo


class AvailableOSImage(CloudModel):
    name: str
    is_dev: bool
    version: tuple[int, int, int] | tuple[int, int, int, int]
    os_image_hash: str | None = None


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


class CvmCreateKmsResource(CloudModel):
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


class CvmCreateNodeKmsRelation(CloudModel):
    teepod_id: int
    kms_id: int | str
    kms_type: str
    kms_contract_id: int | str | None = None
    kms_contract_address: str | None = None
    supported_os_images: list[str] = Field(default_factory=list)


class CvmCreateGatewayResource(CloudModel):
    id: int | str
    teepod_id: int | None = None
    kms_contract_id: int | str
    rpc_url: str | None = None
    domain_suffix: str | None = None
    enabled: bool


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


class CvmCreateResourceGraph(CloudModel):
    tier: str
    capacity: ResourceThreshold
    nodes: list[TeepodCapacity]
    kms_nodes: list[CvmCreateKmsResource]
    node_kms_relations: list[CvmCreateNodeKmsRelation]
    gateway_nodes: list[CvmCreateGatewayResource]
    instance_types: list[CvmCreateInstanceTypeResource]
    gpu_availability: GpuAvailability = Field(default_factory=GpuAvailability)
