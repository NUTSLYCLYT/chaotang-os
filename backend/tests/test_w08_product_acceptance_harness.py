from __future__ import annotations

import importlib.util
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RUNNER_PATH = (
    ROOT
    / "harness"
    / "chaotang-true-loop"
    / "product_acceptance"
    / "scripts"
    / "run_w08_acceptance.py"
)


def _load_runner():
    spec = importlib.util.spec_from_file_location(
        "w08_product_acceptance_runner",
        RUNNER_PATH,
    )
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_w08_runnable_minimum_acceptance_contract_passes():
    runner = _load_runner()

    result = runner.run()

    assert result["passed"] is True
    assert result["mode"] == "RUNNABLE_MINIMUM"
    assert result["cases"] == 36
    assert result["targets"] == {
        "golden_contracts_final": 36,
        "real_backend_browser_runs_final": 10,
        "non_developer_users_final": 5,
        "non_developer_users_success_minimum": 4,
    }
    assert result["records"][0]["case_id"] == "w08-cn-manufacturing-procurement-001"
    assert result["records"][0]["failures"] == []
    assert result["coverage"]["case_ids_unique"] is True
    assert result["coverage"]["categories"] == [
        "acceptance_dispute_escalation",
        "acceptance_warranty",
        "advance_payment_security",
        "commissioned_rd_ip",
        "compliance_audit_trace",
        "consignment_inventory_payment",
        "custom_equipment_change_order",
        "delivery_delay",
        "dispute_compliance",
        "embedded_software_license",
        "engineering_change_freeze",
        "environmental_compliance_liability",
        "equipment_finance_lease",
        "equipment_maintenance_sla",
        "export_documents_payment",
        "force_majeure_allocation",
        "framework_price_supply",
        "installation_acceptance_delay",
        "ip_confidentiality",
        "logistics_risk_transfer",
        "mold_confidentiality_dispute",
        "oem_quality_indemnity",
        "packaging_label_compliance",
        "payment_acceptance_liability",
        "payment_guarantee_release",
        "quality_deposit_retention",
        "raw_material_price_adjustment",
        "recall_compliance_warranty",
        "sole_source_dependency",
        "spare_parts_supply",
        "subcontract_confidentiality_quality",
        "supplier_audit_right",
        "technical_data_delivery",
        "termination_liability",
        "tooling_payment_ip",
        "warranty_service_liability",
    ]
    assert result["coverage"]["risk_families"] == [
        "acceptance",
        "compliance",
        "confidentiality",
        "delivery",
        "dispute",
        "ip",
        "liability",
        "payment",
        "termination",
        "warranty",
    ]


def test_w08_acceptance_rejects_mock_browser_or_missing_replay():
    runner = _load_runner()
    case = runner.load_cases()[0]
    bad_case = {
        **case,
        "browser_flow": {
            **case["browser_flow"],
            "backend": "mock",
        },
        "audit_replay": {
            **case["audit_replay"],
            "surface": "/archive",
        },
    }

    result = runner.validate_case(bad_case)

    assert result["passed"] is False
    assert "browser flow must use real backend" in result["failures"]
    assert "audit replay surface must be /shiguan" in result["failures"]


def test_w08_acceptance_requires_review_pack_artifacts_and_lineage():
    runner = _load_runner()
    case = runner.load_cases()[0]
    bad_case = {
        **case,
        "contract_review_pack": {
            **case["contract_review_pack"],
            "artifact_kinds": ["JSON"],
            "lineage_fields": ["mission_contract_id"],
        },
    }

    result = runner.validate_case(bad_case)

    assert result["passed"] is False
    assert "ContractReviewPack must require PDF, DOCX, and JSON artifacts" in result["failures"]
    assert "ContractReviewPack lineage must bind mission, evidence, risk, final, manifest, and archive" in result["failures"]


def _successful_user(participant_id: str, first_value_seconds: int = 150) -> dict:
    return {
        "participant_id": participant_id,
        "target_profile": "manufacturing_contract_operator",
        "involved_in_development": False,
        "unassisted": True,
        "engineer_guidance": False,
        "completed_steps": [
            "upload_contract",
            "parse_mission_contract",
            "review_risks",
            "supplement_evidence",
            "decide_risk",
            "generate_contract_review_pack",
            "download_artifacts",
            "reopen_shiguan_audit",
        ],
        "completion_success": True,
        "first_value_seconds": first_value_seconds,
        "evidence": {
            "contract_review_pack_id": f"crp-{participant_id}",
            "artifact_manifest_id": f"am-{participant_id}",
            "archive_receipt_id": f"ar-{participant_id}",
            "browser_evidence_ref": f"ci_result/artifacts/usability/{participant_id}.json",
        },
        "feedback_deidentified": True,
    }


def test_w08_user_acceptance_requires_five_non_developer_users_with_four_successes():
    runner = _load_runner()
    payload = {
        "schemaVersion": "w08-user-acceptance.v1",
        "mode": "FINAL_USER_ACCEPTANCE",
        "records": [
            _successful_user("user-001", 120),
            _successful_user("user-002", 135),
            _successful_user("user-003", 150),
            _successful_user("user-004", 165),
            {
                **_successful_user("user-005", 240),
                "completion_success": False,
                "completed_steps": ["upload_contract"],
            },
        ],
    }

    result = runner.validate_user_acceptance_payload(payload)

    assert result["passed"] is True
    assert result["records"] == 5
    assert result["successes"] == 4
    assert result["median_first_value_seconds"] == 142.5


def test_w08_user_acceptance_blocks_missing_real_records():
    runner = _load_runner()

    result = runner.validate_user_acceptance_payload({
        "schemaVersion": "w08-user-acceptance.v1",
        "mode": "FINAL_USER_ACCEPTANCE",
        "records": [],
    })

    assert result["passed"] is False
    assert "user acceptance requires five participant records" in result["failures"]


def test_w08_user_acceptance_rejects_developer_or_assisted_sessions():
    runner = _load_runner()
    bad_user = {
        **_successful_user("user-001"),
        "involved_in_development": True,
        "unassisted": False,
        "engineer_guidance": True,
        "feedback_deidentified": False,
    }

    result = runner.validate_user_acceptance_payload({
        "schemaVersion": "w08-user-acceptance.v1",
        "mode": "FINAL_USER_ACCEPTANCE",
        "records": [
            bad_user,
            _successful_user("user-002"),
            _successful_user("user-003"),
            _successful_user("user-004"),
            _successful_user("user-005"),
        ],
    })

    assert result["passed"] is False
    assert "user-001 must not be involved in development" in result["failures"]
    assert "user-001 must complete without engineer guidance" in result["failures"]
    assert "user-001 feedback must be deidentified" in result["failures"]


def test_w08_user_acceptance_runner_reads_evidence_file(tmp_path):
    runner = _load_runner()
    evidence_path = tmp_path / "w08_user_acceptance.json"
    evidence_path.write_text(
        json.dumps({
            "schemaVersion": "w08-user-acceptance.v1",
            "mode": "FINAL_USER_ACCEPTANCE",
            "records": [_successful_user(f"user-{index:03d}") for index in range(1, 6)],
        }),
        encoding="utf-8",
    )

    result = runner.run_user_acceptance(evidence_path)

    assert result["passed"] is True
    assert result["evidencePath"] == str(evidence_path)


def test_w08_closeout_preflight_blocks_without_real_user_acceptance():
    runner = _load_runner()

    result = runner.run_closeout_preflight()

    assert result["passed"] is False
    assert result["decision"] == "BLOCKED"
    assert result["gates"]["golden_contracts"]["passed"] is True
    assert result["gates"]["golden_contracts"]["cases"] == 36
    assert result["gates"]["browser_flows"]["passed"] is True
    assert result["gates"]["browser_flows"]["flows"] == 10
    assert result["gates"]["user_acceptance"]["passed"] is False
    assert "user acceptance evidence path is required for W08 closeout" in result["failures"]


def test_w08_closeout_preflight_passes_with_complete_user_acceptance(tmp_path):
    runner = _load_runner()
    evidence_path = tmp_path / "w08_user_acceptance.json"
    evidence_path.write_text(
        json.dumps({
            "schemaVersion": "w08-user-acceptance.v1",
            "mode": "FINAL_USER_ACCEPTANCE",
            "records": [_successful_user(f"user-{index:03d}") for index in range(1, 6)],
        }),
        encoding="utf-8",
    )

    result = runner.run_closeout_preflight(user_acceptance_path=evidence_path)

    assert result["passed"] is True
    assert result["decision"] == "READY_FOR_CLOSEOUT"
    assert result["gates"]["golden_contracts"]["passed"] is True
    assert result["gates"]["browser_flows"]["passed"] is True
    assert result["gates"]["user_acceptance"]["successes"] == 5
