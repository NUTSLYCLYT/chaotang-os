"""钦天监横切风险镜片 · 回归门(2026-07-07 · 三层递归架构第4步)。

钉死:UNKNOWN 剔出分母不渲染成安全、结构否决 OR-merge 不可被显式人选旁路、
veto=签字轴强制(不拦跑)、可证伪触发器永不为空、灯轴不被热度污染。
"""

from src import qintianjian_lens as qtj

# ── 热度旋钮:UNKNOWN 处理是本步骤核心修正 ────────────────────────────


def test_heat_known_signals_basic():
    heat = qtj.compute_cycle_heat(
        {
            "correlation_to_one": 1.0,
            "win_streak_danger": 1.0,
            "replication_accel": 1.0,
            "valuation_heat": 1.0,
            "evidence_deficit": 1.0,
        }
    )
    assert heat["score"] == 100 and heat["tier"] == "hot"
    # 会审后只剩唯一真接线旋钮
    assert heat["knobs"] == {"manual_gate_shift_down": True}


def test_heat_unknown_excluded_from_denominator():
    """TS 版把缺失压成 0=安全;本版剔出分母:唯一已知的高危信号不被未知稀释。"""
    heat = qtj.compute_cycle_heat({"correlation_to_one": 1.0})
    assert heat["score"] == 100, "未知不进分母,已知 1.0 应打满"
    assert heat["tier"] == "hot"
    assert len(heat["unknown_signals"]) == 4


def test_heat_all_unknown_is_conservative_not_safe():
    heat = qtj.compute_cycle_heat(None)
    assert heat["score"] is None
    assert heat["tier"] == "warm", "全未知不渲染成 normal/安全"
    # warm 是无知地板,不拉签字闸
    assert heat["knobs"]["manual_gate_shift_down"] is False


def test_heat_unknown_majority_floors_warm():
    """已知权重过半才允许 normal:只知一路低危(15/100)→ 地板 warm。"""
    heat = qtj.compute_cycle_heat({"valuation_heat": 0.0})
    assert heat["score"] == 0 and heat["tier"] == "warm"
    # 已知过半(25+25+20=70)且低危 → 允许 normal
    ok = qtj.compute_cycle_heat(
        {"correlation_to_one": 0.1, "win_streak_danger": 0.1, "replication_accel": 0.1}
    )
    assert ok["tier"] == "normal"


def test_streak_to_danger_saturates():
    assert qtj.streak_to_danger(0) == 0
    assert 0.6 < qtj.streak_to_danger(4) < 0.65
    assert qtj.streak_to_danger(100) < 1.0


# ── ruin 结构否决 OR-merge ───────────────────────────────────────────


def test_ruin_any_redline_vetoes():
    for key in ("irreversible_payment", "external_commitment"):
        r = qtj.assess_ruin([], {key: True})
        assert r["verdict"] == "veto" and len(r["redlines_hit"]) == 1
    assert qtj.assess_ruin([], {})["verdict"] == "pass"


def test_structural_veto_from_decision_guard_registry():
    """入口蜂群在 decision_guard 不可逆登记 → 结构否决(OR-merge 左支)。"""
    lens = qtj.qintianjian_lens({"entry_swarms": ["quotation", "opc"]})
    assert lens["verdict"] == "veto"
    assert lens["structural_irreversible"] == ["quotation"]
    assert any("结构不可逆" in r for r in lens["veto_reasons"])


def test_exposure_veto_without_structural():
    """结构干净但敞口红线命中 → 照样否决(OR-merge 右支)。"""
    lens = qtj.qintianjian_lens(
        {"entry_swarms": ["opc"]}, exposure={"external_commitment": True}
    )
    assert lens["verdict"] == "veto" and lens["structural_irreversible"] == []


def test_pass_when_clean():
    lens = qtj.qintianjian_lens({"entry_swarms": ["opc"]})
    assert lens["verdict"] == "pass"


def test_falsifiable_triggers_never_empty():
    """钦天监不算命:pass/veto 都必须带翻案条件。"""
    for lens in (
        qtj.qintianjian_lens({"entry_swarms": ["opc"]}),
        qtj.qintianjian_lens({"entry_swarms": ["quotation"]}),
    ):
        assert lens["falsifiable_triggers"], lens["verdict"]
    withdc = qtj.qintianjian_lens(
        {"entry_swarms": ["opc"]},
        death_conditions=[{"description": "单一客户占比>80%", "already_true": False}],
    )
    assert any("单一客户" in t for t in withdc["falsifiable_triggers"])


# ── 镜片信封:两轴纪律 ────────────────────────────────────────────────


def test_lens_envelope_axes():
    veto_env = qtj.lens_envelope(qtj.qintianjian_lens({"entry_swarms": ["quotation"]}))
    assert veto_env["light"] == "red" and veto_env["needs_sign"] is True

    pass_env = qtj.lens_envelope(qtj.qintianjian_lens({"entry_swarms": ["opc"]}))
    assert pass_env["light"] == "green" and pass_env["needs_sign"] is False
    # 热度未知只进不确定性文本,不染灯(防狼来了)
    assert "未知" in pass_env["uncertainty"]


def test_hot_forces_sign_without_reddening_light():
    """会审后唯一真旋钮:hot 档强制人签(签字轴),但灯轴不染红(灯=可信度,签=动作)。"""
    hot_signals = {
        "correlation_to_one": 1.0,
        "win_streak_danger": 1.0,
        "replication_accel": 1.0,
        "valuation_heat": 1.0,
        "evidence_deficit": 1.0,
    }
    lens = qtj.qintianjian_lens({"entry_swarms": ["opc"]}, signals=hot_signals)
    assert lens["verdict"] == "pass", "hot 不是 ruin,verdict 不变"
    env = qtj.lens_envelope(lens)
    assert env["needs_sign"] is True, "hot 档必须人过目——旋钮真接线"
    assert env["light"] == "green", "签字轴收紧不许染红灯轴"
    assert "逆周期收紧" in env["basis"]
