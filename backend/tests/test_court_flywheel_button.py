"""K0C runtime tripwire for the legacy court flywheel writer."""
from __future__ import annotations

import importlib
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

app = importlib.import_module("web.main").app
client = TestClient(app)


def test_shiguan_doc_builder_no_longer_advertises_legacy_flywheel_write():
    from src import court_doc_builder

    assert "feed_flywheel" not in court_doc_builder.DEPT_REGISTRY["shiguan"]["actions"]


def test_scribe_archive_docs_no_longer_advertise_legacy_flywheel_write(
    isolated_session_local,
):
    import json

    from src.db.models import ShiguanArchive
    from web.routers import scribe

    db = isolated_session_local()
    db.add(
        ShiguanArchive(
            id="archive_task-1",
            task_id="task-1",
            raw_question="原始问题",
            refined_edict="已归档奏折",
            final_memorial_json=json.dumps(
                {"title": "已归档奏折", "summary": "必须保留证据"},
                ensure_ascii=False,
            ),
            emperor_decision_json='{"action":"adopt"}',
            evidence_chain_json="[]",
            source_label="LIVE_SWARM",
            synthetic_flag=False,
            created_at="2026-07-15T08:00:00+00:00",
        )
    )
    db.commit()
    db.close()

    response = scribe.scribe_archive_docs(None)

    assert "feed_flywheel" not in response["data"]["docs"][0]["actions"]


def test_feed_flywheel_cannot_write_outside_canonical_archive_outcome_flow():
    doc = {"doc_id": "fw-1", "dept": "xingbu", "headline": "可签,但先改2处",
           "actions": ["feed_flywheel"], "workflow": {"state": "待审"}}

    mock_rag = MagicMock()
    with patch("src.knowledge_rag.get_rag", return_value=mock_rag):
        r = client.post("/api/court/action", json={"doc": doc, "action": "feed_flywheel"})

    assert r.status_code == 409
    body = r.json()
    assert body["success"] is False
    assert body["data"] == {
        "code": "LEGACY_WRITE_BLOCKED",
        "entryId": "legacy-court-flywheel-writers",
        "canonicalTarget": "canonical-archive-outcome-knowledge-promotion",
    }
    mock_rag.add_texts.assert_not_called()


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
