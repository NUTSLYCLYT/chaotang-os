"""AI运维元蜂群的系统上下文构建器。

自动采集系统运行数据，生成结构化文本作为 AI Ops Flow 的 task_input。
采集内容：各 Flow 近期质量评分、Token 消耗、修复洞察、历史 bad case。
"""

from __future__ import annotations

import json
from collections import defaultdict

from src.repair import list_repair_sessions, load_repair_history
from src.schema import calculate_total_score
from src.step_log import list_runs, load_run


def build_ai_ops_context(recent_n: int = 30) -> str:
    """采集系统数据，生成 AI Ops 的输入上下文。

    Args:
        recent_n: 扫描最近 N 个 run。

    Returns:
        结构化文本，作为 AI Ops Flow 的 task_input。
    """
    parts = []

    # ─── 1. 各 Flow 近期质量评分 ───
    flow_stats = _collect_flow_quality_stats(recent_n)
    parts.append(_render_flow_quality(flow_stats))

    # ─── 2. Token 消耗统计 ───
    token_stats = _collect_token_stats(recent_n)
    parts.append(_render_token_stats(token_stats))

    # ─── 3. 修复洞察 ───
    repair_stats = _collect_repair_stats()
    parts.append(_render_repair_stats(repair_stats))

    # ─── 4. 近期 bad case 摘要 ───
    bad_cases = _collect_bad_cases(flow_stats)
    parts.append(_render_bad_cases(bad_cases))

    return "\n\n---\n\n".join(parts)


# ─── 数据采集 ─────────────────────────────────────────


def _collect_flow_quality_stats(recent_n: int) -> dict:
    """按 Flow 聚合质量评分。"""
    stats: dict[str, list[dict]] = defaultdict(list)
    run_ids = list_runs()[:recent_n]

    for run_id in run_ids:
        try:
            run_log = load_run(run_id)
            if run_log is None:
                continue
        except Exception:
            continue

        flow_name = run_log.flow_name or "unknown"
        qs = (run_log.qa_result or {}).get("quality_score", {})
        scores = qs.get("scores", {})
        total = qs.get("total_score") or (
            calculate_total_score(scores) if scores else 0
        )
        qa_result = (run_log.qa_result or {}).get("qa_result", "unknown")

        # Token 统计
        total_tokens = 0
        for s in run_log.steps:
            usage = (s.raw_response or {}).get("usage", {})
            total_tokens += usage.get("total_tokens", 0) or 0

        stats[flow_name].append({
            "run_id": run_id,
            "total_score": total,
            "scores": scores,
            "qa_result": qa_result,
            "total_tokens": total_tokens,
            "step_count": len(run_log.steps),
        })

    return dict(stats)


def _collect_token_stats(recent_n: int) -> dict:
    """按 Flow + Step 聚合 Token 消耗。"""
    flow_tokens: dict[str, list[int]] = defaultdict(list)
    step_tokens: dict[str, list[int]] = defaultdict(list)

    run_ids = list_runs()[:recent_n]
    for run_id in run_ids:
        try:
            run_log = load_run(run_id)
            if run_log is None:
                continue
        except Exception:
            continue

        flow_name = run_log.flow_name or "unknown"
        run_total = 0
        for s in run_log.steps:
            usage = (s.raw_response or {}).get("usage", {})
            t = usage.get("total_tokens", 0) or 0
            run_total += t
            key = f"{flow_name}/{s.step_id}"
            step_tokens[key].append(t)

        flow_tokens[flow_name].append(run_total)

    return {"flow": dict(flow_tokens), "step": dict(step_tokens)}


def _collect_repair_stats() -> dict:
    """采集修复历史统计。"""
    sessions = list_repair_sessions()
    dim_count: dict[str, int] = defaultdict(int)
    step_count: dict[str, int] = defaultdict(int)
    total_rounds = 0
    success_count = 0

    for s in sessions:
        history = load_repair_history(s["session_id"])
        if not history:
            continue
        if history.stop_reason == "threshold_met":
            success_count += 1
        for rnd in history.rounds:
            total_rounds += 1
            for inst in rnd.instructions if hasattr(rnd, "instructions") else []:
                if isinstance(inst, dict):
                    for dim in inst.get("failure_dimensions", []):
                        dim_count[dim] += 1
                    step = inst.get("target_step", "")
                    if step:
                        step_count[step] += 1

    return {
        "total_sessions": len(sessions),
        "success_count": success_count,
        "total_rounds": total_rounds,
        "dim_count": dict(dim_count),
        "step_count": dict(step_count),
    }


def _collect_bad_cases(flow_stats: dict) -> list[dict]:
    """从质量数据中提取 bad case。"""
    bad = []
    for flow_name, runs in flow_stats.items():
        for r in runs:
            if r["qa_result"] == "fail" or r["total_score"] < 3.5:
                # 找出最低的维度
                scores = r.get("scores", {})
                weakest = ""
                if scores:
                    weakest = min(scores, key=lambda k: scores[k])
                bad.append({
                    "flow": flow_name,
                    "run_id": r["run_id"],
                    "score": r["total_score"],
                    "qa": r["qa_result"],
                    "weakest": weakest,
                })
    return bad[:15]  # 最多 15 条


# ─── 渲染 ─────────────────────────────────────────


def _render_flow_quality(stats: dict) -> str:
    lines = ["## 各 Flow 近期质量评分"]
    for flow_name, runs in stats.items():
        scores = [r["total_score"] for r in runs if r["total_score"] > 0]
        if not scores:
            lines.append(f"- {flow_name}: 无评分数据")
            continue
        avg = sum(scores) / len(scores)
        pass_count = sum(1 for r in runs if r["qa_result"] == "pass")
        fail_count = sum(1 for r in runs if r["qa_result"] == "fail")

        # 维度平均分
        dim_totals: dict[str, list[float]] = defaultdict(list)
        for r in runs:
            for dim, s in r.get("scores", {}).items():
                if isinstance(s, (int, float)):
                    dim_totals[dim].append(s)
        dim_avg = {d: round(sum(v) / len(v), 2) for d, v in dim_totals.items() if v}

        lines.append(
            f"### {flow_name} ({len(runs)}次运行)\n"
            f"- 平均分: {avg:.2f}/5 | Pass: {pass_count} | Fail: {fail_count}\n"
            f"- 各维度平均: {json.dumps(dim_avg, ensure_ascii=False)}"
        )
    return "\n".join(lines)


def _render_token_stats(stats: dict) -> str:
    lines = ["## Token 消耗统计"]
    for flow_name, tokens in stats["flow"].items():
        if not tokens:
            continue
        avg = sum(tokens) / len(tokens)
        total = sum(tokens)
        cost = total * 0.01 / 1000  # 约 0.01元/千token
        lines.append(
            f"- {flow_name}: 平均 {avg:.0f} token/次, "
            f"累计 {total} token ≈ {cost:.2f}元"
        )

    # Top 5 高消耗步骤
    step_avg = {}
    for key, tokens in stats["step"].items():
        if tokens:
            step_avg[key] = sum(tokens) / len(tokens)
    top5 = sorted(step_avg.items(), key=lambda x: -x[1])[:5]
    if top5:
        lines.append("\n### 高消耗步骤 TOP5")
        for i, (key, avg) in enumerate(top5, 1):
            lines.append(f"{i}. {key}: 平均 {avg:.0f} token/次")

    return "\n".join(lines)


def _render_repair_stats(stats: dict) -> str:
    lines = ["## 修复洞察"]
    lines.append(
        f"- 总修复会话: {stats['total_sessions']} | "
        f"成功: {stats['success_count']} | "
        f"总轮次: {stats['total_rounds']}"
    )
    if stats["dim_count"]:
        dims = sorted(stats["dim_count"].items(), key=lambda x: -x[1])
        lines.append("- 高频被修维度: " + ", ".join(f"{d}({c}次)" for d, c in dims))
    if stats["step_count"]:
        steps = sorted(stats["step_count"].items(), key=lambda x: -x[1])
        lines.append("- 高频被修 Agent: " + ", ".join(f"{s}({c}次)" for s, c in steps))
    if not stats["dim_count"] and not stats["step_count"]:
        lines.append("- 暂无修复记录")
    return "\n".join(lines)


def _render_bad_cases(cases: list[dict]) -> str:
    if not cases:
        return "## 近期 Bad Case\n- 无 bad case（所有运行均达标）"
    lines = ["## 近期 Bad Case（QA fail 或总分<3.5）"]
    for c in cases:
        lines.append(
            f"- [{c['flow']}] {c['run_id']}: "
            f"总分{c['score']:.2f}, QA={c['qa']}"
            + (f", 最弱维度: {c['weakest']}" if c.get("weakest") else "")
        )
    return "\n".join(lines)
