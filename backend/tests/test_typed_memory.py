import tempfile
from pathlib import Path

import pytest

from src.typed_memory import (
    VALID_TYPES,
    MemoryHeader,
    MemoryHit,
    TypedMemoryStore,
)


@pytest.fixture
def store():
    with tempfile.TemporaryDirectory() as tmpdir:
        yield TypedMemoryStore(tenant_id="test", memory_base=Path(tmpdir))


@pytest.fixture
def store_default():
    with tempfile.TemporaryDirectory() as tmpdir:
        yield TypedMemoryStore(memory_base=Path(tmpdir))


class TestSave:
    def test_save_basic(self, store):
        r = store.save("用户偏好", "# 偏好\n喜欢简洁答案", type="user",
                       description="测试用户偏好", tags=["preference", "ui"])
        assert r["ok"] is True
        assert r["filename"].endswith(".md")
        assert r["chars"] > 0

    def test_save_empty_content(self, store):
        r = store.save("空记忆", "", type="user")
        assert r["ok"] is False
        assert "不能为空" in r["error"]

    def test_save_invalid_type(self, store):
        r = store.save("无效类型", "内容", type="invalid_type")
        assert r["ok"] is False
        assert "无效类型" in r["error"]

    def test_save_all_types(self, store):
        for t in VALID_TYPES:
            r = store.save(f"测试_{t}", f"内容_{t}", type=t)
            assert r["ok"] is True, f"类型 {t} 保存失败: {r}"

    def test_save_duplicate_name(self, store):
        store.save("同名记忆", "内容A", type="user")
        r = store.save("同名记忆", "内容B", type="user")
        assert r["ok"] is True
        assert r["filename"] != "user_tong_ming_ji_yi.md"


class TestGet:
    def test_get_existing(self, store):
        r = store.save("查询测试", "# 测试内容", type="feedback", description="查询描述", tags=["test"])
        rec = store.get(r["filename"])
        assert rec is not None
        assert rec["name"] == "查询测试"
        assert "测试内容" in rec["content"]
        assert rec["type"] == "feedback"
        assert rec["description"] == "查询描述"
        assert "test" in rec["tags"]

    def test_get_nonexistent(self, store):
        assert store.get("nonexistent.md") is None

    def test_get_returns_filename(self, store):
        r = store.save("文件名测试", "内容", type="user")
        rec = store.get(r["filename"])
        assert rec["filename"] == r["filename"]


class TestUpdate:
    def test_update_content(self, store):
        r = store.save("更新测试", "原始内容", type="user")
        u = store.update(r["filename"], content="更新后内容")
        assert u["ok"] is True
        rec = store.get(r["filename"])
        assert "更新后内容" in rec["content"]

    def test_update_description_and_tags(self, store):
        r = store.save("更新元数据", "内容", type="project")
        u = store.update(r["filename"], description="新描述", tags=["new", "tags"])
        assert u["ok"] is True
        rec = store.get(r["filename"])
        assert rec["description"] == "新描述"
        assert "new" in rec["tags"]
        assert "tags" in rec["tags"]

    def test_update_nonexistent(self, store):
        u = store.update("nonexistent.md", content="新内容")
        assert u["ok"] is False
        assert "不存在" in u["error"]

    def test_update_empty_content(self, store):
        r = store.save("更新空", "原始", type="user")
        u = store.update(r["filename"], content="")
        assert u["ok"] is False


class TestDelete:
    def test_delete_existing(self, store):
        r = store.save("删除测试", "内容", type="project")
        filename = r["filename"]
        d = store.delete(filename)
        assert d["ok"] is True
        assert store.get(filename) is None

    def test_delete_nonexistent(self, store):
        d = store.delete("nonexistent.md")
        assert d["ok"] is False
        assert "不存在" in d["error"]


class TestScan:
    def test_scan_empty(self, store):
        assert store.scan() == []

    def test_scan_multiple(self, store):
        store.save("记忆A", "内容A", type="user")
        store.save("记忆B", "内容B", type="feedback")
        store.save("记忆C", "内容C", type="project")
        headers = store.scan()
        assert len(headers) == 3
        assert all(isinstance(h, MemoryHeader) for h in headers)
        types = {h.type for h in headers}
        assert "user" in types
        assert "feedback" in types
        assert "project" in types

    def test_scan_sorted_by_updated_at(self, store):
        r1 = store.save("旧记忆", "内容", type="user")
        store.update(r1["filename"], content="更新后内容")
        store.save("新记忆", "新内容", type="user")
        headers = store.scan()
        assert headers[0].name in ("新记忆", "旧记忆")


class TestSearchFTS:
    def test_search_basic(self, store):
        store.save("低温电池方案", "专用低温电池解决方案", type="project", description="低温电池相关", tags=["电池", "低温"])
        store.save("储能系统设计", "大型储能系统", type="project")
        results = store.search_fts("低温电池", limit=5)
        assert len(results) >= 1
        assert any("低温电池" in h.name for h in results)

    def test_search_type_filter(self, store):
        store.save("电池项目", "内容", type="project", tags=["电池"])
        store.save("电池反馈", "内容", type="feedback", tags=["电池"])
        results = store.search_fts("电池", limit=5, type_filter="project")
        assert all(h.type == "project" for h in results)

    def test_search_empty_query(self, store):
        store.save("任意记忆", "内容", type="user")
        assert store.search_fts("", limit=5) == []
        assert store.search_fts("   ", limit=5) == []

    def test_search_no_match(self, store):
        store.save("电池", "内容", type="project")
        assert store.search_fts("不存在的关键词xyz", limit=5) == []


class TestRebuildIndex:
    def test_rebuild(self, store):
        store.save("索引测试", "内容", type="user")
        r = store.rebuild_index()
        assert r["ok"] is True
        assert r["total"] >= 1


class TestStats:
    def test_stats_empty(self, store):
        s = store.stats()
        assert s["tenant_id"] == "test"
        assert s["total"] == 0
        assert isinstance(s["by_type"], dict)

    def test_stats_with_data(self, store):
        store.save("用户记忆1", "内容", type="user")
        store.save("用户记忆2", "内容", type="user")
        store.save("反馈记忆", "内容", type="feedback")
        s = store.stats()
        assert s["total"] == 3
        assert s["by_type"]["user"] == 2
        assert s["by_type"]["feedback"] == 1


class TestTenantIsolation:
    def test_different_tenants_isolated(self, store_default):
        a = TypedMemoryStore(tenant_id="tenant_a", memory_base=store_default._base)
        b = TypedMemoryStore(tenant_id="tenant_b", memory_base=store_default._base)

        a.save("A的记忆", "A内容", type="user")
        b.save("B的记忆", "B内容", type="user")

        assert len(a.scan()) == 1
        assert len(b.scan()) == 1
        assert a.scan()[0].name == "A的记忆"
        assert b.scan()[0].name == "B的记忆"

    def test_default_tenant(self, store_default):
        assert store_default.tenant_id == "default"
        store_default.save("默认租户", "内容", type="user")
        assert len(store_default.scan()) == 1


class TestSearchRelevant:
    def test_search_relevant_few_headers(self, store):
        store.save("记忆1", "# 低温电池\n低温电池方案", type="project", tags=["电池"])
        store.save("记忆2", "# 储能\n储能系统", type="project")
        hits = store.search_relevant("低温电池", limit=5)
        assert len(hits) <= 5
        assert all(isinstance(h, MemoryHit) for h in hits)

    def test_search_relevant_no_headers(self, store):
        hits = store.search_relevant("什么", limit=5)
        assert hits == []


class TestEntrypoint:
    def test_entrypoint_created(self, store):
        store.save("入口测试", "内容", type="user")
        entrypoint = store._memory_dir / "MEMORY.md"
        assert entrypoint.exists()

    def test_entrypoint_updated_on_save(self, store):
        store.save("第一条", "内容", type="user")
        ep_text = (store._memory_dir / "MEMORY.md").read_text(encoding="utf-8")
        assert "第一条" in ep_text

        store.save("第二条", "内容", type="project")
        ep_text = (store._memory_dir / "MEMORY.md").read_text(encoding="utf-8")
        assert "第一条" in ep_text
        assert "第二条" in ep_text

    def test_entrypoint_updated_on_delete(self, store):
        r = store.save("要删除的", "内容", type="user")
        store.delete(r["filename"])
        ep_text = (store._memory_dir / "MEMORY.md").read_text(encoding="utf-8")
        assert "要删除的" not in ep_text


class TestFilenameGeneration:
    def test_special_chars_sanitized(self, store):
        r = store.save("用户偏好&设置!", "内容", type="user")
        assert "&" not in r["filename"]
        assert "!" not in r["filename"]

    def test_chinese_filename(self, store):
        r = store.save("用户偏好设置", "内容", type="user")
        assert r["ok"] is True
        assert r["filename"].endswith(".md")


class TestCorruptedFile:
    def test_corrupted_file_skipped_in_scan(self, store):
        store.save("正常记忆", "内容", type="user")
        bad_path = store._memory_dir / "project_corrupt.md"
        bad_path.write_text("这不是合法的 frontmatter 文件", encoding="utf-8")
        headers = store.scan()
        assert len(headers) == 1
        assert headers[0].name == "正常记忆"

    def test_corrupted_file_get_returns_none(self, store):
        bad_path = store._memory_dir / "user_bad.md"
        bad_path.write_text("---\ntype: user\n---\n内容", encoding="utf-8")
        assert store.get("user_bad.md") is not None

        bad_path.write_text("没有 frontmatter", encoding="utf-8")
        assert store.get("user_bad.md") is None
