"""跨部门矛盾自动暴露 — 测试。

验证 src/cross_dept_conflict.detect_conflicts 能从各部奏折里检出
跨部张力(兵部投标 vs 户部现金/亏损 等),供军机处会审。
"""

from __future__ import annotations

from src.cross_dept_conflict import detect_conflicts


def test_bidding_vs_cash_tension_detected():
    """兵部建议投标 X + 户部现金紧张/亏损 → 检出一条投标↔成本冲突。"""
    memorials = [
        {
            "dept": "兵部",
            "swarm": "voice_sales",
            "summary": "建议投标 X 项目，抢占增长窗口。",
        },
        {
            "dept": "户部",
            "swarm": "quotation",
            "summary": "当前现金紧张，继续投入恐进一步亏损。",
        },
    ]
    conflicts = detect_conflicts(memorials)

    assert len(conflicts) >= 1
    c = conflicts[0]
    assert set(c["depts"]) == {"兵部", "户部"}
    assert c["tension"]
    assert c["evidence"]
    # evidence 必须能回指两边奏折的原文关键词
    assert "投标" in c["evidence"]
    assert ("现金" in c["evidence"]) or ("亏损" in c["evidence"])


def test_publish_vs_compliance_tension_detected():
    """礼部要对外发布 + 刑部涉密/合规 → 检出发布↔合规冲突。"""
    memorials = [
        {
            "dept": "礼部",
            "swarm": "content",
            "summary": "建议对外发布客户成功案例做内容营销。",
        },
        {
            "dept": "刑部",
            "swarm": "legal",
            "summary": "该案例含涉密信息，未脱密前不得对外，存合规风险。",
        },
    ]
    conflicts = detect_conflicts(memorials)

    assert len(conflicts) >= 1
    pairs = [set(c["depts"]) for c in conflicts]
    assert {"礼部", "刑部"} in pairs


def test_no_conflict_when_aligned():
    """两部奏折方向一致、无对立关键词 → 不应误报。"""
    memorials = [
        {
            "dept": "工部",
            "swarm": "delivery",
            "summary": "新功能已打样，交付排期可控。",
        },
        {
            "dept": "史官",
            "swarm": "archive",
            "summary": "归档本次决策证据链，便于复盘。",
        },
    ]
    conflicts = detect_conflicts(memorials)
    assert conflicts == []


def test_english_slug_and_agent_code_normalized():
    """dept 用英文 slug / agent code 也能匹配到同一部门张力。"""
    memorials = [
        {"dept": "ops", "swarm": "voice_sales", "summary": "建议报价拿下投标 X。"},
        {
            "dept": "hu_bu",
            "swarm": "quotation",
            "summary": "成本过高，毛利跌破红线会亏损。",
        },
    ]
    conflicts = detect_conflicts(memorials)
    assert len(conflicts) >= 1
    # 归一化后展示用部门名应为中文 canonical
    assert set(conflicts[0]["depts"]) == {"兵部", "户部"}


def test_empty_and_malformed_input_safe():
    """空输入 / 缺字段不崩,返回空冲突列表。"""
    assert detect_conflicts([]) == []
    assert detect_conflicts([{"dept": "兵部"}]) == []  # 只有一条且缺 summary
    assert detect_conflicts([{}, {}]) == []


def test_same_department_not_self_conflict():
    """同一部门两条奏折即使有对立词,也不算跨部门冲突。"""
    memorials = [
        {"dept": "兵部", "swarm": "a", "summary": "建议投标 X。"},
        {"dept": "兵部", "swarm": "b", "summary": "现金紧张，亏损风险高。"},
    ]
    conflicts = detect_conflicts(memorials)
    assert conflicts == []


def test_growth_vs_profit_tension_detected():
    """增长叙事 vs 利润红线 → 检出增长↔利润冲突。"""
    memorials = [
        {"dept": "兵部", "swarm": "ops", "summary": "烧钱换增长，先抢市场份额。"},
        {
            "dept": "户部",
            "swarm": "finance",
            "summary": "利润红线不能破，毛利已逼近警戒线。",
        },
    ]
    conflicts = detect_conflicts(memorials)
    assert len(conflicts) >= 1
    assert {"兵部", "户部"} in [set(c["depts"]) for c in conflicts]
