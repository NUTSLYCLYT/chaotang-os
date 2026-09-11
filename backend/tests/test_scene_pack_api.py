"""Scene Pack V1 route contract and military-office board tests."""

from __future__ import annotations

# Foundation regression cases: isolated SQLite via conftest, no runtime/model calls.
import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.requests import Request

from app.api import scene_packs as scene_api
from app.api.auth import require_current_user
from app.api.scene_packs import (
    create_scene_run,
    list_missions,
    list_scene_packs,
    patch_mission,
)
from app.auth.models import AuthenticatedPrincipal
from app.scene_packs import storage
from app.scene_packs.models import MissionPatch


def _owner(
    *, user_id: str = "scene-owner", tenant_id: str = "scene-tenant"
) -> AuthenticatedPrincipal:
    return AuthenticatedPrincipal(
        id=user_id,
        username="scene-owner",
        email="scene-owner@example.com",
        tenant_id=tenant_id,
        membership_id="scene-membership",
        tenant_role="OWNER",
    )


def _request(query: bytes = b"") -> Request:
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/api/v1/court/military-office/missions",
            "query_string": query,
            "headers": [],
        }
    )


def test_scene_pack_registry_exposes_five_entries():
    response = list_scene_packs(_owner())

    packs = response["scenePacks"]
    assert [pack["slug"] for pack in packs] == [
        "single-product-export-diagnosis",
        "b2b-inquiry-conversion",
        "proposal-quotation-tender",
        "contract-cashflow-risk",
        "enterprise-growth-diagnosis",
    ]
    real = {pack["slug"]: pack["implementationStatus"] for pack in packs}
    assert real["proposal-quotation-tender"] == "real_v1"
    assert real["enterprise-growth-diagnosis"] == "real_v1"


def test_single_product_run_creates_board_mission():
    response = create_scene_run(
        {
            "packSlug": "single-product-export-diagnosis",
            "demo": True,
            "inputs": {
                "productName": "LFP Battery Pack",
                "productCategory": "储能电池PACK",
                "knownParameters": "51.2V 100Ah，循环寿命待测试报告确认",
                "certifications": "UN38.3 / MSDS 已有扫描件",
                "currentPriceOrCost": "FOB 参考价待人工确认",
                "monthlyCapacity": "2000 sets/month",
                "deliveryCycle": "30 days",
                "targetMarket": "Germany",
                "plannedChannel": "海外经销商",
            },
        },
        _owner(),
    )

    scene_run = response["sceneRun"]
    assert scene_run["status"] == "completed"
    assert scene_run["demo"] is True
    assert scene_run["verdict"]
    assert scene_run["riskGrade"] in {"low", "medium"}
    assert scene_run["nextActions"]
    assert scene_run["missionId"]

    board = list_missions(_request(), _owner())
    assert [mission["runId"] for mission in board["missions"]] == [scene_run["runId"]]


def test_contract_missing_payment_is_blocked_without_signing_advice():
    response = create_scene_run(
        {
            "packSlug": "contract-cashflow-risk",
            "inputs": {"contractText": "Buyer pays after acceptance."},
        },
        _owner(),
    )

    scene_run = response["sceneRun"]
    assert scene_run["status"] == "blocked"
    assert scene_run["riskGrade"] == "high"
    assert "缺少付款节点" in scene_run["missingItems"]
    assert scene_run["details"]["signingAdvice"] == "资料不足，不给最终签约建议"


def test_b2b_inquiry_real_v1_returns_sales_card_fields():
    response = create_scene_run(
        {
            "packSlug": "b2b-inquiry-conversion",
            "inputs": {
                "inquirySource": "阿里国际站",
                "customerName": "Alex",
                "customerCompany": "NorthGrid Energy",
                "countryRegion": "UAE",
                "contact": "alex@northgrid.example",
                "customerOriginalText": "We need 100 pcs battery pack for solar project.",
                "productDemand": "51.2V 100Ah battery pack",
                "quantity": "100 pcs",
                "paymentMethod": "T/T",
            },
        },
        _owner(),
    )

    scene_run = response["sceneRun"]
    assert scene_run["packSlug"] == "b2b-inquiry-conversion"
    assert scene_run["leadScore"] > 0
    assert scene_run["recommendedReply"]["tone"] == "professional"
    assert scene_run["followUpPlan"]


def test_growth_pack_returns_growth_objects():
    response = create_scene_run(
        {
            "packSlug": "enterprise-growth-diagnosis",
            "demo": True,
            "inputs": {
                "industry": "储能外贸",
                "region": "广东",
                "targetMarkets": ["EU", "Middle East"],
                "products": ["Battery Pack"],
                "stage": "成长期",
                "threeMonthMetrics": {
                    "sales": 900000,
                    "profitMargin": 18,
                    "grossProfit": 162000,
                    "cashflow": -50000,
                    "aov": 30000,
                    "inquiries": 120,
                    "conversionRate": 8,
                    "cac": 600,
                },
                "topProblems": ["获客贵", "回款慢", "利润下滑"],
                "budgetLimit": "30000 CNY",
                "availablePeople": "2 sales + 1 ops",
                "targetCollectionCycle": "45 days",
            },
        },
        _owner(),
    )

    details = response["sceneRun"]["details"]
    assert 0 <= details["GrowthGapIndex"] <= 100
    assert details["GrowthActionPack"]
    assert details["DecisionGate"] == "先稳现金"


def test_s4_real_rules_keep_structured_board_flow():
    response = create_scene_run(
        {
            "packSlug": "proposal-quotation-tender",
            "demo": True,
            "inputs": {"projectName": "Demo RFQ", "customerRequirement": "Need proposal"},
        },
        _owner(),
    )

    scene_run = response["sceneRun"]
    assert scene_run["status"] == "completed"
    assert scene_run["verdict"] == "PREPARE_BID"
    assert scene_run["boardMission"]["stage"] == "done"
    assert scene_run["details"]["ruleAnalysis"]["matchedCategories"] == []


def test_mission_stage_can_be_updated_manually():
    created = create_scene_run(
        {
            "packSlug": "b2b-inquiry-conversion",
            "inputs": {
                "inquirySource": "邮件",
                "customerOriginalText": "Please quote motor parts.",
                "productDemand": "motor parts",
            },
        },
        _owner(),
    )["sceneRun"]

    response = patch_mission(
        created["missionId"],
        MissionPatch(stage="awaiting_input", next_milestone="等待客户补充公司信息"),
        _owner(),
    )

    mission = response["mission"]
    assert mission["stage"] == "awaiting_input"
    assert mission["nextMilestone"] == "等待客户补充公司信息"


def test_scene_runs_and_missions_are_tenant_scoped_even_for_same_user_id():
    owner_a = _owner(user_id="shared-user", tenant_id="tenant-a")
    owner_b = _owner(user_id="shared-user", tenant_id="tenant-b")
    created = create_scene_run(
        {
            "packSlug": "b2b-inquiry-conversion",
            "inputs": {
                "inquirySource": "独立站",
                "customerOriginalText": "Need price for inverter sample.",
                "productDemand": "inverter sample",
            },
        },
        owner_a,
    )["sceneRun"]

    assert list_missions(_request(), owner_b)["missions"] == []
    assert (
        storage.get_scene_run(
            created["runId"],
            owner_user_id=owner_b.id,
            tenant_id=owner_b.tenant_id,
        )
        is None
    )
    assert (
        patch_mission(
            created["missionId"],
            MissionPatch(stage="done"),
            owner_b,
        ).status_code
        == 404
    )


def _s4(inputs=None):
    return {
        "packSlug": "proposal-quotation-tender",
        "inputs": inputs
        if inputs is not None
        else {
            "projectName": "Synthetic RFQ",
            "customerRequirement": "No WARRANTY; review 罚 and 保函",
        },
    }


def _counts():
    with storage._connect() as db:
        return tuple(
            db.execute("SELECT count(*) FROM " + table).fetchone()[0]
            for table in ("scene_runs", "board_missions")
        )


def test_s4_rule_metadata_is_faithful_and_conservative():
    inputs = {
        "projectName": "RFQ",
        "customerRequirement": "No WARRANTY obligation; quoted penalty only",
        "rfqFile": "保修 非标 验收 保函",
    }
    run = create_scene_run(_s4(inputs), _owner())["sceneRun"]
    assert run["status"] == "completed"
    rule = run["details"]["ruleAnalysis"]
    assert set(rule) == {"ruleVersion", "matchedCategories", "anchors"}
    assert rule["ruleVersion"] == "s4-keyword-v1"
    assert rule["matchedCategories"] == ["warranty", "penalty", "bond", "custom", "acceptance"]
    assert run["riskGrade"] == "high"
    for anchor in rule["anchors"]:
        assert set(anchor) == {"category", "field", "excerpt"}
        assert anchor["excerpt"] in inputs[anchor["field"]]
        assert 0 < len(anchor["excerpt"]) <= 240
    assert all(item["sourceType"] == "user_claim" for item in run["evidenceRefs"])
    assert "待核" in run["details"]["largestUnpricedRisk"]


@pytest.mark.parametrize(
    "text,categories",
    [
        ("customer bonded acceptanceTest warrantying penalties", []),
        (
            "WARRANTY penalty BOND CUSTOM ACCEPTANCE",
            ["warranty", "penalty", "bond", "custom", "acceptance"],
        ),
        (
            "质保保修保证金保函违约罚定制非标验收",
            ["warranty", "penalty", "bond", "custom", "acceptance"],
        ),
        ("no warranty or penalty", ["warranty", "penalty"]),
    ],
)
def test_s4_category_matching_on_either_field(text, categories):
    for field in ("customerRequirement", "rfqFile"):
        inputs = {"projectName": "RFQ", "customerRequirement": "basic requirements", field: text}
        run = create_scene_run(_s4(inputs), _owner())["sceneRun"]
        assert run["details"]["ruleAnalysis"]["matchedCategories"] == categories
        assert run["riskGrade"] == (
            "high" if len(categories) >= 3 else "medium" if categories else "low"
        )
        if not categories:
            assert "不代表" in run["details"]["largestUnpricedRisk"]


def test_growth_missing_key_metric_and_blank_lists_do_not_complete():
    inputs = {
        "industry": "test",
        "region": "test",
        "targetMarkets": ["EU"],
        "products": ["test"],
        "stage": "test",
        "threeMonthMetrics": {"profitMargin": 0, "conversionRate": 0, "cashflow": 0},
        "topProblems": ["test"],
        "budgetLimit": "0",
        "availablePeople": "1",
        "targetCollectionCycle": "30",
    }
    for key in ("profitMargin", "conversionRate", "cashflow"):
        sample = {
            **inputs,
            "threeMonthMetrics": {k: v for k, v in inputs["threeMonthMetrics"].items() if k != key},
        }
        run = create_scene_run(
            {"packSlug": "enterprise-growth-diagnosis", "inputs": sample}, _owner()
        )["sceneRun"]
        assert run["status"] == "blocked"
        assert any(key in item for item in run["missingItems"])
    for key in ("targetMarkets", "products", "topProblems"):
        sample = {**inputs, key: ["  "]}
        assert (
            create_scene_run(
                {"packSlug": "enterprise-growth-diagnosis", "inputs": sample}, _owner()
            )["sceneRun"]["status"]
            == "blocked"
        )


def test_http_validation_never_echoes_inputs():
    app = FastAPI()
    app.include_router(scene_api.router)
    app.dependency_overrides[require_current_user] = _owner
    with TestClient(app) as client:
        for body in (
            '{"material":"PUBLIC-TEST-MATERIAL",',
            "[]",
            "123",
            "null",
            '{"packSlug": "proposal-quotation-tender", "demo": "false"}',
        ):
            result = client.post(
                "/api/v1/court/scene-runs",
                content=body,
                headers={"content-type": "application/json"},
            )
            assert result.status_code == 422
            assert result.json() == {"status": "error", "reason": "validation"}
    assert _counts() == (0, 0)


def test_second_insert_failure_rolls_back_both_rows():
    with storage._connect() as db:
        db.execute(
            "CREATE TRIGGER fail_mission BEFORE INSERT ON board_missions "
            "BEGIN SELECT RAISE(ABORT, 'synthetic'); END"
        )
    result = create_scene_run(_s4(), _owner())
    assert result.status_code == 503
    assert json.loads(result.body) == {"status": "error", "reason": "unavailable"}
    assert _counts() == (0, 0)


@pytest.mark.parametrize("corruption", [float("nan"), float("inf"), object()])
def test_internal_serialization_failure_does_not_write(monkeypatch, corruption):
    original = storage._build_scene_result

    def broken(*args):
        run = original(*args)
        return run.model_copy(
            update={"action_payload": {**run.action_payload, "nested": [corruption]}}
        )

    monkeypatch.setattr(storage, "_build_scene_result", broken)
    result = create_scene_run(_s4(), _owner())
    assert result.status_code == 503
    assert _counts() == (0, 0)


def test_full_b2b_material_survives_bounded_display():
    demand = "😀" * 2000
    original = "资料" * 10000
    response = create_scene_run(
        {
            "packSlug": "b2b-inquiry-conversion",
            "inputs": {
                "inquirySource": "test",
                "customerOriginalText": original,
                "productDemand": demand,
                "customerCompany": "公" * 2000,
            },
        },
        _owner(),
    )
    run = response["sceneRun"]
    assert len(run["summaryForUser"]) <= 1200
    assert len(run["boardMission"]["title"]) <= 180
    assert "…" in run["boardMission"]["title"]
    assert run["details"]["productDemand"] == demand
    assert run["details"]["factTags"]["customer_claim"] == [original]


def test_bad_persisted_json_returns_unavailable_without_repair():
    run = create_scene_run(_s4(), _owner())["sceneRun"]
    with storage._connect() as db:
        db.execute(
            "UPDATE scene_runs SET action_payload_json = ? WHERE id = ?",
            ('{"bad":NaN}', run["runId"]),
        )
    response = scene_api.get_scene_run(run["runId"], _owner())
    assert response.status_code == 503
    with storage._connect() as db:
        assert (
            db.execute(
                "SELECT action_payload_json FROM scene_runs WHERE id = ?", (run["runId"],)
            ).fetchone()[0]
            == '{"bad":NaN}'
        )


def test_legacy_stub_and_invalid_rule_metadata_remain_readable():
    run = create_scene_run(_s4(), _owner())["sceneRun"]
    with storage._connect() as db:
        db.execute(
            "UPDATE scene_runs SET status = 'blocked', verdict = 'STUBBED', "
            "action_payload_json = ? WHERE id = ?",
            ('{"implementationStatus":"stubbed","canProceed":false}', run["runId"]),
        )
    old = scene_api.get_scene_run(run["runId"], _owner())["sceneRun"]
    assert old["status"] == "blocked" and old["verdict"] == "STUBBED"
    with storage._connect() as db:
        db.execute(
            "UPDATE scene_runs SET action_payload_json = ? WHERE id = ?",
            ('{"ruleAnalysis":{"ruleVersion":"unknown"}}', run["runId"]),
        )
    assert scene_api.get_scene_run(run["runId"], _owner())["sceneRun"]["details"][
        "ruleAnalysis"
    ] == {"ruleVersion": "unknown"}


@pytest.mark.parametrize("field", ["customerRequirement", "rfqFile"])
def test_s4_max_material_anchors_use_unicode_codepoints(field):
    material = "😀" * 19750 + " WARRANTY " + "字" * 240
    run = create_scene_run(
        _s4({"projectName": "RFQ", "customerRequirement": "plain", field: material}), _owner()
    )["sceneRun"]
    anchor = run["details"]["ruleAnalysis"]["anchors"][0]
    assert anchor["excerpt"] in material and "WARRANTY" in anchor["excerpt"]
    assert len(anchor["excerpt"]) <= 240


@pytest.mark.parametrize("change", ["missing", "extra", "invented", "risk"])
def test_s4_metadata_output_contract_fails_before_inserts(monkeypatch, change):
    original = storage._build_scene_result

    def broken(*args):
        run = original(*args)
        details = run.action_payload
        if change == "missing":
            details.pop("ruleAnalysis")
        elif change == "extra":
            details["ruleAnalysis"]["url"] = "https://example.invalid"
        elif change == "invented":
            details["ruleAnalysis"]["anchors"][0]["excerpt"] = "invented material"
        else:
            run.risk_grade = "low"
        return run

    monkeypatch.setattr(storage, "_build_scene_result", broken)
    result = create_scene_run(_s4(), _owner())
    assert result.status_code == 503
    assert _counts() == (0, 0)


def test_response_construction_failure_happens_before_writes(monkeypatch):
    monkeypatch.setattr(scene_api, "_run_json", lambda *_: {"bad": float("nan")})
    assert create_scene_run(_s4(), _owner()).status_code == 503
    assert _counts() == (0, 0)


def test_malformed_input_422_recovery_and_cross_owner_isolation():
    assert create_scene_run(_s4({"projectName": 12}), _owner()).status_code == 422
    assert _counts() == (0, 0)
    run = create_scene_run(_s4(), _owner())["sceneRun"]
    for other in (_owner(user_id="other"), _owner(tenant_id="other")):
        assert scene_api.get_scene_run(run["runId"], other).status_code == 404
        assert patch_mission(run["missionId"], MissionPatch(stage="done"), other).status_code == 404
        assert list_missions(_request(), other)["missions"] == []
    assert scene_api.get_scene_run(run["runId"], _owner())["sceneRun"]["runId"] == run["runId"]
    assert _counts() == (1, 1)


def test_http_auth_boundary_and_unknown_scene():
    from app.main import app

    with TestClient(app) as client:
        assert client.post("/api/v1/court/scene-runs", json=_s4()).status_code == 401
    assert (
        create_scene_run(
            {"packSlug": "missing-scene", "inputs": {"unknown": "ok"}}, _owner()
        ).status_code
        == 404
    )
    assert _counts() == (0, 0)


@pytest.mark.parametrize("seed", storage._SCENE_PACK_SEEDS, ids=lambda seed: seed["slug"])
def test_each_scene_missing_text_stays_blocked(seed):
    run = create_scene_run({"packSlug": seed["slug"], "inputs": {}}, _owner())["sceneRun"]
    assert run["status"] == "blocked" and run["canProceed"] is False
    assert run["missingItems"]


def test_contract_and_single_product_long_display_fields_remain_valid():
    for slug in ("contract-cashflow-risk", "single-product-export-diagnosis"):
        seed = next(seed for seed in storage._SCENE_PACK_SEEDS if seed["slug"] == slug)
        inputs = {
            field: "字" * (120 if field == "productName" else 2000)
            for field in seed["required_inputs"]
        }
        run = create_scene_run({"packSlug": slug, "inputs": inputs}, _owner())["sceneRun"]
        assert run["status"] == "completed"
        assert len(run["summaryForUser"]) <= 1200
        assert len(run["verdictText"]) <= 500
        assert "…" in run["summaryForUser"]


@pytest.mark.parametrize(
    "inputs", [{}, {"projectName": "Synthetic"}, {"customerRequirement": "User material"}]
)
def test_s4_blocked_sources_never_claim_model_execution(inputs):
    run = create_scene_run(_s4(inputs), _owner())["sceneRun"]
    assert run["status"] == "blocked"
    assert all(ref["sourceType"] == "user_claim" for ref in run["evidenceRefs"])
    if "customerRequirement" not in inputs:
        assert run["evidenceRefs"] == []
    saved = scene_api.get_scene_run(run["runId"], _owner())["sceneRun"]
    assert saved["evidenceRefs"] == run["evidenceRefs"]


@pytest.mark.parametrize("key", ["profitMargin", "conversionRate", "cashflow"])
@pytest.mark.parametrize("bad", [True, "NaN", "Infinity", "1e9999", "12%%", {}, None])
def test_invalid_growth_metric_http_rejects_without_writes(key, bad):
    result = create_scene_run(
        {"packSlug": "enterprise-growth-diagnosis", "inputs": {"threeMonthMetrics": {key: bad}}},
        _owner(),
    )
    assert result.status_code == 422
    assert json.loads(result.body) == {"status": "error", "reason": "validation"}
    assert _counts() == (0, 0)


@pytest.mark.parametrize("column", ["next_actions_json", "evidence_refs_json"])
def test_bad_legacy_collection_type_is_unavailable_not_empty_success(column):
    run = create_scene_run(_s4(), _owner())["sceneRun"]
    with storage._connect() as db:
        db.execute(f"UPDATE scene_runs SET {column} = ? WHERE id = ?", ("{}", run["runId"]))
    response = scene_api.get_scene_run(run["runId"], _owner())
    assert response.status_code == 503
    with storage._connect() as db:
        assert (
            db.execute(f"SELECT {column} FROM scene_runs WHERE id = ?", (run["runId"],)).fetchone()[
                0
            ]
            == "{}"
        )
