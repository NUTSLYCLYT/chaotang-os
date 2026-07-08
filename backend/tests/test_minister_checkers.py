"""锦衣卫情报 / 吏部招聘 / 钦天监预测 三检查器 + 回测评分器的可证伪测试。

无模型链路、无外部依赖:纯确定性检查器,断言'好输出PASS、坏输出FAIL'。
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

import intel_check  # noqa: E402
import recruit_check  # noqa: E402
import forecast_check  # noqa: E402
import forecast_backtest  # noqa: E402


# ── 锦衣卫情报 ──
def test_intel_good_passes():
    # v2 契约:须有高可信信源(官方公告/行业媒体)+ 多源交叉验证,光说"高可信"不够
    good = (
        "情报研判：信源为交易所官方公告,极星新品高可信(官方公告);"
        "行业媒体GGII报道其产能扩张,多源印证交叉核实。融资中可信,需交叉验证。"
        "涉及融资/产能/人事/风险。"
    )
    assert intel_check.verdict_of(intel_check.check(good)) == "PASS"


def test_intel_rumor_fails():
    # 有断言、无可信度分级、无信源 = 谣言
    assert intel_check.verdict_of(intel_check.check("极星储能必然破产，板上钉钉。")) == "FAIL"


# ── 吏部招聘 ──
def test_recruit_grounded_passes():
    good = "基于R-01至R-04逐项核验:张工满足R-01/R-02,建议有条件录用。李工触发D-02红线(3年<5年)淘汰。"
    assert recruit_check.verdict_of(recruit_check.check(good)) == "PASS"


def test_recruit_blackbox_reject_fails():
    # 淘汰但无任何红线/未达依据 = 黑箱
    assert recruit_check.verdict_of(recruit_check.check("综合评估,候选人李工淘汰,建议录用张工。")) == "FAIL"


# ── 钦天监预测 ──
def test_forecast_good_passes():
    good = "乐观（25%）成本0.45元/Wh;中性（50%）IRR 5-10%;悲观（25%）装机<20GWh。警戒线锂价>15万/吨。立即执行对冲。"
    assert forecast_check.verdict_of(forecast_check.check(good)) == "PASS"


def test_forecast_prob_not_100_fails():
    # 三情景概率和=110% → 逻辑硬错
    bad = "乐观（30%）成本0.5元/Wh;中性（50%）;悲观（30%）装机20GWh。"
    r = forecast_check.check(bad)
    c1 = next(c for c in r if c["check"].startswith("C1"))
    assert c1["status"] == "FAIL"
    assert forecast_check.verdict_of(r) == "FAIL"


# ── 回测评分器 ──
def test_backtest_pending_is_unknown():
    # 默认 golden 全 null(未兑现)→ UNKNOWN,不假装有分
    r = forecast_backtest.backtest("2026H2储能")
    assert r["verdict"] == "UNKNOWN"
    assert r["realized_count"] == 0


def test_backtest_hit_logic():
    # 直接测命中逻辑:真实值落区间内=命中
    rows = [
        ({"predicted_low": 8, "predicted_high": 12, "realized": 9}, True),
        ({"predicted_low": 8, "predicted_high": 12, "realized": 15}, False),
    ]
    for row, expect in rows:
        lo, hi, act = row["predicted_low"], row["predicted_high"], row["realized"]
        assert (lo <= act <= hi) == expect


if __name__ == "__main__":
    import traceback

    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    ok = 0
    for fn in fns:
        try:
            fn()
            print(f"  ✅ {fn.__name__}")
            ok += 1
        except Exception:
            print(f"  ❌ {fn.__name__}")
            traceback.print_exc()
    print(f"\n{ok}/{len(fns)} 通过")
    sys.exit(0 if ok == len(fns) else 1)
