# tests/test_chaotang_store.py
import tempfile
from pathlib import Path

import pytest

from src import chaotang_store as cs


@pytest.fixture
def tmp_root(monkeypatch):
    d = Path(tempfile.mkdtemp())
    monkeypatch.setattr(cs, "_DATA_ROOT", d)
    return d


def test_save_and_get_review(tmp_root):
    rec = cs.save_review("mem_1", action="approve", comment="准", reviewer="皇上")
    assert rec["memorialId"] == "mem_1"
    assert rec["action"] == "approve"
    assert rec["id"]
    got = cs.get_review_for_memorial("mem_1")
    assert got is not None and got["comment"] == "准"


def test_review_rejects_bad_action(tmp_root):
    with pytest.raises(ValueError):
        cs.save_review("mem_2", action="explode", comment="", reviewer="x")


def test_save_and_get_retrospective(tmp_root):
    r = cs.save_retrospective("task_9", {"score": 4, "successes": ["快"],
                                         "failures": [], "lessons": ["复用"],
                                         "authoredBy": "史官"})
    assert r["score"] == 4
    assert cs.get_retrospective("task_9")["lessons"] == ["复用"]


def test_get_missing_returns_none(tmp_root):
    assert cs.get_review_for_memorial("nope") is None
    assert cs.get_retrospective("nope") is None
