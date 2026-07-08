"""export_report 健壮性回归 — 非 pack_rd 蜂群(quality_score/qa_result 为 null)导出不得崩溃。

会审 caveat#2:render_risk_card/render_qa 假设 quality_score 是 dict,
但 finance 等蜂群的 run_meta 里 quality_score=null → 旧代码 AttributeError。
本测试锁定 export_run 对 null 字段的兜底。同时验证不可逆 flow 的签字横幅注入。
"""

from __future__ import annotations

import json

import scripts.export_report as er


def _make_run(runs_dir, run_id, flow_name, config_path, quality_score, qa_result):
    rd = runs_dir / run_id
    rd.mkdir(parents=True)
    (rd / "run_meta.json").write_text(
        json.dumps(
            {
                "run_id": run_id,
                "task_input": "测试任务",
                "flow_name": flow_name,
                "config_path": config_path,
                "quality_score": quality_score,
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    (rd / "final_output.json").write_text(
        json.dumps(
            {"qa_result": qa_result, "final_output": {"结论": "示例结论"}},
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    return rd


def test_export_does_not_crash_on_null_quality_score(tmp_path, monkeypatch):
    monkeypatch.setattr(er, "RUNS_DIR", tmp_path / "runs")
    monkeypatch.setattr(er, "REPORTS_DIR", tmp_path / "reports")
    _make_run(
        tmp_path / "runs",
        "20260622_000001_000001",
        "财务分析流程",
        "config/flow_finance.yaml",
        quality_score=None,  # 旧代码在此 AttributeError
        qa_result=None,
    )
    out = er.export_run("20260622_000001_000001")
    html = out.read_text(encoding="utf-8")
    assert "测试任务" in html
    # finance 是不可逆 flow → 顶部应有未签字红幅(以 signed_decisions.jsonl 为真值源,无签字记录)
    assert "未签字（ADVISORY 草案）" in html


def test_export_reversible_flow_has_no_signoff_banner(tmp_path, monkeypatch):
    monkeypatch.setattr(er, "RUNS_DIR", tmp_path / "runs")
    monkeypatch.setattr(er, "REPORTS_DIR", tmp_path / "reports")
    _make_run(
        tmp_path / "runs",
        "20260622_000002_000002",
        "IMA知识蜂群",
        "config/flow_ima.yaml",
        quality_score=None,
        qa_result=None,
    )
    out = er.export_run("20260622_000002_000002")
    html = out.read_text(encoding="utf-8")
    assert "不可逆决策" not in html  # 可逆 flow 不打扰
