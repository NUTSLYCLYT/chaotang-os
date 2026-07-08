"""Optional auto-submit hook from real runs into the Chaotang department protocol."""

from __future__ import annotations

import importlib.util
import json
import os
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Any

from src.chaotang_department_payload import build_text_payload


ROOT = Path(__file__).resolve().parent.parent
PROTOCOL_RUNNER = ROOT / "harness" / "chaotang_department_protocol" / "scripts" / "run_protocol.py"
DEFAULT_JSON_OUT = ROOT / "harness" / "chaotang_department_protocol" / "artifacts" / "auto_submit_latest.json"
DEFAULT_MD_OUT = ROOT / "harness" / "chaotang_department_protocol" / "artifacts" / "auto_submit_latest.md"
DEFAULT_LEDGER = ROOT / "harness" / "chaotang_department_protocol" / "artifacts" / "auto_submit_ledger.jsonl"

FLOW_DEPARTMENT_MAP = {
    "chancellor": "qintianjian",
    "finance": "hubu",
    "legal": "xingbu",
    "product": "gongbu",
    "market": "libu",
    "ops": "gongbu",
    "historian": "shiguan",
    "guard": "jinyiwei",
    "astronomer": "qintianjian",
    "physician": "yushi",
}


def is_enabled(env: dict[str, str] | None = None) -> bool:
    env = env or os.environ
    return env.get("CHAOTANG_DEPARTMENT_AUTOSUBMIT", "").strip().lower() in {"1", "true", "yes", "on"}


def load_protocol_runner():
    spec = importlib.util.spec_from_file_location("chaotang_department_protocol_runner", PROTOCOL_RUNNER)
    if not spec or not spec.loader:
        raise RuntimeError("Cannot load department protocol runner")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def protocol_department_for_flow(flow_name: str | None) -> str:
    try:
        from src.chaotang_api import dept_of_flow

        ui_department = dept_of_flow(flow_name)
    except Exception:
        ui_department = "chancellor"
    return FLOW_DEPARTMENT_MAP.get(ui_department, "qintianjian")


def _summary_from_run_log(run_log: Any) -> str:
    final_output = getattr(run_log, "final_output", None)
    if isinstance(final_output, dict):
        for key in ("核心需求", "客户背景", "项目概要", "需求规格说明", "需求分析", "议题", "summary"):
            value = final_output.get(key)
            if value:
                return str(value)[:500]
        if final_output:
            return json.dumps(final_output, ensure_ascii=False)[:500]
    return str(getattr(run_log, "task_input", "") or "")[:500]


def _quality_benefit_score(run_log: Any) -> float:
    quality = getattr(run_log, "quality_score", None)
    if isinstance(quality, dict):
        for key in ("total_score", "score", "overall_score"):
            value = quality.get(key)
            if isinstance(value, int | float):
                return round(max(0.0, min(5.0, float(value))), 2)
    return 3.5


def build_run_log_payload(run_log: Any, *, flow_name: str | None = None) -> dict[str, Any]:
    department = protocol_department_for_flow(flow_name or getattr(run_log, "flow_name", None))
    run_id = str(getattr(run_log, "run_id", "unknown-run"))
    status = str(getattr(run_log, "run_status", "unknown"))
    evidence = [
        {"source": f"runs/{run_id}/run_meta.json", "status": status},
    ]
    if getattr(run_log, "final_output", None) is not None:
        evidence.append({"source": f"runs/{run_id}/final_output.json", "status": "ok"})
    payload = build_text_payload(
        department=department,
        summary=_summary_from_run_log(run_log),
        run_id=run_id,
        evidence=evidence,
        next_action="真实 flow 完成后自动进入部门协同协议和御史总判。",
        automation_level_requested="L2",
    )
    payload["benefit_score"] = _quality_benefit_score(run_log)
    payload["output_type"] = payload.get("output_type") or "flow_result"
    return payload


def submit_run_log(
    run_log: Any,
    *,
    flow_name: str | None = None,
    enabled: bool | None = None,
    json_out: Path = DEFAULT_JSON_OUT,
    md_out: Path = DEFAULT_MD_OUT,
    ledger: Path = DEFAULT_LEDGER,
) -> dict[str, Any]:
    if enabled is None:
        enabled = is_enabled()
    if not enabled:
        return {"status": "skipped", "reason": "CHAOTANG_DEPARTMENT_AUTOSUBMIT not enabled"}
    payload = build_run_log_payload(run_log, flow_name=flow_name)
    runner = load_protocol_runner()
    report = runner.build_report([{"case_id": payload["run_id"], "payload": payload}], runner.load_config())
    runner.write_report(report, json_out, md_out)
    runner.append_ledger(report, ledger)
    return {
        "status": "submitted",
        "payload": payload,
        "report": report,
        "json_out": str(json_out),
        "md_out": str(md_out),
        "ledger": str(ledger),
    }


def safe_submit_run_log(run_log: Any, *, flow_name: str | None = None, enabled: bool | None = None) -> dict[str, Any]:
    try:
        return submit_run_log(run_log, flow_name=flow_name, enabled=enabled)
    except Exception as exc:
        return {"status": "error", "error": str(exc)}
