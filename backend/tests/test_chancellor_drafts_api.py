from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

import app.api.chancellor_drafts as draft_api
from app.agents.chancellor_draft.authority import draft_authority_registry
from app.agents.chancellor_draft.routing import (
    ApprovedDepartmentRoute,
    ApprovedRouteSnapshot,
)
from app.agents.chancellor_runtime import (
    ChancellorAgent,
    ChancellorEntrypoint,
    ChancellorRuntimeError,
    ChancellorSkillId,
    ChancellorSkillRegistry,
)
from app.auth import configure_auth_db, create_session, create_user
from app.main import app

client = TestClient(app)
URL = "/api/v1/chancellor-drafts"


class _FakeGraph:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    def invoke(self, state: dict) -> dict:
        self.calls.append(state)
        return {
            "response": {
                "status": "CLARIFYING",
                "version": state["version"],
                "fingerprint": "a" * 64,
                "understanding": "用户希望把想法整理成任务。",
                "expert_example": "请先明确目标、范围、风险和交付物。",
                "recommendation_reason": "完整案例更容易修改。",
                "assumptions": [],
                "revision_prompt": "请直接按案例说明不同之处。",
                "draft": None,
            }
        }


class _FakeChancellorAgent:
    def __init__(self, output: dict[str, object]) -> None:
        self.output = output
        self.calls: list[dict[str, object]] = []

    def invoke(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(output=self.output)


def test_authenticated_draft_routes_through_single_chancellor_agent(
    monkeypatch, tmp_path
) -> None:
    configure_auth_db(tmp_path / "auth.sqlite3")
    user = create_user("runtime-draft-user", "runtime-draft@example.com", "six-or-more")
    graph = _FakeGraph()
    agent = _FakeChancellorAgent(graph.invoke({"messages": [], "version": 3}))
    monkeypatch.setattr(draft_api, "get_chancellor_agent", lambda: agent)
    try:
        response = client.post(
            URL,
            headers={"Authorization": f"Bearer {create_session(user.id)}"},
            json={
                "messages": [{"role": "user", "content": "  draft request  "}],
                "version": 3,
            },
        )
    finally:
        configure_auth_db(None)

    assert response.status_code == 200
    assert len(agent.calls) == 1
    call = agent.calls[0]
    assert call["entrypoint"] is ChancellorEntrypoint.DRAFT
    assert call["requested_skill"] is ChancellorSkillId.DRAFT_DECREE
    assert call["owner_user_id"] == user.id
    assert call["payload"] == {
        "messages": [{"role": "user", "content": "draft request"}],
        "version": 3,
    }
    assert isinstance(call["request_id"], str)
    assert len(call["request_id"]) == 32


def test_invalid_draft_request_never_constructs_chancellor_agent(
    monkeypatch, tmp_path
) -> None:
    configure_auth_db(tmp_path / "auth.sqlite3")
    user = create_user("invalid-draft", "invalid-draft@example.com", "six-or-more")
    call_count = 0

    def provider():
        nonlocal call_count
        call_count += 1
        return _FakeChancellorAgent({})

    monkeypatch.setattr(draft_api, "get_chancellor_agent", provider)
    try:
        response = client.post(
            URL,
            headers={"Authorization": f"Bearer {create_session(user.id)}"},
            json={"messages": [], "version": 1},
        )
    finally:
        configure_auth_db(None)

    assert response.status_code == 422
    assert call_count == 0


def test_authenticated_user_can_request_draft(monkeypatch, tmp_path) -> None:
    configure_auth_db(tmp_path / "auth.sqlite3")
    user = create_user("draft-user", "draft@example.com", "six-or-more")
    graph = _FakeGraph()
    monkeypatch.setattr(draft_api, "get_chancellor_draft_graph", lambda: graph)
    draft_authority_registry.register(
        owner_user_id=user.id,
        version=1,
        fingerprint="e" * 64,
        decree_text="旧草案",
        route_snapshot=ApprovedRouteSnapshot(
            departments=(
                ApprovedDepartmentRoute(
                    department="户部",
                    required_bureaus=("会计司",),
                ),
            )
        ),
    )
    try:
        response = client.post(
            URL,
            headers={"Authorization": f"Bearer {create_session(user.id)}"},
            json={
                "messages": [{"role": "user", "content": "  我想赚钱  "}],
                "version": 2,
            },
        )
    finally:
        configure_auth_db(None)

    assert response.status_code == 200
    assert response.json()["version"] == 2
    assert graph.calls == [
        {
            "messages": [{"role": "user", "content": "我想赚钱"}],
            "version": 2,
        }
    ]
    assert draft_authority_registry.consume(
        owner_user_id=user.id,
        version=1,
        fingerprint="e" * 64,
        decree_text="旧草案",
    ) is None


def test_unauthenticated_request_never_builds_graph(monkeypatch) -> None:
    calls = 0

    def provider():
        nonlocal calls
        calls += 1
        return _FakeGraph()

    monkeypatch.setattr(draft_api, "get_chancellor_draft_graph", provider)
    response = client.post(
        URL,
        json={"messages": [{"role": "user", "content": "拟旨"}], "version": 1},
    )

    assert response.status_code == 401
    assert calls == 0


def test_ready_response_registers_one_time_issue_authority(monkeypatch, tmp_path) -> None:
    audits: list[dict[str, object]] = []
    monkeypatch.setattr(
        draft_api,
        "emit_chancellor_audit",
        lambda audit: audits.append(audit.model_dump(mode="json")),
    )
    configure_auth_db(tmp_path / "auth.sqlite3")
    user = create_user("ready-user", "ready@example.com", "six-or-more")
    graph = _FakeGraph()
    graph.invoke = lambda state: {
        "response": {
            "status": "DRAFT_READY",
            "version": state["version"],
            "fingerprint": "d" * 64,
            "understanding": "理解",
            "expert_example": "请户部核查合同付款风险并交付风险清单。",
            "recommendation_reason": "理由",
            "assumptions": [],
            "revision_prompt": "可直接下旨",
            "draft": {
                "objective": "目标",
                "scope": ["范围"],
                "exclusions": [],
                "input_materials": [],
                "material_gaps": [],
                "key_questions": ["问题"],
                "departments": [{
                    "department": "户部", "bureaus": ["会计司"],
                    "role": "主审", "reason": "原因",
                    "responsibility": "职责", "expected_output": "产出",
                }],
                "execution_steps": ["步骤"],
                "deliverables": ["交付"],
                "completion_criteria": ["标准"],
                "permissions_and_limits": ["限制"],
                "current_status": "DRAFT_READY",
            },
            "decree_text": "请户部核查合同付款风险并交付风险清单。",
        }
    }
    monkeypatch.setattr(draft_api, "get_chancellor_draft_graph", lambda: graph)
    try:
        response = client.post(
            URL,
            headers={"Authorization": f"Bearer {create_session(user.id)}"},
            json={"messages": [{"role": "user", "content": "拟旨"}], "version": 4},
        )
        assert response.status_code == 200
        assert len(audits) == 1
        snapshot = draft_authority_registry.consume(
            owner_user_id=user.id,
            version=4,
            fingerprint="d" * 64,
            decree_text="请户部核查合同付款风险并交付风险清单。",
        )
        assert snapshot is not None
        assert audits[0]["side_effects"] == ["authority_registered"]
        assert snapshot.departments[0].department == "户部"
        assert snapshot.departments[0].required_bureaus == ("会计司",)
    finally:
        configure_auth_db(None)


def test_clarifying_draft_emits_authority_revoked_audit(monkeypatch, tmp_path) -> None:
    configure_auth_db(tmp_path / "auth.sqlite3")
    user = create_user("audit-draft", "audit-draft@example.com", "six-or-more")
    draft_authority_registry.register(
        owner_user_id=user.id,
        version=99,
        fingerprint="9" * 64,
        decree_text="old decree",
        route_snapshot=ApprovedRouteSnapshot(
            departments=(
                ApprovedDepartmentRoute(
                    department="户部",
                    required_bureaus=("会计司",),
                ),
            )
        ),
    )
    graph = _FakeGraph()
    monkeypatch.setattr(draft_api, "get_chancellor_draft_graph", lambda: graph)
    audits: list[dict[str, object]] = []
    monkeypatch.setattr(
        draft_api,
        "emit_chancellor_audit",
        lambda audit: audits.append(audit.model_dump(mode="json")),
    )
    try:
        response = client.post(
            URL,
            headers={"Authorization": f"Bearer {create_session(user.id)}"},
            json={"messages": [{"role": "user", "content": "secret prompt"}]},
        )
    finally:
        configure_auth_db(None)

    assert response.status_code == 200
    assert len(audits) == 1
    assert audits[0]["side_effects"] == ["authority_revoked"]
    assert "secret prompt" not in str(audits[0])


def test_revoke_reports_only_actual_authority_removal() -> None:
    owner = "revoke-audit-owner"
    draft_authority_registry.revoke(owner_user_id=owner)

    assert draft_authority_registry.revoke(owner_user_id=owner) is False


def test_throwing_draft_audit_emitter_does_not_change_success(
    monkeypatch, tmp_path
) -> None:
    configure_auth_db(tmp_path / "auth.sqlite3")
    user = create_user("sink-draft", "sink-draft@example.com", "six-or-more")
    monkeypatch.setattr(draft_api, "get_chancellor_draft_graph", _FakeGraph)
    monkeypatch.setattr(
        draft_api,
        "emit_chancellor_audit",
        lambda _audit: (_ for _ in ()).throw(RuntimeError("sink secret")),
    )
    try:
        response = client.post(
            URL,
            headers={"Authorization": f"Bearer {create_session(user.id)}"},
            json={"messages": [{"role": "user", "content": "draft"}]},
        )
    finally:
        configure_auth_db(None)

    assert response.status_code == 200


def test_draft_postprocessing_failure_emits_final_failed_audit(
    monkeypatch, tmp_path
) -> None:
    configure_auth_db(tmp_path / "auth.sqlite3")
    user = create_user("bad-draft", "bad-draft@example.com", "six-or-more")
    monkeypatch.setattr(
        draft_api,
        "get_chancellor_draft_graph",
        lambda: SimpleNamespace(invoke=lambda _state: {"response": {"secret": "raw"}}),
    )
    audits = []
    monkeypatch.setattr(draft_api, "emit_chancellor_audit", audits.append)
    try:
        response = client.post(
            URL,
            headers={"Authorization": f"Bearer {create_session(user.id)}"},
            json={"messages": [{"role": "user", "content": "draft"}]},
        )
    finally:
        configure_auth_db(None)

    assert response.status_code == 502
    assert len(audits) == 1
    assert audits[0].result == "failure"
    assert "raw" not in audits[0].model_dump_json()


@pytest.mark.parametrize(
    ("mode", "failure_code"),
    [
        ("registry", "skill_not_registered"),
        ("missing", "handler_unavailable"),
        ("runtime", "runtime_failure"),
        ("invalid", "skill_result_invalid"),
        ("generic", "skill_invocation_failed"),
    ],
)
def test_draft_runtime_failures_reemit_safe_final_audit(
    monkeypatch, tmp_path, mode, failure_code
) -> None:
    configure_auth_db(tmp_path / "auth.sqlite3")
    user = create_user("registry-draft", "registry-draft@example.com", "six-or-more")
    def runtime_failure(_payload):
        raise ChancellorRuntimeError("private runtime detail")

    def generic_failure(_payload):
        raise ValueError("private generic detail")

    registry = (
        ChancellorSkillRegistry(())
        if mode == "registry"
        else draft_api.build_default_skill_registry()
    )
    handlers = {
        "registry": {},
        "missing": {},
        "runtime": {ChancellorSkillId.DRAFT_DECREE: runtime_failure},
        "invalid": {
            ChancellorSkillId.DRAFT_DECREE: lambda _payload: "private output"
        },
        "generic": {ChancellorSkillId.DRAFT_DECREE: generic_failure},
    }[mode]
    monkeypatch.setattr(
        draft_api,
        "get_chancellor_agent",
        lambda: ChancellorAgent(registry, handlers=handlers),
    )
    audits = []
    monkeypatch.setattr(draft_api, "emit_chancellor_audit", audits.append)
    try:
        response = client.post(
            URL,
            headers={"Authorization": f"Bearer {create_session(user.id)}"},
            json={"messages": [{"role": "user", "content": "private draft"}]},
        )
    finally:
        configure_auth_db(None)

    assert response.status_code == 502
    assert len(audits) == 1
    assert audits[-1].failure_code == failure_code
    assert audits[-1].side_effects == ()
    assert "private draft" not in audits[-1].model_dump_json()
    assert "private runtime detail" not in audits[-1].model_dump_json()
    assert "private generic detail" not in audits[-1].model_dump_json()
    assert "private output" not in audits[-1].model_dump_json()
