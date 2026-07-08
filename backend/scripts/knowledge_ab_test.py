#!/usr/bin/env python3
"""知识注入效果 AB 测试 — 全自动，无需人工参与。

对比:
  组A: config/flow_opc.yaml             （有知识注入 + 静态产品数据）
  组B: config/flow_opc_no_knowledge.yaml （无知识注入，仅依赖模型内部知识）

用法:
  python3 scripts/knowledge_ab_test.py              # 跑全部5条
  python3 scripts/knowledge_ab_test.py --cases 2    # 只跑前2条（快速验证）
  python3 scripts/knowledge_ab_test.py --case-id 3  # 跑第3条
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime
from pathlib import Path

# 确保项目根目录在 sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# ── 合成测试用例 ───────────────────────────────────────────────────────
# 覆盖低温电池、储能系统、特种应用等核心场景
TEST_CASES = [
    {
        "id": 1,
        "name": "低温储能柜",
        "query": (
            "客户来自内蒙古呼和浩特，需要一套户外储能柜方案。"
            "使用环境：冬季最低-35℃，夏季最高45℃。"
            "容量需求：50kWh，用于削峰填谷。"
            "预算：约15-20万元，要求5年质保，循环寿命不低于3000次。"
            "希望2个月内交货。"
        ),
    },
    {
        "id": 2,
        "name": "电动叉车PACK",
        "query": (
            "某仓储物流公司需要为其电动叉车替换电池PACK。"
            "叉车型号：3吨前移式，现有铅酸电池24V/600Ah。"
            "希望升级为锂电，要求同尺寸替换，重量不超过280kg。"
            "工作环境：室内冷库，常年-5℃至5℃。"
            "采购数量：首批20套，年需求约50套。"
            "预算单套不超过3.5万元。"
        ),
    },
    {
        "id": 3,
        "name": "通信基站备电",
        "query": (
            "中国联通某省分公司需要为偏远山区基站配备备电方案。"
            "要求：48V/200Ah系统，支持-20℃低温启动，高原环境（海拔3000-4000米）。"
            "需满足4小时备电时长，安装空间有限（宽×深×高：600×600×2000mm以内）。"
            "数量：本次招标100套，合同期3年，每年追加50套。"
            "希望提供完整的BMS方案和远程监控接口（支持SNMP协议）。"
        ),
    },
    {
        "id": 4,
        "name": "矿用防爆储能",
        "query": (
            "某煤矿企业希望采购井下防爆型锂电储能设备。"
            "用途：井下局部通风机UPS备用电源，功率5kW，需供电2小时。"
            "安全要求：需符合MA认证（矿用产品安全标志），防爆等级ExdI。"
            "环境：井下湿度大（90%RH），温度10-30℃，有瓦斯气体。"
            "目前使用铅酸备电，希望减重50%以上。"
            "预算：整套不超过8万元，需本地化售后支持。"
        ),
    },
    {
        "id": 5,
        "name": "光储充一体",
        "query": (
            "某工业园区计划建设光储充一体化微电网项目。"
            "光伏装机：500kWp；储能需求：1MWh，支持峰谷套利和需量管理。"
            "同时配套30个直流快充桩（120kW/桩）。"
            "系统要求：电池循环寿命≥6000次，日历寿命10年，BMS需支持EMS对接。"
            "项目地点：广东佛山，环境温度5-40℃。"
            "总投资预算：储能部分不超过160万元（不含光伏和充电桩）。"
        ),
    },
]

# ── 主逻辑 ────────────────────────────────────────────────────────────

def run_single_case(case: dict, config_a: str, config_b: str) -> dict:
    """运行单个测试用例的 AB 对比。"""
    from src.flow_engine import FlowEngine

    result = {
        "case_id": case["id"],
        "case_name": case["name"],
        "query": case["query"][:80] + "...",
        "a": {"run_id": None, "grade": None, "score": None, "time": None, "error": None},
        "b": {"run_id": None, "grade": None, "score": None, "time": None, "error": None},
        "winner": None,
        "score_delta": None,
    }

    for label, config_path in [("a", config_a), ("b", config_b)]:
        print(f"    运行组{label.upper()} ({Path(config_path).name})... ", end="", flush=True)
        t0 = time.time()
        try:
            engine = FlowEngine(config_path)
            run_log = engine.run(case["query"])
            elapsed = time.time() - t0

            qs = run_log.quality_score or {}
            result[label]["run_id"] = run_log.run_id
            result[label]["grade"] = qs.get("grade")
            result[label]["score"] = qs.get("total_score")
            result[label]["time"] = round(elapsed, 1)
            print(f"完成 | {qs.get('grade', '?')} {qs.get('total_score', 0):.1f} | {elapsed:.0f}s")
        except Exception as e:
            elapsed = time.time() - t0
            result[label]["error"] = str(e)[:100]
            result[label]["time"] = round(elapsed, 1)
            print(f"失败: {e!s:.60}")

    # 判断胜者
    sa = result["a"]["score"]
    sb = result["b"]["score"]
    if sa is not None and sb is not None:
        delta = sa - sb
        result["score_delta"] = round(delta, 2)
        if abs(delta) < 0.1:
            result["winner"] = "tie"
        elif sa > sb:
            result["winner"] = "A"
        else:
            result["winner"] = "B"

    return result


def print_table(results: list[dict]) -> None:
    """打印结果表格。"""
    print("\n" + "="*70)
    print("知识注入 AB 测试结果汇总")
    print("  组A = 有知识注入 (flow_opc.yaml)")
    print("  组B = 无知识注入 (flow_opc_no_knowledge.yaml)")
    print("="*70)
    print(f"{'#':<3} {'用例':<12} {'A评分':<8} {'B评分':<8} {'差值':<8} {'胜者':<6}")
    print("-"*50)

    a_wins = b_wins = ties = errors = 0
    a_scores = []
    b_scores = []

    for r in results:
        sa = r["a"]["score"]
        sb = r["b"]["score"]
        sg = r["a"].get("grade", "?") or "?"
        sg_b = r["b"].get("grade", "?") or "?"
        score_a = f"{sa:.1f}({sg})" if sa else (r["a"]["error"] and "ERR" or "—")
        score_b = f"{sb:.1f}({sg_b})" if sb else (r["b"]["error"] and "ERR" or "—")
        delta = f"+{r['score_delta']:.2f}" if r["score_delta"] and r["score_delta"] > 0 else (f"{r['score_delta']:.2f}" if r["score_delta"] else "—")
        winner = r["winner"] or "—"

        print(f"{r['case_id']:<3} {r['case_name']:<12} {score_a:<8} {score_b:<8} {delta:<8} {winner:<6}")

        if sa:
            a_scores.append(sa)
        if sb:
            b_scores.append(sb)
        if r["winner"] == "A":
            a_wins += 1
        elif r["winner"] == "B":
            b_wins += 1
        elif r["winner"] == "tie":
            ties += 1
        elif not sa or not sb:
            errors += 1

    print("-"*50)
    if a_scores and b_scores:
        avg_a = sum(a_scores) / len(a_scores)
        avg_b = sum(b_scores) / len(b_scores)
        print(f"{'平均':<3} {'':12} {avg_a:.2f}{'':4} {avg_b:.2f}{'':4} {avg_a-avg_b:+.2f}")
    print()
    print(f"胜负: A胜{a_wins} | B胜{b_wins} | 平局{ties} | 异常{errors}")
    if a_wins > b_wins:
        print("✅ 知识注入有效：组A（有知识）整体评分更高")
    elif b_wins > a_wins:
        print("⚠️  知识注入未改善：组B（无知识）评分更高，建议检查知识库内容质量")
    else:
        print("🔁 两组表现相当，知识注入效果不显著")
    print("="*70)


def main():
    parser = argparse.ArgumentParser(description="知识注入效果 AB 测试")
    parser.add_argument("--cases", type=int, default=None, help="只跑前N条")
    parser.add_argument("--case-id", type=int, default=None, help="只跑指定ID的用例")
    parser.add_argument(
        "--config-a", default="config/flow_opc.yaml", help="组A配置（默认: 有知识注入）"
    )
    parser.add_argument(
        "--config-b", default="config/flow_opc_no_knowledge.yaml", help="组B配置（默认: 无知识注入）"
    )
    parser.add_argument("--output", default=None, help="结果保存路径（JSON）")
    args = parser.parse_args()

    cases = TEST_CASES
    if args.case_id:
        cases = [c for c in cases if c["id"] == args.case_id]
        if not cases:
            print(f"❌ 用例 #{args.case_id} 不存在")
            sys.exit(1)
    elif args.cases:
        cases = cases[:args.cases]

    # 检查配置文件存在
    for path in [args.config_a, args.config_b]:
        if not (PROJECT_ROOT / path).exists() and not Path(path).exists():
            print(f"❌ 配置文件不存在: {path}")
            sys.exit(1)

    print(f"\n🧪 知识注入 AB 测试 — {len(cases)} 个用例")
    print(f"   组A: {args.config_a}")
    print(f"   组B: {args.config_b}")
    print()

    results = []
    for i, case in enumerate(cases, 1):
        print(f"[{i}/{len(cases)}] 用例#{case['id']}: {case['name']}")
        result = run_single_case(case, args.config_a, args.config_b)
        results.append(result)
        print()

    print_table(results)

    # 保存结果
    output_path = args.output or str(
        PROJECT_ROOT / "ab_tests" / f"knowledge_ab_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    )
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    Path(output_path).write_text(
        json.dumps(
            {
                "test_type": "knowledge_ab",
                "config_a": args.config_a,
                "config_b": args.config_b,
                "created_at": datetime.now().isoformat(),
                "results": results,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"\n📄 结果已保存: {output_path}")


if __name__ == "__main__":
    main()
