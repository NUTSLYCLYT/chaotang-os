"""K0C runtime tripwires for legacy knowledge API writers."""
from __future__ import annotations

import importlib
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient


app = importlib.import_module("web.main").app
client = TestClient(app)


def test_legacy_knowledge_index_cannot_rebuild_rag_directly():
    mock_rag = MagicMock()
    mock_rag.add_directory.return_value = {"indexed": 1}

    with patch("src.knowledge_rag.get_rag", return_value=mock_rag):
        response = client.post("/api/knowledge/index")

    assert response.status_code == 409
    assert response.json() == {
        "success": False,
        "data": {
            "code": "LEGACY_WRITE_BLOCKED",
            "entryId": "legacy-knowledge-api-writers",
            "canonicalTarget": "canonical-archive-outcome-knowledge-promotion",
        },
        "error": "旧知识索引入口已封禁；索引只能消费 canonical promotion 产物",
    }
    mock_rag.add_directory.assert_not_called()


def test_legacy_knowledge_upload_cannot_write_file_or_index():
    mock_rag = MagicMock()

    with patch("src.knowledge_rag.get_rag", return_value=mock_rag):
        response = client.post(
            "/api/knowledge/upload",
            json={"filename": "contract.md", "content": "未经裁决的合同内容"},
        )

    assert response.status_code == 409
    assert response.json() == {
        "success": False,
        "data": {
            "code": "LEGACY_WRITE_BLOCKED",
            "entryId": "legacy-knowledge-api-writers",
            "canonicalTarget": "canonical-archive-outcome-knowledge-promotion",
        },
        "error": "旧知识上传入口已封禁；内容必须经 canonical archive/outcome promotion 晋升",
    }
    mock_rag.add_directory.assert_not_called()


def test_legacy_knowledge_writers_openapi_only_advertises_blocked_status():
    paths = app.openapi()["paths"]
    upload_responses = paths["/api/knowledge/upload"]["post"]["responses"]
    index_responses = paths["/api/knowledge/index"]["post"]["responses"]

    assert "409" in upload_responses
    assert "201" not in upload_responses
    assert "409" in index_responses
    assert "200" not in index_responses
