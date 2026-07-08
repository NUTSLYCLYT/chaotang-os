"""tests/test_libu_appointment_vet.py — 吏部任免:责任图红线 + agent分席(复用persona_registry/eval)。

纯确定性、离线:责任图是关键词规则;分席读 persona_registry(文件系统)+ promotion_gate(纯函数)。
"""

from __future__ import annotations

import src.libu_appointment_vet as av


def test_missing_owner_is_red():
    items = av.accountability_items("这个报价流程该怎么走")
    assert any(it["level"] == "red" and "owner" in it["title"] for it in items), items


def test_high_power_without_human_owner_is_red():
    items = av.accountability_items("让系统 L4 自动报价并自动付款")
    assert any(it["level"] == "red" and "高权限" in it["title"] for it in items), items


def test_high_power_with_human_owner_no_red():
    items = av.accountability_items(
        "L4 自动报价,指派张经理为人类 owner 并签字审批,李工为替补"
    )
    assert not any(
        "高权限" in it["title"] and it["level"] == "red" for it in items
    ), items


def test_self_review_is_yellow():
    items = av.accountability_items("owner 张三,自审通过")
    assert any(it["level"] == "yellow" and "自审" in it["title"] for it in items), items


def test_complete_accountability_is_green():
    items = av.accountability_items("owner 张三,reviewer 李四,替补王五,approval 走三省")
    assert any(it["level"] == "green" for it in items), items


def test_unregistered_persona_is_yellow_not_fabricated_judge():
    items = av.persona_appointment_items("不存在的大神xyz")
    assert items[0]["level"] == "yellow" and "未登记" in items[0]["title"], items


def test_registered_judge_persona_can_conclude():
    from src import persona_registry

    ps = [p for p in persona_registry.list_personas() if p.can_conclude]
    if not ps:  # 环境无 personas 目录时跳过(不硬失败)
        return
    items = av.persona_appointment_items(ps[0].name)
    assert any(
        it["level"] == "green" and "判官席" in it["title"] for it in items
    ), items


def test_offline_promotion_gate_refuses_without_eval():
    # 观点席离线申请升判官:无 LLM 打分 → promotion_gate 驳回(不凭空给判官权)
    from src import persona_registry

    advisors = [p for p in persona_registry.list_personas() if not p.can_conclude]
    if not advisors:
        return
    items = av.persona_appointment_items(advisors[0].name, seek_judge=True)
    assert any(it["level"] == "red" and "升判官" in it["title"] for it in items), items


def test_appointment_court_doc_shape():
    doc = av.build_appointment_verdict("谁负责这块,owner 张三,替补李四", archive=False)
    assert doc["dept"] == "libu_personnel"
    assert doc["seal"]["stamp"] == "印绶印"
    assert doc["items"]
