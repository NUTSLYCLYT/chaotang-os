"""pack_rd 成本确定性闸 (no-LLM)。

会审 v3 落地：算术不许 LLM 自评，精算只"选数"、本模块"验数"。
铁律：
- 电压取 cell_library 真值，禁硬编 ×3.7（Karpathy：库里 41% 是 3.2V LFP，硬编会假杀正确 LFP）。
- 真值锚 spec 字符串，不信 agent 自填 target_wh（Deming：否则只是验它自己的草稿）。
- 价按化学体系 join battery_prices.yaml（Schneier/Recon：cell_library 无价）。
- 抽不出字段标 UNKNOWN，不假装 PASS（抄 scripts/pack_rd_check.py 三态纪律）。
- cell_model 不在真值库即 FAIL，禁静默回退（铁律2）。

输入 d = 精算 agent 输出的 fenced JSON dict：
  cell_model, chemistry, cell_capacity_ah, cell_nominal_v, series_S, parallel_P,
  cell_weight_g, cell_unit_price, price_source, bms_price, structure_price,
  c_rate, bom_total, [target_wh], [cell_count], [system_energy_wh]
spec_truth = {"nominalV": 12, "targetWh": 1100}（从 spec 字符串解析，非 agent 自填）
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PHYS_LIB_PATH = ROOT / "config/eval/cell_library.json"
PRICE_YAML_PATH = ROOT / "knowledge/battery_prices.yaml"

PASS, FAIL, UNKNOWN = "PASS", "FAIL", "UNKNOWN"


def load_phys_lib(path: Path = PHYS_LIB_PATH) -> list:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def load_price_data(path: Path = PRICE_YAML_PATH) -> dict:
    import yaml

    return yaml.safe_load(Path(path).read_text(encoding="utf-8"))


def _dev(a: float, b: float) -> float:
    return abs(a - b) / b if b else float("inf")


def _find_cell(phys_lib: list, model) -> dict | None:
    if not model:
        return None
    target = str(model).strip().lower()
    for c in phys_lib:
        if str(c.get("model", "")).strip().lower() == target:
            return c
    return None


def _chem_price_band(chemistry: str | None, cap_ah: float | None, price_data: dict):
    """按化学体系 join battery_prices.cell_price_benchmark → (low_ppa, high_ppa, source) 或 None。"""
    bench = (price_data or {}).get("cell_price_benchmark", {}).get("by_chemistry", [])

    def pick(keyword: str):
        for e in bench:
            if keyword in e.get("chemistry", ""):
                if "price_per_ah" in e:
                    v = float(e["price_per_ah"])
                    return (v, v, e.get("source", ""))
                if "price_per_ah_range" in e:
                    lo, hi = (float(x) for x in str(e["price_per_ah_range"]).split("-"))
                    return (lo, hi, e.get("source", ""))
        return None

    s = chemistry or ""
    if "LFP" in s or "磷酸铁锂" in s:
        # 小容量量产线(9.32) vs 大容量储能(区间)，按容量分流
        if cap_ah is not None and cap_ah < 50:
            r = pick("小容量")
            if r:
                return r
        return pick("大容量") or pick("磷酸铁锂")
    if "NCM" in s or "三元" in s:
        return pick("三元") or pick("NCM")
    if "LTO" in s or "钛酸锂" in s:
        return pick("钛酸锂") or pick("LTO")
    return None


def validate_bom(
    d: dict, phys_lib=None, price_data=None, spec_truth=None, tol: float = 0.05
) -> dict:
    phys_lib = phys_lib if phys_lib is not None else load_phys_lib()
    price_data = price_data if price_data is not None else load_price_data()
    spec_truth = spec_truth or {}
    notes: list[str] = []
    res = {
        "c1": UNKNOWN,
        "c7": UNKNOWN,
        "priceTruth": UNKNOWN,
        "specTruth": UNKNOWN,
        "deviations": {},
        "notes": notes,
    }

    # ── 真值库定位 (铁律2: 不在库即 FAIL, 禁静默回退) ──
    cell = _find_cell(phys_lib, d.get("cell_model"))
    if cell is None:
        notes.append(f"cell_model={d.get('cell_model')!r} 不在电芯真值库 → 禁静默回退")
        res["c1"] = res["priceTruth"] = FAIL
        return res
    v_true = float(cell["voltage_v"])  # 真电压, 不硬编 3.7
    cap_true = float(cell["capacity_mah"]) / 1000.0
    ed = cell.get("energy_density_whkg")

    S, P = d.get("series_S"), d.get("parallel_P")
    if not S or not P:
        notes.append("缺 series_S/parallel_P → UNKNOWN, 不假装 PASS")
        return res
    S, P = int(S), int(P)

    c1_fail = False
    # ── JSON↔库 一致性 (防硬编3.7 / JSON-散文双套数) ──
    jv = d.get("cell_nominal_v")
    if jv is not None and abs(float(jv) - v_true) > 0.05:
        c1_fail = True
        notes.append(f"JSON标称电压 {jv}V ≠ 库真值 {v_true}V (疑硬编3.7/双套数)")
    jc = d.get("cell_capacity_ah")
    if jc is not None and _dev(float(jc), cap_true) > tol:
        c1_fail = True
        notes.append(f"JSON容量 {jc}Ah ≠ 库 {cap_true}Ah")

    energy = cap_true * S * P * v_true  # 真电压
    current = float(d.get("c_rate", 0)) * P * cap_true
    res["deviations"]["energy_wh"] = round(energy, 1)
    res["deviations"]["current_a"] = round(current, 1)

    # ── spec 真值锚 (Deming: 不信 agent 自填 target_wh) ──
    tgt, nomV = spec_truth.get("targetWh"), spec_truth.get("nominalV")
    spec_ok = True
    if tgt:
        if _dev(energy, tgt) > tol:
            spec_ok = False
            notes.append(f"能量 {energy:.0f}Wh 偏离 spec 目标 {tgt}Wh > {tol:.0%}")
        at = d.get("target_wh")
        if at is not None and _dev(float(at), tgt) > tol:
            spec_ok = False
            notes.append(f"agent 自填 target_wh={at} 偏离 spec {tgt} (投毒/漂移)")
    if nomV and _dev(S * v_true, nomV) > 0.12:
        spec_ok = False
        notes.append(f"系统电压 {S * v_true:.1f}V 偏离 spec {nomV}V")
    res["specTruth"] = PASS if spec_ok else FAIL

    # ── 重量真值锚 (energy_density 反推) ──
    weight_ok = True
    if ed and d.get("cell_weight_g"):
        truth_w = (cap_true * v_true / float(ed)) * 1000
        res["deviations"]["truth_cell_weight_g"] = round(truth_w, 1)
        if _dev(float(d["cell_weight_g"]), truth_w) > 0.15:
            weight_ok = False
            notes.append(f"单体重 {d['cell_weight_g']}g 偏离反推真值 {truth_w:.0f}g")

    # ── 价真值 (按化学体系 join) ──
    band = _chem_price_band(d.get("chemistry"), cap_true, price_data)
    if band is None:
        notes.append(f"化学体系 {d.get('chemistry')!r} 无法定位单价基准 → UNKNOWN")
    elif d.get("cell_unit_price") is None:
        notes.append("缺 cell_unit_price → UNKNOWN")
    else:
        lo, hi, _src = band
        exp_lo, exp_hi = cap_true * lo * 0.85, cap_true * hi * 1.15
        up = float(d["cell_unit_price"])
        res["deviations"]["price_band"] = [round(exp_lo, 1), round(exp_hi, 1)]
        res["priceTruth"] = PASS if exp_lo <= up <= exp_hi else FAIL
        if res["priceTruth"] == FAIL:
            notes.append(f"单价 {up}元 不在化学体系真值带 [{exp_lo:.0f},{exp_hi:.0f}]")
        if not d.get("price_source"):
            notes.append("缺 price_source[来源:] 注记 (C3)")

    # ── ΣBOM 闭合 ──
    bom_ok = True
    if d.get("bom_total"):
        calc = (
            S * P * float(d.get("cell_unit_price", 0))
            + float(d.get("bms_price", 0))
            + float(d.get("structure_price", 0))
        )
        res["deviations"]["bom_calc"] = round(calc, 1)
        if _dev(calc, float(d["bom_total"])) > tol:
            bom_ok = False
            notes.append(f"ΣBOM 复算 {calc:.0f} 偏离申报 {d['bom_total']} > {tol:.0%}")
    else:
        bom_ok = False
        notes.append("缺 bom_total")

    # ── C7: 电芯总数 = S×P ──
    cc = d.get("cell_count")
    res["c7"] = FAIL if (cc is not None and int(cc) != S * P) else PASS
    if res["c7"] == FAIL:
        notes.append(f"cell_count {cc} ≠ S×P {S * P}")

    # ── C1 数字勾稽 (内部自洽: JSON↔库 + 重量 + ΣBOM; 不含 spec 匹配, 那是 specTruth) ──
    res["c1"] = FAIL if (c1_fail or not weight_ok or not bom_ok) else PASS
    return res


def is_green(res: dict) -> bool:
    """整体放行: 四闸全 PASS (UNKNOWN 不算放行)。"""
    return all(res.get(k) == PASS for k in ("c1", "c7", "priceTruth", "specTruth"))


# ── 闸接口: 抽 fenced JSON / 锚 spec 真值 / 渲染 verdict (供 flow_engine business_step 调) ──
import re  # noqa: E402


def extract_fenced_json(text: str) -> dict | None:
    """从精算 agent 输出抽 fenced JSON dict。

    优先 ```json ... ``` 围栏，其次裸 {...}。抽不到/解析失败 → None(交由上层标 UNKNOWN，
    禁静默回退成假 PASS，抄 pack_rd_check.py 三态纪律)。
    """
    if not text:
        return None
    candidates: list[str] = []
    for m in re.finditer(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL):
        candidates.append(m.group(1))
    # 无围栏时退而求其次：取最后一个看起来含 cell_model 的大括号块
    if not candidates:
        for m in re.finditer(r"\{[^{}]*cell_model[^{}]*\}", text, re.DOTALL):
            candidates.append(m.group(0))
    for blob in reversed(candidates):  # 最后一个通常是定稿
        try:
            d = json.loads(blob)
            if isinstance(d, dict):
                return d
        except (json.JSONDecodeError, ValueError):
            continue
    return None


def parse_spec_truth(task: str) -> dict:
    """从 spec/工单字符串解析 {nominalV, targetWh}(真值锚，非 agent 自填，Deming)。

    复用 scripts/pack_rd_check.py 同款正则口径：电量 Wh 直取，否则 Ah×V 推算；电压平台直取。
    解析不出的字段缺省(不写 None 进 dict)，让 validate_bom 对缺项跳过该维度而非假判。
    """
    spec: dict = {}
    if not task:
        return spec
    mwh = re.search(r"电量[^\d]{0,4}(\d+(?:\.\d+)?)\s*Wh", task) or re.search(
        r"(\d+(?:\.\d+)?)\s*Wh", task
    )
    wh = float(mwh.group(1)) if mwh else None
    mv = re.search(r"(\d+(?:\.\d+)?)\s*V(?![a-zA-Z])", task)
    v = float(mv.group(1)) if mv else None
    if wh is None and v:
        mah = re.search(r"(\d+(?:\.\d+)?)\s*Ah", task)
        if mah:
            wh = float(mah.group(1)) * v
    if wh is not None:
        spec["targetWh"] = wh
    if v is not None:
        spec["nominalV"] = v
    return spec


def run_cost_gate(
    presale_output: str,
    task_input: str,
    phys_lib=None,
    price_data=None,
) -> tuple[dict, str]:
    """business_step 入口：抽精算 JSON + 锚 spec 真值 → validate_bom → (verdict, 渲染文本)。

    verdict 形如 {c1,c7,priceTruth,specTruth,deviations,notes,green,extracted,spec_truth}。
    抽不到 JSON → 全闸 UNKNOWN(不假装 PASS)。文本供 final_output["系统BOM汇总"]末尾追加。
    """
    spec_truth = parse_spec_truth(task_input)
    d = extract_fenced_json(presale_output)
    if d is None:
        verdict = {
            "c1": UNKNOWN,
            "c7": UNKNOWN,
            "priceTruth": UNKNOWN,
            "specTruth": UNKNOWN,
            "deviations": {},
            "notes": ["精算输出未含可解析 fenced JSON → 全闸 UNKNOWN，禁假 PASS"],
            "green": False,
            "extracted": False,
            "spec_truth": spec_truth,
        }
        return verdict, render_cost_verdict(verdict)
    res = validate_bom(d, phys_lib, price_data, spec_truth)
    verdict = {
        **res,
        "green": is_green(res),
        "extracted": True,
        "spec_truth": spec_truth,
    }
    return verdict, render_cost_verdict(verdict)


def render_cost_verdict(verdict: dict) -> str:
    """把机器 verdict 渲染成可追加到 final_output 的中文段落。"""
    flag = {PASS: "✅PASS", FAIL: "❌FAIL", UNKNOWN: "⚠️UNKNOWN"}
    head = "🟢全绿放行" if verdict.get("green") else "🔴未全绿(见下)"
    lines = [
        "",
        "### 成本确定性闸（机器判定，算术非 LLM 自评）",
        f"总判: {head}"
        + (
            "（精算 JSON 解析成功）"
            if verdict.get("extracted")
            else "（未解析到精算 JSON）"
        ),
        "- C1 数字勾稽(真电压×串并 + 重量 + ΣBOM): " + flag.get(verdict.get("c1"), "?"),
        "- C7 电芯总数=S×P: " + flag.get(verdict.get("c7"), "?"),
        "- priceTruth 单价按化学体系真值带: "
        + flag.get(verdict.get("priceTruth"), "?"),
        "- specTruth 能量/电压锚 spec 真值: " + flag.get(verdict.get("specTruth"), "?"),
    ]
    spec = verdict.get("spec_truth") or {}
    if spec:
        lines.append("- spec 真值锚: " + ", ".join(f"{k}={v}" for k, v in spec.items()))
    dev = verdict.get("deviations") or {}
    if dev:
        lines.append("- 复算量: " + ", ".join(f"{k}={v}" for k, v in dev.items()))
    notes = verdict.get("notes") or []
    if notes:
        lines.append("- 判据明细: " + "；".join(str(n) for n in notes))
    return "\n".join(lines)
