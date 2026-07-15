"""P3a stop-gate RED contracts for canonical retrospective outcomes.

These tests intentionally describe the missing canonical outcome boundary.  They
must fail before production work starts: a memorial summary is not a retrospective,
canonical-storage failure is not an honest empty result, and legacy retrospectives
must survive a one-time canonical backfill without changing their authored content.
"""

from __future__ import annotations

import importlib
import json

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(monkeypatch, isolated_session_local):
    monkeypatch.setenv("FENGQUN_AUTH", "false")
    from web.main import app

    return TestClient(app, raise_server_exceptions=False)


def _archive(
    session_local,
    *,
    task_id: str,
    memorial: dict,
    decision_action: str = "adopt",
    decision_reason: str = "人工裁决",
    created_at: str = "2026-07-15T08:00:00+00:00",
) -> None:
    from src.db.models import ShiguanArchive

    with session_local() as db:
        db.add(
            ShiguanArchive(
                id=f"archive_{task_id}",
                task_id=task_id,
                raw_question="原始问题",
                refined_edict="形成可裁决方案",
                final_memorial_json=json.dumps(memorial, ensure_ascii=False),
                emperor_decision_json=json.dumps(
                    {"action": decision_action, "reason": decision_reason},
                    ensure_ascii=False,
                ),
                evidence_chain_json="[]",
                source_label="LIVE_SWARM",
                synthetic_flag=False,
                created_at=created_at,
            )
        )
        db.commit()


def _legacy_retrospective(
    session_local,
    *,
    task_id: str,
    lessons: list[str],
    playbook: str,
    authored_at: str,
    outcome: str,
) -> None:
    from src.db.models import Retrospective

    with session_local() as db:
        db.add(
            Retrospective(
                task_id=task_id,
                tenant_id=1,
                score=4,
                successes_json=json.dumps(["保留的成功项"], ensure_ascii=False),
                failures_json=json.dumps(["保留的失败项"], ensure_ascii=False),
                lessons_json=json.dumps(lessons, ensure_ascii=False),
                playbook=playbook,
                authored_by="史官甲",
                authored_at=authored_at,
                synthetic=False,
                outcome=outcome,
            )
        )
        db.commit()


def _run_expected_backfill(session_local) -> None:
    # RED boundary: this canonical event writer/backfill does not exist yet.
    from src.archive_outcomes import backfill_legacy_retrospectives

    with session_local() as db:
        backfill_legacy_retrospectives(session=db)
        db.commit()


def test_memorial_summary_alone_never_becomes_a_lesson(
    client, isolated_session_local
):
    _archive(
        isolated_session_local,
        task_id="summary_only",
        memorial={
            "title": "只有结论的奏折",
            "summary": "这是奏折结论，不是事后复盘教训。",
        },
    )

    lessons_response = client.get("/api/scribe/lessons")
    docs_response = client.get("/api/scribe/archive-docs")

    assert lessons_response.status_code == 200
    assert lessons_response.json()["data"]["lessons"] == []
    assert docs_response.status_code == 200
    assert docs_response.json()["data"]["docs"] == []


@pytest.mark.parametrize("path", ["/api/scribe/lessons", "/api/scribe/archive-docs"])
def test_canonical_db_unavailable_is_explicit_503(client, monkeypatch, path):
    engine_mod = importlib.import_module("src.db.engine")

    def _unavailable():
        raise RuntimeError("canonical db unavailable")

    monkeypatch.setattr(engine_mod, "SessionLocal", _unavailable)

    response = client.get(path)

    assert response.status_code == 503


def test_legacy_retrospective_backfill_preserves_authored_content_and_is_idempotent(
    client, isolated_session_local
):
    from sqlalchemy import text

    authored_at = "2026-06-30T09:10:11+00:00"
    lessons = ["先留证，再执行。", "失败时必须显式阻断。"]
    playbook = "每次发布先核验真实结果，再决定是否放行。"
    _archive(
        isolated_session_local,
        task_id="legacy_success",
        memorial={"title": "旧案成功复盘", "summary": "原奏折摘要"},
    )
    _legacy_retrospective(
        isolated_session_local,
        task_id="legacy_success",
        lessons=lessons,
        playbook=playbook,
        authored_at=authored_at,
        outcome="success",
    )

    _run_expected_backfill(isolated_session_local)
    first_projection = client.get("/api/scribe/lessons").json()["data"]["lessons"]
    _run_expected_backfill(isolated_session_local)
    second_projection = client.get("/api/scribe/lessons").json()["data"]["lessons"]

    assert first_projection == second_projection
    assert first_projection == [
        {
            "billId": "legacy_success",
            "billTitle": "旧案成功复盘",
            "extractedAt": authored_at,
            "lessons": [
                {
                    "id": "legacy_success-0",
                    "text": lessons[0],
                    "severity": "note",
                },
                {
                    "id": "legacy_success-1",
                    "text": lessons[1],
                    "severity": "note",
                },
            ],
            "patterns": [],
            "tags": [],
            "summary": playbook,
        }
    ]
    with isolated_session_local() as db:
        event_count = db.execute(
            text(
                "SELECT count(*) FROM archive_outcome_events "
                "WHERE task_id = :task_id"
            ),
            {"task_id": "legacy_success"},
        ).scalar_one()
    assert event_count == 1


def test_rejected_terminal_case_with_real_outcome_is_red_blocked_and_unsigned(
    client, isolated_session_local
):
    _archive(
        isolated_session_local,
        task_id="rejected_with_outcome",
        memorial={"title": "未获采纳但已有实效复盘"},
        decision_action="reject",
        decision_reason="证据不足，驳回",
    )
    _legacy_retrospective(
        isolated_session_local,
        task_id="rejected_with_outcome",
        lessons=["驳回后仍应记录真实结果。"],
        playbook="补证后再议，不得把驳回伪装成通过。",
        authored_at="2026-07-01T12:00:00+00:00",
        outcome="blocked",
    )

    _run_expected_backfill(isolated_session_local)
    response = client.get("/api/scribe/archive-docs")

    assert response.status_code == 200
    docs = response.json()["data"]["docs"]
    assert len(docs) == 1, "a rejected case with a real outcome must not disappear"
    assert docs[0]["caseId"] == "rejected_with_outcome"
    assert docs[0]["light"] == "red"
    assert docs[0]["provenance"]["gate"] == "blocked"
    assert docs[0]["signed"] is False


def test_rejected_outcome_without_archive_remains_visible(
    client, isolated_session_local
):
    _legacy_retrospective(
        isolated_session_local,
        task_id="rejected_without_archive",
        lessons=["拒绝路径没有归档，也不能抹去真实复盘。"],
        playbook="保留结果，等待补证。",
        authored_at="2026-07-02T12:00:00+00:00",
        outcome="blocked",
    )

    _run_expected_backfill(isolated_session_local)
    response = client.get("/api/scribe/archive-docs")

    assert response.status_code == 200
    assert response.json()["data"]["docs"] == [
        {
            "caseId": "rejected_without_archive",
            "light": "red",
            "headline": "rejected_without_archive",
            "shielded": None,
            "items": [
                {
                    "level": "red",
                    "title": "拒绝路径没有归档，也不能抹去真实复盘。",
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
                "gate": "blocked",
            },
            "sourceLabel": "MIXED",
            "signed": False,
            "sealedArchive": None,
        }
    ]


def test_corrected_legacy_retrospective_appends_and_supersedes(
    client, isolated_session_local
):
    from src.db.models import ArchiveOutcomeEvent, Retrospective

    _archive(
        isolated_session_local,
        task_id="corrected_outcome",
        memorial={"title": "纠错案"},
    )
    _legacy_retrospective(
        isolated_session_local,
        task_id="corrected_outcome",
        lessons=["旧结论"],
        playbook="旧打法",
        authored_at="2026-07-03T12:00:00+00:00",
        outcome="success",
    )
    _run_expected_backfill(isolated_session_local)

    with isolated_session_local() as db:
        retrospective = db.query(Retrospective).filter_by(
            task_id="corrected_outcome"
        ).one()
        retrospective.lessons_json = json.dumps(["纠正后的结论"], ensure_ascii=False)
        retrospective.playbook = "纠正后的打法"
        retrospective.authored_at = "2026-07-04T12:00:00+00:00"
        db.commit()
    _run_expected_backfill(isolated_session_local)

    lessons = client.get("/api/scribe/lessons").json()["data"]["lessons"]
    assert lessons[0]["lessons"][0]["text"] == "纠正后的结论"
    assert lessons[0]["summary"] == "纠正后的打法"
    with isolated_session_local() as db:
        events = (
            db.query(ArchiveOutcomeEvent)
            .filter_by(task_id="corrected_outcome")
            .order_by(ArchiveOutcomeEvent.recorded_at.asc())
            .all()
        )
        assert len(events) == 2
        assert events[1].event_type == "outcome.corrected"
        assert events[1].supersedes_event_id == events[0].id
