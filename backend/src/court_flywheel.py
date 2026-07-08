"""朝会真实数据飞轮 — 把每日朝会产出回流知识库,形成 grounding 飞轮。

主动脉飞轮(⑤):每日朝会跑完(见 scripts/daily_court_session.py)后,
把《今日朝报》+ 各部奏折要点用 src.knowledge_rag.get_rag().add_texts() 写回知识库,
统一打 knowledge_domain="朝会沉淀",供未来朝会/蜂群 pre_retrieve(scope=["朝会沉淀"]) grounding。

设计纪律:
- 不硬塞进 daily_court_session 主流程,避免 runner 依赖 RAG/embedding 端点。
  做成可独立调用的纯函数 + 在 runner 里可选(--archive)调用。
- 飞轮失败绝不拖垮朝会:RAG 任意异常都被吞掉,返回结构化失败统计。
- error 状态/空摘要的奏折不入库(脏数据不进飞轮)。

用法(代码):
    from src.court_flywheel import archive_session_to_knowledge
    result = archive_session_to_knowledge(memorials, report_text, "2026-06-22")
    # result -> {"ok": True, "items": 3, "chunks": 5, "domain": "朝会沉淀", "error": ""}
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

# 朝会沉淀统一知识域(供 pre_retrieve(scope=[...]) 过滤)
COURT_KNOWLEDGE_DOMAIN = "朝会沉淀"

# error 等不可信状态不回流飞轮(脏数据不入库)
_DIRTY_STATUSES = {"error"}


def _build_items(
    memorials: list[dict],
    report_text: str,
    stamp: str,
) -> list[tuple[str, str, dict]]:
    """组装写回知识库的 (text, source, extra_metadata) 列表。

    - 朝报:整篇作为 1 条(分块由 add_texts 内部处理)。
    - 各部奏折:status 干净且摘要非空的,逐部作为 1 条。

    所有条目统一打 knowledge_domain="朝会沉淀" 与 stamp,便于 scope 检索与按日清理。
    """
    items: list[tuple[str, str, dict]] = []

    report_text = (report_text or "").strip()
    if report_text:
        items.append(
            (
                report_text,
                f"朝会沉淀:朝报-{stamp}",
                {
                    "knowledge_domain": COURT_KNOWLEDGE_DOMAIN,
                    "stamp": stamp,
                    "kind": "report",
                },
            )
        )

    for m in memorials or []:
        status = str(m.get("status", "")).lower()
        summary = str(m.get("summary", "")).strip()
        if status in _DIRTY_STATUSES or not summary:
            continue
        swarm = m.get("swarm", "unknown")
        dept = m.get("dept", swarm)
        text = f"【{dept}·{stamp}】{summary}"
        items.append(
            (
                text,
                f"朝会沉淀:{swarm}-{stamp}",
                {
                    "knowledge_domain": COURT_KNOWLEDGE_DOMAIN,
                    "stamp": stamp,
                    "kind": "memorial",
                    "swarm": swarm,
                    "dept": dept,
                    "status": status,
                },
            )
        )

    return items


def archive_session_to_knowledge(
    memorials: list[dict],
    report_text: str,
    stamp: str,
) -> dict:
    """把当日朝会产出(朝报 + 各部奏折要点)回流知识库 domain="朝会沉淀"。

    Args:
        memorials: 各部上奏结果,每项形如
            {"swarm": "finance", "dept": "户部", "status": "ok", "summary": "..."}
            (即 daily_court_session.run_court_session() 的返回结构)
        report_text: 《今日朝报》全文 markdown(write_court_report 产出)
        stamp: 日期戳(如 "2026-06-22"),写入 metadata 便于检索与按日清理

    Returns:
        结构化统计,飞轮失败不抛异常:
            {"ok": bool, "items": int, "chunks": int,
             "domain": "朝会沉淀", "error": str}
        - items:实际尝试入库的 source 条数(朝报 + 干净奏折)
        - chunks:add_texts 实际入库块数(分块后)
        - ok=False 时 error 带原因,chunks=0
    """
    base = {
        "ok": True,
        "items": 0,
        "chunks": 0,
        "domain": COURT_KNOWLEDGE_DOMAIN,
        "error": "",
    }

    items = _build_items(memorials, report_text, stamp)
    base["items"] = len(items)
    if not items:
        logger.info("飞轮:无可回流内容(朝报空且无干净奏折),跳过 stamp=%s", stamp)
        return base

    try:
        from src.knowledge_rag import get_rag

        rag = get_rag()
        chunks = rag.add_texts(items)
        base["chunks"] = int(chunks or 0)
        logger.info(
            "飞轮回流完成:%d 条 source → %d 块入库 domain=%s stamp=%s",
            base["items"],
            base["chunks"],
            COURT_KNOWLEDGE_DOMAIN,
            stamp,
        )
    except Exception as e:  # 飞轮失败绝不拖垮朝会
        base["ok"] = False
        base["chunks"] = 0
        base["error"] = str(e)
        logger.warning("飞轮回流失败(不影响朝会主流程):%s", e)

    return base
