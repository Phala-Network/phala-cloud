import json

import httpx
import pytest

import phala_cloud


@pytest.mark.parametrize("async_client", [False, True])
@pytest.mark.asyncio
async def test_cvm_ssh_update_defaults_do_not_request_restart(async_client: bool) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "PUT"
        assert request.url.path == "/cvms/cvm_123/ssh-keys"
        assert json.loads(request.content) == {"ssh_key_ids": ["sshkey_1"], "apply_now": False}
        return httpx.Response(200, json={"keys": [], "restart_required": True})

    request = {"cvm_id": "cvm_123", "ssh_key_ids": ["sshkey_1"]}
    transport = httpx.MockTransport(handler)
    if async_client:
        async with httpx.AsyncClient(transport=transport, base_url="https://example.com") as raw:
            result = await phala_cloud.AsyncPhalaCloud(http_client=raw).update_cvm_ssh_keys(request)
    else:
        with httpx.Client(transport=transport, base_url="https://example.com") as raw:
            result = phala_cloud.PhalaCloud(http_client=raw).update_cvm_ssh_keys(request)
    assert result.restart_required is True


@pytest.mark.parametrize("async_client", [False, True])
@pytest.mark.asyncio
async def test_cvm_ssh_key_actions(async_client: bool) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/cvms/cvm_123/ssh-keys"
        if request.method == "PUT":
            assert json.loads(request.content) == {
                "ssh_key_ids": ["sshkey_1"],
                "usernames": ["alice"],
                "apply_now": True,
            }
        else:
            assert request.method == "GET"
        return httpx.Response(
            200,
            json={
                "keys": [
                    {
                        "id": "sshkey_1",
                        "owner_user_id": "usr_1",
                        "owner_username": "alice",
                        "added_by_user_id": "usr_1",
                        "name": "laptop",
                        "public_key": "ssh-ed25519 AAAA",
                        "fingerprint": "SHA256:test",
                        "key_type": "ssh-ed25519",
                    }
                ],
                "restart_required": True,
            },
        )

    transport = httpx.MockTransport(handler)
    get_request = {"cvm_id": "cvm_123"}
    update_request = {
        **get_request,
        "ssh_key_ids": ["sshkey_1"],
        "usernames": ["alice"],
        "apply_now": True,
    }
    if async_client:
        async with httpx.AsyncClient(transport=transport, base_url="https://example.com") as raw:
            client = phala_cloud.AsyncPhalaCloud(http_client=raw)
            results = [
                await phala_cloud.get_cvm_ssh_keys(client, get_request),
                (await phala_cloud.safe_get_cvm_ssh_keys(client, get_request)).unwrap(),
                await phala_cloud.update_cvm_ssh_keys(client, update_request),
                (await phala_cloud.safe_update_cvm_ssh_keys(client, update_request)).unwrap(),
            ]
    else:
        with httpx.Client(transport=transport, base_url="https://example.com") as raw:
            sync = phala_cloud.PhalaCloud(http_client=raw)
            results = [
                phala_cloud.get_cvm_ssh_keys(sync, get_request),
                phala_cloud.safe_get_cvm_ssh_keys(sync, get_request).unwrap(),
                phala_cloud.update_cvm_ssh_keys(sync, update_request),
                phala_cloud.safe_update_cvm_ssh_keys(sync, update_request).unwrap(),
            ]
    assert all(
        result.keys[0].public_key == "ssh-ed25519 AAAA" and result.restart_required
        for result in results
    )
