"""tests/test_court_doc_builder.py — 共享装配器:一个模块让 11 部门全到 L1,零重复。"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from src import court_doc_builder as cdb

_SCHEMA = json.loads(
    (Path(__file__).resolve().parent.parent / "schemas" / "court_doc.json").read_text(
        encoding="utf-8"
    )
)


def test_all_11_depts_build_valid_court_doc():
    for dept, cfg in cdb.DEPT_REGISTRY.items():
        doc = cdb.build_court_doc(
            dept,
            items=[{"level": "yellow", "title": "x", "fix": "改"}],
            archive=False,
        )
        for f in _SCHEMA["required"]:
            assert f in doc, f"{dept} 缺字段 {f}"
        assert doc["dept"] == dept
        assert doc["doc_type"] == cfg["doc_type"]
        assert (
            doc["seal"]["stamp"] == cfg["stamp"]
            and doc["seal"]["color"] == cfg["color"]
        )


def test_qintianjian_reviewed_defaults_false_and_can_be_set_true():
    doc_default = cdb.build_court_doc("hubu", items=[{"level": "green"}], archive=False)
    assert doc_default["provenance"]["qintianjian_reviewed"] is False

    doc_reviewed = cdb.build_court_doc(
        "hubu",
        items=[{"level": "green"}],
        archive=False,
        qintianjian_reviewed=True,
    )
    assert doc_reviewed["provenance"]["qintianjian_reviewed"] is True


def test_auto_generated_case_id_does_not_collide_same_day():
    """固定 "-000" 后缀会让同一天两次未显式传 case_id 的调用撞车，truth_ledger 按
    case_id 查询时可能读到不相关的另一条判决(2026-07-09 复审修复)。"""
    doc1 = cdb.build_court_doc("hubu", items=[{"level": "green"}], archive=False)
    doc2 = cdb.build_court_doc("hubu", items=[{"level": "green"}], archive=False)
    assert doc1["case_id"] != doc2["case_id"]


def test_unregistered_dept_raises():
    with pytest.raises(ValueError, match="未注册部门"):
        cdb.build_court_doc("no-such-dept", items=[], archive=False)


def test_c2_advisor_as_gatekeeper_raises():
    # 参谋名单混入放行人 yushi → C2 断言抛
    with pytest.raises(ValueError, match="C2 违反"):
        cdb.build_court_doc(
            "hubu", items=[], advisors=["deming", "yushi"], archive=False
        )


def test_grounding_gate_downgrades_without_rag():
    # 观点席 deming 未命中 RAG → gate pending + 需人工
    doc = cdb.build_court_doc(
        "hubu",
        items=[{"level": "red", "fix": "x"}],
        advisors=["deming"],
        rag_hit=False,
        archive=False,
    )
    assert doc["provenance"]["gate"] == "pending"
    assert doc["provenance"]["rag_grounded"] is False


def test_grounding_passes_with_rag():
    doc = cdb.build_court_doc(
        "hubu",
        items=[{"level": "green"}],
        advisors=["deming"],
        rag_hit=True,
        archive=False,
    )
    assert doc["provenance"]["gate"] == "passed"
    assert doc["provenance"]["rag_grounded"] is True


def test_light_computation():
    assert cdb.compute_light([{"level": "green"}]) == "green"
    assert cdb.compute_light([{"level": "red", "fix": "x"}]) == "yellow"
    assert cdb.compute_light([{"level": "red", "fix": ""}]) == "red"
    assert cdb.compute_light([], escalate_black=True) == "black"


def test_empty_findings_ungrounded_does_not_show_green():
    """真实扫描件合同复现:pypdf 抽不出文字 → LLM 拿到空文本 → items=[]。
    compute_light([]) 恒为 green,但 gate 已经 pending(未接地)——不能让 light 继续挂绿灯,
    否则只读 light 字段的消费方(前端/仪表盘)会把"系统没读到东西"看成"审过了,没问题"。
    """
    doc = cdb.build_court_doc(
        "xingbu", items=[], advisors=["richard-posner"], rag_hit=False, archive=False
    )
    assert doc["provenance"]["gate"] == "pending"
    assert doc["light"] != "green"
    assert "人工" in doc["headline"]


def test_empty_findings_grounded_or_no_advisors_stays_green():
    """对照:没有参谋(needs=False)时,green 不该被误伤。"""
    doc_no_advisors = cdb.build_court_doc(
        "xingbu", items=[], advisors=[], archive=False
    )
    assert doc_no_advisors["provenance"]["gate"] == "passed"
    assert doc_no_advisors["light"] == "green"


def test_empty_findings_fallback_source_does_not_show_green():
    """2026-07-06 独立会审 HIGH:无参谋文书 needs=False,接地降级整段跳过——
    蜂群超时/全失败 → items 空 → 恒 green + "可推进",但来源是 FALLBACK,根本没真跑。
    空产出 + 非 live 来源 ≠ 确认没事,三字段(light/gate/headline)必须一致降级。
    """
    doc = cdb.build_court_doc(
        "bingbu", items=[], advisors=[], source_label="FALLBACK", archive=False
    )
    assert doc["light"] != "green", "空蜂群 FALLBACK 仍绿灯——未真跑冒充确认没事"
    assert doc["provenance"]["gate"] == "pending"


def test_empty_findings_live_source_stays_green():
    """对照:LIVE 蜂群真跑过、确实没查到风险 → green 合法,不能误伤成 yellow。"""
    doc = cdb.build_court_doc(
        "bingbu", items=[], advisors=[], source_label="LIVE", archive=False
    )
    assert doc["light"] == "green"
    assert doc["provenance"]["gate"] == "passed"
