"""不可逆产出锁 · 回归门(2026-07-08 会审Taleb):落地即标 PENDING_HUMAN_SIGNOFF。

宪法"未签字的不可逆决策下游不得执行"从注释变成在带数据——任何消费方拿到
不可逆蜂群的 final_output,都自带 _decision_guard.status=PENDING 标记。
"""

from types import SimpleNamespace

import src.swarm_orchestrator as so
from src.swarm_orchestrator import SwarmDef, SwarmOrchestrator


class _FakeEngine:
    def run(self, task_input, on_step_done=None, run_id=""):
        return SimpleNamespace(
            run_id="r1",
            task_input=task_input,
            quality_score={"total_score": 4.5},
            qa_result=None,
            final_output={"报价": "45万"},
            steps=[],
        )


def _orch(monkeypatch, tmp_path, swarm_id):
    monkeypatch.setattr(so, "SESSIONS_DIR", tmp_path)
    orch = SwarmOrchestrator()
    orch.register_swarm(SwarmDef(swarm_id=swarm_id, name=swarm_id, config_path="x.yaml"))
    orch._engines[swarm_id] = _FakeEngine()
    return orch


def test_irreversible_output_marked_pending(monkeypatch, tmp_path):
    orch = _orch(monkeypatch, tmp_path, "quotation")  # decision_guard 登记的不可逆蜂群
    orch.run_single("quotation", "给客户报个价")
    rec = orch._session.swarm_runs[0]
    guard = rec.final_output["_decision_guard"]
    assert guard["status"] == "PENDING_HUMAN_SIGNOFF"
    assert "签字" in guard["advisory"]
    assert rec.final_output["报价"] == "45万", "业务字段原样保留(加法式标记)"


def test_reversible_output_unmarked(monkeypatch, tmp_path):
    orch = _orch(monkeypatch, tmp_path, "opc")  # 可逆蜂群不标,避免签字疲劳
    orch.run_single("opc", "做个市场方案")
    assert "_decision_guard" not in orch._session.swarm_runs[0].final_output
