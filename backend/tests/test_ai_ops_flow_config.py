from pathlib import Path

import yaml

from src.flow_engine import _build_ai_ops_final_output


ROOT = Path(__file__).resolve().parent.parent


def test_ai_ops_uses_quality_baseline_inject():
    cfg = yaml.safe_load((ROOT / "config" / "flow_ai_ops.yaml").read_text(encoding="utf-8"))

    assert cfg["knowledge_inject"]["file"] == "config/ops_snapshot.yaml"


def test_ai_ops_has_no_openclaw_hard_dependency():
    cfg = yaml.safe_load((ROOT / "config" / "flow_ai_ops.yaml").read_text(encoding="utf-8"))

    assert all(step.get("step_type") != "openclaw" for step in cfg["steps"])


def test_ai_ops_fallback_output_contains_evidence():
    snapshot = {
        "meta": {"generated_at": "2026-06-07T00:00:00Z", "source_files": ["data/default/runs/*/run_meta.json"]},
        "coverage": {"flow_count": 29, "registered_count": 17, "baseline_count": 14, "missing_baseline": ["demo"]},
        "quality": {
            "threshold": 7.0,
            "avg_quality_score_10pt": 5.5,
            "median_quality_score_10pt": 5.75,
            "red_light_count": 1,
            "red_lights": [{"id": "ai_ops", "quality_score": 1.0}],
        },
        "cost": {"input_tokens": 1000, "output_tokens": 500, "cost_usd": 0.01, "note": "step logs"},
        "swarms": {
            "ai_ops": {
                "quality_score_10pt": 1.0,
                "run_logs": {
                    "runs": 15,
                    "completed": 10,
                    "success_rate": 0.6667,
                    "avg_run_quality_5pt": 2.09,
                    "latest": {"run_id": "run-aiops"},
                    "cost": {"input_tokens": 100, "output_tokens": 50, "cost_usd": 0.001, "duration_seconds": 12},
                },
            },
            "opc": {
                "quality_score_10pt": 4.5,
                "run_logs": {
                    "runs": 56,
                    "completed": 44,
                    "success_rate": 0.7857,
                    "avg_run_quality_5pt": 2.97,
                    "latest": {"run_id": "run-opc"},
                    "cost": {"input_tokens": 200, "output_tokens": 80, "cost_usd": 0.002, "duration_seconds": 18},
                },
            },
        },
    }

    output = _build_ai_ops_final_output("巡检最近7天 opc 和 ai_ops 质量与成本", snapshot)

    assert set(output) == {"需求分析", "系统健康", "成本分析", "优化提案", "测试方案", "风险评估", "实施建议"}
    assert "run-aiops" in output["优化提案"]
    assert "success_rate=0.7857" in output["系统健康"]
    assert "最差蜂群TOP：ai_ops score=1.0 latest_run=run-aiops" in output["系统健康"]
    assert "cost_usd=0.01" in output["成本分析"]
