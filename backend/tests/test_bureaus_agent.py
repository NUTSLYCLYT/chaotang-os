"""Offline coverage for the immutable bureau registry and generic agent."""

from __future__ import annotations

import json
from collections import Counter
from dataclasses import FrozenInstanceError, fields
from decimal import Decimal

import pytest

from app.accounting_reports.models import (
    AccountingReportSummary,
    ReportCheck,
    ReportPeriod,
)
from app.agents.bureaus import (
    BUREAU_PROFILES,
    BureauAgentInvocationError,
    BureauProfile,
    bureau_profile_for,
    bureau_profiles_for,
    bureau_system_prompt,
    capability_profile_for,
    invoke_bureau_agent,
)
from app.agents.bureaus.prompts import capability_prompt_section
from app.agents.evidence_protocol import (
    AgentEvidenceSession,
    EvidenceProtocolError,
    bureau_node_id,
    invoke_bureau_with_evidence,
)
from app.agents.fact_plans import FactPlanDisposition, FactPlanResult
from app.agents.ministries import NO_IRREVERSIBLE_ACTION_CONSTRAINT

EXPECTED_BUREAUS = {
    "吏部": ("任免司", "招聘司", "劳关司", "薪酬司", "制度司", "协同司"),
    "户部": ("预算司", "出纳司", "盐铁司", "融资司", "审计司", "会计司", "投资司"),
    "礼部": ("品牌司", "公关司", "客户沟通司", "内容司", "政企司", "体验司"),
    "兵部": ("报价司", "线索司", "渠道司", "客户司", "竞情司", "增长司"),
    "刑部": ("合同司", "合规稽查司", "风控司", "缺证核查司", "争议处置司", "知识产权司", "制度司"),
    "工部": ("产研司", "技术司", "物料司", "进度司", "质量司", "现场司", "承诺司"),
}

EXPECTED_RESPONSIBILITIES = {
    ("吏部", "任免司"): ("任免", "晋升", "职级", "调岗", "职责匹配"),
    ("吏部", "招聘司"): ("招聘需求", "岗位缺口", "候选人匹配", "面试推进"),
    ("吏部", "劳关司"): ("劳动关系", "员工入、离、调、转、续全过程风险"),
    ("吏部", "薪酬司"): ("薪酬区间", "调薪", "奖金", "预算", "内部公平性"),
    ("吏部", "制度司"): ("人事制度", "流程规则", "适用条款", "例外处理"),
    ("吏部", "协同司"): ("责任人", "跨司协同链路", "卡点", "逾期", "催办"),
    ("户部", "预算司"): ("预算", "预测", "费用控制", "经营分析"),
    ("户部", "出纳司"): ("现金安全", "回款", "付款", "账期", "资金安全垫"),
    ("户部", "盐铁司"): ("报价", "成本拆解", "毛利底线", "异常价格"),
    ("户部", "融资司"): ("资金缺口", "融资方案", "资金成本", "还款压力", "融资红线"),
    ("户部", "审计司"): ("异常报销", "重复付款", "缺证费用", "流程绕行稽核"),
    ("户部", "会计司"): ("收入", "成本", "费用", "科目", "项目归集", "税务", "月结"),
    ("户部", "投资司"): (
        "投资评审",
        "收益测算",
        "风险分析",
        "退出路径",
        "证券行情",
        "股票价格",
        "市场数据",
        "估值观察",
    ),
    ("礼部", "品牌司"): ("品牌表达", "视觉资产", "语气一致性", "品牌风险"),
    ("礼部", "公关司"): ("舆情监测", "事实核查", "回应口径", "危机升级"),
    ("礼部", "客户沟通司"): ("客户话术", "沟通目标", "禁用话术", "承诺边界"),
    ("礼部", "内容司"): ("内容质量", "事实校验", "发布门禁", "修改建议"),
    ("礼部", "政企司"): ("政企合作", "材料准备", "合规边界", "跟进计划"),
    ("礼部", "体验司"): ("用户反馈", "体验问题优先级", "优化建议", "结果验证"),
    ("兵部", "报价司"): ("商机推进", "客户阶段", "报价动作", "赢率", "阻塞点"),
    ("兵部", "线索司"): ("市场活动", "线索质量", "获客成本", "投放复盘"),
    ("兵部", "渠道司"): ("渠道合作", "报备", "成交归属", "返佣", "渠道冲突"),
    ("兵部", "客户司"): ("客户健康", "续约", "投诉", "交付问题", "关键联系人"),
    ("兵部", "竞情司"): ("竞品对比", "价格战风险", "输赢原因", "竞争策略"),
    ("兵部", "增长司"): ("漏斗转化", "增长瓶颈", "实验队列", "实验优先级"),
    ("刑部", "合同司"): ("合同条款", "签署门禁", "缺失条款", "模板偏离"),
    ("刑部", "合规稽查司"): ("合规规则", "风险等级", "整改要求", "稽查结论"),
    ("刑部", "风控司"): ("整体风险评分", "风险趋势", "控制措施", "准入建议"),
    ("刑部", "缺证核查司"): ("证据完整性", "授权链", "审批状态", "越权检查"),
    ("刑部", "争议处置司"): ("争议事实链", "双方诉求", "证据强弱", "处置策略"),
    ("刑部", "知识产权司"): ("知识产权归属", "授权", "侵权风险", "保护建议"),
    ("刑部", "制度司"): ("法律制度", "处罚风险", "整改路径", "豁免条件"),
    ("工部", "产研司"): ("需求", "产品方案", "用户价值", "范围边界", "优先级"),
    ("工部", "技术司"): ("技术可行性", "架构风险", "研发成本", "依赖", "技术债"),
    ("工部", "物料司"): ("库存", "采购", "供应商", "缺料风险", "替代方案"),
    ("工部", "进度司"): ("里程碑", "排期", "延期风险", "卡点责任人", "交付预测"),
    ("工部", "质量司"): ("质量检查", "缺陷", "验收证据", "返工建议", "质量裁决"),
    ("工部", "现场司"): ("现场事实", "客户反馈", "处理进度", "现场证据"),
    ("工部", "承诺司"): ("客户承诺", "兑现状态", "承诺来源", "责任人", "越权风险"),
}


def test_registry_has_exact_roster_distribution_and_compound_unique_identity():
    assert isinstance(BUREAU_PROFILES, tuple)
    assert len(BUREAU_PROFILES) == 39
    assert Counter(profile.department for profile in BUREAU_PROFILES) == {
        "吏部": 6,
        "户部": 7,
        "礼部": 6,
        "兵部": 6,
        "刑部": 7,
        "工部": 7,
    }
    assert len({(item.department, item.bureau) for item in BUREAU_PROFILES}) == 39
    for department, bureaus in EXPECTED_BUREAUS.items():
        assert tuple(item.bureau for item in bureau_profiles_for(department)) == bureaus


def test_profiles_are_frozen_slotted_and_do_not_have_release_gates():
    profile = BUREAU_PROFILES[0]
    assert isinstance(profile, BureauProfile)
    assert [item.name for item in fields(BureauProfile)] == [
        "department",
        "bureau",
        "responsibilities",
    ]
    assert not hasattr(profile, "__dict__")
    assert not hasattr(profile, "enabled")
    assert not hasattr(profile, "version")
    assert all(not hasattr(item, "enabled") for item in BUREAU_PROFILES)
    assert all(not hasattr(item, "version") for item in BUREAU_PROFILES)
    with pytest.raises(FrozenInstanceError):
        profile.bureau = "不可变"


def test_every_declared_responsibility_is_non_empty_and_present_in_its_prompt():
    assert {
        (profile.department, profile.bureau): profile.responsibilities
        for profile in BUREAU_PROFILES
    } == EXPECTED_RESPONSIBILITIES
    for profile in BUREAU_PROFILES:
        assert profile.responsibilities
        prompt = bureau_system_prompt(profile.department, profile.bureau)
        assert profile.department in prompt
        assert profile.bureau in prompt
        for responsibility in profile.responsibilities:
            assert responsibility
            assert responsibility in prompt


def test_direct_bureau_prompt_contains_structured_professional_report_contract() -> None:
    prompt = bureau_system_prompt("工部", "技术司")

    assert '"professional_findings"' in prompt
    assert '"recommendations"' in prompt
    assert "不得跨区复制" in prompt
    assert '"status":"READY"' not in prompt


def test_evidence_bureau_prompt_excludes_bare_opinion_contract() -> None:
    prompt = bureau_system_prompt(
        "工部",
        "技术司",
        evidence_session=True,
    )

    assert '{"opinion": "<本司非空专业意见>"}' not in prompt
    assert "你必须只输出一个严格的 JSON 对象" not in prompt


def test_investment_bureau_declares_market_quote_capability() -> None:
    profile = next(item for item in bureau_profiles_for("户部") if item.bureau == "投资司")

    assert "证券行情" in profile.responsibilities
    assert "股票价格" in profile.responsibilities


def test_bound_bureau_prompt_renders_only_runtime_skill_professional_method():
    prompt = bureau_system_prompt("工部", "技术司")

    expected_content = (
        "analyze-technical-feasibility",
        "架构、接口、依赖与运行约束",
        "建立当前系统与约束基线",
        "技术可行性与关键依赖",
        "不得部署、改生产或暴露凭证",
    )

    position = 0
    for content in expected_content:
        position = prompt.index(content, position) + len(content)
    assert prompt.count("兼容分析模式") == 1
    assert prompt.count("Pack R&D advisory.") == 1
    assert prompt.count("SDLC advisory memo.") == 1
    assert prompt.index("不得部署、改生产或暴露凭证") < prompt.index(
        NO_IRREVERSIBLE_ACTION_CONSTRAINT
    )


def test_capability_bound_high_risk_prompts_remain_advice_or_drafts_pending_approval():
    """Capability packages must not turn a bureau into an action authority."""

    high_risk_capabilities = {
        "commercial_opportunity",
        "quotation_analysis",
        "contract_review",
        "delivery_aftercare",
        "social_content_operations",
        "persona_screening",
    }
    for capability_id in high_risk_capabilities:
        profile = capability_profile_for(capability_id)
        prompt = bureau_system_prompt(profile.department, profile.bureau)
        assert "运行时 Skill" in prompt
        assert NO_IRREVERSIBLE_ACTION_CONSTRAINT in prompt


def test_invoke_bureau_agent_corrects_one_invalid_structured_response():
    responses = iter(
        (
            "not-json secret-first-response",
            '{"opinion":"validated opinion"}',
        )
    )
    calls: list[list[dict[str, str]]] = []

    def model(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        return next(responses)

    result = invoke_bureau_agent(
        "工部",
        "技术司",
        "offline decree",
        "approved rationale",
        model,
    )

    assert result == "validated opinion"
    assert len(calls) == 2
    assert calls[0][-1]["role"] == "user"
    assert calls[1][-1]["role"] == "system"
    assert "secret-first-response" not in calls[1][-1]["content"]


@pytest.mark.parametrize(
    "non_bureau_node_id",
    ("ministry:户部", "junjichu:council", "chancellor:finalize"),
)
def test_controlled_evidence_session_rejects_non_bureau_roles_before_any_access(
    non_bureau_node_id: str,
) -> None:
    """A department, Junjichu, or Chancellor cannot reuse a bureau session."""

    coordinator_calls = 0
    model_calls = 0

    class Coordinator:
        def investigate(self, *_args, **_kwargs):
            nonlocal coordinator_calls
            coordinator_calls += 1
            raise AssertionError("non-bureau roles must not investigate")

    def model(_messages: object) -> str:
        nonlocal model_calls
        model_calls += 1
        return '{"opinion":"must not run"}'

    profile = BUREAU_PROFILES[0]
    with pytest.raises(EvidenceProtocolError, match="bureau_identity_invalid"):
        invoke_bureau_with_evidence(
            node_id=non_bureau_node_id,
            department=profile.department,
            bureau=profile.bureau,
            matter_type="MEMORIAL",
            decree_text="offline decree",
            messages=[{"role": "system", "content": "offline fake"}],
            chat_model=model,
            legacy_parser=lambda value: value,
            fallback=lambda reason: reason,
            session=AgentEvidenceSession(owner_user_id="test-owner", coordinator=Coordinator()),
        )

    assert model_calls == 0
    assert coordinator_calls == 0


def test_bureau_without_legacy_package_uses_its_own_runtime_skill_only():
    prompt = bureau_system_prompt("户部", "预算司")

    assert "analyze-budget-performance" in prompt
    assert "Financial analysis memo." not in prompt
    assert "Contract review notes." not in prompt


def test_same_named_cross_department_bureaus_keep_capability_sections_isolated():
    personnel = capability_prompt_section("吏部", "制度司")
    legal = capability_prompt_section("刑部", "制度司")

    expected = "No special capability packages are assigned to this bureau."
    assert personnel == expected
    assert legal == expected
    with pytest.raises(ValueError):
        capability_prompt_section("吏部", "合同司")


def test_all_six_rites_bureaus_are_open_and_use_the_same_prompt_mechanism():
    rites = bureau_profiles_for("礼部")
    assert tuple(item.bureau for item in rites) == EXPECTED_BUREAUS["礼部"]
    assert len(rites) == 6
    for profile in rites:
        prompt = bureau_system_prompt("礼部", profile.bureau)
        assert "版本 1.0.0" in prompt
        assert "暂不开放" not in prompt
        assert NO_IRREVERSIBLE_ACTION_CONSTRAINT in prompt


def test_every_bureau_prompt_contains_its_enabled_runtime_skill_version():
    for profile in BUREAU_PROFILES:
        prompt = bureau_system_prompt(profile.department, profile.bureau)
        assert "版本 1.0.0" in prompt
        assert "暂不开放" not in prompt


def test_compound_key_distinguishes_the_two_policy_bureaus():
    personnel = bureau_profile_for("吏部", "制度司")
    legal = bureau_profile_for("刑部", "制度司")
    assert personnel is not legal
    assert "人事制度" in personnel.responsibilities
    assert "法律制度" in legal.responsibilities


@pytest.mark.parametrize(
    ("department", "bureau"),
    (("不存在部", "制度司"), ("吏部", "不存在司"), ("吏部", "合同司")),
)
def test_profile_lookup_and_prompt_reject_unknown_or_cross_department_identity(department, bureau):
    with pytest.raises(ValueError):
        bureau_profile_for(department, bureau)
    with pytest.raises(ValueError):
        bureau_system_prompt(department, bureau)


def test_unknown_department_roster_fails_closed():
    with pytest.raises(ValueError):
        bureau_profiles_for("不存在部")


@pytest.mark.parametrize(
    "forbidden_action",
    ("工具", "付款", "任免", "对外发布", "签约", "销售承诺", "生产部署"),
)
def test_every_bureau_prompt_includes_shared_enterprise_safety_constraint(forbidden_action):
    assert forbidden_action in NO_IRREVERSIBLE_ACTION_CONSTRAINT
    for profile in BUREAU_PROFILES:
        prompt = bureau_system_prompt(profile.department, profile.bureau)
        assert NO_IRREVERSIBLE_ACTION_CONSTRAINT in prompt
        assert "只能" in prompt
        assert "专业建议" in prompt
        for action_domain in ("HR", "财务", "销售", "法务", "交付"):
            assert action_domain in prompt


def test_invoke_bureau_agent_sends_identity_context_and_returns_stripped_opinion():
    captured: list[dict[str, str]] = []
    model_calls = 0

    def fake_model(messages: list[dict[str, str]]) -> str:
        nonlocal model_calls
        model_calls += 1
        captured.extend(messages)
        return '{"opinion": "  建议先核查合同授权链。  "}'

    result = invoke_bureau_agent("刑部", "合同司", "审查客户合同", "合同事项交合同司", fake_model)

    assert result == "建议先核查合同授权链。"
    assert model_calls == 1
    assert captured[0] == {
        "role": "system",
        "content": bureau_system_prompt("刑部", "合同司"),
    }
    assert captured[1]["role"] == "user"
    assert "审查客户合同" in captured[1]["content"]
    assert "合同事项交合同司" in captured[1]["content"]


@pytest.mark.parametrize(
    ("department", "bureau"),
    (("不存在部", "合同司"), ("刑部", "不存在司"), ("吏部", "合同司")),
)
def test_invoke_rejects_unknown_and_cross_department_with_sanitized_cause(department, bureau):
    marker = "secret-decree-must-not-leak"
    with pytest.raises(BureauAgentInvocationError) as exc_info:
        invoke_bureau_agent(department, bureau, marker, marker, lambda _messages: '{"opinion":"x"}')
    assert isinstance(exc_info.value.__cause__, ValueError)
    assert marker not in str(exc_info.value)


def test_model_exception_is_wrapped_without_leaking_secret_and_preserves_cause():
    marker = "sk-bureau-private-marker-13579"

    def failing_model(_messages: list[dict[str, str]]) -> str:
        raise RuntimeError(marker)

    with pytest.raises(BureauAgentInvocationError) as exc_info:
        invoke_bureau_agent("户部", "预算司", "旨意", "判断", failing_model)
    assert isinstance(exc_info.value.__cause__, RuntimeError)
    assert marker in str(exc_info.value.__cause__)
    assert marker not in str(exc_info.value)


@pytest.mark.parametrize(
    "response",
    (
        None,
        True,
        123,
        "",
        "   ",
        "not json secret-output-marker",
        "[]",
        '{"comment":"missing"}',
        '{"opinion":123}',
        '{"opinion":""}',
        '{"opinion":"   "}',
        '{"opinion":"ok","extra":"not allowed"}',
    ),
)
def test_invalid_responses_fail_closed_with_sanitized_preserved_cause(response):
    with pytest.raises(BureauAgentInvocationError) as exc_info:
        invoke_bureau_agent("工部", "质量司", "旨意", "判断", lambda _messages: response)
    assert exc_info.value.__cause__ is not None
    assert "secret-output-marker" not in str(exc_info.value)


def test_session_enabled_bureau_degrades_invalid_model_content_without_leaking_body():
    rejected_body = "SECRET-INVALID-BUREAU-BODY"
    session = AgentEvidenceSession(owner_user_id="test-owner", coordinator=object())

    result = invoke_bureau_agent(
        "工部",
        "质量司",
        "旨意",
        "判断",
        lambda _messages: rejected_body,
        evidence_session=session,
    )

    assert result == (
        "数据不足（model_synthesis_invalid），无法形成事实结论；待取得可验证数据后再行复核。"
    )
    assert session.snapshot().degradation_reasons == (
        "model_synthesis_degraded:bureau:工部:质量司",
    )
    assert rejected_body not in result


def test_session_enabled_bureau_provider_failure_still_fails_closed():
    marker = "SECRET-PROVIDER-FAILURE"
    session = AgentEvidenceSession(owner_user_id="test-owner", coordinator=object())

    def failing_model(_messages):
        raise RuntimeError(marker)

    with pytest.raises(BureauAgentInvocationError) as exc_info:
        invoke_bureau_agent(
            "工部",
            "质量司",
            "旨意",
            "判断",
            failing_model,
            evidence_session=session,
        )

    assert isinstance(exc_info.value.__cause__, EvidenceProtocolError)
    assert str(exc_info.value.__cause__) == "model_unavailable"
    assert marker not in str(exc_info.value)
    assert session.snapshot().degradation_reasons == ()


def test_session_enabled_bureau_alone_receives_evidence_protocol_prompt():
    class Coordinator:
        def investigate(self, *_args, **_kwargs):
            raise AssertionError("legacy-ready bureau must not investigate")

    captured: list[list[dict[str, str]]] = []

    def fake_model(messages: list[dict[str, str]]) -> str:
        captured.append(messages)
        return (
            '{"status":"READY","result":{"opinion":"建议继续办理","factual_claims":['
            '{"claim":"建议继续办理","basis":"NORMATIVE","evidence_ids":[],'
            '"fact_key":null,"category":null,"subject":null}]},'
            '"adopted_evidence_ids":[],"fact_basis":"NOT_REQUIRED"}'
        )

    session = AgentEvidenceSession(owner_user_id="test-owner", coordinator=Coordinator())
    profile = BUREAU_PROFILES[0]

    result = invoke_bureau_agent(
        profile.department,
        profile.bureau,
        "decree",
        "route",
        fake_model,
        evidence_session=session,
    )

    assert result == "建议继续办理"
    assert len(captured) == 1
    system_content = captured[0][0]["content"]
    assert "NEEDS_DATA" in system_content
    assert "READY" in system_content
    assert '{"opinion": "<本司非空专业意见>"}' not in system_content
    assert "fact_basis" in system_content
    assert "one or more contiguous substantive opinion clauses" in system_content
    assert "complete ordered coverage" in system_content
    assert "empty factual_claims list is invalid" in system_content
    assert '"basis":"NORMATIVE"' in system_content
    assert '"claim":"<same complete normative clause>"' in system_content
    assert bureau_node_id(profile.department, profile.bureau) in system_content
    assert "required_facts" in system_content
    for market_metric in (
        "LAST_PRICE",
        "VOLUME",
        "CHANGE_PERCENT",
        "INTRADAY_SERIES",
        "PE_RATIO",
        "PB_RATIO",
        "MARKET_CAP",
        "PRICE_TREND_30D",
    ):
        assert market_metric in system_content
    assert '"market_metric":"LAST_PRICE"' in system_content
    assert "all other categories require JSON null" in system_content
    assert session.snapshot().used is False


def test_session_enabled_bureau_retries_one_protocol_correction_for_unsupported_ready():
    def ready(opinion: str) -> str:
        return json.dumps(
            {
                "status": "READY",
                "result": {
                    "opinion": opinion,
                    "factual_claims": [
                        {
                            "claim": opinion,
                            "basis": "NORMATIVE",
                            "evidence_ids": [],
                            "fact_key": None,
                            "category": None,
                            "subject": None,
                        }
                    ],
                },
                "adopted_evidence_ids": [],
                "fact_basis": "NOT_REQUIRED",
            },
            ensure_ascii=False,
        )

    responses = iter(
        (
            ready("当前系统为稳定，应当继续办理"),
            ready("建议继续办理"),
        )
    )
    calls: list[list[dict[str, str]]] = []

    def model(messages: list[dict[str, str]]) -> str:
        calls.append(messages)
        return next(responses)

    session = AgentEvidenceSession(owner_user_id="test-owner", coordinator=object())
    result = invoke_bureau_agent(
        "工部",
        "技术司",
        "提出一项不依赖外部事实的规范性办理建议",
        "route",
        model,
        evidence_session=session,
    )

    assert result == "建议继续办理"
    assert len(calls) == 2
    assert "only normative advice when no evidence is available" in calls[1][-1][
        "content"
    ]


def test_evidence_fallback_says_data_is_insufficient_without_factual_conclusion():
    class UnavailableCoordinator:
        def investigate(self, *_args, **_kwargs):
            raise AssertionError("unexpected coordinator call")

    class ExhaustedSession(AgentEvidenceSession):
        def claim_investigation(self, _node_id):
            return False

    profile = BUREAU_PROFILES[0]
    session = ExhaustedSession(
        owner_user_id="test-owner",
        coordinator=UnavailableCoordinator(),
    )
    node_id = bureau_node_id(profile.department, profile.bureau)
    response = {
        "status": "NEEDS_DATA",
        "data_gap": {
            "requesting_agent": node_id,
            "question": "需要最新公开价格",
            "required_facts": [
                {
                    "key": "quote",
                    "description": "最新价格",
                    "category": "MARKET_QUOTE",
                    "data_scope": "EXTERNAL_PUBLIC",
                    "subject": "BYD",
                    "jurisdiction": "CN",
                    "expected_unit": "CNY",
                    "expected_shape": "number",
                    "market_metric": "LAST_PRICE",
                }
            ],
            "decision_context": "价格影响结论",
            "freshness": {"max_age_seconds": 300},
            "existing_evidence_ids": [],
        },
    }

    result = invoke_bureau_agent(
        profile.department,
        profile.bureau,
        "decree",
        "route",
        lambda _messages: json.dumps(response),
        evidence_session=session,
    )

    assert "数据不足" in result
    assert "无法形成事实结论" in result


def test_investment_bureau_rejects_planned_fact_plan_without_a_draft(
    monkeypatch,
) -> None:
    session = AgentEvidenceSession(owner_user_id="test-owner", coordinator=object())
    captured: dict[str, object] = {}
    planned = FactPlanResult(FactPlanDisposition.PLANNED)

    def fake_compile(*, decree_text, node_id, entity_extractor):
        assert decree_text == "帮我看看比亚迪的股票价格"
        assert node_id == bureau_node_id("户部", "投资司")
        assert callable(entity_extractor)
        return planned

    def fake_invoke(**kwargs):
        captured.update(kwargs)
        return "已形成行情意见"

    monkeypatch.setattr(
        "app.agents.market_fact_plan.compile_mainland_last_price_plan",
        fake_compile,
    )
    monkeypatch.setattr(
        "app.agents.evidence_protocol.invoke_bureau_with_evidence",
        fake_invoke,
    )

    result = invoke_bureau_agent(
        "户部",
        "投资司",
        "帮我看看比亚迪的股票价格",
        "明确的中国大陆证券最新价查询，由投资司办理。",
        lambda _messages: pytest.fail("model is owned by the evidence adapter"),
        evidence_session=session,
    )

    assert "数据不足" in result
    assert captured == {}


def test_investment_bureau_rejected_plan_fails_with_only_stable_reason(
    monkeypatch,
) -> None:
    marker = "private-compiler-detail"

    monkeypatch.setattr(
        "app.agents.market_fact_plan.compile_mainland_last_price_plan",
        lambda **_kwargs: FactPlanResult(
            FactPlanDisposition.REJECTED,
            reason="entity_ambiguous",
        ),
    )

    with pytest.raises(BureauAgentInvocationError) as exc_info:
        invoke_bureau_agent(
            "户部",
            "投资司",
            "帮我看看该股票价格",
            "交投资司办理",
            lambda _messages: pytest.fail(marker),
            evidence_session=object(),
        )

    assert str(exc_info.value.__cause__) == "entity_ambiguous"
    assert marker not in str(exc_info.value)


@pytest.mark.parametrize(
    ("department", "bureau", "decree_text", "expected_calls"),
    [
        ("户部", "会计司", "生成2020至2025年财务报表", 1),
        ("户部", "会计司", "生成2020年会计报表", 1),
        ("户部", "会计司", "分析费用变化", 0),
        ("户部", "预算司", "生成财务报表", 0),
        ("工部", "技术司", "生成财务报表", 0),
    ],
)
def test_bureau_report_trigger_matrix(department, bureau, decree_text, expected_calls):
    calls = []

    class FakeSession:
        def maybe_generate(self, *args):
            calls.append(args)
            return None

    invoke_bureau_agent(
        department,
        bureau,
        decree_text,
        "判断",
        lambda _messages: '{"opinion":"完成"}',
        report_session=FakeSession(),
    )
    assert len(calls) == expected_calls


def test_bureau_appends_only_bounded_accounting_summary_to_prompt():
    captured = []
    raw_markers = ("RAW_ROW_7788", r"C:\private\ledger.xlsx", "客户甲", "PK\x03\x04")

    class FakeSession:
        raw_row = raw_markers[0]
        source_path = raw_markers[1]
        customer_name = raw_markers[2]
        workbook_bytes = raw_markers[3].encode()

        def maybe_generate(self, *_args):
            return "期间：2020-2025；收入合计：100；费用合计：20"

    def model(messages):
        captured.extend(messages)
        return '{"opinion":"完成"}'

    invoke_bureau_agent(
        "户部",
        "会计司",
        "生成2020至2025年财务报表",
        "判断",
        model,
        report_session=FakeSession(),
    )
    user_prompt = captured[1]["content"]
    assert "会计司确定性报表摘要" in user_prompt
    assert "期间：2020-2025；收入合计：100；费用合计：20" in user_prompt
    assert all(marker not in user_prompt for marker in raw_markers)
    all_messages = json.dumps(captured, ensure_ascii=False)
    assert all(marker not in all_messages for marker in raw_markers)


def test_accounting_summary_model_prompt_is_bounded_and_excludes_raw_material():
    raw_markers = ("RAW_ROW_7788", r"C:\private\ledger.xlsx", "客户甲", "PK\x03\x04")
    summary = AccountingReportSummary(
        period=ReportPeriod(2020, 2020),
        metrics_by_year={2020: {"revenue": Decimal("100")}},
        exceptions=tuple(f"exception-{index}" for index in range(1000)),
        checks=(ReportCheck("平衡检查", "PASS", "已平衡"),),
        source_ids=("source-hash-only",),
    )

    prompt = summary.to_model_prompt()

    assert len(prompt) <= 4000
    assert '"period":{"start_year":2020,"end_year":2020}' in prompt
    assert all(marker not in prompt for marker in raw_markers)
