"""
测试 MemoryStore 向量语义检索层。
"""
import tempfile
from contextlib import closing
from pathlib import Path


def test_save_run_stores_embedding():
    """save_run 后 embedding_json 不为空。"""
    with tempfile.TemporaryDirectory() as tmp:
        from src.memory_store import MemoryStore
        import sqlite3
        store = MemoryStore(db_path=Path(tmp) / "test.db")
        store.save_run("v001", "flow_opc", "低温锂电池储能", '{}', 4.0)
        with closing(sqlite3.connect(store.db_path)) as conn:
            row = conn.execute("SELECT embedding_json FROM runs_memory WHERE run_id='v001'").fetchone()
        assert row and row[0] is not None
        import json
        emb = json.loads(row[0])
        assert len(emb) == 128


def test_semantic_search_finds_similar():
    """语义检索能找到相似但不完全相同的词。"""
    with tempfile.TemporaryDirectory() as tmp:
        from src.memory_store import MemoryStore
        store = MemoryStore(db_path=Path(tmp) / "test.db")
        store.save_run("v001", "flow_opc", "低温锂电池储能系统方案", '{}', 4.5)
        store.save_run("v002", "flow_opc", "完全无关的汽车销售业务", '{}', 3.0)
        # 搜索相近但不完全相同的词
        hits = store.search_similar("锂电储能设计", use_semantic=True)
        run_ids = [h["run_id"] for h in hits]
        # v001 应该排在结果中
        assert "v001" in run_ids


def test_empty_db_semantic_search():
    """空库时语义检索不报错。"""
    with tempfile.TemporaryDirectory() as tmp:
        from src.memory_store import MemoryStore
        store = MemoryStore(db_path=Path(tmp) / "test.db")
        hits = store.search_similar("测试查询", use_semantic=True)
        assert hits == []


def test_migration_existing_db():
    """对已有 DB（无 embedding_json 列），初始化后自动 migrate 不报错。"""
    import sqlite3
    with tempfile.TemporaryDirectory() as tmp:
        db_path = Path(tmp) / "old.db"
        # 模拟旧 schema（不含 embedding_json）
        with closing(sqlite3.connect(db_path)) as conn:
            conn.execute("""CREATE TABLE runs_memory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT UNIQUE NOT NULL,
                flow_name TEXT, person_id TEXT,
                task_input TEXT, final_output TEXT,
                quality_score REAL, created_at TEXT
            )""")
            conn.commit()
        # 用新版 MemoryStore 初始化旧 DB，不应报错
        from src.memory_store import MemoryStore
        store = MemoryStore(db_path=db_path)
        store.save_run("new001", "flow_opc", "新记录", '{}', 4.0)
        assert store.count() == 1
