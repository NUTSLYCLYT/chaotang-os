from __future__ import annotations

import copy
import json
import pickle
from copy import deepcopy
from math import nan
from pathlib import Path

import pytest
import yaml
from pydantic import ValidationError

from app.jinyiwei.mcp import (
    DiscoveredTool,
    McpRegistry,
    McpRegistryError,
    McpServerConfig,
    McpToolApproval,
    approval_fingerprint,
    load_default_registry,
)
from app.jinyiwei.models import DataScope, FactCategory, RequiredFact


def _quote_fact(
    *,
    data_scope: DataScope = DataScope.EXTERNAL_PUBLIC,
    jurisdiction: str | None = "CN",
) -> RequiredFact:
    return RequiredFact(
        key="current_quote",
        description="Current BYD share price",
        category=FactCategory.MARKET_QUOTE,
        data_scope=data_scope,
        subject="BYD",
        jurisdiction=jurisdiction,
        expected_unit="CNY",
        expected_shape="quote",
    )


def _server_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "server_id": "market-data",
        "display_name": "Approved market data",
        "endpoint_url": "https://market.example.test/mcp",
        "transport": "STREAMABLE_HTTP",
        "source_kind": "PROFESSIONAL_DATA",
        "access_policy": "SERVICE_AUTHENTICATED_FREE",
        "credential_ref": "env://MARKET_MCP_CREDENTIAL",
        "enabled": True,
        "approval_version": "2026-07-22.1",
        "timeout_seconds": 10,
        "max_response_bytes": 1_000_000,
        "rate_limit_per_minute": 30,
        "allow_redirects": False,
        "cache_ttl_seconds": 30,
        "private_network_approved": False,
    }
    payload.update(overrides)
    return payload


def _discovered_quote_schema() -> dict[str, object]:
    return {
        "name": "data_quote",
        "description": "Read a market quote",
        "inputSchema": {
            "type": "object",
            "properties": {"ticker": {"type": "string"}},
            "required": ["ticker"],
            "additionalProperties": False,
        },
    }


def _tool_payload(
    server: McpServerConfig,
    **overrides: object,
) -> dict[str, object]:
    discovered = _discovered_quote_schema()
    payload: dict[str, object] = {
        "server_id": server.server_id,
        "tool_name": "data_quote",
        "enabled": True,
        "effect": "READ_ONLY",
        "fact_categories": ["MARKET_QUOTE"],
        "data_scopes": ["EXTERNAL_PUBLIC"],
        "jurisdictions": ["CN"],
        "approval_version": "2026-07-22.1",
        "approved_discovered_tool": discovered,
        "approved_fingerprint": approval_fingerprint(server, discovered),
        "priority": 10,
    }
    payload.update(overrides)
    return payload


def _config_fixture() -> dict[str, object]:
    server = McpServerConfig.model_validate(_server_payload())
    return {
        "servers": [_server_payload()],
        "tools": [
            _tool_payload(server),
            _tool_payload(
                server,
                tool_name="disabled_quote",
                enabled=False,
                approved_discovered_tool={
                    "name": "disabled_quote",
                    "inputSchema": {"type": "object"},
                },
                approved_fingerprint=approval_fingerprint(
                    server,
                    {
                        "name": "disabled_quote",
                        "inputSchema": {"type": "object"},
                    },
                ),
                priority=1,
            ),
        ],
    }


def test_registry_returns_only_enabled_approved_read_tools() -> None:
    registry = McpRegistry.from_mapping(_config_fixture())

    tools = registry.tools_for((_quote_fact(),))

    assert [tool.tool_name for tool in tools] == ["data_quote"]


def test_registry_matches_fact_category_scope_and_jurisdiction() -> None:
    registry = McpRegistry.from_mapping(_config_fixture())

    assert registry.tools_for((_quote_fact(data_scope=DataScope.INTERNAL_BUSINESS),)) == ()
    assert registry.tools_for((_quote_fact(jurisdiction="US"),)) == ()
    assert registry.tools_for((_quote_fact(jurisdiction=None),)) == ()


def test_registry_order_is_deterministic_by_priority_then_identity() -> None:
    server = McpServerConfig.model_validate(_server_payload())
    config = _config_fixture()
    second_schema = {"name": "a_quote", "inputSchema": {"type": "object"}}
    config["tools"] = [
        _tool_payload(
            server,
            tool_name="z_quote",
            approved_discovered_tool={
                "name": "z_quote",
                "inputSchema": {"type": "object"},
            },
            approved_fingerprint=approval_fingerprint(
                server,
                {"name": "z_quote", "inputSchema": {"type": "object"}},
            ),
            priority=20,
        ),
        _tool_payload(
            server,
            tool_name="a_quote",
            approved_discovered_tool=second_schema,
            approved_fingerprint=approval_fingerprint(server, second_schema),
            priority=20,
        ),
        _tool_payload(server, priority=5),
    ]
    registry = McpRegistry.from_mapping(config)

    assert [tool.tool_name for tool in registry.tools_for((_quote_fact(),))] == [
        "data_quote",
        "a_quote",
        "z_quote",
    ]


def test_discovered_schema_change_invalidates_approval() -> None:
    server = McpServerConfig.model_validate(_server_payload())
    approval = McpToolApproval.model_validate(_tool_payload(server))
    changed = deepcopy(_discovered_quote_schema())
    changed["inputSchema"] = {
        "type": "object",
        "required": ["ticker", "market"],
    }

    assert approval.accepts_discovered_tool(changed) is False


def test_discovery_fails_closed_for_missing_or_changed_approved_tool() -> None:
    registry = McpRegistry.from_mapping(_config_fixture())

    with pytest.raises(McpRegistryError, match="source_schema_changed"):
        registry.verify_discovery("market-data", ())

    changed = _discovered_quote_schema()
    changed["inputSchema"] = {"type": "object"}
    with pytest.raises(McpRegistryError, match="source_schema_changed"):
        registry.verify_discovery("market-data", (changed,))


def test_unapproved_new_discovered_tool_is_not_returned_or_auto_approved() -> None:
    registry = McpRegistry.from_mapping(_config_fixture())
    approved = _discovered_quote_schema()
    new_tool = {"name": "place_order", "inputSchema": {"type": "object"}}

    registry.verify_discovery("market-data", (new_tool, approved))

    assert [tool.tool_name for tool in registry.tools_for((_quote_fact(),))] == ["data_quote"]


def test_write_capability_is_rejected_even_when_named_query() -> None:
    server = McpServerConfig.model_validate(_server_payload())

    with pytest.raises(ValidationError, match="tool_effect_not_read_only"):
        McpToolApproval.model_validate(_tool_payload(server, effect="WRITE"))


@pytest.mark.parametrize(
    ("field", "replacement", "error"),
    [
        ("endpoint_url", "http://market.example.test/mcp", "endpoint_must_use_https"),
        ("endpoint_url", "https://127.0.0.1/mcp", "private_target_not_approved"),
        ("credential_ref", "secret-token", "invalid_credential_ref"),
    ],
)
def test_server_config_rejects_unsafe_network_or_secret_values(
    field: str,
    replacement: object,
    error: str,
) -> None:
    payload = _server_payload(**{field: replacement})

    with pytest.raises(ValidationError, match=error):
        McpServerConfig.model_validate(payload)


def test_internal_private_target_requires_explicit_internal_approval() -> None:
    server = McpServerConfig.model_validate(
        _server_payload(
            endpoint_url="https://10.20.30.40/mcp",
            source_kind="INTERNAL_SYSTEM",
            access_policy="INTERNAL_SERVICE_AUTHENTICATED",
            private_network_approved=True,
            private_network_cidrs=["10.20.30.0/24"],
        )
    )

    assert server.private_network_approved is True


@pytest.mark.parametrize(
    "duplicate_field",
    ["server_id", "tool_identity"],
)
def test_registry_rejects_duplicate_server_or_tool_identity(
    duplicate_field: str,
) -> None:
    config = _config_fixture()
    if duplicate_field == "server_id":
        config["servers"] = [*config["servers"], deepcopy(config["servers"][0])]
    else:
        config["tools"] = [*config["tools"], deepcopy(config["tools"][0])]

    with pytest.raises(McpRegistryError, match=f"duplicate_{duplicate_field}"):
        McpRegistry.from_mapping(config)


def test_registry_rejects_unknown_category_and_orphan_tool() -> None:
    config = _config_fixture()
    config["tools"][0]["fact_categories"] = ["NOT_A_CATEGORY"]
    with pytest.raises(McpRegistryError, match="invalid_tools_config"):
        McpRegistry.from_mapping(config)

    orphan = _config_fixture()
    orphan["tools"][0]["server_id"] = "not-registered"
    with pytest.raises(McpRegistryError, match="unknown_server_id"):
        McpRegistry.from_mapping(orphan)


def test_registry_rejects_fingerprint_not_bound_to_current_server_config() -> None:
    config = _config_fixture()
    config["servers"][0]["endpoint_url"] = "https://other.example.test/mcp"

    with pytest.raises(McpRegistryError, match="source_schema_changed"):
        McpRegistry.from_mapping(config)


def test_approval_rejects_malformed_json_schema() -> None:
    server = McpServerConfig.model_validate(_server_payload())
    malformed = {
        "name": "data_quote",
        "inputSchema": {"type": "not-a-json-schema-type"},
    }

    with pytest.raises(McpRegistryError, match="invalid_discovered_tool"):
        approval_fingerprint(server, malformed)


def test_approval_fingerprint_rejects_nonstandard_json_numbers() -> None:
    server = McpServerConfig.model_validate(_server_payload())
    nonstandard = deepcopy(_discovered_quote_schema())
    nonstandard["inputSchema"]["default"] = nan

    with pytest.raises(McpRegistryError, match="invalid_approval_payload"):
        approval_fingerprint(server, nonstandard)


def test_discovered_tool_extension_json_is_deeply_immutable_and_stable() -> None:
    server = McpServerConfig.model_validate(_server_payload())
    tool = DiscoveredTool.model_validate(
        {
            **_discovered_quote_schema(),
            "annotations": {
                "readOnlyHint": True,
                "tags": ["quote", {"market": "CN"}],
            },
            "outputSchema": {
                "type": "object",
                "properties": {"price": {"type": "number"}},
            },
        }
    )
    before_payload = tool.model_dump(mode="json", by_alias=True)
    before_fingerprint = approval_fingerprint(server, tool)

    with pytest.raises(TypeError):
        tool.extensions["annotations"]["readOnlyHint"] = False
    with pytest.raises(AttributeError):
        tool.extensions["annotations"]["tags"].append("write")
    with pytest.raises(TypeError):
        tool.extensions["annotations"]["tags"][1]["market"] = "US"
    with pytest.raises(TypeError):
        tool.__pydantic_extra__["annotations"] = {"readOnlyHint": False}
    with pytest.raises(TypeError, match="discovered_tool_extra_is_internal"):
        tool.__pydantic_extra__ = {"annotations": {"readOnlyHint": False}}

    assert tool.model_dump(mode="json", by_alias=True) == before_payload
    assert approval_fingerprint(server, tool) == before_fingerprint
    assert "extensions" not in before_payload
    assert before_payload["annotations"]["tags"] == ["quote", {"market": "CN"}]

    detached_payload = tool.model_dump(mode="json", by_alias=True)
    detached_payload["annotations"]["tags"].append("detached-only")
    assert tool.extensions["annotations"]["tags"] == ("quote", {"market": "CN"})
    assert json.loads(tool.model_dump_json(by_alias=True)) == before_payload


def test_discovered_tool_copy_paths_preserve_validation_and_immutability() -> None:
    server = McpServerConfig.model_validate(_server_payload())
    tool = DiscoveredTool.model_validate(
        {
            **_discovered_quote_schema(),
            "annotations": {"readOnlyHint": True, "tags": ["quote"]},
        }
    )
    original_fingerprint = approval_fingerprint(server, tool)

    for duplicate in (
        copy.copy(tool),
        copy.deepcopy(tool),
        tool.model_copy(),
        tool.model_copy(deep=True),
        pickle.loads(pickle.dumps(tool)),
    ):
        assert duplicate.model_dump(mode="json", by_alias=True) == tool.model_dump(
            mode="json", by_alias=True
        )
        assert approval_fingerprint(server, duplicate) == original_fingerprint
        with pytest.raises(AttributeError):
            duplicate.extensions["annotations"]["tags"].append("write")


def test_discovered_tool_validated_update_cannot_degrade_original() -> None:
    server = McpServerConfig.model_validate(_server_payload())
    tool = DiscoveredTool.model_validate(
        {
            **_discovered_quote_schema(),
            "annotations": {"readOnlyHint": True, "tags": ["quote"]},
        }
    )
    original_fingerprint = approval_fingerprint(server, tool)

    updated = tool.model_copy(update={"annotations": {"tags": ["snapshot"]}})

    assert updated.extensions["annotations"]["tags"] == ("snapshot",)
    assert tool.extensions["annotations"]["tags"] == ("quote",)
    assert approval_fingerprint(server, tool) == original_fingerprint
    assert approval_fingerprint(server, updated) != original_fingerprint
    with pytest.raises(AttributeError):
        updated.extensions["annotations"]["tags"].append("write")

    replaced_extensions = tool.model_copy(
        update={"extensions": {"annotations": {"tags": ["replacement"]}}}
    )
    assert tuple(replaced_extensions.extensions) == ("annotations",)
    assert replaced_extensions.extensions["annotations"]["tags"] == ("replacement",)

    with pytest.raises(ValidationError):
        tool.model_copy(update={"annotations": {"tags": [object()]}})
    with pytest.raises(ValidationError, match="invalid_input_schema"):
        tool.model_copy(update={"inputSchema": {"type": "not-a-json-schema-type"}})


@pytest.mark.parametrize(
    "duplicate_yaml",
    [
        "servers: []\nservers: []\ntools: []\n",
        """
servers:
  - server_id: first
    server_id: replaced
tools: []
""",
        """
servers: []
tools:
  - approved_discovered_tool:
      name: data_quote
      inputSchema:
        type: object
        properties:
          code:
            type: string
          code:
            type: integer
""",
    ],
)
def test_repository_loader_rejects_duplicate_yaml_keys_at_every_depth(
    duplicate_yaml: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(Path, "read_text", lambda *_args, **_kwargs: duplicate_yaml)

    with pytest.raises(McpRegistryError, match="duplicate_config_key"):
        load_default_registry()


def test_repository_config_is_secret_free_disabled_and_read_only() -> None:
    config_path = Path(__file__).parents[1] / "config" / "jinyiwei_mcp.yaml"
    raw = config_path.read_text(encoding="utf-8")
    payload = yaml.safe_load(raw)

    registry = McpRegistry.from_mapping(payload)

    assert [server.server_id for server in registry.servers] == ["westock"]
    assert all(server.enabled is False for server in registry.servers)
    assert all(tool.enabled is False for tool in registry.approvals)
    assert all(tool.effect.value == "READ_ONLY" for tool in registry.approvals)
    assert "env://WESTOCK_MCP_CREDENTIAL" in raw
    assert "tongdaxin" not in raw.lower()
    assert "tdx" not in raw.lower()
    assert not any(
        forbidden in raw.lower()
        for forbidden in ("bearer ", "access_token", "refresh_token", "password:")
    )

    assert load_default_registry().tools_for((_quote_fact(),)) == ()
