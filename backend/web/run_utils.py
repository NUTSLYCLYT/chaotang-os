"""跨 router 复用的运行/Step 辅助函数。

从 web/app.py 抽取，保持 FastAPI 与 Flask 两个版本的行为完全一致。
"""

from __future__ import annotations

import json
import re
import threading
from datetime import datetime
from pathlib import Path
from typing import Any

# ── 字段长度阈值（用于 has_final_output complete 判定）────────

FIELD_THRESHOLDS: dict[str, int] = {
    "客户背景": 20,
    "核心需求": 20,
    "市场分析": 50,
    "竞品情况": 50,
    "解决方案": 80,
    "客户价值": 30,
    "风险与建议": 30,
    "线索评分": 20,
    "客户档案": 40,
    "触达策略": 30,
    "沟通话术": 40,
    "营销内容": 40,
    "分发计划": 30,
    "机会评估": 30,
    "竞品分析": 50,
    "产品定义": 40,
    "技术规格": 50,
    "成本定价": 30,
    "开发计划": 30,
    "合规路径": 30,
    "项目概要": 20,
    "系统配置": 40,
    "技术参数表": 60,
    "报价明细": 60,
    "合同条款": 40,
    "系统健康": 30,
    "成本分析": 30,
    "优化提案": 40,
    "测试方案": 40,
    "风险评估": 30,
    "实施建议": 30,
}
DEFAULT_SHORT_THRESHOLD = 30


# ── Flow 执行并发控制（与旧 web/app.py 一致）────────────────

flow_semaphore = threading.Semaphore(2)


# ── 运行级辅助 ────────────────────────────────────────────


def compute_run_status(run_log) -> str:
    """统一状态判定。pass / fail / partial。"""
    qa = run_log.qa_result or {}
    qa_result = qa.get("qa_result")

    if any(s.status == "error" for s in run_log.steps):
        return "fail"

    if qa_result == "fail":
        return "fail"

    if run_log.final_output:
        total = len(run_log.final_output)
        filled = sum(1 for v in run_log.final_output.values() if v and str(v).strip())
        if total > 0 and filled < total:
            return "partial"
    elif run_log.steps:
        return "partial"

    if qa_result == "pass":
        return "pass"

    return "partial"


def parse_run_meta(run_log) -> dict[str, Any]:
    """从 run_log 和 run_meta.json 解析元信息。"""
    from src.step_log import get_run_dir

    run_id = run_log.run_id
    m = re.search(r"_rerun_from_(\d+)$", run_id)
    is_rerun = m is not None
    from_step = int(m.group(1)) if m else None

    run_dir = get_run_dir(run_id)
    meta_path = run_dir / "run_meta.json" if run_dir is not None else None
    source_run_id = None
    prompt_versions = {}
    quality_score = None
    from_step_id = None
    if meta_path and meta_path.exists():
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        source_run_id = meta.get("source_run_id")
        if meta.get("from_step") is not None:
            from_step = meta["from_step"]
        prompt_versions = meta.get("prompt_versions", {})
        quality_score = meta.get("quality_score")
        from_step_id = meta.get("from_step_id")
        if meta.get("run_type", "").startswith("rerun"):
            is_rerun = True

    return {
        "run_type": "rerun" if is_rerun else "normal",
        "from_step": from_step,
        "from_step_id": from_step_id,
        "source_run_id": source_run_id,
        "prompt_versions": prompt_versions,
        "quality_score": quality_score,
    }


def make_preview(output: str, step_id: str) -> str:
    """智能输出摘要：QA 步骤特殊处理，其他取首行 80 字。"""
    text = (output or "").strip()
    if step_id == "qa_tech_support" and text.startswith("{"):
        try:
            parsed = json.loads(text)
            qr = parsed.get("qa_result", "?")
            ic = len(parsed.get("issues", []))
            qs = parsed.get("quality_score", {}) or {}
            grade = qs.get("grade", "?")
            return f"QA: {qr}, grade: {grade}, issues: {ic}"
        except json.JSONDecodeError:
            pass
    for line in text.split("\n"):
        line = line.strip()
        if line and not line.startswith("---"):
            return line[:80]
    return text[:80]


def step_cmp_data(s) -> dict[str, Any]:
    return {
        "agent_name": s.agent_name,
        "status": s.status,
        "source": s.source,
        "model": s.model,
        "prompt_version": s.prompt_version,
        "output_length": len(s.output),
        "output_preview": make_preview(s.output, s.step_id),
    }


def run_summary(run_log) -> dict[str, Any]:
    """构建 run 摘要 — 供 /api/runs 列表使用。"""
    meta = parse_run_meta(run_log)
    qa = run_log.qa_result or {}
    issues = qa.get("issues", [])
    created_at = run_log.steps[0].timestamp if run_log.steps else None
    finished_at = run_log.steps[-1].timestamp if run_log.steps else None
    try:
        if created_at and finished_at and created_at != finished_at:
            t0 = datetime.fromisoformat(created_at)
            t1 = datetime.fromisoformat(finished_at)
            duration_seconds = max(0, round((t1 - t0).total_seconds()))
        else:
            duration_seconds = None
    except Exception:
        duration_seconds = None

    run_status = compute_run_status(run_log)

    fo = run_log.final_output
    field_count = 0
    complete_field_count = 0
    if fo:
        for f, v in fo.items():
            field_count += 1
            val = str(v).strip() if v else ""
            thresh = FIELD_THRESHOLDS.get(f, DEFAULT_SHORT_THRESHOLD)
            if len(val) >= thresh:
                complete_field_count += 1

    step_summaries = []
    total_tokens = 0
    total_prompt_tokens = 0
    total_completion_tokens = 0
    for s in run_log.steps:
        preview = make_preview(s.output, s.step_id)
        usage = (s.raw_response or {}).get("usage", {})
        step_tokens = usage.get("total_tokens", 0) or 0
        prompt_tokens = usage.get("prompt_tokens", 0) or 0
        completion_tokens = usage.get("completion_tokens", 0) or 0
        total_tokens += step_tokens
        total_prompt_tokens += prompt_tokens
        total_completion_tokens += completion_tokens
        step_summaries.append(
            {
                "step_index": s.step_index,
                "step_id": s.step_id,
                "agent_name": s.agent_name,
                "status": s.status,
                "source": s.source,
                "model": s.model,
                "prompt_version": s.prompt_version,
                "output_length": len(s.output),
                "output_preview": preview,
                "tokens": step_tokens,
            }
        )

    quality_info = meta.get("quality_score") or {}

    return {
        "run_id": run_log.run_id,
        "run_type": meta["run_type"],
        "run_status": run_status,
        "flow_name": run_log.flow_name,
        "qa_result": qa.get("qa_result"),
        "quality_score": quality_info,
        "grade": quality_info.get("grade") if quality_info else None,
        "total_score": quality_info.get("total_score") if quality_info else None,
        "issues_count": len(issues),
        "task_input": run_log.task_input,
        "created_at": created_at,
        "finished_at": finished_at,
        "duration_seconds": duration_seconds,
        "source_run_id": meta["source_run_id"],
        "from_step": meta["from_step"],
        "step_count": len(run_log.steps),
        "has_final_output": fo is not None,
        "field_count": field_count,
        "complete_field_count": complete_field_count,
        "step_summaries": step_summaries,
        "total_tokens": total_tokens,
        "prompt_tokens": total_prompt_tokens,
        "completion_tokens": total_completion_tokens,
    }


# ── 反馈文件路径 ─────────────────────────────────────────


def feedback_path(run_id: str) -> Path:
    from src.step_log import _get_runs_dir

    return _get_runs_dir() / run_id / "feedback.json"


# ── 配置路径解析（rerun/repair 用）────────────────────────

_DEFAULT_CONFIG_PATH = str(
    Path(__file__).resolve().parent.parent / "config" / "flow_opc.yaml"
)


def resolve_config_path(run_id: str) -> str:
    """从 run_meta.json 读取 config_path，回退到 flow_opc.yaml。"""
    from src.step_log import RUNS_DIR

    meta_path = RUNS_DIR / run_id / "run_meta.json"
    if meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            cp = meta.get("config_path")
            if cp and Path(cp).exists():
                return cp
        except Exception:
            pass
    return _DEFAULT_CONFIG_PATH


def signoff_annotation(run_log) -> dict[str, Any]:
    """不可逆决策签字状态(非阻断标注)——交付口响应自带"不可逆·是否签字"。

    会审第②刀延伸:让 runs/throne 等交付端点的响应带上签字状态,前端可显式提示
    "未签字不得执行",与 export_report 横幅同源。读 signed_decisions.jsonl 真值源;
    任何异常一律 fail-safe 返回安全默认(irreversible=False),绝不让标注拖垮纯读端点。
    """
    safe = {
        "irreversible": False,
        "approved": False,
        "signer": None,
        "signed_at": None,
        "decision_type": "",
    }
    try:
        from src.decision_guard import signoff_for

        cfg = getattr(run_log, "config_path", None)
        if not cfg:
            cfg = resolve_config_path(run_log.run_id)
        return signoff_for(
            run_log.run_id,
            config_path=cfg,
            flow_name=getattr(run_log, "flow_name", None),
        )
    except Exception:  # noqa: BLE001
        return safe


# ── 损坏 run 的兜底摘要 ──────────────────────────────────


def broken_run_summary(run_id: str) -> dict[str, Any]:
    """list_runs 时 run 文件损坏的兜底返回（与旧版完全一致）。"""
    return {
        "run_id": run_id,
        "run_type": "unknown",
        "run_status": "error",
        "qa_result": None,
        "quality_score": None,
        "grade": None,
        "total_score": None,
        "issues_count": 0,
        "task_input": "(文件损坏或不完整)",
        "created_at": None,
        "source_run_id": None,
        "from_step": None,
        "step_count": 0,
        "has_final_output": False,
        "field_count": 0,
        "complete_field_count": 0,
        "step_summaries": [],
    }
