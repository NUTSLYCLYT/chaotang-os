"""
Hermes 风格记忆存储 — SQLite + FTS5 双层架构
对应 Hermes 的 state.db，存储所有 run 历史并支持全文检索
"""
from __future__ import annotations

import hashlib as _hashlib
import json
import logging
import sqlite3
from contextlib import closing
from pathlib import Path
from typing import Optional

from src.runtime_paths import resolve_runtime_paths

logger = logging.getLogger(__name__)


def _local_embed(text: str, dim: int = 128) -> list[float]:
    """字符 bigram+trigram 哈希向量，L2 归一化。纯标准库，离线可用。

    dim=128 对 SQLite 存储友好（vs knowledge_rag.py 的 dim=512）。
    """
    vec = [0.0] * dim
    for n in (2, 3):
        for i in range(max(0, len(text) - n + 1)):
            gram = text[i: i + n]
            h = int(_hashlib.md5(gram.encode("utf-8", errors="replace")).hexdigest(), 16)
            vec[h % dim] += 1.0
    norm = sum(x * x for x in vec) ** 0.5
    if norm > 0:
        vec = [x / norm for x in vec]
    return vec


def _cosine_sim(a: list[float], b: list[float]) -> float:
    """计算两个向量的余弦相似度（已 L2 归一化的向量可直接用点积）。"""
    return sum(x * y for x, y in zip(a, b, strict=False))

# DB 路径：memory/state.db
MEMORY_DIR = resolve_runtime_paths().memory
DB_PATH = MEMORY_DIR / "state.db"

CREATE_SCHEMA = """
CREATE TABLE IF NOT EXISTS runs_memory (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id        TEXT UNIQUE NOT NULL,
    flow_name     TEXT,
    person_id     TEXT,
    task_input    TEXT,
    final_output  TEXT,
    quality_score REAL,
    created_at    TEXT,
    embedding_json TEXT
);

-- FTS5 虚拟表（trigram tokenizer，支持中英文子串检索，需 SQLite 3.34+）
-- 降级：如果 trigram 不可用，建表失败时 search_similar 会退回 LIKE 查询
CREATE VIRTUAL TABLE IF NOT EXISTS runs_fts USING fts5(
    task_input,
    final_output,
    content=runs_memory,
    content_rowid=id,
    tokenize='trigram'
);

-- 触发器：保持 FTS 索引与主表同步
CREATE TRIGGER IF NOT EXISTS runs_fts_insert AFTER INSERT ON runs_memory BEGIN
    INSERT INTO runs_fts(rowid, task_input, final_output)
    VALUES (new.id, new.task_input, new.final_output);
END;
CREATE TRIGGER IF NOT EXISTS runs_fts_delete AFTER DELETE ON runs_memory BEGIN
    INSERT INTO runs_fts(runs_fts, rowid, task_input, final_output)
    VALUES ('delete', old.id, old.task_input, old.final_output);
END;
CREATE TRIGGER IF NOT EXISTS runs_fts_update AFTER UPDATE ON runs_memory BEGIN
    INSERT INTO runs_fts(runs_fts, rowid, task_input, final_output)
    VALUES ('delete', old.id, old.task_input, old.final_output);
    INSERT INTO runs_fts(rowid, task_input, final_output)
    VALUES (new.id, new.task_input, new.final_output);
END;
"""


class MemoryStore:
    """SQLite + FTS5 记忆存储，支持全文检索历史 run。"""

    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = db_path
        # 确保目录存在（使用 db_path 的父目录）
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _init_db(self) -> None:
        with closing(sqlite3.connect(self.db_path)) as conn:
            conn.executescript(CREATE_SCHEMA)
            # 兼容已存在的数据库：如果 embedding_json 列不存在则添加
            try:
                conn.execute("ALTER TABLE runs_memory ADD COLUMN embedding_json TEXT")
            except sqlite3.OperationalError:
                pass  # 列已存在，忽略
            conn.commit()

    def save_run(
        self,
        run_id: str,
        flow_name: str,
        task_input: str,
        final_output: str,
        quality_score: float,
        person_id: Optional[str] = None,
        created_at: str = "",
    ) -> None:
        """保存一次 run 到记忆存储（幂等，已存在时忽略）。"""
        if not created_at:
            from datetime import datetime
            created_at = datetime.now().astimezone().isoformat()

        emb = _local_embed((task_input or "") + " " + (flow_name or ""))
        emb_json = json.dumps(emb)

        sql = """
        INSERT OR IGNORE INTO runs_memory
            (run_id, flow_name, person_id, task_input, final_output, quality_score, created_at, embedding_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """
        try:
            with closing(sqlite3.connect(self.db_path)) as conn:
                conn.execute(sql, (
                    run_id, flow_name, person_id,
                    task_input or "", final_output or "",
                    quality_score, created_at, emb_json,
                ))
                conn.commit()
        except Exception as e:
            logger.warning("MemoryStore.save_run 失败: %s", e)

    def search_similar(
        self,
        query: str,
        person_id: Optional[str] = None,
        limit: int = 3,
        use_semantic: bool = True,
    ) -> list[dict]:
        """
        检索相关历史 run。
        优先用 FTS5 trigram（精确子串匹配 + rank 排序），
        回退到 LIKE 模糊查询（当 trigram 无 3 字以上片段时）。
        use_semantic=True 时额外做向量语义检索并合并结果。
        返回：[{"run_id":…, "task_input":…, "final_output":…, "quality_score":…, "rank":…}]
        空 query 直接返回 []。
        """
        if not query or not query.strip():
            return []

        results: list[dict] = []

        # 路径1: FTS5/LIKE（精确子串）
        fts_query = _build_fts_trigram_query(query)
        if fts_query:
            fts_hits = self._search_fts(fts_query, person_id, limit)
            if fts_hits:
                results.extend(fts_hits)
        if not results:
            results.extend(self._search_like(query, person_id, limit))

        # 路径2: 向量语义检索（与 FTS 结果合并去重）
        if use_semantic and self.count() > 0:
            sem_hits = self._search_embedding(query, person_id, limit)
            seen_ids = {r["run_id"] for r in results}
            for h in sem_hits:
                if h["run_id"] not in seen_ids:
                    results.append(h)
                    seen_ids.add(h["run_id"])

        # FTS 结果优先（前面），向量结果追加在后，截取 limit 条
        return results[:limit]

    def _search_fts(
        self, fts_query: str, person_id: Optional[str], limit: int
    ) -> list[dict] | None:
        """用 FTS5 MATCH 查询，失败或无结果时返回 None（触发回退）。"""
        if person_id:
            sql = """
            SELECT m.run_id, m.task_input, m.final_output, m.quality_score,
                   m.person_id, fts.rank
            FROM runs_fts fts
            JOIN runs_memory m ON m.id = fts.rowid
            WHERE runs_fts MATCH ?
              AND m.person_id = ?
            ORDER BY fts.rank
            LIMIT ?
            """
            params: tuple = (fts_query, person_id, limit)
        else:
            sql = """
            SELECT m.run_id, m.task_input, m.final_output, m.quality_score,
                   m.person_id, fts.rank
            FROM runs_fts fts
            JOIN runs_memory m ON m.id = fts.rowid
            WHERE runs_fts MATCH ?
            ORDER BY fts.rank
            LIMIT ?
            """
            params = (fts_query, limit)

        try:
            with closing(sqlite3.connect(self.db_path)) as conn:
                conn.row_factory = sqlite3.Row
                rows = conn.execute(sql, params).fetchall()
                if not rows:
                    return None  # 触发 LIKE 回退
                return [
                    {
                        "run_id": row["run_id"],
                        "task_input": row["task_input"],
                        "final_output": row["final_output"],
                        "quality_score": row["quality_score"],
                        "person_id": row["person_id"] if "person_id" in row.keys() else None,
                        "rank": row["rank"],
                    }
                    for row in rows
                ]
        except Exception as e:
            logger.debug("FTS5 查询失败，回退到 LIKE: %s", e)
            return None  # 触发 LIKE 回退

    def _search_like(
        self, query: str, person_id: Optional[str], limit: int
    ) -> list[dict]:
        """LIKE 模糊查询回退（不支持 rank，按时间倒序）。"""
        # 提取有效关键词（非标点字符，长度 >= 2）
        import re
        tokens = re.findall(r'[\w\u4e00-\u9fff]{2,}', query)
        if not tokens:
            return []

        # 用第一个有效词做 LIKE 查询（避免太多 OR 降低性能）
        like_pat = f"%{tokens[0]}%"
        if person_id:
            sql = """
            SELECT run_id, task_input, final_output, quality_score,
                   person_id, 0 as rank
            FROM runs_memory
            WHERE (task_input LIKE ? OR final_output LIKE ?)
              AND person_id = ?
            ORDER BY created_at DESC
            LIMIT ?
            """
            params: tuple = (like_pat, like_pat, person_id, limit)
        else:
            sql = """
            SELECT run_id, task_input, final_output, quality_score,
                   person_id, 0 as rank
            FROM runs_memory
            WHERE task_input LIKE ? OR final_output LIKE ?
            ORDER BY created_at DESC
            LIMIT ?
            """
            params = (like_pat, like_pat, limit)

        try:
            with closing(sqlite3.connect(self.db_path)) as conn:
                conn.row_factory = sqlite3.Row
                rows = conn.execute(sql, params).fetchall()
                return [
                    {
                        "run_id": row["run_id"],
                        "task_input": row["task_input"],
                        "final_output": row["final_output"],
                        "quality_score": row["quality_score"],
                        "person_id": row["person_id"],
                        "rank": row["rank"],
                    }
                    for row in rows
                ]
        except Exception as e:
            logger.warning("MemoryStore._search_like 失败: %s", e)
            return []

    def _search_embedding(
        self, query: str, person_id: Optional[str], limit: int, threshold: float = 0.05
    ) -> list[dict]:
        """向量相似度检索（余弦相似度，纯 Python 计算）。

        threshold: 最低相似度阈值，低于此值的结果丢弃。
        bigram+trigram 稀疏哈希向量的典型相似度范围在 0.05~0.5，
        0.05 可过滤完全无关内容同时保留语义相近结果。
        返回格式与 _search_fts 相同（含 similarity 字段作为 rank）。
        """
        q_emb = _local_embed(query)

        if person_id:
            sql = """
            SELECT run_id, task_input, final_output, quality_score,
                   person_id, embedding_json
            FROM runs_memory
            WHERE embedding_json IS NOT NULL
              AND person_id = ?
            """
            params: tuple = (person_id,)
        else:
            sql = """
            SELECT run_id, task_input, final_output, quality_score,
                   person_id, embedding_json
            FROM runs_memory
            WHERE embedding_json IS NOT NULL
            """
            params = ()

        try:
            with closing(sqlite3.connect(self.db_path)) as conn:
                conn.row_factory = sqlite3.Row
                rows = conn.execute(sql, params).fetchall()

            scored: list[tuple[float, dict]] = []
            for row in rows:
                try:
                    row_emb = json.loads(row["embedding_json"])
                    sim = _cosine_sim(q_emb, row_emb)
                    if sim >= threshold:
                        scored.append((sim, {
                            "run_id": row["run_id"],
                            "task_input": row["task_input"],
                            "final_output": row["final_output"],
                            "quality_score": row["quality_score"],
                            "person_id": row["person_id"],
                            "rank": sim,
                        }))
                except Exception:
                    continue

            scored.sort(key=lambda x: x[0], reverse=True)
            return [item for _, item in scored[:limit]]
        except Exception as e:
            logger.warning("MemoryStore._search_embedding 失败: %s", e)
            return []

    def get_recent(
        self,
        person_id: Optional[str] = None,
        limit: int = 5,
    ) -> list[dict]:
        """获取最近的几条 run（按时间倒序）。"""
        if person_id:
            sql = """
            SELECT run_id, flow_name, person_id, task_input, final_output,
                   quality_score, created_at
            FROM runs_memory
            WHERE person_id = ?
            ORDER BY created_at DESC
            LIMIT ?
            """
            params = (person_id, limit)
        else:
            sql = """
            SELECT run_id, flow_name, person_id, task_input, final_output,
                   quality_score, created_at
            FROM runs_memory
            ORDER BY created_at DESC
            LIMIT ?
            """
            params = (limit,)

        try:
            with closing(sqlite3.connect(self.db_path)) as conn:
                conn.row_factory = sqlite3.Row
                rows = conn.execute(sql, params).fetchall()
                return [dict(row) for row in rows]
        except Exception as e:
            logger.warning("MemoryStore.get_recent 失败: %s", e)
            return []

    def count(self) -> int:
        """返回总记录数。"""
        try:
            with closing(sqlite3.connect(self.db_path)) as conn:
                row = conn.execute("SELECT COUNT(*) FROM runs_memory").fetchone()
                return row[0] if row else 0
        except Exception as e:
            logger.warning("MemoryStore.count 失败: %s", e)
            return 0


def _build_fts_trigram_query(query: str) -> str:
    """
    为 FTS5 trigram tokenizer 构建 MATCH 查询字符串。
    trigram 要求每个 token/phrase 至少 3 个字符。
    策略：提取长度 >= 3 的连续词段，用 OR 连接。
    如果没有任何 >=3 字符的片段，返回空字符串（触发 LIKE 回退）。
    """
    import re
    # 提取连续的字母/数字/中文字符段
    tokens = re.findall(r'[\w\u4e00-\u9fff]+', query)
    # 过滤长度 < 3 的 token，trigram 需要 >= 3 字符
    valid = [t for t in tokens if len(t) >= 3]
    if not valid:
        return ""
    # 用引号包裹（phrase query），避免 FTS5 语法冲突
    escaped = " OR ".join(f'"{t}"' for t in valid)
    return escaped
