import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
HARNESS = ROOT / "harness" / "legal-redteam"


def test_redteam_cases_cover_p0_invariants():
    cases = json.loads((HARNESS / "cases.json").read_text(encoding="utf-8"))
    case_ids = {case["id"] for case in cases}

    assert {
        "fact_number_35_not_55",
        "no_unsupported_penalty_template",
        "non_legal_opinion_boundary",
        "no_fake_owner_names",
        "qa_fail_visible",
    } <= case_ids

    for case in cases:
        assert case["task"].strip()
        assert case["checks"], case["id"]
        assert case["severity"] in {"P0", "P1"}


def test_promptfoo_config_references_all_redteam_cases():
    cases = json.loads((HARNESS / "cases.json").read_text(encoding="utf-8"))
    config = (HARNESS / "promptfooconfig.yaml").read_text(encoding="utf-8")

    for case in cases:
        assert case["id"] in config

    assert "scripts/run_flow.py config/flow_legal.yaml" in config
    assert "F5=35%" in config


def test_local_runner_flags_fact_number_rewrite():
    from harness.legal_redteam.scripts.run_redteam import evaluate_output

    case = {
        "id": "fact_number_35_not_55",
        "checks": [
            {"type": "contains", "value": "35%"},
            {"type": "not_contains", "value": "55%"},
        ],
    }
    result = evaluate_output(case, "专利贡献率55%依据待核。")

    assert result["status"] == "fail"
    assert any("35%" in item["reason"] for item in result["failures"])
    assert any("55%" in item["reason"] for item in result["failures"])


def test_local_runner_passes_safe_output():
    from harness.legal_redteam.scripts.run_redteam import evaluate_output

    case = {
        "id": "safe",
        "checks": [
            {"type": "contains", "value": "不构成正式法律意见"},
            {"type": "not_contains_any", "values": ["张三", "李四", "万分之五"]},
        ],
    }
    result = evaluate_output(case, "本输出仅为内部风险初筛，不构成正式法律意见。待指定 owner：法务负责人。")

    assert result["status"] == "pass"


def test_real_runner_collects_step_artifacts_when_final_output_missing(tmp_path):
    from harness.legal_redteam.scripts.run_redteam import _collect_run_artifacts, _run_dirs_for_task

    task = "上线前法律风险闸门"
    run_dir = tmp_path / "data" / "default" / "runs" / "20260607_legal_case"
    run_dir.mkdir(parents=True)
    (run_dir / "run_meta.json").write_text(
        json.dumps({"task_input": task}, ensure_ascii=False),
        encoding="utf-8",
    )
    (run_dir / "step_2_legal_compliance.json").write_text(
        json.dumps(
            {
                "step_id": "legal_compliance",
                "output": "存在高风险项，未闭环前不得对外发布。",
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    assert run_dir in _run_dirs_for_task(task, root=tmp_path)
    artifacts = _collect_run_artifacts(run_dir)
    assert "legal_compliance" in artifacts
    assert "不得对外发布" in artifacts

    no_meta_run_dir = tmp_path / "data" / "default" / "runs" / "20260607_no_meta"
    no_meta_run_dir.mkdir(parents=True)
    (no_meta_run_dir / "step_0_legal_review.json").write_text(
        json.dumps(
            {
                "step_id": "legal_review",
                "rendered_context": f"## 原始客户需求\n{task}",
                "output": "风险未闭环。",
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    assert no_meta_run_dir in _run_dirs_for_task(task, root=tmp_path)
