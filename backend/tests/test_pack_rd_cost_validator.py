"""pack_rd 成本确定性闸回归 (铁律4: 把"不该发生的事"钉成测试)。

全部用真 cell_library.json + battery_prices.yaml，不 mock。
四条钉死会审三人组的核心修复：
  1. 3.2V LFP 自洽样本 → C1 PASS   (Karpathy: 根除 ×3.7 假杀正确 LFP)
  2. LFP 型号但 JSON 标 3.7V 凑能量 → C1 FAIL
  3. 投毒 target_wh=1536(违 spec 1100) → specTruth FAIL  (Deming: 零点不漂)
  4. 单价砍半 → priceTruth FAIL     (Schneier: 价不许编)
可 pytest 也可 `python tests/test_pack_rd_cost_validator.py` 直跑。
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from src.pack_rd_cost_validator import (
    validate_bom,
    load_phys_lib,
    load_price_data,
    is_green,
    extract_fenced_json,
    parse_spec_truth,
    run_cost_gate,
    PASS,
    FAIL,
    UNKNOWN,
)  # noqa: E402

import json as _json

PHYS = load_phys_lib()
PRICE = load_price_data()
SPEC_12V_1100 = {"nominalV": 12, "targetWh": 1100}

# 基准: 32140 (15Ah / 3.2V / 能量密度160 → 单体重300g), LFP 小容量 9.32¥/Ah → 单价139.8
# 4S6P = 24 颗, 能量 15×4×6×3.2 = 1152Wh (距 1100 = 4.7% ≤5%)
GOOD = {
    "cell_model": "32140",
    "chemistry": "磷酸铁锂(LFP)·小容量量产线",
    "cell_capacity_ah": 15,
    "cell_nominal_v": 3.2,
    "series_S": 4,
    "parallel_P": 6,
    "cell_weight_g": 300,
    "cell_unit_price": 139.8,
    "price_source": "金羽报价单 MS 2023-12-05",
    "bms_price": 15,
    "structure_price": 50,
    "c_rate": 1,
    "bom_total": 24 * 139.8 + 15 + 50,
    "target_wh": 1152,
    "cell_count": 24,
}


def _v(d):
    return validate_bom(d, PHYS, PRICE, SPEC_12V_1100)


def test_1_lfp_32v_self_consistent_passes():
    """根除 ×3.7 假杀: 正确的 3.2V LFP 自洽设计必须全绿。"""
    res = _v(GOOD)
    assert res["c1"] == PASS, res["notes"]
    assert res["specTruth"] == PASS, res["notes"]
    assert res["priceTruth"] == PASS, res["notes"]
    assert res["c7"] == PASS, res["notes"]
    assert is_green(res), res


def test_2_json_marks_37v_fails_c1():
    """LFP 型号却在 JSON 标 3.7V 凑能量 → C1 FAIL。"""
    bad = dict(GOOD, cell_nominal_v=3.7)
    res = _v(bad)
    assert res["c1"] == FAIL
    assert any("3.7" in n or "标称电压" in n for n in res["notes"]), res["notes"]


def test_3_poison_target_violates_spec_fails_spectruth():
    """投毒: 内部自洽的 1536Wh 设计冒充 1100Wh 需求 → specTruth FAIL (C1 仍自洽)。"""
    poison = dict(
        GOOD,
        parallel_P=8,
        cell_count=32,
        target_wh=1536,
        bom_total=32 * 139.8 + 15 + 50,
    )
    res = _v(poison)
    assert res["specTruth"] == FAIL, res["notes"]
    assert res["c1"] == PASS, "内部仍自洽, 错在违 spec 而非数字打架"


def test_4_halved_price_fails_pricetruth():
    """单价砍半(ΣBOM 仍自洽) → 只 priceTruth FAIL, 隔离证明价闸独立生效。"""
    cheat = dict(GOOD, cell_unit_price=70.0, bom_total=24 * 70 + 15 + 50)
    res = _v(cheat)
    assert res["priceTruth"] == FAIL, res["notes"]
    assert res["c1"] == PASS, "ΣBOM 自洽, 价错由 priceTruth 单独抓"


def test_5_cell_not_in_library_fails_no_silent_fallback():
    """铁律2: 编造型号不在真值库 → FAIL, 禁静默回退。"""
    fake = dict(GOOD, cell_model="幻觉电芯-9999")
    res = _v(fake)
    assert res["c1"] == FAIL and res["priceTruth"] == FAIL


# ── business_step 闸接口回归 (铁律4: 抽取/锚spec/全闸编排各钉一条) ──


def test_6_extract_fenced_json_from_presale_output():
    """精算输出里夹 ```json 围栏 → 抽得出 dict; 抽不到 → None(不假装)。"""
    body = (
        "### BOM成本草算\n表格...\n\n"
        "```json\n" + _json.dumps(GOOD, ensure_ascii=False) + "\n```\n收尾说明"
    )
    d = extract_fenced_json(body)
    assert d is not None and d["cell_model"] == "32140"
    assert extract_fenced_json("没有任何 JSON 的纯散文") is None


def test_7_parse_spec_truth_anchors_spec_not_agent():
    """从工单字符串锚 spec 真值(Deming): 12V/1100Wh 解析出 nominalV/targetWh。"""
    spec = parse_spec_truth("客户需要 12V 电量1100Wh 低温-20℃ PACK")
    assert abs(spec["nominalV"] - 12) < 1e-6
    assert abs(spec["targetWh"] - 1100) < 1e-6
    # Ah×V 推算路径
    spec2 = parse_spec_truth("12V 90Ah 储能包")
    assert abs(spec2["targetWh"] - 1080) < 1e-6


def test_8_run_cost_gate_green_on_good_json():
    """全闸编排: 好 JSON + 12V/1100Wh 工单 → green=True, 四闸全 PASS。"""
    body = "```json\n" + _json.dumps(GOOD, ensure_ascii=False) + "\n```"
    verdict, text = run_cost_gate(body, "12V 电量1100Wh 低温-20℃", PHYS, PRICE)
    assert verdict["extracted"] is True
    assert verdict["green"] is True, verdict["notes"]
    assert "成本确定性闸" in text


def test_9_run_cost_gate_unknown_when_no_json():
    """精算未吐 JSON → 全闸 UNKNOWN, green=False, 禁假 PASS。"""
    verdict, text = run_cost_gate("纯散文无 JSON", "12V 1100Wh", PHYS, PRICE)
    assert verdict["extracted"] is False
    assert verdict["green"] is False
    assert all(verdict[k] == UNKNOWN for k in ("c1", "c7", "priceTruth", "specTruth"))


def test_10_run_cost_gate_poison_target_fails_spec():
    """闸编排下投毒(1536Wh冒充1100Wh)仍被 specTruth 抓 → green=False。"""
    poison = dict(
        GOOD,
        parallel_P=8,
        cell_count=32,
        target_wh=1536,
        bom_total=32 * 139.8 + 15 + 50,
    )
    body = "```json\n" + _json.dumps(poison, ensure_ascii=False) + "\n```"
    verdict, _ = run_cost_gate(body, "12V 电量1100Wh", PHYS, PRICE)
    assert verdict["specTruth"] == FAIL
    assert verdict["green"] is False


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    ok = 0
    for fn in fns:
        try:
            fn()
            print(f"PASS  {fn.__name__}")
            ok += 1
        except AssertionError as e:
            print(f"FAIL  {fn.__name__}: {e}")
    print(f"\n{ok}/{len(fns)} green")
    sys.exit(0 if ok == len(fns) else 1)
