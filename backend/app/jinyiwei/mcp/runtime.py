"""Runtime credential selection for administrator-approved MCP servers."""

from __future__ import annotations

import os
from collections.abc import Mapping
from pathlib import Path

from app.jinyiwei.mcp.credentials import (
    CredentialProvider,
    EnvCredentialProvider,
    McpCredentialError,
    OAuthCredentialStoreProtocol,
    StoredOAuthCredentialProvider,
)
from app.jinyiwei.mcp.oauth.store import OAuthCredentialStore

LOCAL_CREDENTIAL_SOURCE_ENV = "JINYIWEI_MCP_CREDENTIAL_SOURCE"


def default_credential_store_path() -> Path:
    """Return the fixed backend-local encrypted OAuth credential directory."""

    return Path(__file__).resolve().parents[3] / "data" / "credentials"


def build_runtime_credential_provider(
    *,
    environ: Mapping[str, str] | None = None,
    credential_store: OAuthCredentialStoreProtocol | None = None,
) -> CredentialProvider:
    """Select env credentials unless exact explicit local mode is requested."""

    current_environ = os.environ if environ is None else environ
    selected = current_environ.get(LOCAL_CREDENTIAL_SOURCE_ENV, "env")
    if selected == "env":
        return EnvCredentialProvider(environ=current_environ)
    if selected != "local":
        raise McpCredentialError("credential_source_invalid")
    store = (
        credential_store
        if credential_store is not None
        else OAuthCredentialStore(default_credential_store_path())
    )
    return StoredOAuthCredentialProvider(store=store, approved_endpoints={})


__all__ = [
    "LOCAL_CREDENTIAL_SOURCE_ENV",
    "build_runtime_credential_provider",
    "default_credential_store_path",
]
