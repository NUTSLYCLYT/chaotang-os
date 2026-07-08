from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from src.chaotang_department_autosubmit import (
    build_run_log_payload,
    protocol_department_for_flow,
    submit_run_log,
)


@dataclass
class FakeRunLog:
    run_id: str = "auto-run-001"
    task_input: str = "实现一个安全 POC，并归档结果。"
    flow_name: str = "flow_sdlc.yaml"
    final_output: dict | None = None
    quality_score: dict | None = None
    run_status: str = "normal"


def test_maps_flow_departments_to_protocol_departments():
    assert protocol_department_for_flow("flow_sdlc.yaml") == "gongbu"
    assert protocol_department_for_flow("flow_finance.yaml") == "hubu"
    assert protocol_department_for_flow("flow_xiaohongshu.yaml") == "libu"
    assert protocol_department_for_flow("flow_ima.yaml") == "shiguan"


def test_builds_payload_from_run_log():
    run_log = FakeRunLog(
        final_output={"项目概要": "完成 OSV 安全门禁闭环。"},
        quality_score={"total_score": 4.6},
    )

    payload = build_run_log_payload(run_log, flow_name="flow_sdlc.yaml")

    assert payload["run_id"] == "auto-run-001"
    assert payload["department"] == "gongbu"
    assert payload["benefit_score"] == 4.6
    assert payload["evidence"][0]["source"] == "runs/auto-run-001/run_meta.json"
    assert "完成 OSV" in payload["summary"]


def test_submit_skips_when_not_enabled(tmp_path):
    result = submit_run_log(
        FakeRunLog(),
        enabled=False,
        json_out=tmp_path / "latest.json",
        md_out=tmp_path / "latest.md",
        ledger=tmp_path / "ledger.jsonl",
    )

    assert result["status"] == "skipped"
    assert not (tmp_path / "latest.json").exists()


def test_submit_writes_protocol_report_when_enabled(tmp_path):
    result = submit_run_log(
        FakeRunLog(final_output={"项目概要": "归档内部任务结果。"}),
        flow_name="flow_sdlc.yaml",
        enabled=True,
        json_out=tmp_path / "latest.json",
        md_out=tmp_path / "latest.md",
        ledger=tmp_path / "ledger.jsonl",
    )

    assert result["status"] == "submitted"
    stored = json.loads((tmp_path / "latest.json").read_text(encoding="utf-8"))
    assert stored["passed"] is True
    assert stored["results"][0]["department"] == "gongbu"
    assert (tmp_path / "ledger.jsonl").exists()
