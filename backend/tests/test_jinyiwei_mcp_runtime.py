import pytest

import app.jinyiwei.mcp.runtime as runtime_module
from app.jinyiwei.mcp.credentials import (
    EnvCredentialProvider,
    McpCredentialError,
    StoredOAuthCredentialProvider,
)
from app.jinyiwei.mcp.runtime import build_runtime_credential_provider


class FakeStore:
    def __init__(self) -> None:
        self.load_calls = 0

    def load(self, _server_id: str) -> None:
        self.load_calls += 1
        raise AssertionError("store read during construction")


def test_runtime_credentials_default_to_env() -> None:
    provider = build_runtime_credential_provider(environ={})
    assert isinstance(provider, EnvCredentialProvider)


def test_runtime_credentials_use_injected_store_only_in_explicit_local_mode() -> None:
    store = FakeStore()
    provider = build_runtime_credential_provider(
        environ={"JINYIWEI_MCP_CREDENTIAL_SOURCE": "local"},
        credential_store=store,
    )
    assert isinstance(provider, StoredOAuthCredentialProvider)
    assert provider._store is store
    assert store.load_calls == 0


def test_runtime_credentials_consult_current_environment_for_local_mode(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    current_environment = {"JINYIWEI_MCP_CREDENTIAL_SOURCE": "local"}
    store = FakeStore()
    monkeypatch.setattr(runtime_module.os, "environ", current_environment)

    provider = build_runtime_credential_provider(credential_store=store)

    assert isinstance(provider, StoredOAuthCredentialProvider)
    assert provider._store is store
    assert store.load_calls == 0


@pytest.mark.parametrize("value", ["LOCAL", "file", "auto", " local "])
def test_runtime_credentials_reject_unknown_or_noncanonical_modes(value: str) -> None:
    with pytest.raises(McpCredentialError, match="credential_source_invalid"):
        build_runtime_credential_provider(
            environ={"JINYIWEI_MCP_CREDENTIAL_SOURCE": value}
        )
