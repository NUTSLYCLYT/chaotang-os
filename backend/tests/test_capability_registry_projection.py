from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.capabilities.projection import (
    MAX_PERSONAL_SNAPSHOT_BYTES,
    PERSONAL_SNAPSHOT_PATH,
    REPOSITORY_ROOT,
    CapabilitySnapshotError,
    build_capability_registry_projection,
    load_personal_capability_snapshot,
)


def _catalog_items(home: str):
    projection = build_capability_registry_projection()
    return [
        item
        for item in projection.items
        if item.catalog is not None and item.card.recommended_home == home
    ]


def _mutated_snapshot(tmp_path: Path, mutate) -> Path:
    source = REPOSITORY_ROOT / PERSONAL_SNAPSHOT_PATH
    value = json.loads(source.read_text(encoding="utf-8"))
    mutate(value)
    target = tmp_path / "snapshot.json"
    target.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
    return target


def test_projection_lists_existing_sources_and_keeps_scores_honest() -> None:
    projection = build_capability_registry_projection()

    assert projection.schema_version == "capability-registry.v2"
    assert "backend/app/agents/runtime_skills/registry.py" in projection.readonly_sources
    assert PERSONAL_SNAPSHOT_PATH in projection.readonly_sources
    assert projection.summary.total == len(projection.items)
    assert projection.summary.small_sample_without_authority_score == len(
        projection.items
    )
    assert all(item.card.authority_score is None for item in projection.items)
    assert all(item.card.zero_permission_when_inactive for item in projection.items)
    assert all(item.card.evidence_sources for item in projection.items)


def test_projection_keeps_hanlin_catalog_separate_from_runtime_skills() -> None:
    projection = build_capability_registry_projection()
    hanlin = _catalog_items("hanlin")

    assert len(hanlin) == 73
    assert projection.summary.catalog_hanlin_skills == 73
    assert all(item.card.source == "personal_catalog" for item in hanlin)
    assert all(item.card.type == "skill" for item in hanlin)
    assert all(item.catalog is not None for item in hanlin)
    assert all(
        item.catalog.readiness.runtime_binding_status == "not_bound"
        for item in hanlin
        if item.catalog
    )
    assert all(not item.card.active for item in hanlin)
    assert all(
        not item.catalog.natural_language_trigger.endswith("/ " + chr(96))
        for item in hanlin
        if item.catalog
    )
    assert all(
        item.catalog.natural_language_trigger
        and item.catalog.invocation_policy
        and item.catalog.fee_status
        and item.catalog.permission_summary
        and item.catalog.external_data
        and item.catalog.blocker
        for item in hanlin
        if item.catalog
    )


def test_projection_groups_eligible_mcp_tools_under_honglusi_providers() -> None:
    projection = build_capability_registry_projection()
    providers = _catalog_items("honglusi")

    assert projection.summary.catalog_provider_groups == 14
    assert projection.summary.catalog_snapshot_provider_groups == 16
    assert projection.summary.catalog_mcp_tools == 83
    assert projection.summary.catalog_snapshot_mcp_tools == 92
    assert projection.summary.catalog_excluded_support_tools == 9
    assert len(providers) == 14
    assert all(item.card.type == "provider" for item in providers)
    assert all(item.card.source == "honglusi" for item in providers)
    assert all(item.external_review is not None for item in providers)
    assert sum(item.catalog.tool_count for item in providers if item.catalog) == 83
    assert all(
        item.catalog.tool_count == len(item.catalog.tools)
        and all(tool.runtime_binding_status == "not_bound" for tool in item.catalog.tools)
        for item in providers
        if item.catalog
    )
    top_level_ids = {item.card.id for item in projection.items}
    assert not any(identifier.startswith("mcp-tool:") for identifier in top_level_ids)


def test_projection_maps_external_capabilities_to_honglusi_and_xingbu_review() -> None:
    projection = build_capability_registry_projection()
    external_items = [item for item in projection.items if item.card.source == "honglusi"]

    assert external_items
    assert all(item.card.recommended_home == "honglusi" for item in external_items)
    assert all(item.external_review is not None for item in external_items)
    assert all(
        item.external_review.requires_xingbu_review
        for item in external_items
        if item.external_review
    )
    assert all(
        "external write" in item.external_review.forbidden_actions
        for item in external_items
        if item.external_review
    )


def test_projection_contains_agent_personas_without_permission_inheritance() -> None:
    projection = build_capability_registry_projection()
    personas = {persona.agent_id: persona for persona in projection.agent_personas}

    assert {"chancellor", "jinyiwei", "hanlin", "honglusi", "xingbu"}.issubset(personas)
    assert personas["chancellor"].humor_level == 1
    assert "把人格当作权限主体" in personas["chancellor"].forbidden_behavior
    assert all(not hasattr(persona, "allowed_actions") for persona in projection.agent_personas)


def test_projection_exposes_hanlin_reusable_workflows() -> None:
    projection = build_capability_registry_projection()
    workflows = [item for item in projection.items if item.card.type == "workflow"]

    assert workflows
    assert all(item.card.recommended_home == "hanlin" for item in workflows)
    assert all("翰林院" in item.promotion_case.recommended_action for item in workflows)


@pytest.mark.parametrize(
    ("mutation", "secret_fragment"),
    [
        (
            lambda value: value["hanlin_skills"][0].__setitem__(
                "unexpected_field", "not allowed"
            ),
            None,
        ),
        (
            lambda value: value["hanlin_skills"][1].__setitem__(
                "id", value["hanlin_skills"][0]["id"]
            ),
            None,
        ),
        (
            lambda value: value["hanlin_skills"][0].__setitem__(
                "purpose", r"C:\Users\Private\secret.txt"
            ),
            "Private",
        ),
        (
            lambda value: value["hanlin_skills"][0].__setitem__(
                "purpose", "token=sk-example-secret-1234567890"
            ),
            "sk-example",
        ),
        (
            lambda value: value["hanlin_skills"][0].__setitem__(
                "purpose", "owner@example.com"
            ),
            "owner@example.com",
        ),
    ],
)
def test_snapshot_rejects_unknown_duplicate_and_private_values_without_leak(
    tmp_path: Path,
    mutation,
    secret_fragment: str | None,
) -> None:
    target = _mutated_snapshot(tmp_path, mutation)

    with pytest.raises(CapabilitySnapshotError) as raised:
        load_personal_capability_snapshot(target, expected_digest=None)

    if secret_fragment:
        assert secret_fragment not in str(raised.value)


def test_snapshot_rejects_oversized_input_before_parsing(tmp_path: Path) -> None:
    target = tmp_path / "oversized.json"
    target.write_bytes(b" " * (MAX_PERSONAL_SNAPSHOT_BYTES + 1))

    with pytest.raises(CapabilitySnapshotError, match="snapshot_too_large"):
        load_personal_capability_snapshot(target, expected_digest=None)
