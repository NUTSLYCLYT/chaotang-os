from fastapi.testclient import TestClient

from src.swarm_execution_loop import (
    route_swarms,
    run_department_swarm,
    run_swarm_execution_loop,
)
from web.main import app


def _storage_edict():
    return {
        "original_question": "判断 100MWh 冷库储能项目是否推进。",
        "refined_edict": "请军机处组织户部、工部、刑部参审，重点核查 ROI、BOM、交期、客户承诺和签字风险。",
        "decision_type": "项目推进",
        "known_facts": ["项目规模 100MWh", "场景为冷库储能"],
        "unknown_gaps": ["设备报价", "BOM", "交期", "客户承诺"],
        "risk_flags": ["证据不足", "对外承诺风险"],
        "source_label": "MIXED",
    }


def test_route_storage_project_selects_core_swarms():
    plan = route_swarms(_storage_edict(), mode="standard")
    selected = {item["swarm_id"] for item in plan["selected_swarms"]}

    assert "hubu_finance_swarm" in selected
    assert "gongbu_delivery_swarm" in selected
    assert "xingbu_legal_risk_swarm" in selected
    assert "evidence_audit_swarm" in selected
    assert "critic_swarm" in selected
    assert "synthesis_swarm" in selected
    assert "quality_gate_swarm" in selected
    assert plan["source_label"] == "MIXED"


def test_route_component_hazard_to_gongbu_even_when_another_department_matches():
    edict = {
        "original_question": "合同要求模组端子松动打火后仍继续运行",
        "refined_edict": "请审查合同责任与现场安全",
        "decision_type": "事故处置",
        "known_facts": ["模组端子正在打火"],
        "unknown_gaps": [],
        "risk_flags": ["合同风险"],
        "source_label": "USER_INPUT",
    }

    selected = {
        item["swarm_id"] for item in route_swarms(edict)["selected_swarms"]
    }

    assert "xingbu_legal_risk_swarm" in selected
    assert "gongbu_delivery_swarm" in selected


def test_route_business_metaphor_does_not_force_gongbu_safety_review():
    edict = {
        "original_question": "合同讨论现金流烧钱速度太快，成本失控",
        "refined_edict": "请审查合同与财务风险",
        "decision_type": "经营复盘",
        "known_facts": [],
        "unknown_gaps": [],
        "risk_flags": ["合同风险"],
        "source_label": "USER_INPUT",
    }

    selected = {
        item["swarm_id"] for item in route_swarms(edict)["selected_swarms"]
    }

    assert "xingbu_legal_risk_swarm" in selected
    assert "gongbu_delivery_swarm" not in selected


def test_gongbu_fallback_requires_human_when_real_engine_returns_none():
    edict = {
        "original_question": "模组端子松动打火",
        "refined_edict": "现场要求继续运行",
        "known_facts": ["端子打火"],
        "unknown_gaps": [],
    }

    result = run_department_swarm(
        "gongbu_delivery_swarm",
        edict,
        "MIXED",
        live=False,
        real_engine_fn=lambda _text: None,
    )

    assert result["position"] == "复核"
    assert any(
        risk["requires_human_confirmation"] for risk in result["risks"]
    )


def test_high_risk_contract_requires_human_confirmation(monkeypatch):
    import src.xingbu_verdict as xv

    # 真实引擎的抽取prompt只产出 red|yellow|green,从不产出 black——模拟这个真实约束,
    # 验证 _enforce_xingbu_hard_stop 的关键词硬停覆盖层真的补上了这个信号(2026-07-04回归修复)。
    def _fake_verdict_from_text(raw_text, **kw):
        return {
            "doc_type": "brief",
            "dept": "xingbu",
            "case_id": "XB-x",
            "light": "red",
            "headline": "需人工复核 —— 股权/独家/预付款风险",
            "items": [
                {
                    "level": "red",
                    "title": "股权+独家+预付款组合风险",
                    "fix": None,
                    "evidence_ref": "truth://x",
                }
            ],
            "adversarial": None,
            "actions": ["escalate"],
            "provenance": {
                "advisors": [],
                "archive_id": "XB-x",
                "gate": "pending",
                "rag_grounded": False,
                "deterministic_gated": False,
                "grounding": "none",
            },
            "source_label": "LIVE_ENGINE",
            "signed": False,
            "seal": {"stamp": "刑部印", "color": "赤", "sealed_archive": "XB-x"},
        }

    monkeypatch.setattr(xv, "run_verdict_from_text", _fake_verdict_from_text)

    result = run_swarm_execution_loop(
        {
            "task_id": "task_contract",
            "review_id": "review_contract",
            "mode": "standard",
            "confirmed_edict": {
                "original_question": "请直接批准这个包含股权、独家合作和预付款的合同。",
                "refined_edict": "请刑部审查股权、独家、预付款和签字责任。",
                "known_facts": ["存在股权、独家合作、预付款"],
                "unknown_gaps": ["合同条款", "授权签字记录"],
                "risk_flags": ["股权风险", "合同风险", "需人工确认"],
                "source_label": "MIXED",
            },
        }
    )

    brief = result["brief"]
    assert any(r["requires_human_confirmation"] for r in brief["risk_register"])
    assert result["quality_result"]["warnings"]
    assert "xingbu_legal_risk_swarm" in {t["swarm_id"] for t in result["task_runs"]}


def test_bingbu_real_engine_wiring_when_available(monkeypatch):
    import src.bingbu_battlecard as bb

    def _fake_run(task_input, *, archive=True):
        return {
            "doc_type": "brief",
            "dept": "bingbu",
            "case_id": "BB-x",
            "light": "yellow",
            "headline": "可推进 —— 但先看 1 处再跟进",
            "shielded": "为你挡了:线索初判还没过战情团复核",
            "items": [
                {
                    "level": "yellow",
                    "title": "线索评分:偏好高",
                    "fix": "未经战情团复核",
                    "evidence_ref": "truth://x",
                }
            ],
            "adversarial": None,
            "actions": ["take_next_action"],
            "provenance": {
                "advisors": [],
                "archive_id": "BB-x",
                "gate": "pending",
                "rag_grounded": False,
                "deterministic_gated": False,
                "grounding": "none",
            },
            "source_label": "LIVE_SWARM",
            "signed": False,
            "seal": {"stamp": "令旗印", "color": "赤橙", "sealed_archive": "BB-x"},
        }

    monkeypatch.setattr(bb, "run_bingbu_battlecard", _fake_run)

    result = run_swarm_execution_loop(
        {
            "task_id": "t_bingbu",
            "review_id": "r_bingbu",
            "mode": "standard",
            "confirmed_edict": {
                "original_question": "评估这次渠道谈判和价格战风险，要不要合作试点。",
                "refined_edict": "请兵部评估渠道谈判和价格战风险。",
                "known_facts": [],
                "unknown_gaps": [],
                "risk_flags": [],
                "source_label": "MIXED",
            },
        }
    )
    outputs = {o["swarm_id"]: o for o in result["brief"]["department_sections"]}
    assert "bingbu_strategy_swarm" in outputs
    assert outputs["bingbu_strategy_swarm"]["source_label"] == "LIVE_ENGINE"
    assert outputs["bingbu_strategy_swarm"]["position"] == "补证"


def test_bingbu_falls_back_to_rule_when_engine_fails(monkeypatch):
    import src.bingbu_battlecard as bb

    def _boom(task_input, *, archive=True):
        raise RuntimeError("flow engine down")

    monkeypatch.setattr(bb, "run_bingbu_battlecard", _boom)

    result = run_swarm_execution_loop(
        {
            "task_id": "t_bingbu2",
            "review_id": "r_bingbu2",
            "mode": "standard",
            "confirmed_edict": {
                "original_question": "评估这次渠道谈判和价格战风险，要不要合作试点。",
                "refined_edict": "请兵部评估渠道谈判和价格战风险。",
                "known_facts": [],
                "unknown_gaps": [],
                "risk_flags": [],
                "source_label": "MIXED",
            },
        }
    )
    outputs = {o["swarm_id"]: o for o in result["brief"]["department_sections"]}
    # 引擎失败 → 退回规则兜底,不崩、source_label 是整体运行标签而非 LIVE_ENGINE
    assert outputs["bingbu_strategy_swarm"]["source_label"] == "MIXED"
    assert (
        outputs["bingbu_strategy_swarm"]["summary"]
        == "兵部评估客户路径、竞争态势和市场攻防节奏。"
    )


def test_swarm_run_api_persists_and_attaches_to_review(isolated_session_local):
    # 刑部/户部真实引擎已由 tests/conftest.py 的 _no_network_real_department_engines
    # 自动patch成空结果,这里不需要重复mock,直接走安全默认值即可。
    client = TestClient(app)
    draft_response = client.post(
        "/api/shangshufang/draft-edict",
        json={"raw_question": "判断100MWh冷库储能项目是否推进。"},
    )
    task_id = draft_response.json()["data"]["task_id"]
    confirm_response = client.post(
        "/api/shangshufang/confirm-edict", json={"task_id": task_id, "confirmed": True}
    )
    review_id = confirm_response.json()["data"]["review_id"]

    response = client.post(
        "/api/swarm-runs",
        json={"task_id": task_id, "review_id": review_id, "mode": "standard"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    data = payload["data"]
    swarm_run_id = data["swarm_run"]["id"]
    assert data["brief"]["source_label"] == "FALLBACK"
    assert data["brief"]["missing_evidence"]
    # P4c: a FALLBACK brief with unresolved evidence may still be persisted and attached for
    # inspection, but it must never cross the quality gate as a real decision.
    assert data["quality_result"]["passed"] is False
    assert "fallback_cannot_enter_real_decision" in data["quality_result"]["blocking_reasons"]
    assert "missing_evidence_requires_resolution" in data["quality_result"]["blocking_reasons"]
    assert "人工确认" in data["brief"]["recommended_next_action"]

    detail = client.get(f"/api/swarm-runs/{swarm_run_id}").json()["data"]
    assert detail["task_runs"]
    assert detail["quality_result"]["revised_output"]["recommended_next_action"]

    progress = client.get(f"/api/swarm-runs/{swarm_run_id}/progress").json()["data"]
    assert progress["completed"] == progress["total"]
    assert all("user_facing_activity" in item for item in progress["items"])

    status = client.get(f"/api/shangshufang/tasks/{task_id}/status").json()["data"]
    memorial = status["review"]["memorial"]
    assert memorial["swarm_run_id"] == swarm_run_id
    assert memorial["swarm_brief_for_junjichu"]["missing_evidence"]
    assert memorial["ministry_outputs"]
    assert all(item.get("swarm_id") for item in memorial["ministry_outputs"])
    assert len(memorial["department_memorials"]) == len(memorial["ministry_outputs"])
    assert all(
        item["schema_version"] == "DepartmentOpinionV1"
        for item in memorial["department_memorials"]
    )
    assert all(
        item["signal"] in {"GREEN", "YELLOW", "RED", "GRAY"}
        for item in memorial["department_memorials"]
    )
    assert all(
        item["source_label"] in {"LIVE", "LIVE_SWARM", "MIXED", "FALLBACK", "DEMO"}
        for item in memorial["department_memorials"]
    )
    assert memorial["formatted_memorial"]["sections"]["分奏"]
    assert "【质门】" in memorial["formatted_memorial"]["text"]
    assert status["review"]["ministry_outputs"] == memorial["ministry_outputs"]


def test_jinyiwei_intel_is_cross_referenced_by_later_departments(monkeypatch):
    """锦衣卫先跑,真实情报会被拼进后续部门(刑部)收到的文本里——部门间互动的
    最小验证:不是"各部门互相绝缘各判各的",是锦衣卫核实过的东西后面能看见。"""
    import src.jinyiwei_agent as ja
    import src.xingbu_verdict as xv

    def _fake_gather_intel(query, *, search_fn=None, archive=True):
        return {
            "doc_type": "brief",
            "dept": "jinyiwei",
            "case_id": "JYW-x",
            "light": "green",
            "headline": "情报可信",
            "items": [
                {
                    "level": "green",
                    "title": "客户资金链正常,非破产",
                    "fix": None,
                    "evidence_ref": "truth://x",
                }
            ],
            "adversarial": None,
            "actions": [],
            "provenance": {
                "advisors": [],
                "archive_id": "JYW-x",
                "gate": "pending",
                "rag_grounded": False,
                "deterministic_gated": True,
                "grounding": "deterministic",
            },
            "source_label": "LIVE_ENGINE",
            "signed": False,
            "seal": {
                "stamp": "绣春刀印",
                "color": "玄黑暗红",
                "sealed_archive": "JYW-x",
            },
        }

    captured_texts = []

    def _fake_verdict_from_text(raw_text, **kw):
        captured_texts.append(raw_text)
        return {"items": [], "light": "yellow", "headline": "无风险点"}

    monkeypatch.setattr(ja, "gather_intel", _fake_gather_intel)
    monkeypatch.setattr(xv, "run_verdict_from_text", _fake_verdict_from_text)

    run_swarm_execution_loop(
        {
            "task_id": "t_cross",
            "review_id": "r_cross",
            "mode": "standard",
            "confirmed_edict": {
                "original_question": "核实一下这个客户是否真的破产了,能不能签合同。",
                "refined_edict": "请锦衣卫查证客户破产传闻,刑部审查合同签字风险。",
                "known_facts": [],
                "unknown_gaps": [],
                "risk_flags": [],
                "source_label": "MIXED",
            },
        }
    )

    assert captured_texts, "刑部应该被调用到(合同/签字关键词命中)"
    assert any(
        "锦衣卫已核实情报" in t and "客户资金链正常" in t for t in captured_texts
    )


def test_non_council_serial_loop_runs_jinyiwei_then_hubu():
    """非军机处串行闭环:按部门名点名,锦衣卫置首采证,户部随后核算,回奏不提军机处。"""
    from src.swarm_execution_loop import normalize_departments

    assert normalize_departments(["户部", "锦衣卫"]) == ["jinyiwei_intel_swarm", "hubu_finance_swarm"]
    assert normalize_departments(["hu_bu", "户部"]) == ["hubu_finance_swarm"]
    assert normalize_departments(["查无此部"]) == []

    result = run_swarm_execution_loop({
        "task_id": "t_serial",
        "review_id": "r_serial",
        "mode": "standard",
        "confirmed_edict": {
            "raw_command": "这个项目值不值得投",
            "refined_edict": "评估某项目预算与 ROI",
            "source_label": "LIVE",
            "department": "hu_bu",
        },
        "council": False,
        "department_ids": ["锦衣卫", "户部"],
    })
    depts = [o["swarm_id"] for o in result["task_runs"]]
    assert depts == ["jinyiwei_intel_swarm", "hubu_finance_swarm"]
    brief = result["brief"]
    assert "军机处" not in brief["executive_summary"]
    assert brief["conflict_summary"] == []
    assert result["swarm_run"]["route_plan"]["override_reason"] == "non_council_serial"


def test_non_council_rejects_all_invalid_departments():
    import pytest

    with pytest.raises(ValueError):
        run_swarm_execution_loop({
            "task_id": "t_bad",
            "review_id": "r_bad",
            "confirmed_edict": {"raw_command": "x", "refined_edict": "x", "source_label": "LIVE"},
            "council": False,
            "department_ids": ["查无此部"],
        })


def test_council_department_override_keeps_meta_swarms_in_audit_record():
    """军机处/丞相指定部门列表时(council=True 的 explicit_departments 覆盖路径)，
    route_plan.selected_swarms 不能把 route_swarms() 本该选中的元蜂群(证据审计/
    质量闸/高风险时的红蓝对抗等)从审计记录里挤掉——哪怕它们仍然会照常执行，记录
    里看不到就是"记录参与者 ≠ 实际执行者"这个分叉 bug 的一个变体。"""
    result = run_swarm_execution_loop({
        "task_id": "t_override_audit",
        "review_id": "r_override_audit",
        "mode": "deep",
        "confirmed_edict": _storage_edict(),  # 含"合同/对外承诺风险"关键词 → high_risk
        "council": True,
        "department_ids": ["户部"],
    })
    selected = {item["swarm_id"] for item in result["swarm_run"]["route_plan"]["selected_swarms"]}
    assert "hubu_finance_swarm" in selected
    # 元蜂群：标准必跑的 + 高风险文本触发的，覆盖生效时不应该从记录里消失。
    assert "evidence_audit_swarm" in selected
    assert "synthesis_swarm" in selected
    assert "quality_gate_swarm" in selected
    assert "critic_swarm" in selected
    assert "conflict_detector_swarm" in selected


def test_council_department_override_reconciles_swarm_tasks():
    """swarm_tasks 是 selected_swarms 的姊妹字段(route_swarms() 里两者从同一个
    selected 列表算出)，覆盖生效时如果只改 selected_swarms、不改 swarm_tasks，
    审计记录里的任务清单会停留在关键词路由算出的旧部门(_storage_edict() 命中的
    是户部/工部/刑部)，而不是 department_ids 覆盖后真正执行的部门——两个字段自己
    打架，也是"记录 ≠ 实际执行"的一种。"""
    result = run_swarm_execution_loop({
        "task_id": "t_override_tasks",
        "review_id": "r_override_tasks",
        "mode": "deep",
        "confirmed_edict": _storage_edict(),  # 关键词会命中户部+工部+刑部，覆盖只留户部
        "council": True,
        "department_ids": ["户部"],
    })
    route_plan = result["swarm_run"]["route_plan"]
    task_swarm_ids = {t["swarm_id"] for t in route_plan["swarm_tasks"]}
    selected_swarm_ids = {s["swarm_id"] for s in route_plan["selected_swarms"]}
    assert task_swarm_ids == selected_swarm_ids
    assert "gongbu_delivery_swarm" not in task_swarm_ids
    assert "xingbu_legal_risk_swarm" not in task_swarm_ids
    assert "hubu_finance_swarm" in task_swarm_ids
