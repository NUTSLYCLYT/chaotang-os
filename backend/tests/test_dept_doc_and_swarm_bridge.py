"""tests/test_dept_doc_and_swarm_bridge.py — 通用部门桥(#2)+ 蜂群→court_doc 焊缝(#3)。"""
from __future__ import annotations

from src import dept_doc
from src import swarm_to_court_doc as s2c


# ── #2:通用部门桥,8 部门口吻 ────────────────────────────────────────────────

def test_all_bridged_depts_build_valid_doc():
    for dept in dept_doc.DEPT_HEADLINES:
        doc = dept_doc.build_dept_doc(dept, items=[{"level": "green"}], archive=False)
        assert doc["dept"] == dept
        assert doc["light"] == "green"
        # 用了该部门的口吻
        assert doc["headline"] == dept_doc.DEPT_HEADLINES[dept]["green"]


def test_yushi_flavor_and_red():
    doc = dept_doc.build_dept_doc("yushi", items=[{"level": "red", "fix": ""}], archive=False)
    assert doc["light"] == "red" and doc["headline"] == "驳回"
    assert doc["seal"]["stamp"] == "獬豸印"


def test_jinyiwei_pending_note():
    # 观点席未接地 → 用锦衣卫的 pending note "情报待核"
    doc = dept_doc.build_dept_doc("jinyiwei", items=[{"level": "yellow"}],
                                  advisors=["bruce-schneier"], rag_hit=False, archive=False)
    assert doc["provenance"]["gate"] == "pending"
    assert "情报待核" in doc["headline"]


# ── #3:蜂群输出 → court_doc 焊缝 ─────────────────────────────────────────────

def test_swarm_risks_become_items():
    outputs = [{
        "swarm_id": "legal", "source_label": "MIXED",
        "risks": [{"severity": "high", "title": "验收模糊", "mitigation": "加条款"},
                  {"severity": "low", "title": "措辞小瑕"}],
        "missing_evidence": ["缺客户签章"],
    }]
    items = s2c.swarm_outputs_to_items(outputs)
    levels = [i["level"] for i in items]
    assert "red" in levels and "green" in levels      # high→red, low→green
    assert any("缺证据" in i["title"] for i in items)   # missing_evidence 单列


def test_assemble_from_swarm_worst_source_label():
    outputs = [{"swarm_id": "a", "source_label": "LIVE", "risks": []},
               {"swarm_id": "b", "source_label": "FALLBACK", "risks": []}]
    doc = s2c.assemble_from_swarm("gongbu", outputs, deterministic_gated=True, archive=False)
    assert doc["source_label"] == "FALLBACK"   # 取最差,不假装 LIVE
    assert doc["dept"] == "gongbu"


def test_assemble_handles_str_risks():
    doc = s2c.assemble_from_swarm("bingbu", [{"swarm_id": "x", "risks": ["对手压价"]}],
                                  deterministic_gated=True, archive=False)
    assert any("对手压价" in i["title"] for i in doc["items"])
