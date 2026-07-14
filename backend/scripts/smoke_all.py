#!/usr/bin/env python3
"""全蜂群彩排：所有注册蜂群各跑1次真实 run，聚合成准备度报告。

用法: python scripts/smoke_all.py            # 跑全部
      python scripts/smoke_all.py haolong opc  # 只跑指定
每个蜂群用 subprocess 隔离（一个崩不连累其他）+ 超时。
"""

from __future__ import annotations

import json
import argparse
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from src.runtime_paths import resolve_runtime_paths
TIMEOUT = 480
CONCURRENCY = 3

# 每个蜂群的代表性测试工单（员工可直接照此改）
INPUTS = {
    "haolong": "客户：内蒙古某风电场，需-30℃低温储能系统，预算500万，3个月内交付。帮我评分这条线索并出触达策略。",
    "opc": "客户在黑龙江做光储一体化电站，需求4MWh储能系统，要求-25℃正常放电，预算约450万，做一份市场方案。",
    "product": "想立项一款-40℃工作的特种PACK电池，目标通信基站备电/极寒户外市场，售价1.3元/Wh，做产品规划。",
    "quotation": "为黑龙江某项目报价：5MWh低温储能系统，含PCS和EMS，要求-25℃运行，目标毛利率20%，出报价单。",
    "ai_ops": "最近 opc 蜂群输出质量下降，帮我分析需求、查系统健康、出优化提案。",
    "sdlc": "开发一个蜂群运行成本统计API：输入run_id返回各步骤token和费用，要求带鉴权和单元测试。",
    "ima": "检索公司知识库里关于低温电芯负极材料的技术资料，做知识洞察和归档建议。",
    "pack_rd": "研发一款手持设备用低温PACK：-20℃工作，容量5Ah，12周交期含UN38.3认证，做研发方案。",
    "finance": "公司年营收3000万，成本2100万，应收账款800万(其中200万账龄超180天)，做财务分析和风险评估。",
    "legal": "审一份储能系统购销合同：总额450万，分3期付款，质保2年，做合规审查和条款建议。",
    "xiaohongshu": "低温电池厂商想在小红书做品牌种草，B端采购+C端户外用户，月预算5万，做运营方案。",
    "court": "处理一个跨部门议题：客户要求储能项目提前2个月交付，涉及生产/采购/法务，走朝堂治理流决策。",
    "battery_stage_gate": "某-30℃电池项目完成样品，良率82%，最高失效RPN=160(低温析锂)，做Stage Gate决策评审。",
    "sourcing": "搜寻-30℃低温电芯供应商：280Ah LFP方形，要求循环≥4000次，10MWh量级，出供应商池和参数对比。",
    "storage_aftercare": "某储能电站运行18个月后出现容量衰减，3个模组SOC不均衡，做售后处置方案。",
    "shiguan_archive": "归档一次决策：朝堂治理流批准了客户提前交付请求，记录决策档案和鉴往录。",
}


def list_swarms():
    cfg = yaml.safe_load((ROOT / "config/swarm_orchestrator.yaml").read_text())
    return [(s["id"], s["config"]) for s in cfg["swarms"]]


# LLM provider 限流/auth 瞬时错标记。命中=不是蜂群坏,是被限流(假阴性)。
# 量具铁律(2026-06-23):报警先验真——限流别报"蜂群坏",标 rate_limited、退避重试一次。
RATE_LIMIT_MARKERS = (
    "AuthenticationError",
    "rate limit",
    "RateLimit",
    "429",
    "Too Many Requests",
    "api_key",
    "All fallback attempts failed",
    "APIConnectionError",
)


def _looks_rate_limited(res, raw):
    failed = res.get("status") != "normal" or not res.get("has_output")
    return failed and any(m in raw for m in RATE_LIMIT_MARKERS)


def run_one(sid, flow, _retry=True):
    inp = INPUTS.get(sid, f"测试 {sid} 蜂群的能力，请正常产出。")
    try:
        p = subprocess.run(
            [sys.executable, "scripts/smoke_one.py", flow, inp],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=TIMEOUT,
        )
        raw = (p.stdout or "") + "\n" + (p.stderr or "")
        for line in reversed(p.stdout.splitlines()):
            if line.startswith("SMOKE_RESULT "):
                res = json.loads(line[len("SMOKE_RESULT ") :])
                # 限流/auth 假阴性:不当"真坏"。退避重试一次;仍败标 rate_limited(区别于真 error)。
                if _looks_rate_limited(res, raw):
                    if _retry:
                        time.sleep(15)  # 退避,让 provider 限流窗口过去
                        return run_one(sid, flow, _retry=False)
                    res["status"] = "rate_limited"
                    res["note"] = (
                        "provider 限流/auth 瞬时错,重试仍失败——非蜂群坏,查 provider 层"
                    )
                return res
        # 没拿到 SMOKE_RESULT:若输出含限流标记,退避重试一次,否则标 no_result
        if any(m in raw for m in RATE_LIMIT_MARKERS) and _retry:
            time.sleep(15)
            return run_one(sid, flow, _retry=False)
        return {
            "swarm": sid,
            "status": "no_result",
            "error": (p.stderr or p.stdout)[-300:],
        }
    except subprocess.TimeoutExpired:
        return {"swarm": sid, "status": "timeout", "elapsed_s": TIMEOUT}
    except Exception as e:  # noqa: BLE001
        return {"swarm": sid, "status": "harness_error", "error": str(e)}


def main(argv: list[str] | None = None):
    parser = argparse.ArgumentParser(
        description="Run one smoke task for registered swarms."
    )
    parser.add_argument(
        "swarms",
        nargs="*",
        help="Optional swarm ids to run. Defaults to all registered swarms.",
    )
    args = parser.parse_args(argv)
    targets = set(args.swarms)
    swarms = [(i, f) for i, f in list_swarms() if not targets or i in targets]
    missing = sorted(targets - {i for i, _ in list_swarms()})
    if missing:
        print(f"未知蜂群: {missing}", file=sys.stderr)
        return 2
    print(
        f"== 彩排 {len(swarms)} 蜂群 (并发{CONCURRENCY}, 超时{TIMEOUT}s) ==", flush=True
    )
    results = []
    with ThreadPoolExecutor(max_workers=CONCURRENCY) as ex:
        futs = {ex.submit(run_one, i, f): i for i, f in swarms}
        for fut in as_completed(futs):
            r = fut.result()
            results.append(r)
            ok = r.get("has_output") and r.get("status") in ("normal", "blocked")
            mark = "✅" if ok else ("⚠️" if r.get("has_output") else "❌")
            print(
                f"  {mark} {r['swarm']:20} status={r.get('status'):10} "
                f"steps={r.get('steps_ok', '?')}/{r.get('steps_total', '?')} "
                f"output={r.get('final_output_fields', '?')}字段 "
                f"qa={'✓' if r.get('qa_parsed') else '✗'} "
                f"repair={r.get('repair_rounds', '?')} "
                f"{r.get('elapsed_s', '?')}s "
                f"{('ERR:' + str(r.get('error'))[:60]) if r.get('error') else ''}",
                flush=True,
            )

    results.sort(key=lambda r: r["swarm"])
    out = resolve_runtime_paths().reports / "smoke_readiness.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(results, ensure_ascii=False, indent=2))

    runnable = sum(
        1
        for r in results
        if r.get("has_output") and r.get("status") in ("normal", "blocked")
    )
    # 量具铁律:rate_limited 不是"蜂群坏",是 provider 限流(假阴性)——单列,别混进"需修"。
    rate_limited = [r["swarm"] for r in results if r.get("status") == "rate_limited"]
    crashed = [
        r["swarm"]
        for r in results
        if not r.get("has_output") and r.get("status") != "rate_limited"
    ]
    print(f"\n{'=' * 60}")
    print(f"准备度：{runnable}/{len(results)} 蜂群能跑出输出")
    if crashed:
        print(f"❌ 无输出(真需修): {crashed}")
    if rate_limited:
        print(f"⏳ 被限流(非蜂群坏,查 provider 层,重跑可能转好): {rate_limited}")
    print(f"完整报告: {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
