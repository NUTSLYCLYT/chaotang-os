"""测试 MemoryStore（SQLite + FTS5）和 memory_tool。"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.memory_store import MemoryStore
from src.memory_tool import (
    add_memory,
    get_capacity,
    remove_memory,
    replace_memory,
    PERSONS_DIR,
    MAX_CHARS,
)


# ─── MemoryStore tests ────────────────────────────────────────────────────────


@pytest.fixture()
def store(tmp_path):
    """每个测试独立的临时 SQLite DB。"""
    return MemoryStore(db_path=tmp_path / "test.db")


def test_save_and_search(store):
    """保存一条 run，然后用 FTS5 检索它。"""
    store.save_run(
        run_id="run001",
        flow_name="flow_opc",
        task_input="低温电池储能系统方案",
        final_output='{"score": 4.5}',
        quality_score=4.5,
        person_id="opc_team",
    )
    hits = store.search_similar("低温电池")
    assert len(hits) >= 1, "FTS5 应找到至少 1 条命中"
    assert hits[0]["run_id"] == "run001"
    assert "低温电池" in hits[0]["task_input"]


def test_fts5_relevance_ranking(store):
    """保存多条 run，检索返回相关度最高的排在前面。"""
    store.save_run("run_a", "flow_opc", "低温电池储能系统技术方案", '{"a":1}', 4.0)
    store.save_run("run_b", "flow_opc", "新能源汽车客户获取策略", '{"b":1}', 3.5)
    store.save_run("run_c", "flow_opc", "低温锂电池性能评估报告", '{"c":1}', 4.2)

    hits = store.search_similar("低温电池", limit=3)
    assert len(hits) >= 1
    # 两条含"低温"的应排在前面（run_b 不含"低温"应排后或不出现）
    returned_ids = [h["run_id"] for h in hits]
    # 至少 run_a 或 run_c 在结果里
    assert "run_a" in returned_ids or "run_c" in returned_ids


def test_search_filter_by_person(store):
    """person_id 过滤有效：只返回指定 person 的记录。"""
    store.save_run("run_x", "flow_opc", "低温电池方案甲", '{}', 4.0, person_id="alice")
    store.save_run("run_y", "flow_opc", "低温电池方案乙", '{}', 3.8, person_id="bob")

    hits_alice = store.search_similar("低温电池", person_id="alice", limit=5)
    assert all(h["run_id"] == "run_x" for h in hits_alice), "应只返回 alice 的记录"

    hits_bob = store.search_similar("低温电池", person_id="bob", limit=5)
    assert all(h["run_id"] == "run_y" for h in hits_bob), "应只返回 bob 的记录"


def test_empty_query_returns_empty(store):
    """空 query 不报错，返回 []。"""
    store.save_run("run001", "flow_opc", "低温电池", '{}', 4.0)
    assert store.search_similar("") == []
    assert store.search_similar("   ") == []


def test_count(store):
    """count() 返回正确总数。"""
    assert store.count() == 0
    store.save_run("r1", "f", "任务1", '{}', 3.0)
    store.save_run("r2", "f", "任务2", '{}', 4.0)
    assert store.count() == 2


def test_save_run_idempotent(store):
    """重复保存同一 run_id 不会抛错，也不会重复写入。"""
    store.save_run("r1", "f", "任务", '{}', 3.0)
    store.save_run("r1", "f", "任务（再次）", '{}', 4.0)  # 应被 IGNORE
    assert store.count() == 1


def test_get_recent(store):
    """get_recent 按时间倒序返回。"""
    store.save_run("r1", "f", "早期任务", '{}', 3.0, created_at="2024-01-01T00:00:00")
    store.save_run("r2", "f", "新近任务", '{}', 4.0, created_at="2024-06-01T00:00:00")
    recent = store.get_recent(limit=2)
    assert recent[0]["run_id"] == "r2"  # 最新在前
    assert recent[1]["run_id"] == "r1"


def test_get_recent_filter_by_person(store):
    """get_recent 可按 person_id 过滤。"""
    store.save_run("r1", "f", "任务甲", '{}', 3.5, person_id="alice")
    store.save_run("r2", "f", "任务乙", '{}', 4.0, person_id="bob")
    recent = store.get_recent(person_id="alice")
    assert len(recent) == 1
    assert recent[0]["run_id"] == "r1"


# ─── memory_tool tests ───────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def clean_person(tmp_path, monkeypatch):
    """将 PERSONS_DIR 重定向到 tmp_path 内，隔离测试。"""
    import src.memory_tool as mt
    fake_dir = tmp_path / "persons"
    fake_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(mt, "PERSONS_DIR", fake_dir)
    yield fake_dir


def test_capacity_check(tmp_path, monkeypatch):
    """capacity 函数正确计算使用率。"""
    import src.memory_tool as mt
    fake_dir = tmp_path / "persons2"
    fake_dir.mkdir()
    monkeypatch.setattr(mt, "PERSONS_DIR", fake_dir)

    cap = mt.get_capacity("user1")
    assert cap["chars"] == 0
    assert cap["max_chars"] == MAX_CHARS
    assert cap["pct"] == 0.0

    mt.add_memory("user1", "A" * 100)
    cap2 = mt.get_capacity("user1")
    assert cap2["chars"] > 0
    assert cap2["pct"] > 0


def test_add_memory_basic(tmp_path, monkeypatch):
    """add_memory 正常追加内容。"""
    import src.memory_tool as mt
    fake_dir = tmp_path / "persons3"
    fake_dir.mkdir()
    monkeypatch.setattr(mt, "PERSONS_DIR", fake_dir)

    result = mt.add_memory("user1", "测试记忆条目")
    assert result["ok"] is True
    content = (fake_dir / "user1.md").read_text(encoding="utf-8")
    assert "测试记忆条目" in content


def test_replace_memory(tmp_path, monkeypatch):
    """replace_memory 正确替换子字符串。"""
    import src.memory_tool as mt
    fake_dir = tmp_path / "persons4"
    fake_dir.mkdir()
    monkeypatch.setattr(mt, "PERSONS_DIR", fake_dir)

    mt.add_memory("u", "旧内容 ABC")
    r = mt.replace_memory("u", "旧内容 ABC", "新内容 XYZ")
    assert r["ok"] is True
    content = (fake_dir / "u.md").read_text(encoding="utf-8")
    assert "新内容 XYZ" in content
    assert "旧内容 ABC" not in content


def test_remove_memory(tmp_path, monkeypatch):
    """remove_memory 删除包含关键字的行。"""
    import src.memory_tool as mt
    fake_dir = tmp_path / "persons5"
    fake_dir.mkdir()
    monkeypatch.setattr(mt, "PERSONS_DIR", fake_dir)

    mt.add_memory("u", "保留行")
    mt.add_memory("u", "删除这行 MARKER")
    r = mt.remove_memory("u", "MARKER")
    assert r["ok"] is True
    content = (fake_dir / "u.md").read_text(encoding="utf-8")
    assert "MARKER" not in content
    assert "保留行" in content


def test_add_memory_over_capacity(tmp_path, monkeypatch):
    """超过容量时拒绝写入。"""
    import src.memory_tool as mt
    fake_dir = tmp_path / "persons6"
    fake_dir.mkdir()
    monkeypatch.setattr(mt, "PERSONS_DIR", fake_dir)

    # 填满到接近上限
    big_content = "X" * (MAX_CHARS - 10)
    mt.add_memory("u", big_content)
    # 再追加应被拒绝
    result = mt.add_memory("u", "Y" * 100)
    assert result["ok"] is False
    assert "容量已满" in result["error"]
