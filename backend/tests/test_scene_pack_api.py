"""Scene Pack V1 route contract and military-office board tests."""

from __future__ import annotations

from starlette.requests import Request

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
    assert real["proposal-quotation-tender"] == "stubbed"
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


def test_stubbed_pack_keeps_structured_board_flow():
    response = create_scene_run(
        {
            "packSlug": "proposal-quotation-tender",
            "demo": True,
            "inputs": {"projectName": "Demo RFQ", "customerRequirement": "Need proposal"},
        },
        _owner(),
    )

    scene_run = response["sceneRun"]
    assert scene_run["status"] == "blocked"
    assert scene_run["verdict"] == "STUBBED"
    assert scene_run["boardMission"]["stage"] == "blocked"


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
