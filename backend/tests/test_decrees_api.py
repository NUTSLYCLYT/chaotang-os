"""Tests for ``POST /api/v1/decrees/chancellor``.

Fully offline: ``get_chancellor_graph`` is always monkeypatched before a
request is made, so no test in this module ever touches
``backend/config/providers.yaml``, any dotenv file, an environment variable,
or the network -- and no real DeepSeek API usage is ever produced.

The validation-failure tests below are a direct regression test for a
verified FastAPI pitfall: if the Chancellor graph provider were wired via
``Depends()`` instead of being called explicitly from inside the endpoint
body, it would still be invoked even when the request body subsequently
fails Pydantic validation. Each validation-failure test asserts the
monkeypatched provider's call count is exactly ``0`` to guard against that
regression.

This module also exercises the module 3 HTTP contract that replaced the old
single-paragraph ``memorial_text`` field with the full routing/processing
result produced by ``build_chancellor_graph()`` (module 1's single-department
route and module 2's 军机处 multi-department council route alike) -- see
``docs/decisions/0012-decree-six-ministries-joint-review.md``.
"""

from __future__ import annotations

import hashlib
import re
import tomllib
from copy import deepcopy
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import app.api.decrees as decrees_module
from app.accounting_reports.models import AccountingRequestKind, ReportPeriod
from app.accounting_reports.sources import AccountingSourceError
from app.accounting_reports.storage import ArtifactStorage
from app.agents.chancellor import (
    CHANCELLOR_IDENTITY,
    ChancellorGraphInvocationError,
    build_chancellor_graph,
)
from app.agents.chancellor_draft.authority import (
    AccountingAuthorityContext,
    ConsumedDraftAuthority,
)
from app.agents.chancellor_draft.routing import (
    ApprovedDepartmentRoute,
    ApprovedRouteSnapshot,
)
from app.agents.chancellor_runtime import (
    ChancellorAgent,
    ChancellorEntrypoint,
    ChancellorInvocationResult,
    ChancellorRuntimeError,
    ChancellorSkillId,
    ChancellorSkillRegistry,
    ChancellorSkillRegistryError,
)
from app.api.auth import CurrentUser
from app.auth import configure_auth_db, create_session, create_user
from app.langgraph_runtime.deepseek_client import (
    DeepSeekModelInvocationError,
    DeepSeekModelNameError,
)
from app.langgraph_runtime.deepseek_config import DeepSeekApiKeyError
from app.main import app as main_app
from app.shiguan import storage as shiguan_storage

OWNER_A = "owner-a"
_REAL_BUILD_ACCOUNTING_REPORT_SESSION = decrees_module.build_accounting_report_session

DECREE_URL = "/api/v1/decrees/chancellor"

execution_app = FastAPI()
decrees_module.register_chancellor_exception_handlers(execution_app)


@execution_app.post(
    DECREE_URL,
    response_model=decrees_module.ChancellorDecreeResponse,
)
def _execute_decree_for_engine_tests(
    payload: decrees_module.ChancellorDecreeRequest,
    current_user: CurrentUser,
):
    return decrees_module.execute_decree_now(payload, current_user)


client = TestClient(execution_app)
ACCOUNTING_DECREE = (
    "请户部会计司根据现有财务数据，生成2024年至2025年管理层综合财务报表，"
    "并交付可下载的 Excel 文件。报告需包括管理摘要、核心财务报表、科目趋势、"
    "异常分析、科目明细、校验结果和数据来源；核对金额、同比变化及勾稽关系，"
    "列明数据缺口，不修改原始数据。"
)
ACCOUNTING_PROCESSING_PATH = [
    "上书房",
    "丞相（首次分流）",
    "户部",
    "户部·会计司",
    "户部（部级补充）",
    "丞相（最终汇总）",
]


def _approved_route(
    *routes: tuple[str, tuple[str, ...]],
) -> ApprovedRouteSnapshot:
    return ApprovedRouteSnapshot(
        departments=tuple(
            ApprovedDepartmentRoute(
                department=department,
                required_bureaus=required_bureaus,
            )
            for department, required_bureaus in routes
        )
    )


@pytest.fixture(autouse=True)
def _authenticate_client(isolate_shiguan_default_db_path, tmp_path, monkeypatch):
    del isolate_shiguan_default_db_path
    configure_auth_db(tmp_path / "auth.sqlite3")
    user = create_user("decree-user", "decree@example.com", "six-or-more")
    monkeypatch.setattr(
        decrees_module.draft_authority_registry,
        "consume",
        lambda **_kwargs: _approved_route(("吏部", ("任免司",))),
    )
    monkeypatch.setattr(
        decrees_module.draft_authority_registry,
        "consume_with_context",
        lambda **kwargs: ConsumedDraftAuthority(
            decrees_module.draft_authority_registry.consume(**kwargs),
            (
                AccountingAuthorityContext(
                    AccountingRequestKind.ACCOUNTING_REPORT,
                    ReportPeriod(2024, 2025),
                    "a" * 64,
                )
                if kwargs.get("decree_text") == ACCOUNTING_DECREE
                else None
            ),
        ),
    )
    monkeypatch.setattr(
        decrees_module,
        "build_accounting_report_session",
        lambda **kwargs: _FakeReportSession(owner_user_id=kwargs["owner_user_id"]),
    )
    client.headers["Authorization"] = f"Bearer {create_session(user.id)}"
    yield
    client.headers.pop("Authorization", None)
    configure_auth_db(None)

_SINGLE_ROUTE_RESULT = {
    "decree_text": "整顿吏治",
    "chancellor_rationale": "此事职责明确，交由吏部办理即可。",
    "route_type": "single",
    "departments": ["吏部"],
    "processing_path": [
        "上书房",
        "丞相（首次分流）",
        "吏部",
        "吏部·任免司",
        "吏部（部级补充）",
        "丞相（最终汇总）",
    ],
    "ministry_opinions": [
        {
            "department": "吏部",
            "bureau_opinions": [{"bureau": "任免司", "opinion": "建议核查官员考绩。"}],
            "opinion": "臣部补充：同步核对职责匹配与晋升记录。",
        }
    ],
    "council_verdict": None,
    "final_verdict": "丞相汇总：先核查考绩，再审视职责匹配。",
    "recommendations": ["核查近期考绩", "复核职责匹配", "制定整改时限"],
}

_MULTI_ROUTE_RESULT = {
    "decree_text": "兴修水利并征调粮草以工代赈",
    "chancellor_rationale": "此事涉及工程与钱粮，需户部、工部会同办理。",
    "route_type": "multi",
    "departments": ["户部", "工部"],
    "processing_path": [
        "上书房",
        "丞相（首次分流）",
        "军机处（召集）",
        "户部",
        "户部·预算司",
        "户部（部级补充）",
        "工部",
        "工部·进度司",
        "工部（部级补充）",
        "军机处（会审）",
        "丞相（最终汇总）",
    ],
    "ministry_opinions": [
        {
            "department": "户部",
            "bureau_opinions": [{"bureau": "预算司", "opinion": "可拨付部分钱粮。"}],
            "opinion": "臣部补充：分期拨付并设置预算门槛。",
        },
        {
            "department": "工部",
            "bureau_opinions": [{"bureau": "进度司", "opinion": "可按两期兴工。"}],
            "opinion": "臣部补充：先勘察后分阶段验收。",
        },
    ],
    "council_verdict": "军机处会审：同意分期拨付、分段验收。",
    "final_verdict": "丞相汇总：准予兴修水利，户部与工部依会审结论协同。",
    "recommendations": ["先完成勘察", "分期拨付预算", "按里程碑验收"],
}

_ACCOUNTING_ROUTE_RESULT = {
    **deepcopy(_SINGLE_ROUTE_RESULT),
    "decree_text": ACCOUNTING_DECREE,
    "chancellor_rationale": "依已批准拟旨路由办理。",
    "departments": ["户部"],
    "processing_path": ACCOUNTING_PROCESSING_PATH,
    "ministry_opinions": [
        {
            "department": "户部",
            "bureau_opinions": [
                {"bureau": "会计司", "opinion": "会计司已生成财务报表。"}
            ],
            "opinion": "户部确认会计司财务报表。",
        }
    ],
}


def test_durable_decree_checkpoint_drops_live_evidence_session_only() -> None:
    live_session = object()
    frozen_snapshot = {"packs": [], "adopted_evidence_ids": []}
    result = {
        "chancellor_rationale": "交户部办理",
        "evidence_session": live_session,
        "evidence_snapshot": frozen_snapshot,
        "adopted_evidence_ids": [],
    }

    durable = decrees_module._durable_internal_result(result)

    assert "evidence_session" not in durable
    assert durable["evidence_snapshot"] is frozen_snapshot
    assert durable["adopted_evidence_ids"] == []
    assert durable["chancellor_rationale"] == "交户部办理"
    assert result["evidence_session"] is live_session


class _FakeGraph:
    """A minimal stand-in for a compiled LangGraph graph.

    ``invoke_result`` is returned as-is unless ``invoke_error`` is set, in
    which case it is raised instead. ``invoke_calls`` records every state
    dict passed to ``.invoke()`` so tests can assert on call count/args.
    """

    def __init__(self, invoke_result: dict | None = None, invoke_error: Exception | None = None):
        self.invoke_result = invoke_result
        self.invoke_error = invoke_error
        self.invoke_calls: list[dict] = []

    def invoke(self, state: dict) -> dict:
        self.invoke_calls.append(state)
        if self.invoke_error is not None:
            raise self.invoke_error
        assert self.invoke_result is not None
        return self.invoke_result


class _FakeProvider:
    """Stand-in for ``get_chancellor_graph`` that records its call count.

    Optionally raises ``build_error`` instead of returning ``graph``, to
    simulate ``build_chancellor_graph()`` failing fast on bad configuration
    (as it does for a real, un-injected chat model).
    """

    def __init__(self, graph: _FakeGraph | None = None, build_error: Exception | None = None):
        self.graph = graph
        self.build_error = build_error
        self.call_count = 0

    def __call__(self, *, report_session=None) -> _FakeGraph:
        self.report_session = report_session
        self.call_count += 1
        if self.build_error is not None:
            raise self.build_error
        assert self.graph is not None
        return self.graph


@pytest.fixture
def fake_provider(monkeypatch):
    """Install a fresh ``_FakeProvider`` and return it for configuration.

    Tests set ``.graph`` / ``.build_error`` on the returned instance (or
    replace it entirely) before issuing a request.
    """

    def _install(provider: _FakeProvider) -> _FakeProvider:
        monkeypatch.setattr(decrees_module, "get_chancellor_graph", provider)
        return provider

    return _install


class _FakeReportSession:
    def __init__(
        self,
        *,
        generations=(),
        published=(),
        publish_error=None,
        storage=None,
        owner_user_id="owner-a",
        run_id="run-a",
    ):
        self.generations = tuple(generations)
        self.published = published
        self.publish_error = publish_error
        self.storage = storage
        self.owner_user_id = owner_user_id
        self.run_id = run_id
        self.events: list[object] = []
        self.publishable = True
        self.preserve_published_reply_id = False

    def is_publishable_generation(self, _generation):
        return self.publishable

    def publish(self, reply_id):
        self.events.append(("publish", reply_id))
        if self.publish_error is not None:
            raise self.publish_error
        for item in self.published:
            if hasattr(item, "reply_id") and not self.preserve_published_reply_id:
                item.reply_id = reply_id
        return self.published

    def abort(self):
        self.events.append("abort")
        if self.storage is not None:
            self.storage.abort_run(self.owner_user_id, self.run_id)


def _pending_generation(
    tmp_path: Path,
    *,
    owner_user_id: str,
    run_id: str,
    suffix: str,
):
    storage = ArtifactStorage(
        artifact_dir=tmp_path / "report_artifacts",
        db_path=tmp_path / "report_artifacts.sqlite3",
    )
    payload = f"synthetic-{suffix}".encode()
    pending_path = storage.artifact_dir / f".{suffix.zfill(32)}.xlsx"
    pending_path.write_bytes(payload)
    pending = storage.create_pending(
        owner_user_id=owner_user_id,
        run_id=run_id,
        report_type="management",
        display_name="2024-2025会计管理报告.xlsx",
        period=ReportPeriod(2024, 2025),
        source_hashes=("a" * 64,),
        file_sha256=hashlib.sha256(payload).hexdigest(),
        pending_path=pending_path,
    )
    return storage, SimpleNamespace(
        artifact_id=pending.artifact_id,
        model_prompt="synthetic summary",
        request_kind=AccountingRequestKind.ACCOUNTING_REPORT,
        period=ReportPeriod(2024, 2025),
        owner_user_id=owner_user_id,
        run_id=run_id,
        report_type="management",
    )


@pytest.fixture
def report_session(monkeypatch):
    session = _FakeReportSession()
    builds = []

    def build(**kwargs):
        builds.append(kwargs)
        session.owner_user_id = kwargs["owner_user_id"]
        session.run_id = kwargs["run_id"]
        for item in (*session.generations, *session.published):
            if hasattr(item, "owner_user_id"):
                item.owner_user_id = session.owner_user_id
            if hasattr(item, "run_id"):
                item.run_id = session.run_id
        return session

    monkeypatch.setattr(decrees_module, "build_accounting_report_session", build)
    return session, builds


def test_normal_decree_returns_empty_artifacts(fake_provider, report_session):
    session, builds = report_session
    provider = fake_provider(_FakeProvider(graph=_FakeGraph(invoke_result=_SINGLE_ROUTE_RESULT)))

    response = client.post(DECREE_URL, json={"decree_text": "整顿吏治"})

    assert response.status_code == 200
    assert response.json()["artifacts"] == []
    assert response.json()["delivery_kind"] == "none"
    assert provider.report_session is session
    assert len(builds) == 1
    assert builds[0]["owner_user_id"]
    assert len(builds[0]["run_id"]) == 32


@pytest.mark.parametrize("preflight_outcome", ["fingerprint_drift", "parse_failure"])
def test_execution_source_drift_is_409_after_authority_consumption_without_side_effects(
    preflight_outcome, monkeypatch, fake_provider
):
    consumed = ConsumedDraftAuthority(
        _approved_route(
            (
                _ACCOUNTING_ROUTE_RESULT["departments"][0],
                (_ACCOUNTING_ROUTE_RESULT["ministry_opinions"][0]["bureau_opinions"][0]["bureau"],),
            )
        ),
        AccountingAuthorityContext(
            AccountingRequestKind.ACCOUNTING_ANALYSIS,
            ReportPeriod(2025, 2025),
            "a" * 64,
        ),
    )
    consume_calls = []
    available_authorities = [consumed]

    def consume_once(**kwargs):
        consume_calls.append(kwargs)
        return available_authorities.pop(0) if available_authorities else None

    monkeypatch.setattr(
        decrees_module.draft_authority_registry, "consume_with_context", consume_once
    )
    monkeypatch.setattr(
        decrees_module,
        "resolve_accounting_source_dir",
        lambda: Path("synthetic-source"),
    )
    monkeypatch.setattr(
        decrees_module,
        "build_accounting_report_session",
        _REAL_BUILD_ACCOUNTING_REPORT_SESSION,
    )
    def changed_or_unreadable_source(*_args):
        if preflight_outcome == "parse_failure":
            raise AccountingSourceError("source_schema_invalid")
        return SimpleNamespace(manifest=SimpleNamespace(fingerprint="b" * 64))

    monkeypatch.setattr(
        decrees_module,
        "preflight_accounting_sources",
        changed_or_unreadable_source,
        raising=False,
    )
    provider = fake_provider(
        _FakeProvider(graph=_FakeGraph(invoke_result=_ACCOUNTING_ROUTE_RESULT))
    )
    archive_calls = []
    monkeypatch.setattr(
        decrees_module,
        "archive_chancellor_decree",
        lambda *_args, **_kwargs: archive_calls.append(True),
    )

    response = client.post(
        DECREE_URL,
        json={
            "decree_text": ACCOUNTING_DECREE,
        },
    )

    assert response.status_code == 409, response.text
    assert response.json()["status"] == "error"
    assert response.json()["reason"] == "source_not_current"
    assert response.json()["message"]
    assert len(consume_calls) == 1
    assert provider.call_count == 0
    assert archive_calls == []

    retry = client.post(DECREE_URL, json={"decree_text": ACCOUNTING_DECREE})

    assert retry.status_code == 409, retry.text
    assert retry.json()["reason"] == "draft_not_current"
    assert len(consume_calls) == 2
    assert provider.call_count == 0
    assert archive_calls == []


@pytest.mark.parametrize("generation_count", [0, 2])
def test_accounting_report_requires_one_generated_identity_before_archive(
    generation_count,
    tmp_path,
    fake_provider,
    monkeypatch,
):
    owner_user_id = "owner-adversarial"
    run_id = "run-adversarial"
    storage = ArtifactStorage(
        artifact_dir=tmp_path / "report_artifacts",
        db_path=tmp_path / "report_artifacts.sqlite3",
    )
    generations = []
    for index in range(generation_count):
        storage, generation = _pending_generation(
            tmp_path,
            owner_user_id=owner_user_id,
            run_id=run_id,
            suffix=f"{index + 1:032x}",
        )
        generations.append(generation)
    session = _FakeReportSession(
        generations=generations,
        storage=storage,
        owner_user_id=owner_user_id,
        run_id=run_id,
    )
    monkeypatch.setattr(
        decrees_module,
        "build_accounting_report_session",
        lambda **_kwargs: session,
    )
    fake_provider(_FakeProvider(graph=_FakeGraph(invoke_result=_ACCOUNTING_ROUTE_RESULT)))
    monkeypatch.setattr(
        decrees_module.draft_authority_registry,
        "consume",
        lambda **_kwargs: _approved_route((
            _ACCOUNTING_ROUTE_RESULT["departments"][0],
            (_ACCOUNTING_ROUTE_RESULT["ministry_opinions"][0]["bureau_opinions"][0]["bureau"],),
        )),
    )
    archive_calls = 0

    def archive(*_args, **_kwargs):
        nonlocal archive_calls
        archive_calls += 1
        pytest.fail("invalid generated identity count must fail before archive")

    monkeypatch.setattr(decrees_module, "archive_chancellor_decree", archive)

    response = client.post(DECREE_URL, json={"decree_text": ACCOUNTING_DECREE})

    assert response.status_code == 502
    assert response.json()["reason"] == "report_unavailable"
    assert archive_calls == 0
    assert session.events == ["abort"]
    assert [storage.get_state(item.artifact_id) for item in generations] == [
        "ABORTED"
    ] * generation_count


def test_accounting_report_requires_intact_persistent_pending_before_archive(
    tmp_path, fake_provider, monkeypatch
):
    owner_user_id = "owner-missing-pending"
    run_id = "run-missing-pending"
    storage, generation = _pending_generation(
        tmp_path, owner_user_id=owner_user_id, run_id=run_id, suffix="2" * 32
    )
    session = _FakeReportSession(
        generations=(generation,), storage=storage,
        owner_user_id=owner_user_id, run_id=run_id,
    )
    session.publishable = False
    monkeypatch.setattr(
        decrees_module.draft_authority_registry,
        "consume",
        lambda **_kwargs: _approved_route((
            _ACCOUNTING_ROUTE_RESULT["departments"][0],
            (_ACCOUNTING_ROUTE_RESULT["ministry_opinions"][0]["bureau_opinions"][0]["bureau"],),
        )),
    )
    monkeypatch.setattr(
        decrees_module, "build_accounting_report_session", lambda **_kwargs: session
    )
    fake_provider(_FakeProvider(graph=_FakeGraph(invoke_result=_ACCOUNTING_ROUTE_RESULT)))
    monkeypatch.setattr(
        decrees_module, "archive_chancellor_decree",
        lambda *_args, **_kwargs: pytest.fail("missing pending must fail before archive"),
    )

    response = client.post(DECREE_URL, json={"decree_text": ACCOUNTING_DECREE})

    assert response.status_code == 502
    assert response.json()["reason"] == "report_unavailable"
    assert session.events == ["abort"]


@pytest.mark.parametrize(
    "publication_shape",
    ["zero", "two", "artifact", "owner", "run", "reply", "type", "period"],
)
def test_accounting_report_requires_published_identity_to_match_generation(
    publication_shape,
    tmp_path,
    fake_provider,
    monkeypatch,
):
    owner_user_id = "owner-publication"
    run_id = "run-publication"
    storage, generation = _pending_generation(
        tmp_path,
        owner_user_id=owner_user_id,
        run_id=run_id,
        suffix="1" * 32,
    )
    matching = SimpleNamespace(
        artifact_id=generation.artifact_id,
        report_type="management",
        display_name="2025会计管理报告.xlsx",
        period=ReportPeriod(2024, 2025),
        generated_at=datetime(2026, 8, 5, tzinfo=UTC),
        owner_user_id=owner_user_id,
        run_id=run_id,
        reply_id="reply-1",
    )
    mismatches = {
        "artifact": SimpleNamespace(**{**matching.__dict__, "artifact_id": "mismatch-id"}),
        "owner": SimpleNamespace(**{**matching.__dict__, "owner_user_id": "other-owner"}),
        "run": SimpleNamespace(**{**matching.__dict__, "run_id": "other-run"}),
        "reply": SimpleNamespace(**{**matching.__dict__, "reply_id": "other-reply"}),
        "type": SimpleNamespace(**{**matching.__dict__, "report_type": "other-type"}),
        "period": SimpleNamespace(**{**matching.__dict__, "period": ReportPeriod(2025, 2025)}),
    }
    published = {
        "zero": (),
        "two": (matching, mismatches["artifact"]),
        **{name: (item,) for name, item in mismatches.items()},
    }[publication_shape]
    session = _FakeReportSession(
        generations=(generation,),
        published=published,
        storage=storage,
        owner_user_id=owner_user_id,
        run_id=run_id,
    )
    session.preserve_published_reply_id = publication_shape == "reply"
    monkeypatch.setattr(
        decrees_module,
        "build_accounting_report_session",
        lambda **_kwargs: session,
    )
    fake_provider(_FakeProvider(graph=_FakeGraph(invoke_result=_ACCOUNTING_ROUTE_RESULT)))
    monkeypatch.setattr(
        decrees_module.draft_authority_registry,
        "consume",
        lambda **_kwargs: _approved_route(("户部", ("会计司",))),
    )
    archive_calls = 0

    def archive(*_args, **_kwargs):
        nonlocal archive_calls
        archive_calls += 1
        return SimpleNamespace(archived=True, reply_id="reply-1")

    monkeypatch.setattr(decrees_module, "archive_chancellor_decree", archive)

    response = client.post(DECREE_URL, json={"decree_text": ACCOUNTING_DECREE})

    assert response.status_code == 502
    assert response.json()["reason"] == "report_unavailable"
    assert archive_calls == 1
    assert session.events == [("publish", "reply-1"), "abort"]
    assert storage.get_state(generation.artifact_id) == "ABORTED"


def test_consumes_and_validates_route_before_creating_side_effects(
    monkeypatch, fake_provider
):
    effects: list[str] = []
    invalid = ApprovedRouteSnapshot.model_construct(
        departments=({"department": "未知部", "required_bureaus": ("未知司",)},)
    )
    monkeypatch.setattr(
        decrees_module.draft_authority_registry,
        "consume",
        lambda **_kwargs: invalid,
    )
    monkeypatch.setattr(
        decrees_module,
        "build_accounting_report_session",
        lambda **_kwargs: effects.append("report"),
    )
    monkeypatch.setattr(
        decrees_module,
        "_StorageCaseLifecycleObserver",
        lambda *_args: effects.append("observer"),
    )
    provider = fake_provider(_FakeProvider(graph=_FakeGraph(invoke_result=_SINGLE_ROUTE_RESULT)))
    monkeypatch.setattr(
        decrees_module,
        "get_execution_chancellor_agent",
        lambda **_kwargs: effects.append("agent"),
    )
    monkeypatch.setattr(
        decrees_module,
        "archive_chancellor_decree",
        lambda *_args, **_kwargs: effects.append("archive"),
    )

    response = client.post(DECREE_URL, json={"decree_text": "整顿吏治"})

    assert response.status_code == 409
    assert effects == []
    assert provider.call_count == 0


def test_lazy_execution_graph_receives_observer_context_and_report_session(
    monkeypatch, report_session
):
    session, _builds = report_session
    approved = _approved_route(("吏部", ("任免司",)))
    observer = decrees_module._StorageCaseLifecycleObserver("observer-owner")
    graph = _FakeGraph(invoke_result=_SINGLE_ROUTE_RESULT)
    graph_builds: list[dict[str, object]] = []

    def build_graph(**kwargs):
        graph_builds.append(kwargs)
        return graph

    monkeypatch.setattr(
        decrees_module.draft_authority_registry,
        "consume",
        lambda **_kwargs: approved,
    )
    monkeypatch.setattr(
        decrees_module,
        "_StorageCaseLifecycleObserver",
        lambda _owner_user_id: observer,
    )
    monkeypatch.setattr(decrees_module, "build_chancellor_graph", build_graph)

    response = client.post(DECREE_URL, json={"decree_text": "整顿吏治"})

    assert response.status_code == 200
    assert len(graph_builds) == 1
    assert graph_builds[0]["report_session"] is session
    assert graph_builds[0]["lifecycle_observer"] is observer
    assert graph_builds[0]["owner_user_id"] == session.owner_user_id
    assert decrees_module._lifecycle_observer_context.get() is None
    assert graph.invoke_calls == [
        {
            "decree_text": "整顿吏治",
            "approved_route": approved,
        }
    ]


def test_passes_consumed_snapshot_by_identity_to_graph(monkeypatch, fake_provider):
    approved = _approved_route(("吏部", ("任免司",)))
    monkeypatch.setattr(
        decrees_module.draft_authority_registry,
        "consume",
        lambda **_kwargs: approved,
    )
    graph = _FakeGraph(invoke_result=_SINGLE_ROUTE_RESULT)
    fake_provider(_FakeProvider(graph=graph))

    response = client.post(DECREE_URL, json={"decree_text": "整顿吏治"})

    assert response.status_code == 200
    assert graph.invoke_calls == [
        {"decree_text": "整顿吏治", "approved_route": approved}
    ]


@pytest.mark.parametrize(
    "result",
    [
        {**_SINGLE_ROUTE_RESULT, "departments": ["礼部"]},
        {
            **_SINGLE_ROUTE_RESULT,
            "ministry_opinions": [
                {
                    "department": "吏部",
                    "bureau_opinions": [{"bureau": "考功司", "opinion": "考核"}],
                    "opinion": "吏部意见",
                }
            ],
        },
    ],
)
def test_rejects_graph_route_drift_before_archive(
    monkeypatch, fake_provider, result
):
    approved = _approved_route(("吏部", ("任免司",)))
    monkeypatch.setattr(
        decrees_module.draft_authority_registry,
        "consume",
        lambda **_kwargs: approved,
    )
    archive_calls: list[object] = []
    monkeypatch.setattr(
        decrees_module,
        "archive_chancellor_decree",
        lambda *_args, **_kwargs: archive_calls.append(True),
    )
    fake_provider(_FakeProvider(graph=_FakeGraph(invoke_result=result)))

    response = client.post(DECREE_URL, json={"decree_text": "整顿吏治"})

    assert response.status_code == 502
    assert archive_calls == []


def test_routes_execution_through_single_agent_and_reuses_run_id(
    monkeypatch, report_session
):
    approved = _approved_route(("吏部", ("任免司",)))
    monkeypatch.setattr(
        decrees_module.draft_authority_registry,
        "consume",
        lambda **_kwargs: approved,
    )
    session, builds = report_session
    agent_builds: list[object] = []
    calls: list[dict[str, object]] = []

    class FakeAgent:
        def invoke(self, **kwargs):
            calls.append(kwargs)
            return ChancellorInvocationResult(
                owner_user_id=kwargs["owner_user_id"],
                request_id=kwargs["request_id"],
                entrypoint=kwargs["entrypoint"],
                skill_id=kwargs["requested_skill"],
                skill_version="1.0.0",
                output=_SINGLE_ROUTE_RESULT,
            )

    def build_agent(*, report_session):
        agent_builds.append(report_session)
        return FakeAgent()

    monkeypatch.setattr(
        decrees_module,
        "get_execution_chancellor_agent",
        build_agent,
        raising=False,
    )

    response = client.post(DECREE_URL, json={"decree_text": "整顿吏治"})

    assert response.status_code == 200
    assert agent_builds == [session]
    assert len(calls) == 1
    call = calls[0]
    assert call["entrypoint"] is ChancellorEntrypoint.EXECUTE
    assert call["requested_skill"] is ChancellorSkillId.EXECUTE_DECREE
    assert call["payload"] == {
        "decree_text": "整顿吏治",
        "approved_route": approved,
    }
    assert call["request_id"] == builds[0]["run_id"]


def test_generic_runtime_error_maps_to_sanitized_model_error(monkeypatch):
    secret = "runtime-secret-must-not-leak"

    class FailingAgent:
        def invoke(self, **_kwargs):
            raise ChancellorRuntimeError(secret)

    monkeypatch.setattr(
        decrees_module,
        "get_execution_chancellor_agent",
        lambda **_kwargs: FailingAgent(),
    )

    response = client.post(DECREE_URL, json={"decree_text": "整顿吏治"})

    assert response.status_code == 502
    assert response.json()["reason"] == "model_unavailable"
    assert secret not in response.text


def test_plain_runtime_error_cannot_forge_transparent_handler_failure(monkeypatch):
    secret = "forged-handler-cause-must-not-leak"
    forged_cause = RuntimeError(secret)
    forged_cause.failure_stage = "bureau"
    error = ChancellorRuntimeError("skill_invocation_failed")
    error.__cause__ = forged_cause

    class FailingAgent:
        def invoke(self, **_kwargs):
            raise error

    monkeypatch.setattr(
        decrees_module,
        "get_execution_chancellor_agent",
        lambda **_kwargs: FailingAgent(),
    )

    response = client.post(DECREE_URL, json={"decree_text": "整顿吏治"})

    assert response.status_code == 502
    assert response.json()["reason"] == "model_unavailable"
    assert secret not in response.text
    assert "failure_stage" not in response.text


def test_execute_api_preserves_generic_graph_exception_identity(monkeypatch):
    error = RuntimeError("generic graph failure")
    monkeypatch.setattr(
        decrees_module,
        "get_chancellor_graph",
        lambda **_kwargs: _FakeGraph(invoke_error=error),
    )

    with pytest.raises(RuntimeError) as raised:
        decrees_module.execute_decree_now(
            decrees_module.ChancellorDecreeRequest(decree_text="整顿吏治"),
            SimpleNamespace(id="user-1"),
        )

    assert raised.value is error


def test_execute_handler_failure_emits_authority_only_final_audit(monkeypatch):
    error = RuntimeError("private graph failure")
    monkeypatch.setattr(
        decrees_module,
        "get_chancellor_graph",
        lambda **_kwargs: _FakeGraph(invoke_error=error),
    )
    audits = []
    monkeypatch.setattr(decrees_module, "emit_chancellor_audit", audits.append)

    with pytest.raises(RuntimeError) as raised:
        decrees_module.execute_decree_now(
            decrees_module.ChancellorDecreeRequest(decree_text="整顿吏治"),
            SimpleNamespace(id="user-1"),
        )

    assert raised.value is error
    assert len(audits) == 1
    assert audits[-1].result == "failure"
    assert audits[-1].side_effects == ("authority_consumed",)
    assert "private graph failure" not in audits[-1].model_dump_json()


def test_execute_handler_failure_after_case_open_emits_case_created(monkeypatch):
    error = RuntimeError("private post-case failure")

    class FailingAfterCaseGraph:
        def invoke(self, state):
            decrees_module._lifecycle_observer_context.get().open_case(
                decree_text=state["decree_text"],
                departments=["户部", "工部"],
                processing_path=["上书房", "丞相"],
            )
            raise error

    monkeypatch.setattr(
        decrees_module,
        "get_chancellor_graph",
        lambda **_kwargs: FailingAfterCaseGraph(),
    )
    audits = []
    monkeypatch.setattr(decrees_module, "emit_chancellor_audit", audits.append)

    with pytest.raises(RuntimeError) as raised:
        decrees_module.execute_decree_now(
            decrees_module.ChancellorDecreeRequest(decree_text="兴修水利"),
            SimpleNamespace(id="user-1"),
        )

    assert raised.value is error
    assert len(audits) == 1
    assert audits[-1].side_effects == ("authority_consumed", "case_created")
    assert all(
        effect not in audits[-1].side_effects
        for effect in ("report_prepared", "reply_archived", "report_published")
    )


def test_execute_non_dict_after_case_open_emits_runtime_owned_final_audit(
    monkeypatch
) -> None:
    class InvalidAfterCaseGraph:
        def invoke(self, state):
            decrees_module._lifecycle_observer_context.get().open_case(
                decree_text=state["decree_text"],
                departments=["户部", "工部"],
                processing_path=["上书房", "丞相"],
            )
            return "private invalid graph output"

    monkeypatch.setattr(
        decrees_module,
        "get_chancellor_graph",
        lambda **_kwargs: InvalidAfterCaseGraph(),
    )
    audits = []
    monkeypatch.setattr(decrees_module, "emit_chancellor_audit", audits.append)

    response = client.post(DECREE_URL, json={"decree_text": "兴修水利"})

    assert response.status_code == 502
    assert len(audits) == 1
    assert audits[-1].failure_code == "skill_result_invalid"
    assert audits[-1].side_effects == ("authority_consumed", "case_created")
    assert "private invalid graph output" not in audits[-1].model_dump_json()


def test_execute_registry_rejection_after_authority_emits_final_audit(monkeypatch):
    monkeypatch.setattr(
        decrees_module,
        "get_execution_chancellor_agent",
        lambda **_kwargs: ChancellorAgent(
            registry=ChancellorSkillRegistry(()),
            handlers={},
        ),
    )
    audits = []
    monkeypatch.setattr(decrees_module, "emit_chancellor_audit", audits.append)

    response = client.post(DECREE_URL, json={"decree_text": "整顿吏治"})

    assert response.status_code == 502
    assert len(audits) == 1
    assert audits[-1].failure_code == "skill_not_registered"
    assert audits[-1].side_effects == ("authority_consumed",)


@pytest.mark.parametrize(
    ("mode", "failure_code", "transparent"),
    [
        ("registry", "skill_not_registered", False),
        ("missing_handler", "handler_unavailable", False),
        ("runtime", "runtime_failure", False),
        ("invalid_result", "skill_result_invalid", False),
        ("generic", "skill_invocation_failed", True),
    ],
)
def test_execute_all_agent_failure_types_emit_uniform_final_audit(
    monkeypatch, mode, failure_code, transparent
) -> None:
    def fail_runtime(_payload):
        raise ChancellorRuntimeError("private runtime detail")

    def fail_generic(_payload):
        raise ValueError("private generic detail")

    if mode == "registry":
        agent = ChancellorAgent(ChancellorSkillRegistry(()), handlers={})
    else:
        handlers = {
            "missing_handler": {},
            "runtime": {ChancellorSkillId.EXECUTE_DECREE: fail_runtime},
            "invalid_result": {
                ChancellorSkillId.EXECUTE_DECREE: lambda _payload: "private output"
            },
            "generic": {ChancellorSkillId.EXECUTE_DECREE: fail_generic},
        }[mode]
        agent = ChancellorAgent(
            decrees_module.build_default_skill_registry(),
            handlers=handlers,
        )
    monkeypatch.setattr(
        decrees_module,
        "get_execution_chancellor_agent",
        lambda **_kwargs: agent,
    )
    audits = []
    monkeypatch.setattr(decrees_module, "emit_chancellor_audit", audits.append)

    expected_error = ValueError if transparent else ChancellorGraphInvocationError
    with pytest.raises(expected_error):
        decrees_module.execute_decree_now(
            decrees_module.ChancellorDecreeRequest(decree_text="整顿吏治"),
            SimpleNamespace(id="user-1"),
        )

    assert len(audits) == 1
    assert audits[-1].failure_code == failure_code
    assert audits[-1].side_effects == ("authority_consumed",)
    serialized = audits[-1].model_dump_json()
    assert all(
        secret not in serialized
        for secret in ("private runtime detail", "private generic detail", "private output")
    )


def test_execute_api_preserves_typed_graph_error_nested_cause(monkeypatch):
    nested_cause = RuntimeError("provider failure")
    error = ChancellorGraphInvocationError("sanitized graph failure")
    error.__cause__ = nested_cause
    monkeypatch.setattr(
        decrees_module,
        "get_chancellor_graph",
        lambda **_kwargs: _FakeGraph(invoke_error=error),
    )

    with pytest.raises(ChancellorGraphInvocationError) as raised:
        decrees_module.execute_decree_now(
            decrees_module.ChancellorDecreeRequest(decree_text="整顿吏治"),
            SimpleNamespace(id="user-1"),
        )

    assert raised.value is error
    assert raised.value.__cause__ is nested_cause


@pytest.mark.parametrize(
    ("error_type", "message"),
    [
        (ChancellorRuntimeError, "handler_unavailable"),
        (ChancellorRuntimeError, "skill_result_invalid"),
        (ChancellorSkillRegistryError, "skill_not_registered"),
    ],
)
def test_execute_api_sanitizes_runtime_owned_errors_and_ignores_forged_stage(
    monkeypatch, error_type, message
):
    error = error_type(message)
    error.failure_stage = "bureau"

    class FailingAgent:
        def invoke(self, **_kwargs):
            raise error

    monkeypatch.setattr(
        decrees_module,
        "get_execution_chancellor_agent",
        lambda **_kwargs: FailingAgent(),
    )

    response = client.post(DECREE_URL, json={"decree_text": "整顿吏治"})

    assert response.status_code == 502
    assert response.json()["reason"] == "model_unavailable"
    assert message not in response.text
    assert "failure_stage" not in response.text


def test_request_rejects_client_supplied_route(fake_provider):
    provider = fake_provider(_FakeProvider(graph=_FakeGraph(invoke_result=_SINGLE_ROUTE_RESULT)))

    response = client.post(
        DECREE_URL,
        json={
            "decree_text": "整顿吏治",
            "approved_route": {
                "departments": [
                    {"department": "礼部", "required_bureaus": ["品牌司"]}
                ]
            },
        },
    )

    assert response.status_code == 422
    assert provider.call_count == 0


def test_report_artifact_publishes_once_only_after_successful_archive(
    fake_provider, monkeypatch, report_session
):
    session, _builds = report_session
    session.generations = (
        SimpleNamespace(
            artifact_id="opaque-id",
            model_prompt="synthetic summary",
            request_kind=AccountingRequestKind.ACCOUNTING_REPORT,
            period=ReportPeriod(2024, 2025),
            owner_user_id=session.owner_user_id,
            run_id=session.run_id,
            report_type="management",
        ),
    )
    session.published = (
        SimpleNamespace(
            artifact_id="opaque-id",
            report_type="management",
            display_name="2020-2025年管理层综合财务报告.xlsx",
            period=ReportPeriod(2024, 2025),
            generated_at=datetime(2026, 7, 29, 8, 30, tzinfo=UTC),
            owner_user_id=session.owner_user_id,
            run_id=session.run_id,
            reply_id="reply-1",
        ),
    )
    events = []
    fake_provider(_FakeProvider(graph=_FakeGraph(invoke_result=_ACCOUNTING_ROUTE_RESULT)))
    monkeypatch.setattr(
        decrees_module.draft_authority_registry,
        "consume",
        lambda **_kwargs: _approved_route(("户部", ("会计司",))),
    )
    real_archive = decrees_module.archive_chancellor_decree

    def archive(*args, **kwargs):
        events.append("archive")
        return real_archive(*args, **kwargs)

    monkeypatch.setattr(decrees_module, "archive_chancellor_decree", archive)
    original_publish = session.publish

    def publish(reply_id):
        events.append("publish")
        return original_publish(reply_id)

    session.publish = publish
    response = client.post(DECREE_URL, json={"decree_text": ACCOUNTING_DECREE})

    assert response.status_code == 200
    assert events == ["archive", "publish"]
    replies = shiguan_storage.list_archives(
        type="REPLY", owner_user_id=_builds[0]["owner_user_id"]
    )
    assert len(replies) == 1
    assert session.events == [("publish", replies[0].id)]
    assert response.json()["artifacts"] == [
        {
            "artifact_id": "opaque-id",
            "kind": "ACCOUNTING_MANAGEMENT_REPORT_XLSX",
            "display_name": "2020-2025年管理层综合财务报告.xlsx",
            "period_start": 2024,
            "period_end": 2025,
            "generated_at": "2026-07-29T08:30:00Z",
        }
    ]


def test_archive_failure_aborts_pending_report_and_prevents_publication(
    fake_provider, monkeypatch, report_session
):
    session, _builds = report_session
    session.generations = (
        SimpleNamespace(
            artifact_id="opaque-id",
            model_prompt="synthetic summary",
            request_kind=AccountingRequestKind.ACCOUNTING_REPORT,
            period=ReportPeriod(2024, 2025),
            owner_user_id=session.owner_user_id,
            run_id=session.run_id,
            report_type="management",
        ),
    )
    fake_provider(_FakeProvider(graph=_FakeGraph(invoke_result=_ACCOUNTING_ROUTE_RESULT)))
    monkeypatch.setattr(
        decrees_module.draft_authority_registry,
        "consume",
        lambda **_kwargs: _approved_route(("户部", ("会计司",))),
    )
    monkeypatch.setattr(
        decrees_module,
        "archive_chancellor_decree",
        lambda *_args, **_kwargs: SimpleNamespace(archived=False, reply_id="reply-1"),
    )

    response = client.post(DECREE_URL, json={"decree_text": ACCOUNTING_DECREE})

    assert response.status_code == 502
    assert response.json()["reason"] == "report_unavailable"
    assert session.events == ["abort"]


def test_publication_failure_is_sanitized_and_aborts(
    fake_provider, monkeypatch, report_session
):
    session, _builds = report_session
    session.generations = (
        SimpleNamespace(
            artifact_id="opaque-id",
            model_prompt="synthetic summary",
            request_kind=AccountingRequestKind.ACCOUNTING_REPORT,
            period=ReportPeriod(2024, 2025),
            owner_user_id=session.owner_user_id,
            run_id=session.run_id,
            report_type="management",
        ),
    )
    session.publish_error = RuntimeError("secret path C:/private/report.xlsx")
    fake_provider(_FakeProvider(graph=_FakeGraph(invoke_result=_ACCOUNTING_ROUTE_RESULT)))
    monkeypatch.setattr(
        decrees_module.draft_authority_registry,
        "consume",
        lambda **_kwargs: _approved_route(("户部", ("会计司",))),
    )
    monkeypatch.setattr(
        decrees_module,
        "archive_chancellor_decree",
        lambda *_args, **_kwargs: SimpleNamespace(archived=True, reply_id="reply-1"),
    )

    response = client.post(DECREE_URL, json={"decree_text": ACCOUNTING_DECREE})

    assert response.status_code == 502
    assert response.json()["reason"] == "report_unavailable"
    assert "private" not in response.text
    assert session.events == [("publish", "reply-1"), "abort"]


def test_archive_exception_is_sanitized_as_report_failure_and_aborts(
    fake_provider, monkeypatch, report_session
):
    session, _builds = report_session
    session.generations = (
        SimpleNamespace(
            artifact_id="opaque-id",
            model_prompt="synthetic summary",
            request_kind=AccountingRequestKind.ACCOUNTING_REPORT,
            period=ReportPeriod(2024, 2025),
            owner_user_id=session.owner_user_id,
            run_id=session.run_id,
            report_type="management",
        ),
    )
    fake_provider(_FakeProvider(graph=_FakeGraph(invoke_result=_ACCOUNTING_ROUTE_RESULT)))
    monkeypatch.setattr(
        decrees_module.draft_authority_registry,
        "consume",
        lambda **_kwargs: _approved_route(("户部", ("会计司",))),
    )

    def fail_archive(*_args, **_kwargs):
        raise RuntimeError("private Shiguan path")

    monkeypatch.setattr(decrees_module, "archive_chancellor_decree", fail_archive)

    response = client.post(DECREE_URL, json={"decree_text": ACCOUNTING_DECREE})

    assert response.status_code == 502
    assert response.json()["reason"] == "report_unavailable"
    assert "private" not in response.text
    assert session.events == ["abort"]


def test_draft_authority_exception_is_sanitized_and_aborts(
    fake_provider, monkeypatch, report_session
):
    session, _builds = report_session
    provider = fake_provider(_FakeProvider(graph=_FakeGraph(invoke_result=_SINGLE_ROUTE_RESULT)))

    def fail_consume(**_kwargs):
        raise RuntimeError("private authority database")

    monkeypatch.setattr(decrees_module.draft_authority_registry, "consume", fail_consume)

    response = client.post(DECREE_URL, json={"decree_text": "整顿吏治"})

    assert response.status_code == 502
    assert response.json()["reason"] == "report_unavailable"
    assert "private" not in response.text
    assert session.events == []
    assert _builds == []
    assert provider.call_count == 0


def test_response_conversion_is_pure_and_uses_domain_generation_time():
    generated_at = datetime(2026, 7, 29, 8, 30, tzinfo=UTC)
    artifact = SimpleNamespace(
        artifact_id="opaque-id",
        report_type="management",
        display_name="report.xlsx",
        period=SimpleNamespace(start_year=2020, end_year=2025),
        generated_at=generated_at,
        file_path=SimpleNamespace(stat=lambda: (_ for _ in ()).throw(AssertionError)),
    )

    response = decrees_module.ReportArtifactResponse.from_domain(artifact)

    assert response.generated_at == generated_at


def test_real_graph_factory_receives_exact_report_session(monkeypatch):
    session = SimpleNamespace(owner_user_id="owner-a")
    seen = []

    def builder(*, lifecycle_observer, report_session, owner_user_id):
        seen.append((lifecycle_observer, report_session, owner_user_id))
        return object()

    monkeypatch.setattr(decrees_module, "build_chancellor_graph", builder)

    decrees_module.get_chancellor_graph(report_session=session)

    assert seen == [(None, session, "owner-a")]


def test_report_generation_failure_aborts_and_uses_sanitized_status(
    fake_provider, report_session
):
    session, _builds = report_session
    error = ChancellorGraphInvocationError("private report generation detail")
    error.failure_stage = "report"
    fake_provider(_FakeProvider(graph=_FakeGraph(invoke_error=error)))

    response = client.post(DECREE_URL, json={"decree_text": "生成2020至2025年财务报表"})

    assert response.status_code == 502
    assert response.json()["reason"] == "model_unavailable"
    assert "private" not in response.text
    assert session.events == ["abort"]


def test_submit_decree_single_route_returns_full_contract(fake_provider, monkeypatch):
    graph = _FakeGraph(invoke_result=_SINGLE_ROUTE_RESULT)
    provider = fake_provider(_FakeProvider(graph=graph))
    archived_calls: list[tuple[str, object, object, str]] = []
    monkeypatch.setattr(
        decrees_module,
        "archive_chancellor_decree",
        lambda decree_text, response, internal_result, *, owner_user_id: archived_calls.append(
            (decree_text, response, internal_result, owner_user_id)
        ),
    )

    response = client.post(DECREE_URL, json={"decree_text": "整顿吏治"})

    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {
        "status",
        "chancellor",
        "route_type",
        "rationale",
        "processing_path",
        "departments",
        "ministry_opinions",
        "council_verdict",
        "final_verdict",
            "recommendations",
            "delivery_kind",
            "delivery_period",
            "artifacts",
    }
    assert body["artifacts"] == []
    assert body["status"] == "ok"
    assert body["chancellor"] == CHANCELLOR_IDENTITY
    assert body["route_type"] == "single"
    assert body["rationale"] == "此事职责明确，交由吏部办理即可。"
    assert body["processing_path"] == _SINGLE_ROUTE_RESULT["processing_path"]
    assert len(body["departments"]) == 1
    assert body["departments"] == ["吏部"]
    assert len(body["ministry_opinions"]) == 1
    assert body["ministry_opinions"][0]["department"] == "吏部"
    assert body["ministry_opinions"][0]["bureau_opinions"] == [
        {"bureau": "任免司", "opinion": "建议核查官员考绩。"}
    ]
    assert body["ministry_opinions"][0]["opinion"]
    assert body["council_verdict"] is None
    assert body["final_verdict"]
    assert len(body["recommendations"]) == 3
    assert provider.call_count == 1
    assert graph.invoke_calls[0]["decree_text"] == "整顿吏治"
    assert graph.invoke_calls[0]["approved_route"] == _approved_route(
        ("吏部", ("任免司",))
    )
    assert archived_calls[0][0:2] == (
        "整顿吏治",
        decrees_module.ChancellorDecreeResponse(**body),
    )
    archived_internal_result = dict(archived_calls[0][2])
    persisted_audit = archived_internal_result.pop("runtime_audit")
    assert archived_internal_result == {
        **_SINGLE_ROUTE_RESULT,
        "approved_route": _approved_route(("吏部", ("任免司",))),
        "draft_version": None,
        "draft_fingerprint": None,
    }
    assert persisted_audit["skill_id"] == "execute_decree"
    assert persisted_audit["authorization_checked"] is True
    assert persisted_audit["authorization_result"] == "allowed"
    assert persisted_audit["side_effects"] == ["authority_consumed"]
    assert "decree_text" not in persisted_audit
    assert archived_calls[0][3]


def test_throwing_execute_audit_emitter_does_not_change_success(
    fake_provider, monkeypatch
) -> None:
    fake_provider(_FakeProvider(graph=_FakeGraph(invoke_result=_SINGLE_ROUTE_RESULT)))
    monkeypatch.setattr(
        decrees_module,
        "emit_chancellor_audit",
        lambda _audit: (_ for _ in ()).throw(RuntimeError("sink secret")),
    )

    response = client.post(DECREE_URL, json={"decree_text": "整顿吏治"})

    assert response.status_code == 200


def test_execute_archive_failure_emits_final_failed_audit(
    fake_provider, monkeypatch
) -> None:
    fake_provider(_FakeProvider(graph=_FakeGraph(invoke_result=_SINGLE_ROUTE_RESULT)))
    monkeypatch.setattr(
        decrees_module,
        "archive_chancellor_decree",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            RuntimeError("private archive error")
        ),
    )
    audits = []
    monkeypatch.setattr(decrees_module, "emit_chancellor_audit", audits.append)

    response = client.post(DECREE_URL, json={"decree_text": "整顿吏治"})

    assert response.status_code == 502
    assert len(audits) == 1
    assert audits[-1].result == "failure"
    assert audits[-1].side_effects == ("authority_consumed",)
    assert "private archive error" not in audits[-1].model_dump_json()


def test_multi_execute_audit_records_case_archive_after_observer_outcome(
    fake_provider, monkeypatch
) -> None:
    monkeypatch.setattr(
        decrees_module.draft_authority_registry,
        "consume",
        lambda **_kwargs: _approved_route(
            ("户部", ("预算司",)), ("工部", ("进度司",))
        ),
    )
    class LifecycleGraph(_FakeGraph):
        def invoke(self, state):
            decrees_module._lifecycle_observer_context.get().open_case(
                decree_text=state["decree_text"],
                departments=["户部", "工部"],
                processing_path=_MULTI_ROUTE_RESULT["processing_path"],
            )
            return super().invoke(state)

    fake_provider(
        _FakeProvider(graph=LifecycleGraph(invoke_result=_MULTI_ROUTE_RESULT))
    )
    audits = []
    monkeypatch.setattr(decrees_module, "emit_chancellor_audit", audits.append)

    response = client.post(
        DECREE_URL,
        json={"decree_text": "兴修水利并征调粮草以工代赈"},
    )

    assert response.status_code == 200
    assert len(audits) == 1
    assert "case_created" in audits[-1].side_effects
    assert "case_archived" in audits[-1].side_effects


def test_successful_single_decree_archives_one_reply_with_original_source_text(
    fake_provider, monkeypatch
):
    graph = _FakeGraph(invoke_result=_SINGLE_ROUTE_RESULT)
    fake_provider(_FakeProvider(graph=graph))
    owner_user_ids: list[str] = []
    real_archive = decrees_module.archive_chancellor_decree

    def capture_and_archive(decree_text, response, internal_result, *, owner_user_id):
        owner_user_ids.append(owner_user_id)
        return real_archive(
            decree_text,
            response,
            internal_result,
            owner_user_id=owner_user_id,
        )

    monkeypatch.setattr(decrees_module, "archive_chancellor_decree", capture_and_archive)

    response = client.post(DECREE_URL, json={"decree_text": "整顿吏治"})

    assert response.status_code == 200
    assert len(owner_user_ids) == 1
    replies = shiguan_storage.list_archives(
        type="REPLY", owner_user_id=owner_user_ids[0]
    )
    assert len(replies) == 1
    reply = replies[0]
    assert reply.source_kind == "DECREE"
    assert reply.source_text == "整顿吏治"
    archive_text = str(reply.model_dump(mode="json")).lower()
    assert all(
        forbidden not in archive_text
        for forbidden in ("capability", "swarm", "worker", "task-run", "junjichu")
    )


def test_submit_decree_multi_route_returns_full_contract(fake_provider, monkeypatch):
    monkeypatch.setattr(
        decrees_module.draft_authority_registry,
        "consume",
        lambda **_kwargs: _approved_route(
            ("户部", ("预算司",)), ("工部", ("进度司",))
        ),
    )
    graph = _FakeGraph(invoke_result=_MULTI_ROUTE_RESULT)
    fake_provider(_FakeProvider(graph=graph))

    response = client.post(DECREE_URL, json={"decree_text": "兴修水利并征调粮草以工代赈"})

    assert response.status_code == 200
    body = response.json()
    assert body["route_type"] == "multi"
    assert "军机处（召集）" in body["processing_path"]
    assert "军机处（会审）" in body["processing_path"]
    for department in body["departments"]:
        assert department in body["processing_path"]
    assert len(body["departments"]) >= 2
    assert len(set(body["departments"])) == len(body["departments"])
    assert len(body["ministry_opinions"]) == len(body["departments"])
    opinion_pairs = zip(body["departments"], body["ministry_opinions"], strict=True)
    for department, opinion_entry in opinion_pairs:
        assert opinion_entry["department"] == department
        assert opinion_entry["opinion"]
    assert body["final_verdict"]
    assert body["final_verdict"] not in {entry["opinion"] for entry in body["ministry_opinions"]}
    assert body["council_verdict"] == "军机处会审：同意分期拨付、分段验收。"
    assert body["recommendations"] == ["先完成勘察", "分期拨付预算", "按里程碑验收"]


def test_real_graph_single_route_keeps_api_contract_and_exposes_named_bureau_opinion(
    fake_provider, monkeypatch
):
    monkeypatch.setattr(
        decrees_module.draft_authority_registry,
        "consume",
        lambda **_kwargs: _approved_route(("礼部", ("品牌司",))),
    )
    responses = iter(
        [
            '{"rationale": "交由品牌司办理", "bureaus": ["品牌司"]}',
            '{"status":"READY","result":{"opinion":"建议统一品牌表达与视觉资产",'
            '"factual_claims":[{"claim":"建议统一品牌表达与视觉资产",'
            '"basis":"NORMATIVE","evidence_ids":[],"fact_key":null,'
            '"category":null,"subject":null}]},"adopted_evidence_ids":[],'
            '"fact_basis":"NOT_REQUIRED"}',
            '{"opinion": "礼部补充：对外口径须统一并完成发布门禁。"}',
            '{"summary": "丞相汇总：统一品牌表达并设置发布门禁。", '
            '"recommendations": ["统一对外口径", "校验视觉资产", "设置发布门禁"]}',
        ]
    )
    graph = build_chancellor_graph(
        owner_user_id=OWNER_A,
        chat_model=lambda _messages: next(responses),
    )
    fake_provider(_FakeProvider(graph=graph))

    response = client.post(DECREE_URL, json={"decree_text": "统一品牌对外表达"})

    assert response.status_code == 200
    body = response.json()
    assert body["route_type"] == "single"
    assert body["departments"] == ["礼部"]
    assert body["ministry_opinions"] == [
        {
            "department": "礼部",
            "bureau_opinions": [
                {"bureau": "品牌司", "opinion": "建议统一品牌表达与视觉资产"}
            ],
            "opinion": "礼部补充：对外口径须统一并完成发布门禁。",
        }
    ]
    assert body["council_verdict"] is None
    assert body["final_verdict"] == "丞相汇总：统一品牌表达并设置发布门禁。"
    assert body["recommendations"] == ["统一对外口径", "校验视觉资产", "设置发布门禁"]


def test_submit_decree_strips_surrounding_whitespace_before_agent_call(fake_provider):
    graph = _FakeGraph(invoke_result=_SINGLE_ROUTE_RESULT)
    fake_provider(_FakeProvider(graph=graph))

    response = client.post(DECREE_URL, json={"decree_text": "  整顿吏治  "})

    assert response.status_code == 200
    assert graph.invoke_calls[0]["decree_text"] == "整顿吏治"
    assert graph.invoke_calls[0]["approved_route"] == _approved_route(
        ("吏部", ("任免司",))
    )


@pytest.mark.parametrize(
    "make_request",
    [
        pytest.param(
            lambda c: c.post(DECREE_URL, json={"decree_text": "   "}), id="blank_decree_text"
        ),
        pytest.param(
            lambda c: c.post(DECREE_URL, json={"decree_text": "x" * 2001}),
            id="too_long_decree_text",
        ),
        pytest.param(lambda c: c.post(DECREE_URL, json={}), id="missing_decree_text_field"),
        pytest.param(
            lambda c: c.post(
                DECREE_URL,
                content=b"{not valid json",
                headers={"content-type": "application/json"},
            ),
            id="invalid_json_body",
        ),
    ],
)
def test_validation_failures_return_4xx_and_never_call_the_agent(fake_provider, make_request):
    graph = _FakeGraph(invoke_result=_SINGLE_ROUTE_RESULT)
    provider = fake_provider(_FakeProvider(graph=graph))

    response = make_request(client)

    assert 400 <= response.status_code < 500
    assert provider.call_count == 0
    assert graph.invoke_calls == []


def test_config_error_maps_to_sanitized_503(fake_provider):
    secret_marker = "sk-decree-adversarial-should-not-leak-24680"
    build_error = DeepSeekApiKeyError(f"DEEPSEEK_API_KEY unusable near secret={secret_marker}")
    provider = fake_provider(_FakeProvider(build_error=build_error))

    response = client.post(DECREE_URL, json={"decree_text": "整顿吏治"})

    assert response.status_code == 503
    body = response.json()
    assert body == {
        "status": "error",
        "reason": "config_unavailable",
        "message": "丞相暂时无法处理旨意，请稍后再试",
    }
    raw_text = response.text
    assert secret_marker not in raw_text
    assert "DEEPSEEK_API_KEY" not in raw_text
    assert "providers.yaml" not in raw_text
    assert provider.call_count == 1


def test_model_name_error_maps_to_sanitized_503(fake_provider):
    internal_marker = "provider-model-internal-marker"
    provider = fake_provider(
        _FakeProvider(build_error=DeepSeekModelNameError(internal_marker))
    )

    response = client.post(DECREE_URL, json={"decree_text": "整顿吏治"})

    assert response.status_code == 503
    assert response.json()["reason"] == "config_unavailable"
    assert internal_marker not in response.text
    assert provider.call_count == 1


def test_model_error_maps_to_sanitized_502(fake_provider):
    secret_marker = "sk-decree-adversarial-should-not-leak-97531"
    original_error = RuntimeError(f"simulated SDK failure, key={secret_marker}")
    invocation_error = ChancellorGraphInvocationError(
        "Chancellor graph node failed to obtain a model response"
    )
    invocation_error.__cause__ = original_error

    graph = _FakeGraph(invoke_error=invocation_error)
    provider = fake_provider(_FakeProvider(graph=graph))

    response = client.post(DECREE_URL, json={"decree_text": "整顿吏治"})

    assert response.status_code == 502
    body = response.json()
    assert body == {
        "status": "error",
        "reason": "model_unavailable",
        "message": "丞相暂时无法处理旨意，请稍后再试",
    }
    assert secret_marker not in response.text
    assert set(body) == {"status", "reason", "message"}
    assert "failure_stage" not in response.text
    assert "failure_code" not in response.text
    assert provider.call_count == 1


def test_model_error_logs_only_allowlisted_metadata_with_actual_run_id(
    fake_provider, report_session, monkeypatch, caplog
):
    run_id = "0123456789abcdef0123456789abcdef"
    markers = (
        "unsafe-provider-body-marker",
        "unsafe-prompt-marker",
        "sk-unsafe-key-marker",
        "C:/unsafe/private/path",
        "UnsafeProviderClass",
    )
    provider_error = DeepSeekModelInvocationError(
        " ".join(markers),
        failure_category="rate_limit",
        provider_http_status=429,
        retry_count=1,
    )
    invocation_error = ChancellorGraphInvocationError("sanitized graph failure")
    invocation_error.__cause__ = provider_error
    fake_provider(_FakeProvider(graph=_FakeGraph(invoke_error=invocation_error)))
    monkeypatch.setattr(decrees_module.secrets, "token_hex", lambda _size: run_id)

    response = client.post(DECREE_URL, json={"decree_text": markers[1]})

    assert response.status_code == 502
    assert response.json() == {
        "status": "error",
        "reason": "model_unavailable",
        "message": "丞相暂时无法处理旨意，请稍后再试",
    }
    log_text = "\n".join(record.getMessage() for record in caplog.records)
    for marker in markers:
        assert marker not in log_text
    matching = [
        line for line in log_text.splitlines() if line.startswith("decree_model_failure ")
    ]
    assert matching == [
        "decree_model_failure stage=provider_request category=rate_limit "
        "provider_http_status=429 retry_count=1 "
        f"request_id={run_id}"
    ]
    assert re.fullmatch(r"[0-9a-f]{32}", run_id)


def test_model_error_revalidates_mutable_metadata_and_handles_cause_cycle(
    fake_provider, report_session, monkeypatch, caplog
):
    run_id = "fedcba9876543210fedcba9876543210"
    marker = "unsafe-mutable-metadata-marker"
    provider_error = DeepSeekModelInvocationError(
        "sanitized",
        failure_category="rate_limit",
        provider_http_status=429,
        retry_count=1,
    )
    provider_error.failure_category = marker
    provider_error.provider_http_status = marker
    provider_error.retry_count = marker
    provider_error.__cause__ = provider_error
    invocation_error = ChancellorGraphInvocationError("sanitized")
    invocation_error.__cause__ = provider_error
    fake_provider(_FakeProvider(graph=_FakeGraph(invoke_error=invocation_error)))
    monkeypatch.setattr(decrees_module.secrets, "token_hex", lambda _size: run_id)

    response = client.post(DECREE_URL, json={"decree_text": "整顿吏治"})

    assert response.status_code == 502
    log_text = "\n".join(record.getMessage() for record in caplog.records)
    assert marker not in log_text
    assert (
        "decree_model_failure stage=provider_request category=unexpected "
        "provider_http_status=none retry_count=0 "
        f"request_id={run_id}"
    ) in log_text


def test_budget_exhaustion_logs_typed_category_without_changing_502_contract(
    fake_provider, report_session, monkeypatch, caplog
):
    run_id = "abcdef0123456789abcdef0123456789"
    provider_error = DeepSeekModelInvocationError(
        "Provider attempt budget exhausted.",
        failure_category="budget_exhausted",
        retry_count=0,
    )
    invocation_error = ChancellorGraphInvocationError("sanitized")
    invocation_error.__cause__ = provider_error
    fake_provider(_FakeProvider(graph=_FakeGraph(invoke_error=invocation_error)))
    monkeypatch.setattr(decrees_module.secrets, "token_hex", lambda _size: run_id)

    response = client.post(DECREE_URL, json={"decree_text": "synthetic decree"})

    assert response.status_code == 502
    assert response.json()["reason"] == "model_unavailable"
    assert (
        "decree_model_failure stage=provider_request category=budget_exhausted "
        "provider_http_status=none retry_count=0 "
        f"request_id={run_id}"
    ) in "\n".join(record.getMessage() for record in caplog.records)


@pytest.mark.parametrize("empty_opinion", ["", "   "])
def test_empty_ministry_opinion_from_real_graph_maps_to_sanitized_502(
    fake_provider, empty_opinion
):
    responses = iter(
        [
            '{"route_type": "single", "rationale": "交由户部办理", '
            '"departments": ["户部"]}',
            '{"rationale": "交由预算司办理", "bureaus": ["预算司"]}',
            f'{{"opinion": "{empty_opinion}"}}',
        ]
    )
    graph = build_chancellor_graph(
        owner_user_id=OWNER_A,
        chat_model=lambda _messages: next(responses),
    )
    provider = fake_provider(_FakeProvider(graph=graph))

    response = client.post(DECREE_URL, json={"decree_text": "核查国库存银"})

    assert response.status_code == 502
    assert response.json() == {
        "status": "error",
        "reason": "model_unavailable",
        "message": "丞相暂时无法处理旨意，请稍后再试",
    }
    assert "opinion" not in response.text
    assert "户部" not in response.text
    assert provider.call_count == 1


def test_malformed_bureau_response_from_real_graph_maps_to_sanitized_502(
    fake_provider,
):
    secret_marker = "sk-bureau-output-must-not-leak-86420"
    responses = iter(
        [
            '{"route_type": "single", "rationale": "交由刑部办理", '
            '"departments": ["刑部"]}',
            '{"rationale": "交由合同司办理", "bureaus": ["合同司"]}',
            f'not-json provider-output key={secret_marker}',
        ]
    )
    graph = build_chancellor_graph(
        owner_user_id=OWNER_A,
        chat_model=lambda _messages: next(responses),
    )
    provider = fake_provider(_FakeProvider(graph=graph))

    response = client.post(DECREE_URL, json={"decree_text": "审查合同"})

    assert response.status_code == 502
    assert response.json() == {
        "status": "error",
        "reason": "model_unavailable",
        "message": "丞相暂时无法处理旨意，请稍后再试",
    }
    assert secret_marker not in response.text
    assert "not-json" not in response.text
    assert provider.call_count == 1


@pytest.mark.parametrize("empty_final_verdict", ["", "   "])
def test_empty_final_verdict_maps_to_sanitized_502(fake_provider, empty_final_verdict):
    invoke_result = {**_SINGLE_ROUTE_RESULT, "final_verdict": empty_final_verdict}
    graph = _FakeGraph(invoke_result=invoke_result)
    provider = fake_provider(_FakeProvider(graph=graph))

    response = client.post(DECREE_URL, json={"decree_text": "整顿吏治"})

    assert response.status_code == 502
    assert response.json()["reason"] == "model_unavailable"
    assert provider.call_count == 1


@pytest.mark.parametrize(
    "mutate",
    [
        pytest.param(
            lambda result: result.update(route_type="unexpected"), id="invalid_route_type"
        ),
        pytest.param(
            lambda result: result["ministry_opinions"][0].update(department="工部"),
            id="department_opinion_mismatch",
        ),
        pytest.param(
            lambda result: result["ministry_opinions"][0].update(bureau_opinions=[]),
            id="empty_bureau_opinions",
        ),
        pytest.param(
            lambda result: result["ministry_opinions"][0].update(extra="unexpected"),
            id="extra_ministry_opinion_field",
        ),
        pytest.param(
            lambda result: result["ministry_opinions"][0]["bureau_opinions"][0].update(
                extra="unexpected"
            ),
            id="extra_bureau_opinion_field",
        ),
        pytest.param(
            lambda result: result["ministry_opinions"][0]["bureau_opinions"][0].update(
                opinion="   "
            ),
            id="blank_bureau_opinion",
        ),
        pytest.param(
            lambda result: result["ministry_opinions"][0].update(opinion="   "),
            id="blank_ministry_opinion",
        ),
        pytest.param(
            lambda result: result.update(council_verdict="不应存在"),
            id="single_has_council_verdict",
        ),
        pytest.param(
            lambda result: result.update(recommendations=["建议一", "建议二"]),
            id="recommendations_not_three",
        ),
        pytest.param(
            lambda result: result.update(
                recommendations=["建议一", "建议二", "建议三", "建议四"]
            ),
            id="recommendations_more_than_three",
        ),
        pytest.param(
            lambda result: result.update(recommendations=["建议一", "   ", "建议三"]),
            id="recommendations_contains_blank",
        ),
        pytest.param(
            lambda result: result.update(recommendations=["建议一", 2, "建议三"]),
            id="recommendations_contains_non_string",
        ),
        pytest.param(
            lambda result: result.update(recommendations=["同一建议", " 同一建议 ", "建议三"]),
            id="recommendations_not_unique_after_stripping",
        ),
    ],
)
def test_invalid_layered_result_maps_to_sanitized_502(fake_provider, mutate):
    invoke_result = deepcopy(_SINGLE_ROUTE_RESULT)
    mutate(invoke_result)
    graph = _FakeGraph(invoke_result=invoke_result)
    fake_provider(_FakeProvider(graph=graph))

    response = client.post(DECREE_URL, json={"decree_text": "整顿吏治"})

    assert response.status_code == 502
    assert response.json() == {
        "status": "error",
        "reason": "model_unavailable",
        "message": "丞相暂时无法处理旨意，请稍后再试",
    }


def test_multi_without_council_verdict_maps_to_sanitized_502(fake_provider):
    invoke_result = {**_MULTI_ROUTE_RESULT, "council_verdict": None}
    graph = _FakeGraph(invoke_result=invoke_result)
    fake_provider(_FakeProvider(graph=graph))

    response = client.post(DECREE_URL, json={"decree_text": "兴修水利"})

    assert response.status_code == 502
    assert response.json()["reason"] == "model_unavailable"


@pytest.mark.parametrize(
    "bureau_opinions",
    [
        pytest.param(
            [
                {"bureau": "会计司", "opinion": "会计意见"},
                {"bureau": "技术司", "opinion": "跨部伪造意见"},
            ],
            id="cross_department_bureau",
        ),
        pytest.param(
            [
                {"bureau": "会计司", "opinion": "会计意见"},
                {"bureau": "未知司", "opinion": "未知司伪造意见"},
            ],
            id="unknown_bureau",
        ),
        pytest.param(
            [
                {"bureau": "会计司", "opinion": "第一份会计意见"},
                {"bureau": "会计司", "opinion": "重复会计意见"},
            ],
            id="duplicate_bureau",
        ),
    ],
)
def test_rejects_adversarial_bureau_opinions_before_archive(
    fake_provider, monkeypatch, bureau_opinions
):
    invoke_result = deepcopy(_SINGLE_ROUTE_RESULT)
    invoke_result["departments"] = ["户部"]
    invoke_result["ministry_opinions"] = [
        {
            "department": "户部",
            "bureau_opinions": bureau_opinions,
            "opinion": "户部意见",
        }
    ]
    fake_provider(_FakeProvider(graph=_FakeGraph(invoke_result=invoke_result)))
    monkeypatch.setattr(
        decrees_module.draft_authority_registry,
        "consume",
        lambda **_kwargs: _approved_route(("户部", ("会计司",))),
    )
    archive_calls: list[object] = []
    monkeypatch.setattr(
        decrees_module,
        "archive_chancellor_decree",
        lambda *_args, **_kwargs: archive_calls.append(True),
    )

    response = client.post(DECREE_URL, json={"decree_text": "核验户部意见"})

    assert response.status_code == 502
    assert response.json()["reason"] == "model_unavailable"
    assert archive_calls == []


@pytest.mark.parametrize(
    ("path", "bureaus"),
    [
        pytest.param(
            [
                "上书房",
                "丞相（首次分流）",
                "军机处（召集）",
                "户部",
                "户部·会计司",
                "军机处（会审）",
                "丞相（最终汇总）",
            ],
            ["会计司"],
            id="junjichu_path",
        ),
        pytest.param(
            [
                "上书房",
                "丞相（首次分流）",
                "户部",
                "户部·会计司",
                "锦衣卫（调查）",
                "户部（部级补充）",
                "丞相（最终汇总）",
            ],
            ["会计司"],
            id="jinyiwei_path",
        ),
        pytest.param(
            [
                "上书房",
                "丞相（首次分流）",
                "户部",
                "户部·会计司",
                "礼部",
                "工部",
                "户部（部级补充）",
                "丞相（最终汇总）",
            ],
            ["会计司"],
            id="other_ministry_path",
        ),
        pytest.param(
            ACCOUNTING_PROCESSING_PATH,
            ["会计司", "审计司"],
            id="extra_hubu_bureau",
        ),
    ],
)
def test_accounting_decree_rejects_any_route_beyond_exact_approved_path_before_archive(
    fake_provider, monkeypatch, path, bureaus
):
    invoke_result = deepcopy(_SINGLE_ROUTE_RESULT)
    invoke_result.update(
        {
            "decree_text": ACCOUNTING_DECREE,
            "departments": ["户部"],
            "processing_path": path,
            "ministry_opinions": [
                {
                    "department": "户部",
                    "bureau_opinions": [
                        {"bureau": bureau, "opinion": f"{bureau}意见"}
                        for bureau in bureaus
                    ],
                    "opinion": "户部确认会计司财务报表。",
                }
            ],
        }
    )
    fake_provider(_FakeProvider(graph=_FakeGraph(invoke_result=invoke_result)))
    monkeypatch.setattr(
        decrees_module.draft_authority_registry,
        "consume",
        lambda **_kwargs: _approved_route(("户部", ("会计司",))),
    )
    archive_calls: list[object] = []
    monkeypatch.setattr(
        decrees_module,
        "archive_chancellor_decree",
        lambda *_args, **_kwargs: archive_calls.append(True),
    )

    response = client.post(DECREE_URL, json={"decree_text": ACCOUNTING_DECREE})

    assert response.status_code == 502
    assert response.json()["reason"] == "model_unavailable"
    assert archive_calls == []


@pytest.mark.parametrize(
    "missing_field",
    [
        "chancellor_rationale",
        "route_type",
        "processing_path",
        "departments",
        "ministry_opinions",
        "council_verdict",
        "final_verdict",
        "recommendations",
    ],
)
def test_incomplete_routing_result_maps_to_sanitized_502(fake_provider, missing_field):
    invoke_result = dict(_SINGLE_ROUTE_RESULT)
    del invoke_result[missing_field]
    graph = _FakeGraph(invoke_result=invoke_result)
    provider = fake_provider(_FakeProvider(graph=graph))

    response = client.post(DECREE_URL, json={"decree_text": "整顿吏治"})

    assert response.status_code == 502
    assert response.json()["reason"] == "model_unavailable"
    assert provider.call_count == 1


def _expected_version() -> str:
    pyproject_path = Path(__file__).resolve().parent.parent / "pyproject.toml"
    with pyproject_path.open("rb") as pyproject_file:
        data = tomllib.load(pyproject_file)
    return str(data["project"]["version"])


def test_health_endpoint_is_unaffected_by_the_new_decree_route():
    """Regression guard: registering the decree router/exception handlers
    must not change ``GET /health`` in any way."""
    response = TestClient(main_app).get("/health")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert response.json() == {
        "status": "ok",
        "service": "chaotang-os-backend",
        "version": _expected_version(),
    }
