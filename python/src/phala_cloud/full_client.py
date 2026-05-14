from __future__ import annotations

import re
import time
from collections.abc import Mapping
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, model_validator

from .action_responses import (
    AppAttestationResponse,
    AppEnvPubkeyResponse,
    AppFilterOptionsResponse,
    AppInfoResponse,
    AppListResponse,
    AppRevisionDetailResponse,
    AppRevisionsResponse,
    CommitCvmProvisionResponse,
    ComposeFileResponse,
    ComposeHashPreconditionResponse,
    CvmActionResponse,
    CvmAttestationResponse,
    CvmContainersResponse,
    CvmInfoResponse,
    CvmNetworkResponse,
    CvmStatsResponse,
    CvmUserConfigResponse,
    CvmVisibilityResponse,
    GenericObject,
    ImportGithubProfileResponse,
    InProgressResponse,
    InstanceTypesAllResponse,
    InstanceTypesFamilyResponse,
    ListWorkspacesResponse,
    NextAppIdsResponse,
    ProvisionCvmComposeFileUpdateResult,
    ProvisionCvmResponse,
    RefreshInstanceIdResponse,
    RefreshInstanceIdsResponse,
    SshKeyResponse,
    SyncGithubSshKeysResponse,
    WorkspaceNodesResponse,
    WorkspaceQuotasResponse,
    WorkspaceResponse,
)
from .blockchains import add_compose_hash as _add_compose_hash
from .blockchains import deploy_app_auth as _deploy_app_auth
from .client import AsyncPhalaCloud as _AsyncBase
from .client import PhalaCloud as _SyncBase
from .errors import ApiError
from .models.apps import DeviceAllowlistResponse as _DeviceAllowlistResponse
from .models.auth import CurrentUserV20251028, CurrentUserV20260121
from .models.base import CloudModel
from .models.cvms import (
    CheckAppCvmsIsAllowedRequest,
    CheckAppIsAllowedRequest,
    CheckCvmIsAllowedRequest,
    CvmInfoV20260121,
    PaginatedCvmInfosV20251028,
    PaginatedCvmInfosV20260121,
)
from .models.kms import GetKmsListResponse, GetKmsOnChainDetailResponse, KmsInfo
from .models.nodes import AvailableNodes, CvmCreateResourceGraph
from .models.os_images import GetOsImagesRequest, GetOsImagesResponse
from .result import SafeResult


class _AliasModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class CvmIdRequest(BaseModel):
    id: str | None = None
    uuid: str | None = None
    app_id: str | None = None
    instance_id: str | None = None
    cvm_id: str | None = None
    cvmId: str | None = None

    @model_validator(mode="after")
    def _check_one(self) -> CvmIdRequest:
        if not any([self.id, self.uuid, self.app_id, self.instance_id, self.cvm_id, self.cvmId]):
            raise ValueError("One of id/uuid/app_id/instance_id/cvm_id/cvmId is required")
        return self

    @property
    def resolved(self) -> str:
        return (
            self.cvm_id
            or self.cvmId
            or self.id
            or self.uuid
            or self.app_id
            or self.instance_id
            or ""
        )


class FamilyRequest(BaseModel):
    family: str


class TeamSlugRequest(_AliasModel):
    team_slug: str = Field(alias="teamSlug")


class WorkspaceNodesRequest(_AliasModel):
    team_slug: str = Field(alias="teamSlug")
    page: int | None = Field(default=None, ge=1)
    page_size: int | None = Field(default=None, ge=1, alias="pageSize")


class AppIdRequest(_AliasModel):
    app_id: str = Field(alias="appId")


class AppRevisionsRequest(_AliasModel):
    app_id: str = Field(alias="appId")
    page: int | None = Field(default=None, ge=1)
    page_size: int | None = Field(default=None, ge=1)


class CreateAppInstanceRequest(_AliasModel):
    app_id: str = Field(alias="appId")
    node_id: int | None = None
    docker_compose_file: str | None = None
    pre_launch_script: str | None = None
    encrypted_env: str | None = None
    compose_hash: str | None = None
    token: str | None = None
    transaction_hash: str | None = None


class AppRevisionDetailRequest(_AliasModel):
    app_id: str = Field(alias="appId")
    revision_id: str = Field(alias="revisionId")
    raw_compose_file: bool | None = Field(default=None, alias="rawComposeFile")


class KeyIdRequest(_AliasModel):
    key_id: str = Field(alias="keyId")


class GithubUserRequest(BaseModel):
    github_username: str


class CreateSshKeyRequest(BaseModel):
    name: str
    public_key: str


class KmsInfoRequest(BaseModel):
    kms_id: str


class KmsPubkeyRequest(BaseModel):
    kms: str
    app_id: str


class NextAppIdsRequest(BaseModel):
    counts: int = Field(default=1, ge=1, le=20)


class StatusBatchRequest(_AliasModel):
    vm_uuids: list[str] = Field(alias="vmUuids")


class RestartCvmRequest(CvmIdRequest):
    force: bool = False


class ReplicateCvmRequest(CvmIdRequest):
    node_id: int | None = None


class UpdateResourcesRequest(CvmIdRequest):
    vcpu: float | None = None
    memory: float | None = None
    disk_size: float | None = None
    instance_type: str | None = None
    allow_restart: bool | None = None


class UpdateVisibilityRequest(CvmIdRequest):
    public_sysinfo: bool
    public_logs: bool
    public_tcbinfo: bool | None = None


class UpdateOsImageRequest(CvmIdRequest):
    os_image_name: str


class KmsOnChainDetailRequest(BaseModel):
    chain: str


class GetAppDeviceAllowlistRequest(_AliasModel):
    app_id: str = Field(alias="appId")


class RefreshCvmInstanceIdRequest(CvmIdRequest):
    overwrite: bool = False
    dry_run: bool = False


class RefreshCvmInstanceIdsRequest(BaseModel):
    cvm_ids: list[str] | None = None
    running_only: bool | None = None
    missing_only: bool | None = None
    overwrite: bool | None = None
    limit: int | None = Field(default=None, ge=1, le=500)
    dry_run: bool | None = None


class WatchCvmStateRequest(CvmIdRequest):
    target: str
    interval: int = Field(default=5, ge=5, le=30)
    timeout: int = Field(default=300, ge=10, le=600)
    max_retries: int | None = Field(default=None, ge=0, alias="maxRetries")
    retry_delay: float = Field(default=5.0, ge=0, alias="retryDelay")


class PatchCvmRequest(CvmIdRequest):
    docker_compose_file: str | None = None
    pre_launch_script: str | None = None
    allowed_envs: list[str] | None = None
    public_logs: bool | None = None
    public_sysinfo: bool | None = None
    public_tcbinfo: bool | None = None
    encrypted_env: str | None = None
    user_config: str | None = None
    gpus: dict[str, Any] | None = None
    vcpu: int | None = None
    memory: int | None = None
    disk_size: int | None = None
    image: str | None = None
    shutdown_timeout: int | None = None
    allow_force_stop: bool | None = None


class ConfirmCvmPatchRequest(CvmIdRequest):
    compose_hash: str = Field(alias="composeHash")
    transaction_hash: str = Field(alias="transactionHash")

    model_config = ConfigDict(populate_by_name=True)


class _ExtMixin:
    @staticmethod
    def _loose_validate(data: Any) -> Any:
        if data is None:
            return None
        if isinstance(data, list):
            if all(isinstance(item, BaseModel) for item in data):
                return data
            return TypeAdapter(list[CloudModel]).validate_python(data)
        if isinstance(data, dict):
            return CloudModel.model_validate(data)
        return data

    @staticmethod
    def _extract_465_fields(exc: Exception) -> dict[str, Any] | None:
        status = getattr(exc, "status_code", None)
        if status != 465:
            return None
        detail = getattr(exc, "detail", None)
        if not isinstance(detail, dict):
            return None

        # New StructuredError format: fields live inside a `details` array.
        details_array = detail.get("details")
        if isinstance(details_array, list):
            field_map: dict[str, Any] = {
                item["field"]: item.get("value")
                for item in details_array
                if isinstance(item, dict) and "field" in item
            }
            compose_hash = field_map.get("compose_hash")
            app_id = field_map.get("app_id")
            if compose_hash is not None and app_id is not None:
                return {
                    "message": detail.get("message", "Compose hash verification required"),
                    "compose_hash": compose_hash,
                    "app_id": app_id,
                    "device_id": field_map.get("device_id", ""),
                    "kms_info": field_map.get("kms_info"),
                }

        # Legacy flat format: fields are top-level in `detail`.
        if detail.get("compose_hash") is not None or detail.get("app_id") is not None:
            return {
                "message": detail.get("message", "Compose hash verification required"),
                "compose_hash": detail.get("compose_hash"),
                "app_id": detail.get("app_id"),
                "device_id": detail.get("device_id"),
                "kms_info": detail.get("kms_info"),
            }

        return None

    def _model_for_response(self, method: str, path: str) -> Any | None:
        m = method.upper()

        if m == "GET" and path == "/auth/me":
            return (
                CurrentUserV20251028
                if self.config.version == "2025-10-28"
                else CurrentUserV20260121
            )
        if m == "GET" and path == "/teepods/available":
            return AvailableNodes
        if m == "GET" and path == "/teepods/cvm-create-resources":
            return CvmCreateResourceGraph
        if m == "GET" and path == "/cvms/paginated":
            return (
                PaginatedCvmInfosV20251028
                if self.config.version == "2025-10-28"
                else PaginatedCvmInfosV20260121
            )
        if m == "GET" and path == "/kms":
            return GetKmsListResponse
        if m == "GET" and path == "/instance-types":
            return InstanceTypesAllResponse
        if m == "GET" and re.fullmatch(r"/instance-types/[^/]+", path):
            return InstanceTypesFamilyResponse
        if m == "GET" and path == "/workspaces":
            return ListWorkspacesResponse
        if m == "GET" and re.fullmatch(r"/workspaces/[^/]+", path):
            return WorkspaceResponse
        if m == "GET" and re.fullmatch(r"/workspaces/[^/]+/nodes", path):
            return WorkspaceNodesResponse
        if m == "GET" and re.fullmatch(r"/workspaces/[^/]+/quotas", path):
            return WorkspaceQuotasResponse

        if m == "POST" and path == "/cvms/provision":
            return ProvisionCvmResponse
        if m == "POST" and path == "/cvms":
            return CommitCvmProvisionResponse
        if m == "POST" and re.fullmatch(r"/cvms/[^/]+/compose_file/provision", path):
            return ProvisionCvmComposeFileUpdateResult
        if m == "POST" and re.fullmatch(r"/apps/[^/]+/instances", path):
            return CvmInfoV20260121

        if m == "PATCH" and re.fullmatch(r"/cvms/[^/]+/envs", path):
            return InProgressResponse | ComposeHashPreconditionResponse
        if m == "PATCH" and re.fullmatch(r"/cvms/[^/]+/docker-compose", path):
            return InProgressResponse | ComposeHashPreconditionResponse
        if m == "PATCH" and re.fullmatch(r"/cvms/[^/]+/pre-launch-script", path):
            return InProgressResponse | ComposeHashPreconditionResponse
        if m == "PATCH" and re.fullmatch(r"/cvms/[^/]+/(resources|os-image)", path):
            return type(None)
        if m == "PATCH" and re.fullmatch(r"/cvms/[^/]+/compose_file", path):
            return type(None)

        if m == "GET" and re.fullmatch(r"/cvms/[^/]+/state", path):
            return CvmInfoResponse
        if m == "GET" and re.fullmatch(r"/cvms/[^/]+/available-os-images", path):
            return list[GenericObject]
        if m == "GET" and re.fullmatch(r"/cvms/[^/]+/pre-launch-script", path):
            return str
        if m == "GET" and re.fullmatch(r"/cvms/[^/]+/docker-compose\.yml", path):
            return str
        if m == "GET" and re.fullmatch(r"/cvms/[^/]+/compose_file", path):
            return ComposeFileResponse
        if m == "GET" and re.fullmatch(r"/cvms/[^/]+/stats", path):
            return CvmStatsResponse
        if m == "GET" and re.fullmatch(r"/cvms/[^/]+/network", path):
            return CvmNetworkResponse
        if m == "GET" and re.fullmatch(r"/cvms/[^/]+/composition", path):
            return CvmContainersResponse
        if m == "GET" and re.fullmatch(r"/cvms/[^/]+/attestation", path):
            return CvmAttestationResponse
        if m == "GET" and re.fullmatch(r"/cvms/[^/]+/user_config", path):
            return CvmUserConfigResponse
        if m == "GET" and re.fullmatch(r"/cvms/[^/]+", path):
            return CvmInfoResponse
        if m == "GET" and re.fullmatch(r"/kms/on-chain/[^/]+", path):
            return GetKmsOnChainDetailResponse
        if m == "GET" and re.fullmatch(r"/kms/[^/]+", path):
            return KmsInfo
        if m == "GET" and re.fullmatch(r"/kms/[^/]+/pubkey/[^/]+", path):
            return AppEnvPubkeyResponse
        if m == "GET" and path == "/kms/phala/next_app_id":
            return NextAppIdsResponse

        if m == "GET" and path == "/user/ssh-keys":
            return list[SshKeyResponse]
        if m == "POST" and path == "/user/ssh-keys":
            return SshKeyResponse
        if m == "POST" and path == "/user/ssh-keys/github-profile":
            return ImportGithubProfileResponse
        if m == "POST" and path == "/user/ssh-keys/github-sync":
            return SyncGithubSshKeysResponse

        if m == "POST" and re.fullmatch(
            r"/cvms/[^/]+/(start|stop|shutdown|restart|replicas)", path
        ):
            return CvmActionResponse
        if m == "PATCH" and re.fullmatch(r"/cvms/[^/]+/visibility", path):
            return CvmVisibilityResponse
        if m == "PATCH" and re.fullmatch(r"/cvms/[^/]+/instance-id", path):
            return RefreshInstanceIdResponse
        if m == "PATCH" and path == "/cvms/instance-ids":
            return RefreshInstanceIdsResponse

        if m == "GET" and path == "/apps":
            return AppListResponse
        if m == "GET" and path == "/apps/filter-options":
            return AppFilterOptionsResponse
        if m == "GET" and re.fullmatch(r"/apps/[^/]+/device-allowlist", path):
            return _DeviceAllowlistResponse
        if m == "GET" and re.fullmatch(r"/apps/[^/]+/cvms", path):
            return list[GenericObject]
        if m == "GET" and re.fullmatch(r"/apps/[^/]+/revisions", path):
            return AppRevisionsResponse
        if m == "GET" and re.fullmatch(r"/apps/[^/]+/revisions/[^/]+", path):
            return AppRevisionDetailResponse
        if m == "GET" and re.fullmatch(r"/apps/[^/]+/attestations", path):
            return AppAttestationResponse
        if m == "GET" and re.fullmatch(r"/apps/[^/]+", path):
            return AppInfoResponse

        if m == "GET" and path == "/os-images":
            return GetOsImagesResponse

        if m == "POST" and path == "/status/batch":
            return dict[str, GenericObject]

        if m == "DELETE":
            return type(None)

        # Most resources return JSON objects with extendable fields.
        if m in {"GET", "POST", "PATCH", "PUT"}:
            if re.fullmatch(r"/cvms/[^/]+(?:/.+)?", path):
                return GenericObject
            if re.fullmatch(r"/apps(?:/.+)?", path):
                return GenericObject

        return None

    def _validate_by_model(self, model: Any, data: Any) -> Any:
        if model is None:
            return data
        if model is type(None):
            return None
        return TypeAdapter(model).validate_python(data)

    def _normalize_path(self, path: str) -> str:
        if path.startswith("http://") or path.startswith("https://"):
            # Best effort fallback: use suffix after /api/v1
            marker = "/api/v1"
            idx = path.find(marker)
            if idx >= 0:
                path = path[idx + len(marker) :]
        return path.split("?", 1)[0]


class PhalaCloud(_SyncBase, _ExtMixin):
    def request(self, method: str, path: str, **kwargs: Any) -> Any:
        data = super().request(method, path, **kwargs)
        model = self._model_for_response(method, self._normalize_path(path))
        return self._validate_by_model(model, data)

    def get(self, path: str, *, params: Mapping[str, Any] | None = None) -> Any:
        return self.request("GET", path, params=params)

    def post(
        self,
        path: str,
        *,
        json: Any | None = None,
        content: Any | None = None,
        headers: Mapping[str, str] | None = None,
    ) -> Any:
        return self.request("POST", path, json=json, content=content, headers=headers)

    def list_all_instance_type_families(self) -> Any:
        return self.get("/instance-types")

    def safe_list_all_instance_type_families(self) -> SafeResult[Any]:
        return self.safe(self.list_all_instance_type_families)

    def list_family_instance_types(self, request: FamilyRequest | Mapping[str, Any]) -> Any:
        req = FamilyRequest.model_validate(request)
        return self._loose_validate(self.get(f"/instance-types/{req.family}"))

    def safe_list_family_instance_types(
        self, request: FamilyRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return self.safe(self.list_family_instance_types, request)

    def list_workspaces(self, request: Mapping[str, Any] | None = None) -> Any:
        params = dict(request or {})
        return self._loose_validate(self.get("/workspaces", params=params or None))

    def safe_list_workspaces(self, request: Mapping[str, Any] | None = None) -> SafeResult[Any]:
        return self.safe(self.list_workspaces, request)

    def get_workspace(self, request: str | TeamSlugRequest | Mapping[str, Any]) -> Any:
        if isinstance(request, str):
            team_slug = request
        else:
            req = TeamSlugRequest.model_validate(request)
            team_slug = req.team_slug
        return self._loose_validate(self.get(f"/workspaces/{team_slug}"))

    def safe_get_workspace(
        self, request: str | TeamSlugRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return self.safe(self.get_workspace, request)

    def get_workspace_nodes(self, request: WorkspaceNodesRequest | Mapping[str, Any]) -> Any:
        req = WorkspaceNodesRequest.model_validate(request)
        params = {"page": req.page, "page_size": req.page_size}
        params = {k: v for k, v in params.items() if v is not None}
        return self._loose_validate(
            self.get(f"/workspaces/{req.team_slug}/nodes", params=params or None)
        )

    def safe_get_workspace_nodes(
        self, request: WorkspaceNodesRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return self.safe(self.get_workspace_nodes, request)

    def get_workspace_quotas(self, request: str | TeamSlugRequest | Mapping[str, Any]) -> Any:
        if isinstance(request, str):
            team_slug = request
        else:
            req = TeamSlugRequest.model_validate(request)
            team_slug = req.team_slug
        return self._loose_validate(self.get(f"/workspaces/{team_slug}/quotas"))

    def safe_get_workspace_quotas(
        self, request: str | TeamSlugRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return self.safe(self.get_workspace_quotas, request)

    def get_cvm_info(self, request: CvmIdRequest | Mapping[str, Any]) -> Any:
        cvm_id = CvmIdRequest.model_validate(request).resolved
        return self._loose_validate(self.get(f"/cvms/{cvm_id}"))

    def safe_get_cvm_info(self, request: CvmIdRequest | Mapping[str, Any]) -> SafeResult[Any]:
        return self.safe(self.get_cvm_info, request)

    def provision_cvm(self, request: Mapping[str, Any]) -> Any:
        body = dict(request)
        if "compose_file" in body:
            cf = dict(body["compose_file"])
            cf.setdefault("name", "")
            body["compose_file"] = cf
        return self._loose_validate(self.post("/cvms/provision", json=body))

    def safe_provision_cvm(self, request: Mapping[str, Any]) -> SafeResult[Any]:
        return self.safe(self.provision_cvm, request)

    def commit_cvm_provision(self, request: Mapping[str, Any]) -> Any:
        """Commit a provisioned CVM, creating the actual instance.

        This endpoint is idempotent: submitting the same app_id + compose_hash
        again returns the existing CVM. A different compose_hash for the same
        app_id raises ResourceError with error_code CVM_APP_ID_CONFLICT (409).
        """
        return self._loose_validate(self.post("/cvms", json=dict(request)))

    def safe_commit_cvm_provision(self, request: Mapping[str, Any]) -> SafeResult[Any]:
        return self.safe(self.commit_cvm_provision, request)

    def get_cvm_compose_file(self, request: CvmIdRequest | Mapping[str, Any]) -> Any:
        cvm_id = CvmIdRequest.model_validate(request).resolved
        return self._loose_validate(self.get(f"/cvms/{cvm_id}/compose_file"))

    def safe_get_cvm_compose_file(
        self, request: CvmIdRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return self.safe(self.get_cvm_compose_file, request)

    def provision_cvm_compose_file_update(
        self, request: Mapping[str, Any]
    ) -> ProvisionCvmComposeFileUpdateResult:
        req = dict(request)
        cvm_id = CvmIdRequest.model_validate(req).resolved
        body = dict(req.get("app_compose") or {})
        if "update_env_vars" in req:
            body["update_env_vars"] = req["update_env_vars"]
        return self._validate(
            ProvisionCvmComposeFileUpdateResult,
            self.post(f"/cvms/{cvm_id}/compose_file/provision", json=body),
        )

    def safe_provision_cvm_compose_file_update(
        self, request: Mapping[str, Any]
    ) -> SafeResult[ProvisionCvmComposeFileUpdateResult]:
        return self.safe(self.provision_cvm_compose_file_update, request)

    def commit_cvm_compose_file_update(self, request: Mapping[str, Any]) -> Any:
        req = dict(request)
        cvm_id = CvmIdRequest.model_validate(req).resolved
        body = {
            "compose_hash": req.get("compose_hash"),
            "encrypted_env": req.get("encrypted_env"),
            "env_keys": req.get("env_keys"),
            "update_env_vars": req.get("update_env_vars"),
        }
        return self._loose_validate(
            self.request("PATCH", f"/cvms/{cvm_id}/compose_file", json=body)
        )

    def safe_commit_cvm_compose_file_update(self, request: Mapping[str, Any]) -> SafeResult[Any]:
        return self.safe(self.commit_cvm_compose_file_update, request)

    def update_cvm_envs(self, request: Mapping[str, Any]) -> Any:
        req = dict(request)
        cvm_id = CvmIdRequest.model_validate(req).resolved
        body = {
            "encrypted_env": req.get("encrypted_env"),
            "env_keys": req.get("env_keys"),
            "compose_hash": req.get("compose_hash"),
            "transaction_hash": req.get("transaction_hash"),
        }
        try:
            return self._loose_validate(self.request("PATCH", f"/cvms/{cvm_id}/envs", json=body))
        except Exception as exc:
            fields = self._extract_465_fields(exc)
            if fields is not None:
                return self._loose_validate({"status": "precondition_required", **fields})
            raise

    def safe_update_cvm_envs(self, request: Mapping[str, Any]) -> SafeResult[Any]:
        return self.safe(self.update_cvm_envs, request)

    def update_docker_compose(self, request: Mapping[str, Any]) -> Any:
        req = dict(request)
        cvm_id = CvmIdRequest.model_validate(req).resolved
        headers: dict[str, str] = {"Content-Type": "text/yaml"}
        if req.get("compose_hash"):
            headers["X-Compose-Hash"] = str(req["compose_hash"])
        if req.get("transaction_hash"):
            headers["X-Transaction-Hash"] = str(req["transaction_hash"])
        try:
            return self._loose_validate(
                self.request(
                    "PATCH",
                    f"/cvms/{cvm_id}/docker-compose",
                    content=str(req.get("docker_compose_file", "")),
                    headers=headers,
                ),
            )
        except Exception as exc:
            fields = self._extract_465_fields(exc)
            if fields is not None:
                return self._loose_validate({"status": "precondition_required", **fields})
            raise

    def safe_update_docker_compose(self, request: Mapping[str, Any]) -> SafeResult[Any]:
        return self.safe(self.update_docker_compose, request)

    def update_pre_launch_script(self, request: Mapping[str, Any]) -> Any:
        req = dict(request)
        cvm_id = CvmIdRequest.model_validate(req).resolved
        headers: dict[str, str] = {"Content-Type": "text/plain"}
        if req.get("compose_hash"):
            headers["X-Compose-Hash"] = str(req["compose_hash"])
        if req.get("transaction_hash"):
            headers["X-Transaction-Hash"] = str(req["transaction_hash"])
        try:
            return self._loose_validate(
                self.request(
                    "PATCH",
                    f"/cvms/{cvm_id}/pre-launch-script",
                    content=str(req.get("pre_launch_script", "")),
                    headers=headers,
                ),
            )
        except Exception as exc:
            fields = self._extract_465_fields(exc)
            if fields is not None:
                return self._loose_validate({"status": "precondition_required", **fields})
            raise

    def safe_update_pre_launch_script(self, request: Mapping[str, Any]) -> SafeResult[Any]:
        return self.safe(self.update_pre_launch_script, request)

    def get_cvm_pre_launch_script(self, request: CvmIdRequest | Mapping[str, Any]) -> str:
        cvm_id = CvmIdRequest.model_validate(request).resolved
        return str(self.get(f"/cvms/{cvm_id}/pre-launch-script"))

    def safe_get_cvm_pre_launch_script(
        self, request: CvmIdRequest | Mapping[str, Any]
    ) -> SafeResult[str]:
        return self.safe(self.get_cvm_pre_launch_script, request)

    def start_cvm(self, request: CvmIdRequest | Mapping[str, Any]) -> Any:
        cvm_id = CvmIdRequest.model_validate(request).resolved
        return self._loose_validate(self.post(f"/cvms/{cvm_id}/start"))

    def safe_start_cvm(self, request: CvmIdRequest | Mapping[str, Any]) -> SafeResult[Any]:
        return self.safe(self.start_cvm, request)

    def stop_cvm(self, request: CvmIdRequest | Mapping[str, Any]) -> Any:
        cvm_id = CvmIdRequest.model_validate(request).resolved
        return self._loose_validate(self.post(f"/cvms/{cvm_id}/stop"))

    def safe_stop_cvm(self, request: CvmIdRequest | Mapping[str, Any]) -> SafeResult[Any]:
        return self.safe(self.stop_cvm, request)

    def shutdown_cvm(self, request: CvmIdRequest | Mapping[str, Any]) -> Any:
        cvm_id = CvmIdRequest.model_validate(request).resolved
        return self._loose_validate(self.post(f"/cvms/{cvm_id}/shutdown"))

    def safe_shutdown_cvm(self, request: CvmIdRequest | Mapping[str, Any]) -> SafeResult[Any]:
        return self.safe(self.shutdown_cvm, request)

    def restart_cvm(self, request: RestartCvmRequest | Mapping[str, Any]) -> Any:
        req = RestartCvmRequest.model_validate(request)
        return self._loose_validate(
            self.post(f"/cvms/{req.resolved}/restart", json={"force": req.force})
        )

    def safe_restart_cvm(self, request: RestartCvmRequest | Mapping[str, Any]) -> SafeResult[Any]:
        return self.safe(self.restart_cvm, request)

    def delete_cvm(self, request: CvmIdRequest | Mapping[str, Any]) -> None:
        cvm_id = CvmIdRequest.model_validate(request).resolved
        self.request("DELETE", f"/cvms/{cvm_id}")
        return None

    def safe_delete_cvm(self, request: CvmIdRequest | Mapping[str, Any]) -> SafeResult[None]:
        return self.safe(self.delete_cvm, request)

    def get_cvm_stats(self, request: CvmIdRequest | Mapping[str, Any]) -> Any:
        cvm_id = CvmIdRequest.model_validate(request).resolved
        return self._loose_validate(self.get(f"/cvms/{cvm_id}/stats"))

    def safe_get_cvm_stats(self, request: CvmIdRequest | Mapping[str, Any]) -> SafeResult[Any]:
        return self.safe(self.get_cvm_stats, request)

    def get_cvm_network(self, request: CvmIdRequest | Mapping[str, Any]) -> Any:
        cvm_id = CvmIdRequest.model_validate(request).resolved
        return self._loose_validate(self.get(f"/cvms/{cvm_id}/network"))

    def safe_get_cvm_network(self, request: CvmIdRequest | Mapping[str, Any]) -> SafeResult[Any]:
        return self.safe(self.get_cvm_network, request)

    def get_cvm_docker_compose(self, request: CvmIdRequest | Mapping[str, Any]) -> str:
        cvm_id = CvmIdRequest.model_validate(request).resolved
        return str(self.get(f"/cvms/{cvm_id}/docker-compose.yml"))

    def safe_get_cvm_docker_compose(
        self, request: CvmIdRequest | Mapping[str, Any]
    ) -> SafeResult[str]:
        return self.safe(self.get_cvm_docker_compose, request)

    def get_cvm_containers_stats(self, request: CvmIdRequest | Mapping[str, Any]) -> Any:
        cvm_id = CvmIdRequest.model_validate(request).resolved
        return self._loose_validate(self.get(f"/cvms/{cvm_id}/composition"))

    def safe_get_cvm_containers_stats(
        self, request: CvmIdRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return self.safe(self.get_cvm_containers_stats, request)

    def get_cvm_attestation(self, request: CvmIdRequest | Mapping[str, Any]) -> Any:
        cvm_id = CvmIdRequest.model_validate(request).resolved
        return self._loose_validate(self.get(f"/cvms/{cvm_id}/attestation"))

    def safe_get_cvm_attestation(
        self, request: CvmIdRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return self.safe(self.get_cvm_attestation, request)

    def update_cvm_resources(self, request: UpdateResourcesRequest | Mapping[str, Any]) -> None:
        req = UpdateResourcesRequest.model_validate(request)
        body = req.model_dump(exclude_none=True)
        body.pop("id", None)
        body.pop("uuid", None)
        body.pop("app_id", None)
        body.pop("instance_id", None)
        body.pop("cvm_id", None)
        body.pop("cvmId", None)
        self.request("PATCH", f"/cvms/{req.resolved}/resources", json=body)
        return None

    def safe_update_cvm_resources(
        self, request: UpdateResourcesRequest | Mapping[str, Any]
    ) -> SafeResult[None]:
        return self.safe(self.update_cvm_resources, request)

    def update_cvm_visibility(self, request: UpdateVisibilityRequest | Mapping[str, Any]) -> Any:
        req = UpdateVisibilityRequest.model_validate(request)
        body = {
            "public_sysinfo": req.public_sysinfo,
            "public_logs": req.public_logs,
            "public_tcbinfo": req.public_tcbinfo,
        }
        return self._loose_validate(
            self.request("PATCH", f"/cvms/{req.resolved}/visibility", json=body)
        )

    def safe_update_cvm_visibility(
        self, request: UpdateVisibilityRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return self.safe(self.update_cvm_visibility, request)

    def get_available_os_images(self, request: CvmIdRequest | Mapping[str, Any]) -> Any:
        cvm_id = CvmIdRequest.model_validate(request).resolved
        return self._loose_validate(self.get(f"/cvms/{cvm_id}/available-os-images"))

    def safe_get_available_os_images(
        self, request: CvmIdRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return self.safe(self.get_available_os_images, request)

    def update_os_image(self, request: UpdateOsImageRequest | Mapping[str, Any]) -> None:
        req = UpdateOsImageRequest.model_validate(request)
        self.request(
            "PATCH", f"/cvms/{req.resolved}/os-image", json={"os_image_name": req.os_image_name}
        )
        return None

    def safe_update_os_image(
        self, request: UpdateOsImageRequest | Mapping[str, Any]
    ) -> SafeResult[None]:
        return self.safe(self.update_os_image, request)

    def patch_cvm(self, request: PatchCvmRequest | Mapping[str, Any]) -> dict[str, Any]:
        req = PatchCvmRequest.model_validate(request)
        cvm_id = req.resolved
        body = req.model_dump(
            exclude={"id", "uuid", "app_id", "instance_id", "cvm_id", "cvmId"},
            exclude_none=True,
        )
        try:
            data = self._loose_validate(self.request("PATCH", f"/cvms/{cvm_id}", json=body))
            correlation_id = ""
            if isinstance(data, dict):
                correlation_id = data.get("correlation_id", "")
            elif data is not None:
                correlation_id = str(getattr(data, "correlation_id", ""))
            return {"requires_on_chain_hash": False, "correlation_id": correlation_id}
        except ApiError as exc:
            if exc.status_code == 465 and isinstance(exc.detail, dict):
                details: dict[str, Any] = {}
                for item in exc.detail.get("details") or []:
                    if isinstance(item, dict) and "field" in item and "value" in item:
                        details[item["field"]] = item["value"]
                return {
                    "requires_on_chain_hash": True,
                    "compose_hash": details.get("compose_hash", ""),
                    "app_id": str(details.get("app_id", "")),
                    "device_id": details.get("device_id", ""),
                    "kms_info": details.get("kms_info"),
                }
            raise

    def safe_patch_cvm(
        self, request: PatchCvmRequest | Mapping[str, Any]
    ) -> SafeResult[dict[str, Any]]:
        return self.safe(self.patch_cvm, request)

    def confirm_cvm_patch(
        self, request: ConfirmCvmPatchRequest | Mapping[str, Any]
    ) -> dict[str, Any]:
        req = ConfirmCvmPatchRequest.model_validate(request)
        cvm_id = req.resolved
        data = self._loose_validate(
            self.request(
                "PATCH",
                f"/cvms/{cvm_id}",
                json={},
                headers={
                    "X-Compose-Hash": req.compose_hash,
                    "X-Transaction-Hash": req.transaction_hash,
                },
            )
        )
        correlation_id = ""
        if isinstance(data, dict):
            correlation_id = data.get("correlation_id", "")
        elif data is not None:
            correlation_id = str(getattr(data, "correlation_id", ""))
        return {"correlation_id": correlation_id}

    def safe_confirm_cvm_patch(
        self, request: ConfirmCvmPatchRequest | Mapping[str, Any]
    ) -> SafeResult[dict[str, Any]]:
        return self.safe(self.confirm_cvm_patch, request)

    def get_cvm_state(self, request: CvmIdRequest | Mapping[str, Any]) -> Any:
        cvm_id = CvmIdRequest.model_validate(request).resolved
        return self._loose_validate(self.get(f"/cvms/{cvm_id}/state"))

    def safe_get_cvm_state(self, request: CvmIdRequest | Mapping[str, Any]) -> SafeResult[Any]:
        return self.safe(self.get_cvm_state, request)

    def watch_cvm_state(self, request: WatchCvmStateRequest | Mapping[str, Any]) -> Any:
        req = WatchCvmStateRequest.model_validate(request)
        retries = 0
        max_retries = req.max_retries

        while max_retries is None or retries <= max_retries:
            params = {
                "target": req.target,
                "interval": str(req.interval),
                "timeout": str(req.timeout),
            }
            last_state: Any = None
            should_retry = False
            event_type: str | None = None
            event_data: str | None = None

            def process_event(ev: str | None, data: str | None) -> Any | None:
                nonlocal last_state, should_retry
                if not ev or not data:
                    return None
                try:
                    payload = TypeAdapter(dict[str, Any]).validate_json(data)
                except Exception:
                    payload = {"error": "invalid_sse_payload", "raw": data}
                if ev == "state":
                    last_state = GenericObject.model_validate(payload)
                    return None
                if ev == "complete":
                    return GenericObject.model_validate(payload)
                if ev in {"timeout", "error"}:
                    should_retry = True
                return None

            with self._client.stream(
                "GET",
                f"/cvms/{req.resolved}/state",
                params=params,
                headers={"Accept": "text/event-stream", "Cache-Control": "no-cache"},
            ) as response:
                response.raise_for_status()
                for raw in response.iter_lines():
                    line = raw.decode() if isinstance(raw, bytes) else raw
                    line = line.strip()
                    if line.startswith("event:"):
                        maybe = process_event(event_type, event_data)
                        if maybe is not None:
                            return maybe
                        event_type = line[6:].strip()
                        event_data = None
                    elif line.startswith("data:"):
                        event_data = line[5:].strip()
                    elif line == "":
                        maybe = process_event(event_type, event_data)
                        if maybe is not None:
                            return maybe
                        event_type = None
                        event_data = None

            maybe = process_event(event_type, event_data)
            if maybe is not None:
                return maybe

            if (
                isinstance(last_state, BaseModel)
                and getattr(last_state, "status", None) == req.target
            ):
                return last_state

            retries += 1
            if max_retries is not None and retries > max_retries:
                break
            if req.retry_delay > 0:
                time.sleep(req.retry_delay)

        raise TimeoutError(f"watch_cvm_state exceeded retries waiting for '{req.target}'")

    def get_kms_info(self, request: KmsInfoRequest | Mapping[str, Any]) -> Any:
        req = KmsInfoRequest.model_validate(request)
        return self._loose_validate(self.get(f"/kms/{req.kms_id}"))

    def safe_get_kms_info(self, request: KmsInfoRequest | Mapping[str, Any]) -> SafeResult[Any]:
        return self.safe(self.get_kms_info, request)

    def get_app_env_encrypt_pub_key(self, request: KmsPubkeyRequest | Mapping[str, Any]) -> Any:
        req = KmsPubkeyRequest.model_validate(request)
        return self._loose_validate(self.get(f"/kms/{req.kms}/pubkey/{req.app_id}"))

    def safe_get_app_env_encrypt_pub_key(
        self, request: KmsPubkeyRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return self.safe(self.get_app_env_encrypt_pub_key, request)

    def next_app_ids(self, request: NextAppIdsRequest | Mapping[str, Any] | None = None) -> Any:
        req = NextAppIdsRequest.model_validate(request or {})
        return self._loose_validate(
            self.get("/kms/phala/next_app_id", params={"counts": req.counts})
        )

    def safe_next_app_ids(
        self, request: NextAppIdsRequest | Mapping[str, Any] | None = None
    ) -> SafeResult[Any]:
        return self.safe(self.next_app_ids, request)

    def list_ssh_keys(self) -> Any:
        return self._loose_validate(self.get("/user/ssh-keys"))

    def safe_list_ssh_keys(self) -> SafeResult[Any]:
        return self.safe(self.list_ssh_keys)

    def import_github_profile_ssh_keys(self, request: GithubUserRequest | Mapping[str, Any]) -> Any:
        req = GithubUserRequest.model_validate(request)
        return self._loose_validate(
            self.post("/user/ssh-keys/github-profile", json=req.model_dump())
        )

    def safe_import_github_profile_ssh_keys(
        self, request: GithubUserRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return self.safe(self.import_github_profile_ssh_keys, request)

    def create_ssh_key(self, request: CreateSshKeyRequest | Mapping[str, Any]) -> Any:
        req = CreateSshKeyRequest.model_validate(request)
        return self._loose_validate(self.post("/user/ssh-keys", json=req.model_dump()))

    def safe_create_ssh_key(
        self, request: CreateSshKeyRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return self.safe(self.create_ssh_key, request)

    def delete_ssh_key(self, request: KeyIdRequest | Mapping[str, Any]) -> None:
        req = KeyIdRequest.model_validate(request)
        self.request("DELETE", f"/user/ssh-keys/{req.key_id}")
        return None

    def safe_delete_ssh_key(self, request: KeyIdRequest | Mapping[str, Any]) -> SafeResult[None]:
        return self.safe(self.delete_ssh_key, request)

    def sync_github_ssh_keys(self) -> Any:
        return self._loose_validate(self.post("/user/ssh-keys/github-sync", json={}))

    def safe_sync_github_ssh_keys(self) -> SafeResult[Any]:
        return self.safe(self.sync_github_ssh_keys)

    def get_cvm_status_batch(self, request: StatusBatchRequest | Mapping[str, Any]) -> Any:
        req = StatusBatchRequest.model_validate(request)
        return self._loose_validate(self.post("/status/batch", json={"vm_uuids": req.vm_uuids}))

    def safe_get_cvm_status_batch(
        self, request: StatusBatchRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return self.safe(self.get_cvm_status_batch, request)

    def get_cvm_user_config(self, request: CvmIdRequest | Mapping[str, Any]) -> Any:
        cvm_id = CvmIdRequest.model_validate(request).resolved
        return self._loose_validate(self.get(f"/cvms/{cvm_id}/user_config"))

    def safe_get_cvm_user_config(
        self, request: CvmIdRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return self.safe(self.get_cvm_user_config, request)

    def refresh_cvm_instance_id(
        self, request: RefreshCvmInstanceIdRequest | Mapping[str, Any]
    ) -> Any:
        req = RefreshCvmInstanceIdRequest.model_validate(request)
        body = {"overwrite": req.overwrite, "dry_run": req.dry_run}
        return self._loose_validate(
            self.request("PATCH", f"/cvms/{req.resolved}/instance-id", json=body)
        )

    def safe_refresh_cvm_instance_id(
        self, request: RefreshCvmInstanceIdRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return self.safe(self.refresh_cvm_instance_id, request)

    def refresh_cvm_instance_ids(
        self, request: RefreshCvmInstanceIdsRequest | Mapping[str, Any]
    ) -> Any:
        req = RefreshCvmInstanceIdsRequest.model_validate(request)
        return self._loose_validate(
            self.request("PATCH", "/cvms/instance-ids", json=req.model_dump(exclude_none=True))
        )

    def safe_refresh_cvm_instance_ids(
        self, request: RefreshCvmInstanceIdsRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return self.safe(self.refresh_cvm_instance_ids, request)

    def replicate_cvm(self, request: ReplicateCvmRequest | Mapping[str, Any]) -> Any:
        req = ReplicateCvmRequest.model_validate(request)
        return self._loose_validate(
            self.post(f"/cvms/{req.resolved}/replicas", json={"node_id": req.node_id})
        )

    def safe_replicate_cvm(
        self, request: ReplicateCvmRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return self.safe(self.replicate_cvm, request)

    def get_app_list(self, request: Mapping[str, Any] | None = None) -> Any:
        return self._loose_validate(self.get("/apps", params=dict(request or {})))

    def safe_get_app_list(self, request: Mapping[str, Any] | None = None) -> SafeResult[Any]:
        return self.safe(self.get_app_list, request)

    def get_app_info(self, request: AppIdRequest | Mapping[str, Any]) -> Any:
        req = AppIdRequest.model_validate(request)
        return self._loose_validate(self.get(f"/apps/{req.app_id}"))

    def safe_get_app_info(self, request: AppIdRequest | Mapping[str, Any]) -> SafeResult[Any]:
        return self.safe(self.get_app_info, request)

    def get_app_cvms(self, request: AppIdRequest | Mapping[str, Any]) -> Any:
        req = AppIdRequest.model_validate(request)
        return self._loose_validate(self.get(f"/apps/{req.app_id}/cvms"))

    def safe_get_app_cvms(self, request: AppIdRequest | Mapping[str, Any]) -> SafeResult[Any]:
        return self.safe(self.get_app_cvms, request)

    def create_app_instance(self, request: CreateAppInstanceRequest | Mapping[str, Any]) -> Any:
        req = CreateAppInstanceRequest.model_validate(request)
        body = {
            "node_id": req.node_id,
            "docker_compose_file": req.docker_compose_file,
            "pre_launch_script": req.pre_launch_script,
            "encrypted_env": req.encrypted_env,
            "compose_hash": req.compose_hash,
            "token": req.token,
            "transaction_hash": req.transaction_hash,
        }
        return self._validate(
            CvmInfoV20260121, self.post(f"/apps/{req.app_id}/instances", json=body)
        )

    def safe_create_app_instance(
        self, request: CreateAppInstanceRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return self.safe(self.create_app_instance, request)

    def get_app_revisions(self, request: AppRevisionsRequest | Mapping[str, Any]) -> Any:
        req = AppRevisionsRequest.model_validate(request)
        params = {"page": req.page, "page_size": req.page_size}
        params = {k: v for k, v in params.items() if v is not None}
        return self._loose_validate(
            self.get(f"/apps/{req.app_id}/revisions", params=params or None)
        )

    def safe_get_app_revisions(
        self, request: AppRevisionsRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return self.safe(self.get_app_revisions, request)

    def get_app_revision_detail(self, request: AppRevisionDetailRequest | Mapping[str, Any]) -> Any:
        req = AppRevisionDetailRequest.model_validate(request)
        params = None
        if req.raw_compose_file is not None:
            params = {"raw_compose_file": req.raw_compose_file}
        return self._loose_validate(
            self.get(f"/apps/{req.app_id}/revisions/{req.revision_id}", params=params)
        )

    def safe_get_app_revision_detail(
        self, request: AppRevisionDetailRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return self.safe(self.get_app_revision_detail, request)

    def get_app_filter_options(self) -> Any:
        return self._loose_validate(self.get("/apps/filter-options"))

    def safe_get_app_filter_options(self) -> SafeResult[Any]:
        return self.safe(self.get_app_filter_options)

    def get_app_attestation(self, request: AppIdRequest | Mapping[str, Any]) -> Any:
        req = AppIdRequest.model_validate(request)
        return self._loose_validate(self.get(f"/apps/{req.app_id}/attestations"))

    def safe_get_app_attestation(
        self, request: AppIdRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return self.safe(self.get_app_attestation, request)

    def get_kms_on_chain_detail(self, request: KmsOnChainDetailRequest | Mapping[str, Any]) -> Any:
        req = KmsOnChainDetailRequest.model_validate(request)
        return self._loose_validate(self.get(f"/kms/on-chain/{req.chain}"))

    def safe_get_kms_on_chain_detail(
        self, request: KmsOnChainDetailRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return self.safe(self.get_kms_on_chain_detail, request)

    def get_os_images(self, request: GetOsImagesRequest | Mapping[str, Any] | None = None) -> Any:
        req = GetOsImagesRequest.model_validate(request or {})
        params = req.model_dump(exclude_none=True)
        return self._loose_validate(self.get("/os-images", params=params or None))

    def safe_get_os_images(
        self, request: GetOsImagesRequest | Mapping[str, Any] | None = None
    ) -> SafeResult[Any]:
        return self.safe(self.get_os_images, request)

    def get_app_device_allowlist(
        self, request: GetAppDeviceAllowlistRequest | Mapping[str, Any]
    ) -> Any:
        req = GetAppDeviceAllowlistRequest.model_validate(request)
        return self._loose_validate(self.get(f"/apps/{req.app_id}/device-allowlist"))

    def safe_get_app_device_allowlist(
        self, request: GetAppDeviceAllowlistRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return self.safe(self.get_app_device_allowlist, request)

    def check_cvm_is_allowed(self, request: CheckCvmIsAllowedRequest | Mapping[str, Any]) -> Any:
        req = CheckCvmIsAllowedRequest.model_validate(request)
        body = req.model_dump(exclude={"cvm_id"}, exclude_none=True)
        return self._loose_validate(self.post(f"/cvms/{req.cvm_id}/is-allowed", json=body))

    def safe_check_cvm_is_allowed(
        self, request: CheckCvmIsAllowedRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return self.safe(self.check_cvm_is_allowed, request)

    def check_app_is_allowed(self, request: CheckAppIsAllowedRequest | Mapping[str, Any]) -> Any:
        req = CheckAppIsAllowedRequest.model_validate(request)
        body = req.model_dump(exclude={"app_id"}, exclude_none=True)
        return self._loose_validate(self.post(f"/apps/{req.app_id}/is-allowed", json=body))

    def safe_check_app_is_allowed(
        self, request: CheckAppIsAllowedRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return self.safe(self.check_app_is_allowed, request)

    def check_app_cvms_is_allowed(
        self, request: CheckAppCvmsIsAllowedRequest | Mapping[str, Any]
    ) -> Any:
        req = CheckAppCvmsIsAllowedRequest.model_validate(request)
        return self._loose_validate(self.post(f"/apps/{req.app_id}/cvms/is-allowed", json={}))

    def safe_check_app_cvms_is_allowed(
        self, request: CheckAppCvmsIsAllowedRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return self.safe(self.check_app_cvms_is_allowed, request)

    def add_compose_hash(self, *args: Any, **kwargs: Any) -> Any:
        return _add_compose_hash(*args, **kwargs)

    def safe_add_compose_hash(self, *args: Any, **kwargs: Any) -> SafeResult[Any]:
        return self.safe(self.add_compose_hash, *args, **kwargs)

    def deploy_app_auth(self, *args: Any, **kwargs: Any) -> Any:
        return _deploy_app_auth(*args, **kwargs)

    def safe_deploy_app_auth(self, *args: Any, **kwargs: Any) -> SafeResult[Any]:
        return self.safe(self.deploy_app_auth, *args, **kwargs)


class AsyncPhalaCloud(_AsyncBase, _ExtMixin):
    async def request(self, method: str, path: str, **kwargs: Any) -> Any:
        data = await super().request(method, path, **kwargs)
        model = self._model_for_response(method, self._normalize_path(path))
        return self._validate_by_model(model, data)

    async def get(self, path: str, *, params: Mapping[str, Any] | None = None) -> Any:
        return await self.request("GET", path, params=params)

    async def post(
        self,
        path: str,
        *,
        json: Any | None = None,
        content: Any | None = None,
        headers: Mapping[str, str] | None = None,
    ) -> Any:
        return await self.request("POST", path, json=json, content=content, headers=headers)

    async def list_all_instance_type_families(self) -> Any:
        return await self.get("/instance-types")

    async def safe_list_all_instance_type_families(self) -> SafeResult[Any]:
        return await self.safe(self.list_all_instance_type_families)

    async def list_family_instance_types(self, request: FamilyRequest | Mapping[str, Any]) -> Any:
        req = FamilyRequest.model_validate(request)
        return self._loose_validate(await self.get(f"/instance-types/{req.family}"))

    async def safe_list_family_instance_types(
        self, request: FamilyRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return await self.safe(self.list_family_instance_types, request)

    async def list_workspaces(self, request: Mapping[str, Any] | None = None) -> Any:
        return self._loose_validate(await self.get("/workspaces", params=dict(request or {})))

    async def safe_list_workspaces(
        self, request: Mapping[str, Any] | None = None
    ) -> SafeResult[Any]:
        return await self.safe(self.list_workspaces, request)

    async def get_workspace(self, request: str | TeamSlugRequest | Mapping[str, Any]) -> Any:
        if isinstance(request, str):
            team_slug = request
        else:
            team_slug = TeamSlugRequest.model_validate(request).team_slug
        return self._loose_validate(await self.get(f"/workspaces/{team_slug}"))

    async def safe_get_workspace(
        self, request: str | TeamSlugRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return await self.safe(self.get_workspace, request)

    async def get_workspace_nodes(self, request: WorkspaceNodesRequest | Mapping[str, Any]) -> Any:
        req = WorkspaceNodesRequest.model_validate(request)
        params = {"page": req.page, "page_size": req.page_size}
        params = {k: v for k, v in params.items() if v is not None}
        return self._loose_validate(
            await self.get(f"/workspaces/{req.team_slug}/nodes", params=params or None)
        )

    async def safe_get_workspace_nodes(
        self, request: WorkspaceNodesRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return await self.safe(self.get_workspace_nodes, request)

    async def get_workspace_quotas(self, request: str | TeamSlugRequest | Mapping[str, Any]) -> Any:
        if isinstance(request, str):
            team_slug = request
        else:
            team_slug = TeamSlugRequest.model_validate(request).team_slug
        return self._loose_validate(await self.get(f"/workspaces/{team_slug}/quotas"))

    async def safe_get_workspace_quotas(
        self, request: str | TeamSlugRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return await self.safe(self.get_workspace_quotas, request)

    async def get_cvm_info(self, request: CvmIdRequest | Mapping[str, Any]) -> Any:
        cvm_id = CvmIdRequest.model_validate(request).resolved
        return self._loose_validate(await self.get(f"/cvms/{cvm_id}"))

    async def safe_get_cvm_info(self, request: CvmIdRequest | Mapping[str, Any]) -> SafeResult[Any]:
        return await self.safe(self.get_cvm_info, request)

    async def provision_cvm(self, request: Mapping[str, Any]) -> Any:
        body = dict(request)
        if "compose_file" in body:
            cf = dict(body["compose_file"])
            cf.setdefault("name", "")
            body["compose_file"] = cf
        return self._loose_validate(await self.post("/cvms/provision", json=body))

    async def safe_provision_cvm(self, request: Mapping[str, Any]) -> SafeResult[Any]:
        return await self.safe(self.provision_cvm, request)

    async def commit_cvm_provision(self, request: Mapping[str, Any]) -> Any:
        """Commit a provisioned CVM, creating the actual instance.

        This endpoint is idempotent: submitting the same app_id + compose_hash
        again returns the existing CVM. A different compose_hash for the same
        app_id raises ResourceError with error_code CVM_APP_ID_CONFLICT (409).
        """
        return self._loose_validate(await self.post("/cvms", json=dict(request)))

    async def safe_commit_cvm_provision(self, request: Mapping[str, Any]) -> SafeResult[Any]:
        return await self.safe(self.commit_cvm_provision, request)

    async def get_cvm_compose_file(self, request: CvmIdRequest | Mapping[str, Any]) -> Any:
        cvm_id = CvmIdRequest.model_validate(request).resolved
        return self._loose_validate(await self.get(f"/cvms/{cvm_id}/compose_file"))

    async def safe_get_cvm_compose_file(
        self, request: CvmIdRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return await self.safe(self.get_cvm_compose_file, request)

    async def provision_cvm_compose_file_update(
        self, request: Mapping[str, Any]
    ) -> ProvisionCvmComposeFileUpdateResult:
        req = dict(request)
        cvm_id = CvmIdRequest.model_validate(req).resolved
        body = dict(req.get("app_compose") or {})
        if "update_env_vars" in req:
            body["update_env_vars"] = req["update_env_vars"]
        return self._validate(
            ProvisionCvmComposeFileUpdateResult,
            await self.post(f"/cvms/{cvm_id}/compose_file/provision", json=body),
        )

    async def safe_provision_cvm_compose_file_update(
        self, request: Mapping[str, Any]
    ) -> SafeResult[ProvisionCvmComposeFileUpdateResult]:
        return await self.safe(self.provision_cvm_compose_file_update, request)

    async def commit_cvm_compose_file_update(self, request: Mapping[str, Any]) -> Any:
        req = dict(request)
        cvm_id = CvmIdRequest.model_validate(req).resolved
        body = {
            "compose_hash": req.get("compose_hash"),
            "encrypted_env": req.get("encrypted_env"),
            "env_keys": req.get("env_keys"),
            "update_env_vars": req.get("update_env_vars"),
        }
        return self._loose_validate(
            await self.request("PATCH", f"/cvms/{cvm_id}/compose_file", json=body)
        )

    async def safe_commit_cvm_compose_file_update(
        self, request: Mapping[str, Any]
    ) -> SafeResult[Any]:
        return await self.safe(self.commit_cvm_compose_file_update, request)

    async def update_cvm_envs(self, request: Mapping[str, Any]) -> Any:
        req = dict(request)
        cvm_id = CvmIdRequest.model_validate(req).resolved
        body = {
            "encrypted_env": req.get("encrypted_env"),
            "env_keys": req.get("env_keys"),
            "compose_hash": req.get("compose_hash"),
            "transaction_hash": req.get("transaction_hash"),
        }
        try:
            return self._loose_validate(
                await self.request("PATCH", f"/cvms/{cvm_id}/envs", json=body)
            )
        except Exception as exc:
            fields = self._extract_465_fields(exc)
            if fields is not None:
                return self._loose_validate({"status": "precondition_required", **fields})
            raise

    async def safe_update_cvm_envs(self, request: Mapping[str, Any]) -> SafeResult[Any]:
        return await self.safe(self.update_cvm_envs, request)

    async def update_docker_compose(self, request: Mapping[str, Any]) -> Any:
        req = dict(request)
        cvm_id = CvmIdRequest.model_validate(req).resolved
        headers: dict[str, str] = {"Content-Type": "text/yaml"}
        if req.get("compose_hash"):
            headers["X-Compose-Hash"] = str(req["compose_hash"])
        if req.get("transaction_hash"):
            headers["X-Transaction-Hash"] = str(req["transaction_hash"])
        try:
            return self._loose_validate(
                await self.request(
                    "PATCH",
                    f"/cvms/{cvm_id}/docker-compose",
                    content=str(req.get("docker_compose_file", "")),
                    headers=headers,
                ),
            )
        except Exception as exc:
            fields = self._extract_465_fields(exc)
            if fields is not None:
                return self._loose_validate({"status": "precondition_required", **fields})
            raise

    async def safe_update_docker_compose(self, request: Mapping[str, Any]) -> SafeResult[Any]:
        return await self.safe(self.update_docker_compose, request)

    async def update_pre_launch_script(self, request: Mapping[str, Any]) -> Any:
        req = dict(request)
        cvm_id = CvmIdRequest.model_validate(req).resolved
        headers: dict[str, str] = {"Content-Type": "text/plain"}
        if req.get("compose_hash"):
            headers["X-Compose-Hash"] = str(req["compose_hash"])
        if req.get("transaction_hash"):
            headers["X-Transaction-Hash"] = str(req["transaction_hash"])
        try:
            return self._loose_validate(
                await self.request(
                    "PATCH",
                    f"/cvms/{cvm_id}/pre-launch-script",
                    content=str(req.get("pre_launch_script", "")),
                    headers=headers,
                ),
            )
        except Exception as exc:
            fields = self._extract_465_fields(exc)
            if fields is not None:
                return self._loose_validate({"status": "precondition_required", **fields})
            raise

    async def safe_update_pre_launch_script(self, request: Mapping[str, Any]) -> SafeResult[Any]:
        return await self.safe(self.update_pre_launch_script, request)

    async def get_cvm_pre_launch_script(self, request: CvmIdRequest | Mapping[str, Any]) -> str:
        cvm_id = CvmIdRequest.model_validate(request).resolved
        return str(await self.get(f"/cvms/{cvm_id}/pre-launch-script"))

    async def safe_get_cvm_pre_launch_script(
        self, request: CvmIdRequest | Mapping[str, Any]
    ) -> SafeResult[str]:
        return await self.safe(self.get_cvm_pre_launch_script, request)

    async def start_cvm(self, request: CvmIdRequest | Mapping[str, Any]) -> Any:
        cvm_id = CvmIdRequest.model_validate(request).resolved
        return self._loose_validate(await self.post(f"/cvms/{cvm_id}/start"))

    async def safe_start_cvm(self, request: CvmIdRequest | Mapping[str, Any]) -> SafeResult[Any]:
        return await self.safe(self.start_cvm, request)

    async def stop_cvm(self, request: CvmIdRequest | Mapping[str, Any]) -> Any:
        cvm_id = CvmIdRequest.model_validate(request).resolved
        return self._loose_validate(await self.post(f"/cvms/{cvm_id}/stop"))

    async def safe_stop_cvm(self, request: CvmIdRequest | Mapping[str, Any]) -> SafeResult[Any]:
        return await self.safe(self.stop_cvm, request)

    async def shutdown_cvm(self, request: CvmIdRequest | Mapping[str, Any]) -> Any:
        cvm_id = CvmIdRequest.model_validate(request).resolved
        return self._loose_validate(await self.post(f"/cvms/{cvm_id}/shutdown"))

    async def safe_shutdown_cvm(self, request: CvmIdRequest | Mapping[str, Any]) -> SafeResult[Any]:
        return await self.safe(self.shutdown_cvm, request)

    async def restart_cvm(self, request: RestartCvmRequest | Mapping[str, Any]) -> Any:
        req = RestartCvmRequest.model_validate(request)
        return self._loose_validate(
            await self.post(f"/cvms/{req.resolved}/restart", json={"force": req.force})
        )

    async def safe_restart_cvm(
        self, request: RestartCvmRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return await self.safe(self.restart_cvm, request)

    async def delete_cvm(self, request: CvmIdRequest | Mapping[str, Any]) -> None:
        cvm_id = CvmIdRequest.model_validate(request).resolved
        await self.request("DELETE", f"/cvms/{cvm_id}")
        return None

    async def safe_delete_cvm(self, request: CvmIdRequest | Mapping[str, Any]) -> SafeResult[None]:
        return await self.safe(self.delete_cvm, request)

    async def get_cvm_stats(self, request: CvmIdRequest | Mapping[str, Any]) -> Any:
        cvm_id = CvmIdRequest.model_validate(request).resolved
        return self._loose_validate(await self.get(f"/cvms/{cvm_id}/stats"))

    async def safe_get_cvm_stats(
        self, request: CvmIdRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return await self.safe(self.get_cvm_stats, request)

    async def get_cvm_network(self, request: CvmIdRequest | Mapping[str, Any]) -> Any:
        cvm_id = CvmIdRequest.model_validate(request).resolved
        return self._loose_validate(await self.get(f"/cvms/{cvm_id}/network"))

    async def safe_get_cvm_network(
        self, request: CvmIdRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return await self.safe(self.get_cvm_network, request)

    async def get_cvm_docker_compose(self, request: CvmIdRequest | Mapping[str, Any]) -> str:
        cvm_id = CvmIdRequest.model_validate(request).resolved
        return str(await self.get(f"/cvms/{cvm_id}/docker-compose.yml"))

    async def safe_get_cvm_docker_compose(
        self, request: CvmIdRequest | Mapping[str, Any]
    ) -> SafeResult[str]:
        return await self.safe(self.get_cvm_docker_compose, request)

    async def get_cvm_containers_stats(self, request: CvmIdRequest | Mapping[str, Any]) -> Any:
        cvm_id = CvmIdRequest.model_validate(request).resolved
        return self._loose_validate(await self.get(f"/cvms/{cvm_id}/composition"))

    async def safe_get_cvm_containers_stats(
        self, request: CvmIdRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return await self.safe(self.get_cvm_containers_stats, request)

    async def get_cvm_attestation(self, request: CvmIdRequest | Mapping[str, Any]) -> Any:
        cvm_id = CvmIdRequest.model_validate(request).resolved
        return self._loose_validate(await self.get(f"/cvms/{cvm_id}/attestation"))

    async def safe_get_cvm_attestation(
        self, request: CvmIdRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return await self.safe(self.get_cvm_attestation, request)

    async def update_cvm_resources(
        self, request: UpdateResourcesRequest | Mapping[str, Any]
    ) -> None:
        req = UpdateResourcesRequest.model_validate(request)
        body = req.model_dump(exclude_none=True)
        for k in ["id", "uuid", "app_id", "instance_id", "cvm_id", "cvmId"]:
            body.pop(k, None)
        await self.request("PATCH", f"/cvms/{req.resolved}/resources", json=body)
        return None

    async def safe_update_cvm_resources(
        self, request: UpdateResourcesRequest | Mapping[str, Any]
    ) -> SafeResult[None]:
        return await self.safe(self.update_cvm_resources, request)

    async def update_cvm_visibility(
        self, request: UpdateVisibilityRequest | Mapping[str, Any]
    ) -> Any:
        req = UpdateVisibilityRequest.model_validate(request)
        body = {
            "public_sysinfo": req.public_sysinfo,
            "public_logs": req.public_logs,
            "public_tcbinfo": req.public_tcbinfo,
        }
        return self._loose_validate(
            await self.request("PATCH", f"/cvms/{req.resolved}/visibility", json=body)
        )

    async def safe_update_cvm_visibility(
        self, request: UpdateVisibilityRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return await self.safe(self.update_cvm_visibility, request)

    async def get_available_os_images(self, request: CvmIdRequest | Mapping[str, Any]) -> Any:
        cvm_id = CvmIdRequest.model_validate(request).resolved
        return self._loose_validate(await self.get(f"/cvms/{cvm_id}/available-os-images"))

    async def safe_get_available_os_images(
        self, request: CvmIdRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return await self.safe(self.get_available_os_images, request)

    async def update_os_image(self, request: UpdateOsImageRequest | Mapping[str, Any]) -> None:
        req = UpdateOsImageRequest.model_validate(request)
        await self.request(
            "PATCH", f"/cvms/{req.resolved}/os-image", json={"os_image_name": req.os_image_name}
        )
        return None

    async def safe_update_os_image(
        self, request: UpdateOsImageRequest | Mapping[str, Any]
    ) -> SafeResult[None]:
        return await self.safe(self.update_os_image, request)

    async def patch_cvm(self, request: PatchCvmRequest | Mapping[str, Any]) -> dict[str, Any]:
        req = PatchCvmRequest.model_validate(request)
        cvm_id = req.resolved
        body = req.model_dump(
            exclude={"id", "uuid", "app_id", "instance_id", "cvm_id", "cvmId"},
            exclude_none=True,
        )
        try:
            data = self._loose_validate(await self.request("PATCH", f"/cvms/{cvm_id}", json=body))
            correlation_id = ""
            if isinstance(data, dict):
                correlation_id = data.get("correlation_id", "")
            elif data is not None:
                correlation_id = str(getattr(data, "correlation_id", ""))
            return {"requires_on_chain_hash": False, "correlation_id": correlation_id}
        except ApiError as exc:
            if exc.status_code == 465 and isinstance(exc.detail, dict):
                details: dict[str, Any] = {}
                for item in exc.detail.get("details") or []:
                    if isinstance(item, dict) and "field" in item and "value" in item:
                        details[item["field"]] = item["value"]
                return {
                    "requires_on_chain_hash": True,
                    "compose_hash": details.get("compose_hash", ""),
                    "app_id": str(details.get("app_id", "")),
                    "device_id": details.get("device_id", ""),
                    "kms_info": details.get("kms_info"),
                }
            raise

    async def safe_patch_cvm(
        self, request: PatchCvmRequest | Mapping[str, Any]
    ) -> SafeResult[dict[str, Any]]:
        return await self.safe(self.patch_cvm, request)

    async def confirm_cvm_patch(
        self, request: ConfirmCvmPatchRequest | Mapping[str, Any]
    ) -> dict[str, Any]:
        req = ConfirmCvmPatchRequest.model_validate(request)
        cvm_id = req.resolved
        data = self._loose_validate(
            await self.request(
                "PATCH",
                f"/cvms/{cvm_id}",
                json={},
                headers={
                    "X-Compose-Hash": req.compose_hash,
                    "X-Transaction-Hash": req.transaction_hash,
                },
            )
        )
        correlation_id = ""
        if isinstance(data, dict):
            correlation_id = data.get("correlation_id", "")
        elif data is not None:
            correlation_id = str(getattr(data, "correlation_id", ""))
        return {"correlation_id": correlation_id}

    async def safe_confirm_cvm_patch(
        self, request: ConfirmCvmPatchRequest | Mapping[str, Any]
    ) -> SafeResult[dict[str, Any]]:
        return await self.safe(self.confirm_cvm_patch, request)

    async def get_cvm_state(self, request: CvmIdRequest | Mapping[str, Any]) -> Any:
        cvm_id = CvmIdRequest.model_validate(request).resolved
        return self._loose_validate(await self.get(f"/cvms/{cvm_id}/state"))

    async def safe_get_cvm_state(
        self, request: CvmIdRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return await self.safe(self.get_cvm_state, request)

    async def watch_cvm_state(self, request: WatchCvmStateRequest | Mapping[str, Any]) -> Any:
        req = WatchCvmStateRequest.model_validate(request)
        retries = 0
        max_retries = req.max_retries

        while max_retries is None or retries <= max_retries:
            params = {
                "target": req.target,
                "interval": str(req.interval),
                "timeout": str(req.timeout),
            }
            last_state: Any = None
            should_retry = False
            event_type: str | None = None
            event_data: str | None = None

            def process_event(ev: str | None, data: str | None) -> Any | None:
                nonlocal last_state, should_retry
                if not ev or not data:
                    return None
                try:
                    payload = TypeAdapter(dict[str, Any]).validate_json(data)
                except Exception:
                    payload = {"error": "invalid_sse_payload", "raw": data}
                if ev == "state":
                    last_state = GenericObject.model_validate(payload)
                    return None
                if ev == "complete":
                    return GenericObject.model_validate(payload)
                if ev in {"timeout", "error"}:
                    should_retry = True
                return None

            async with self._client.stream(
                "GET",
                f"/cvms/{req.resolved}/state",
                params=params,
                headers={"Accept": "text/event-stream", "Cache-Control": "no-cache"},
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    line = line.strip()
                    if line.startswith("event:"):
                        maybe = process_event(event_type, event_data)
                        if maybe is not None:
                            return maybe
                        event_type = line[6:].strip()
                        event_data = None
                    elif line.startswith("data:"):
                        event_data = line[5:].strip()
                    elif line == "":
                        maybe = process_event(event_type, event_data)
                        if maybe is not None:
                            return maybe
                        event_type = None
                        event_data = None

            maybe = process_event(event_type, event_data)
            if maybe is not None:
                return maybe

            if (
                isinstance(last_state, BaseModel)
                and getattr(last_state, "status", None) == req.target
            ):
                return last_state

            retries += 1
            if max_retries is not None and retries > max_retries:
                break
            if req.retry_delay > 0:
                await self._sleep(req.retry_delay)

        raise TimeoutError(f"watch_cvm_state exceeded retries waiting for '{req.target}'")

    async def _sleep(self, seconds: float) -> None:
        import asyncio

        await asyncio.sleep(seconds)

    async def get_kms_info(self, request: KmsInfoRequest | Mapping[str, Any]) -> Any:
        req = KmsInfoRequest.model_validate(request)
        return self._loose_validate(await self.get(f"/kms/{req.kms_id}"))

    async def safe_get_kms_info(
        self, request: KmsInfoRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return await self.safe(self.get_kms_info, request)

    async def get_app_env_encrypt_pub_key(
        self, request: KmsPubkeyRequest | Mapping[str, Any]
    ) -> Any:
        req = KmsPubkeyRequest.model_validate(request)
        return self._loose_validate(await self.get(f"/kms/{req.kms}/pubkey/{req.app_id}"))

    async def safe_get_app_env_encrypt_pub_key(
        self, request: KmsPubkeyRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return await self.safe(self.get_app_env_encrypt_pub_key, request)

    async def next_app_ids(
        self, request: NextAppIdsRequest | Mapping[str, Any] | None = None
    ) -> Any:
        req = NextAppIdsRequest.model_validate(request or {})
        return self._loose_validate(
            await self.get("/kms/phala/next_app_id", params={"counts": req.counts})
        )

    async def safe_next_app_ids(
        self, request: NextAppIdsRequest | Mapping[str, Any] | None = None
    ) -> SafeResult[Any]:
        return await self.safe(self.next_app_ids, request)

    async def list_ssh_keys(self) -> Any:
        return self._loose_validate(await self.get("/user/ssh-keys"))

    async def safe_list_ssh_keys(self) -> SafeResult[Any]:
        return await self.safe(self.list_ssh_keys)

    async def import_github_profile_ssh_keys(
        self, request: GithubUserRequest | Mapping[str, Any]
    ) -> Any:
        req = GithubUserRequest.model_validate(request)
        return self._loose_validate(
            await self.post("/user/ssh-keys/github-profile", json=req.model_dump())
        )

    async def safe_import_github_profile_ssh_keys(
        self, request: GithubUserRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return await self.safe(self.import_github_profile_ssh_keys, request)

    async def create_ssh_key(self, request: CreateSshKeyRequest | Mapping[str, Any]) -> Any:
        req = CreateSshKeyRequest.model_validate(request)
        return self._loose_validate(await self.post("/user/ssh-keys", json=req.model_dump()))

    async def safe_create_ssh_key(
        self, request: CreateSshKeyRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return await self.safe(self.create_ssh_key, request)

    async def delete_ssh_key(self, request: KeyIdRequest | Mapping[str, Any]) -> None:
        req = KeyIdRequest.model_validate(request)
        await self.request("DELETE", f"/user/ssh-keys/{req.key_id}")
        return None

    async def safe_delete_ssh_key(
        self, request: KeyIdRequest | Mapping[str, Any]
    ) -> SafeResult[None]:
        return await self.safe(self.delete_ssh_key, request)

    async def sync_github_ssh_keys(self) -> Any:
        return self._loose_validate(await self.post("/user/ssh-keys/github-sync", json={}))

    async def safe_sync_github_ssh_keys(self) -> SafeResult[Any]:
        return await self.safe(self.sync_github_ssh_keys)

    async def get_cvm_status_batch(self, request: StatusBatchRequest | Mapping[str, Any]) -> Any:
        req = StatusBatchRequest.model_validate(request)
        return self._loose_validate(
            await self.post("/status/batch", json={"vm_uuids": req.vm_uuids})
        )

    async def safe_get_cvm_status_batch(
        self, request: StatusBatchRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return await self.safe(self.get_cvm_status_batch, request)

    async def get_cvm_user_config(self, request: CvmIdRequest | Mapping[str, Any]) -> Any:
        cvm_id = CvmIdRequest.model_validate(request).resolved
        return self._loose_validate(await self.get(f"/cvms/{cvm_id}/user_config"))

    async def safe_get_cvm_user_config(
        self, request: CvmIdRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return await self.safe(self.get_cvm_user_config, request)

    async def refresh_cvm_instance_id(
        self, request: RefreshCvmInstanceIdRequest | Mapping[str, Any]
    ) -> Any:
        req = RefreshCvmInstanceIdRequest.model_validate(request)
        body = {"overwrite": req.overwrite, "dry_run": req.dry_run}
        return self._loose_validate(
            await self.request("PATCH", f"/cvms/{req.resolved}/instance-id", json=body)
        )

    async def safe_refresh_cvm_instance_id(
        self, request: RefreshCvmInstanceIdRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return await self.safe(self.refresh_cvm_instance_id, request)

    async def refresh_cvm_instance_ids(
        self, request: RefreshCvmInstanceIdsRequest | Mapping[str, Any]
    ) -> Any:
        req = RefreshCvmInstanceIdsRequest.model_validate(request)
        return self._loose_validate(
            await self.request(
                "PATCH", "/cvms/instance-ids", json=req.model_dump(exclude_none=True)
            )
        )

    async def safe_refresh_cvm_instance_ids(
        self, request: RefreshCvmInstanceIdsRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return await self.safe(self.refresh_cvm_instance_ids, request)

    async def replicate_cvm(self, request: ReplicateCvmRequest | Mapping[str, Any]) -> Any:
        req = ReplicateCvmRequest.model_validate(request)
        return self._loose_validate(
            await self.post(f"/cvms/{req.resolved}/replicas", json={"node_id": req.node_id})
        )

    async def safe_replicate_cvm(
        self, request: ReplicateCvmRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return await self.safe(self.replicate_cvm, request)

    async def get_app_list(self, request: Mapping[str, Any] | None = None) -> Any:
        return self._loose_validate(await self.get("/apps", params=dict(request or {})))

    async def safe_get_app_list(self, request: Mapping[str, Any] | None = None) -> SafeResult[Any]:
        return await self.safe(self.get_app_list, request)

    async def get_app_info(self, request: AppIdRequest | Mapping[str, Any]) -> Any:
        req = AppIdRequest.model_validate(request)
        return self._loose_validate(await self.get(f"/apps/{req.app_id}"))

    async def safe_get_app_info(self, request: AppIdRequest | Mapping[str, Any]) -> SafeResult[Any]:
        return await self.safe(self.get_app_info, request)

    async def get_app_cvms(self, request: AppIdRequest | Mapping[str, Any]) -> Any:
        req = AppIdRequest.model_validate(request)
        return self._loose_validate(await self.get(f"/apps/{req.app_id}/cvms"))

    async def safe_get_app_cvms(self, request: AppIdRequest | Mapping[str, Any]) -> SafeResult[Any]:
        return await self.safe(self.get_app_cvms, request)

    async def create_app_instance(
        self, request: CreateAppInstanceRequest | Mapping[str, Any]
    ) -> Any:
        req = CreateAppInstanceRequest.model_validate(request)
        body = {
            "node_id": req.node_id,
            "docker_compose_file": req.docker_compose_file,
            "pre_launch_script": req.pre_launch_script,
            "encrypted_env": req.encrypted_env,
            "compose_hash": req.compose_hash,
            "token": req.token,
            "transaction_hash": req.transaction_hash,
        }
        return self._validate(
            CvmInfoV20260121,
            await self.post(f"/apps/{req.app_id}/instances", json=body),
        )

    async def safe_create_app_instance(
        self, request: CreateAppInstanceRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return await self.safe(self.create_app_instance, request)

    async def get_app_revisions(self, request: AppRevisionsRequest | Mapping[str, Any]) -> Any:
        req = AppRevisionsRequest.model_validate(request)
        params = {"page": req.page, "page_size": req.page_size}
        params = {k: v for k, v in params.items() if v is not None}
        return self._loose_validate(
            await self.get(f"/apps/{req.app_id}/revisions", params=params or None)
        )

    async def safe_get_app_revisions(
        self, request: AppRevisionsRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return await self.safe(self.get_app_revisions, request)

    async def get_app_revision_detail(
        self, request: AppRevisionDetailRequest | Mapping[str, Any]
    ) -> Any:
        req = AppRevisionDetailRequest.model_validate(request)
        params = None
        if req.raw_compose_file is not None:
            params = {"raw_compose_file": req.raw_compose_file}
        return self._loose_validate(
            await self.get(f"/apps/{req.app_id}/revisions/{req.revision_id}", params=params)
        )

    async def safe_get_app_revision_detail(
        self, request: AppRevisionDetailRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return await self.safe(self.get_app_revision_detail, request)

    async def get_app_filter_options(self) -> Any:
        return self._loose_validate(await self.get("/apps/filter-options"))

    async def safe_get_app_filter_options(self) -> SafeResult[Any]:
        return await self.safe(self.get_app_filter_options)

    async def get_app_attestation(self, request: AppIdRequest | Mapping[str, Any]) -> Any:
        req = AppIdRequest.model_validate(request)
        return self._loose_validate(await self.get(f"/apps/{req.app_id}/attestations"))

    async def safe_get_app_attestation(
        self, request: AppIdRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return await self.safe(self.get_app_attestation, request)

    async def get_kms_on_chain_detail(
        self, request: KmsOnChainDetailRequest | Mapping[str, Any]
    ) -> Any:
        req = KmsOnChainDetailRequest.model_validate(request)
        return self._loose_validate(await self.get(f"/kms/on-chain/{req.chain}"))

    async def safe_get_kms_on_chain_detail(
        self, request: KmsOnChainDetailRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return await self.safe(self.get_kms_on_chain_detail, request)

    async def get_os_images(
        self, request: GetOsImagesRequest | Mapping[str, Any] | None = None
    ) -> Any:
        req = GetOsImagesRequest.model_validate(request or {})
        params = req.model_dump(exclude_none=True)
        return self._loose_validate(await self.get("/os-images", params=params or None))

    async def safe_get_os_images(
        self, request: GetOsImagesRequest | Mapping[str, Any] | None = None
    ) -> SafeResult[Any]:
        return await self.safe(self.get_os_images, request)

    async def get_app_device_allowlist(
        self, request: GetAppDeviceAllowlistRequest | Mapping[str, Any]
    ) -> Any:
        req = GetAppDeviceAllowlistRequest.model_validate(request)
        return self._loose_validate(await self.get(f"/apps/{req.app_id}/device-allowlist"))

    async def safe_get_app_device_allowlist(
        self, request: GetAppDeviceAllowlistRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return await self.safe(self.get_app_device_allowlist, request)

    async def check_cvm_is_allowed(
        self, request: CheckCvmIsAllowedRequest | Mapping[str, Any]
    ) -> Any:
        req = CheckCvmIsAllowedRequest.model_validate(request)
        body = req.model_dump(exclude={"cvm_id"}, exclude_none=True)
        return self._loose_validate(await self.post(f"/cvms/{req.cvm_id}/is-allowed", json=body))

    async def safe_check_cvm_is_allowed(
        self, request: CheckCvmIsAllowedRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return await self.safe(self.check_cvm_is_allowed, request)

    async def check_app_is_allowed(
        self, request: CheckAppIsAllowedRequest | Mapping[str, Any]
    ) -> Any:
        req = CheckAppIsAllowedRequest.model_validate(request)
        body = req.model_dump(exclude={"app_id"}, exclude_none=True)
        return self._loose_validate(await self.post(f"/apps/{req.app_id}/is-allowed", json=body))

    async def safe_check_app_is_allowed(
        self, request: CheckAppIsAllowedRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return await self.safe(self.check_app_is_allowed, request)

    async def check_app_cvms_is_allowed(
        self, request: CheckAppCvmsIsAllowedRequest | Mapping[str, Any]
    ) -> Any:
        req = CheckAppCvmsIsAllowedRequest.model_validate(request)
        return self._loose_validate(await self.post(f"/apps/{req.app_id}/cvms/is-allowed", json={}))

    async def safe_check_app_cvms_is_allowed(
        self, request: CheckAppCvmsIsAllowedRequest | Mapping[str, Any]
    ) -> SafeResult[Any]:
        return await self.safe(self.check_app_cvms_is_allowed, request)

    async def add_compose_hash(self, *args: Any, **kwargs: Any) -> Any:
        return _add_compose_hash(*args, **kwargs)

    async def safe_add_compose_hash(self, *args: Any, **kwargs: Any) -> SafeResult[Any]:
        return await self.safe(self.add_compose_hash, *args, **kwargs)

    async def deploy_app_auth(self, *args: Any, **kwargs: Any) -> Any:
        return _deploy_app_auth(*args, **kwargs)

    async def safe_deploy_app_auth(self, *args: Any, **kwargs: Any) -> SafeResult[Any]:
        return await self.safe(self.deploy_app_auth, *args, **kwargs)


def create_client(**kwargs: Any) -> PhalaCloud:
    return PhalaCloud(**kwargs)


def create_async_client(**kwargs: Any) -> AsyncPhalaCloud:
    return AsyncPhalaCloud(**kwargs)
