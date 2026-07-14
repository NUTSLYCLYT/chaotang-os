"""P2: governance compatibility state must survive module/process restarts."""

from __future__ import annotations

import importlib

import pytest


def test_bill_survives_compat_module_reload(isolated_session_local):
    module = importlib.import_module("web.routers.governance_compat")
    bill = module.governance_create_bill({"command": "持久化治理案"})

    reloaded = importlib.reload(module)
    listed = reloaded.governance_bills()

    assert any(item["id"] == bill["id"] for item in listed["bills"])


def test_ima_compat_memory_routes_are_retired():
    module = importlib.import_module("web.routers.governance_compat")
    paths = {(method, route.path) for route in module.router.routes for method in route.methods}

    assert ("GET", "/api/court/ima-knowledge") not in paths
    assert ("PATCH", "/api/court/ima-knowledge") not in paths


def test_governance_adapter_refuses_to_overwrite_non_compat_task(
    isolated_session_local,
):
    from src import governance_compat_store
    from src.db.models import DecisionTask

    db = isolated_session_local()
    db.add(
        DecisionTask(
            id="bill-collision",
            user_id="owner",
            raw_question="真实任务",
            decision_type="strategy",
            status="draft",
        )
    )
    db.commit()
    db.close()

    with pytest.raises(RuntimeError, match="non-compat DecisionTask"):
        governance_compat_store.save_bill(
            {
                "id": "bill-collision",
                "command": "不得覆盖",
                "state": "drafted",
                "createdAt": "2026-07-15T00:00:00+00:00",
                "lastTransitionAt": "2026-07-15T00:00:00+00:00",
            },
            actor="zhongshu",
        )

    verify = isolated_session_local()
    assert verify.query(DecisionTask).filter_by(id="bill-collision").one().raw_question == "真实任务"
    verify.close()
