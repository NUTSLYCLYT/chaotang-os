from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import yaml

from src.chaotang_department_payload import build_text_payload, normalize_department

ROOT = Path(__file__).resolve().parents[1]
HARNESS = ROOT / "harness" / "chaotang_department_protocol"
RUNNER_PATH = HARNESS / "scripts" / "run_protocol.py"


def load_runner():
    spec = importlib.util.spec_from_file_location("chaotang_department_protocol_runner", RUNNER_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_department_config_has_required_jobs_and_routes():
    runner = load_runner()
    config = runner.load_config()

    assert "contract_required_fields" in config
    assert config["global_next_step_design"]["prime_minister"]["required_shape"]
    assert config["global_next_step_design"]["qintianjian"]["required_shape"]
    for department in [
        "prime_minister",
        "qintianjian",
        "bingbu",
        "gongbu",
        "hubu",
        "libu_personnel",
        "jinyiwei",
        "yushi",
        "shiguan",
        "libu",
        "xingbu",
    ]:
        spec = config["departments"][department]
        assert spec["job"]
        assert spec["owns"]
        assert spec["next"]


def test_v1_taxonomy_matches_product_module_tree():
    runner = load_runner()
    config = runner.load_config()
    taxonomy = config["v1_taxonomy"]

    assert [item["name"] for item in taxonomy["primary_modules"]] == [
        "大殿",
        "上书房",
        "军机处",
        "六部",
        "专署",
        "史馆",
    ]
    assert [item["name"] for item in taxonomy["zhuanshu"]] == ["锦衣卫"]
    assert {
        code: [office["name"] for office in spec["offices"]]
        for code, spec in taxonomy["liubu"].items()
    } == {
        "hubu": ["预算司", "出纳司"],
        "libu": ["任免司", "招聘司"],
        "libu_rites": [],
        "bingbu": ["报价司", "线索司"],
        "xingbu": ["合同司"],
        "gongbu": ["产研司"],
    }
    assert taxonomy["liubu"]["libu_rites"]["status"] == "pending"


def test_v1_taxonomy_matches_project_fact_source():
    runner = load_runner()
    config = runner.load_config()
    taxonomy = config["v1_taxonomy"]
    fact_source = json.loads((ROOT.parent / "docs" / "chaotang-v1-taxonomy.json").read_text(encoding="utf-8"))

    assert fact_source["version"] == "1.0"
    assert taxonomy["version"] == fact_source["version"]
    assert [item["id"] for item in taxonomy["primary_modules"]] == [
        item["id"] for item in fact_source["primaryModules"]
    ]
    assert [item["id"] for item in taxonomy["zhuanshu"]] == [item["id"] for item in fact_source["zhuanshu"]]

    backend_liubu = taxonomy["liubu"]
    product_liubu = {item["id"]: item for item in fact_source["liubu"]}
    assert set(backend_liubu) == set(product_liubu)
    for department_id, backend_department in backend_liubu.items():
        product_department = product_liubu[department_id]
        assert backend_department["status"] == product_department["status"]
        assert backend_department.get("href") == product_department["href"]
        assert [office["id"] for office in backend_department["offices"]] == [
            office["id"] for office in product_department["offices"]
        ]


def test_six_ministries_define_swarm_calls_and_outputs():
    runner = load_runner()
    config = runner.load_config()
    orchestrator = yaml.safe_load((ROOT / "config" / "swarm_orchestrator.yaml").read_text(encoding="utf-8"))
    swarm_ids = {swarm["id"] for swarm in orchestrator["swarms"]}

    expected = {"gongbu", "hubu", "libu_personnel", "libu", "bingbu", "xingbu"}
    assert set(config["six_ministries"]) == expected
    for ministry, spec in config["six_ministries"].items():
        assert spec["definition"]
        assert spec["function"]
        assert spec["completes_work"]
        assert spec["output_types"]
        assert spec["gate"]
        assert set(spec["calls_swarms"]).issubset(swarm_ids), ministry


def test_six_ministries_have_top_advisor_genius_design():
    runner = load_runner()
    config = runner.load_config()

    assert config["top_advisor_design"]["required_lenses"] == [
        "product_or_customer",
        "long_term_business",
        "engineering_simplicity",
        "quality_system",
    ]
    assert runner.validate_six_ministry_genius_design(config) == {}
    for ministry, spec in config["six_ministries"].items():
        assert len(spec["advisor_lenses"]) >= 2, ministry
        assert spec["genius_design"]
        assert len(spec["function_upgrades"]) >= 3
        assert spec["harness_gate"]


def test_memorial_pipeline_defines_office_to_user_chain():
    runner = load_runner()
    config = runner.load_config()
    pipeline = config["memorial_pipeline"]

    assert pipeline["purpose"]
    stage_ids = [stage["id"] for stage in pipeline["stages"]]
    assert stage_ids == [
        "edict_intake",
        "dispatch",
        "office_reports",
        "attachments",
        "department_memorial",
        "junji_review",
        "prime_minister_synthesis",
        "user_delivery",
    ]
    assert pipeline["department_memorial_sections"] == ["圣裁", "分奏", "证据", "风险", "后令", "质门", "来源"]
    assert set(pipeline["required_office_report_fields"]) >= {
        "office",
        "task_id",
        "summary",
        "facts",
        "evidence",
        "attachments",
        "risks",
        "next_action",
        "source_label",
    }
    assert set(pipeline["attachment_required_fields"]) >= {
        "attachment_id",
        "title",
        "source_office",
        "source_label",
        "generated_at",
        "summary",
        "download_path",
    }
    assert set(pipeline["junji_review_checks"]) >= {
        "evidence_present",
        "attachment_traceable",
        "cross_office_conflict",
        "forbidden_commitment",
        "human_signoff_required",
        "source_label_consistent",
    }
    assert pipeline["user_value_blocks"] == ["当前结论", "丞相建议", "今日要办", "风险红线", "附件下载"]
    assert any("丞相不得" in rule for rule in pipeline["hard_rules"])


def test_bingbu_and_libu_personnel_payload_aliases():
    assert normalize_department("兵部") == "bingbu"
    assert normalize_department("吏部") == "libu_personnel"

    sales = build_text_payload(department="兵部", summary="销售跟进客户战情，安排售后复盘。", evidence=[])
    personnel = build_text_payload(department="吏部", summary="复核人员权限和责任归属。", evidence=[])

    assert sales["department"] == "bingbu"
    assert sales["output_type"] == "aftercare_case"
    assert personnel["department"] == "libu_personnel"
    assert personnel["output_type"] == "permission_review"


def test_golden_cases_pass_protocol_and_yushi_gate():
    runner = load_runner()
    report = runner.build_report(runner.load_cases(), runner.load_config())

    assert report["passed"] is True
    assert report["summary"]["valid"] >= 5
    assert report["summary"]["invalid"] == 1
    assert report["summary"]["global_next_step_ready"] == report["summary"]["valid"]
    assert report["summary"]["six_ministries_genius_ready"] == 6
    assert report["summary"]["route_cases"] >= 4
    assert report["summary"]["route_cases_passed"] == report["summary"]["route_cases"]
    assert report["six_ministries_genius_issues"] == {}
    assert all(result["has_qintianjian_trigger"] for result in report["route_results"])
    assert report["summary"]["green"] >= 2
    assert report["summary"]["yellow"] >= 1
    assert report["summary"]["red"] >= 2


def test_invalid_payload_missing_required_fields_is_rejected():
    runner = load_runner()
    config = runner.load_config()
    result = runner.evaluate_case(
        {
            "case_id": "bad",
            "payload": {
                "run_id": "bad",
                "department": "gongbu",
                "summary": "missing fields",
            },
            "expect": {"valid": False},
        },
        config,
    )

    assert result.valid is False
    assert "output_type" in result.missing_fields
    assert "evidence" in result.missing_fields
    assert result.passed is True


def test_global_next_step_requires_prime_minister_and_qintianjian_shape():
    runner = load_runner()
    config = runner.load_config()
    result = runner.evaluate_case(
        {
            "case_id": "weak_next_step",
            "payload": {
                "run_id": "weak_next_step",
                "department": "gongbu",
                "output_type": "implementation",
                "summary": "只有下一步文本，缺少丞相和钦天监结构。",
                "evidence": [{"source": "unit", "status": "ok"}],
                "benefit_score": 4,
                "automation_level_requested": "L1",
                "next_action": "继续。",
                "prime_minister_next_step": {"owner": "gongbu"},
                "qintianjian_trigger": "观察一下",
            },
            "expect": {"valid": False},
        },
        config,
    )

    assert result.valid is False
    assert "prime_minister_next_step.route" in result.missing_fields
    assert "qintianjian_trigger.shape" in result.missing_fields


def test_routes_by_department_and_risk_level():
    runner = load_runner()
    config = runner.load_config()

    assert runner.route_next_department({"department": "gongbu"}, "green", config) == "shiguan"
    assert runner.route_next_department({"department": "hubu"}, "red", config) == "hubu"
    assert runner.route_next_department({"department": "jinyiwei"}, "yellow", config) == "yushi"
    assert runner.route_next_department({"department": "qintianjian"}, "black", config) == "xingbu"


def test_protocol_result_contains_yushi_decision_card():
    runner = load_runner()
    case = next(item for item in runner.load_cases() if item["case_id"] == "gongbu_dependency_security_green")
    result = runner.evaluate_case(case, runner.load_config())

    assert result.valid is True
    assert result.yushi_card is not None
    assert result.yushi_card["risk_level"] == "green"
    assert result.next_department == "shiguan"


def test_writes_report_and_ledger(tmp_path):
    runner = load_runner()
    report = runner.build_report(runner.load_cases(), runner.load_config())
    json_out = tmp_path / "latest.json"
    md_out = tmp_path / "latest.md"
    ledger = tmp_path / "ledger.jsonl"

    runner.write_report(report, json_out, md_out)
    runner.append_ledger(report, ledger)

    assert json.loads(json_out.read_text(encoding="utf-8"))["harness"] == "chaotang_department_protocol"
    markdown = md_out.read_text(encoding="utf-8")
    assert "朝堂部门协同协议报告" in markdown
    assert "Department Route Cases" in markdown
    assert len(ledger.read_text(encoding="utf-8").splitlines()) == len(report["results"])
