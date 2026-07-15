"""P3a: GET /api/scribe/archive-docs maps canonical archives to CourtDoc."""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(monkeypatch, isolated_session_local):
    monkeypatch.setenv("FENGQUN_AUTH", "false")
    from web.main import app

    return TestClient(app)


def _archive(session_local, *, task_id: str, source_label: str = "LIVE_SWARM"):
    from src.db.models import ShiguanArchive

    db = session_local()
    db.add(
        ShiguanArchive(
            id=f"archive_{task_id}",
            task_id=task_id,
            raw_question="原始问题",
            refined_edict="形成可裁决方案",
            final_memorial_json=json.dumps(
                {
                    "title": "已封存奏折",
                    "summary": "先核证据，再执行。",
                    "recommendation": "adopt_with_conditions",
                },
                ensure_ascii=False,
            ),
            emperor_decision_json=json.dumps(
                {"action": "adopt", "reason": "人工确认通过"},
                ensure_ascii=False,
            ),
            evidence_chain_json="[]",
            source_label=source_label,
            synthetic_flag=False,
            created_at="2026-07-15T08:00:00+00:00",
        )
    )
    db.commit()
    db.close()


def test_archive_docs_maps_canonical_archive_without_inventing_evidence(
    client, isolated_session_local
):
    _archive(isolated_session_local, task_id="task_a")

    response = client.get("/api/scribe/archive-docs")

    assert response.status_code == 200
    assert response.json()["data"]["docs"] == [
        {
            "caseId": "task_a",
            "light": "green",
            "headline": "已封存奏折",
            "shielded": None,
            "items": [
                {
                    "level": "yellow",
                    "title": "先核证据，再执行。",
                    "odds": None,
                    "impact": None,
                    "fix": None,
                    "evidenceRef": None,
                }
            ],
            "actions": ["open_annals", "trace_evidence", "export_amulet"],
            "provenance": {
                "advisors": [],
                "grounding": "none",
                "gate": "passed",
            },
            "sourceLabel": "LIVE_SWARM",
            "signed": True,
            "sealedArchive": "archive_task_a",
        }
    ]


def test_archive_docs_skips_non_adjudicable_source(
    client, isolated_session_local
):
    _archive(
        isolated_session_local,
        task_id="task_fallback",
        source_label="FALLBACK",
    )

    assert client.get("/api/scribe/archive-docs").json()["data"]["docs"] == []


def test_non_default_tenant_cannot_read_unscoped_canonical_archives(
    client, monkeypatch, isolated_session_local
):
    _archive(isolated_session_local, task_id="task_default")
    import src.tenant as tenant_mod

    monkeypatch.setattr(tenant_mod, "get_current_tenant", lambda: "tenant_b")

    assert client.get("/api/scribe/archive-docs").json()["data"]["docs"] == []


def test_archive_docs_returns_empty_contract_when_canonical_db_is_unavailable(
    client, monkeypatch
):
    import importlib

    engine_mod = importlib.import_module("src.db.engine")

    def _unavailable():
        raise RuntimeError("canonical db unavailable")

    monkeypatch.setattr(engine_mod, "SessionLocal", _unavailable)

    response = client.get("/api/scribe/archive-docs")

    assert response.status_code == 200
    assert response.json()["data"] == {"docs": []}


def test_archive_docs_requires_auth_when_backend_auth_is_enabled(
    monkeypatch, isolated_session_local
):
    from web import deps
    from web.main import app

    monkeypatch.setattr(deps, "AUTH_ENABLED", True)
    app.dependency_overrides.pop(deps.get_current_user, None)

    response = TestClient(app).get("/api/scribe/archive-docs")

    assert response.status_code == 401
