#!/usr/bin/env python3
"""Chaotang commercial loop harness.

Default mode is deterministic dry-run. Real mode calls existing FlowEngine
flows and should be used only when model/provider credentials are ready.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import multiprocessing as mp
import re
import sys
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml


HARNESS_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = HARNESS_ROOT.parents[1]
CASES_PATH = HARNESS_ROOT / "golden_cases" / "commercial_loop_cases.json"
DEFAULT_LEDGER = HARNESS_ROOT / "artifacts" / "commercial_loop_ledger.jsonl"
DEFAULT_EVENTS = HARNESS_ROOT / "artifacts" / "commercial_loop_events.jsonl"
DEFAULT_FAILURES = HARNESS_ROOT / "artifacts" / "commercial_loop_failures.jsonl"
DEFAULT_BUSINESS_LEDGER = HARNESS_ROOT / "artifacts" / "commercial_loop_business.jsonl"
DEFAULT_GOLDEN_CANDIDATES = HARNESS_ROOT / "artifacts" / "commercial_loop_golden_candidates.jsonl"
BLOCKS = ("lead", "opc", "product", "quotation")
OUTCOMES = ("no_response", "invalid_lead", "budget_changed", "needs_full_proposal", "quoted", "won", "lost")
FLOW_CONFIGS = {
    "lead": "config/flow_haolong.yaml",
    "opc": "config/flow_opc.yaml",
    "product": "config/flow_product.yaml",
    "quotation": "config/flow_quotation.yaml",
}
DEFAULT_BLOCK_TIMEOUT_SECONDS = 180


FAST_JUDGMENT_PROMPT = """你是朝堂商业闭环的快判官。你的任务是在不编造事实的前提下，快速判断商机是否值得进入完整蜂群深跑。

硬规则：
1. 只允许输出三类数字：原始客户需求中的数字、harness 确定性预计算区块中的数字、明确引用来源的数字。
2. 禁止输出未给来源的市场价格区间、容量保持率、认证周期、交付周期、成本比例、折扣、融资比例。
3. 如确实需要某个外部数字，用“待来源确认”表达，不要写具体数字。
4. 不得承诺报价、交期、性能、安全能力；涉及这些内容只输出“需人工签字”。
5. 输出必须短，面向军机处下一步裁断，而不是完整报告。

输出格式：
## 信息状态
- 已确认：
- 待确认：
- 推测：

## 红线判断
- 预算/容量：
- 技术/安全：
- 交付/合规：

## 允许数字清单
逐条列出你在本次输出中使用的所有数字，并注明来源：原始需求 / harness预计算 / 明确来源 / 待来源确认。

## 下一步
给出一个最小下一步动作。
"""


@dataclass
class Evidence:
    source: str
    claim: str
    timestamp: str = ""


@dataclass
class BlockRecord:
    block_id: str
    status: str
    owner: str
    input: str
    output: str
    evidence: list[Evidence]
    assumptions: list[str]
    confidence: float
    next_action: str
    run_id: str | None = None
    quality_score: float | None = None


@dataclass
class QualityGate:
    status: str
    score: float
    traceability: float
    number_grounding: float
    human_signoff_required: bool
    reasons: list[str] = field(default_factory=list)
    ungrounded_numbers: list[str] = field(default_factory=list)


def _now() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def load_cases() -> list[dict[str, Any]]:
    return json.loads(CASES_PATH.read_text(encoding="utf-8"))


def _numbers(text: str) -> set[str]:
    raw = re.findall(r"(?<![A-Za-z])[-+]?\d+(?:\.\d+)?%?(?:℃|MWh|kWh|Wh|元/Wh|元|万|个月|周|套|次|年)?", text)
    numbers: set[str] = set()
    for item in raw:
        item = item.strip()
        if not item:
            continue
        # Ignore plain list/table ordinals. Meaningful commercial quantities
        # should carry a unit or appear as a decimal/percentage.
        if re.fullmatch(r"\d", item):
            continue
        # Ignore bare long identifiers such as standards (GB/T 36276) or case
        # ids. Commercial quantities should be unit-bearing in this harness.
        if re.fullmatch(r"\d{4,}", item):
            continue
        numbers.add(item)
    return numbers


def _derived_grounding_numbers(case: dict[str, Any]) -> set[str]:
    """Deterministically derive allowed numbers from the task.

    Example: 预算800万 + 100MWh => 0.08元/Wh. This keeps math out of the LLM
    while allowing the gate to accept computed sanity-check numbers.
    """
    task = case.get("task", "")
    budget_match = re.search(r"预算\s*([0-9]+(?:\.[0-9]+)?)\s*万", task)
    capacity_match = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*MWh", task, flags=re.IGNORECASE)
    derived: set[str] = set()
    if budget_match and capacity_match:
        budget_yuan = float(budget_match.group(1)) * 10000
        capacity_wh = float(capacity_match.group(1)) * 1_000_000
        if capacity_wh:
            yuan_per_wh = budget_yuan / capacity_wh
            derived.add(f"{yuan_per_wh:.2f}")
            derived.add(f"{yuan_per_wh:.2f}元/Wh")
    return derived


def build_deterministic_context(case: dict[str, Any]) -> dict[str, str]:
    task = case.get("task", "")
    lines = [
        "以下为 harness 确定性预计算结果，优先级高于模型自行估算。",
        "禁止心算、改写或输出与本区块矛盾的数字；若需要其他数字，必须标注为待人工确认。",
        "禁止输出未在原始需求、golden reference 或本预计算区块出现的市场价格区间、保持率、认证周期等数字。",
    ]
    budget_match = re.search(r"预算\s*([0-9]+(?:\.[0-9]+)?)\s*万", task)
    capacity_match = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*MWh", task, flags=re.IGNORECASE)
    if budget_match:
        budget_wan = float(budget_match.group(1))
        lines.append(f"- 预算: {budget_wan:g}万人民币")
    if capacity_match:
        capacity_mwh = float(capacity_match.group(1))
        lines.append(f"- 容量: {capacity_mwh:g}MWh")
    if budget_match and capacity_match:
        budget_yuan = float(budget_match.group(1)) * 10000
        capacity_wh = float(capacity_match.group(1)) * 1_000_000
        if capacity_wh:
            yuan_per_wh = budget_yuan / capacity_wh
            lines.append(f"- 确定性计算: 预算单价 = {yuan_per_wh:.2f}元/Wh")
            lines.append(f"- 禁止输出: {yuan_per_wh * 100:.0f}元/Wh 或其他未给来源的预算单价")
    return {"slot_instruction": "\n".join(lines)}


def _grounding_details(records: list[BlockRecord], case: dict[str, Any]) -> tuple[float, set[str]]:
    ground = case["task"] + "\n" + "\n".join(case.get("reference", []))
    grounded_numbers = _numbers(ground) | _derived_grounding_numbers(case)
    output_numbers: set[str] = set()
    for record in records:
        output_numbers |= _numbers(record.output)
    meaningful = {n for n in output_numbers if re.search(r"\d", n)}
    if not meaningful:
        return 1.0, set()
    matched = {n for n in meaningful if n in grounded_numbers}
    return len(matched) / len(meaningful), meaningful - matched


def _grounding_ratio(records: list[BlockRecord], case: dict[str, Any]) -> float:
    ratio, _ = _grounding_details(records, case)
    return ratio


def _traceability(records: list[BlockRecord]) -> float:
    if not records:
        return 0.0
    traced = sum(1 for r in records if r.evidence and r.next_action and r.confidence >= 0.5)
    return traced / len(records)


def dry_run_block(block_id: str, case: dict[str, Any], upstream: str) -> BlockRecord:
    refs = "；".join(case.get("reference", [])[:2])
    must_not = "；".join(case.get("must_not", [])[:2])
    owner_by_block = {
        "lead": "兵部/销售战情-获客",
        "opc": "兵部/销售战情-OPC",
        "product": "工部",
        "quotation": "户部/报价",
    }
    next_by_block = {
        "lead": "核实客户身份、场景、预算、交期后交 OPC 出方案",
        "opc": "形成可行方案边界，交工部拆产品与交付风险",
        "product": "明确规格、风险、依赖，交户部生成报价假设",
        "quotation": "输出区间报价假设，进入质量门禁和人类签字",
    }
    output = f"{block_id}：基于任务事实识别关键约束。参考要点：{refs}。禁止事项：{must_not}。"
    return BlockRecord(
        block_id=block_id,
        status="passed",
        owner=owner_by_block[block_id],
        input=upstream,
        output=output,
        evidence=[
            Evidence(source=case["source"], claim=case["task"], timestamp=_now()),
            Evidence(source="golden_reference", claim=refs, timestamp=_now()),
        ],
        assumptions=["dry-run 使用 golden reference 构造可验证骨架，不代表真实模型输出"],
        confidence=0.82,
        next_action=next_by_block[block_id],
        run_id=f"dry-{case['case_id']}-{block_id}",
        quality_score=4.0,
    )


def real_run_block(block_id: str, case: dict[str, Any], upstream: str) -> BlockRecord:
    sys.path.insert(0, str(REPO_ROOT))
    from src.flow_engine import FlowEngine

    cfg = REPO_ROOT / FLOW_CONFIGS[block_id]
    run = FlowEngine(str(cfg)).run(upstream, context_extra=build_deterministic_context(case))
    final_output = run.final_output if isinstance(run.final_output, dict) else {}
    output_text = json.dumps(final_output, ensure_ascii=False) if final_output else (run.steps[-1].output if run.steps else "")
    failed = run.run_status not in {"normal", ""} or any(s.status in {"error", "budget_exceeded"} for s in run.steps)
    score = None
    if run.quality_score:
        score = run.quality_score.get("total_score")
    return BlockRecord(
        block_id=block_id,
        status="failed" if failed or not output_text else "passed",
        owner=block_id,
        input=upstream,
        output=output_text or "无输出",
        evidence=[
            Evidence(source=f"flow:{FLOW_CONFIGS[block_id]}", claim=f"run_id={run.run_id}", timestamp=_now())
        ],
        assumptions=["真实 flow 输出；证据完整性依赖 flow 内部引用"],
        confidence=0.0 if failed or not output_text else 0.7,
        next_action="修复该 flow 后重跑" if failed or not output_text else "进入下一商业闭环节点",
        run_id=run.run_id,
        quality_score=score,
    )


def make_fast_flow_config(block_id: str) -> dict[str, Any]:
    """Build a first-judgment version of an existing flow.

    Fast mode keeps the original first non-QA step prompt but removes slow
    retrieval, tools, repair, dependencies, and long output linting. The full
    flow remains unchanged and can still run asynchronously after the first
    judgment.
    """
    cfg_path = REPO_ROOT / FLOW_CONFIGS[block_id]
    cfg = yaml.safe_load(cfg_path.read_text(encoding="utf-8"))
    steps = [s for s in cfg.get("steps", []) if s.get("id") not in {"qa_tech_support", "qa_check"}]
    if not steps:
        raise ValueError(f"flow has no non-QA steps: {FLOW_CONFIGS[block_id]}")
    first = dict(steps[0])
    for key in (
        "depends_on",
        "tools",
        "knowledge",
        "knowledge_scope",
        "output_rules",
        "few_shot_from_cases",
        "few_shot_top_k",
        "lint_max_retries",
        "retry",
    ):
        first.pop(key, None)
    first["id"] = f"{first.get('id', block_id)}_fast_judgment"
    first["name"] = f"{first.get('name', block_id)} · 快判"
    first["description"] = "Commercial-loop harness fast first judgment"
    first["prompt_inline"] = FAST_JUDGMENT_PROMPT
    first.pop("prompt_key", None)
    first.pop("prompt_module", None)
    first["no_tools"] = True
    first["max_tokens"] = min(int(first.get("max_tokens", 1400) or 1400), 1400)
    first["temperature"] = 0

    fast = dict(cfg)
    fast["flow_name"] = f"{cfg.get('flow_name', block_id)} · 快判"
    fast["steps"] = [first]
    fast["max_llm_calls"] = 4
    fast["default_temperature"] = 0
    fast["knowledge_pre_retrieval"] = {"enabled": False}
    fast.pop("knowledge_inject", None)
    fast.pop("ima_pre_retrieval", None)
    fast["flow_tools"] = []
    fast["repair"] = {"enabled": False}
    fast["output_fields"] = cfg.get("output_fields", [])[:3]
    fast["default_retry"] = {"max_retries": 0, "delay": 0, "backoff": 1, "retry_on": []}
    try:
        sys.path.insert(0, str(REPO_ROOT))
        from src.provider import apply_provider_to_flow_config

        fast = apply_provider_to_flow_config(fast)
    except Exception:
        pass
    return fast


def real_run_fast_block(block_id: str, case: dict[str, Any], upstream: str) -> BlockRecord:
    sys.path.insert(0, str(REPO_ROOT))
    from src.flow_engine import FlowEngine

    run = FlowEngine.from_dict(make_fast_flow_config(block_id), qa_version="v3").run(
        upstream,
        context_extra=build_deterministic_context(case),
    )
    output_text = run.steps[-1].output if run.steps else ""
    failed = run.run_status not in {"normal", ""} or any(s.status in {"error", "budget_exceeded"} for s in run.steps)
    return BlockRecord(
        block_id=block_id,
        status="failed" if failed or not output_text else "passed",
        owner=f"{block_id}:fast",
        input=upstream,
        output=output_text or "无输出",
        evidence=[
            Evidence(source=f"fast-flow:{FLOW_CONFIGS[block_id]}", claim=f"run_id={run.run_id}", timestamp=_now())
        ],
        assumptions=["快判只用于先给商业边界与风险，不替代完整 flow 的深度分析"],
        confidence=0.0 if failed or not output_text else 0.62,
        next_action="修复快判 flow 后重跑" if failed or not output_text else "快判通过后进入质量门禁；完整 flow 可异步深跑",
        run_id=run.run_id,
        quality_score=None,
    )


def _real_run_child(block_id: str, case: dict[str, Any], upstream: str, fast: bool, queue: mp.Queue) -> None:
    try:
        record = real_run_fast_block(block_id, case, upstream) if fast else real_run_block(block_id, case, upstream)
        queue.put(("ok", asdict(record)))
    except Exception as exc:  # noqa: BLE001
        queue.put(("error", str(exc)))


def _record_from_dict(data: dict[str, Any]) -> BlockRecord:
    evidence = [Evidence(**item) for item in data.get("evidence", [])]
    data = dict(data)
    data["evidence"] = evidence
    return BlockRecord(**data)


def real_run_block_with_timeout(
    block_id: str,
    case: dict[str, Any],
    upstream: str,
    timeout_seconds: int,
    fast: bool = False,
) -> BlockRecord:
    queue: mp.Queue = mp.Queue(maxsize=1)
    proc = mp.Process(target=_real_run_child, args=(block_id, case, upstream, fast, queue), daemon=True)
    proc.start()
    proc.join(timeout_seconds)
    if proc.is_alive():
        proc.terminate()
        proc.join(5)
        return BlockRecord(
            block_id=block_id,
            status="failed",
            owner=block_id,
            input=upstream,
            output=f"{'fast ' if fast else ''}real flow timed out after {timeout_seconds}s",
            evidence=[
                Evidence(source=f"flow:{FLOW_CONFIGS[block_id]}", claim="timeout", timestamp=_now()),
            ],
            assumptions=["真实 flow 超时，未进入下游；需检查 provider、模型延迟、工具调用或 flow 步骤"],
            confidence=0.0,
            next_action="缩短/修复该 flow，或提高 --block-timeout 后重跑",
            quality_score=0.0,
        )
    if queue.empty():
        return BlockRecord(
            block_id=block_id,
            status="failed",
            owner=block_id,
            input=upstream,
            output=f"real flow exited with code {proc.exitcode} and returned no record",
            evidence=[
                Evidence(source=f"flow:{FLOW_CONFIGS[block_id]}", claim=f"exitcode={proc.exitcode}", timestamp=_now()),
            ],
            assumptions=["真实 flow 异常退出且未写入结果"],
            confidence=0.0,
            next_action="查看 flow 运行日志后重跑",
            quality_score=0.0,
        )
    kind, payload = queue.get()
    if kind == "ok":
        return _record_from_dict(payload)
    return BlockRecord(
        block_id=block_id,
        status="failed",
        owner=block_id,
        input=upstream,
        output=str(payload),
        evidence=[
            Evidence(source=f"flow:{FLOW_CONFIGS[block_id]}", claim="exception", timestamp=_now()),
        ],
        assumptions=["真实 flow 抛出异常"],
        confidence=0.0,
        next_action="修复异常后重跑",
        quality_score=0.0,
    )


def evaluate_gate(records: list[BlockRecord], case: dict[str, Any]) -> QualityGate:
    reasons: list[str] = []
    traceability = _traceability(records)
    grounding, ungrounded = _grounding_details(records, case)
    failed = [r.block_id for r in records if r.status != "passed"]
    if failed:
        reasons.append(f"block failed: {', '.join(failed)}")
    if traceability < 0.8:
        reasons.append(f"traceability below 0.8: {traceability:.2f}")
    if grounding < 1.0:
        reasons.append(f"number grounding below 1.0: {grounding:.2f}")
        if ungrounded:
            reasons.append(f"ungrounded numbers: {', '.join(sorted(ungrounded)[:8])}")
    if any(not r.output.strip() for r in records):
        reasons.append("empty output detected")
    if any(r.output.lstrip().startswith("[ERROR]") or "Missing credentials" in r.output for r in records):
        reasons.append("model/runtime error output detected")

    human_signoff_required = bool(case.get("human_signoff_triggers"))
    if human_signoff_required:
        reasons.append("human signoff required before quotation, delivery, or safety commitment")

    score = 5.0
    score -= max(0.0, 0.8 - traceability) * 2
    score -= max(0.0, 1.0 - grounding) * 2
    score -= len(failed)
    score = max(0.0, round(score, 2))
    has_runtime_error = any("model/runtime error output detected" == r for r in reasons)
    status = (
        "passed"
        if score >= 3.5 and not failed and not has_runtime_error and traceability >= 0.8 and grounding >= 1.0
        else "blocked"
    )
    return QualityGate(
        status=status,
        score=score,
        traceability=round(traceability, 2),
        number_grounding=round(grounding, 2),
        human_signoff_required=human_signoff_required,
        reasons=reasons,
        ungrounded_numbers=sorted(ungrounded),
    )


def build_report(case: dict[str, Any], records: list[BlockRecord], gate: QualityGate) -> dict[str, str]:
    final_next = records[-1].next_action if records else "补齐商业闭环记录"
    gate_text = f"质量门禁 {gate.status}，分数 {gate.score}/5。"
    if gate.status != "passed":
        return {
            "boss_summary": f"{case['case_id']}：{gate_text} 暂不对外输出。下一步：{final_next}",
            "customer_summary": "暂不生成客户话术；内部需先修复阻塞项并补齐证据。",
            "sales_followup": "请销售暂停承诺报价、交期和安全能力，等待质量门禁通过。",
        }
    return {
        "boss_summary": f"{case['case_id']}：{gate_text} 下一步：{final_next}",
        "customer_summary": "我们已完成需求初判，下一步先确认关键约束；正式方案、报价和交期需人工签字后输出。",
        "sales_followup": "请销售优先确认：客户身份、使用场景、容量/规格、预算口径、交付窗口、是否接受替代方案。",
    }


def append_ledger(path: Path, result: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(result, ensure_ascii=False) + "\n")


def _latency_seconds(records: list[BlockRecord]) -> float | None:
    timestamps: list[datetime] = []
    for record in records:
        for evidence in record.evidence:
            if evidence.timestamp:
                try:
                    timestamps.append(datetime.fromisoformat(evidence.timestamp))
                except ValueError:
                    pass
    if len(timestamps) < 2:
        return None
    return round((max(timestamps) - min(timestamps)).total_seconds(), 3)


def build_wide_event(result: dict[str, Any], *, blocks: tuple[str, ...], fast: bool) -> dict[str, Any]:
    gate = result["quality_gate"]
    business_records = [r for r in result["records"] if r["block_id"] in BLOCKS]
    return {
        "event_type": "commercial_loop_run",
        "timestamp": result["created_at"],
        "case_id": result["case_id"],
        "mode": result["mode"],
        "fast": fast,
        "blocks_requested": list(blocks),
        "blocks_completed": [r["block_id"] for r in business_records],
        "status": result["status"],
        "gate_status": gate["status"],
        "gate_score": gate["score"],
        "traceability": gate["traceability"],
        "number_grounding": gate["number_grounding"],
        "ungrounded_numbers": gate.get("ungrounded_numbers", []),
        "human_signoff_required": gate["human_signoff_required"],
        "reasons": gate["reasons"],
        "run_ids": {r["block_id"]: r.get("run_id") for r in business_records if r.get("run_id")},
        "models": {r["block_id"]: r["owner"] for r in business_records},
        "latency_seconds": _latency_seconds([_record_from_dict(r) for r in business_records]),
    }


def build_failure_sample(result: dict[str, Any], event: dict[str, Any]) -> dict[str, Any] | None:
    gate = result["quality_gate"]
    runtime_error = any("model/runtime error output detected" in reason for reason in gate["reasons"])
    if result["status"] == "passed" and not gate.get("ungrounded_numbers") and not runtime_error:
        return None
    business_records = [r for r in result["records"] if r["block_id"] in BLOCKS]
    return {
        "event_type": "commercial_loop_failure_sample",
        "timestamp": result["created_at"],
        "case_id": result["case_id"],
        "mode": result["mode"],
        "fast": event["fast"],
        "status": result["status"],
        "gate_status": gate["status"],
        "gate_score": gate["score"],
        "ungrounded_numbers": gate.get("ungrounded_numbers", []),
        "reasons": gate["reasons"],
        "input": result["input"],
        "latest_business_output": business_records[-1]["output"] if business_records else "",
        "next_action": "Add/adjust golden reference, deterministic metric, or fast prompt constraint.",
    }


def golden_candidate_id(candidate: dict[str, Any]) -> str:
    material = "|".join(
        [
            candidate.get("candidate_type", ""),
            candidate.get("case_id", ""),
            candidate.get("task", ""),
            candidate.get("observed_output", ""),
            str(candidate.get("outcome") or ""),
        ]
    )
    return hashlib.sha256(material.encode("utf-8")).hexdigest()[:16]


def ensure_golden_candidate_id(candidate: dict[str, Any]) -> dict[str, Any]:
    if not candidate.get("candidate_id"):
        candidate = dict(candidate)
        candidate["candidate_id"] = golden_candidate_id(candidate)
    return candidate


def build_golden_candidate_from_failure(failure: dict[str, Any]) -> dict[str, Any]:
    candidate = {
        "event_type": "golden_candidate",
        "candidate_type": "failure",
        "timestamp": _now(),
        "case_id": failure["case_id"],
        "task": failure["input"]["task"],
        "source": failure["input"].get("source", ""),
        "owner": failure["input"].get("owner", ""),
        "observed_output": failure.get("latest_business_output", ""),
        "reference_todo": "人工补充：该场景的正确判断、允许数字、下一步动作。",
        "must_not": failure.get("ungrounded_numbers", []) + failure.get("reasons", []),
        "outcome": None,
        "promotion_status": "needs_human_review",
    }
    return ensure_golden_candidate_id(candidate)


def build_golden_candidate_from_business(case: dict[str, Any]) -> dict[str, Any] | None:
    outcome = case.get("outcome")
    if not outcome:
        return None
    candidate = {
        "event_type": "golden_candidate",
        "candidate_type": "business_outcome",
        "timestamp": _now(),
        "case_id": case["case_id"],
        "task": case.get("task", ""),
        "source": case.get("source", "business_ledger") or "business_ledger",
        "owner": case.get("owner", ""),
        "observed_output": case.get("customer_response", ""),
        "reference_todo": "人工补充：基于真实客户反馈校正快判 reference。",
        "must_not": [],
        "outcome": outcome,
        "lesson": case.get("lesson", ""),
        "promotion_status": "needs_human_review",
    }
    return ensure_golden_candidate_id(candidate)


def append_golden_candidate(path: Path, candidate: dict[str, Any] | None) -> None:
    if candidate:
        append_ledger(path, ensure_golden_candidate_id(candidate))


def load_golden_candidate_states(path: Path) -> dict[str, dict[str, Any]]:
    states: dict[str, dict[str, Any]] = {}
    for event in read_jsonl(path):
        if event.get("event_type") == "golden_candidate":
            candidate = ensure_golden_candidate_id(event)
            states[candidate["candidate_id"]] = candidate
        elif event.get("event_type") == "golden_candidate_review":
            candidate_id = event.get("candidate_id")
            if not candidate_id:
                continue
            current = dict(states.get(candidate_id, {"candidate_id": candidate_id}))
            current.update(
                {
                    "promotion_status": event.get("review_status"),
                    "reviewer": event.get("reviewer", ""),
                    "review_note": event.get("review_note", ""),
                    "reviewed_at": event.get("timestamp", ""),
                }
            )
            states[candidate_id] = current
    return states


def build_golden_review_event(
    candidate: dict[str, Any],
    *,
    status: str,
    reviewer: str,
    note: str,
) -> dict[str, Any]:
    if status not in {"promoted", "rejected"}:
        raise SystemExit(f"invalid golden review status: {status}")
    return {
        "event_type": "golden_candidate_review",
        "timestamp": _now(),
        "candidate_id": candidate["candidate_id"],
        "case_id": candidate.get("case_id", ""),
        "review_status": status,
        "reviewer": reviewer or "未指定",
        "review_note": note,
    }


def build_golden_case_from_candidate(
    candidate: dict[str, Any],
    *,
    reference: str,
    reviewer: str,
) -> dict[str, Any]:
    if not reference.strip():
        raise SystemExit("--reference is required when promoting a golden candidate")
    case_id = candidate["case_id"]
    promoted_case_id = case_id if not case_id.endswith("_candidate") else case_id
    return {
        "case_id": promoted_case_id,
        "source": candidate.get("source", "golden_candidate") or "golden_candidate",
        "owner": reviewer or candidate.get("owner", "史馆"),
        "success_metric": "人工审核后的生产反馈样本可回归验证",
        "task": candidate.get("task", ""),
        "reference": [part.strip() for part in reference.split("|") if part.strip()],
        "must_not": candidate.get("must_not", []),
        "human_signoff_triggers": ["报价", "交期承诺", "安全/性能承诺"],
        "promoted_from_candidate_id": candidate["candidate_id"],
        "promotion_status": "promoted",
    }


def append_promoted_golden_case(path: Path, golden_case: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    cases = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
    if any(case.get("case_id") == golden_case["case_id"] for case in cases):
        golden_case = dict(golden_case)
        golden_case["case_id"] = f"{golden_case['case_id']}_promoted_{golden_case['promoted_from_candidate_id'][:8]}"
    cases.append(golden_case)
    path.write_text(json.dumps(cases, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def review_golden_candidate(
    *,
    candidate_path: Path,
    golden_cases_path: Path,
    candidate_id: str,
    status: str,
    reviewer: str,
    note: str,
    reference: str,
) -> dict[str, Any]:
    candidates = load_golden_candidate_states(candidate_path)
    candidate = candidates.get(candidate_id)
    if not candidate:
        raise SystemExit(f"unknown golden candidate: {candidate_id}")
    if candidate.get("promotion_status") in {"promoted", "rejected"}:
        raise SystemExit(f"golden candidate already reviewed: {candidate_id}")
    if status == "promoted":
        golden_case = build_golden_case_from_candidate(candidate, reference=reference, reviewer=reviewer)
        append_promoted_golden_case(golden_cases_path, golden_case)
    event = build_golden_review_event(candidate, status=status, reviewer=reviewer, note=note)
    append_ledger(candidate_path, event)
    return event


def write_observability_events(
    result: dict[str, Any],
    *,
    event_path: Path,
    failure_path: Path,
    golden_candidate_path: Path | None = None,
    blocks: tuple[str, ...],
    fast: bool,
) -> None:
    event = build_wide_event(result, blocks=blocks, fast=fast)
    append_ledger(event_path, event)
    failure = build_failure_sample(result, event)
    if failure:
        append_ledger(failure_path, failure)
        if golden_candidate_path:
            append_golden_candidate(golden_candidate_path, build_golden_candidate_from_failure(failure))


def _latest_business_record(records: list[dict[str, Any]]) -> dict[str, Any]:
    business = [r for r in records if r["block_id"] in BLOCKS]
    return business[-1] if business else records[0]


def build_business_case_event(result: dict[str, Any], *, owner: str | None = None) -> dict[str, Any]:
    gate = result["quality_gate"]
    latest = _latest_business_record(result["records"])
    if gate["status"] != "passed":
        status = "blocked"
        light = "red"
        headline = "禁止对外承诺"
        next_action = latest.get("next_action") or "修复阻塞项并补齐证据"
    elif gate["human_signoff_required"]:
        status = "awaiting_human_signoff"
        light = "yellow"
        headline = "可继续澄清，报价/交期/安全需签字"
        next_action = "人工确认后再进入客户方案、报价或交期沟通"
    else:
        status = "ready_for_action"
        light = "green"
        headline = "可继续跟进"
        next_action = latest.get("next_action") or "执行下一步"
    forbidden = []
    if gate["human_signoff_required"] or gate["status"] != "passed":
        forbidden = ["禁止报价", "禁止承诺交期", "禁止承诺安全/性能能力"]
    return {
        "event_type": "business_case_state",
        "timestamp": result["created_at"],
        "case_id": result["case_id"],
        "task": result["input"].get("task", ""),
        "source": result["input"].get("source", ""),
        "success_metric": result["input"].get("success_metric", ""),
        "status": status,
        "light": light,
        "headline": headline,
        "why": "; ".join(gate["reasons"]) or "质量门禁通过",
        "next_action": next_action,
        "owner": owner or result["input"].get("owner") or "未指定",
        "forbidden_actions": forbidden,
        "outcome": None,
        "customer_response": "",
        "lesson": "",
        "gate_status": gate["status"],
        "gate_score": gate["score"],
        "source_event": result["created_at"],
    }


def append_business_event(path: Path, event: dict[str, Any]) -> None:
    append_ledger(path, event)


def load_business_cases(path: Path) -> dict[str, dict[str, Any]]:
    if not path.exists():
        return {}
    cases: dict[str, dict[str, Any]] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        event = json.loads(line)
        case_id = event["case_id"]
        current = dict(cases.get(case_id, {}))
        current.update(event)
        cases[case_id] = current
    return cases


def build_business_transition(
    path: Path,
    *,
    case_id: str,
    action: str,
    owner: str | None = None,
    note: str = "",
    outcome: str | None = None,
    customer_response: str = "",
    lesson: str = "",
) -> dict[str, Any]:
    current = load_business_cases(path).get(case_id)
    if not current:
        raise SystemExit(f"unknown business case: {case_id}")
    event = {
        "event_type": "business_case_transition",
        "timestamp": _now(),
        "case_id": case_id,
        "owner": owner or current.get("owner", "未指定"),
        "note": note,
    }
    if action == "mark_actioned":
        event.update(
            {
                "status": "actioned",
                "light": "yellow",
                "headline": "已执行销售动作",
                "next_action": "等待客户反馈",
            }
        )
    elif action == "record_feedback":
        if outcome not in OUTCOMES:
            raise SystemExit(f"invalid outcome: {outcome}. valid: {', '.join(OUTCOMES)}")
        event.update(
            {
                "status": "customer_feedback",
                "light": "green" if outcome in {"needs_full_proposal", "quoted", "won"} else "yellow",
                "headline": "已记录客户反馈",
                "outcome": outcome,
                "customer_response": customer_response,
                "next_action": "归档结果并判断是否进入完整方案/报价" if outcome != "no_response" else "设置跟进提醒",
            }
        )
    elif action == "archive":
        event.update(
            {
                "status": "archived",
                "light": "green",
                "headline": "已入史馆归档",
                "lesson": lesson or note,
                "next_action": "进入史馆复盘；必要时转 golden case 候选",
            }
        )
    else:
        raise SystemExit(f"unknown business action: {action}")
    return event


def format_business_cards(cases: dict[str, dict[str, Any]]) -> str:
    if not cases:
        return "暂无业务闭环记录"
    lines: list[str] = []
    for case_id, case in sorted(cases.items()):
        lines.append(
            f"{case.get('light', 'gray').upper()} {case_id} · {case.get('status', 'unknown')} · "
            f"{case.get('headline', case.get('note', ''))}"
        )
        lines.append(f"  负责人: {case.get('owner', '未指定')}")
        lines.append(f"  下一步: {case.get('next_action', '未指定')}")
        if case.get("outcome"):
            lines.append(f"  Outcome: {case['outcome']}")
        if case.get("forbidden_actions"):
            lines.append(f"  禁止: {' / '.join(case['forbidden_actions'])}")
    return "\n".join(lines)


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def _score_axis(score: int, evidence: str) -> dict[str, Any]:
    return {"score": score, "evidence": evidence}


def build_board_review(
    *,
    business_path: Path,
    event_path: Path,
    failure_path: Path,
    golden_candidate_path: Path,
) -> dict[str, Any]:
    business_cases = load_business_cases(business_path)
    events = read_jsonl(event_path)
    failures = read_jsonl(failure_path)
    candidates = load_golden_candidate_states(golden_candidate_path)
    pending_candidates = [c for c in candidates.values() if c.get("promotion_status") == "needs_human_review"]
    promoted_candidates = [c for c in candidates.values() if c.get("promotion_status") == "promoted"]
    rejected_candidates = [c for c in candidates.values() if c.get("promotion_status") == "rejected"]
    archived = [case for case in business_cases.values() if case.get("status") == "archived"]
    active = [case for case in business_cases.values() if case.get("status") != "archived"]
    blocked = [case for case in business_cases.values() if case.get("light") == "red"]
    signoff = [case for case in business_cases.values() if case.get("forbidden_actions")]
    has_learning = bool(candidates or archived)
    has_observability = bool(events or failures)
    level = "L4 Closed-loop" if business_cases and has_observability and has_learning else "L3 Evidence-backed"
    if not business_cases:
        level = "L2 Operational"
    if not has_observability:
        level = "L2 Operational"
    scores = {
        "product_job": _score_axis(4, "线索到报价前判断、人工签字、归档复盘的工作边界清晰。"),
        "evidence_grounding": _score_axis(4 if has_observability else 3, "质量门包含 traceability、number_grounding、ungrounded_numbers。"),
        "workflow_power": _score_axis(4 if business_cases else 3, "业务状态可从 ready/actioned/feedback/archive 串起来。"),
        "state_machine": _score_axis(4, "blocked、awaiting_human_signoff、ready_for_action、customer_feedback、archived 已显式建模。"),
        "advisor_quality": _score_axis(4, "产品、可观测性、质量系统、朝堂视觉职责已纳入评审口径。"),
        "toolchain": _score_axis(4 if has_observability else 3, "pytest、py_compile、JSONL ledger、failure samples、golden candidates 可组合验证。"),
        "ui_clarity": _score_axis(3, "CLI 卡片能告诉下一步，但还缺真实首屏/仪表盘。"),
        "learning_loop": _score_axis(4 if has_learning else 3, "失败和业务结果能进入 needs_human_review 的 golden 候选。"),
        "safety_governance": _score_axis(4 if signoff else 3, "报价、交期、安全能力会触发人工签字和 forbidden_actions。"),
    }
    missing = [
        "缺少真正面向小白用户的首屏仪表盘：红黄绿、负责人、下一步、禁止动作应一眼可见。",
        "golden candidate 已有人工晋升/拒绝闸门；下一步要接外部审批和批量复核。" if candidates else "golden candidate 还没有生产样本输入。",
        "生产上线还缺账号权限、成本记录、Sentry/日志入口和真实客户事件关联。",
    ]
    build = [
        "把 business cards 接到朝堂呈现层首屏，默认显示 active cases 和下一步动作。",
        "把 golden candidate promote/reject 接到外部审批，显示 reference、must_not 和审计记录。",
        "把 run_id、owner、case_id、provider/model、latency、gate reason 接入生产可观测后端。",
    ]
    verify = [
        "pytest -q tests/test_commercial_loop_harness.py",
        "python -m py_compile harness/chaotang-commercial-loop/scripts/run_harness.py tests/test_commercial_loop_harness.py",
        "python harness/chaotang-commercial-loop/scripts/run_harness.py --review-board",
    ]
    return {
        "board": "chaotang-commercial-loop",
        "maturity_level": level,
        "counts": {
            "business_cases": len(business_cases),
            "active_cases": len(active),
            "archived_cases": len(archived),
            "blocked_cases": len(blocked),
            "events": len(events),
            "failures": len(failures),
            "golden_candidates": len(candidates),
            "pending_golden_candidates": len(pending_candidates),
            "promoted_golden_candidates": len(promoted_candidates),
            "rejected_golden_candidates": len(rejected_candidates),
        },
        "scores": scores,
        "missing": missing,
        "build": build,
        "verify": verify,
        "advisor_notes": {
            "zhang_xiaolong": "减少解释，把下一步变成默认动作；小白不该研究参数。",
            "charity_majors": "wide events 是对的，但上线后必须能按 case、owner、model、gate reason 切长尾。",
            "deming": "不要用分数惩罚人，用 outcome 对账改系统；候选样本必须有人审。",
            "visual_director": "朝堂隐喻应表达职责和流转，不应替代状态、证据和行动。",
        },
    }


def format_board_review(review: dict[str, Any]) -> str:
    lines = [
        f"板块: {review['board']}",
        f"成熟度: {review['maturity_level']}",
        "计数: "
        + ", ".join(f"{key}={value}" for key, value in review["counts"].items()),
        "",
        "评分:",
    ]
    for axis, item in review["scores"].items():
        lines.append(f"  {axis}: {item['score']}/5 · {item['evidence']}")
    lines.append("")
    lines.append("主要缺口:")
    lines.extend(f"  - {item}" for item in review["missing"])
    lines.append("")
    lines.append("下一步构建:")
    lines.extend(f"  - {item}" for item in review["build"])
    lines.append("")
    lines.append("验证:")
    lines.extend(f"  - {item}" for item in review["verify"])
    lines.append("")
    lines.append("大神评语:")
    for name, note in review["advisor_notes"].items():
        lines.append(f"  {name}: {note}")
    return "\n".join(lines)


def _parse_blocks(blocks: str | None) -> tuple[str, ...]:
    if not blocks:
        return BLOCKS
    selected = tuple(part.strip() for part in blocks.split(",") if part.strip())
    invalid = [block for block in selected if block not in BLOCKS]
    if invalid:
        raise SystemExit(f"invalid --blocks value: {', '.join(invalid)}")
    if not selected:
        raise SystemExit("--blocks cannot be empty")
    return selected


def run_case(
    case: dict[str, Any],
    *,
    mode: str,
    write_ledger: bool,
    ledger: Path,
    block_timeout_seconds: int = DEFAULT_BLOCK_TIMEOUT_SECONDS,
    blocks: tuple[str, ...] = BLOCKS,
    fast: bool = False,
) -> dict[str, Any]:
    records: list[BlockRecord] = []
    upstream = case["task"]
    for block_id in blocks:
        if mode == "dry-run":
            record = dry_run_block(block_id, case, upstream)
        else:
            record = real_run_block_with_timeout(block_id, case, upstream, block_timeout_seconds, fast=fast)
        records.append(record)
        upstream = record.output
        if record.status != "passed":
            break

    gate = evaluate_gate(records, case)
    archive = BlockRecord(
        block_id="archive",
        status="passed" if gate.status == "passed" else "blocked",
        owner="史馆",
        input=records[-1].output,
        output="已生成可回放账本记录" if write_ledger else "账本写入已跳过",
        evidence=[Evidence(source="quality_gate", claim=json.dumps(asdict(gate), ensure_ascii=False), timestamp=_now())],
        assumptions=["史馆记录用于回测，不等于客户承诺"],
        confidence=0.9,
        next_action="等待真实结果回填并证伪关键假设",
    )
    report_data = build_report(case, records, gate)
    report = BlockRecord(
        block_id="report",
        status="passed",
        owner="礼部",
        input=archive.output,
        output=json.dumps(report_data, ensure_ascii=False),
        evidence=[Evidence(source="records", claim=f"{len(records)} commercial records", timestamp=_now())],
        assumptions=["报告是内部摘要，正式对外前需人工审阅"],
        confidence=0.86,
        next_action="人工确认后发给老板/客户/销售",
    )
    all_records = records + [archive, report]
    status = "passed" if gate.status == "passed" else "blocked"
    result = {
        "case_id": case["case_id"],
        "mode": mode,
        "status": status,
        "created_at": _now(),
        "input": {
            "task": case["task"],
            "source": case["source"],
            "owner": case["owner"],
            "success_metric": case["success_metric"],
        },
        "records": [asdict(r) for r in all_records],
        "quality_gate": asdict(gate),
        "report": report_data,
    }
    if write_ledger:
        append_ledger(ledger, result)
    return result


def select_cases(case_id: str | None, all_cases: bool) -> list[dict[str, Any]]:
    cases = load_cases()
    if all_cases:
        return cases
    if case_id:
        matched = [c for c in cases if c["case_id"] == case_id]
        if not matched:
            raise SystemExit(f"unknown case_id: {case_id}")
        return matched
    return [cases[0]]


def main() -> int:
    parser = argparse.ArgumentParser(description="Run Chaotang commercial loop harness")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="Run deterministic harness without model calls")
    mode.add_argument("--real", action="store_true", help="Call real FlowEngine flows")
    parser.add_argument("--case-id", help="Run one golden case")
    parser.add_argument("--all", action="store_true", help="Run all golden cases")
    parser.add_argument("--ledger", type=Path, default=DEFAULT_LEDGER, help="Ledger JSONL path")
    parser.add_argument("--events", type=Path, default=DEFAULT_EVENTS, help="Wide event JSONL path")
    parser.add_argument("--failures", type=Path, default=DEFAULT_FAILURES, help="Failure sample JSONL path")
    parser.add_argument("--business-ledger", type=Path, default=DEFAULT_BUSINESS_LEDGER, help="Business loop JSONL path")
    parser.add_argument(
        "--golden-candidates",
        type=Path,
        default=DEFAULT_GOLDEN_CANDIDATES,
        help="Golden candidate JSONL path",
    )
    parser.add_argument("--golden-cases", type=Path, default=CASES_PATH, help="Formal golden cases JSON path")
    parser.add_argument("--no-write-ledger", action="store_true", help="Do not append archive ledger")
    parser.add_argument("--no-write-events", action="store_true", help="Do not append observability events")
    parser.add_argument("--no-write-business", action="store_true", help="Do not append business case state")
    parser.add_argument("--no-write-golden-candidates", action="store_true", help="Do not append golden candidates")
    parser.add_argument(
        "--block-timeout",
        type=int,
        default=DEFAULT_BLOCK_TIMEOUT_SECONDS,
        help="Per-block timeout in seconds for --real mode",
    )
    parser.add_argument(
        "--blocks",
        help="Comma-separated subset/order of commercial blocks: lead,opc,product,quotation",
    )
    parser.add_argument(
        "--fast",
        action="store_true",
        help="For --real mode, run first-judgment fast flow instead of full flow",
    )
    parser.add_argument("--owner", help="Override business case owner")
    parser.add_argument("--list-business", action="store_true", help="Print current business case cards")
    parser.add_argument("--list-golden-candidates", action="store_true", help="Print pending golden candidates")
    parser.add_argument("--review-board", action="store_true", help="Print board maturity review and advisor notes")
    parser.add_argument("--promote-golden", metavar="CANDIDATE_ID", help="Promote a reviewed golden candidate")
    parser.add_argument("--reject-golden", metavar="CANDIDATE_ID", help="Reject a golden candidate")
    parser.add_argument("--reviewer", default="史馆", help="Golden candidate reviewer")
    parser.add_argument("--reference", default="", help="Human reference for promotion; use | to separate bullets")
    parser.add_argument("--mark-actioned", metavar="CASE_ID", help="Mark a business case as actioned")
    parser.add_argument("--record-feedback", metavar="CASE_ID", help="Record customer feedback for a business case")
    parser.add_argument("--archive-case", metavar="CASE_ID", help="Archive a business case outcome")
    parser.add_argument("--note", default="", help="Business transition note")
    parser.add_argument("--customer-response", default="", help="Customer response text")
    parser.add_argument("--outcome", choices=OUTCOMES, help="Business outcome")
    parser.add_argument("--lesson", default="", help="Archive lesson")
    parser.add_argument("--json", action="store_true", help="Print full JSON result")
    args = parser.parse_args()

    if args.list_business:
        cases = load_business_cases(args.business_ledger)
        print(json.dumps(cases, ensure_ascii=False, indent=2) if args.json else format_business_cards(cases))
        return 0

    if args.list_golden_candidates:
        if not args.golden_candidates.exists():
            print("暂无 golden 候选")
            return 0
        lines = list(load_golden_candidate_states(args.golden_candidates).values())
        print(json.dumps(lines, ensure_ascii=False, indent=2))
        return 0

    golden_review_candidate_id = args.promote_golden or args.reject_golden
    if golden_review_candidate_id:
        event = review_golden_candidate(
            candidate_path=args.golden_candidates,
            golden_cases_path=args.golden_cases,
            candidate_id=golden_review_candidate_id,
            status="promoted" if args.promote_golden else "rejected",
            reviewer=args.reviewer,
            note=args.note,
            reference=args.reference,
        )
        print(json.dumps(event, ensure_ascii=False, indent=2))
        return 0

    if args.review_board:
        review = build_board_review(
            business_path=args.business_ledger,
            event_path=args.events,
            failure_path=args.failures,
            golden_candidate_path=args.golden_candidates,
        )
        print(json.dumps(review, ensure_ascii=False, indent=2) if args.json else format_board_review(review))
        return 0

    transition_case_id = args.mark_actioned or args.record_feedback or args.archive_case
    if transition_case_id:
        action = "mark_actioned" if args.mark_actioned else "record_feedback" if args.record_feedback else "archive"
        event = build_business_transition(
            args.business_ledger,
            case_id=transition_case_id,
            action=action,
            owner=args.owner,
            note=args.note,
            outcome=args.outcome,
            customer_response=args.customer_response,
            lesson=args.lesson,
        )
        append_business_event(args.business_ledger, event)
        if action == "archive" and not args.no_write_golden_candidates:
            merged = load_business_cases(args.business_ledger).get(transition_case_id, event)
            append_golden_candidate(args.golden_candidates, build_golden_candidate_from_business(merged))
        print(json.dumps(event, ensure_ascii=False, indent=2) if args.json else format_business_cards({event["case_id"]: event}))
        return 0

    run_mode = "real" if args.real else "dry-run"
    selected_blocks = _parse_blocks(args.blocks)
    results = [
        run_case(
            c,
            mode=run_mode,
            write_ledger=not args.no_write_ledger,
            ledger=args.ledger,
            block_timeout_seconds=args.block_timeout,
            blocks=selected_blocks,
            fast=args.fast,
        )
        for c in select_cases(args.case_id, args.all)
    ]
    if not args.no_write_events:
        for result in results:
            write_observability_events(
                result,
                event_path=args.events,
                failure_path=args.failures,
                golden_candidate_path=None if args.no_write_golden_candidates else args.golden_candidates,
                blocks=selected_blocks,
                fast=args.fast,
            )
    if not args.no_write_business:
        for result in results:
            append_business_event(
                args.business_ledger,
                build_business_case_event(result, owner=args.owner),
            )
    if args.json:
        print(json.dumps(results if args.all else results[0], ensure_ascii=False, indent=2))
    else:
        for result in results:
            gate = result["quality_gate"]
            print(
                f"{result['case_id']}: {result['status']} · gate={gate['status']} "
                f"score={gate['score']} trace={gate['traceability']} grounding={gate['number_grounding']}"
            )
    return 0 if all(r["status"] == "passed" for r in results) else 2


if __name__ == "__main__":
    raise SystemExit(main())
