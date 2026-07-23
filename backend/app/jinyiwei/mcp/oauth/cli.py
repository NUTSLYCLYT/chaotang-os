"""Redacted local administrator CLI for registered MCP OAuth credentials."""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Protocol, TextIO

from app.jinyiwei.mcp.contracts import McpServerConfig
from app.jinyiwei.mcp.oauth.models import OAuthCredential
from app.jinyiwei.mcp.oauth.service import OAuthAuthorizationService
from app.jinyiwei.mcp.oauth.store import (
    CredentialStatus,
    OAuthCredentialStore,
)
from app.jinyiwei.mcp.registry import McpRegistry, McpRegistryError, load_default_registry
from app.jinyiwei.network import (
    EXTERNAL_NETWORK_FLAG,
    EXTERNAL_NETWORK_TRUTHY_VALUES,
)


class _InvalidArguments(ValueError):
    pass


class _RedactedArgumentParser(argparse.ArgumentParser):
    def error(self, message: str) -> None:
        del message
        raise _InvalidArguments("invalid_arguments")


class _AuthorizationService(Protocol):
    def authorize(self, server: McpServerConfig) -> OAuthCredential: ...


class _CredentialStore(Protocol):
    def status(self, server_id: str, now: float) -> CredentialStatus: ...

    def remove(self, server_id: str) -> bool: ...


def _parser() -> argparse.ArgumentParser:
    parser = _RedactedArgumentParser(
        prog="python -m app.jinyiwei.mcp.oauth",
        add_help=False,
    )
    commands = parser.add_subparsers(
        dest="command",
        required=True,
        parser_class=_RedactedArgumentParser,
    )
    for name in ("authorize", "status", "revoke-local"):
        command = commands.add_parser(
            name,
            add_help=False,
        )
        command.add_argument("--server", required=True)
        if name == "revoke-local":
            command.add_argument("--yes", action="store_true")
    return parser


def _emit(stream: TextIO, *, server: str, status: str) -> None:
    stream.write(
        json.dumps(
            {"server": server, "status": status},
            ensure_ascii=False,
            allow_nan=False,
            separators=(",", ":"),
        )
        + "\n"
    )


def _network_enabled(environ: Mapping[str, str]) -> bool:
    return (
        environ.get(EXTERNAL_NETWORK_FLAG, "").strip().casefold()
        in EXTERNAL_NETWORK_TRUTHY_VALUES
    )


def default_store() -> OAuthCredentialStore:
    """Build the fixed current-user DPAPI credential store."""

    backend_root = Path(__file__).resolve().parents[4]
    return OAuthCredentialStore(backend_root / "data" / "credentials")


def build_default_service(
    *, store: OAuthCredentialStore | None = None
) -> OAuthAuthorizationService:
    """Build authorization dependencies without opening a browser or using the network."""

    return OAuthAuthorizationService(store=store or default_store())


def run_oauth_cli(
    argv: Sequence[str] | None = None,
    *,
    registry: McpRegistry | None = None,
    service: _AuthorizationService | None = None,
    store: _CredentialStore | None = None,
    environ: Mapping[str, str] | None = None,
    stdout: TextIO | None = None,
    stderr: TextIO | None = None,
) -> int:
    """Execute one local-only administrator action with fixed JSON output."""

    output = sys.stdout if stdout is None else stdout
    errors = sys.stderr if stderr is None else stderr
    try:
        args = _parser().parse_args(argv)
    except _InvalidArguments:
        _emit(errors, server="invalid", status="invalid_arguments")
        return 2

    if registry is None:
        try:
            selected_registry = load_default_registry()
        except Exception:
            _emit(errors, server="invalid", status="registry_unavailable")
            return 1
    else:
        selected_registry = registry
    try:
        server = selected_registry.server(args.server)
    except McpRegistryError:
        _emit(errors, server="invalid", status="server_not_registered")
        return 2

    if args.command == "authorize":
        if not server.oauth_allowed_origins:
            _emit(errors, server=server.server_id, status="oauth_not_configured")
            return 2
        process_environ = os.environ if environ is None else environ
        if not _network_enabled(process_environ):
            _emit(errors, server=server.server_id, status="external_network_disabled")
            return 2
        try:
            selected_service = service or build_default_service()
            selected_service.authorize(server)
        except Exception:
            _emit(errors, server=server.server_id, status="authorization_failed")
            return 1
        _emit(output, server=server.server_id, status="authorized")
        return 0

    if args.command == "status":
        try:
            selected_store = store if store is not None else default_store()
            status = selected_store.status(server.server_id, time.time())
        except Exception:
            _emit(
                errors,
                server=server.server_id,
                status="credential_store_unavailable",
            )
            return 1
        _emit(output, server=server.server_id, status=status.value)
        return 0

    if not args.yes:
        _emit(errors, server=server.server_id, status="confirmation_required")
        return 2
    try:
        selected_store = store if store is not None else default_store()
        removed = selected_store.remove(server.server_id)
    except Exception:
        _emit(errors, server=server.server_id, status="credential_store_unavailable")
        return 1
    _emit(
        output,
        server=server.server_id,
        status="removed" if removed else "not_found",
    )
    return 0


def main() -> int:
    return run_oauth_cli()
