from __future__ import annotations

from app.capabilities.projection import build_capability_registry_projection


def test_projection_lists_existing_sources_and_keeps_scores_honest() -> None:
    projection = build_capability_registry_projection()

    assert projection.schema_version == "capability-registry.v1"
    assert "backend/app/agents/runtime_skills/registry.py" in projection.readonly_sources
    assert projection.summary.total == len(projection.items)
    assert projection.summary.small_sample_without_authority_score == len(projection.items)
    assert all(item.card.authority_score is None for item in projection.items)
    assert all(item.card.zero_permission_when_inactive for item in projection.items)
    assert all(item.card.evidence_sources for item in projection.items)


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
