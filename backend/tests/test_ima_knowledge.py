"""tests/test_ima_knowledge.py — /api/court/ima-knowledge 真实上传/列表/归档。"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("FENGQUN_AUTH", "false")
    import src.ima_knowledge_store as store

    monkeypatch.setattr(store, "_DOCS_ROOT", tmp_path / "docs")
    monkeypatch.setattr(store, "_ACTIVE_DIR", tmp_path / "docs" / "ima_uploads")
    monkeypatch.setattr(store, "_ARCHIVED_DIR", tmp_path / "docs" / "ima_archived")
    monkeypatch.setattr(store, "_METADATA_DIR", tmp_path / "meta")
    monkeypatch.setattr(store, "_METADATA_FILE", tmp_path / "meta" / "documents.json")

    from web.main import app

    return TestClient(app)


def test_upload_then_list(client):
    r = client.post(
        "/api/court/ima-knowledge",
        json={
            "filename": "补证-合同摘要.md",
            "content": "这是一份关于合同风险的补证材料。" * 3,
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    doc = body["data"]["document"]
    assert doc["id"] == "补证-合同摘要.md"
    assert doc["status"] == "active"
    assert doc["contentChars"] > 0
    assert doc["contentExcerpt"]

    r2 = client.get("/api/court/ima-knowledge?limit=20")
    docs = r2.json()["data"]["documents"]
    assert len(docs) == 1
    assert docs[0]["id"] == doc["id"]


def test_upload_rejects_empty_fields(client):
    r = client.post("/api/court/ima-knowledge", json={"filename": "", "content": "x"})
    assert r.json()["success"] is False


def test_archive_then_reactivate(client):
    client.post(
        "/api/court/ima-knowledge", json={"filename": "note.txt", "content": "备注内容"}
    )

    r = client.patch(
        "/api/court/ima-knowledge", json={"id": "note.txt", "status": "archived"}
    )
    assert r.json()["data"]["document"]["status"] == "archived"

    listed = client.get("/api/court/ima-knowledge").json()["data"]["documents"]
    assert listed[0]["status"] == "archived"

    r2 = client.patch(
        "/api/court/ima-knowledge", json={"id": "note.txt", "status": "active"}
    )
    assert r2.json()["data"]["document"]["status"] == "active"


def test_archive_moves_file_out_of_active_dir(client, tmp_path):
    client.post(
        "/api/court/ima-knowledge",
        json={"filename": "evidence.md", "content": "证据文本"},
    )
    active_dir = tmp_path / "docs" / "ima_uploads"
    archived_dir = tmp_path / "docs" / "ima_archived"
    assert (active_dir / "evidence.md").exists()

    client.patch(
        "/api/court/ima-knowledge", json={"id": "evidence.md", "status": "archived"}
    )
    assert not (active_dir / "evidence.md").exists()
    assert (archived_dir / "evidence.md").exists()


def test_set_status_unknown_id_fails(client):
    r = client.patch(
        "/api/court/ima-knowledge", json={"id": "nope.md", "status": "archived"}
    )
    assert r.json()["success"] is False


def test_reupload_same_filename_preserves_created_at_updates_content(client):
    r1 = client.post(
        "/api/court/ima-knowledge", json={"filename": "dup.md", "content": "第一版"}
    )
    created_at = r1.json()["data"]["document"]["createdAt"]

    r2 = client.post(
        "/api/court/ima-knowledge",
        json={"filename": "dup.md", "content": "第二版内容更长一些"},
    )
    doc2 = r2.json()["data"]["document"]
    assert doc2["createdAt"] == created_at
    assert doc2["contentExcerpt"].startswith("第二版")

    docs = client.get("/api/court/ima-knowledge").json()["data"]["documents"]
    assert len(docs) == 1  # 同名覆盖，不重复
