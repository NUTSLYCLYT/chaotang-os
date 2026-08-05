from __future__ import annotations

import re

from pydantic import ValidationError

from app.agents.fact_plans import FactPlanDisposition, FactPlanResult
from app.jinyiwei.models import (
    DataGapDraft,
    DataScope,
    FactCategory,
    FreshnessRequirement,
    RequiredFact,
    SourceType,
)

_OPENAI_ENTITY = re.compile(r"\bOpenAI\b", re.IGNORECASE)
_EXTERNAL_INVESTIGATION = re.compile(r"外网调查")
_SINGLE_REFERENCE_LIMIT = re.compile(
    r"(?:一个|1\s*个)\s*ENTITY_REFERENCE",
    re.IGNORECASE,
)
_SOURCE_SCOPE = (
    SourceType.SHIGUAN,
    SourceType.PUBLIC_API,
    SourceType.PUBLIC_WEB,
)


def compile_entity_reference_plan(*, decree_text: str, node_id: str) -> FactPlanResult:
    """Compile one explicit public-entity identity request without model inference."""

    if "ENTITY_REFERENCE" not in decree_text.upper():
        return FactPlanResult(FactPlanDisposition.NOT_APPLICABLE)
    if (
        _OPENAI_ENTITY.search(decree_text) is None
        or _EXTERNAL_INVESTIGATION.search(decree_text) is None
        or _SINGLE_REFERENCE_LIMIT.search(decree_text) is None
    ):
        return FactPlanResult(
            FactPlanDisposition.REJECTED,
            reason="entity_ambiguous",
        )
    subject = "OpenAI"
    # The first supported intent is deliberately limited to OpenAI. Expanding
    # the registry requires an explicit jurisdiction rule, never model output.
    if subject.casefold() != "openai":
        return FactPlanResult(FactPlanDisposition.NOT_APPLICABLE)
    try:
        draft = DataGapDraft(
            requesting_agent=node_id,
            question=decree_text,
            required_facts=(
                RequiredFact(
                    key="entity_reference:identity",
                    description=f"核查 {subject} 的公开实体身份",
                    category=FactCategory.ENTITY_REFERENCE,
                    data_scope=DataScope.EXTERNAL_PUBLIC,
                    subject=subject,
                    jurisdiction="US",
                    expected_shape="string",
                ),
            ),
            decision_context="核查一个公开实体身份",
            freshness=FreshnessRequirement(max_age_seconds=86400),
        )
    except ValidationError:
        return FactPlanResult(
            FactPlanDisposition.REJECTED,
            reason="data_plan_invalid",
        )
    return FactPlanResult(
        FactPlanDisposition.PLANNED,
        draft=draft,
        source_scope=_SOURCE_SCOPE,
    )
