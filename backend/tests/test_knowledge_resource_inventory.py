from __future__ import annotations

import hashlib
import json
import sqlite3
import sys
from argparse import Namespace
from pathlib import Path
from types import SimpleNamespace

import pytest

import scripts.knowledge_resource_inventory as inventory
from scripts.knowledge_resource_inventory import (
    InventoryError,
    build_manifest,
    inventory_file_tree,
    inventory_qdrant,
    inventory_sqlite,
)


def test_archive_source_is_opt_in_and_never_defaults_to_repo_subtree(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("COURTOS_BRAIN_ARCHIVE_PATH", raising=False)

    args = inventory._parse_args([])

    assert args.archive is None


def test_archive_source_can_be_configured_outside_repo(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    archive = tmp_path / "independent-courtos-brain"
    monkeypatch.setenv("COURTOS_BRAIN_ARCHIVE_PATH", str(archive))

    args = inventory._parse_args([])

    assert args.archive == archive


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def test_file_inventory_is_deterministic_and_never_emits_paths_or_content(tmp_path: Path) -> None:
    vault = tmp_path / "Customer Alpha Vault"
    vault.mkdir()
    (vault / "contract-secret.md").write_text("API_TOKEN=super-secret-value", encoding="utf-8")
    (vault / "notes.txt").write_text("customer private note", encoding="utf-8")

    first = inventory_file_tree("live_vault", vault, default_disposition="quarantine")
    second = inventory_file_tree("live_vault", vault, default_disposition="quarantine")

    assert first["status"] == "STABLE"
    assert first["snapshot_token"] == second["snapshot_token"]
    assert first["counts"] == {
        "files": 2,
        "bytes": sum(path.stat().st_size for path in vault.iterdir()),
    }
    assert first["metadata"]["extensions"] == {".md": 1, ".txt": 1}
    assert first["disposition"] == {"accepted": 0, "quarantined": 2, "rejected": 0}
    serialized = json.dumps(first, ensure_ascii=False)
    assert str(tmp_path) not in serialized
    assert "Customer Alpha" not in serialized
    assert "contract-secret.md" not in serialized
    assert "super-secret-value" not in serialized
    assert "customer private note" not in serialized


def test_missing_required_file_source_is_unavailable_and_blocks_freeze(tmp_path: Path) -> None:
    source = inventory_file_tree("required", tmp_path / "missing", default_disposition="quarantine")
    manifest = build_manifest([source], observed_at="2026-07-14T10:00:00Z", producer={"id": "test"})

    assert source["status"] == "UNAVAILABLE"
    assert source["freeze_eligible"] is False
    assert manifest["summary"]["unavailable"] == 1
    assert manifest["summary"]["freeze_eligible"] is False


def test_file_inventory_can_scope_statutes_without_counting_other_personas(tmp_path: Path) -> None:
    root = tmp_path / "personas"
    statute = root / "civil-lawyer" / "references" / "statutes.md"
    statute.parent.mkdir(parents=True)
    statute.write_text("civil statute", encoding="utf-8")
    unrelated = root / "karpathy" / "SKILL.md"
    unrelated.parent.mkdir(parents=True)
    unrelated.write_text("persona instructions", encoding="utf-8")

    result = inventory_file_tree(
        "legal_statutes",
        root,
        default_disposition="quarantine",
        include_globs=("*-lawyer/references/statutes.md",),
    )

    assert result["counts"] == {"files": 1, "bytes": len("civil statute")}
    assert result["metadata"]["extensions"] == {".md": 1}
    assert result["metadata"]["filter_id"].startswith("sha256:")
    assert "persona instructions" not in json.dumps(result)


def test_file_inventory_marks_scan_boundary_change_unstable(tmp_path: Path) -> None:
    vault = tmp_path / "vault"
    vault.mkdir()
    note = vault / "note.md"
    note.write_text("version one", encoding="utf-8")

    def mutate_after_read(path: Path) -> bytes:
        data = path.read_bytes()
        path.write_text("version two is longer", encoding="utf-8")
        return data

    result = inventory_file_tree(
        "live_vault",
        vault,
        default_disposition="quarantine",
        read_bytes=mutate_after_read,
    )

    assert result["status"] == "UNSTABLE_SOURCE"
    assert result["snapshot_token"] is None
    assert result["freeze_eligible"] is False


def test_file_inventory_rejects_symlink_without_following_it(tmp_path: Path) -> None:
    outside = tmp_path / "outside-secret.txt"
    outside.write_text("do not read me", encoding="utf-8")
    vault = tmp_path / "vault"
    vault.mkdir()
    (vault / "linked.md").symlink_to(outside)

    result = inventory_file_tree("live_vault", vault, default_disposition="quarantine")

    assert result["status"] == "STABLE"
    assert result["counts"] == {"files": 0, "bytes": 0}
    assert result["disposition"] == {"accepted": 0, "quarantined": 0, "rejected": 1}
    assert "outside-secret" not in json.dumps(result)


def test_sqlite_inventory_uses_read_only_metadata_and_preserves_database_hash(tmp_path: Path) -> None:
    database = tmp_path / "brain.db"
    connection = sqlite3.connect(database)
    connection.execute("CREATE TABLE messages(id INTEGER PRIMARY KEY, content TEXT)")
    connection.execute("INSERT INTO messages(content) VALUES (?)", ("private conversation",))
    connection.commit()
    connection.close()
    before = _sha256(database)

    result = inventory_sqlite("legacy_brain_db", database, default_disposition="quarantine")

    assert result["status"] == "STABLE"
    assert result["metadata"]["tables"] == {"messages": 1}
    assert result["disposition"] == {"accepted": 0, "quarantined": 1, "rejected": 0}
    assert _sha256(database) == before
    assert "private conversation" not in json.dumps(result)


def test_optional_missing_sqlite_is_frozen_as_absent_not_unavailable(tmp_path: Path) -> None:
    result = inventory_sqlite(
        "current_rag_db",
        tmp_path / "missing.db",
        default_disposition="quarantine",
        allow_absent=True,
    )

    assert result["status"] == "ABSENT"
    assert result["freeze_eligible"] is True
    assert result["snapshot_token"].startswith("sha256:")
    manifest = build_manifest([result], observed_at="2026-07-14T10:00:00Z")
    assert manifest["summary"]["absent"] == 1
    assert manifest["summary"]["unavailable"] == 0
    assert manifest["summary"]["freeze_eligible"] is True


def test_qdrant_inventory_uses_only_read_operations_and_quarantines_unknown_points() -> None:
    calls: list[tuple[str, str]] = []

    def request(method: str, path: str, payload: dict | None = None) -> dict:
        calls.append((method, path))
        if path == "/collections":
            return {"result": {"collections": [{"name": "court_brain"}]}}
        if path == "/collections/court_brain":
            return {
                "result": {
                    "status": "green",
                    "points_count": 2,
                    "config": {"params": {"vectors": {"size": 768, "distance": "Cosine"}}},
                }
            }
        if path == "/collections/court_brain/points/scroll":
            return {
                "result": {
                    "points": [
                        {"id": 1, "payload": {"source": "vault", "version": "v1", "owner": "u1", "license": "private"}},
                        {"id": 2, "payload": {"source": "vault"}},
                    ],
                    "next_page_offset": None,
                }
            }
        raise AssertionError(path)

    result = inventory_qdrant("legacy_qdrant", request=request)

    assert result["status"] == "STABLE"
    assert result["counts"] == {"collections": 1, "points": 2}
    assert result["metadata"]["payload_key_presence"] == {
        "license": 1,
        "owner": 1,
        "source": 2,
        "version": 1,
    }
    assert result["disposition"] == {"accepted": 0, "quarantined": 2, "rejected": 0}
    assert calls == [
        ("GET", "/collections"),
        ("GET", "/collections/court_brain"),
        ("POST", "/collections/court_brain/points/scroll"),
        ("GET", "/collections/court_brain"),
    ]
    assert all(method == "GET" or path.endswith("/points/scroll") for method, path in calls)


def test_qdrant_inventory_rejects_non_read_transport() -> None:
    def request(method: str, path: str, payload: dict | None = None) -> dict:
        raise InventoryError("write method blocked")

    with pytest.raises(InventoryError, match="write method blocked"):
        inventory_qdrant("legacy_qdrant", request=request)


def test_http_transport_blocks_write_method_before_network() -> None:
    request = inventory._http_requester("http://127.0.0.1:6333")

    with pytest.raises(InventoryError, match="write method blocked"):
        request("DELETE", "/collections/court_brain", None)


def test_stable_tree_copy_preserves_source_and_returns_snapshot(tmp_path: Path) -> None:
    source = tmp_path / "source"
    destination = tmp_path / "copy"
    source.mkdir()
    destination.mkdir()
    (source / "segment.bin").write_bytes(b"qdrant-segment")
    before = _sha256(source / "segment.bin")

    token = inventory._copy_tree_snapshot(source, destination)

    assert token.startswith("sha256:")
    assert (destination / "segment.bin").read_bytes() == b"qdrant-segment"
    assert _sha256(source / "segment.bin") == before


def test_local_qdrant_inventory_reads_copied_snapshot_result(monkeypatch, tmp_path: Path) -> None:
    source = tmp_path / "qdrant"
    source.mkdir()
    (source / "storage.bin").write_bytes(b"stable")
    helper = tmp_path / "python"
    helper.write_text("", encoding="utf-8")

    monkeypatch.setattr(inventory, "_copy_tree_snapshot", lambda _source, _copy: "sha256:snapshot")
    monkeypatch.setattr(
        inventory.subprocess,
        "run",
        lambda *_args, **_kwargs: SimpleNamespace(
            returncode=0,
            stdout=json.dumps(
                {
                    "counts": {"collections": 2, "points": 4},
                    "metadata": {"collections": [], "payload_key_presence": {"source": 4}},
                }
            ),
            stderr="",
        ),
    )

    result = inventory.inventory_local_qdrant("legacy_qdrant", source, helper_python=helper)

    assert result["status"] == "STABLE"
    assert result["snapshot_token"] == "sha256:snapshot"
    assert result["counts"] == {"collections": 2, "points": 4}
    assert result["disposition"] == {"accepted": 0, "quarantined": 4, "rejected": 0}


def test_qdrant_copy_helper_aggregates_payload_keys_without_values(monkeypatch, tmp_path: Path) -> None:
    class FakeClient:
        closed = False

        def __init__(self, path: str):
            self.path = path

        def get_collections(self):
            return SimpleNamespace(collections=[SimpleNamespace(name="brain_docs")])

        def get_collection(self, _name: str):
            vectors = SimpleNamespace(size=768, distance="Cosine")
            return SimpleNamespace(
                status="green",
                points_count=2,
                config=SimpleNamespace(params=SimpleNamespace(vectors=vectors)),
            )

        def scroll(self, **_kwargs):
            return (
                [
                    SimpleNamespace(payload={"source": "private-path", "content": "secret-one"}),
                    SimpleNamespace(payload={"source": "private-path", "content": "secret-two"}),
                ],
                None,
            )

        def close(self):
            self.closed = True

    fake_module = SimpleNamespace(QdrantClient=FakeClient)
    monkeypatch.setitem(sys.modules, "qdrant_client", fake_module)

    result = inventory._inspect_qdrant_copy(tmp_path)

    assert result["counts"] == {"collections": 1, "points": 2}
    assert result["metadata"]["payload_key_presence"] == {"content": 2, "source": 2}
    assert "private-path" not in json.dumps(result)
    assert "secret-one" not in json.dumps(result)


def test_main_writes_aggregate_manifest_for_fixture_sources(monkeypatch, tmp_path: Path) -> None:
    vault = tmp_path / "vault"
    archive = tmp_path / "archive"
    statutes = tmp_path / "statutes"
    ima = tmp_path / "ima"
    for root in (vault, archive, statutes, ima):
        root.mkdir()
        (root / "doc.md").write_text("private content", encoding="utf-8")
    brain = tmp_path / "brain.db"
    connection = sqlite3.connect(brain)
    connection.execute("CREATE TABLE messages(id INTEGER PRIMARY KEY)")
    connection.commit()
    connection.close()
    output = tmp_path / "manifest.json"
    args = Namespace(
        vault=vault,
        archive=archive,
        brain_db=brain,
        qdrant_path=tmp_path / "unused-qdrant",
        qdrant_python=tmp_path / "unused-python",
        qdrant_url="http://qdrant.invalid",
        statutes=statutes,
        ima_docs=ima,
        rag_db=tmp_path / "missing-rag.db",
        output=output,
        inspect_qdrant_copy=None,
    )

    def request(method: str, path: str, payload: dict | None = None) -> dict:
        if path == "/collections":
            return {"result": {"collections": []}}
        raise AssertionError((method, path, payload))

    monkeypatch.setattr(inventory, "_parse_args", lambda _argv=None: args)
    monkeypatch.setattr(inventory, "_http_requester", lambda _url: request)
    monkeypatch.setattr(inventory, "producer_identity", lambda: {"id": "fixture-producer"})

    exit_code = inventory.main([])
    manifest = json.loads(output.read_text())

    assert exit_code == 0
    assert manifest["summary"]["sources"] == 7
    assert manifest["summary"]["absent"] == 1
    assert manifest["summary"]["freeze_eligible"] is True
    assert manifest["producer"] == {"id": "fixture-producer"}
    assert "private content" not in output.read_text()


def test_manifest_hash_excludes_observation_time_and_is_stable_for_same_snapshot() -> None:
    sources = [
        {
            "source_id": "vault",
            "source_type": "file_tree",
            "status": "STABLE",
            "snapshot_token": "sha256:abc",
            "freeze_eligible": True,
            "counts": {"files": 2, "bytes": 10},
            "metadata": {"extensions": {".md": 2}},
            "disposition": {"accepted": 0, "quarantined": 2, "rejected": 0},
        }
    ]

    producer = {
        "repository_commit": "a" * 40,
        "script_sha256": "sha256:" + "b" * 64,
        "legacy_app_sha256": "sha256:" + "c" * 64,
        "python_version": "3.test",
    }
    first = build_manifest(sources, observed_at="2026-07-14T10:00:00Z", producer=producer)
    second = build_manifest(sources, observed_at="2026-07-14T11:00:00Z", producer=producer)

    assert first["manifest_hash"] == second["manifest_hash"]
    assert first["snapshot_set_hash"] == second["snapshot_set_hash"]
    assert first["observed_at"] != second["observed_at"]
    assert first["producer"] == producer
    assert first["summary"] == {
        "sources": 1,
        "stable": 1,
        "absent": 0,
        "unstable": 0,
        "unavailable": 0,
        "accepted": 0,
        "quarantined": 2,
        "rejected": 0,
        "freeze_eligible": True,
    }
