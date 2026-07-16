"""P4.5e contract tests for swarm-section DepartmentOpinionV1 projection."""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

from src.shangshufang_loop import memorial_from_swarm_result

REPO_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_ROOT = REPO_ROOT / "frontend/dev/contracts/schemas"


def _validator() -> Draft202012Validator:
    opinion_schema = json.loads(
        (SCHEMA_ROOT / "DepartmentOpinionV1.json").read_text(encoding="utf-8")
    )
    evidence_schema = json.loads(
        (SCHEMA_ROOT / "EvidenceItemV1.json").read_text(encoding="utf-8")
    )
    registry = Registry().with_resource(
        evidence_schema["$id"], Resource.from_contents(evidence_schema)
    )
    return Draft202012Validator(opinion_schema, registry=registry)


def _swarm_result() -> dict:
    return {
        "swarm_run": {
            "id": "swarm-p45e",
            "task_id": "task-p45e",
            "source_label": "MIXED",
        },
        "brief": {
            "source_label": "MIXED",
            "department_sections": [
                {
                    "swarm_id": "xingbu_legal_risk_swarm",
                    "swarm_role": "刑部法律风险蜂群",
                    "signal": "RED",
                    "position": "复核",
                    "summary": "合同签字责任尚未核清。",
                    "evidence_used": [
                        {
                            "title": "合同草案第 8 条",
                            "claim_supported": "存在不可逆签字责任",
                            "quote_or_location": "contract://draft#8",
                            "confidence": "高",
                        }
                    ],
                    "missing_evidence": ["授权签字记录"],
                    "risks": [
                        {
                            "risk": "不可逆法律责任",
                            "severity": "高",
                            "requires_human_confirmation": True,
                        }
                    ],
                    "recommended_next_action": "先核验授权签字记录。",
                    "source_label": "LIVE_ENGINE",
                },
                {
                    "swarm_id": "hubu_finance_swarm",
                    "swarm_role": "户部财务蜂群",
                    "position": "准奏",
                    "summary": "财务证据已满足当前裁决。",
                    "evidence_used": [],
                    "missing_evidence": [],
                    "risks": [],
                    "recommended_next_action": "进入皇上裁决。",
                    "source_label": "LIVE_SWARM",
                },
            ],
            "evidence_chain": [],
            "missing_evidence": ["授权签字记录"],
            "risk_register": [],
            "conflict_summary": [],
            "recommended_next_action": "先核验授权签字记录。",
        },
        "quality_result": {
            "passed": False,
            "blocking_reasons": ["missing_evidence_requires_resolution"],
        },
    }


def test_memorial_projects_every_swarm_section_to_full_department_opinion_v1():
    result = _swarm_result()
    memorial = memorial_from_swarm_result({"title": "测试奏折"}, result)
    opinions = memorial["department_memorials"]

    assert len(opinions) == len(result["brief"]["department_sections"])
    for opinion in opinions:
        _validator().validate(opinion)
        assert set(opinion) == {
            "schema_version",
            "task_id",
            "department_id",
            "signal",
            "verdict",
            "summary",
            "evidence",
            "missing_evidence",
            "risks",
            "next_order",
            "human_confirmation_required",
            "source_label",
        }


def test_projection_preserves_signal_and_per_section_provenance_at_wire_boundary():
    result = _swarm_result()
    original = deepcopy(result)
    memorial = memorial_from_swarm_result({}, result)
    legal, finance = memorial["department_memorials"]

    assert legal == {
        "schema_version": "DepartmentOpinionV1",
        "task_id": "task-p45e",
        "department_id": "刑部",
        "signal": "RED",
        "verdict": "RECHECK",
        "summary": "合同签字责任尚未核清。",
        "evidence": [
            {
                "schema_version": "EvidenceItemV1",
                "id": "task-p45e:刑部:evidence:1",
                "label": "合同草案第 8 条",
                "summary": "存在不可逆签字责任",
                "source_uri": "contract://draft#8",
                "reliability": "high",
                "source_label": "LIVE",
            }
        ],
        "missing_evidence": ["授权签字记录"],
        "risks": ["不可逆法律责任"],
        "next_order": "先核验授权签字记录。",
        "human_confirmation_required": True,
        "source_label": "LIVE",
    }
    assert finance["signal"] == "GREEN"
    assert finance["verdict"] == "APPROVE"
    assert finance["source_label"] == "LIVE_SWARM"
    assert memorial["swarm_brief_for_junjichu"]["department_sections"][0][
        "source_label"
    ] == "LIVE_ENGINE"
    assert result == original


@pytest.mark.parametrize(
    ("position", "signal", "verdict"),
    [
        ("准奏", "GREEN", "APPROVE"),
        ("补证", "YELLOW", "NEED_EVIDENCE"),
        ("复核", "RED", "RECHECK"),
        ("驳回", "RED", "REJECT"),
        ("未定义立场", "GRAY", "NEED_EVIDENCE"),
    ],
)
def test_projection_freezes_position_mapping_and_fails_closed(
    position: str, signal: str, verdict: str
):
    result = _swarm_result()
    section = result["brief"]["department_sections"][0]
    section.pop("signal")
    section["position"] = position
    section["source_label"] = "UNRECOGNIZED_INTERNAL_SOURCE"
    result["brief"]["department_sections"] = [section]

    opinion = memorial_from_swarm_result({}, result)["department_memorials"][0]

    assert opinion["signal"] == signal
    assert opinion["verdict"] == verdict
    assert opinion["source_label"] == "FALLBACK"
    assert all(item["source_label"] == "FALLBACK" for item in opinion["evidence"])
