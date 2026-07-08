"""洞C 端到端管道:带 si 标签归档 → 司档案真显数据(证明不是空管道,deming 警告)。"""
from src import case_archive as ca
from src import si_profile as sp


def _q(score=8.0):
    return {"total_score": score, "grade": "A", "scores": {}}


def test_archive_with_si_flows_into_profile(tmp_path, monkeypatch):
    monkeypatch.setattr(ca, "PENDING_DIR", tmp_path / "pending")
    monkeypatch.setattr(ca, "APPROVED_DIR", tmp_path / "approved")

    # 带 dept+si 标签归档两条会计司案例
    ca.auto_archive("R1", "垫资合同评审", {"light": "PASS", "provenance": {"rag_hit": True}},
                    _q(), "flow_legal", dept="hubu", si="accounting")
    ca.auto_archive("R2", "账期风险", {"light": "驳回", "workflow": {"reworked": True}},
                    _q(), "flow_legal", dept="hubu", si="accounting")
    # 另一个司,不该串进来
    ca.auto_archive("R3", "预算测算", {"light": "PASS"}, _q(), "flow", dept="hubu", si="budget")

    recs = ca.records_for_si("hubu", "accounting")
    assert len(recs) == 2                      # 只取本司,不串 budget
    assert {r["case_id"] for r in recs} == {"R1", "R2"}

    prof = sp.build_si_profile("hubu", "accounting", records_fn=ca.records_for_si)
    assert prof["resume"]["case_count"] == 2   # 司档案真显数据,不再空
    assert prof["contribution"]["memorials"] == 2


def test_untagged_archive_stays_empty(tmp_path, monkeypatch):
    monkeypatch.setattr(ca, "PENDING_DIR", tmp_path / "pending")
    monkeypatch.setattr(ca, "APPROVED_DIR", tmp_path / "approved")
    # 无 si 标签的旧式归档 → 不计入任何司(禁假,诚实空)
    ca.auto_archive("R9", "无标签案例", {"light": "PASS"}, _q(), "flow")
    assert ca.records_for_si("hubu", "accounting") == []
