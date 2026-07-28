from __future__ import annotations

import importlib.util
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
    assert result["cases"] == 6
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
        "acceptance_warranty",
        "delivery_delay",
        "dispute_compliance",
        "ip_confidentiality",
        "payment_acceptance_liability",
        "termination_liability",
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
