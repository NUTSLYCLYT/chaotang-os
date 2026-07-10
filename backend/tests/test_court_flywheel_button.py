"""tests/test_court_flywheel_button.py — 史馆"喂飞轮"按钮真的写知识库了(专署能力核查挖出的洞)。

修前:POST /api/court/action action=feed_flywheel 只走状态机(to_state=None),dispatch 校验完
直接返回 ok——用户点了看到"成功",但从没真的调用 court_flywheel.archive_session_to_knowledge。
一个主动撒谎的"成功"响应,比"没做"更危险。
"""
from __future__ import annotations

import importlib
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

app = importlib.import_module("web.main").app
client = TestClient(app)


def test_feed_flywheel_actually_writes_knowledge_base():
    doc = {"doc_id": "fw-1", "dept": "xingbu", "headline": "可签,但先改2处",
           "actions": ["feed_flywheel"], "workflow": {"state": "待审"}}

    mock_rag = MagicMock()
    mock_rag.add_texts.return_value = 1

    with patch("src.knowledge_rag.get_rag", return_value=mock_rag):
        r = client.post("/api/court/action", json={"doc": doc, "action": "feed_flywheel"})

    assert r.status_code == 200
    body = r.json()["data"]
    assert body["status"] == "ok"
    # 真的调过 add_texts,不是空响应
    mock_rag.add_texts.assert_called_once()
    assert body["flywheel"]["ok"] is True
    assert body["flywheel"]["chunks"] == 1
    assert body["flywheel"]["items"] == 1   # 这份文书本身,真的被写入了


def test_feed_flywheel_empty_headline_honestly_reports_zero_items():
    """headline 空 → _build_items 会跳过(不算干净奏折),不能假装"已存证"。"""
    doc = {"doc_id": "fw-2", "dept": "hubu", "headline": "",
           "actions": ["feed_flywheel"], "workflow": {"state": "待审"}}

    mock_rag = MagicMock()
    with patch("src.knowledge_rag.get_rag", return_value=mock_rag):
        r = client.post("/api/court/action", json={"doc": doc, "action": "feed_flywheel"})

    body = r.json()["data"]
    assert body["flywheel"]["items"] == 0
    mock_rag.add_texts.assert_not_called()   # 没内容,压根不该写


def test_feed_flywheel_rag_failure_does_not_break_the_button():
    """飞轮本身"失败不抛异常"——RAG 挂了,按钮响应仍是 ok,但诚实带上 error。"""
    doc = {"doc_id": "fw-3", "dept": "xingbu", "headline": "有内容可存",
           "actions": ["feed_flywheel"], "workflow": {"state": "待审"}}

    with patch("src.knowledge_rag.get_rag", side_effect=RuntimeError("chromadb 未安装")):
        r = client.post("/api/court/action", json={"doc": doc, "action": "feed_flywheel"})

    assert r.status_code == 200
    body = r.json()["data"]
    assert body["status"] == "ok"          # 按钮动作本身没被 RAG 故障拖垮
    assert body["flywheel"]["ok"] is False
    assert "chromadb" in body["flywheel"]["error"]


def test_other_actions_do_not_trigger_flywheel_write():
    """只有 feed_flywheel 才写知识库,别的动作不该顺带触发。"""
    doc = {"doc_id": "fw-4", "dept": "xingbu", "headline": "x",
           "actions": ["apply_fixes"], "workflow": {"state": "待审"}}

    mock_rag = MagicMock()
    with patch("src.knowledge_rag.get_rag", return_value=mock_rag):
        r = client.post("/api/court/action", json={"doc": doc, "action": "apply_fixes"})

    body = r.json()["data"]
    assert "flywheel" not in body
    mock_rag.add_texts.assert_not_called()
