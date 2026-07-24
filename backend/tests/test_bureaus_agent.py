"""Offline coverage for the immutable bureau registry and generic agent."""

from __future__ import annotations

import json
from collections import Counter
from dataclasses import FrozenInstanceError, fields

import pytest

from app.agents.bureaus import (
    BUREAU_PROFILES,
    BureauAgentInvocationError,
    BureauProfile,
    bureau_profile_for,
    bureau_profiles_for,
    bureau_system_prompt,
    invoke_bureau_agent,
)
from app.agents.evidence_protocol import AgentEvidenceSession, bureau_node_id
from app.agents.evidence_rendering import render_mainland_last_price
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


def test_investment_bureau_declares_market_quote_capability() -> None:
    profile = next(
        item for item in bureau_profiles_for("户部") if item.bureau == "投资司"
    )

    assert "证券行情" in profile.responsibilities
    assert "股票价格" in profile.responsibilities


def test_all_six_rites_bureaus_are_open_and_use_the_same_prompt_mechanism():
    rites = bureau_profiles_for("礼部")
    assert tuple(item.bureau for item in rites) == EXPECTED_BUREAUS["礼部"]
    assert len(rites) == 6
    for profile in rites:
        prompt = bureau_system_prompt("礼部", profile.bureau)
        assert "1.0" not in prompt
        assert "暂不开放" not in prompt
        assert NO_IRREVERSIBLE_ACTION_CONSTRAINT in prompt


def test_no_bureau_prompt_contains_a_release_gate():
    for profile in BUREAU_PROFILES:
        prompt = bureau_system_prompt(profile.department, profile.bureau)
        assert "1.0" not in prompt
        assert "暂不开放" not in prompt
        assert "enabled" not in prompt
        assert "version" not in prompt


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
def test_profile_lookup_and_prompt_reject_unknown_or_cross_department_identity(
    department, bureau
):
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

    def fake_model(messages: list[dict[str, str]]) -> str:
        captured.extend(messages)
        return '{"opinion": "  建议先核查合同授权链。  "}'

    result = invoke_bureau_agent(
        "刑部", "合同司", "审查客户合同", "合同事项交合同司", fake_model
    )

    assert result == "建议先核查合同授权链。"
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
def test_invoke_rejects_unknown_and_cross_department_with_sanitized_cause(
    department, bureau
):
    marker = "secret-decree-must-not-leak"
    with pytest.raises(BureauAgentInvocationError) as exc_info:
        invoke_bureau_agent(
            department, bureau, marker, marker, lambda _messages: '{"opinion":"x"}'
        )
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


def test_session_enabled_bureau_alone_receives_evidence_protocol_prompt():
    class Coordinator:
        def investigate(self, *_args, **_kwargs):
            raise AssertionError("legacy-ready bureau must not investigate")

    captured: list[list[dict[str, str]]] = []

    def fake_model(messages: list[dict[str, str]]) -> str:
        captured.append(messages)
        return (
            '{"status":"READY","result":{"opinion":"建议继续办理","factual_claims":[]},'
            '"adopted_evidence_ids":[],"fact_basis":"NOT_REQUIRED"}'
        )

    session = AgentEvidenceSession(coordinator=Coordinator())
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
    assert "NEEDS_DATA" in captured[0][0]["content"]
    assert "READY" in captured[0][0]["content"]
    assert "fact_basis" in captured[0][0]["content"]
    assert bureau_node_id(profile.department, profile.bureau) in captured[0][0]["content"]
    assert "required_facts" in captured[0][0]["content"]
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
        assert market_metric in captured[0][0]["content"]
    assert '"market_metric":"LAST_PRICE"' in captured[0][0]["content"]
    assert "all other categories require JSON null" in captured[0][0]["content"]
    assert session.snapshot().used is False


def test_evidence_fallback_says_data_is_insufficient_without_factual_conclusion():
    class UnavailableCoordinator:
        def investigate(self, *_args, **_kwargs):
            raise AssertionError("unexpected coordinator call")

    class ExhaustedSession(AgentEvidenceSession):
        def claim_investigation(self, _node_id):
            return False

    profile = BUREAU_PROFILES[0]
    session = ExhaustedSession(coordinator=UnavailableCoordinator())
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


def test_investment_bureau_attaches_only_planned_mainland_last_price_plan(
    monkeypatch,
) -> None:
    session = object()
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

    assert result == "已形成行情意见"
    assert captured["fact_plan"] is planned
    assert captured["evidence_renderer"] is render_mainland_last_price


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
