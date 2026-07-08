#!/usr/bin/env python3
"""承保包络生成器 —— 把 5 年极寒实战数据,排成"哪格可承保 / 哪格是暗边必须弃权"的表。

直接落地大神第四轮执行篇的核心动作:
  - 按 (化学体系 × 温区 × SOC窗口) 分格;
  - 数【独立事件】而非记录数(毛:一万颗同批次同寒潮=一个事件,不是一万个样本);
  - 区分"已验证包络"(独立事件足够→可激进承保)与"暗边"(稀疏→强制弃权);
  - 给可承保格子算一个【保守可用度地板】(用 p10/最差观测,不用均值——承保赚的是平时、死的是尾部);
  - 把尾部证据单列(n 独立失败事件):5 年"效果好"≠ 见过尾部,暗边照样弃权。

与已落代码一致:稀疏阈值复用 src.decision_guard.MIN_REAL_SAMPLES;暗边格子=decision_guard 该弃权的格子。

输入(CSV,每行 = 一次电芯/站点的真实观测,见 data_templates/field_data_template.csv):
  chem, temp_zone, soc_window, batch, min_temp_c, duration_days, failed(0/1), failure_mode, availability_pct
用法:  python scripts/underwriting_envelope.py <你的5年数据.csv>
"""

from __future__ import annotations

import csv
import sys
from collections import defaultdict
from pathlib import Path
from statistics import median

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
try:
    from src.decision_guard import MIN_REAL_SAMPLES as MIN_INDEP  # 与弃权熔断同一阈值
except Exception:
    MIN_INDEP = 8

MARGIN = 2.0  # 保守地板 = 观测 p10 再减去的安全边际(个百分点)


def _percentile(sorted_vals, q):
    if not sorted_vals:
        return None
    i = max(0, min(len(sorted_vals) - 1, int(round((len(sorted_vals) - 1) * q))))
    return sorted_vals[i]


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        print("\n❌ 用法: python scripts/underwriting_envelope.py <field_data.csv>")
        return 1
    path = Path(sys.argv[1])
    if not path.exists():
        print(f"❌ 找不到数据: {path}")
        return 1

    # 按格子聚合
    buckets: dict[tuple, list[dict]] = defaultdict(list)
    n_rows = 0
    for row in csv.DictReader(path.open(encoding="utf-8")):
        n_rows += 1
        key = (row.get("chem", "?"), row.get("temp_zone", "?"), row.get("soc_window", "?"))
        buckets[key].append(row)

    print(f"读入 {n_rows} 条观测,{len(buckets)} 个 (化学×温区×SOC) 格子。独立事件阈值={MIN_INDEP}\n")
    print(
        f"{'化学':<10}{'温区':<10}{'SOC':<10}{'记录':>5}{'独立事件':>7}{'独立失败':>7}{'失败率':>7}{'可用度p50':>9}{'保守地板':>8}  判定"
    )
    print("-" * 92)

    underwritable, dark = [], []
    for key, rows in sorted(buckets.items()):
        chem, tz, soc = key

        # 独立事件 = 不同 (batch × 温度剖面分箱 × 失效模式) 的组合;独立失败事件 = 其中 failed=1 的
        def temp_bin(r):
            try:
                return int(float(r.get("min_temp_c", 0)) // 5 * 5)
            except Exception:
                return 0

        indep = {(r.get("batch", "?"), temp_bin(r), r.get("failure_mode", "")) for r in rows}
        indep_fail = {
            (r.get("batch", "?"), temp_bin(r), r.get("failure_mode", ""))
            for r in rows
            if str(r.get("failed", "0")) in ("1", "true", "True")
        }
        n_fail = sum(1 for r in rows if str(r.get("failed", "0")) in ("1", "true", "True"))
        fail_rate = n_fail / len(rows) if rows else 0
        avails = sorted(float(r["availability_pct"]) for r in rows if r.get("availability_pct") not in (None, ""))
        p50 = median(avails) if avails else None
        p10 = _percentile(avails, 0.10) if avails else None
        floor = round(p10 - MARGIN, 1) if p10 is not None else None

        ok = len(indep) >= MIN_INDEP
        verdict = "✅可承保" if ok else "🌑暗边·弃权"
        (underwritable if ok else dark).append(key)
        print(
            f"{chem:<10}{tz:<10}{soc:<10}{len(rows):>5}{len(indep):>7}{len(indep_fail):>7}"
            f"{fail_rate * 100:>6.1f}%{(f'{p50:.1f}%' if p50 else '-'):>9}"
            f"{(f'{floor:.1f}%' if floor is not None and ok else '—'):>8}  {verdict}"
        )

    print("\n===== 承保包络结论 =====")
    print(f"✅ 可承保格子: {len(underwritable)} 个 → 第一份合同就签这里最密的一格(保守地板见上)。")
    print(
        f"🌑 暗边格子(强制弃权): {len(dark)} 个 → 独立事件 <{MIN_INDEP},不可承保、不可承诺,只可'低置信·待更多真实数据'。"
    )
    if not underwritable:
        print(
            "⚠️ 没有任何格子达到独立事件阈值 —— 注意'记录多≠独立事件多'(毛的计数刀)。"
            " 你的 5 年数据可能集中在少数批次/站点,承保前需先扩独立工况覆盖。"
        )
    print(
        "\n提示:'可用度p50'是分布身体,'保守地板'用 p10-margin(承保赚平时、死尾部,故按最差定价)。"
        "\n      '独立失败事件'列=尾部证据;某格独立事件够但独立失败=0,说明你只见过它'好'、没见过它'坏',"
        "承诺时仍应在该格保守(塔勒布:5 年没出事可能是 robust,也可能是还没到感恩节)。"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
