from __future__ import annotations

import importlib
import json
import os
import subprocess
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


def test_accounting_stage_responder_is_stable_across_retry_and_out_of_order_calls(
    synthetic_app: ModuleType,
) -> None:
    respond = synthetic_app._accounting_stage_response

    first_route = json.loads(respond("ministry_route"))
    extra_ministry = json.loads(respond("ministry_synthesis"))
    retried_route = json.loads(respond("ministry_route"))
    out_of_order_summary = json.loads(respond("chancellor_finalize"))

    assert first_route == retried_route == {
        "rationale": "synthetic accounting route",
        "bureaus": ["会计司"],
    }
    assert "opinion" in extra_ministry
    assert set(out_of_order_summary) == {"summary", "recommendations"}


def test_accounting_ministry_route_wins_when_tool_context_is_also_present(
    synthetic_app: ModuleType,
) -> None:
    rendered = (
        'Return exactly {"rationale":"...","bureaus":["..."]}\n'
        "approved_data_refs=approved-data:accounting-source-root"
    )
    assert "approved_data_refs=" in rendered
    assert json.loads(
        synthetic_app._accounting_stage_response("ministry_route")
    )["bureaus"] == ["会计司"]


def test_accounting_stage_responder_is_independent_of_post_tool_failure_injection(
    synthetic_app: ModuleType,
) -> None:
    respond = synthetic_app._accounting_stage_response

    route = json.loads(respond("ministry_route"))
    assert route["bureaus"] == ["会计司"]
    assert set(json.loads(respond("chancellor_finalize"))) == {
        "summary",
        "recommendations",
    }


def test_stage_aware_accounting_provider_keeps_second_dynamic_job_on_ministry_schema(
    synthetic_app: ModuleType,
) -> None:
    provider = synthetic_app._SyntheticAccountingChatProvider()
    first = [{"role": "user", "content": "job=a1 approved_ref=dynamic-111"}]
    second = [{"role": "user", "content": "job=b2 approved_ref=dynamic-999"}]
    assert len(first[0]["content"]) == len(second[0]["content"])

    first_response = json.loads(
        provider.invoke_structured(first, stage="ministry_synthesis")
    )
    second_response = json.loads(
        provider.invoke_structured(second, stage="ministry_synthesis")
    )

    expected_keys = {
        "opinion",
        "shared_findings",
        "conflicts",
        "cross_bureau_impacts",
        "ministry_position",
    }
    assert set(first_response) == expected_keys
    assert set(second_response) == expected_keys


def test_stage_aware_accounting_provider_fails_closed_for_unknown_stage(
    synthetic_app: ModuleType,
) -> None:
    provider = synthetic_app._SyntheticAccountingChatProvider()

    with pytest.raises(RuntimeError, match="unsupported synthetic structured stage"):
        provider.invoke_structured([], stage="unknown")


def test_synthetic_diagnostics_exposes_process_identity_and_stage_ring(
    synthetic_app: ModuleType, monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CHAOTANG_SYNTHETIC_FRONTEND_BUILD_ID", "build-fixture")
    monkeypatch.setenv(
        "CHAOTANG_SYNTHETIC_SOURCE_MANIFEST_FINGERPRINT", "a" * 64
    )
    provider = synthetic_app._SyntheticAccountingChatProvider()
    provider.invoke_structured([], stage="ministry_route")

    diagnostic = synthetic_app._synthetic_diagnostics(provider)

    assert diagnostic["pid"] == os.getpid()
    assert diagnostic["start_nonce"]
    assert diagnostic["provider"]["class"] == "_SyntheticAccountingChatProvider"
    assert diagnostic["provider"]["has_invoke_structured"] is True
    assert diagnostic["stage_ring"][-1]["stage"] == "ministry_route"
    assert diagnostic["stage_ring"][-1]["outcome"] == "returned"
    assert set(diagnostic["modules"]) == {
        "synthetic_app",
        "structured_invocation",
    }
    assert all(
        item["file"] and len(item["sha256"]) == 64
        for item in diagnostic["modules"].values()
    )
    assert diagnostic["build_id"] == "build-fixture"
    assert diagnostic["source_manifest_fingerprint"] == "a" * 64


def test_synthetic_diagnostics_has_explicit_defaults_without_build_artifacts(
    synthetic_app: ModuleType, monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("CHAOTANG_SYNTHETIC_FRONTEND_BUILD_ID", raising=False)
    monkeypatch.delenv(
        "CHAOTANG_SYNTHETIC_SOURCE_MANIFEST_FINGERPRINT", raising=False
    )

    diagnostic = synthetic_app._synthetic_diagnostics()

    assert diagnostic["build_id"] is None
    assert diagnostic["source_manifest_fingerprint"] is None


def test_synthetic_diagnostics_ignores_damaged_runtime_manifest_by_default(
    synthetic_app: ModuleType, monkeypatch: pytest.MonkeyPatch
) -> None:
    provider = synthetic_app._SyntheticAccountingChatProvider()
    ignored_runtime_root = "." + "superpowers"
    original_exists = Path.exists
    original_read_text = Path.read_text

    def exists(path: Path) -> bool:
        if ignored_runtime_root in path.parts:
            return True
        return original_exists(path)

    def read_text(path: Path, *args, **kwargs) -> str:
        if ignored_runtime_root in path.parts:
            return "{damaged-json"
        return original_read_text(path, *args, **kwargs)

    monkeypatch.setattr(Path, "exists", exists)
    monkeypatch.setattr(Path, "read_text", read_text)

    diagnostic = synthetic_app._synthetic_diagnostics(provider)

    assert diagnostic["source_manifest_fingerprint"] is None


def test_synthetic_diagnostics_reads_explicit_source_manifest(
    synthetic_app: ModuleType, tmp_path: Path
) -> None:
    manifest_path = tmp_path / "freeze-manifest.json"
    manifest_path.write_text(
        json.dumps({"fingerprint": "formal-candidate-fingerprint"}),
        encoding="utf-8",
    )

    diagnostic = synthetic_app._synthetic_diagnostics(
        synthetic_app._SyntheticAccountingChatProvider(),
        source_manifest_path=manifest_path,
    )

    assert diagnostic["source_manifest_fingerprint"] == "formal-candidate-fingerprint"


def test_synthetic_post_tool_failure_is_one_shot_and_after_graph_invoke(
    synthetic_app: ModuleType, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[str] = []

    class FakeGraph:
        def invoke(self, _payload):
            calls.append("real-graph-completed-with-pending-artifact")
            return {"prepared": True}

    monkeypatch.setattr(synthetic_app, "build_chancellor_graph", lambda **_kwargs: FakeGraph())
    session = type("Session", (), {"request_kind": object(), "owner_user_id": "owner"})()
    synthetic_app._fail_next_execution = True
    failing_graph = synthetic_app._build_graph(report_session=session)

    with pytest.raises(RuntimeError, match="synthetic_post_tool_execution_failure"):
        failing_graph.invoke({})

    assert calls == ["real-graph-completed-with-pending-artifact"]
    assert synthetic_app._fail_next_execution is False
    assert synthetic_app._build_graph(report_session=session).invoke({}) == {
        "prepared": True
    }


def _capture_synthetic_process_state() -> dict[str, object]:
    return {
        "dependency_overrides": dict(main_module.app.dependency_overrides),
        "routes": tuple(main_module.app.router.routes),
        "main_job_store": main_module.get_decree_job_store,
        "draft_graph": chancellor_drafts_api.get_chancellor_draft_graph,
        "decrees_report_session": decrees_api.build_accounting_report_session,
        "decrees_graph": decrees_api.get_chancellor_graph,
        "executor_report_session": (decree_job_executor.build_accounting_report_session),
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
    decree_job_executor.build_accounting_report_session = snapshot["executor_report_session"]
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
    result = synthetic_app._build_draft_graph().invoke(
        {
            "messages": [{"role": "user", "content": synthetic_app.ORDINARY_REQUEST}],
            "version": 1,
        }
    )

    response = result["response"]
    assert response["status"] == "DRAFT_READY"
    assert response["decree_text"] == synthetic_app.ORDINARY_DECREE
    assert response["draft"]["departments"] == [
        {
            "department": "礼部",
            "bureaus": ["品牌司"],
            "role": "主管",
            "reason": "统一对外品牌表达",
            "responsibility": "制定发布前检查清单",
            "expected_output": "一页品牌表达检查清单",
        }
    ]
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
                "messages": [
                    {
                        "role": "user",
                        "content": synthetic_app.ORDINARY_REQUEST,
                    }
                ],
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
        assert result["ministry_opinions"] == [
            {
                "department": "礼部",
                "bureau_opinions": [
                    {
                        "bureau": "品牌司",
                        "opinion": "建议统一品牌表达与视觉资产",
                    }
                ],
                "opinion": "礼部补充：对外口径须统一并完成发布门禁。",
            }
        ]
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
        assert chancellor_drafts_api.get_chancellor_draft_graph is snapshot["draft_graph"]
        assert decrees_api.build_accounting_report_session is snapshot["decrees_report_session"]
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


def test_dynamic_layout_fixtures_are_generated_only_under_requested_root(
    synthetic_app: ModuleType,
    tmp_path: Path,
) -> None:
    fixture_root = tmp_path / "generated-accounting"

    manifest = synthetic_app._generate_dynamic_layout_fixtures(fixture_root)

    assert set(manifest) == {
        "renamed_file",
        "multiple_sheets",
        "merged_two_row_header",
        "title_section_auxiliary",
        "text_numbers",
        "ambiguous_columns",
        "validation_failure",
        "malicious_cell_instruction",
    }
    assert all(path.is_file() and path.parent == fixture_root for path in manifest.values())
    assert all(path.suffix == ".xlsx" for path in manifest.values())


def test_dynamic_acceptance_matrix_proves_content_and_recovery_cases(
    synthetic_app: ModuleType,
    tmp_path: Path,
) -> None:
    matrix = synthetic_app._run_dynamic_layout_matrix(tmp_path / "matrix")

    assert matrix["status"] == "PASS"
    assert matrix["cases"] == {
        "renamed_file": "PASS",
        "multiple_sheets": "PASS",
        "merged_two_row_header": "PASS",
        "title_section_auxiliary": "PASS",
        "text_numbers": "PASS",
        "ambiguous_columns": "PASS",
        "validation_failure": "PASS",
        "malicious_cell_instruction": "PASS",
        "primary_unavailable_alternate_success": "PASS",
    }
    assert matrix["validation_failure_readiness"] == "inferred_draft"
    assert matrix["malicious_cell_treated_as_data"] is True
    assert matrix["alternate_tool_audit_refs"]
    assert matrix["proofs"]["renamed_file"]["basename"] == "完全任意名称-A.xlsx"
    assert matrix["proofs"]["multiple_sheets"]["sheet_count"] == 2
    assert matrix["proofs"]["multiple_sheets"]["target_sheet"] == "数据页"
    assert matrix["proofs"]["merged_two_row_header"]["merged"] is True
    assert matrix["proofs"]["merged_two_row_header"]["header_depth"] >= 2
    assert matrix["proofs"]["title_section_auxiliary"]["region_count"] >= 2
    assert matrix["proofs"]["text_numbers"]["semantic_amount"] == "100.00"
    assert matrix["proofs"]["ambiguous_columns"]["candidate_count"] >= 2
    assert matrix["proofs"]["ambiguous_columns"]["reason_codes"]
    assert matrix["proofs"]["validation_failure"]["validation_passed"] is False
    assert matrix["proofs"]["malicious_cell_instruction"]["authority_unchanged"] is True
    assert matrix["proofs"]["primary_unavailable_alternate_success"]["strategy"] == "alternate_tool"


@pytest.mark.parametrize(
    "case",
    [
        "renamed_file",
        "multiple_sheets",
        "merged_two_row_header",
        "title_section_auxiliary",
        "text_numbers",
        "ambiguous_columns",
        "validation_failure",
        "malicious_cell_instruction",
        "primary_unavailable_alternate_success",
    ],
)
def test_dynamic_matrix_fails_closed_when_case_proof_is_corrupted(
    synthetic_app: ModuleType, tmp_path: Path, case: str
) -> None:
    matrix = synthetic_app._run_dynamic_layout_matrix(tmp_path / case, corrupt_case=case)
    assert matrix["status"] == "FAIL"
    assert matrix["cases"][case] == "FAIL"


def test_acceptance_runner_supports_frozen_decree_and_round_cli() -> None:
    completed = subprocess.run(
        [
            sys.executable,
            "tests/run_accounting_synthetic_acceptance.py",
            "--help",
        ],
        cwd=Path(__file__).resolve().parents[1],
        check=True,
        capture_output=True,
        text=True,
    )

    assert "--decree" in completed.stdout
    assert "--rounds" in completed.stdout


def test_acceptance_runner_loads_dynamic_matrix_from_script_context(
    tmp_path: Path,
) -> None:
    runner_path = Path(__file__).with_name("run_accounting_synthetic_acceptance.py")
    probe = (
        "import runpy\n"
        f"namespace = runpy.run_path({str(runner_path)!r}, run_name='acceptance_probe')\n"
        "loader = namespace['_load_dynamic_layout_matrix']\n"
        "print(loader().__name__)\n"
    )

    completed = subprocess.run(
        [sys.executable, "-c", probe],
        cwd=tmp_path,
        env={**os.environ, "CHAOTANG_SYNTHETIC_ACCEPTANCE_TMP": str(tmp_path)},
        check=True,
        capture_output=True,
        text=True,
    )

    assert completed.stdout.strip() == "_run_dynamic_layout_matrix"


def test_dynamic_layout_helpers_import_without_server_or_job_store_side_effects(
    tmp_path: Path,
) -> None:
    probe = (
        "import os, sys\n"
        "os.environ.pop('CHAOTANG_SYNTHETIC_ACCEPTANCE_TMP', None)\n"
        "import tests.synthetic_accounting_dynamic_layout as module\n"
        "print(module.__name__)\n"
        "print('app.main' in sys.modules)\n"
        "print('app.decree_jobs.storage' in sys.modules)\n"
    )

    completed = subprocess.run(
        [sys.executable, "-c", probe],
        cwd=Path(__file__).resolve().parents[1],
        check=True,
        capture_output=True,
        text=True,
        env={**os.environ, "CHAOTANG_SYNTHETIC_ACCEPTANCE_TMP": ""},
    )

    assert completed.stdout.splitlines() == [
        "tests.synthetic_accounting_dynamic_layout",
        "False",
        "False",
    ]


def test_acceptance_runner_records_external_formal_round_number() -> None:
    source = (
        Path(__file__).with_name("run_accounting_synthetic_acceptance.py")
        .read_text(encoding="utf-8")
    )
    assert 'CHAOTANG_ACCEPTANCE_ROUND' in source
    assert '"command"' in source
    assert '"round": formal_round' in source
    assert '"exit_code": 0' in source
