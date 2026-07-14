"""编排底座落点 orchestration_plan · 回归门(2026-07-07 · 三层递归架构第1步)。

钉死:三层选择→执行计划喂唯一编排器(direct 单入口/junjichu 多入口/全弃权拒跑)、
EventBinding overlay 的 propose→质量门+人工门→enabled 生命周期、
新绑定先合全列表再过 governance(防绕过)、租户隔离。
"""

import pytest

import src.tenant as T
from src import orchestration_plan as op
from src.governance import GovernanceLevel, GovernanceRecord
from src.swarm_orchestrator import EventBinding

FULL_SET = {"finance", "quotation", "product", "legal", "opc", "tianjian", "sourcing"}


@pytest.fixture()
def tenant_tmp(tmp_path, monkeypatch):
    """overlay 落 tmp,测试租户 t_a(不碰真 data/)。"""
    monkeypatch.setattr(T, "DATA_ROOT", tmp_path)
    with T.tenant_context("t_a"):
        yield tmp_path


# ── 三层选择 → 执行计划 ──────────────────────────────────────────────


def test_direct_plan_single_entry():
    """单域直办密旨 → direct 计划,单入口喂 orch.run(entry_swarm=...)。
    (2026-07-14 阶段1收敛:改直办措辞;"帮我算…报价"在 loop 口径下带证据缺口判 junjichu)"""
    plan = op.build_plan("帮我整理这批储能柜的报价摘要", FULL_SET)
    assert plan["mode"] == "direct"
    assert len(plan["entry_swarms"]) == 1
    kwargs = op.plan_run_kwargs(plan)
    assert kwargs == {"entry_swarm": plan["entry_swarms"][0]}


def test_junjichu_plan_multi_entry_dedup():
    """跨域密旨 → junjichu 计划,各尚书选的蜂群去重保序,多入口喂 entry_swarms。"""
    plan = op.build_plan("帮我算报价并核对合同违约风险再排个交付计划", FULL_SET)
    assert plan["mode"] == "junjichu"
    assert len(plan["entry_swarms"]) == len(set(plan["entry_swarms"])), "入口必须去重"
    if len(plan["entry_swarms"]) > 1:
        assert op.plan_run_kwargs(plan) == {"entry_swarms": plan["entry_swarms"]}


def test_all_abstain_refuses_to_run():
    """全员弃权 → plan_run_kwargs 抛错让上游追问,不猜蜂群冒充选对。"""
    plan = {"mode": "junjichu", "entry_swarms": [], "abstained": [{"ministry": "x"}]}
    with pytest.raises(ValueError, match="弃权"):
        op.plan_run_kwargs(plan)


# ── 计划收口(2026-07-14):build_plan = 完整路由快照 ──────────────────


def test_plan_carries_tier_snapshot():
    """一次 build_plan = 红线+选路+双 tier 完整快照,新键齐全。"""
    plan = op.build_plan("帮我整理这批储能柜的报价摘要", FULL_SET)
    assert plan["orchestration_tier"]["tier"]
    assert plan["model_tier"]["tier"]
    assert plan["needs_compliance"] is False
    assert plan["route_matched"] is True
    assert plan["redline"] is None


def test_securities_with_compliance_landing_pins_direct():
    """证券红线命中且有合规落点(legal 在集合里)→ 钉死单入口 direct,不进三层分解。"""
    plan = op.build_plan("用公司现金流加仓这只股票", FULL_SET)
    assert plan["needs_compliance"] is False
    assert plan["mode"] == "direct"
    assert plan["entry_swarms"] == ["legal"]
    assert plan["ministries"] == []  # 没跑三层分解
    assert plan["redline"]["redline"] == "securities_advice"


def test_securities_without_compliance_landing_refuses():
    """证券红线无合规落点 → needs_compliance=True,空入口,调用方拒单。"""
    plan = op.build_plan("用公司现金流加仓这只股票", {"finance", "quotation", "opc"})
    assert plan["needs_compliance"] is True
    assert plan["entry_swarms"] == []
    with pytest.raises(ValueError):
        op.plan_run_kwargs(plan)


def test_record_routing_decision_persists_tier_fields(tenant_tmp):
    """routing_truth 账本记 tier/红线/matched 新字段。"""
    import json as _json

    plan = op.build_plan("帮我整理这批储能柜的报价摘要", FULL_SET)
    op.record_routing_decision(plan, "帮我整理这批储能柜的报价摘要", task_id="t1")
    line = (
        (tenant_tmp / "t_a" / "routing" / "decisions.jsonl")
        .read_text(encoding="utf-8")
        .strip()
        .splitlines()[-1]
    )
    rec = _json.loads(line)
    assert rec["orchestration_tier"] == plan["orchestration_tier"]["tier"]
    assert rec["model_tier"] == plan["model_tier"]["tier"]
    assert rec["route_matched"] is True
    assert rec["redline"] is None


# ── overlay 生命周期:propose → 质量门+人工门 → enabled ────────────────


def test_propose_stays_disabled(tenant_tmp):
    """丞相提议只落 proposed(enabled=False),运行时合并不带它。"""
    item = op.propose_binding("a_completed", "b", reason="补下游")
    assert item["status"] == "proposed" and item["enabled"] is False
    merged = op.merge_bindings_with_overlay([], {"a", "b"})
    assert merged == [], "proposed 未过双门,不得进有效绑定"


def test_confirm_requires_signer(tenant_tmp):
    """人工门:空 signer 拒绝(不代签、不默认通过)。"""
    item = op.propose_binding("a_completed", "b")
    with pytest.raises(ValueError, match="signer"):
        op.confirm_binding(
            item["id"], signer="", known_swarm_ids={"a", "b"}, existing_bindings=[]
        )


def test_confirm_requires_full_list_context(tenant_tmp):
    """approve 不带全量绑定上下文 → 拒(质量门必须合全列表,不做局部放行)。"""
    item = op.propose_binding("a_completed", "b")
    with pytest.raises(ValueError, match="全列表"):
        op.confirm_binding(item["id"], signer="老板")


def test_quality_gate_unknown_target(tenant_tmp):
    """质量门①:目标蜂群未注册 → 拒。"""
    item = op.propose_binding("a_completed", "ghost")
    with pytest.raises(ValueError, match="未注册"):
        op.confirm_binding(
            item["id"], signer="老板", known_swarm_ids={"a", "b"}, existing_bindings=[]
        )


def test_quality_gate_cycle_with_full_list(tenant_tmp):
    """质量门②:新绑定与既有静态绑定成环 → 拒(单看新绑定看不出,必须合全列表)。"""
    static = [EventBinding(topic="a_completed", target_swarm="b")]
    item = op.propose_binding("b_completed", "a")  # b→a + 既有 a→b = 环
    with pytest.raises(ValueError, match="校验失败"):
        op.confirm_binding(
            item["id"],
            signer="老板",
            known_swarm_ids={"a", "b"},
            existing_bindings=static,
        )


def test_quality_gate_suspended_target(tenant_tmp):
    """质量门③:治理 SUSPENDED 的蜂群不给接新绑定。"""
    item = op.propose_binding("a_completed", "b")
    gov = {
        "b": GovernanceRecord(
            swarm_id="b",
            level=GovernanceLevel.SUSPENDED,
            pass_rate=0.2,
            sample_count=10,
            irreversible_errors=1,
            updated_at="",
            reason="良率崩了",
        )
    }
    with pytest.raises(ValueError, match="SUSPENDED"):
        op.confirm_binding(
            item["id"],
            signer="老板",
            known_swarm_ids={"a", "b"},
            existing_bindings=[],
            gov_state=gov,
        )


def test_approve_then_merged_into_full_list(tenant_tmp):
    """双门通过 → enabled,运行时**先合进全列表**(静态+overlay)再交 governance。"""
    static = [EventBinding(topic="x_completed", target_swarm="a")]
    item = op.propose_binding("a_completed", "b", reason="打通 a→b")
    done = op.confirm_binding(
        item["id"],
        signer="老板",
        known_swarm_ids={"x", "a", "b"},
        existing_bindings=static,
        gov_state={},
    )
    assert done["status"] == "enabled" and done["signer"] == "老板"

    merged = op.merge_bindings_with_overlay(static, {"x", "a", "b"})
    assert len(merged) == 2
    assert merged[0] is static[0], "静态绑定原样保留"
    assert (merged[1].topic, merged[1].target_swarm) == ("a_completed", "b")


def test_reject_leaves_binding_dead(tenant_tmp):
    """人签驳回 → rejected,永不进有效绑定;留 signer+理由可追责。"""
    item = op.propose_binding("a_completed", "b")
    done = op.confirm_binding(
        item["id"], signer="老板", decision="reject", reason="没必要"
    )
    assert done["status"] == "rejected"
    assert op.merge_bindings_with_overlay([], {"a", "b"}) == []


def test_merge_failsafe_drops_overlay_on_drift(tenant_tmp):
    """fail-safe:静态配置事后漂移使合并成环 → 丢全部 overlay 回落纯静态(环=费用跑马)。"""
    item = op.propose_binding("b_completed", "a")
    op.confirm_binding(
        item["id"],
        signer="老板",
        known_swarm_ids={"a", "b"},
        existing_bindings=[],
        gov_state={},
    )  # 批准时无环
    drifted_static = [
        EventBinding(topic="a_completed", target_swarm="b")
    ]  # 事后加了 a→b
    merged = op.merge_bindings_with_overlay(drifted_static, {"a", "b"})
    assert merged == drifted_static, "成环时 overlay 必须全弃,回落纯静态"


def test_overlay_is_tenant_isolated(tenant_tmp):
    """租户 A 批准的绑定,租户 B 看不见(第0步a 隔离)。"""
    item = op.propose_binding("a_completed", "b")
    op.confirm_binding(
        item["id"],
        signer="老板",
        known_swarm_ids={"a", "b"},
        existing_bindings=[],
        gov_state={},
    )
    assert len(op.merge_bindings_with_overlay([], {"a", "b"})) == 1
    with T.tenant_context("t_b"):
        assert op.merge_bindings_with_overlay([], {"a", "b"}) == []
        assert op.list_bindings() == []


def test_confirm_rejects_irreversible_target(tenant_tmp):
    """会审(Schneier):不可逆蜂群禁做自动触发目标——侧门焊死,自动链上无人签字。"""
    item = op.propose_binding("a_completed", "quotation")
    with pytest.raises(ValueError, match="不可逆"):
        op.confirm_binding(
            item["id"],
            signer="老板",
            known_swarm_ids={"a", "quotation"},
            existing_bindings=[],
            gov_state={},
        )


def test_bindings_closure_bfs():
    """闭包:入口经 *_completed 绑定可自动触达的蜂群全集(含入口,禁用边不算)。"""
    binds = [
        EventBinding(topic="a_completed", target_swarm="b"),
        EventBinding(topic="b_completed", target_swarm="quotation"),
        EventBinding(topic="a_completed", target_swarm="dead", enabled=False),
        EventBinding(topic="x_completed", target_swarm="y"),
    ]
    reach = op.bindings_closure(["a"], binds)
    assert reach == ["a", "b", "quotation"], "两跳可达且不含禁用边/无关边"


def test_lens_vetoes_irreversible_via_binding_chain():
    """镜片结构否决看闭包:不可逆蜂群在自动链第二跳也拉签字轴(不可被一跳绕过)。"""
    from src.qintianjian_lens import qintianjian_lens

    lens = qintianjian_lens(
        {"entry_swarms": ["opc"], "reachable_swarms": ["opc", "product", "quotation"]}
    )
    assert lens["verdict"] == "veto"
    assert any("经自动绑定链可达" in r for r in lens["veto_reasons"])
