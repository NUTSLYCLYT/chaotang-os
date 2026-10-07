from app.agents.entity_fact_plan import (
    compile_entity_reference_plan,
    compile_github_repository_plan,
)
from app.agents.fact_plans import FactPlanDisposition
from app.jinyiwei.models import DataScope, FactCategory, SourceType


def test_explicit_public_entity_decree_compiles_one_reference_fact() -> None:
    result = compile_entity_reference_plan(
        decree_text=(
            "通过锦衣卫外网调查核查 OpenAI 是什么公开实体，"
            "只需要一个 ENTITY_REFERENCE"
        ),
        node_id="bureau:礼部:内容司",
    )

    assert result.disposition is FactPlanDisposition.PLANNED
    assert result.source_scope == (
        SourceType.SHIGUAN,
        SourceType.PUBLIC_API,
        SourceType.PUBLIC_WEB,
    )
    assert result.draft is not None
    assert result.draft.requesting_agent == "bureau:礼部:内容司"
    assert len(result.draft.required_facts) == 1
    fact = result.draft.required_facts[0]
    assert fact.key == "entity_reference:identity"
    assert fact.category is FactCategory.ENTITY_REFERENCE
    assert fact.data_scope is DataScope.EXTERNAL_PUBLIC
    assert fact.subject == "OpenAI"
    assert fact.jurisdiction == "US"
    assert fact.expected_shape == "string"


def test_explicit_public_entity_decree_allows_sentence_break_before_single_fact_limit() -> None:
    result = compile_entity_reference_plan(
        decree_text=(
            "请礼部内容司通过锦衣卫外网调查核查 OpenAI 是什么公开实体。"
            "只需要一个 ENTITY_REFERENCE 实体事实。"
        ),
        node_id="bureau:礼部:内容司",
    )

    assert result.disposition is FactPlanDisposition.PLANNED
    assert result.draft is not None
    assert result.draft.required_facts[0].subject == "OpenAI"


def test_approved_draft_wording_preserves_entity_plan_contract() -> None:
    result = compile_entity_reference_plan(
        decree_text=(
            "经礼部内容司外网调查，OpenAI 是一家美国人工智能研究机构。"
            "本轮仅提供一个 ENTITY_REFERENCE 实体事实及公开证据。"
        ),
        node_id="bureau:礼部:内容司",
    )

    assert result.disposition is FactPlanDisposition.PLANNED


def test_entity_plan_is_not_applicable_without_explicit_single_reference_request() -> None:
    result = compile_entity_reference_plan(
        decree_text="调查 OpenAI 的近期新闻并给出市场建议",
        node_id="bureau:礼部:内容司",
    )

    assert result.disposition is FactPlanDisposition.NOT_APPLICABLE


def test_entity_plan_rejects_ambiguous_subject() -> None:
    result = compile_entity_reference_plan(
        decree_text="通过锦衣卫外网调查核查它是什么公开实体，只需要一个 ENTITY_REFERENCE",
        node_id="bureau:礼部:内容司",
    )

    assert result.disposition is FactPlanDisposition.REJECTED
    assert result.reason == "entity_ambiguous"


def test_github_repository_plan_compiles_an_explicit_repository_request() -> None:
    result = compile_github_repository_plan(
        decree_text=(
            "请通过锦衣卫外网调查核查 GitHub 仓库 promptfoo/promptfoo 的开源项目资料，"
            "只需要一个 ENTITY_REFERENCE"
        ),
        node_id="bureau:礼部:内容司",
    )

    assert result.disposition is FactPlanDisposition.PLANNED
    assert result.source_scope == (SourceType.SHIGUAN, SourceType.PUBLIC_API)
    assert result.draft is not None
    fact = result.draft.required_facts[0]
    assert fact.key == "github_repository:metadata"
    assert fact.subject == "github:promptfoo/promptfoo"
    assert fact.category is FactCategory.ENTITY_REFERENCE
    assert fact.data_scope is DataScope.EXTERNAL_PUBLIC
    assert fact.expected_shape == "object"
    assert fact.jurisdiction is None


def test_github_repository_plan_requires_a_single_explicit_reference() -> None:
    result = compile_github_repository_plan(
        decree_text="请调查 GitHub 仓库 promptfoo/promptfoo 的许可证",
        node_id="bureau:礼部:内容司",
    )

    assert result.disposition is FactPlanDisposition.NOT_APPLICABLE


def test_github_repository_plan_rejects_a_malformed_explicit_repository() -> None:
    result = compile_github_repository_plan(
        decree_text=(
            "请通过锦衣卫外网调查核查 GitHub 仓库 ??? 的资料，只需要一个 ENTITY_REFERENCE"
        ),
        node_id="bureau:礼部:内容司",
    )

    assert result.disposition is FactPlanDisposition.REJECTED
    assert result.reason == "github_repository_ambiguous"
