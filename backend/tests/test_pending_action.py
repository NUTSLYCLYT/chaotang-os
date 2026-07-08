"""pending action(此刻要我决什么)测试:排序、过滤、注册→待决→处置后消失。"""
from pathlib import Path

from src import court_state_store as css


def test_pending_ranks_by_severity_then_age(tmp_path: Path):
    p = tmp_path / "s.json"
    css.set_state("d1", "待审", dept="hubu", si="accounting", title="小事", severity=1,
                  updated_at="2026-07-01", path=p)
    css.set_state("d2", "待审", dept="hubu", si="accounting", title="大事", severity=3,
                  updated_at="2026-07-02", path=p)
    items = css.pending("hubu", "accounting", path=p)
    assert [i["doc_id"] for i in items] == ["d2", "d1"]   # 严重度高的先决


def test_pending_filters_by_dept_si(tmp_path: Path):
    p = tmp_path / "s.json"
    css.set_state("a", "待审", dept="hubu", si="accounting", severity=1, path=p)
    css.set_state("b", "待审", dept="hubu", si="budget", severity=1, path=p)
    assert {i["doc_id"] for i in css.pending("hubu", "accounting", path=p)} == {"a"}
    assert {i["doc_id"] for i in css.pending("hubu", path=p)} == {"a", "b"}   # 部门级含所有司


def test_pending_action_top_message(tmp_path: Path):
    p = tmp_path / "s.json"
    css.set_state("d2", "待审", dept="hubu", si="accounting", title="垫资合同", severity=3, path=p)
    pa = css.pending_action("hubu", "accounting", path=p)
    assert pa["has_pending"] is True and pa["count"] == 1
    assert pa["top"]["title"] == "垫资合同" and "3 项红灯" in pa["message"]


def test_resolved_doc_drops_out_of_pending(tmp_path: Path):
    p = tmp_path / "s.json"
    css.set_state("d", "待审", dept="hubu", si="accounting", title="X", severity=2, path=p)
    assert css.pending_action("hubu", "accounting", path=p)["has_pending"] is True
    # 处置(状态离开待审)→ 掉出待决队列;元数据保留
    css.set_state("d", "已准奏", action="apply_fixes", path=p)
    assert css.pending_action("hubu", "accounting", path=p)["has_pending"] is False


def test_empty_pending_is_clean(tmp_path: Path):
    pa = css.pending_action("hubu", "accounting", path=tmp_path / "none.json")
    assert pa["has_pending"] is False and "无待决" in pa["message"]
