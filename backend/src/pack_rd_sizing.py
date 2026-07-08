"""pack_rd 确定性 sizing 求解器 (no-LLM)。

来源：从 legal-agent battery_pack/tools/solver.py 移植核心域逻辑（2026-06-23 融入主线）。
定位：与 src/pack_rd_cost_validator.validate_bom 同范式——确定性、不许 LLM 自评算术。
    成本闸"验数"，本模块"算配置"：给定 target kWh/电压/倍率 → 确定性算出串并/电流/热损，
    供精算 agent 与成本确定性闸消费（先确定性 sizing → 再确定性成本，全链可复现）。

铁律对齐：
- 化学体系标称电压取真值表，禁硬编 ×3.7（cell_library 41% 是 3.2V LFP，硬编会误算 LFP）。
- 抽不出/未指定字段走 application 默认，default 显式列入 assumptions，不静默冒充用户输入。

输入 d（精算 agent 或上游 dict）：
  application(应用场景), chemistry(化学体系), [target_kwh], [target_voltage_v],
  [target_c_rate], [target_power_kw], [cost_target_rmb_per_wh]
返回 dict：recommended_series/parallel, electrical{...}, thermal{...},
  feasibility_note, assumptions[]
"""

from __future__ import annotations

# 化学体系标称参数（真值表，禁硬编 ×3.7）。
CHEMISTRY_DEFAULTS = {
    "LFP": {"cell_voltage_v": 3.2, "cell_capacity_ah": 180.0, "efficiency": 0.975},
    "LMFP": {"cell_voltage_v": 3.4, "cell_capacity_ah": 160.0, "efficiency": 0.972},
    "NMC": {"cell_voltage_v": 3.7, "cell_capacity_ah": 110.0, "efficiency": 0.968},
    "NCA": {"cell_voltage_v": 3.65, "cell_capacity_ah": 95.0, "efficiency": 0.968},
    "未定": {"cell_voltage_v": 3.2, "cell_capacity_ah": 180.0, "efficiency": 0.972},
}

# 应用场景默认（电压 V / 容量 kWh / 倍率 C）。
_APP_VOLTAGE = {
    "乘用车": 800.0,
    "商用车": 600.0,
    "两轮车": 48.0,
    "储能": 1331.2,
    "3C/工具": 21.6,
    "eVTOL/航空": 800.0,
    "船舶": 800.0,
}
_APP_KWH = {
    "乘用车": 75.0,
    "商用车": 280.0,
    "两轮车": 1.5,
    "储能": 1000.0,
    "3C/工具": 0.3,
    "eVTOL/航空": 120.0,
    "船舶": 350.0,
}
_APP_C_RATE = {
    "乘用车": 2.0,
    "商用车": 1.5,
    "两轮车": 1.5,
    "储能": 0.5,
    "3C/工具": 2.0,
    "eVTOL/航空": 4.0,
    "船舶": 1.0,
}


def _default_voltage(application: str) -> float:
    return _APP_VOLTAGE.get(application, 400.0)


def _default_kwh(application: str) -> float:
    return _APP_KWH.get(application, 50.0)


def _default_c_rate(application: str) -> float:
    return _APP_C_RATE.get(application, 1.0)


def _default_cell_capacity(application: str, chemistry: str, fallback: float) -> float:
    if application == "储能" and chemistry in {"LFP", "LMFP", "未定"}:
        return 314.0
    if application == "乘用车" and chemistry in {"LFP", "LMFP"}:
        return 150.0
    return fallback


def _continuous_current_ratio(application: str) -> float:
    return 0.7 if application in {"储能", "船舶"} else 0.55


def _band(center: int, width: int) -> str:
    low = max(1, center - width)
    high = max(low, center + width)
    return f"{low}-{high}"


def _recommended_strategy(application: str, target_c_rate: float) -> str:
    if application == "储能":
        return "簇级液冷板 + 箱级空调联动"
    if target_c_rate >= 3.0:
        return "大侧面液冷 + 底部兜底流道"
    return "底部液冷板主回路"


def _build_feasibility_note(
    target_c_rate: float,
    target_voltage_v: float,
    peak_current_a: float,
    cost_target_rmb_per_wh: float | None,
) -> str:
    note = f"{int(target_voltage_v)}V 平台下峰值电流约 {peak_current_a:.0f}A。"
    if target_c_rate >= 3.0:
        note += " 已进入高倍率区，必须把热管理和析锂窗口当作先决约束。"
    else:
        note += " 倍率压力可控，优先优化成本与一致性。"
    if cost_target_rmb_per_wh is not None and cost_target_rmb_per_wh <= 0.4:
        note += " 成本目标较激进，建议默认主供+二供双路径。"
    return note


def solve_pack_sizing(d: dict) -> dict:
    """确定性 PACK sizing。输入/输出均为 dict（对齐 pack_rd_cost_validator 风格）。"""
    application = str(d.get("application") or "")
    chemistry = (
        d.get("chemistry") if d.get("chemistry") in CHEMISTRY_DEFAULTS else "未定"
    )
    defaults = CHEMISTRY_DEFAULTS[chemistry]

    target_kwh = float(d.get("target_kwh") or _default_kwh(application))
    target_voltage_v = float(d.get("target_voltage_v") or _default_voltage(application))
    target_c_rate = float(d.get("target_c_rate") or _default_c_rate(application))
    target_power_kw = float(
        d.get("target_power_kw") or round(target_kwh * target_c_rate, 1)
    )
    cost_target = d.get("cost_target_rmb_per_wh")
    cost_target = float(cost_target) if cost_target is not None else None

    # 电芯参数优先用调用方/精算实际选型（d 提供时），否则落化学体系默认。
    # 反作弊关键：用 agent 自己报的电芯算基线，才是核「它的串并是否自洽」而非「是否选了我默认的电芯」。
    cell_capacity_ah = (
        float(d["cell_capacity_ah"])
        if d.get("cell_capacity_ah")
        else _default_cell_capacity(
            application, chemistry, defaults["cell_capacity_ah"]
        )
    )
    cell_voltage_v = (
        float(d["cell_nominal_v"])
        if d.get("cell_nominal_v")
        else float(defaults["cell_voltage_v"])
    )
    recommended_series = max(1, round(target_voltage_v / cell_voltage_v))
    pack_capacity_ah = max(1.0, target_kwh * 1000 / target_voltage_v)
    recommended_parallel = max(1, round(pack_capacity_ah / cell_capacity_ah))

    peak_current_a = round(target_power_kw * 1000 / target_voltage_v, 1)
    continuous_current_a = round(
        peak_current_a * _continuous_current_ratio(application), 1
    )
    heat_loss_kw = round(target_power_kw * (1 - defaults["efficiency"]), 2)
    cooling_load_kw = round(heat_loss_kw * 1.2, 2)

    assumptions = [
        f"默认化学体系按 {chemistry} 标称电压 {cell_voltage_v}V 计算",
        f"单体容量按 {cell_capacity_ah:.0f}Ah 级别主流量产规格估算",
        f"峰值功率按 {target_power_kw:.1f}kW，目标倍率按 {target_c_rate:.1f}C 处理",
    ]
    if cost_target is not None:
        assumptions.append(f"成本目标按 ¥{cost_target:.2f}/Wh 评估可行性")

    return {
        "recommended_series": recommended_series,
        "recommended_parallel": recommended_parallel,
        "electrical": {
            "nominal_voltage_v": round(recommended_series * cell_voltage_v, 1),
            "series_range": _band(recommended_series, 2),
            "parallel_range": _band(
                recommended_parallel, 1 if recommended_parallel <= 4 else 2
            ),
            "pack_capacity_ah": round(pack_capacity_ah, 1),
            "peak_current_a": peak_current_a,
            "continuous_current_a": continuous_current_a,
        },
        "thermal": {
            "estimated_heat_kw": heat_loss_kw,
            "cooling_load_kw": cooling_load_kw,
            "recommended_strategy": _recommended_strategy(application, target_c_rate),
        },
        "feasibility_note": _build_feasibility_note(
            target_c_rate, target_voltage_v, peak_current_a, cost_target
        ),
        "assumptions": assumptions,
        "config_label": f"{recommended_parallel}P{recommended_series}S",
    }


# ── sizing 确定性闸接口 (供 flow_engine step_type: sizing 调) ───────────────────
# 与 pack_rd_cost_validator 同范式：既给确定性基线，又当反作弊锚——
# 精算 agent 自报的 series_S/parallel_P 必须和本模块确定性算出的对得上，偏差超带宽即 FAIL。

PASS, FAIL, UNKNOWN = "PASS", "FAIL", "UNKNOWN"

_APP_KEYWORDS = {
    "储能": "储能",
    "乘用车": "乘用车",
    "商用车": "商用车",
    "两轮": "两轮车",
    "eVTOL": "eVTOL/航空",
    "航空": "eVTOL/航空",
    "船": "船舶",
    "3C": "3C/工具",
}


def _parse_application(task: str) -> str:
    for kw, app in _APP_KEYWORDS.items():
        if kw in (task or ""):
            return app
    return ""


def run_sizing_gate(presale_output: str, task_input: str) -> tuple[dict, str]:
    """business_step 入口：抽精算 JSON + 锚 spec 真值 → 确定性 sizing + 反作弊核对。

    verdict {seriesTruth, parallelTruth, deterministic, claimed, deviations, notes,
             green, extracted}。抽不到 JSON → UNKNOWN(禁假 PASS)。
    """
    try:
        from src.pack_rd_cost_validator import extract_fenced_json, parse_spec_truth
    except ImportError as exc:  # noqa: BLE001
        v = {
            "seriesTruth": UNKNOWN,
            "parallelTruth": UNKNOWN,
            "green": False,
            "extracted": False,
            "notes": [f"依赖不可用：{exc}"],
        }
        return v, render_sizing_verdict(v)

    spec = parse_spec_truth(task_input)
    d = extract_fenced_json(presale_output)
    if d is None:
        v = {
            "seriesTruth": UNKNOWN,
            "parallelTruth": UNKNOWN,
            "deterministic": {},
            "claimed": {},
            "deviations": {},
            "green": False,
            "extracted": False,
            "notes": ["精算输出未含可解析 fenced JSON → sizing 闸 UNKNOWN，禁假 PASS"],
        }
        return v, render_sizing_verdict(v)

    # 真值锚优先：电压用 spec nominalV，电量用 spec targetWh（非 agent 自填）。
    target_voltage_v = (
        spec.get("nominalV")
        or (d.get("cell_nominal_v", 0) or 0) * (d.get("series_S") or 0)
        or None
    )
    target_wh = spec.get("targetWh") or d.get("system_energy_wh") or d.get("target_wh")
    sizing_input = {
        "application": _parse_application(
            task_input + " " + str(d.get("application", ""))
        ),
        "chemistry": d.get("chemistry"),
        "target_voltage_v": target_voltage_v,
        "target_kwh": (float(target_wh) / 1000) if target_wh else None,
        "target_c_rate": d.get("c_rate"),
        # 反作弊用 agent 自报电芯算基线(B 修复)；缺则 solver 落默认,但并数检查会另标 UNKNOWN。
        "cell_capacity_ah": d.get("cell_capacity_ah"),
        "cell_nominal_v": d.get("cell_nominal_v"),
    }
    det = solve_pack_sizing(sizing_input)
    has_real_cell = bool(d.get("cell_capacity_ah"))

    claimed_s = d.get("series_S")
    claimed_p = d.get("parallel_P")
    notes: list[str] = []
    series_truth = parallel_truth = UNKNOWN
    deviations: dict = {}

    if claimed_s is not None:
        dev_s = abs(int(claimed_s) - det["recommended_series"])
        deviations["series"] = dev_s
        series_truth = PASS if dev_s <= 2 else FAIL
        if series_truth == FAIL:
            notes.append(
                f"串数自报 {claimed_s}S 与确定性 {det['recommended_series']}S 差 {dev_s}（带宽±2）→ 疑算术/电压不自洽"
            )
    else:
        notes.append("精算 JSON 缺 series_S，串数无法核（标 UNKNOWN）")

    if claimed_p is None:
        notes.append("精算 JSON 缺 parallel_P，并数无法核（标 UNKNOWN）")
    elif not has_real_cell:
        # B 修复:agent 没报 cell_capacity_ah → 基线只能用默认电芯,据此判 FAIL 会误报。
        # 标 UNKNOWN 并要求补字段,不拿默认电芯冤枉正确配置。
        parallel_truth = UNKNOWN
        deviations["parallel"] = None
        notes.append(
            "精算 JSON 缺 cell_capacity_ah，无法用真电芯核并数（标 UNKNOWN，禁用默认电芯误判）"
        )
    else:
        band = 1 if det["recommended_parallel"] <= 4 else 2
        dev_p = abs(int(claimed_p) - det["recommended_parallel"])
        deviations["parallel"] = dev_p
        parallel_truth = PASS if dev_p <= band else FAIL
        if parallel_truth == FAIL:
            notes.append(
                f"并数自报 {claimed_p}P 与确定性 {det['recommended_parallel']}P 差 {dev_p}（带宽±{band}，按真电芯 {d.get('cell_capacity_ah')}Ah）→ 串并与电芯容量不自洽"
            )

    green = series_truth == PASS and parallel_truth == PASS
    v = {
        "seriesTruth": series_truth,
        "parallelTruth": parallel_truth,
        "deterministic": {
            "series": det["recommended_series"],
            "parallel": det["recommended_parallel"],
            "config_label": det["config_label"],
            "electrical": det["electrical"],
            "thermal": det["thermal"],
            "feasibility_note": det["feasibility_note"],
        },
        "claimed": {"series_S": claimed_s, "parallel_P": claimed_p},
        "deviations": deviations,
        "green": green,
        "extracted": True,
        "notes": notes,
    }
    return v, render_sizing_verdict(v)


def render_sizing_verdict(v: dict) -> str:
    flag = {PASS: "✅PASS", FAIL: "❌FAIL", UNKNOWN: "⚠️UNKNOWN"}
    head = "🟢sizing 自洽放行" if v.get("green") else "🔴sizing 未全绿(见下)"
    lines = [
        "",
        "### PACK sizing 确定性闸（机器判定，串并非 LLM 自评）",
        f"总判: {head}" + ("" if v.get("extracted") else "（精算 JSON 未解析）"),
    ]
    det = v.get("deterministic") or {}
    if det:
        lines.append(
            f"- 确定性基线: {det.get('config_label', '?')}"
            f"（{det.get('electrical', {}).get('nominal_voltage_v', '?')}V）"
        )
        lines.append(
            f"- 串数核: {flag.get(v.get('seriesTruth'), '?')}  "
            f"并数核: {flag.get(v.get('parallelTruth'), '?')}"
        )
        if det.get("feasibility_note"):
            lines.append(f"- 可行性: {det['feasibility_note']}")
    for n in v.get("notes", []):
        lines.append(f"- ⚠ {n}")
    return "\n".join(lines)
