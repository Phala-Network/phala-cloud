from phala_cloud.models.cvms import CvmLogUrlsV20260121


def test_cvm_log_urls_parse_presigned_payload() -> None:
    urls = CvmLogUrlsV20260121.model_validate(
        {
            "serial": (
                "https://cloud-logs.phala.com/logs/123e4567-e89b-12d3-a456-426614174000/"
                "node/serial?uid=7&exp=123&kid=primary&sig=abc"
            ),
            "stdout": (
                "https://cloud-logs.phala.com/logs/123e4567-e89b-12d3-a456-426614174000/"
                "node/stdout?uid=7&exp=123&kid=primary&sig=abc"
            ),
            "stderr": (
                "https://cloud-logs.phala.com/logs/123e4567-e89b-12d3-a456-426614174000/"
                "node/stderr?uid=7&exp=123&kid=primary&sig=abc"
            ),
            "container_log_base": (
                "https://cloud-logs.phala.com/logs/123e4567-e89b-12d3-a456-426614174000/container"
            ),
            "auth_query": "uid=7&exp=123&kid=primary&sig=abc",
        }
    )

    assert urls.serial == (
        "https://cloud-logs.phala.com/logs/123e4567-e89b-12d3-a456-426614174000/"
        "node/serial?uid=7&exp=123&kid=primary&sig=abc"
    )
    assert urls.stdout == (
        "https://cloud-logs.phala.com/logs/123e4567-e89b-12d3-a456-426614174000/"
        "node/stdout?uid=7&exp=123&kid=primary&sig=abc"
    )
    assert urls.stderr == (
        "https://cloud-logs.phala.com/logs/123e4567-e89b-12d3-a456-426614174000/"
        "node/stderr?uid=7&exp=123&kid=primary&sig=abc"
    )
    assert urls.container_log_base == (
        "https://cloud-logs.phala.com/logs/123e4567-e89b-12d3-a456-426614174000/container"
    )
    assert urls.auth_query == "uid=7&exp=123&kid=primary&sig=abc"
