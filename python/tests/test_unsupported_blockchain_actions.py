import phala_cloud
from phala_cloud import actions


def test_unimplemented_blockchain_actions_are_not_exposed() -> None:
    for name in ("add_compose_hash", "deploy_app_auth"):
        assert not hasattr(phala_cloud, name)
        assert not hasattr(actions, name)
        assert not hasattr(actions, f"safe_{name}")
        assert not hasattr(phala_cloud.PhalaCloud, name)
        assert not hasattr(phala_cloud.AsyncPhalaCloud, name)
        assert not hasattr(phala_cloud.PhalaCloud, f"safe_{name}")
        assert not hasattr(phala_cloud.AsyncPhalaCloud, f"safe_{name}")
