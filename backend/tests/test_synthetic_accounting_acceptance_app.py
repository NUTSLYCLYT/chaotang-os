from __future__ import annotations

import importlib
import os
import sys
import threading
import time
from collections.abc import Iterator
from pathlib import Path
from types import ModuleType

import pytest
from fastapi.testclient import TestClient

import app.accounting_reports.session as report_session_module
import app.api.chancellor_drafts as chancellor_drafts_api
import app.api.decrees as decrees_api
import app.api.report_artifacts as report_artifacts_api
import app.auth.storage as auth_storage
import app.decree_jobs.executor as decree_job_executor
import app.main as main_module
from app.shiguan import db as shiguan_db


def _capture_synthetic_process_state() -> dict[str, object]:
    return {
        "dependency_overrides": dict(main_module.app.dependency_overrides),
        "routes": tuple(main_module.app.router.routes),
        "main_job_store": main_module.get_decree_job_store,
        "draft_graph": chancellor_drafts_api.get_chancellor_draft_graph,
        "decrees_report_session": decrees_api.build_accounting_report_session,
        "decrees_graph": decrees_api.get_chancellor_graph,
        "executor_report_session": (
            decree_job_executor.build_accounting_report_session
        ),
        "load_ledger_rows": report_session_module.load_ledger_rows,
        "auth_db_path": auth_storage._configured_db_path,
        "artifact_db_path": report_artifacts_api._configured_db_path,
        "shiguan_db_path": shiguan_db._DEFAULT_DB_PATH,
        "tmp_env": os.environ.get("CHAOTANG_SYNTHETIC_ACCEPTANCE_TMP"),
    }


def _restore_synthetic_process_state(snapshot: dict[str, object]) -> None:
    main_module.app.dependency_overrides.clear()
    main_module.app.dependency_overrides.update(snapshot["dependency_overrides"])
    main_module.app.router.routes[:] = snapshot["routes"]
    main_module.get_decree_job_store = snapshot["main_job_store"]
    chancellor_drafts_api.get_chancellor_draft_graph = snapshot["draft_graph"]
    decrees_api.build_accounting_report_session = snapshot["decrees_report_session"]
    decrees_api.get_chancellor_graph = snapshot["decrees_graph"]
    decree_job_executor.build_accounting_report_session = snapshot[
        "executor_report_session"
    ]
    report_session_module.load_ledger_rows = snapshot["load_ledger_rows"]
    auth_storage._configured_db_path = snapshot["auth_db_path"]
    report_artifacts_api._configured_db_path = snapshot["artifact_db_path"]
    shiguan_db._DEFAULT_DB_PATH = snapshot["shiguan_db_path"]
    if snapshot["tmp_env"] is None:
        os.environ.pop("CHAOTANG_SYNTHETIC_ACCEPTANCE_TMP", None)
    else:
        os.environ["CHAOTANG_SYNTHETIC_ACCEPTANCE_TMP"] = str(snapshot["tmp_env"])


@pytest.fixture(scope="module")
def synthetic_app(tmp_path_factory: pytest.TempPathFactory) -> Iterator[ModuleType]:
    snapshot = _capture_synthetic_process_state()
    os.environ["CHAOTANG_SYNTHETIC_ACCEPTANCE_TMP"] = str(
        tmp_path_factory.mktemp("synthetic-acceptance-fixture")
    )
    module_name = "tests.synthetic_accounting_acceptance_app"
    sys.modules.pop(module_name, None)
    try:
        module = importlib.import_module(module_name)
        yield module
    finally:
        module = sys.modules.get(module_name)
        if module is not None:
            module._release_execution_hold()
        _restore_synthetic_process_state(snapshot)
        sys.modules.pop(module_name, None)


def test_ordinary_prompt_builds_one_non_accounting_route(synthetic_app: ModuleType) -> None:
    result = synthetic_app._build_draft_graph().invoke({
        "messages": [{"role": "user", "content": synthetic_app.ORDINARY_REQUEST}],
        "version": 1,
    })

    response = result["response"]
    assert response["status"] == "DRAFT_READY"
    assert response["decree_text"] == synthetic_app.ORDINARY_DECREE
    assert response["draft"]["departments"] == [{
        "department": "礼部",
        "bureaus": ["品牌司"],
        "role": "主管",
        "reason": "统一对外品牌表达",
        "responsibility": "制定发布前检查清单",
        "expected_output": "一页品牌表达检查清单",
    }]
    assert result.get("accounting_context") is None


def test_ordinary_session_is_empty_and_does_not_attach_finance_data(
    synthetic_app: ModuleType,
) -> None:
    session = synthetic_app._build_session(
        owner_user_id="synthetic-owner",
        run_id="ordinary-run",
        accounting_context=None,
    )

    assert session.owner_user_id == "synthetic-owner"
    assert session.request_kind is None
    assert session.period is None
    assert session.dataset is None


def test_ordinary_api_job_executes_four_stage_route_and_archives_reply(
    synthetic_app: ModuleType,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CHAOTANG_DECREE_JOB_WORKER_ENABLED", "1")
    with TestClient(synthetic_app.app) as client:
        registration = client.post(
            "/api/v1/auth/register",
            json={
                "username": "ordinary-owner",
                "email": "ordinary-owner@example.com",
                "password": "six-or-more",
            },
        )
        assert registration.status_code == 201
        headers = {
            "Authorization": f"Bearer {registration.json()['session_id']}",
        }
        draft_response = client.post(
            "/api/v1/chancellor-drafts",
            headers=headers,
            json={
                "messages": [{
                    "role": "user",
                    "content": synthetic_app.ORDINARY_REQUEST,
                }],
                "version": 1,
            },
        )
        assert draft_response.status_code == 200
        draft = draft_response.json()
        assert draft["status"] == "DRAFT_READY"

        accepted_response = client.post(
            "/api/v1/decrees/chancellor",
            headers={**headers, "Idempotency-Key": "ordinary-full-flow"},
            json={
                "decree_text": draft["decree_text"],
                "draft_version": draft["version"],
                "draft_fingerprint": draft["fingerprint"],
            },
        )
        assert accepted_response.status_code == 202
        job_id = accepted_response.json()["job_id"]

        deadline = time.monotonic() + 5
        while True:
            job_response = client.get(
                f"/api/v1/decree-jobs/{job_id}",
                headers=headers,
            )
            assert job_response.status_code == 200
            job = job_response.json()
            if job["state"] in {"SUCCEEDED", "FAILED", "CANCELLED"}:
                break
            assert time.monotonic() < deadline, job
            time.sleep(0.02)

        assert job["state"] == "SUCCEEDED", job
        result = job["result"]
        assert result["route_type"] == "single"
        assert result["departments"] == ["礼部"]
        assert result["processing_path"] == [
            "上书房",
            "丞相（首次分流）",
            "礼部",
            "礼部·品牌司",
            "礼部（部级补充）",
            "丞相（最终汇总）",
        ]
        assert result["ministry_opinions"] == [{
            "department": "礼部",
            "bureau_opinions": [{
                "bureau": "品牌司",
                "opinion": "建议统一品牌表达与视觉资产",
            }],
            "opinion": "礼部补充：对外口径须统一并完成发布门禁。",
        }]
        assert result["final_verdict"] == "丞相汇总：统一品牌表达并设置发布门禁。"
        assert result["recommendations"] == [
            "统一对外口径",
            "校验视觉资产",
            "设置发布门禁",
        ]
        assert result["artifacts"] == []
        archive_response = client.get(
            f"/api/v1/shiguan/archives/{job_id}",
            headers=headers,
        )
        assert archive_response.status_code == 200
        archive = archive_response.json()
        assert archive["id"] == job_id
        assert archive["type"] == "REPLY"
        assert archive["source_kind"] == "DECREE"
        assert archive["source_text"] == synthetic_app.ORDINARY_DECREE


def test_execution_hold_is_one_shot_and_releasable(synthetic_app: ModuleType) -> None:
    synthetic_app._arm_execution_hold()
    completed = threading.Event()
    thread = threading.Thread(
        target=lambda: (
            synthetic_app._await_execution_release(lambda: None),
            completed.set(),
        ),
        daemon=True,
    )
    thread.start()

    deadline = time.monotonic() + 2
    while not synthetic_app._execution_hold_status()["started"]:
        assert time.monotonic() < deadline
        time.sleep(0.01)
    assert not completed.is_set()

    synthetic_app._release_execution_hold()
    thread.join(timeout=2)
    assert completed.is_set()
    assert synthetic_app._execution_hold_status() == {
        "armed": False,
        "started": False,
        "released": True,
    }

    started = time.monotonic()
    synthetic_app._await_execution_release(lambda: None)
    assert time.monotonic() - started < 0.2


def test_execution_hold_keeps_cancel_and_deadline_boundary_live(
    synthetic_app: ModuleType,
) -> None:
    calls = 0

    def cancelled() -> None:
        nonlocal calls
        calls += 1
        if calls == 2:
            raise RuntimeError("synthetic cancellation")

    synthetic_app._arm_execution_hold()
    try:
        with pytest.raises(RuntimeError, match="synthetic cancellation"):
            synthetic_app._await_execution_release(cancelled)
    finally:
        synthetic_app._release_execution_hold()
    assert calls == 2


def test_synthetic_process_state_snapshot_restores_every_import_side_effect() -> None:
    snapshot = _capture_synthetic_process_state()

    def sentinel() -> None:
        return None

    sentinel_path = Path("synthetic-sentinel.sqlite3")
    sentinel_route = object()
    try:
        main_module.app.dependency_overrides.clear()
        main_module.app.dependency_overrides[sentinel] = sentinel
        main_module.app.router.routes.append(sentinel_route)
        main_module.get_decree_job_store = sentinel
        chancellor_drafts_api.get_chancellor_draft_graph = sentinel
        decrees_api.build_accounting_report_session = sentinel
        decrees_api.get_chancellor_graph = sentinel
        decree_job_executor.build_accounting_report_session = sentinel
        report_session_module.load_ledger_rows = sentinel
        auth_storage._configured_db_path = sentinel_path
        report_artifacts_api._configured_db_path = sentinel_path
        shiguan_db._DEFAULT_DB_PATH = sentinel_path
        os.environ["CHAOTANG_SYNTHETIC_ACCEPTANCE_TMP"] = "synthetic-sentinel"

        _restore_synthetic_process_state(snapshot)

        assert main_module.app.dependency_overrides == snapshot["dependency_overrides"]
        assert tuple(main_module.app.router.routes) == snapshot["routes"]
        assert main_module.get_decree_job_store is snapshot["main_job_store"]
        assert (
            chancellor_drafts_api.get_chancellor_draft_graph
            is snapshot["draft_graph"]
        )
        assert (
            decrees_api.build_accounting_report_session
            is snapshot["decrees_report_session"]
        )
        assert decrees_api.get_chancellor_graph is snapshot["decrees_graph"]
        assert (
            decree_job_executor.build_accounting_report_session
            is snapshot["executor_report_session"]
        )
        assert report_session_module.load_ledger_rows is snapshot["load_ledger_rows"]
        assert auth_storage._configured_db_path == snapshot["auth_db_path"]
        assert report_artifacts_api._configured_db_path == snapshot["artifact_db_path"]
        assert shiguan_db._DEFAULT_DB_PATH == snapshot["shiguan_db_path"]
        assert os.environ.get("CHAOTANG_SYNTHETIC_ACCEPTANCE_TMP") == snapshot["tmp_env"]
    finally:
        _restore_synthetic_process_state(snapshot)
