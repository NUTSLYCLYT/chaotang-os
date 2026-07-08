#!/usr/bin/env python3
"""彩排单蜂群：跑一条 flow，输出一行结构化 JSON 结果（供准备度报告聚合）。

用法: python scripts/smoke_one.py <flow.yaml> "<工单>"
输出（stdout 最后一行，SMOKE_RESULT 前缀）：
  SMOKE_RESULT {"swarm":...,"status":...,"steps_ok":...,"grade":...,"repair_rounds":...,"qa_parsed":...,"error":...}
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# 加载 .env（DeepSeek key 等）
_envf = ROOT / ".env"
if _envf.exists():
    for _ln in _envf.read_text(encoding="utf-8").splitlines():
        _ln = _ln.strip()
        if _ln and not _ln.startswith("#") and "=" in _ln:
            _k, _v = _ln.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip())


def main() -> int:
    flow_path, task_input = sys.argv[1], sys.argv[2]
    swarm = Path(flow_path).stem.replace("flow_", "")
    res = {
        "swarm": swarm,
        "status": "error",
        "steps_total": 0,
        "steps_ok": 0,
        "grade": None,
        "total_score": None,
        "qa_parsed": False,
        "repair_rounds": 0,
        "elapsed_s": 0,
        "error": None,
    }
    t0 = time.time()
    try:
        from src.flow_engine import FlowEngine

        eng = FlowEngine(flow_path)
        if eng.config.get("repair", {}).get("enabled"):
            log, hist = eng.run_with_repair(task_input)
            if hist is not None:
                res["repair_rounds"] = len(getattr(hist, "rounds", []) or [])
        else:
            log = eng.run(task_input)

        res["status"] = log.run_status
        res["steps_total"] = len(log.steps)
        res["steps_ok"] = sum(1 for s in log.steps if s.status in ("ok", "success", "completed"))
        # 员工真正看到的是 final_output —— 这才是首要准备度信号
        fo = log.final_output or {}
        res["final_output_fields"] = len(fo) if isinstance(fo, dict) else 0
        res["has_output"] = bool(fo)
        qs = log.quality_score or {}
        if qs:
            res["qa_parsed"] = True
            res["grade"] = qs.get("grade")
            res["total_score"] = qs.get("total_score")
    except Exception as e:  # noqa: BLE001
        import traceback

        res["error"] = f"{type(e).__name__}: {e}"
        res["trace"] = traceback.format_exc()[-800:]
    res["elapsed_s"] = round(time.time() - t0, 1)
    print("SMOKE_RESULT " + json.dumps(res, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
