"""司档案测试:注册表、履历/能力/贡献、禁假空态。records_fn 全 mock,不碰真库。"""
import pytest

from src import si_profile as sp


def test_list_si_from_registry():
    si = sp.list_si("hubu")
    codes = {s["code"] for s in si}
    assert {"accounting", "treasury", "budget"} <= codes  # 户部三司登记齐


def test_unregistered_si_raises():
    with pytest.raises(ValueError):
        sp.build_si_profile("hubu", "not_a_si")


def test_empty_profile_is_honest_not_fabricated():
    # 无归档记录 → 履历/能力/贡献全诚实空,禁假
    doc = sp.build_si_profile("hubu", "accounting", records_fn=lambda d, s: [])
    assert doc["identity"]["name"] == "会计司"
    assert doc["resume"]["case_count"] == 0
    assert doc["resume"]["since"] is None            # 不编造出勤日期
    assert doc["resume"]["highlight"]["win"] is None and doc["resume"]["highlight"]["stumble"] is None
    assert doc["capability"]["scored"] is False       # 不打假分
    assert doc["capability"]["confidence"]["level"] == "无"
    assert doc["contribution"]["memorials"] == 0


def test_small_sample_scored_but_flagged():
    # 2 个案子:不足以评能力(禁假),scored=False
    two = [{"case_id": "c1", "verdict": "PASS", "grounded": True, "date": "2026-06-01"},
           {"case_id": "c2", "verdict": "PASS", "grounded": True, "date": "2026-06-02"}]
    doc = sp.build_si_profile("hubu", "accounting", records_fn=lambda d, s: two)
    assert doc["capability"]["scored"] is False
    assert doc["capability"]["confidence"]["level"] == "不足"


def test_story_cards_win_and_stumble():
    doc = sp.build_si_profile("hubu", "accounting", records_fn=_fake_records)
    hl = doc["resume"]["highlight"]
    assert hl["win"]["verdict"] == "PASS"          # 最近一次立功
    assert hl["stumble"]["verdict"] == "驳回"       # 最近一次翻车(或返工)


def _fake_records(_d, _s):
    return [
        {"case_id": "c1", "title": "垫资合同评审", "verdict": "PASS", "grounded": True, "date": "2026-06-01"},
        {"case_id": "c2", "title": "账期风险", "verdict": "驳回", "grounded": True, "reworked": True,
         "escalated": True, "date": "2026-06-20"},
        {"case_id": "c3", "title": "报表口径", "verdict": "PASS", "grounded": False, "date": "2026-06-10"},
    ]


def test_capability_computed_from_records():
    doc = sp.build_si_profile("hubu", "accounting", records_fn=_fake_records)
    cap = doc["capability"]
    assert cap["scored"] is True and cap["sample"] == 3
    assert cap["metrics"]["grounding_rate"] == pytest.approx(2 / 3, abs=1e-2)
    assert cap["metrics"]["pass_rate"] == pytest.approx(2 / 3, abs=1e-2)
    assert cap["metrics"]["rework_rate"] == pytest.approx(1 / 3, abs=1e-2)
    assert len(cap["radar"]) == 3   # 供前端雷达图


def test_resume_and_contribution_aggregate():
    doc = sp.build_si_profile("hubu", "accounting", records_fn=_fake_records)
    assert doc["resume"]["case_count"] == 3
    assert doc["resume"]["recent"][0]["date"] == "2026-06-20"   # 倒序,最近在前
    assert doc["contribution"]["memorials"] == 3
    assert doc["contribution"]["escalations_resolved"] == 1
