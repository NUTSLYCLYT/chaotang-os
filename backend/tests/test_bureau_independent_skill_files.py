"""Canonical pre-migration oracle for all authoritative bureau Runtime Skills."""

from __future__ import annotations

import hashlib
import importlib
import inspect
import json
from collections.abc import Mapping
from dataclasses import FrozenInstanceError, fields, is_dataclass, replace
from enum import Enum
from types import SimpleNamespace
from typing import Any

import pytest
from pydantic import BaseModel

from app.agents.bureaus import BUREAU_PROFILES
from app.agents.runtime_skills import (
    AgentLayer,
    build_default_downstream_skill_registry,
)
from app.agents.runtime_skills import (
    registry as runtime_registry_module,
)
from app.agents.runtime_skills import (
    tool_registry as tool_registry_module,
)
from app.agents.runtime_skills.registry import bureau_agent_id
from app.agents.runtime_skills.roles.bureaus.bingbu import SKILL_IDS as BINGBU_IDS
from app.agents.runtime_skills.roles.bureaus.gongbu import SKILL_IDS as GONGBU_IDS
from app.agents.runtime_skills.roles.bureaus.hubu import SKILL_IDS as HUBU_IDS
from app.agents.runtime_skills.roles.bureaus.libu import SKILL_IDS as LIBU_IDS
from app.agents.runtime_skills.roles.bureaus.libu_rites import (
    SKILL_IDS as LIBU_RITES_IDS,
)
from app.agents.runtime_skills.roles.bureaus.professional import (
    BUREAU_METHODS,
    BUREAU_TOOL_POLICY_SPECS,
)
from app.agents.runtime_skills.roles.bureaus.skill_registry import (
    BUREAU_SKILL_SPECS,
    build_bureau_skill_registry,
)
from app.agents.runtime_skills.roles.bureaus.skill_spec import (
    BureauMethod,
    BureauRuntimeSkillSpec,
    BureauToolPolicySpec,
)
from app.agents.runtime_skills.roles.bureaus.xingbu import SKILL_IDS as XINGBU_IDS

EXPECTED_AGENT_IDS = (
    "libu-appointments",
    "libu-recruitment",
    "libu-labor-relations",
    "libu-compensation",
    "libu-policy",
    "libu-coordination",
    "hubu-budget",
    "hubu-treasury",
    "hubu-pricing",
    "hubu-financing",
    "hubu-audit",
    "hubu-accounting",
    "hubu-investment",
    "libu-rites-brand",
    "libu-rites-public-relations",
    "libu-rites-customer-communications",
    "libu-rites-content",
    "libu-rites-government-enterprise",
    "libu-rites-experience",
    "bingbu-sales-opportunity",
    "bingbu-leads",
    "bingbu-channels",
    "bingbu-customers",
    "bingbu-competition",
    "bingbu-growth",
    "xingbu-contracts",
    "xingbu-compliance",
    "xingbu-risk-control",
    "xingbu-evidence-integrity",
    "xingbu-disputes",
    "xingbu-intellectual-property",
    "xingbu-policy",
    "gongbu-product",
    "gongbu-technology",
    "gongbu-supply",
    "gongbu-schedule",
    "gongbu-quality",
    "gongbu-field",
    "gongbu-commitments",
)

EXPECTED_CANONICAL_SHA256 = "deda94a4afd8853bba35ce05ec73a717f559ab19bc63abe4541d4bbbfa77944a"

_SKILL_IDS_BY_DEPARTMENT = {
    "吏部": LIBU_IDS,
    "户部": HUBU_IDS,
    "礼部": LIBU_RITES_IDS,
    "兵部": BINGBU_IDS,
    "刑部": XINGBU_IDS,
    "工部": GONGBU_IDS,
}

TASK_3_MODULES = (
    "libu_appointments",
    "libu_recruitment",
    "libu_labor_relations",
    "libu_compensation",
    "libu_policy",
    "libu_coordination",
    "hubu_budget",
    "hubu_treasury",
    "hubu_pricing",
    "hubu_financing",
    "hubu_audit",
    "hubu_accounting",
    "hubu_investment",
)
TASK_3_DEPARTMENTS = frozenset({"吏部", "户部"})
TASK_4_MODULES = (
    "libu_rites_brand",
    "libu_rites_public_relations",
    "libu_rites_customer_communications",
    "libu_rites_content",
    "libu_rites_government_enterprise",
    "libu_rites_experience",
    "bingbu_sales_opportunity",
    "bingbu_leads",
    "bingbu_channels",
    "bingbu_customers",
    "bingbu_competition",
    "bingbu_growth",
)
TASK_4_DEPARTMENTS = frozenset({"礼部", "兵部"})
TASK_5_MODULES = (
    "xingbu_contracts",
    "xingbu_compliance",
    "xingbu_risk_control",
    "xingbu_evidence_integrity",
    "xingbu_disputes",
    "xingbu_intellectual_property",
    "xingbu_policy",
    "gongbu_product",
    "gongbu_technology",
    "gongbu_supply",
    "gongbu_schedule",
    "gongbu_quality",
    "gongbu_field",
    "gongbu_commitments",
)
TASK_5_DEPARTMENTS = frozenset({"刑部", "工部"})


def _canonicalize(value: Any) -> Any:
    """Convert frozen contracts to deterministic, lossless JSON-compatible data."""

    if isinstance(value, BaseModel):
        return {
            field_name: _canonicalize(getattr(value, field_name))
            for field_name in value.__class__.model_fields
        }
    if is_dataclass(value) and not isinstance(value, type):
        return {field.name: _canonicalize(getattr(value, field.name)) for field in fields(value)}
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, type):
        return f"{value.__module__}.{value.__qualname__}"
    if isinstance(value, Mapping):
        return {
            str(_canonicalize(key)): _canonicalize(item)
            for key, item in sorted(value.items(), key=lambda pair: str(pair[0]))
        }
    if isinstance(value, (set, frozenset)):
        return sorted((_canonicalize(item) for item in value), key=_canonical_sort_key)
    if isinstance(value, (tuple, list)):
        return [_canonicalize(item) for item in value]
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    raise TypeError(f"unsupported canonical value: {type(value)!r}")


def _canonical_sort_key(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _canonical_json(records: list[dict[str, Any]]) -> str:
    return json.dumps(records, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _current_bureau_records() -> list[dict[str, Any]]:
    registry = build_default_downstream_skill_registry()
    bureau_skills = tuple(skill for skill in registry.skills if skill.layer is AgentLayer.BUREAU)
    assert len(bureau_skills) == len(BUREAU_PROFILES) == 39
    identities = tuple((profile.department, profile.bureau) for profile in BUREAU_PROFILES)
    assert tuple(BUREAU_METHODS) == identities
    assert tuple(BUREAU_TOOL_POLICY_SPECS) == EXPECTED_AGENT_IDS

    records = []
    for profile, skill in zip(BUREAU_PROFILES, bureau_skills, strict=True):
        expected_agent_id = bureau_agent_id(profile.department, profile.bureau)
        assert skill.agent_id == expected_agent_id
        source_method = BUREAU_METHODS[(profile.department, profile.bureau)]
        source_skill_id = _SKILL_IDS_BY_DEPARTMENT[profile.department][profile.bureau]
        source_tool_policy = BUREAU_TOOL_POLICY_SPECS[expected_agent_id]
        assert source_skill_id == skill.skill_id
        assert source_tool_policy.agent_id == expected_agent_id
        records.append(
            {
                "department": profile.department,
                "bureau": profile.bureau,
                "source_method": {
                    field_name: _canonicalize(getattr(source_method, field_name))
                    for field_name in (field.name for field in fields(source_method))
                },
                "source_skill_id": source_skill_id,
                "source_tool_policy": _canonicalize(source_tool_policy),
                "runtime_skill": _canonicalize(skill),
            }
        )
    return records


def _sha256(records: list[dict[str, Any]]) -> str:
    return hashlib.sha256(_canonical_json(records).encode("utf-8")).hexdigest()


def test_current_39_bureau_runtime_skills_match_frozen_migration_oracle() -> None:
    records = _current_bureau_records()
    agent_ids = tuple(record["runtime_skill"]["agent_id"] for record in records)

    assert len(records) == 39
    assert len(set(agent_ids)) == 39
    assert agent_ids == EXPECTED_AGENT_IDS
    assert _sha256(records) == EXPECTED_CANONICAL_SHA256


def test_oracle_detects_omission_duplication_extra_reordering_and_field_drift() -> None:
    records = _current_bureau_records()
    original_digest = _sha256(records)

    omitted = records[:-1]
    duplicated = [*records[:-1], records[0]]
    extra_record = json.loads(_canonical_json([records[0]]))[0]
    extra_record["runtime_skill"]["agent_id"] = "unregistered-agent"
    extra_record["source_tool_policy"]["agent_id"] = "unregistered-agent"
    extra = [*records, extra_record]
    reordered = [records[1], records[0], *records[2:]]
    drifted = json.loads(_canonical_json(records))
    drifted[0]["source_tool_policy"]["tool_operations"][1][1].reverse()

    assert len({item["runtime_skill"]["agent_id"] for item in duplicated}) != 39
    assert len(extra) == 40
    assert len({item["runtime_skill"]["agent_id"] for item in extra}) == 40
    assert all(
        _sha256(candidate) != original_digest
        for candidate in (omitted, duplicated, extra, reordered, drifted)
    )


def _sample_skill(*, department: str = "吏部", bureau: str = "任免司") -> BureauRuntimeSkillSpec:
    agent_id = "libu-appointments"
    source_method = BUREAU_METHODS[("吏部", "任免司")]
    source_policy = BUREAU_TOOL_POLICY_SPECS[agent_id]
    return BureauRuntimeSkillSpec(
        department=department,
        bureau=bureau,
        agent_id=agent_id,
        skill_id=LIBU_IDS["任免司"],
        method=BureauMethod(
            data_requirements=source_method.data_requirements,
            analysis_procedure=source_method.analysis_procedure,
            required_findings=source_method.required_findings,
            forbidden_actions=source_method.forbidden_actions,
        ),
        tool_policy=BureauToolPolicySpec(
            **{field.name: getattr(source_policy, field.name) for field in fields(source_policy)}
        ),
    )


def _identity(skill: BureauRuntimeSkillSpec) -> tuple[str, str, str, str, str]:
    return (
        skill.department,
        skill.bureau,
        skill.agent_id,
        skill.skill_id,
        skill.tool_policy.policy_id,
    )


def test_shared_bureau_skill_spec_is_frozen_and_binds_policy_to_agent() -> None:
    skill = _sample_skill()

    with pytest.raises(FrozenInstanceError):
        skill.agent_id = "changed"  # type: ignore[misc]
    with pytest.raises(ValueError, match="tool_policy_agent_mismatch"):
        replace(skill, agent_id="wrong-agent")


def test_shared_spec_rejects_wrong_method_and_forged_policy_types() -> None:
    skill = _sample_skill()

    with pytest.raises(TypeError, match="invalid_bureau_method"):
        replace(skill, method=object())
    forged_policy = SimpleNamespace(
        agent_id=skill.agent_id,
        policy_id=skill.tool_policy.policy_id,
    )
    with pytest.raises(TypeError, match="invalid_bureau_tool_policy"):
        replace(skill, tool_policy=forged_policy)


def test_shared_source_types_are_frozen_complete_contracts() -> None:
    skill = _sample_skill()
    assert {field.name for field in fields(skill.method)} == {
        "data_requirements",
        "analysis_procedure",
        "required_findings",
        "forbidden_actions",
    }
    assert {field.name for field in fields(skill.tool_policy)} == {
        "policy_id",
        "version",
        "agent_id",
        "allowed_tools",
        "allowed_data_domains",
        "tool_operations",
        "tool_argument_constraints",
        "required_data_refs",
        "max_tool_calls",
        "max_tool_rounds",
        "max_result_rows",
        "max_result_bytes",
    }
    with pytest.raises(FrozenInstanceError):
        skill.method.data_requirements = ("changed",)  # type: ignore[misc]
    with pytest.raises(FrozenInstanceError):
        skill.tool_policy.policy_id = "changed"  # type: ignore[misc]


@pytest.mark.parametrize(
    ("field", "value", "error"),
    [
        ("data_requirements", ("", "valid"), "invalid_bureau_method"),
        ("analysis_procedure", ("only",), "invalid_bureau_method"),
        ("required_findings", (), "invalid_bureau_method"),
        ("forbidden_actions", ("only",), "invalid_bureau_method"),
    ],
)
def test_bureau_method_rejects_incomplete_fields(
    field: str, value: tuple[str, ...], error: str
) -> None:
    with pytest.raises(ValueError, match=error):
        replace(_sample_skill().method, **{field: value})


@pytest.mark.parametrize(
    ("field", "value", "error"),
    [
        ("policy_id", "", "invalid_bureau_tool_policy_identity"),
        ("version", "v1", "invalid_bureau_tool_policy_version"),
        ("agent_id", "", "invalid_bureau_tool_policy_identity"),
        ("allowed_tools", (), "invalid_bureau_tool_policy_tools"),
        ("allowed_data_domains", (), "invalid_bureau_tool_policy_domains"),
        ("tool_operations", (), "invalid_bureau_tool_policy_operations"),
        ("tool_argument_constraints", (), "invalid_bureau_tool_policy_constraints"),
        ("required_data_refs", (), "invalid_bureau_tool_policy_data_refs"),
        ("max_tool_calls", 0, "invalid_bureau_tool_policy_budget"),
        ("max_tool_rounds", 0, "invalid_bureau_tool_policy_budget"),
        ("max_result_rows", 0, "invalid_bureau_tool_policy_budget"),
        ("max_result_bytes", 0, "invalid_bureau_tool_policy_budget"),
    ],
)
def test_bureau_tool_policy_rejects_incomplete_fields(
    field: str, value: object, error: str
) -> None:
    with pytest.raises(ValueError, match=error):
        replace(_sample_skill().tool_policy, **{field: value})


def test_registry_is_explicit_immutable_and_complete() -> None:
    assert len(BUREAU_SKILL_SPECS) == 39
    assert isinstance(BUREAU_SKILL_SPECS, tuple)
    with pytest.raises(ValueError, match="incomplete_bureau_skill_registry"):
        build_bureau_skill_registry((), expected_identities=(), finalize=True)


def test_task_3_modules_each_own_exactly_one_explicit_skill() -> None:
    package = "app.agents.runtime_skills.roles.bureaus.skills"
    modules = tuple(importlib.import_module(f"{package}.{name}") for name in TASK_3_MODULES)

    assert tuple(module.__name__.rsplit(".", 1)[-1] for module in modules) == TASK_3_MODULES
    for module in modules:
        assert module.__all__ == ("SKILL",)
        assert module.__annotations__ == {"SKILL": BureauRuntimeSkillSpec}
        assert isinstance(module.SKILL, BureauRuntimeSkillSpec)


def test_task_3_registry_order_identity_and_oracle_fields_are_exact() -> None:
    expected_records = tuple(
        record for record in _current_bureau_records() if record["department"] in TASK_3_DEPARTMENTS
    )
    migrated = BUREAU_SKILL_SPECS[:13]
    assert len(expected_records) == 13
    assert len(BUREAU_SKILL_SPECS) == 39
    assert tuple(skill.agent_id for skill in migrated) == EXPECTED_AGENT_IDS[:13]

    for skill, record in zip(migrated, expected_records, strict=True):
        assert skill.department == record["department"]
        assert skill.bureau == record["bureau"]
        assert skill.agent_id == record["runtime_skill"]["agent_id"]
        assert skill.skill_id == record["source_skill_id"]
        assert _canonicalize(skill.method) == record["source_method"]
        assert _canonicalize(skill.tool_policy) == record["source_tool_policy"]

    identities = tuple(skill.identity for skill in migrated)
    assert len({identity[2] for identity in identities}) == 13
    assert len({identity[3] for identity in identities}) == 13
    assert len({identity[4] for identity in identities}) == 13
    assert _sha256(_current_bureau_records()) == EXPECTED_CANONICAL_SHA256


def test_task_4_modules_each_own_exactly_one_explicit_skill() -> None:
    package = "app.agents.runtime_skills.roles.bureaus.skills"
    modules = tuple(importlib.import_module(f"{package}.{name}") for name in TASK_4_MODULES)

    assert tuple(module.__name__.rsplit(".", 1)[-1] for module in modules) == TASK_4_MODULES
    for module in modules:
        assert module.__all__ == ("SKILL",)
        assert module.__annotations__ == {"SKILL": BureauRuntimeSkillSpec}
        assert isinstance(module.SKILL, BureauRuntimeSkillSpec)


def test_task_4_registry_order_identity_and_oracle_fields_are_exact() -> None:
    expected_records = tuple(
        record for record in _current_bureau_records() if record["department"] in TASK_4_DEPARTMENTS
    )
    migrated = BUREAU_SKILL_SPECS[13:25]
    assert len(expected_records) == 12
    assert len(BUREAU_SKILL_SPECS) == 39
    assert tuple(skill.agent_id for skill in BUREAU_SKILL_SPECS[:25]) == EXPECTED_AGENT_IDS[:25]

    for skill, record in zip(migrated, expected_records, strict=True):
        assert skill.department == record["department"]
        assert skill.bureau == record["bureau"]
        assert skill.agent_id == record["runtime_skill"]["agent_id"]
        assert skill.skill_id == record["source_skill_id"]
        assert _canonicalize(skill.method) == record["source_method"]
        assert _canonicalize(skill.tool_policy) == record["source_tool_policy"]

    identities = tuple(skill.identity for skill in BUREAU_SKILL_SPECS[:25])
    assert len({identity[2] for identity in identities}) == 25
    assert len({identity[3] for identity in identities}) == 25
    assert len({identity[4] for identity in identities}) == 25
    assert _sha256(_current_bureau_records()) == EXPECTED_CANONICAL_SHA256


def test_task_5_modules_each_own_exactly_one_explicit_skill() -> None:
    package = "app.agents.runtime_skills.roles.bureaus.skills"
    modules = tuple(importlib.import_module(f"{package}.{name}") for name in TASK_5_MODULES)

    assert tuple(module.__name__.rsplit(".", 1)[-1] for module in modules) == TASK_5_MODULES
    for module in modules:
        assert module.__all__ == ("SKILL",)
        assert module.__annotations__ == {"SKILL": BureauRuntimeSkillSpec}
        assert isinstance(module.SKILL, BureauRuntimeSkillSpec)


def test_task_5_completes_exact_registry_order_identity_and_oracle_fields() -> None:
    expected_records = tuple(
        record for record in _current_bureau_records() if record["department"] in TASK_5_DEPARTMENTS
    )
    migrated = BUREAU_SKILL_SPECS[25:]
    assert len(expected_records) == 14
    assert len(BUREAU_SKILL_SPECS) == 39
    assert tuple(skill.agent_id for skill in BUREAU_SKILL_SPECS) == EXPECTED_AGENT_IDS

    for skill, record in zip(migrated, expected_records, strict=True):
        assert skill.department == record["department"]
        assert skill.bureau == record["bureau"]
        assert skill.agent_id == record["runtime_skill"]["agent_id"]
        assert skill.skill_id == record["source_skill_id"]
        assert _canonicalize(skill.method) == record["source_method"]
        assert _canonicalize(skill.tool_policy) == record["source_tool_policy"]

    identities = tuple(skill.identity for skill in BUREAU_SKILL_SPECS)
    assert len({identity[:2] for identity in identities}) == 39
    assert len({identity[2] for identity in identities}) == 39
    assert len({identity[3] for identity in identities}) == 39
    assert len({identity[4] for identity in identities}) == 39
    assert _sha256(_current_bureau_records()) == EXPECTED_CANONICAL_SHA256


def test_finalized_registry_rejects_missing_extra_reordered_and_duplicate_identity() -> None:
    complete = BUREAU_SKILL_SPECS
    identities = tuple(skill.identity for skill in complete)
    assert (
        build_bureau_skill_registry(complete, expected_identities=identities, finalize=True)
        == complete
    )

    with pytest.raises(ValueError, match="incomplete_bureau_skill_registry"):
        build_bureau_skill_registry(
            complete[:-1], expected_identities=identities[:-1], finalize=True
        )
    with pytest.raises(ValueError, match="duplicate_bureau_department_bureau"):
        build_bureau_skill_registry(
            (*complete, complete[0]), expected_identities=identities, finalize=True
        )
    with pytest.raises(ValueError, match="bureau_skill_identity_mismatch"):
        build_bureau_skill_registry(
            (*complete[:-2], complete[-1], complete[-2]),
            expected_identities=identities,
            finalize=True,
        )
    with pytest.raises(ValueError, match="duplicate_bureau_department_bureau"):
        build_bureau_skill_registry(
            (
                *complete[:-1],
                replace(complete[-1], department=complete[0].department, bureau=complete[0].bureau),
            ),
            expected_identities=identities,
            finalize=True,
        )


@pytest.mark.parametrize(
    ("field", "value", "error"),
    [
        ("department", "户部", "bureau_skill_identity_inventory_mismatch"),
        ("bureau", "招聘司", "bureau_skill_identity_inventory_mismatch"),
        ("agent_id", "wrong-agent", "bureau_skill_identity_inventory_mismatch"),
        ("skill_id", "wrong-skill", "bureau_skill_identity_inventory_mismatch"),
        ("policy_id", "wrong-policy", "bureau_skill_identity_inventory_mismatch"),
    ],
)
def test_registry_rejects_every_cross_field_identity_mismatch(
    field: str, value: str, error: str
) -> None:
    skill = _sample_skill()
    expected = list(_identity(skill))
    field_index = {
        "department": 0,
        "bureau": 1,
        "agent_id": 2,
        "skill_id": 3,
        "policy_id": 4,
    }
    expected[field_index[field]] = value

    with pytest.raises(ValueError, match=error):
        build_bureau_skill_registry((skill,), expected_identities=(tuple(expected),))


@pytest.mark.parametrize(
    "field",
    ["department_bureau", "agent_id", "skill_id", "policy_id"],
)
def test_registry_rejects_duplicate_identities(field: str) -> None:
    first = _sample_skill()
    second = replace(
        first,
        department="户部" if field != "department_bureau" else first.department,
        bureau="预算司" if field != "department_bureau" else first.bureau,
        agent_id=(
            "hubu-budget" if field not in {"department_bureau", "agent_id"} else first.agent_id
        ),
        skill_id=(
            "analyze-budget-variance"
            if field not in {"department_bureau", "skill_id"}
            else first.skill_id
        ),
        tool_policy=replace(
            first.tool_policy,
            agent_id=(
                "hubu-budget" if field not in {"department_bureau", "agent_id"} else first.agent_id
            ),
            policy_id=(
                "bureau.hubu.budget.tools" if field != "policy_id" else first.tool_policy.policy_id
            ),
        ),
    )
    with pytest.raises(ValueError, match=f"duplicate_bureau_{field}"):
        build_bureau_skill_registry(
            (first, second), expected_identities=(_identity(first), _identity(second))
        )


def test_registry_rejects_missing_extra_and_undeclared_objects() -> None:
    skill = _sample_skill()
    with pytest.raises(ValueError, match="bureau_skill_identity_inventory_mismatch"):
        build_bureau_skill_registry((skill,), expected_identities=())
    with pytest.raises(ValueError, match="bureau_skill_identity_inventory_mismatch"):
        build_bureau_skill_registry((), expected_identities=(_identity(skill),))
    with pytest.raises(TypeError, match="invalid_bureau_skill_declaration"):
        build_bureau_skill_registry((object(),), expected_identities=())  # type: ignore[arg-type]


def test_registry_rejects_multi_element_reordering() -> None:
    first = _sample_skill()
    second = replace(
        first,
        department="户部",
        bureau="预算司",
        agent_id="hubu-budget",
        skill_id="analyze-budget-variance",
        tool_policy=replace(
            first.tool_policy,
            agent_id="hubu-budget",
            policy_id="bureau.hubu.budget.tools",
        ),
    )

    with pytest.raises(ValueError, match="bureau_skill_identity_mismatch"):
        build_bureau_skill_registry(
            (second, first), expected_identities=(_identity(first), _identity(second))
        )


def test_legacy_exports_are_directly_derived_from_central_specs() -> None:
    assert tuple(BUREAU_METHODS) == tuple(
        (spec.department, spec.bureau) for spec in BUREAU_SKILL_SPECS
    )
    assert tuple(BUREAU_TOOL_POLICY_SPECS) == tuple(
        spec.agent_id for spec in BUREAU_SKILL_SPECS
    )
    for spec in BUREAU_SKILL_SPECS:
        assert BUREAU_METHODS[(spec.department, spec.bureau)] is spec.method
        assert BUREAU_TOOL_POLICY_SPECS[spec.agent_id] is spec.tool_policy

    departments = tuple(dict.fromkeys(spec.department for spec in BUREAU_SKILL_SPECS))
    department_exports = dict(
        zip(
            departments,
            (LIBU_IDS, HUBU_IDS, LIBU_RITES_IDS, BINGBU_IDS, XINGBU_IDS, GONGBU_IDS),
            strict=True,
        )
    )
    for department, skill_ids in department_exports.items():
        expected = tuple(
            (spec.bureau, spec.skill_id)
            for spec in BUREAU_SKILL_SPECS
            if spec.department == department
        )
        assert tuple(skill_ids.items()) == expected


def test_legacy_facades_and_production_consumers_have_no_definition_fallback() -> None:
    professional_source = inspect.getsource(
        importlib.import_module(
            "app.agents.runtime_skills.roles.bureaus.professional"
        )
    )
    assert "BureauMethod(" not in professional_source
    assert "BureauToolPolicySpec(" not in professional_source

    for module_name in ("libu", "hubu", "libu_rites", "bingbu", "xingbu", "gongbu"):
        source = inspect.getsource(
            importlib.import_module(
                f"app.agents.runtime_skills.roles.bureaus.{module_name}"
            )
        )
        assert "BUREAU_SKILL_SPECS" in source
        assert "for spec in BUREAU_SKILL_SPECS" in source

    runtime_source = inspect.getsource(runtime_registry_module)
    tool_source = inspect.getsource(tool_registry_module)
    assert "roles.bureaus.skill_registry import BUREAU_SKILL_SPECS" in runtime_source
    assert "roles.bureaus.professional" not in runtime_source
    assert "roles.bureaus.skill_registry import BUREAU_SKILL_SPECS" in tool_source
    assert "roles.bureaus.professional" not in tool_source


def test_runtime_registry_has_no_legacy_identity_inference_maps() -> None:
    runtime_source = inspect.getsource(runtime_registry_module)
    assert "_DEPARTMENT_SLUGS" not in runtime_source
    assert "_BUREAU_SLUGS" not in runtime_source
    assert 'f"{_DEPARTMENT_SLUGS' not in runtime_source
    for spec in BUREAU_SKILL_SPECS:
        assert bureau_agent_id(spec.department, spec.bureau) == spec.agent_id
