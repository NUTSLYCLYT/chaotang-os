from __future__ import annotations

from fastapi.testclient import TestClient

import app.api.chancellor_drafts as draft_api
from app.agents.chancellor_draft.authority import draft_authority_registry
from app.agents.chancellor_draft.routing import (
    ApprovedDepartmentRoute,
    ApprovedRouteSnapshot,
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
        snapshot = draft_authority_registry.consume(
            owner_user_id=user.id,
            version=4,
            fingerprint="d" * 64,
            decree_text="请户部核查合同付款风险并交付风险清单。",
        )
        assert snapshot is not None
        assert snapshot.departments[0].department == "户部"
        assert snapshot.departments[0].required_bureaus == ("会计司",)
    finally:
        configure_auth_db(None)
