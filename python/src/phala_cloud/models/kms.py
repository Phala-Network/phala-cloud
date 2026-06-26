from __future__ import annotations

from pydantic import Field

from .base import CloudModel


class KmsInfo(CloudModel):
    id: str
    slug: str | None = None
    url: str
    version: str
    chain_id: int | None = None
    kms_contract_address: str | None = None
    gateway_app_id: str | None = None


class GetKmsListRequest(CloudModel):
    page: int | None = Field(default=None, ge=1)
    page_size: int | None = Field(default=None, ge=1)
    is_onchain: bool | None = None


class GetKmsListResponse(CloudModel):
    items: list[KmsInfo]
    total: int
    page: int
    page_size: int
    pages: int


class KmsContract(CloudModel):
    """A KMS contract: a group of equivalent KMS node replicas sharing one root key.

    ``contract_address`` is an on-chain address for ETHEREUM/BASE, or the sentinel
    ``"phala"`` for the off-chain PHALA KMS (where ``chain_id`` is ``0``).
    ``k256_pubkey`` / ``ca_pubkey`` are the verification anchors.

    Available from API version 2026-06-23.
    """

    id: str
    slug: str | None = None
    label: str | None = None
    contract_address: str
    chain_id: int
    k256_pubkey: str | None = None
    ca_pubkey: str | None = None
    node_count: int


class ListKmsContractsResponse(CloudModel):
    items: list[KmsContract]
    total: int
    page: int
    page_size: int
    pages: int


class KmsContractNode(CloudModel):
    """A single KMS node (replica) under a contract, with its RPC ``url``.

    Available from API version 2026-06-23.
    """

    id: str
    slug: str | None = None
    url: str
    version: str
    kms_type: str


class ListKmsContractNodesResponse(CloudModel):
    items: list[KmsContractNode]
    total: int


class OnChainDevice(CloudModel):
    device_id: str
    node_name: str | None = None
    on_chain_allowed: bool | None = None


class OnChainOsImage(CloudModel):
    name: str
    version: str
    os_image_hash: str | None = None
    on_chain_allowed: bool | None = None


class OnChainKmsContract(CloudModel):
    contract_address: str
    chain_id: int
    chain_name: str
    devices: list[OnChainDevice] = Field(default_factory=list)
    os_images: list[OnChainOsImage] = Field(default_factory=list)


class GetKmsOnChainDetailRequest(CloudModel):
    chain: str


class GetKmsOnChainDetailResponse(CloudModel):
    chain_name: str
    chain_id: int
    contracts: list[OnChainKmsContract] = Field(default_factory=list)
