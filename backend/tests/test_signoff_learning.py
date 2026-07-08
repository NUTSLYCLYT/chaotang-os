"""签字学习环（④皇帝签字=学习信号 + ⑩失败记忆自愈环）单元测试。

设计意图：
- 皇帝/二审对某部上奏「驳回(reject)」时，把驳回理由沉淀为该部的一条教训。
- 下次同部蜂群上奏前调用 recall_lessons(dept)，取回历史教训以规避重复犯错。
- approve 是正向信号（强化），reject 是教训（自愈）。

覆盖：
- record_signoff(reject) 写一条 → recall_lessons 取回（核心闭环）
- approve 不进教训池（只记正向信号，不污染规避列表）
- recall 按部门隔离（甲部教训不串到乙部）
- recall 默认按时间倒序、可截断 limit
- 非法 decision / 空 dept fail-fast
- JSONL 落盘格式可被独立解析（账面可审计）
"""

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src import signoff_learning as sl


@pytest.fixture
def store(tmp_path):
    """每个测试用独立的 JSONL 文件，避免污染真实 data/ 与彼此。"""
    return sl.SignoffLearning(path=tmp_path / "signoff_learning.jsonl")


# ---------------------------------------------------------------------------
# 核心闭环：record(reject) → recall 取回
# ---------------------------------------------------------------------------


def test_record_reject_then_recall(store):
    rec = store.record_signoff(
        case_id="C-1",
        decision="reject",
        dept="刑部",
        reason="红线证据链断裂，未锚定快照哈希。",
    )
    assert rec["decision"] == "reject"
    assert rec["dept"] == "刑部"

    lessons = store.recall_lessons("刑部")
    assert len(lessons) == 1
    assert "红线证据链断裂" in lessons[0]


def test_approve_is_not_a_lesson(store):
    store.record_signoff(
        case_id="C-2", decision="approve", dept="户部", reason="报价合规，准奏。"
    )
    # approve 是正向信号，不进规避教训池
    assert store.recall_lessons("户部") == []


def test_lessons_isolated_by_dept(store):
    store.record_signoff(
        case_id="C-3", decision="reject", dept="刑部", reason="刑部教训A"
    )
    store.record_signoff(
        case_id="C-4", decision="reject", dept="兵部", reason="兵部教训B"
    )
    assert store.recall_lessons("刑部") == ["刑部教训A"]
    assert store.recall_lessons("兵部") == ["兵部教训B"]


def test_recall_newest_first_and_limit(store):
    for i in range(5):
        store.record_signoff(
            case_id=f"C-{i}", decision="reject", dept="御史台", reason=f"教训{i}"
        )
    lessons = store.recall_lessons("御史台", limit=2)
    assert lessons == ["教训4", "教训3"]  # 最新在前


def test_recall_empty_for_unknown_dept(store):
    assert store.recall_lessons("不存在的部") == []


# ---------------------------------------------------------------------------
# fail-fast 边界
# ---------------------------------------------------------------------------


def test_invalid_decision_rejected(store):
    with pytest.raises(ValueError):
        store.record_signoff(case_id="C", decision="maybe", dept="刑部", reason="x")


def test_empty_dept_rejected(store):
    with pytest.raises(ValueError):
        store.record_signoff(case_id="C", decision="reject", dept="  ", reason="x")


def test_empty_reason_rejected_for_reject(store):
    # reject 没有理由就无法成为教训 → fail-fast
    with pytest.raises(ValueError):
        store.record_signoff(case_id="C", decision="reject", dept="刑部", reason="")


# ---------------------------------------------------------------------------
# 账面可审计：JSONL 落盘可被独立解析
# ---------------------------------------------------------------------------


def test_jsonl_is_parseable(store, tmp_path):
    store.record_signoff(
        case_id="C-9", decision="reject", dept="工部", reason="施工方案缺验收口径。"
    )
    raw = (tmp_path / "signoff_learning.jsonl").read_text(encoding="utf-8")
    lines = [json.loads(x) for x in raw.splitlines() if x.strip()]
    assert len(lines) == 1
    e = lines[0]
    assert e["dept"] == "工部"
    assert e["decision"] == "reject"
    assert "ts" in e and "case_id" in e


# ---------------------------------------------------------------------------
# 健康度账面：approve/reject 计数 + 在转部门
# ---------------------------------------------------------------------------


def test_health_counts(store):
    store.record_signoff(case_id="A", decision="approve", dept="户部", reason="准")
    store.record_signoff(case_id="B", decision="reject", dept="户部", reason="数字错")
    store.record_signoff(case_id="C", decision="reject", dept="刑部", reason="红线")
    h = store.health()
    assert h["total"] == 3
    assert h["approve"] == 1
    assert h["reject"] == 2
    assert h["lessons_by_dept"]["户部"] == 1
    assert h["lessons_by_dept"]["刑部"] == 1


# ---------------------------------------------------------------------------
# 模块级便捷函数（默认单例，复用真实 data/ 路径）应可调用且隔离
# ---------------------------------------------------------------------------


def test_module_level_helpers(tmp_path, monkeypatch):
    # 把默认单例指向 tmp，避免写真实 data/
    monkeypatch.setattr(sl, "_DEFAULT", sl.SignoffLearning(path=tmp_path / "m.jsonl"))
    sl.record_signoff(
        case_id="M-1", decision="reject", dept="史馆", reason="归档缺索引"
    )
    assert sl.recall_lessons("史馆") == ["归档缺索引"]
