from phala_cloud import actions


def test_actions_exports_have_core_entries() -> None:
    required = [
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
        "add_compose_hash",
        "safe_add_compose_hash",
        "deploy_app_auth",
        "safe_deploy_app_auth",
        "get_kms_on_chain_detail",
        "safe_get_kms_on_chain_detail",
        "get_os_images",
        "safe_get_os_images",
        "get_app_device_allowlist",
        "safe_get_app_device_allowlist",
    ]
    for name in required:
        assert hasattr(actions, name)
