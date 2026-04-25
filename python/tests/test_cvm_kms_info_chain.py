from phala_cloud.models.cvms import CvmKmsInfoV20260121


def test_cvm_kms_info_chain_base() -> None:
    info = CvmKmsInfoV20260121.model_validate({"chain_id": 8453, "dstack_kms_address": "0x123"})
    assert info.chain is not None
    assert info.chain["id"] == 8453
    assert info.chain["name"] == "Base"
    assert info.chain["network"] == "base"


def test_cvm_kms_info_chain_mainnet() -> None:
    info = CvmKmsInfoV20260121.model_validate({"chain_id": 1})
    assert info.chain is not None
    assert info.chain["id"] == 1
    assert info.chain["name"] == "Ethereum"


def test_cvm_kms_info_chain_anvil() -> None:
    info = CvmKmsInfoV20260121.model_validate({"chain_id": 31337})
    assert info.chain is not None
    assert info.chain["name"] == "Anvil"


def test_cvm_kms_info_chain_unknown() -> None:
    info = CvmKmsInfoV20260121.model_validate({"chain_id": 99999})
    assert info.chain is None


def test_cvm_kms_info_chain_missing() -> None:
    info = CvmKmsInfoV20260121.model_validate({"dstack_kms_address": "0x123"})
    assert info.chain is None
