"""Offline coverage for the static bureau capability package directory."""

from __future__ import annotations

from collections import Counter
from dataclasses import FrozenInstanceError, fields

import pytest

import app.agents.bureaus as bureaus
from app.agents.bureaus.profiles import BUREAU_PROFILES


def test_capability_profile_is_frozen_slotted_and_has_exact_contract() -> None:
    profile = bureaus.CapabilityProfile(
        capability_id="example",
        department="department",
        bureau="bureau",
        source_label="source",
        purpose="purpose",
        deliverables=("deliverable",),
        guardrails=("guardrail",),
    )

    assert [item.name for item in fields(bureaus.CapabilityProfile)] == [
        "capability_id",
        "department",
        "bureau",
        "source_label",
        "purpose",
        "deliverables",
        "guardrails",
    ]
    assert not hasattr(profile, "__dict__")
    with pytest.raises(FrozenInstanceError):
        profile.purpose = "changed"


def test_capability_directory_has_the_confirmed_id_to_bureau_mappings() -> None:
    expected_bindings = {
        "lead_acquisition": ("兵部", "线索司"),
        "commercial_opportunity": ("兵部", "报价司"),
        "financial_analysis": ("户部", "会计司"),
        "quotation_analysis": ("户部", "盐铁司"),
        "contract_review": ("刑部", "合同司"),
        "legal_compliance": ("刑部", "合规稽查司"),
        "product_planning": ("工部", "产研司"),
        "trend_simulation": ("工部", "产研司"),
        "sourcing": ("工部", "物料司"),
        "pack_rd": ("工部", "技术司"),
        "hardware_design": ("工部", "技术司"),
        "sdlc_advisory": ("工部", "技术司"),
        "code_review_advisory": ("工部", "技术司"),
        "battery_stage_gate": ("工部", "质量司"),
        "process_manufacturing": ("工部", "现场司"),
        "delivery_aftercare": ("工部", "承诺司"),
        "brand_strategy": ("礼部", "品牌司"),
        "content_quality": ("礼部", "内容司"),
        "social_content_operations": ("礼部", "客户沟通司"),
        "persona_screening": ("吏部", "招聘司"),
    }

    assert {
        profile.capability_id: (profile.department, profile.bureau)
        for profile in bureaus.CAPABILITY_PROFILES
    } == expected_bindings
    assert all(
        profile.source_label == "dev swarm migration"
        and profile.purpose
        and profile.deliverables
        and profile.guardrails
        for profile in bureaus.CAPABILITY_PROFILES
    )


def test_unknown_capability_ids_fail_closed() -> None:
    for capability_id in ("missing-capability", "court", "jinyiwei", "ai_ops"):
        with pytest.raises(ValueError, match="Unknown capability ID"):
            bureaus.capability_profile_for(capability_id)


def test_pair_lookup_rejects_unknown_and_cross_department_bureau_identities() -> None:
    bureau = BUREAU_PROFILES[0]
    different_department = next(
        item for item in BUREAU_PROFILES if item.department != bureau.department
    )

    with pytest.raises(ValueError):
        bureaus.capability_profiles_for("unknown department", bureau.bureau)
    with pytest.raises(ValueError):
        bureaus.capability_profiles_for(bureau.department, different_department.bureau)


def test_unknown_capability_id_fails_closed() -> None:
    with pytest.raises(ValueError):
        bureaus.capability_profile_for("missing-capability")


def test_capability_contract_public_symbols_are_exported() -> None:
    assert {
        "CapabilityProfile",
        "CAPABILITY_PROFILES",
        "capability_profiles_for",
        "capability_profile_for",
    }.issubset(bureaus.__all__)
    assert Counter(bureaus.__all__)["CapabilityProfile"] == 1
