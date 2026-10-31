import httpx

from phala_cloud import PhalaCloud


def test_cookie_mode_preserves_caller_auth_headers() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["authorization"] == "Bearer custom"
        assert request.headers["x-api-key"] == "custom-key"
        return httpx.Response(200, json={})

    with httpx.Client(
        transport=httpx.MockTransport(handler),
        base_url="https://api.example",
        headers={"Authorization": "Bearer custom", "X-API-Key": "custom-key"},
    ) as raw:
        PhalaCloud(http_client=raw, use_cookie_auth=True, api_key="ignored").get("/custom")
