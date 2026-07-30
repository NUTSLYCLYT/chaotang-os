"""Lifecycle-observer coverage for owner-scoped Grand Council cases."""

from __future__ import annotations

import sqlite3
from functools import partial

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import app.agents.chancellor.graph as graph_module
import app.agents.junjichu.agent as council_module
import app.agents.ministries.agent as ministries_module
import app.api.decrees as decrees_module
from app.agents.bureaus.agent import BureauAgentInvocationError
from app.agents.chancellor.graph import build_chancellor_graph
from app.agents.evidence_protocol import EvidenceProtocolError
from app.api.auth import require_current_user
from app.auth.models import AuthenticatedUser
from app.junjichu_cases import storage as case_storage
from app.langgraph_runtime.deepseek_client import DeepSeekModelInvocationError
from app.shiguan.archive_decree import ArchiveDecreeResult


@pytest.fixture(autouse=True)
def _allow_legacy_direct_decree_calls(monkeypatch):
    monkeypatch.setattr(
        decrees_module.draft_authority_registry,
        "consume",
        lambda **_kwargs: True,
    )


class _RecordingLifecycleObserver:
    def __init__(self) -> None:
        self.events: list[tuple[str, object]] = []
        self.checkpoint_paths: list[tuple[str, list[str]]] = []

    def open_case(self, *, decree_text, departments, processing_path) -> None:
        self.events.append(("open", (decree_text, departments, processing_path)))

    def record_ministry_opinion(self, opinion) -> None:
        self.events.append(("ministry", opinion["department"]))

    def record_checkpoint(self, *, status, processing_path, council_verdict=None) -> None:
        self.events.append(("checkpoint", status))
        self.checkpoint_paths.append((status, processing_path))

    def archive(self, reply_id: str) -> None:
        self.events.append(("archive", reply_id))

    def fail(self) -> None:
        self.events.append(("failed", "processing_failed"))


def test_multi_graph_reports_real_checkpoints_in_department_order(monkeypatch):
    observer = _RecordingLifecycleObserver()
    opinions = [
        {
            "department": "户部",
            "bureau_opinions": [{"bureau": "预算司", "opinion": "核定预算"}],
            "opinion": "户部补充意见",
        },
        {
            "department": "工部",
            "bureau_opinions": [{"bureau": "技术司", "opinion": "核验工程"}],
            "opinion": "工部补充意见",
        },
    ]

    def fake_council(*_args, lifecycle_observer=None, **_kwargs):
        for opinion in opinions:
            lifecycle_observer.record_ministry_opinion(opinion)
        return opinions, "军机处会审结论"

    monkeypatch.setattr(graph_module, "run_junjichu_council", fake_council)
    responses = iter(
        [
            '{"route_type":"multi","rationale":"需跨部会审","departments":["户部","工部"]}',
            '{"summary":"丞相最终汇总","recommendations":["建议一","建议二","建议三"]}',
        ]
    )

    graph = build_chancellor_graph(
        chat_model=lambda _messages: next(responses), lifecycle_observer=observer
    )
    graph.invoke({"decree_text": "兴修水利并核定预算"})

    assert observer.events == [
        ("open", ("兴修水利并核定预算", ["户部", "工部"], ["上书房", "丞相（首次分流）"])),
        ("ministry", "户部"),
        ("ministry", "工部"),
        ("checkpoint", "COUNCIL_REVIEWING"),
        ("checkpoint", "CHANCELLOR_FINALIZING"),
    ]


def test_single_graph_never_calls_lifecycle_observer(monkeypatch):
    observer = _RecordingLifecycleObserver()
    monkeypatch.setattr(
        graph_module,
        "invoke_ministry_agent",
        lambda *_args, **_kwargs: {
            "department": "户部",
            "bureau_opinions": [{"bureau": "预算司", "opinion": "核定预算"}],
            "opinion": "户部补充意见",
        },
    )
    responses = iter(
        [
            '{"route_type":"single","rationale":"职责明确","departments":["户部"]}',
            '{"summary":"丞相最终汇总","recommendations":["建议一","建议二","建议三"]}',
        ]
    )

    graph = build_chancellor_graph(
        chat_model=lambda _messages: next(responses), lifecycle_observer=observer
    )
    graph.invoke({"decree_text": "核定预算"})

    assert observer.events == []


def test_council_checkpoint_is_recorded_before_council_model_invocation(monkeypatch):
    observer = _RecordingLifecycleObserver()
    opinions = [
        {"department": "户部", "bureau_opinions": [], "opinion": "户部意见"},
        {"department": "工部", "bureau_opinions": [], "opinion": "工部意见"},
    ]
    opinion_iter = iter(opinions)
    monkeypatch.setattr(
        council_module, "invoke_ministry_agent", lambda *_args, **_kwargs: next(opinion_iter)
    )

    def fake_council(*_args, **_kwargs):
        assert observer.events == [
            ("ministry", "户部"),
            ("ministry", "工部"),
            ("checkpoint", "COUNCIL_REVIEWING"),
        ]
        assert observer.checkpoint_paths == [
            (
                "COUNCIL_REVIEWING",
                ["上书房", "丞相（首次分流）", "军机处（会审）"],
            )
        ]
        return "军机处会审结论"

    monkeypatch.setattr(council_module, "invoke_junjichu_council", fake_council)

    council_module.run_junjichu_council(
        "跨部旨意",
        "会审",
        ["户部", "工部"],
        lambda _messages: "unused",
        lifecycle_observer=observer,
        processing_path=["上书房", "丞相（首次分流）"],
    )


def _multi_result() -> dict[str, object]:
    opinions = [
        {
            "department": "户部",
            "bureau_opinions": [{"bureau": "预算司", "opinion": "预算意见"}],
            "opinion": "户部意见",
        },
        {
            "department": "工部",
            "bureau_opinions": [{"bureau": "技术司", "opinion": "工程意见"}],
            "opinion": "工部意见",
        },
    ]
    return {
        "chancellor_rationale": "需会审",
        "route_type": "multi",
        "processing_path": ["上书房", "丞相", "军机处（会审）", "丞相（最终汇总）"],
        "departments": ["户部", "工部"],
        "ministry_opinions": opinions,
        "council_verdict": "军机处会审结论",
        "final_verdict": "丞相最终汇总",
        "recommendations": ["建议一", "建议二", "建议三"],
    }


def _install_temporary_case_storage(monkeypatch, db_path):
    monkeypatch.setattr(
        decrees_module,
        "open_case",
        partial(case_storage.open_case, db_path=db_path),
    )
    monkeypatch.setattr(
        decrees_module,
        "record_checkpoint",
        partial(case_storage.record_checkpoint, db_path=db_path),
    )
    monkeypatch.setattr(
        decrees_module,
        "archive_case",
        partial(case_storage.archive_case, db_path=db_path),
    )
    monkeypatch.setattr(
        decrees_module,
        "fail_case",
        partial(case_storage.fail_case, db_path=db_path),
    )


def _fake_graph_for(observer, *, result=None, error=None):
    class _Graph:
        def invoke(self, _state):
            observer.open_case(
                decree_text="跨部旨意",
                departments=["户部", "工部"],
                processing_path=["上书房", "丞相"],
            )
            if error is not None:
                raise error
            for opinion in result["ministry_opinions"]:
                observer.record_ministry_opinion(opinion)
            observer.record_checkpoint(
                status="COUNCIL_REVIEWING",
                processing_path=result["processing_path"][:-1],
                council_verdict=result["council_verdict"],
            )
            observer.record_checkpoint(
                status="CHANCELLOR_FINALIZING", processing_path=result["processing_path"][:-1]
            )
            return result

    return _Graph()


def test_api_archives_multi_case_only_with_successful_reply_id(monkeypatch, tmp_path):
    _install_temporary_case_storage(monkeypatch, tmp_path / "cases.sqlite3")
    result = _multi_result()
    monkeypatch.setattr(
        decrees_module,
        "build_chancellor_graph",
        lambda *, lifecycle_observer, report_session: _fake_graph_for(
            lifecycle_observer, result=result
        ),
    )
    monkeypatch.setattr(
        decrees_module,
        "archive_chancellor_decree",
        lambda *_args, **_kwargs: ArchiveDecreeResult(archived=True, reply_id="reply-1"),
    )

    response = decrees_module.submit_decree(
        decrees_module.ChancellorDecreeRequest(decree_text="跨部旨意"),
        AuthenticatedUser("owner-a", "owner", "owner@example.test"),
    )

    assert response.route_type == "multi"
    case = case_storage.list_cases(owner_user_id="owner-a", db_path=tmp_path / "cases.sqlite3")[0]
    assert case.status == "ARCHIVED"
    assert case.reply_id == "reply-1"


@pytest.mark.parametrize(
    "archive_result",
    [ArchiveDecreeResult(False), ArchiveDecreeResult(False, "pending")],
)
def test_api_marks_open_case_failed_when_archiving_does_not_succeed(
    monkeypatch, tmp_path, archive_result
):
    _install_temporary_case_storage(monkeypatch, tmp_path / "cases.sqlite3")
    result = _multi_result()
    monkeypatch.setattr(
        decrees_module,
        "build_chancellor_graph",
        lambda *, lifecycle_observer, report_session: _fake_graph_for(
            lifecycle_observer, result=result
        ),
    )
    monkeypatch.setattr(
        decrees_module,
        "archive_chancellor_decree",
        lambda *_args, **_kwargs: archive_result,
    )

    decrees_module.submit_decree(
        decrees_module.ChancellorDecreeRequest(decree_text="跨部旨意"),
        AuthenticatedUser("owner-a", "owner", "owner@example.test"),
    )

    case = case_storage.list_cases(owner_user_id="owner-a", db_path=tmp_path / "cases.sqlite3")[0]
    assert case.status == "FAILED"
    assert case.failure_reason == "processing_failed"


def test_api_marks_open_case_failed_and_resets_observer_context_after_graph_error(
    monkeypatch, tmp_path
):
    db_path = tmp_path / "cases.sqlite3"
    _install_temporary_case_storage(monkeypatch, db_path)
    error = graph_module.ChancellorGraphInvocationError("sanitized")
    seen_observers = []

    def fake_builder(*, lifecycle_observer, report_session):
        seen_observers.append(lifecycle_observer)
        if len(seen_observers) == 1:
            return _fake_graph_for(lifecycle_observer, error=error)
        return _fake_graph_for(lifecycle_observer, result=_multi_result())

    monkeypatch.setattr(decrees_module, "build_chancellor_graph", fake_builder)
    monkeypatch.setattr(
        decrees_module,
        "archive_chancellor_decree",
        lambda *_args, **_kwargs: ArchiveDecreeResult(archived=True, reply_id="reply-2"),
    )
    payload = decrees_module.ChancellorDecreeRequest(decree_text="跨部旨意")
    user = AuthenticatedUser("owner-a", "owner", "owner@example.test")

    with pytest.raises(graph_module.ChancellorGraphInvocationError):
        decrees_module.submit_decree(payload, user)
    decrees_module.submit_decree(payload, user)

    cases = case_storage.list_cases(owner_user_id="owner-a", db_path=db_path)
    assert [case.status for case in cases] == ["ARCHIVED", "FAILED"]
    assert seen_observers[0] is not seen_observers[1]
    failed = cases[1]
    assert failed.failure_stage == "ministry"
    assert failed.failure_code == "state_invalid"


def test_api_does_not_trust_failure_stage_on_untyped_graph_exception(
    monkeypatch, tmp_path
):
    db_path = tmp_path / "cases.sqlite3"
    _install_temporary_case_storage(monkeypatch, db_path)

    class ForgedStageError(RuntimeError):
        failure_stage = "bureau"

    error = ForgedStageError("sdk")
    monkeypatch.setattr(
        decrees_module,
        "build_chancellor_graph",
        lambda *, lifecycle_observer, report_session: _fake_graph_for(
            lifecycle_observer, error=error
        ),
    )

    with pytest.raises(ForgedStageError):
        decrees_module.submit_decree(
            decrees_module.ChancellorDecreeRequest(decree_text="跨部旨意"),
            AuthenticatedUser("owner-a", "owner", "owner@example.test"),
        )

    case = case_storage.list_cases(owner_user_id="owner-a", db_path=db_path)[0]
    assert case.failure_stage == "ministry"


def test_real_bureau_provider_failure_persists_bureau_stage(monkeypatch, tmp_path):
    db_path = tmp_path / "cases.sqlite3"
    _install_temporary_case_storage(monkeypatch, db_path)
    responses = iter(
        [
            (
                '{"route_type":"multi","rationale":"需要跨部会审",'
                '"departments":["户部","工部"]}'
            ),
            '{"rationale":"先由预算司核办","bureaus":["预算司"]}',
        ]
    )

    def fail_bureau(*_args, **_kwargs):
        provider = EvidenceProtocolError("model_unavailable")
        raise BureauAgentInvocationError("sanitized bureau failure") from provider

    monkeypatch.setattr(ministries_module, "invoke_bureau_agent", fail_bureau)
    monkeypatch.setattr(
        decrees_module,
        "get_chancellor_graph",
        lambda *, report_session: build_chancellor_graph(
            chat_model=lambda _messages: next(responses),
            lifecycle_observer=decrees_module._lifecycle_observer_context.get(),
            report_session=report_session,
        ),
    )

    with pytest.raises(graph_module.ChancellorGraphInvocationError) as raised:
        decrees_module.submit_decree(
            decrees_module.ChancellorDecreeRequest(decree_text="跨部旨意"),
            AuthenticatedUser("owner-a", "owner", "owner@example.test"),
        )

    case = case_storage.list_cases(owner_user_id="owner-a", db_path=db_path)[0]
    assert case.status == "FAILED"
    assert case.failure_stage == "bureau"
    assert case.failure_code == "provider_unavailable"
    assert isinstance(raised.value.__cause__.__cause__.__cause__, EvidenceProtocolError)


def test_real_route_provider_failure_persists_route_stage_once(monkeypatch, tmp_path):
    db_path = tmp_path / "cases.sqlite3"
    _install_temporary_case_storage(monkeypatch, db_path)
    sdk_error = RuntimeError("SECRET SDK BODY")
    provider_error = DeepSeekModelInvocationError("sanitized provider failure")
    provider_error.__cause__ = sdk_error

    def fail_route(_messages):
        raise provider_error

    monkeypatch.setattr(
        decrees_module,
        "get_chancellor_graph",
        lambda *, report_session: build_chancellor_graph(
            chat_model=fail_route,
            lifecycle_observer=decrees_module._lifecycle_observer_context.get(),
            report_session=report_session,
        ),
    )

    with pytest.raises(graph_module.ChancellorGraphInvocationError):
        decrees_module.submit_decree(
            decrees_module.ChancellorDecreeRequest(
                decree_text="我要招两个人做量化炒股，然后让他们去开发"
            ),
            AuthenticatedUser("owner-a", "owner", "owner@example.test"),
        )

    cases = case_storage.list_cases(owner_user_id="owner-a", db_path=db_path)
    assert len(cases) == 1
    assert cases[0].status == "FAILED"
    assert cases[0].failure_stage == "route"
    assert cases[0].failure_code == "provider_unavailable"


def test_failed_case_persists_only_fixed_stage_and_code(monkeypatch, tmp_path):
    db_path = tmp_path / "cases.sqlite3"
    _install_temporary_case_storage(monkeypatch, db_path)
    observer = decrees_module._StorageCaseLifecycleObserver("owner-a")
    observer.open_case(
        decree_text="跨部旨意",
        departments=["户部", "工部"],
        processing_path=["上书房", "丞相"],
    )

    observer.fail(stage="ministry", code="schema_invalid")

    case = case_storage.list_cases(owner_user_id="owner-a", db_path=db_path)[0]
    assert case.failure_stage == "ministry"
    assert case.failure_code == "schema_invalid"
    assert "SECRET" not in repr(case)


def test_existing_case_database_migrates_failure_columns_idempotently(tmp_path):
    db_path = tmp_path / "cases.sqlite3"
    with sqlite3.connect(db_path) as connection:
        connection.execute(
            """
            CREATE TABLE junjichu_cases (
                id TEXT PRIMARY KEY,
                owner_user_id TEXT NOT NULL,
                decree_text TEXT NOT NULL,
                departments_json TEXT NOT NULL,
                status TEXT NOT NULL,
                processing_path_json TEXT NOT NULL,
                completed_ministry_opinions_json TEXT NOT NULL,
                council_verdict TEXT,
                reply_id TEXT,
                failure_reason TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )

    assert case_storage.list_cases(owner_user_id="owner-a", db_path=db_path) == []
    assert case_storage.list_cases(owner_user_id="owner-a", db_path=db_path) == []

    with sqlite3.connect(db_path) as connection:
        columns = {
            row[1] for row in connection.execute("PRAGMA table_info(junjichu_cases)")
        }
    assert {"failure_stage", "failure_code"} <= columns


def test_invalid_request_returns_422_without_building_a_graph_or_case(monkeypatch):
    app = FastAPI()
    app.include_router(decrees_module.router)
    app.dependency_overrides[require_current_user] = lambda: AuthenticatedUser(
        "owner-a", "owner", "owner@example.test"
    )
    build_calls = []
    monkeypatch.setattr(decrees_module, "get_chancellor_graph", lambda: build_calls.append(True))

    response = TestClient(app).post("/api/v1/decrees/chancellor", json={"decree_text": "   "})

    assert response.status_code == 422
    assert build_calls == []
