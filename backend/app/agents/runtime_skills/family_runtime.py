"""Read-only runtime projection for every distilled six-ministry capability family.

The family matrix is governance input, while the existing downstream
RuntimeSkill registry remains the only executable skill inventory.  This
module binds the two and can prove a provider-free degraded path for every
non-retired family without granting tools or side effects.
"""

from __future__ import annotations

import json
import re
from enum import StrEnum
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.agents.runtime_skills.registry import build_default_downstream_skill_registry

_MATRIX_PATH = Path(__file__).with_name("capability_family_bindings.json")
_CANDIDATE_REF_PREFIXES = (
    "approved:",
    "evidence:",
    "input:",
    "ministry-report:",
    "bureau-report:",
)


class FamilyRuntimeError(ValueError):
    """Stable fail-closed capability-family runtime error."""


class FamilyRuntimeStatus(StrEnum):
    COMPLETED = "completed"
    DEGRADED = "degraded"
    BLOCKED = "blocked"


class _FrozenFamilyContract(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")


def _nonblank(value: str) -> str:
    if not value.strip():
        raise ValueError("value_must_be_nonblank")
    return value


class CapabilityFamilyBinding(_FrozenFamilyContract):
    family_id: str
    implementation_status: str
    runtime_skill_ids: tuple[str, ...] = Field(min_length=1)
    source_asset_count: int = Field(gt=0)
    production_promotion_authorized: Literal[False] = False

    _text = field_validator("family_id", "implementation_status")(_nonblank)


class FamilyCandidateAssertion(_FrozenFamilyContract):
    """Untrusted structured assertion used only to detect unresolved conflicts."""

    assertion_id: str
    subject: str
    value_digest: str
    source_ref: str

    _text = field_validator("assertion_id", "subject", "source_ref")(_nonblank)

    @field_validator("value_digest")
    @classmethod
    def _sha256_digest(cls, value: str) -> str:
        if not re.fullmatch(r"sha256:[0-9a-f]{64}", value):
            raise ValueError("value_digest_invalid")
        return value


class FamilyRuntimeResult(_FrozenFamilyContract):
    family_id: str
    tenant_id: str
    owner_user_id: str
    run_id: str
    status: FamilyRuntimeStatus
    runtime_skill_ids: tuple[str, ...]
    candidate_refs: tuple[str, ...]
    candidate_assertions: tuple[FamilyCandidateAssertion, ...]
    missing_requirements: tuple[str, ...]
    reason_codes: tuple[str, ...]
    external_effect_authorized: Literal[False] = False

    _text = field_validator("family_id", "tenant_id", "owner_user_id", "run_id")(
        _nonblank
    )


def _runtime_skill_ids_for_family(
    family: dict[str, object],
    *,
    all_skill_ids: tuple[str, ...],
) -> tuple[str, ...]:
    raw = family.get("runtimeSkillIds")
    if (
        not isinstance(raw, list)
        or not raw
        or any(not isinstance(item, str) or not item.strip() for item in raw)
        or len(set(raw)) != len(raw)
    ):
        raise FamilyRuntimeError("capability_family_runtime_mapping_missing")
    resolved = tuple(raw)
    if any(skill_id not in all_skill_ids for skill_id in resolved):
        raise FamilyRuntimeError("capability_family_runtime_mapping_missing")
    return resolved


@lru_cache(maxsize=1)
def load_capability_family_bindings() -> tuple[CapabilityFamilyBinding, ...]:
    try:
        matrix = json.loads(_MATRIX_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise FamilyRuntimeError("capability_family_matrix_unavailable") from exc
    registry = build_default_downstream_skill_registry()
    all_skill_ids = tuple(skill.skill_id for skill in registry.skills)
    families = matrix.get("families")
    if not isinstance(families, list):
        raise FamilyRuntimeError("capability_family_matrix_invalid")
    bindings: list[CapabilityFamilyBinding] = []
    seen: set[str] = set()
    for family in families:
        if not isinstance(family, dict):
            raise FamilyRuntimeError("capability_family_matrix_invalid")
        family_id = family.get("familyId")
        status = family.get("implementationStatus")
        if not isinstance(family_id, str) or family_id in seen:
            raise FamilyRuntimeError("capability_family_matrix_invalid")
        seen.add(family_id)
        if status == "retire":
            continue
        if status not in {"existing", "enhance", "new"}:
            raise FamilyRuntimeError("capability_family_matrix_invalid")
        source_count = family.get("sourceAssetCount")
        if not isinstance(source_count, int) or isinstance(source_count, bool):
            raise FamilyRuntimeError("capability_family_matrix_invalid")
        bindings.append(
            CapabilityFamilyBinding(
                family_id=family_id,
                implementation_status=status,
                runtime_skill_ids=_runtime_skill_ids_for_family(
                    family, all_skill_ids=all_skill_ids
                ),
                source_asset_count=source_count,
            )
        )
    if len(bindings) != 22:
        raise FamilyRuntimeError("capability_family_inventory_mismatch")
    return tuple(bindings)


def execute_capability_family(
    family_id: str,
    *,
    tenant_id: str,
    owner_user_id: str,
    run_id: str,
    candidate_refs: tuple[str, ...],
    candidate_assertions: tuple[FamilyCandidateAssertion, ...] = (),
) -> FamilyRuntimeResult:
    """Return an honest no-provider execution projection for one family."""

    binding = next(
        (item for item in load_capability_family_bindings() if item.family_id == family_id),
        None,
    )
    if binding is None:
        raise FamilyRuntimeError("capability_family_not_registered")
    if any(
        not isinstance(ref, str)
        or len(ref) > 512
        or not any(
            ref.startswith(prefix) and ref[len(prefix) :].strip()
            for prefix in _CANDIDATE_REF_PREFIXES
        )
        for ref in candidate_refs
    ):
        raise FamilyRuntimeError("candidate_ref_invalid")
    if len(candidate_refs) > 64 or len(set(candidate_refs)) != len(candidate_refs):
        raise FamilyRuntimeError("candidate_ref_invalid")
    if len(candidate_assertions) > 64:
        raise FamilyRuntimeError("candidate_assertion_invalid")
    assertion_ids = tuple(item.assertion_id for item in candidate_assertions)
    if len(set(assertion_ids)) != len(assertion_ids) or any(
        item.source_ref not in candidate_refs for item in candidate_assertions
    ):
        raise FamilyRuntimeError("candidate_assertion_invalid")
    registry = build_default_downstream_skill_registry()
    skills = tuple(registry.get(skill_id) for skill_id in binding.runtime_skill_ids)
    requirements = tuple(
        dict.fromkeys(requirement for skill in skills for requirement in skill.data_requirements)
    )
    values_by_subject: dict[str, set[str]] = {}
    for assertion in candidate_assertions:
        values_by_subject.setdefault(assertion.subject, set()).add(
            assertion.value_digest
        )
    conflict_detected = any(len(values) > 1 for values in values_by_subject.values())
    reason_codes = (
        ("candidate_assertion_conflict_unresolved", "authoritative_requirement_coverage_missing")
        if conflict_detected
        else ("authoritative_requirement_coverage_missing",)
    )
    # Generic refs cannot honestly establish which distinct professional
    # requirement they cover.  The family path therefore stays degraded
    # until an authoritative adapter supplies explicit requirement coverage.
    return FamilyRuntimeResult(
        family_id=binding.family_id,
        tenant_id=tenant_id,
        owner_user_id=owner_user_id,
        run_id=run_id,
        status=FamilyRuntimeStatus.DEGRADED,
        runtime_skill_ids=binding.runtime_skill_ids,
        candidate_refs=candidate_refs,
        candidate_assertions=candidate_assertions,
        missing_requirements=requirements,
        reason_codes=reason_codes,
    )
