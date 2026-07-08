"""结构化运行日志 — 数据飞轮的输血管道

每次蜂群 run 结束后，把决策轨迹、边界案例、门控结果写入
knowledge/flywheel/{run_id}.json，供后续训练语料和 golden test 使用。

关键设计原则（来自 Karpathy + 曾毓群）：
- 不只记"失败"，要记"每一个有价值的决策"
- 边界案例（需求不满足/供应链阻断/评审打回）是最高价值数据
- 格式版本化，保证 6 个月后还能 diff

与 failure_memory.py 的分工：
- failure_memory.py → ChromaDB 语义检索（运行时注入）
- run_logger.py     → JSON 结构化存档（训练语料/回归测试）
"""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

FLYWHEEL_DIR = Path(__file__).resolve().parent.parent / "knowledge" / "flywheel"
FLYWHEEL_VERSION = "1.0"


# ─── 数据结构 ─────────────────────────────────────────────────────────────────


@dataclass
class EdgeCase:
    """一个有学习价值的边界案例"""

    type: str  # requirement_violation / supply_chain_block / gate_blocked / qa_fail / lint_fail
    step_id: str
    detail: str
    value: Any = None  # 具体数值，如 1099.52


@dataclass
class GateOutcome:
    step_id: str
    verdict: str  # pass / conditional / blocked / fail
    reason: str = ""


@dataclass
class RunRecord:
    run_id: str
    flow_name: str
    task_input: str
    timestamp: str
    schema_version: str = FLYWHEEL_VERSION
    provider: str = ""
    total_tokens: int = 0
    total_cost_usd: float = 0.0
    run_status: str = ""
    qa_score: float = 0.0
    qa_result: str = ""
    edge_cases: list[EdgeCase] = field(default_factory=list)
    gate_outcomes: list[GateOutcome] = field(default_factory=list)
    final_output_fields: dict[str, str] = field(default_factory=dict)
    step_statuses: dict[str, str] = field(default_factory=dict)  # step_id → status
    improvement_targets: list[str] = field(default_factory=list)  # 最弱 agent


# ─── 核心提取逻辑 ─────────────────────────────────────────────────────────────


_REQUIREMENT_VIOLATION_PATTERNS = [
    r"(\d+\.?\d*)\s*Wh\s*[<>≠]\s*(\d+\.?\d*)\s*Wh",  # 能量不满足
    r"(\d+\.?\d*)\s*V\s*[<>≠]\s*(\d+\.?\d*)\s*V",  # 电压不满足
    r"(\d+\.?\d*)\s*Ah\s*[<>≠]\s*(\d+\.?\d*)\s*Ah",  # 容量不满足
]

_SUPPLY_BLOCK_PATTERNS = [
    r"供应链.*阻塞|supply.*block",
    r"❌.*阻塞|阻塞.*❌",
    r"单一供应商|only.*supplier|no.*backup",
    r"停产|断货|discontinued",
]

_GATE_BLOCKED_PATTERNS = [
    r"❌\s*(阻塞|blocked|停止流程)",
    r"流程.*停止|stop.*flow",
    r"打回.*重新设计|return.*redesign",
]


def _extract_edge_cases(run_log: Any, step_configs: list[dict]) -> list[EdgeCase]:
    cases: list[EdgeCase] = []

    for step in getattr(run_log, "steps", []):
        sid = getattr(step, "step_id", "") or ""
        output = getattr(step, "output", "") or ""
        status = getattr(step, "status", "") or ""

        # 需求违反（如能量/电压/容量不满足）
        for pat in _REQUIREMENT_VIOLATION_PATTERNS:
            for m in re.finditer(pat, output, re.IGNORECASE):
                cases.append(
                    EdgeCase(
                        type="requirement_violation",
                        step_id=sid,
                        detail=m.group(0),
                        value=m.group(0),
                    )
                )

        # 供应链阻断
        for pat in _SUPPLY_BLOCK_PATTERNS:
            if re.search(pat, output, re.IGNORECASE):
                # 提取具体型号
                model_match = re.search(
                    r"[A-Z0-9\-]{6,20}", output[output.find("❌") : output.find("❌") + 200] if "❌" in output else ""
                )
                cases.append(
                    EdgeCase(
                        type="supply_chain_block",
                        step_id=sid,
                        detail=output[:200],
                        value=model_match.group(0) if model_match else None,
                    )
                )
                break

        # 门控阻断
        for pat in _GATE_BLOCKED_PATTERNS:
            if re.search(pat, output, re.IGNORECASE):
                cases.append(
                    EdgeCase(
                        type="gate_blocked",
                        step_id=sid,
                        detail=f"{sid} 门控给出阻断结论",
                    )
                )
                break

        # lint 失败
        if status == "warning":
            cases.append(
                EdgeCase(
                    type="lint_fail",
                    step_id=sid,
                    detail=f"{sid} output_rules 检查未通过",
                )
            )

    return cases


def _extract_gate_outcomes(run_log: Any) -> list[GateOutcome]:
    outcomes = []
    gate_ids = {
        "presale_cost_estimator",
        "supply_chain_feasibility",
        "expert_review_gate",
        "qa_tech_support",
        "cross_module_checker",
    }

    for step in getattr(run_log, "steps", []):
        sid = getattr(step, "step_id", "") or ""
        if sid not in gate_ids:
            continue
        output = getattr(step, "output", "") or ""
        status = getattr(step, "status", "") or ""

        # 判断门控结论
        if re.search(r"❌.*阻塞|阻塞.*❌|总体结论.*❌", output):
            verdict = "blocked"
        elif re.search(r"⚠️.*有条件|有条件.*放行", output):
            verdict = "conditional"
        elif re.search(r"✅.*通过|放行|pass", output, re.IGNORECASE):
            verdict = "pass"
        elif status == "error":
            verdict = "error"
        else:
            verdict = "unknown"

        # 简短理由（取第一个 ⚠️/❌ 后的句子）
        reason = ""
        m = re.search(r"[⚠️❌✅].{0,150}", output)
        if m:
            reason = m.group(0)[:150].replace("\n", " ")

        outcomes.append(GateOutcome(step_id=sid, verdict=verdict, reason=reason))

    return outcomes


# ─── 主函数：从 RunLog 提取 RunRecord 并写入飞轮 ──────────────────────────────


def log_run(
    run_log: Any,
    flow_name: str = "",
    provider: str = "",
    step_configs: list[dict] | None = None,
) -> Path | None:
    """在每次 run 结束后调用，把决策轨迹写入飞轮。

    Returns: 写入的文件路径，失败返回 None。
    """
    try:
        run_id = getattr(run_log, "run_id", None)
        if not run_id:
            return None

        # 基础指标
        harness = getattr(run_log, "harness_metrics", None) or {}
        total_tokens = harness.get("total_tokens", 0) if isinstance(harness, dict) else 0
        total_cost = harness.get("total_cost_usd", 0.0) if isinstance(harness, dict) else 0.0

        # QA 信息
        qs = getattr(run_log, "quality_score", None) or {}
        qa_score = qs.get("total_score", 0.0) if isinstance(qs, dict) else 0.0
        qa_res = getattr(run_log, "qa_result", "") or ""

        # improvement_targets（从 QA output 提取）
        improvement_targets: list[str] = []
        qa_step = next(
            (s for s in getattr(run_log, "steps", []) if getattr(s, "step_id", "") == "qa_tech_support"), None
        )
        if qa_step:
            qa_raw = getattr(qa_step, "output", "") or ""
            for line in re.findall(r'"agent"\s*:\s*"([^"]+)"', qa_raw):
                improvement_targets.append(line)

        # step statuses
        step_statuses = {
            getattr(s, "step_id", ""): getattr(s, "status", "")
            for s in getattr(run_log, "steps", [])
            if getattr(s, "step_id", "")
        }

        # final output 字段（摘要，不含完整内容）
        fo = getattr(run_log, "final_output", None) or {}
        final_fields: dict[str, str] = {}
        if isinstance(fo, dict):
            raw_fo = fo.get("final_output", fo)
            if isinstance(raw_fo, dict):
                for k, v in raw_fo.items():
                    final_fields[k] = str(v)[:200] if v else ""

        record = RunRecord(
            run_id=run_id,
            flow_name=flow_name or getattr(run_log, "flow_name", ""),
            task_input=getattr(run_log, "task_input", ""),
            timestamp=datetime.now(tz=timezone.utc).isoformat(),
            provider=provider,
            total_tokens=total_tokens,
            total_cost_usd=total_cost,
            run_status=getattr(run_log, "run_status", ""),
            qa_score=qa_score,
            qa_result=qa_res,
            edge_cases=_extract_edge_cases(run_log, step_configs or []),
            gate_outcomes=_extract_gate_outcomes(run_log),
            final_output_fields=final_fields,
            step_statuses=step_statuses,
            improvement_targets=improvement_targets,
        )

        # 写入
        FLYWHEEL_DIR.mkdir(parents=True, exist_ok=True)
        out_path = FLYWHEEL_DIR / f"{run_id}.json"
        out_path.write_text(
            json.dumps(asdict(record), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return out_path

    except Exception as e:  # noqa: BLE001
        import logging

        logging.getLogger(__name__).warning("run_logger failed: %s", e)
        return None


def load_flywheel(flow_name: str | None = None, limit: int = 100) -> list[RunRecord]:
    """读取飞轮数据，用于训练语料分析和回归测试。"""
    records = []
    for f in sorted(FLYWHEEL_DIR.glob("*.json"), reverse=True)[:limit]:
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
            if flow_name and d.get("flow_name") != flow_name:
                continue
            # 重建 dataclass
            d["edge_cases"] = [EdgeCase(**ec) for ec in d.get("edge_cases", [])]
            d["gate_outcomes"] = [GateOutcome(**go) for go in d.get("gate_outcomes", [])]
            records.append(RunRecord(**d))
        except Exception:  # noqa: BLE001
            continue
    return records


def flywheel_stats(flow_name: str | None = None) -> dict:
    """飞轮统计：边界案例分布、门控阻断率、平均QA分。"""
    records = load_flywheel(flow_name=flow_name)
    if not records:
        return {"total_runs": 0}

    edge_type_counts: dict[str, int] = {}
    gate_verdict_counts: dict[str, dict[str, int]] = {}
    qa_scores = []

    for r in records:
        for ec in r.edge_cases:
            edge_type_counts[ec.type] = edge_type_counts.get(ec.type, 0) + 1
        for go in r.gate_outcomes:
            gate_verdict_counts.setdefault(go.step_id, {})
            gate_verdict_counts[go.step_id][go.verdict] = gate_verdict_counts[go.step_id].get(go.verdict, 0) + 1
        if r.qa_score:
            qa_scores.append(r.qa_score)

    return {
        "total_runs": len(records),
        "avg_qa_score": round(sum(qa_scores) / len(qa_scores), 2) if qa_scores else 0,
        "edge_case_distribution": edge_type_counts,
        "gate_block_rates": {
            sid: {
                "blocked_pct": round(100 * v.get("blocked", 0) / sum(v.values()), 1),
                "total": sum(v.values()),
            }
            for sid, v in gate_verdict_counts.items()
        },
    }
