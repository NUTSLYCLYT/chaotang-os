#!/usr/bin/env python3
"""逐个测试所有蜂群，输出通过/失败/质量分报告。"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.chdir(ROOT)

# 加载 .env
env_file = ROOT / ".env"
if env_file.exists():
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k = k.strip()
        if k and k not in os.environ:
            os.environ[k] = v.strip()

# 蜂群列表：id → (flow config, 测试任务)
SWARMS = {
    # ── 核心业务链 ──────────────────────────────────────────────────
    "haolong": (
        "config/flow_haolong.yaml",
        "在36kr某文章评论区看到『有-30℃大批量低温电池需求，深圳客户』，整理线索并制定触达方案",
    ),
    "opc": (
        "config/flow_opc.yaml",
        "某储能集成商需要 -40℃ 工况 100MWh 集装箱储能方案，预算800万，6个月交付，倾向磷酸铁锂",
    ),
    "product": (
        "config/flow_product.yaml",
        "针对北方寒冷地区户外电源市场（-30℃），1.5kWh容量，目标价3000元以内，10月发布",
    ),
    "quotation": (
        "config/flow_quotation.yaml",
        "青海某储能项目60MWh，要求液冷长时、-25℃可用、循环6000次、12个月质保，生成报价单",
    ),
    # ── 研发链 ──────────────────────────────────────────────────────
    "sourcing": (
        "config/flow_sourcing.yaml",
        "为户外电源项目找-30℃可用21700电芯，3.5Ah以上，循环1500次，目标单价≤8元/支，月需求2万支",
    ),
    "pack_rd": (
        "config/flow_pack_rd.yaml",
        "户外电源1.5kWh，-30℃工作温度，重量<12kg，循环寿命>1500次，目标BOM成本≤0.8元/Wh，6个月开发周期",
    ),
    "battery_stage_gate": (
        "config/flow_battery_stage_gate.yaml",
        "PACK项目『N100北极户外电源』A样测试完成：-30℃容量保持率78%，循环500次衰减5%，是否可进入M Gate",
    ),
    # ── 知识/运营链 ──────────────────────────────────────────────────
    "ima": (
        "config/flow_ima.yaml",
        "整理2026年中国低温储能行业核心技术趋势、主要玩家、市场容量预测",
    ),
    "xiaohongshu": (
        "config/flow_xiaohongshu.yaml",
        "低温电池品牌『极北能源』，目标户外发烧友，小红书内容运营策略，3个月内涨粉5万",
    ),
    # ── 职能支撑链 ──────────────────────────────────────────────────
    "finance": (
        "config/flow_finance.yaml",
        "公司储能业务营收1.2亿，毛利18%，应收账款周转120天，想拿2000万订单但客户要账期180天，分析财务可行性",
    ),
    "legal": (
        "config/flow_legal.yaml",
        "合同条款：30%预付/60%验收/10%质保18个月，违约金每日0.5%，知识产权归客户，争议在客户当地法院，评估风险",
    ),
    # ── 治理/运维链 ──────────────────────────────────────────────────
    "court": (
        "config/flow_court.yaml",
        "财政紧张，议案：对江南三省加征丝绸税10%以补充军费，请按朝堂流程审议",
    ),
    "ai_ops": (
        "config/flow_ai_ops.yaml",
        "巡检最近7天 opc/product/haolong 三个蜂群运行质量与成本，找出问题并给优化提案",
    ),
    # ── 独立工具 ──────────────────────────────────────────────────
    "sdlc": (
        "config/flow_sdlc.yaml",
        "开发一个天气查询CLI工具，输入城市名输出当前温度湿度，Python 3.10+实现",
    ),
}

# 颜色
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
RESET = "\033[0m"
BOLD = "\033[1m"


def _extract_quality_from_steps(run_id: str) -> float:
    """从 QA step 的 output 里解析 total_score，兜底用。"""
    import glob
    import re

    for f in reversed(sorted(glob.glob(f"data/default/runs/{run_id}/step_*.json"))):
        try:
            d = json.load(open(f))
            out = d.get("output", "")
            m = re.search(r'"total_score"\s*:\s*([\d.]+)', out)
            if m:
                return float(m.group(1))
            m2 = re.search(r'"scores"\s*:\s*\{([^}]+)\}', out, re.DOTALL)
            if m2:
                nums = re.findall(r":\s*([\d.]+)", m2.group(1))
                if nums:
                    return round(sum(float(n) for n in nums) / len(nums), 2)
        except Exception:
            continue
    return 0.0


def _count_steps(run_id: str) -> tuple[int, int]:
    """返回 (成功步骤数, 总步骤数)。"""
    import glob

    files = glob.glob(f"data/default/runs/{run_id}/step_*.json")
    total = len(files)
    success = sum(
        1 for f in files if json.load(open(f)).get("status") in ("success", "warning")
    )
    return success, total


def run_swarm(swarm_id: str, config_path: str, task: str, timeout: int = 600) -> dict:
    from src.flow_engine import FlowEngine

    start = time.time()
    try:
        engine = FlowEngine(config_path)
        result = engine.run(task)
        elapsed = time.time() - start

        run_id = getattr(result, "run_id", None)

        qs = getattr(result, "quality_score", None) or {}
        quality = qs.get("total_score", 0) if isinstance(qs, dict) else 0
        if not quality and run_id:
            quality = _extract_quality_from_steps(run_id)

        success_steps, total_steps = _count_steps(run_id) if run_id else (0, 0)
        fo = getattr(result, "final_output", None) or {}
        output_len = len(str(fo))

        is_pass = total_steps > 0 and success_steps >= max(1, total_steps * 0.5)
        err = f"steps={success_steps}/{total_steps}" if not is_pass else None

        return {
            "status": "PASS" if is_pass else "FAIL",
            "quality": round(float(quality), 2),
            "elapsed": round(elapsed, 1),
            "output_len": output_len,
            "steps": f"{success_steps}/{total_steps}",
            "run_id": run_id,
            "error": err,
        }
    except Exception as e:
        elapsed = time.time() - start
        return {
            "status": "FAIL",
            "quality": 0,
            "elapsed": round(elapsed, 1),
            "output_len": 0,
            "steps": "0/0",
            "run_id": None,
            "error": f"{type(e).__name__}: {str(e)[:200]}",
            "traceback": traceback.format_exc()[-500:],
        }


def fmt_status(status: str) -> str:
    if status == "PASS":
        return f"{GREEN}{BOLD}PASS{RESET}"
    return f"{RED}{BOLD}FAIL{RESET}"


def fmt_quality(q: float) -> str:
    if q >= 4.0:
        return f"{GREEN}{q}{RESET}"
    elif q >= 3.0:
        return f"{YELLOW}{q}{RESET}"
    elif q > 0:
        return f"{RED}{q}{RESET}"
    return f"{YELLOW}N/A{RESET}"


def main():
    parser = argparse.ArgumentParser(description="逐个测试所有蜂群")
    parser.add_argument("--swarms", nargs="+", help="只测指定蜂群（默认全部）")
    parser.add_argument(
        "--output", default="swarm_test_report.json", help="JSON报告输出路径"
    )
    parser.add_argument("--timeout", type=int, default=600, help="单个蜂群超时秒数")
    parser.add_argument("--skip", nargs="+", default=[], help="跳过指定蜂群")
    args = parser.parse_args()

    targets = {k: v for k, v in SWARMS.items() if k not in args.skip}
    if args.swarms:
        targets = {k: v for k, v in targets.items() if k in args.swarms}

    results = {}
    total = len(targets)

    print(f"\n{BOLD}{CYAN}=== 蜂群测试开始 ({total} 个) ==={RESET}\n")

    for i, (swarm_id, (config, task)) in enumerate(targets.items(), 1):
        print(f"[{i}/{total}] {BOLD}{swarm_id}{RESET}  ", end="", flush=True)

        config_full = ROOT / config
        if not config_full.exists():
            r = {
                "status": "SKIP",
                "quality": 0,
                "elapsed": 0,
                "output_len": 0,
                "error": f"配置文件不存在: {config}",
            }
            print(f"{YELLOW}SKIP{RESET} — 配置不存在")
        else:
            r = run_swarm(swarm_id, config, task, args.timeout)
            q_str = fmt_quality(r["quality"])
            print(
                f"{fmt_status(r['status'])}  质量:{q_str}  耗时:{r['elapsed']}s  输出:{r['output_len']}字"
            )
            if r["error"]:
                print(f"   {RED}错误: {r['error']}{RESET}")

        results[swarm_id] = r

    # 汇总
    passed = sum(1 for r in results.values() if r["status"] == "PASS")
    failed = sum(1 for r in results.values() if r["status"] == "FAIL")
    skipped = sum(1 for r in results.values() if r["status"] == "SKIP")
    avg_quality = sum(r["quality"] for r in results.values() if r["quality"] > 0)
    q_count = sum(1 for r in results.values() if r["quality"] > 0)

    print(f"\n{BOLD}{CYAN}=== 测试结果汇总 ==={RESET}")
    print(
        f"通过: {GREEN}{passed}{RESET}  失败: {RED}{failed}{RESET}  跳过: {YELLOW}{skipped}{RESET}  共: {total}"
    )
    if q_count:
        print(f"平均质量分: {fmt_quality(round(avg_quality / q_count, 2))}")

    print(f"\n{'蜂群':<25} {'状态':<8} {'质量分':<8} {'耗时':<8} 错误")
    print("-" * 75)
    for swarm_id, r in results.items():
        err = r["error"][:40] if r["error"] else ""
        print(
            f"{swarm_id:<25} {r['status']:<8} {r['quality']:<8} {r['elapsed']}s{'':<4} {err}"
        )

    # 写 JSON 报告
    report = {
        "tested_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "summary": {
            "total": total,
            "passed": passed,
            "failed": failed,
            "skipped": skipped,
        },
        "results": results,
    }
    Path(args.output).write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"\n报告已写入: {args.output}")

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
