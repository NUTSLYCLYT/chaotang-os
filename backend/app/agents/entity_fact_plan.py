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
_GITHUB_REPOSITORY = re.compile(
    r"(?:https?://)?(?:www\.)?github\.com/([A-Za-z0-9_.-]{1,100}/[A-Za-z0-9_.-]{1,100})"
    r"|\b([A-Za-z0-9_.-]{1,100}/[A-Za-z0-9_.-]{1,100})\b"
)
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

_GITHUB_SOURCE_SCOPE = (SourceType.SHIGUAN, SourceType.PUBLIC_API)


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


def compile_github_repository_plan(*, decree_text: str, node_id: str) -> FactPlanResult:
    """Compile one explicit GitHub repository metadata request.

    The repository identity is parsed from user text and frozen into a
    ``github:owner/repository`` subject.  The downstream public API connector
    only accepts that exact subject form, so ordinary entity requests cannot
    accidentally fan out to GitHub.
    """

    upper = decree_text.upper()
    if "GITHUB" not in upper and "开源项目" not in decree_text:
        return FactPlanResult(FactPlanDisposition.NOT_APPLICABLE)
    if (
        _EXTERNAL_INVESTIGATION.search(decree_text) is None
        or _SINGLE_REFERENCE_LIMIT.search(decree_text) is None
    ):
        return FactPlanResult(FactPlanDisposition.NOT_APPLICABLE)
    match = _GITHUB_REPOSITORY.search(decree_text)
    if match is None:
        return FactPlanResult(
            FactPlanDisposition.REJECTED,
            reason="github_repository_ambiguous",
        )
    repository = next(value for value in match.groups() if value is not None)
    if repository.casefold() in {"github.com", "owner/repo"}:
        return FactPlanResult(
            FactPlanDisposition.REJECTED,
            reason="github_repository_ambiguous",
        )
    try:
        draft = DataGapDraft(
            requesting_agent=node_id,
            question=decree_text,
            required_facts=(
                RequiredFact(
                    key="github_repository:metadata",
                    description=f"核查 GitHub 开源项目 {repository} 的公开元数据",
                    category=FactCategory.ENTITY_REFERENCE,
                    data_scope=DataScope.EXTERNAL_PUBLIC,
                    subject=f"github:{repository}",
                    expected_shape="object",
                ),
            ),
            decision_context="核查 GitHub 开源项目的用途、许可证、维护状态与接入风险",
            freshness=FreshnessRequirement(max_age_seconds=86400),
        )
    except ValidationError:
        return FactPlanResult(
            FactPlanDisposition.REJECTED,
            reason="github_repository_ambiguous",
        )
    return FactPlanResult(
        FactPlanDisposition.PLANNED,
        draft=draft,
        source_scope=_GITHUB_SOURCE_SCOPE,
    )
