"""Function-style action wrappers (similar to JS SDK exports)."""

from __future__ import annotations

from typing import Any

__all__ = [
    "get_current_user",
    "safe_get_current_user",
    "get_available_nodes",
    "safe_get_available_nodes",
    "get_cvm_create_resources",
    "safe_get_cvm_create_resources",
    "get_cvm_list",
    "safe_get_cvm_list",
    "get_kms_list",
    "safe_get_kms_list",
    "list_all_instance_type_families",
    "safe_list_all_instance_type_families",
    "list_family_instance_types",
    "safe_list_family_instance_types",
    "list_workspaces",
    "safe_list_workspaces",
    "get_workspace",
    "safe_get_workspace",
    "get_workspace_nodes",
    "safe_get_workspace_nodes",
    "get_workspace_quotas",
    "safe_get_workspace_quotas",
    "get_cvm_info",
    "safe_get_cvm_info",
    "provision_cvm",
    "safe_provision_cvm",
    "commit_cvm_provision",
    "safe_commit_cvm_provision",
    "get_cvm_compose_file",
    "safe_get_cvm_compose_file",
    "provision_cvm_compose_file_update",
    "safe_provision_cvm_compose_file_update",
    "commit_cvm_compose_file_update",
    "safe_commit_cvm_compose_file_update",
    "update_cvm_envs",
    "safe_update_cvm_envs",
    "update_docker_compose",
    "safe_update_docker_compose",
    "update_pre_launch_script",
    "safe_update_pre_launch_script",
    "get_cvm_pre_launch_script",
    "safe_get_cvm_pre_launch_script",
    "start_cvm",
    "safe_start_cvm",
    "stop_cvm",
    "safe_stop_cvm",
    "shutdown_cvm",
    "safe_shutdown_cvm",
    "restart_cvm",
    "safe_restart_cvm",
    "delete_cvm",
    "safe_delete_cvm",
    "get_cvm_stats",
    "safe_get_cvm_stats",
    "get_cvm_network",
    "safe_get_cvm_network",
    "get_cvm_docker_compose",
    "safe_get_cvm_docker_compose",
    "get_cvm_containers_stats",
    "safe_get_cvm_containers_stats",
    "get_cvm_attestation",
    "safe_get_cvm_attestation",
    "update_cvm_resources",
    "safe_update_cvm_resources",
    "update_cvm_visibility",
    "safe_update_cvm_visibility",
    "get_available_os_images",
    "safe_get_available_os_images",
    "update_os_image",
    "safe_update_os_image",
    "patch_cvm",
    "safe_patch_cvm",
    "confirm_cvm_patch",
    "safe_confirm_cvm_patch",
    "get_cvm_state",
    "safe_get_cvm_state",
    "watch_cvm_state",
    "get_kms_info",
    "safe_get_kms_info",
    "get_app_env_encrypt_pub_key",
    "safe_get_app_env_encrypt_pub_key",
    "next_app_ids",
    "safe_next_app_ids",
    "list_ssh_keys",
    "safe_list_ssh_keys",
    "import_github_profile_ssh_keys",
    "safe_import_github_profile_ssh_keys",
    "create_ssh_key",
    "safe_create_ssh_key",
    "delete_ssh_key",
    "safe_delete_ssh_key",
    "sync_github_ssh_keys",
    "safe_sync_github_ssh_keys",
    "get_cvm_status_batch",
    "safe_get_cvm_status_batch",
    "get_cvm_user_config",
    "safe_get_cvm_user_config",
    "refresh_cvm_instance_id",
    "safe_refresh_cvm_instance_id",
    "refresh_cvm_instance_ids",
    "safe_refresh_cvm_instance_ids",
    "replicate_cvm",
    "safe_replicate_cvm",
    "get_app_list",
    "safe_get_app_list",
    "get_app_info",
    "safe_get_app_info",
    "get_app_cvms",
    "safe_get_app_cvms",
    "create_app_instance",
    "safe_create_app_instance",
    "get_app_revisions",
    "safe_get_app_revisions",
    "get_app_revision_detail",
    "safe_get_app_revision_detail",
    "get_app_filter_options",
    "safe_get_app_filter_options",
    "get_app_attestation",
    "safe_get_app_attestation",
    "get_kms_on_chain_detail",
    "safe_get_kms_on_chain_detail",
    "get_os_images",
    "safe_get_os_images",
    "get_app_device_allowlist",
    "safe_get_app_device_allowlist",
    "add_compose_hash",
    "safe_add_compose_hash",
    "deploy_app_auth",
    "safe_deploy_app_auth",
]


def get_current_user(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.get_current_user(*args, **kwargs)


def safe_get_current_user(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_get_current_user(*args, **kwargs)


def get_available_nodes(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.get_available_nodes(*args, **kwargs)


def safe_get_available_nodes(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_get_available_nodes(*args, **kwargs)


def get_cvm_create_resources(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.get_cvm_create_resources(*args, **kwargs)


def safe_get_cvm_create_resources(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_get_cvm_create_resources(*args, **kwargs)


def get_cvm_list(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.get_cvm_list(*args, **kwargs)


def safe_get_cvm_list(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_get_cvm_list(*args, **kwargs)


def get_kms_list(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.get_kms_list(*args, **kwargs)


def safe_get_kms_list(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_get_kms_list(*args, **kwargs)


def list_all_instance_type_families(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.list_all_instance_type_families(*args, **kwargs)


def safe_list_all_instance_type_families(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_list_all_instance_type_families(*args, **kwargs)


def list_family_instance_types(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.list_family_instance_types(*args, **kwargs)


def safe_list_family_instance_types(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_list_family_instance_types(*args, **kwargs)


def list_workspaces(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.list_workspaces(*args, **kwargs)


def safe_list_workspaces(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_list_workspaces(*args, **kwargs)


def get_workspace(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.get_workspace(*args, **kwargs)


def safe_get_workspace(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_get_workspace(*args, **kwargs)


def get_workspace_nodes(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.get_workspace_nodes(*args, **kwargs)


def safe_get_workspace_nodes(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_get_workspace_nodes(*args, **kwargs)


def get_workspace_quotas(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.get_workspace_quotas(*args, **kwargs)


def safe_get_workspace_quotas(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_get_workspace_quotas(*args, **kwargs)


def get_cvm_info(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.get_cvm_info(*args, **kwargs)


def safe_get_cvm_info(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_get_cvm_info(*args, **kwargs)


def provision_cvm(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.provision_cvm(*args, **kwargs)


def safe_provision_cvm(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_provision_cvm(*args, **kwargs)


def commit_cvm_provision(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.commit_cvm_provision(*args, **kwargs)


def safe_commit_cvm_provision(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_commit_cvm_provision(*args, **kwargs)


def get_cvm_compose_file(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.get_cvm_compose_file(*args, **kwargs)


def safe_get_cvm_compose_file(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_get_cvm_compose_file(*args, **kwargs)


def provision_cvm_compose_file_update(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.provision_cvm_compose_file_update(*args, **kwargs)


def safe_provision_cvm_compose_file_update(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_provision_cvm_compose_file_update(*args, **kwargs)


def commit_cvm_compose_file_update(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.commit_cvm_compose_file_update(*args, **kwargs)


def safe_commit_cvm_compose_file_update(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_commit_cvm_compose_file_update(*args, **kwargs)


def update_cvm_envs(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.update_cvm_envs(*args, **kwargs)


def safe_update_cvm_envs(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_update_cvm_envs(*args, **kwargs)


def update_docker_compose(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.update_docker_compose(*args, **kwargs)


def safe_update_docker_compose(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_update_docker_compose(*args, **kwargs)


def update_pre_launch_script(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.update_pre_launch_script(*args, **kwargs)


def safe_update_pre_launch_script(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_update_pre_launch_script(*args, **kwargs)


def get_cvm_pre_launch_script(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.get_cvm_pre_launch_script(*args, **kwargs)


def safe_get_cvm_pre_launch_script(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_get_cvm_pre_launch_script(*args, **kwargs)


def start_cvm(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.start_cvm(*args, **kwargs)


def safe_start_cvm(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_start_cvm(*args, **kwargs)


def stop_cvm(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.stop_cvm(*args, **kwargs)


def safe_stop_cvm(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_stop_cvm(*args, **kwargs)


def shutdown_cvm(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.shutdown_cvm(*args, **kwargs)


def safe_shutdown_cvm(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_shutdown_cvm(*args, **kwargs)


def restart_cvm(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.restart_cvm(*args, **kwargs)


def safe_restart_cvm(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_restart_cvm(*args, **kwargs)


def delete_cvm(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.delete_cvm(*args, **kwargs)


def safe_delete_cvm(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_delete_cvm(*args, **kwargs)


def get_cvm_stats(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.get_cvm_stats(*args, **kwargs)


def safe_get_cvm_stats(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_get_cvm_stats(*args, **kwargs)


def get_cvm_network(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.get_cvm_network(*args, **kwargs)


def safe_get_cvm_network(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_get_cvm_network(*args, **kwargs)


def get_cvm_docker_compose(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.get_cvm_docker_compose(*args, **kwargs)


def safe_get_cvm_docker_compose(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_get_cvm_docker_compose(*args, **kwargs)


def get_cvm_containers_stats(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.get_cvm_containers_stats(*args, **kwargs)


def safe_get_cvm_containers_stats(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_get_cvm_containers_stats(*args, **kwargs)


def get_cvm_attestation(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.get_cvm_attestation(*args, **kwargs)


def safe_get_cvm_attestation(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_get_cvm_attestation(*args, **kwargs)


def update_cvm_resources(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.update_cvm_resources(*args, **kwargs)


def safe_update_cvm_resources(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_update_cvm_resources(*args, **kwargs)


def update_cvm_visibility(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.update_cvm_visibility(*args, **kwargs)


def safe_update_cvm_visibility(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_update_cvm_visibility(*args, **kwargs)


def get_available_os_images(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.get_available_os_images(*args, **kwargs)


def safe_get_available_os_images(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_get_available_os_images(*args, **kwargs)


def update_os_image(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.update_os_image(*args, **kwargs)


def safe_update_os_image(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_update_os_image(*args, **kwargs)


def patch_cvm(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.patch_cvm(*args, **kwargs)


def safe_patch_cvm(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_patch_cvm(*args, **kwargs)


def confirm_cvm_patch(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.confirm_cvm_patch(*args, **kwargs)


def safe_confirm_cvm_patch(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_confirm_cvm_patch(*args, **kwargs)


def get_cvm_state(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.get_cvm_state(*args, **kwargs)


def safe_get_cvm_state(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_get_cvm_state(*args, **kwargs)


def watch_cvm_state(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.watch_cvm_state(*args, **kwargs)


def get_kms_info(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.get_kms_info(*args, **kwargs)


def safe_get_kms_info(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_get_kms_info(*args, **kwargs)


def get_app_env_encrypt_pub_key(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.get_app_env_encrypt_pub_key(*args, **kwargs)


def safe_get_app_env_encrypt_pub_key(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_get_app_env_encrypt_pub_key(*args, **kwargs)


def next_app_ids(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.next_app_ids(*args, **kwargs)


def safe_next_app_ids(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_next_app_ids(*args, **kwargs)


def list_ssh_keys(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.list_ssh_keys(*args, **kwargs)


def safe_list_ssh_keys(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_list_ssh_keys(*args, **kwargs)


def import_github_profile_ssh_keys(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.import_github_profile_ssh_keys(*args, **kwargs)


def safe_import_github_profile_ssh_keys(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_import_github_profile_ssh_keys(*args, **kwargs)


def create_ssh_key(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.create_ssh_key(*args, **kwargs)


def safe_create_ssh_key(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_create_ssh_key(*args, **kwargs)


def delete_ssh_key(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.delete_ssh_key(*args, **kwargs)


def safe_delete_ssh_key(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_delete_ssh_key(*args, **kwargs)


def sync_github_ssh_keys(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.sync_github_ssh_keys(*args, **kwargs)


def safe_sync_github_ssh_keys(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_sync_github_ssh_keys(*args, **kwargs)


def get_cvm_status_batch(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.get_cvm_status_batch(*args, **kwargs)


def safe_get_cvm_status_batch(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_get_cvm_status_batch(*args, **kwargs)


def get_cvm_user_config(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.get_cvm_user_config(*args, **kwargs)


def safe_get_cvm_user_config(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_get_cvm_user_config(*args, **kwargs)


def refresh_cvm_instance_id(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.refresh_cvm_instance_id(*args, **kwargs)


def safe_refresh_cvm_instance_id(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_refresh_cvm_instance_id(*args, **kwargs)


def refresh_cvm_instance_ids(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.refresh_cvm_instance_ids(*args, **kwargs)


def safe_refresh_cvm_instance_ids(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_refresh_cvm_instance_ids(*args, **kwargs)


def replicate_cvm(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.replicate_cvm(*args, **kwargs)


def safe_replicate_cvm(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_replicate_cvm(*args, **kwargs)


def get_app_list(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.get_app_list(*args, **kwargs)


def safe_get_app_list(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_get_app_list(*args, **kwargs)


def get_app_info(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.get_app_info(*args, **kwargs)


def safe_get_app_info(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_get_app_info(*args, **kwargs)


def get_app_cvms(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.get_app_cvms(*args, **kwargs)


def safe_get_app_cvms(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_get_app_cvms(*args, **kwargs)


def create_app_instance(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.create_app_instance(*args, **kwargs)


def safe_create_app_instance(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_create_app_instance(*args, **kwargs)


def get_app_revisions(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.get_app_revisions(*args, **kwargs)


def safe_get_app_revisions(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_get_app_revisions(*args, **kwargs)


def get_app_revision_detail(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.get_app_revision_detail(*args, **kwargs)


def safe_get_app_revision_detail(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_get_app_revision_detail(*args, **kwargs)


def get_app_filter_options(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.get_app_filter_options(*args, **kwargs)


def safe_get_app_filter_options(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_get_app_filter_options(*args, **kwargs)


def get_app_attestation(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.get_app_attestation(*args, **kwargs)


def safe_get_app_attestation(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_get_app_attestation(*args, **kwargs)


def get_kms_on_chain_detail(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.get_kms_on_chain_detail(*args, **kwargs)


def safe_get_kms_on_chain_detail(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_get_kms_on_chain_detail(*args, **kwargs)


def get_os_images(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.get_os_images(*args, **kwargs)


def safe_get_os_images(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_get_os_images(*args, **kwargs)


def get_app_device_allowlist(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.get_app_device_allowlist(*args, **kwargs)


def safe_get_app_device_allowlist(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_get_app_device_allowlist(*args, **kwargs)


def add_compose_hash(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.add_compose_hash(*args, **kwargs)


def safe_add_compose_hash(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_add_compose_hash(*args, **kwargs)


def deploy_app_auth(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.deploy_app_auth(*args, **kwargs)


def safe_deploy_app_auth(client: Any, *args: Any, **kwargs: Any) -> Any:
    return client.safe_deploy_app_auth(*args, **kwargs)
