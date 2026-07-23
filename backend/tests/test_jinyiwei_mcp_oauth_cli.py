from __future__ import annotations

import io
import json

import pytest

from app.jinyiwei.mcp.oauth.cli import run_oauth_cli
from app.jinyiwei.mcp.oauth.models import OAuthCredential
from app.jinyiwei.mcp.oauth.store import CredentialStatus, CredentialStoreError
from app.jinyiwei.mcp.registry import (
    McpRegistry,
    McpRegistryError,
    approval_fingerprint,
    load_default_registry,
)
from app.jinyiwei.network import EXTERNAL_NETWORK_FLAG


def _registry(*, oauth_origins: tuple[str, ...] | None = None) -> McpRegistry:
    current = load_default_registry()
    servers = []
    selected_servers = {}
    for server in current.servers:
        payload = server.model_dump(mode="json")
        if oauth_origins is not None:
            payload["oauth_allowed_origins"] = list(oauth_origins)
        servers.append(payload)
        selected_servers[server.server_id] = server.model_validate(payload)
    tools = []
    for approval in current.approvals:
        payload = approval.model_dump(mode="json")
        selected_server = selected_servers[approval.server_id]
        payload["approved_fingerprint"] = approval_fingerprint(
            selected_server,
            approval.approved_discovered_tool,
            approval.mapping,
        )
        tools.append(payload)
    return McpRegistry.from_mapping(
        {
            "servers": servers,
            "tools": tools,
        }
    )


def _credential() -> OAuthCredential:
    return OAuthCredential(
        access_token="access-secret",
        refresh_token="refresh-secret",
        expires_at=5000,
        client_id="public-client",
        token_endpoint="https://stockbuddy.qq.com/token",
    )


class _Service:
    def __init__(self, *, fail: bool = False) -> None:
        self.fail = fail
        self.calls: list[str] = []

    def authorize(self, server) -> OAuthCredential:
        self.calls.append(server.server_id)
        if self.fail:
            raise RuntimeError(
                "access-secret refresh-secret authorization-code private-account"
            )
        return _credential()


class _Store:
    def __init__(
        self,
        *,
        status: CredentialStatus = CredentialStatus.VALID,
        removed: bool = True,
        fail: bool = False,
    ) -> None:
        self.current_status = status
        self.removed = removed
        self.fail = fail
        self.status_calls: list[str] = []
        self.remove_calls: list[str] = []

    def status(self, server_id: str, _now: float) -> CredentialStatus:
        self.status_calls.append(server_id)
        if self.fail:
            raise CredentialStoreError("dpapi_unavailable access-secret")
        return self.current_status

    def remove(self, server_id: str) -> bool:
        self.remove_calls.append(server_id)
        if self.fail:
            raise CredentialStoreError("dpapi_unavailable refresh-secret")
        return self.removed


def _run(
    *argv: str,
    registry: McpRegistry | None = None,
    service: _Service | None = None,
    store: _Store | None = None,
    network: bool = True,
) -> tuple[int, str, str]:
    stdout = io.StringIO()
    stderr = io.StringIO()
    environ = {EXTERNAL_NETWORK_FLAG: "true"} if network else {}
    code = run_oauth_cli(
        list(argv),
        registry=registry or _registry(),
        service=service,
        store=store,
        environ=environ,
        stdout=stdout,
        stderr=stderr,
    )
    return code, stdout.getvalue(), stderr.getvalue()


def test_authorize_cli_prints_only_safe_status_without_mutating_registry() -> None:
    registry = _registry()
    before = registry.server("westock")
    approvals_before = registry.approvals
    service = _Service()

    code, stdout, stderr = _run(
        "authorize",
        "--server",
        "westock",
        registry=registry,
        service=service,
    )

    assert code == 0
    assert json.loads(stdout) == {"server": "westock", "status": "authorized"}
    assert stderr == ""
    assert service.calls == ["westock"]
    assert registry.server("westock") == before
    assert registry.approvals == approvals_before
    assert "access-secret" not in stdout + stderr
    assert "refresh-secret" not in stdout + stderr


def test_authorize_requires_explicit_network_gate_before_service_call() -> None:
    service = _Service()

    code, stdout, stderr = _run(
        "authorize",
        "--server",
        "westock",
        service=service,
        network=False,
    )

    assert code == 2
    assert stdout == ""
    assert json.loads(stderr) == {
        "server": "westock",
        "status": "external_network_disabled",
    }
    assert service.calls == []


def test_authorize_requires_registered_oauth_origins() -> None:
    service = _Service()

    code, stdout, stderr = _run(
        "authorize",
        "--server",
        "westock",
        registry=_registry(oauth_origins=()),
        service=service,
    )

    assert code == 2
    assert stdout == ""
    assert json.loads(stderr) == {
        "server": "westock",
        "status": "oauth_not_configured",
    }
    assert service.calls == []


@pytest.mark.parametrize(
    ("stored", "expected"),
    (
        (CredentialStatus.MISSING, "missing"),
        (CredentialStatus.VALID, "valid"),
        (CredentialStatus.EXPIRING_SOON, "expiring_soon"),
        (CredentialStatus.EXPIRED, "expired"),
    ),
)
def test_status_reports_only_local_credential_state(
    stored: CredentialStatus, expected: str
) -> None:
    code, stdout, stderr = _run(
        "status",
        "--server",
        "westock",
        store=_Store(status=stored),
        network=False,
    )

    assert code == 0
    assert json.loads(stdout) == {"server": "westock", "status": expected}
    assert stderr == ""


def test_unknown_server_is_not_echoed() -> None:
    code, stdout, stderr = _run(
        "status",
        "--server",
        "unknown-secret-server",
        store=_Store(),
    )

    assert code == 2
    assert stdout == ""
    assert json.loads(stderr) == {
        "server": "invalid",
        "status": "server_not_registered",
    }
    assert "unknown-secret-server" not in stderr


@pytest.mark.parametrize(
    "failure",
    (
        McpRegistryError("missing_registry private-path"),
        RuntimeError("corrupt_registry access-secret"),
    ),
)
def test_default_registry_load_failure_is_redacted_json(
    monkeypatch: pytest.MonkeyPatch, failure: Exception
) -> None:
    def fail_load() -> McpRegistry:
        raise failure

    monkeypatch.setattr(
        "app.jinyiwei.mcp.oauth.cli.load_default_registry",
        fail_load,
    )
    stdout = io.StringIO()
    stderr = io.StringIO()

    code = run_oauth_cli(
        ["status", "--server", "westock"],
        store=_Store(),
        environ={},
        stdout=stdout,
        stderr=stderr,
    )

    assert code == 1
    assert stdout.getvalue() == ""
    assert json.loads(stderr.getvalue()) == {
        "server": "invalid",
        "status": "registry_unavailable",
    }
    assert "private-path" not in stderr.getvalue()
    assert "access-secret" not in stderr.getvalue()


@pytest.mark.parametrize("interrupt_type", (KeyboardInterrupt, SystemExit))
def test_default_registry_loader_does_not_swallow_process_interrupts(
    monkeypatch: pytest.MonkeyPatch,
    interrupt_type: type[BaseException],
) -> None:
    def interrupt() -> McpRegistry:
        raise interrupt_type()

    monkeypatch.setattr(
        "app.jinyiwei.mcp.oauth.cli.load_default_registry",
        interrupt,
    )

    with pytest.raises(interrupt_type):
        run_oauth_cli(
            ["status", "--server", "westock"],
            store=_Store(),
            environ={},
            stdout=io.StringIO(),
            stderr=io.StringIO(),
        )


def test_default_store_build_failure_is_redacted_json(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fail_store(_root: object) -> _Store:
        raise CredentialStoreError("dpapi_unavailable private-path access-secret")

    monkeypatch.setattr(
        "app.jinyiwei.mcp.oauth.cli.OAuthCredentialStore",
        fail_store,
    )
    stdout = io.StringIO()
    stderr = io.StringIO()

    code = run_oauth_cli(
        ["status", "--server", "westock"],
        registry=_registry(),
        environ={},
        stdout=stdout,
        stderr=stderr,
    )

    assert code == 1
    assert stdout.getvalue() == ""
    assert json.loads(stderr.getvalue()) == {
        "server": "westock",
        "status": "credential_store_unavailable",
    }
    assert "dpapi" not in stderr.getvalue()
    assert "private-path" not in stderr.getvalue()
    assert "access-secret" not in stderr.getvalue()


def test_revoke_local_requires_yes_and_never_calls_store_without_it() -> None:
    store = _Store()

    code, stdout, stderr = _run(
        "revoke-local",
        "--server",
        "westock",
        store=store,
    )

    assert code == 2
    assert stdout == ""
    assert json.loads(stderr) == {
        "server": "westock",
        "status": "confirmation_required",
    }
    assert store.remove_calls == []


@pytest.mark.parametrize(
    ("removed", "expected"),
    ((True, "removed"), (False, "not_found")),
)
def test_revoke_local_reports_safe_removal_status(
    removed: bool, expected: str
) -> None:
    code, stdout, stderr = _run(
        "revoke-local",
        "--server",
        "westock",
        "--yes",
        store=_Store(removed=removed),
    )

    assert code == 0
    assert json.loads(stdout) == {"server": "westock", "status": expected}
    assert stderr == ""


def test_dpapi_or_authorization_failures_are_completely_redacted() -> None:
    status_code, status_stdout, status_stderr = _run(
        "status",
        "--server",
        "westock",
        store=_Store(fail=True),
    )
    auth_code, auth_stdout, auth_stderr = _run(
        "authorize",
        "--server",
        "westock",
        service=_Service(fail=True),
    )
    combined = status_stdout + status_stderr + auth_stdout + auth_stderr

    assert status_code == 1
    assert json.loads(status_stderr)["status"] == "credential_store_unavailable"
    assert auth_code == 1
    assert json.loads(auth_stderr)["status"] == "authorization_failed"
    for forbidden in (
        "access-secret",
        "refresh-secret",
        "authorization-code",
        "private-account",
        "dpapi",
    ):
        assert forbidden not in combined


@pytest.mark.parametrize("forbidden_flag", ("--url", "--token", "--account"))
def test_cli_rejects_unapproved_flags_without_echoing_values(
    forbidden_flag: str,
) -> None:
    code, stdout, stderr = _run(
        "authorize",
        "--server",
        "westock",
        forbidden_flag,
        "secret-value",
    )

    assert code == 2
    assert stdout == ""
    assert json.loads(stderr) == {
        "server": "invalid",
        "status": "invalid_arguments",
    }
    assert "secret-value" not in stderr
