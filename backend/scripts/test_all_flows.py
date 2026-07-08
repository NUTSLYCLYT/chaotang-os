#!/usr/bin/env python3
"""并发测试 25 个 flow，输出统一 JSON 报告。

不写回 runs/，直接调用 FlowEngine.run + 解析结果。
依赖项目 venv 的 fastapi/litellm 等。
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.chdir(ROOT)

# 加载 .env
for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, _, v = line.partition("=")
    if k.strip() and k.strip() not in os.environ:
        os.environ[k.strip()] = v.strip()


# ── 每个 flow 的代表性任务输入 ──
TASKS = {
    "flow_opc": "某储能集成商找我们，需要 -40℃ 工况下 100MWh 集装箱储能系统方案，预算 800 万，6 个月内交付，倾向磷酸铁锂",
    "flow_opc_no_knowledge": "某储能集成商找我们，需要 -40℃ 工况下 100MWh 集装箱储能系统方案，预算 800 万",
    "flow_opc_multi_model_example": "某储能集成商找我们，需要 -40℃ 工况下 100MWh 集装箱储能系统方案，预算 800 万",
    "flow_opc_test_multi": "某储能集成商找我们，需要 -40℃ 工况下 100MWh 集装箱储能系统方案，预算 800 万",
    "flow_haolong": "在 36kr 看到一篇低温电池技术文章下面有人留言『有大批量需求的请联系我，深圳某客户』，求线索整理与触达",
    "flow_product": "新品规划：针对北方寒冷地区户外电源市场（-30℃ 工作），1.5kWh 容量，目标价 3000 元以内，10 月发布",
    "flow_quotation": "客户：青海某储能项目，60MWh 系统，要求液冷长时、-25℃ 可用、循环 6000 次、12 个月质保期，请生成报价单",
    "flow_ai_ops": "巡检最近 7 天 OPC/产品部/获客 三个 swarm 的运行质量与成本，找出问题并给优化提案",
    "flow_pack_rd": "户外电源 1.5kWh，-30℃ 工作温度，重量 < 12kg，循环寿命 > 1500 次，目标 BOM 成本 ≤ 0.8 元/Wh，6 个月开发周期",
    "flow_battery_stage_gate": "PACK 项目『N100 北极户外电源』当前完成 A 样测试，主要数据：-30℃ 容量保持率 78%，循环 500 次衰减 5%，是否可进入 M Gate",
    "flow_sourcing": "为户外电源项目找 -30℃ 可用的 21700 电芯，3.5Ah 以上，循环 1500 次以上，目标单价 ≤ 8 元/支，月需求 2 万支",
    "flow_storage_aftercare": "深夜紧急工单：青海某 100MWh 储能电站，3 号 PACK 单体压差告警 200mV，温度 52℃，客户在现场怀疑热失控趋势",
    "flow_finance": "我们公司 2025 年储能业务营收 1.2 亿，毛利 18%，应收账款周转天数 120 天，近期想拿 2000 万订单但客户要求账期 180 天，分析财务可行性",
    "flow_legal": "客户合同条款：分批付款（30% 预付 / 60% 验收 / 10% 质保 18 个月），违约金每日 0.5%，知识产权属于客户，争议 → 客户当地法院，请评估法律风险",
    "flow_xiaohongshu": "我们是低温电池品牌『极北能源』，目标受众户外发烧友，要做小红书内容运营策略，3 个月内涨粉 5 万",
    "flow_sdlc": "做一个简单的天气查询 CLI 工具，输入城市名输出当前温度湿度，要 Python 3.10+ 实现",
    "flow_ima": "整理 2026 年中国低温储能行业的核心技术趋势、主要玩家、市场容量预测、政策动向",
    "flow_court": "皇宫财政紧张，需要决定是否对江南三省加征丝绸税 10%，请按朝堂流程审议",
    "flow_voice_sales": "客户来电：『我看到你们一款户外电源宣传 -30℃ 可用，价格 3500 是吗？老家东北爸妈用得上，但担心是否真的耐冻』",
    "flow_medical": "55 岁男性，凌晨 3 点突发胸口压榨性疼痛 30 分钟，向左肩放射，伴大汗，无既往心脏病史，应该挂什么科？紧急程度？",
    "flow_appointment": "想预约 5 月 25 日上午华西医院心血管内科普通号，挂号人姓名张三，手机 13800138000",
    "flow_evaluate": "简要分析中国新能源储能行业 2026 年的市场格局和技术发展趋势，200 字以内",
    "flow_requirements": "想做一个内部的低温电池技术问答 AI 助手，员工可以问『-40℃ 自加热方案选哪个』之类的问题，请帮我把需求澄清成可开发的规格",
    "flow_demo": "测试这个 demo flow 能否正常多轮对话",
    "flow_demo_spawn": "测试并行任务分解：分析新能源车 2026 年的市场、技术、风险三个维度",
}


def _detect_external_deps(config_path: str) -> list[str]:
    """识别 flow 依赖的外部服务（OpenClaw 等），未启动时跳过测试。"""
    deps = []
    try:
        import yaml as _yaml
        with open(config_path, encoding="utf-8") as f:
            cfg = _yaml.safe_load(f) or {}
        for step in cfg.get("steps") or []:
            st = step.get("step_type")
            if st == "openclaw":
                deps.append("openclaw")
            elif st == "spawn":
                deps.append("spawn")
    except Exception:
        pass
    return list(set(deps))


def run_flow(flow_name: str, task: str, timeout_sec: int = 600) -> dict:
    """跑一个 flow，返回结构化结果。"""
    from src.flow_engine import FlowEngine
    config_path = f"config/{flow_name}.yaml"
    started = time.time()
    result = {
        "flow": flow_name,
        "config": config_path,
        "task": task[:80] + ("…" if len(task) > 80 else ""),
        "status": "unknown",
        "duration_sec": 0.0,
        "run_id": None,
        "qa": None,
        "grade": None,
        "total_score": None,
        "step_count": 0,
        "error": None,
        "error_type": None,
        "external_deps": _detect_external_deps(config_path),
    }
    # OpenClaw 依赖的 flow，本环境未启动 :4444，跳过避免污染报告
    if "openclaw" in result["external_deps"]:
        try:
            import socket
            with socket.create_connection(("127.0.0.1", 4444), timeout=0.5):
                pass
        except Exception:
            result["status"] = "skipped_no_openclaw"
            result["error"] = "OpenClaw :4444 unreachable; flow 含 step_type: openclaw"
            result["error_type"] = "external_dep_missing"
            result["duration_sec"] = round(time.time() - started, 1)
            return result
    try:
        engine = FlowEngine(config_path)
        run_log, _ = engine.run_with_repair(task, repair_config=None)
        result["run_id"] = run_log.run_id
        result["step_count"] = len(run_log.steps)
        if run_log.qa_result:
            result["qa"] = run_log.qa_result.get("qa_result")
            qs = run_log.qa_result.get("quality_score") or {}
            result["grade"] = qs.get("grade")
            # schema 里字段名是 total_score（不是 total），同时兼容旧字段
            result["total_score"] = qs.get("total_score") or qs.get("total")
        # 判定状态（StepLog.status 枚举：success / error / warning / skipped / blocked）
        has_step_error = any(s.status == "error" for s in run_log.steps)
        has_blocked = any(s.status == "blocked" for s in run_log.steps)
        all_success = all(s.status == "success" for s in run_log.steps)
        if has_step_error:
            result["status"] = "step_failed"
            for s in run_log.steps:
                if s.status == "error":
                    result["error"] = (s.output or "")[:500]
                    result["error_type"] = "step_error"
                    break
        elif result["qa"] == "fail":
            result["status"] = "qa_fail"
        elif result["qa"] == "pass":
            result["status"] = "pass"
        elif has_blocked:
            # requires_approval / completion_signal 设计预期：等待用户审批
            result["status"] = "blocked_by_design"
        elif all_success:
            # 没有 QA 步骤但全部 step 成功（单 step flow 常见）
            result["status"] = "pass_no_qa"
        else:
            result["status"] = "no_qa"
    except Exception as e:
        result["status"] = "exception"
        result["error_type"] = type(e).__name__
        result["error"] = f"{e}\n{traceback.format_exc()[:1500]}"
    finally:
        result["duration_sec"] = round(time.time() - started, 1)
    return result


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--workers", type=int, default=3, help="并发数")
    p.add_argument("--flows", nargs="*", help="只跑指定 flow（不带 .yaml 后缀）")
    p.add_argument("--out", default="test_report.json")
    p.add_argument("--timeout", type=int, default=600)
    args = p.parse_args()

    if args.flows:
        flows = [f for f in args.flows if f in TASKS]
        missing = [f for f in args.flows if f not in TASKS]
        if missing:
            print(f"⚠️  未知 flow: {missing}", file=sys.stderr)
    else:
        flows = list(TASKS.keys())

    print(f"🐝 测试 {len(flows)} 个 flow，并发 {args.workers}")
    print(f"   开始时间: {time.strftime('%H:%M:%S')}")
    print()

    results = []
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures = {ex.submit(run_flow, f, TASKS[f], args.timeout): f for f in flows}
        for i, fut in enumerate(as_completed(futures), 1):
            res = fut.result()
            results.append(res)
            icon = {
                "pass": "✅",
                "pass_no_qa": "✓ ",
                "blocked_by_design": "⏸ ",
                "qa_fail": "⚠️ ",
                "step_failed": "❌",
                "exception": "💥",
                "no_qa": "❓",
                "skipped_no_openclaw": "⏭️ ",
            }.get(res["status"], "?")
            grade = res.get("grade") or ""
            total = res.get("total_score")
            score_str = f" {grade}({total})" if total is not None else ""
            print(
                f"  [{i:2d}/{len(flows)}] {icon} {res['flow']:32s}"
                f" {res['step_count']:2d}步"
                f" {res['duration_sec']:6.1f}s{score_str}"
                f"  {res['status']}"
            )
            if res["error"]:
                print(f"        {res['error_type']}: {res['error'][:120]}")

    # 排序：失败优先
    order = {"exception": 0, "step_failed": 1, "qa_fail": 2, "no_qa": 3, "pass": 4}
    results.sort(key=lambda r: (order.get(r["status"], 9), r["flow"]))

    out = Path(args.out)
    out.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n📄 报告: {out.absolute()}")

    # 汇总
    counts = {}
    for r in results:
        counts[r["status"]] = counts.get(r["status"], 0) + 1
    print(f"\n📊 汇总:")
    for k, v in counts.items():
        print(f"   {k:14s}: {v}")


if __name__ == "__main__":
    main()
