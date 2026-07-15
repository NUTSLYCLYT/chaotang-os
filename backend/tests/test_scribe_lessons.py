"""P3a: GET /api/scribe/lessons reads the canonical archive projection."""

from __future__ import annotations

import inspect
import json

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(monkeypatch, isolated_session_local):
    monkeypatch.setenv("FENGQUN_AUTH", "false")
    from web.main import app

    return TestClient(app)


def _archive(
    session_local,
    *,
    task_id: str,
    memorial: dict | None,
    archive_id: str | None = None,
    synthetic: bool = False,
    created_at: str = "2026-07-15T08:00:00+00:00",
):
    from src.db.models import ShiguanArchive

    db = session_local()
    db.add(
        ShiguanArchive(
            id=archive_id or f"archive_{task_id}",
            task_id=task_id,
            raw_question="原始问题",
            refined_edict="核查真实证据后再裁决",
            final_memorial_json=(
                json.dumps(memorial, ensure_ascii=False)
                if memorial is not None
                else None
            ),
            emperor_decision_json=json.dumps(
                {"action": "adopt", "reason": "证据充分，同意归档"},
                ensure_ascii=False,
            ),
            evidence_chain_json="[]",
            source_label="LIVE_SWARM",
            synthetic_flag=synthetic,
            created_at=created_at,
        )
    )
    db.commit()
    db.close()


def _formal(session_local, *, task_id: str, memorial: dict):
    from src.db.models import FinalMemorial

    db = session_local()
    db.add(
        FinalMemorial(
            id=f"formal_{task_id}",
            task_id=task_id,
            review_id=f"review_{task_id}",
            swarm_run_id=f"run_{task_id}",
            quality_result_id=f"quality_{task_id}",
            status="archived",
            source_label="LIVE_SWARM",
            memorial_json=json.dumps(memorial, ensure_ascii=False),
            content_hash=f"hash_{task_id}",
            created_at="2026-07-15T07:00:00+00:00",
        )
    )
    db.commit()
    db.close()


def test_scribe_read_path_has_no_legacy_store_or_frozen_throne_dependency():
    from web.routers import scribe

    source = inspect.getsource(scribe)
    assert "chaotang_store" not in source
    assert "web.routers.throne" not in source


def test_lessons_projects_real_canonical_archive_summary(
    client, isolated_session_local
):
    _archive(
        isolated_session_local,
        task_id="task_a",
        memorial={
            "title": "奏折A",
            "summary": "先核验超时证据，再放行 SSE。",
            "recommendation": "adopt_with_conditions",
        },
    )

    response = client.get("/api/scribe/lessons")

    assert response.status_code == 200
    lessons = response.json()["data"]["lessons"]
    assert lessons == [
        {
            "billId": "task_a",
            "billTitle": "奏折A",
            "extractedAt": "2026-07-15T08:00:00+00:00",
            "lessons": [
                {
                    "id": "task_a-0",
                    "text": "先核验超时证据，再放行 SSE。",
                    "severity": "note",
                }
            ],
            "patterns": [],
            "tags": [],
            "summary": "证据充分，同意归档",
        }
    ]


def test_lessons_uses_formal_memorial_when_archive_snapshot_is_missing(
    client, isolated_session_local
):
    _formal(
        isolated_session_local,
        task_id="task_formal_fallback",
        memorial={"title": "正式奏折", "lessons": ["保留正式证据链"]},
    )
    _archive(
        isolated_session_local,
        task_id="task_formal_fallback",
        memorial=None,
    )

    lessons = client.get("/api/scribe/lessons").json()["data"]["lessons"]

    assert lessons[0]["billTitle"] == "正式奏折"
    assert lessons[0]["lessons"][0]["text"] == "保留正式证据链"


def test_lessons_skips_synthetic_empty_and_older_duplicate_archives(
    client, isolated_session_local
):
    _archive(
        isolated_session_local,
        task_id="task_synthetic",
        memorial={"summary": "不得展示"},
        synthetic=True,
    )
    _archive(isolated_session_local, task_id="task_empty", memorial={})
    _archive(
        isolated_session_local,
        task_id="task_duplicate",
        archive_id="archive_old",
        memorial={"title": "旧标题", "summary": "旧摘要"},
        created_at="2026-07-14T08:00:00+00:00",
    )
    _archive(
        isolated_session_local,
        task_id="task_duplicate",
        archive_id="archive_new",
        memorial={"title": "新标题", "summary": "新摘要"},
        created_at="2026-07-15T09:00:00+00:00",
    )

    lessons = client.get("/api/scribe/lessons").json()["data"]["lessons"]

    assert [entry["billId"] for entry in lessons] == ["task_duplicate"]
    assert lessons[0]["billTitle"] == "新标题"
    assert lessons[0]["lessons"][0]["text"] == "新摘要"
