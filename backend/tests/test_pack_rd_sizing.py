"""pack_rd 确定性 sizing 求解器测试 — 钉住域常量与算术，防漂移。"""

from __future__ import annotations

from src.pack_rd_sizing import solve_pack_sizing


def test_storage_1mwh_lfp_deterministic():
    """储能 1MWh 默认场景：确定性串并/策略可复现。"""
    r = solve_pack_sizing({"application": "储能", "chemistry": "LFP"})
    assert r["recommended_series"] == 416  # round(1331.2/3.2)
    assert r["recommended_parallel"] == 2  # round((1000*1000/1331.2)/314)
    assert r["config_label"] == "2P416S"
    assert r["thermal"]["recommended_strategy"] == "簇级液冷板 + 箱级空调联动"


def test_storage_uses_314ah_cell():
    """储能 + LFP 用 314Ah 量产规格（_default_cell_capacity 特例）。"""
    r = solve_pack_sizing({"application": "储能", "chemistry": "LFP"})
    assert any("314Ah" in a for a in r["assumptions"])


def test_high_c_rate_triggers_thermal_constraint():
    """eVTOL 4C 高倍率 → 析锂窗口告警 + 大侧面液冷。"""
    r = solve_pack_sizing({"application": "eVTOL/航空", "chemistry": "NMC"})
    assert "析锂" in r["feasibility_note"]
    assert r["thermal"]["recommended_strategy"] == "大侧面液冷 + 底部兜底流道"


def test_unknown_chemistry_falls_back_to_未定():
    """未知化学体系不报错，落 未定 默认（3.2V），不静默崩。"""
    r = solve_pack_sizing({"application": "乘用车", "chemistry": "钠离子"})
    assert r["electrical"]["nominal_voltage_v"] > 0
    assert any("未定" in a for a in r["assumptions"])


def test_aggressive_cost_target_note():
    """成本目标 ≤0.4 ¥/Wh → 双供路径建议。"""
    r = solve_pack_sizing(
        {"application": "储能", "chemistry": "LFP", "cost_target_rmb_per_wh": 0.35}
    )
    assert "双路径" in r["feasibility_note"]
    assert any("0.35" in a for a in r["assumptions"])


def test_empty_input_does_not_crash():
    """空输入走全默认，返回结构完整。"""
    r = solve_pack_sizing({})
    assert "recommended_series" in r
    assert "electrical" in r and "thermal" in r


# ── 反作弊闸 run_sizing_gate 回归 ──
from src.pack_rd_sizing import run_sizing_gate  # noqa: E402

# 12V/1100Wh 户外储能；3.2V/100Ah 电芯 → 确定性 4S(round(12/3.2))/1P(round(91.7/100))。
_TASK = "电量1100Wh 户外储能，系统12V平台"


def _json(series_s, parallel_p, cell_cap=100, cell_v=3.2):
    fields = {
        "chemistry": "LFP",
        "cell_capacity_ah": cell_cap,
        "cell_nominal_v": cell_v,
        "series_S": series_s,
        "parallel_P": parallel_p,
        "c_rate": 0.2,
        "cell_unit_price": 50,
        "bom_total": 300,
        "target_wh": 1100,
    }
    import json as _J

    body = _J.dumps(
        {k: v for k, v in fields.items() if v is not None}, ensure_ascii=False
    )
    return f"```json\n{body}\n```"


def test_gate_consistent_config_passes():
    v, _ = run_sizing_gate(_json(4, 1), _TASK)
    assert v["seriesTruth"] == "PASS"
    assert v["parallelTruth"] == "PASS"
    assert v["green"] is True


def test_gate_fabricated_series_fails():
    """精算瞎报 100S（真 4S）→ FAIL，反作弊锚生效。"""
    v, _ = run_sizing_gate(_json(100, 1), _TASK)
    assert v["seriesTruth"] == "FAIL"
    assert v["green"] is False
    assert any("串数自报" in n for n in v["notes"])


def test_gate_parallel_checked_against_real_cell():
    """B 修复:agent 报了真电芯(100Ah)时,6P(真 1P)→ FAIL,按真电芯核非默认电芯。"""
    v, _ = run_sizing_gate(_json(4, 6, cell_cap=100), _TASK)
    assert v["parallelTruth"] == "FAIL"
    assert any("真电芯" in n for n in v["notes"])


def test_gate_no_cell_capacity_parallel_unknown_not_false_fail():
    """B 修复:agent 没报 cell_capacity_ah → 并数 UNKNOWN(不拿默认电芯误判 FAIL)。"""
    v, _ = run_sizing_gate(_json(4, 6, cell_cap=None), _TASK)
    assert v["seriesTruth"] == "PASS"
    assert v["parallelTruth"] == "UNKNOWN"
    assert any("无法用真电芯核并数" in n for n in v["notes"])


def test_gate_no_json_is_unknown_not_pass():
    """无 fenced JSON → UNKNOWN，禁假 PASS。"""
    v, _ = run_sizing_gate("纯文本无 json", _TASK)
    assert v["seriesTruth"] == "UNKNOWN"
    assert v["extracted"] is False
    assert v["green"] is False


def test_required_fields_rule_rejects_stub_json():
    """A 修复:残缺 JSON(只有 series_S/parallel_P)被 required_fields 规则打回。"""
    from src.output_linter import _check_required_fields

    rule = {
        "type": "required_fields",
        "fields": ['"chemistry"', '"cell_capacity_ah"', '"series_S"', '"parallel_P"'],
    }
    stub = '```json\n{"series_S":4,"parallel_P":6}\n```'
    issues = _check_required_fields(stub, rule, "")
    assert len(issues) == 2  # 缺 chemistry + cell_capacity_ah
    full = _json(4, 1)
    assert _check_required_fields(full, rule, "") == []
