"""Fail-closed registry for administrator-approved MCP tools."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping
from pathlib import Path
from typing import Any

import yaml
from pydantic import ValidationError
from yaml.nodes import MappingNode

from app.jinyiwei.models import RequiredFact

from .contracts import (
    DiscoveredTool,
    McpServerConfig,
    McpToolApproval,
    McpToolMapping,
    ToolEffect,
)


class McpRegistryError(ValueError):
    """A stable, non-secret MCP registry configuration failure."""


class _DuplicateConfigKey(yaml.YAMLError):
    pass


class _UniqueKeySafeLoader(yaml.SafeLoader):
    """SafeLoader that rejects last-key-wins ambiguity at every mapping depth."""

    def construct_mapping(self, node: yaml.Node, deep: bool = False) -> Any:
        if not isinstance(node, MappingNode):
            return super().construct_mapping(node, deep=deep)
        self.flatten_mapping(node)
        mapping: dict[Any, Any] = {}
        for key_node, value_node in node.value:
            key = self.construct_object(key_node, deep=deep)
            try:
                duplicate = key in mapping
            except TypeError as exc:
                raise yaml.constructor.ConstructorError(
                    "while constructing a mapping",
                    node.start_mark,
                    "found unhashable key",
                    key_node.start_mark,
                ) from exc
            if duplicate:
                raise _DuplicateConfigKey("duplicate_config_key")
            mapping[key] = self.construct_object(value_node, deep=deep)
        return mapping


def _canonical_json(payload: Mapping[str, Any]) -> bytes:
    try:
        return json.dumps(
            payload,
            ensure_ascii=False,
            allow_nan=False,
            separators=(",", ":"),
            sort_keys=True,
        ).encode("utf-8")
    except (TypeError, ValueError) as exc:
        raise McpRegistryError("invalid_approval_payload") from exc


def approval_fingerprint(
    server: McpServerConfig,
    discovered_tool_schema: DiscoveredTool | Mapping[str, Any],
    mapping: McpToolMapping | None = None,
) -> str:
    """Bind approval to the server, remote schema, and deterministic mapping."""

    try:
        tool = (
            discovered_tool_schema
            if isinstance(discovered_tool_schema, DiscoveredTool)
            else DiscoveredTool.model_validate(discovered_tool_schema)
        )
    except ValidationError as exc:
        raise McpRegistryError("invalid_discovered_tool") from exc
    payload = {
        "server": server.fingerprint_payload(),
        "tool": tool.model_dump(mode="python", by_alias=True),
    }
    if mapping is not None:
        payload["mapping"] = mapping.model_dump(mode="json")
    return hashlib.sha256(_canonical_json(payload)).hexdigest()


class McpRegistry:
    """Frozen runtime view of code-owned MCP configuration.

    ``from_mapping`` parses trusted repository configuration. It is deliberately
    not exposed by an HTTP endpoint or agent tool; callers cannot add URLs,
    credentials, or capabilities dynamically.
    """

    def __init__(
        self,
        servers: tuple[McpServerConfig, ...],
        approvals: tuple[McpToolApproval, ...],
    ) -> None:
        self._servers = servers
        self._servers_by_id = {server.server_id: server for server in servers}
        self._approvals = tuple(
            sorted(
                approvals,
                key=lambda item: (item.priority, item.server_id, item.tool_name),
            )
        )

    @property
    def servers(self) -> tuple[McpServerConfig, ...]:
        return self._servers

    @property
    def approvals(self) -> tuple[McpToolApproval, ...]:
        return self._approvals

    def source_configuration_fingerprint(self) -> str:
        """Hash cache-relevant source configuration without credential references."""

        servers = []
        for server in sorted(self._servers, key=lambda item: item.server_id):
            payload = server.model_dump(mode="json")
            payload.pop("credential_ref", None)
            servers.append(payload)
        approvals = []
        for approval in self._approvals:
            payload = approval.model_dump(mode="json")
            # This approval checksum is derived partly from the server's
            # credential reference. All behavior-relevant approval inputs are
            # represented directly below, so omitting it avoids credential
            # rotation invalidating evidence caches.
            payload.pop("approved_fingerprint", None)
            approvals.append(payload)
        return hashlib.sha256(
            _canonical_json({"servers": servers, "tools": approvals})
        ).hexdigest()

    def server(self, server_id: str) -> McpServerConfig:
        try:
            return self._servers_by_id[server_id]
        except KeyError as exc:
            raise McpRegistryError("unknown_server_id") from exc

    def approval(self, server_id: str, tool_name: str) -> McpToolApproval:
        for approval in self._approvals:
            if approval.server_id == server_id and approval.tool_name == tool_name:
                return approval
        raise McpRegistryError("approval_not_registered")

    @classmethod
    def from_mapping(cls, payload: Mapping[str, object]) -> McpRegistry:
        if set(payload) != {"servers", "tools"}:
            raise McpRegistryError("invalid_registry_config")
        raw_servers = payload.get("servers")
        raw_tools = payload.get("tools")
        if not isinstance(raw_servers, list) or not isinstance(raw_tools, list):
            raise McpRegistryError("invalid_registry_config")
        try:
            servers = tuple(McpServerConfig.model_validate(item) for item in raw_servers)
        except (ValidationError, TypeError) as exc:
            raise McpRegistryError("invalid_servers_config") from exc
        server_ids = tuple(server.server_id for server in servers)
        if len(server_ids) != len(set(server_ids)):
            raise McpRegistryError("duplicate_server_id")

        try:
            approvals = tuple(McpToolApproval.model_validate(item) for item in raw_tools)
        except (ValidationError, TypeError) as exc:
            raise McpRegistryError("invalid_tools_config") from exc
        tool_identities = tuple((approval.server_id, approval.tool_name) for approval in approvals)
        if len(tool_identities) != len(set(tool_identities)):
            raise McpRegistryError("duplicate_tool_identity")

        servers_by_id = {server.server_id: server for server in servers}
        for approval in approvals:
            server = servers_by_id.get(approval.server_id)
            if server is None:
                raise McpRegistryError("unknown_server_id")
            expected = approval_fingerprint(
                server, approval.approved_discovered_tool, approval.mapping
            )
            if expected != approval.approved_fingerprint:
                raise McpRegistryError("source_schema_changed")
            if approval.approval_version != server.approval_version:
                raise McpRegistryError("source_schema_changed")
            resolution = (
                approval.mapping.entity_resolution
                if approval.mapping is not None
                else None
            )
            if resolution is not None:
                resolver = next(
                    (
                        item
                        for item in approvals
                        if item.server_id == approval.server_id
                        and item.tool_name == resolution.tool_name
                    ),
                    None,
                )
                if (
                    resolver is None
                    or resolver.enabled != approval.enabled
                    or not resolver.resolver_only
                    or resolver.mapping is not None
                ):
                    raise McpRegistryError("invalid_entity_resolver")
        return cls(servers, approvals)

    def tools_for(self, facts: tuple[RequiredFact, ...]) -> tuple[McpToolApproval, ...]:
        return tuple(
            approval
            for approval in self._approvals
            if approval.enabled
            and approval.effect is ToolEffect.READ_ONLY
            and self._servers_by_id[approval.server_id].enabled
            and any(approval.matches_fact(fact) for fact in facts)
        )

    def verify_discovery(
        self,
        server_id: str,
        tools: tuple[DiscoveredTool | Mapping[str, Any], ...],
    ) -> None:
        server = self.server(server_id)
        try:
            normalized = tuple(
                tool if isinstance(tool, DiscoveredTool) else DiscoveredTool.model_validate(tool)
                for tool in tools
            )
        except ValidationError as exc:
            raise McpRegistryError("source_schema_changed") from exc
        discovered = {tool.name: tool for tool in normalized}
        if len(discovered) != len(normalized):
            raise McpRegistryError("source_schema_changed")
        for approval in self._approvals:
            if approval.server_id != server_id or not approval.enabled:
                continue
            current = discovered.get(approval.tool_name)
            if (
                current is None
                or not approval.accepts_discovered_tool(current)
                or approval_fingerprint(server, current, approval.mapping)
                != approval.approved_fingerprint
            ):
                raise McpRegistryError("source_schema_changed")


def load_default_registry() -> McpRegistry:
    """Load only the repository-owned administrator configuration path."""

    config_path = Path(__file__).parents[3] / "config" / "jinyiwei_mcp.yaml"
    try:
        payload = yaml.load(config_path.read_text(encoding="utf-8"), Loader=_UniqueKeySafeLoader)
    except _DuplicateConfigKey as exc:
        raise McpRegistryError("duplicate_config_key") from exc
    except (OSError, yaml.YAMLError) as exc:
        raise McpRegistryError("invalid_registry_config") from exc
    if not isinstance(payload, Mapping):
        raise McpRegistryError("invalid_registry_config")
    return McpRegistry.from_mapping(payload)
