import httpx

from phala_cloud import PhalaCloud

CONTRACT = {
    "id": "kc_abc",
    "slug": "phala",
    "label": "Phala KMS",
    "contract_address": "phala",
    "chain_id": 0,
    "k256_pubkey": "0x0334c7",
    "ca_pubkey": "0xca00",
    "node_count": 16,
}


def _client(handler) -> PhalaCloud:
    transport = httpx.MockTransport(handler)
    raw = httpx.Client(transport=transport, base_url="https://cloud-api.phala.com/api/v1")
    return PhalaCloud(http_client=raw)


def test_list_kms_contracts_pins_version() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/kms"
        assert request.headers["x-phala-version"] == "2026-06-23"
        return httpx.Response(
            200,
            json={"items": [CONTRACT], "total": 1, "page": 1, "page_size": 20, "pages": 1},
        )

    client = _client(handler)
    result = client.list_kms_contracts()
    assert result.items[0].slug == "phala"
    assert result.items[0].k256_pubkey == "0x0334c7"
    assert result.items[0].node_count == 16


def test_get_kms_contract_by_slug() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/kms/phala"
        assert request.headers["x-phala-version"] == "2026-06-23"
        return httpx.Response(200, json=CONTRACT)

    client = _client(handler)
    contract = client.get_kms_contract("phala")
    assert contract.contract_address == "phala"
    assert contract.chain_id == 0


def test_list_kms_contract_nodes_with_rpc_url() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/kms/phala/nodes"
        assert request.headers["x-phala-version"] == "2026-06-23"
        return httpx.Response(
            200,
            json={
                "items": [
                    {
                        "id": "kms_1",
                        "slug": "phala-prod3",
                        "url": "https://kms.dstack-pha-prod3.phala.network",
                        "version": "0.5.7",
                        "kms_type": "phala",
                    }
                ],
                "total": 1,
            },
        )

    client = _client(handler)
    result = client.list_kms_contract_nodes("phala")
    assert result.total == 1
    assert result.items[0].url == "https://kms.dstack-pha-prod3.phala.network"


def test_get_kms_list_stays_on_legacy_version() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/kms"
        assert request.headers["x-phala-version"] == "2026-05-22"
        return httpx.Response(
            200,
            json={"items": [], "total": 0, "page": 1, "page_size": 20, "pages": 0},
        )

    client = _client(handler)
    result = client.get_kms_list()
    assert result.total == 0
