from __future__ import annotations

import platform
from importlib.metadata import PackageNotFoundError, version

import httpx

_PACKAGE_NAME = "phala-cloud"


def sdk_version() -> str:
    try:
        return version(_PACKAGE_NAME)
    except PackageNotFoundError:
        return "0.0.0"


def default_user_agent() -> str:
    return (
        f"phala-cloud-sdk-python/{sdk_version()} "
        f"python/{platform.python_version()} "
        f"httpx/{httpx.__version__}"
    )
