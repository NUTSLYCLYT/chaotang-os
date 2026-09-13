"""Truthful Mingshuo precheck and transactional request identity regressions."""

from __future__ import annotations

import json
import threading

import pytest
from fastapi.responses import JSONResponse

from app.api import scene_packs as scene_api
from app.auth.models import AuthenticatedPrincipal
from app.scene_packs import storage
from app.scene_packs.models import SceneRunInput

KEY = "123e4567-e89b-42d3-a456-426614174000"


def _owner(user_id: str = "owner-a", tenant_id: str = "tenant-a") -> AuthenticatedPrincipal:
    return AuthenticatedPrincipal(
        id=user_id,
        username=user_id,
        email=f"{user_id}@example.test",
        tenant_id=tenant_id,
        membership_id=f"membership-{user_id}-{tenant_id}",
        tenant_role="OWNER",
    )


def _inputs(**patch: str) -> dict[str, str]:
    values = {
        "productName": "Synthetic LFP Pack",
        "productCategory": "储能电池 PACK",
        "knownParameters": "51.2V 100Ah，用户申报，未经第三方核验",
        "certifications": "用户申报 UN38.3，适用范围待核验",
        "currentPriceOrCost": "用户申报 100 元，待人工确认",
        "monthlyCapacity": "用户申报每月 100 套，待工厂核验",
        "deliveryCycle": "用户申报 30 天，待排产核验",
        "plannedChannel": "人工审核后的海外经销商测试",
        "targetMarket": "德国，准入待核验",
        "productMaterials": "PRIVATE-SNAPSHOT-MARKER-ONLY",
    }
    values.update(patch)
    return values


def _payload(*, key: str = KEY, inputs: dict[str, str] | None = None) -> dict[str, object]:
    return {
        "packSlug": "single-product-export-diagnosis",
        "requestKey": key,
        "inputs": _inputs() if inputs is None else inputs,
        "attachments": [],
        "demo": False,
    }


def _counts() -> tuple[int, int, int]:
    with storage._connect() as connection:
        return tuple(
            connection.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
            for table in (
                "scene_runs",
                "board_missions",
                "scene_run_request_identities",
            )
        )


def test_complete_user_claims_are_unscored_precheck_not_business_approval():
    response = scene_api.create_scene_run(_payload(), _owner())
    assert not isinstance(response, JSONResponse)
    run = response["sceneRun"]
    assert run["status"] == "completed"
    assert run["verdict"] == "PRECHECK_ONLY"
    assert run["confidence"] is None
    assert run["riskGrade"] == "medium"
    assert run["opportunityGrade"] == "low"
    assert run["canProceed"] is False
    assert run["boardMission"]["stage"] == "awaiting_input"
    assert "核验" in run["summaryForUser"]
    assert all("推荐市场" not in str(value) for value in run["details"].values())


def test_placeholder_contract_is_field_closed_and_preserves_qualified_values():
    placeholders = {
        "knownParameters": ("未经核验", "已知参数"),
        "certifications": ("无认证", "已有认证"),
        "currentPriceOrCost": ("未报价", "当前报价或成本"),
        "monthlyCapacity": ("未知产能", "月产能"),
        "deliveryCycle": ("未知交期", "交付周期"),
        "plannedChannel": ("待确认", "计划渠道"),
    }
    for index, (field, (placeholder, label)) in enumerate(placeholders.items(), start=1):
        key = f"123e4567-e89b-42d3-a456-{index:012d}"
        result = scene_api.create_scene_run(
            _payload(key=key, inputs=_inputs(**{field: placeholder})), _owner()
        )["sceneRun"]
        assert result["status"] == "blocked"
        assert result["verdict"] == "BLOCKED"
        assert result["confidence"] is None
        assert label in result["missingItems"]
    qualified = scene_api.create_scene_run(
        _payload(
            key="123e4567-e89b-42d3-a456-426614174099",
            inputs=_inputs(certifications="用户申报认证范围未经核验"),
        ),
        _owner(),
    )["sceneRun"]
    assert qualified["verdict"] == "PRECHECK_ONLY"
    assert "用户申报认证范围未经核验" not in qualified["missingItems"]


def test_same_scoped_key_replays_one_run_and_conflict_creates_nothing():
    first = scene_api.create_scene_run(_payload(), _owner())["sceneRun"]
    second = scene_api.create_scene_run(_payload(), _owner())["sceneRun"]
    assert (second["runId"], second["missionId"]) == (
        first["runId"],
        first["missionId"],
    )
    assert _counts() == (1, 1, 1)

    conflict = scene_api.create_scene_run(
        _payload(inputs=_inputs(productName="Changed product")), _owner()
    )
    assert isinstance(conflict, JSONResponse)
    assert conflict.status_code == 409
    assert json.loads(conflict.body) == {
        "status": "error",
        "reason": "idempotency_conflict",
    }
    assert _counts() == (1, 1, 1)


def test_same_key_isolated_by_server_principal_without_identity_leak():
    a = scene_api.create_scene_run(_payload(), _owner())["sceneRun"]
    b = scene_api.create_scene_run(_payload(), _owner("owner-b"))["sceneRun"]
    c = scene_api.create_scene_run(_payload(), _owner("owner-a", "tenant-b"))["sceneRun"]
    assert len({a["runId"], b["runId"], c["runId"]}) == 3
    assert _counts() == (3, 3, 3)


def test_two_connections_serialize_identical_and_conflicting_requests():
    def race(payloads: list[SceneRunInput]):
        barrier = threading.Barrier(2)
        outcomes: list[object] = []

        def worker(payload: SceneRunInput) -> None:
            barrier.wait()
            try:
                outcomes.append(
                    storage.create_scene_run(
                        payload,
                        owner_user_id="owner-a",
                        tenant_id="tenant-a",
                    )
                )
            except Exception as exc:  # exact exception identity is asserted below
                outcomes.append(exc)

        threads = [threading.Thread(target=worker, args=(item,)) for item in payloads]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=10)
            assert not thread.is_alive()
        return outcomes

    same = SceneRunInput.model_validate(
        {
            "pack_slug": "single-product-export-diagnosis",
            "request_key": KEY,
            "inputs": _inputs(),
        }
    )
    outcomes = race([same, same.model_copy(deep=True)])
    assert all(isinstance(item, tuple) for item in outcomes)
    assert len({item[0].id for item in outcomes if isinstance(item, tuple)}) == 1
    assert _counts() == (1, 1, 1)

    conflict_key = "123e4567-e89b-42d3-a456-426614174001"
    left = same.model_copy(update={"request_key": conflict_key}, deep=True)
    right = SceneRunInput.model_validate(
        {
            "pack_slug": "single-product-export-diagnosis",
            "request_key": conflict_key,
            "inputs": _inputs(productName="different"),
        }
    )
    outcomes = race([left, right])
    assert sum(isinstance(item, storage.SceneIdempotencyConflictError) for item in outcomes) == 1
    assert sum(isinstance(item, tuple) for item in outcomes) == 1
    assert _counts() == (2, 2, 2)


def test_legacy_and_corrupt_identity_degrade_without_rewriting_source_row():
    created = scene_api.create_scene_run(_payload(), _owner())["sceneRun"]
    with storage._connect() as connection:
        connection.execute(
            "DELETE FROM scene_run_request_identities WHERE run_id = ?",
            (created["runId"],),
        )
    legacy = scene_api.get_scene_run(created["runId"], _owner())["sceneRun"]
    assert legacy["status"] == "blocked"
    assert legacy["verdict"] == "LEGACY_UNVERIFIED"
    assert legacy["confidence"] is None
    assert legacy["riskGrade"] == "high"
    assert legacy["opportunityGrade"] == "low"
    assert legacy["canProceed"] is False
    assert legacy["boardMission"]["stage"] == "blocked"
    with storage._connect() as connection:
        row = connection.execute(
            "SELECT confidence, verdict FROM scene_runs WHERE id = ?", (created["runId"],)
        ).fetchone()
    assert tuple(row) == (-1, "PRECHECK_ONLY")


def test_missing_target_mission_degrades_read_only_instead_of_becoming_404():
    created = scene_api.create_scene_run(_payload(), _owner())["sceneRun"]
    with storage._connect() as connection:
        connection.execute(
            "DELETE FROM board_missions WHERE id = ?", (created["missionId"],)
        )
    result = scene_api.get_scene_run(created["runId"], _owner())
    assert not isinstance(result, JSONResponse)
    legacy = result["sceneRun"]
    assert legacy["status"] == "blocked"
    assert legacy["verdict"] == "LEGACY_UNVERIFIED"
    assert legacy["confidence"] is None
    assert legacy["riskGrade"] == "high"
    assert legacy["opportunityGrade"] == "low"
    assert legacy["canProceed"] is False
    assert legacy["boardMission"]["stage"] == "blocked"
    with storage._connect() as connection:
        counts = tuple(
            connection.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
            for table in ("scene_runs", "board_missions", "scene_run_request_identities")
        )
    assert counts == (1, 0, 1)


def test_corrupt_target_public_projection_degrades_without_rewriting_row():
    created = scene_api.create_scene_run(_payload(), _owner())["sceneRun"]
    with storage._connect() as connection:
        connection.execute(
            """
            UPDATE scene_runs
            SET verdict = 'CONDITIONAL_GO', risk_grade = 'low',
                action_payload_json = '{"canProceed":true,"recommendedMarkets":["DE"]}'
            WHERE id = ?
            """,
            (created["runId"],),
        )
    legacy = scene_api.get_scene_run(created["runId"], _owner())["sceneRun"]
    assert legacy["status"] == "blocked"
    assert legacy["verdict"] == "LEGACY_UNVERIFIED"
    assert legacy["riskGrade"] == "high"
    assert legacy["canProceed"] is False
    assert "recommendedMarkets" not in legacy["details"]
    with storage._connect() as connection:
        row = connection.execute(
            "SELECT verdict, risk_grade, action_payload_json FROM scene_runs WHERE id = ?",
            (created["runId"],),
        ).fetchone()
    assert tuple(row) == (
        "CONDITIONAL_GO",
        "low",
        '{"canProceed":true,"recommendedMarkets":["DE"]}',
    )


@pytest.mark.parametrize(
    ("column", "value"),
    [
        (
            "evidence_refs_json",
            '[{"claim":"PRIVATE-SNAPSHOT-MARKER-ONLY","source_label":"x",'
            '"source_type":"user_claim","captured_at":"2026-01-01T00:00:00Z",'
            '"reliability":"low"}]',
        ),
        ("result_summary", "PRIVATE-SNAPSHOT-MARKER-ONLY"),
        (
            "next_actions_json",
            '[{"title":"PRIVATE-SNAPSHOT-MARKER-ONLY","owner_dept":"工部",'
            '"priority":"P0","due_hint":"今天"}]',
        ),
        ("missing_items_json", '["PRIVATE-SNAPSHOT-MARKER-ONLY"]'),
    ],
)
def test_every_target_public_projection_field_is_rebuilt_from_identity(
    column: str, value: str
):
    created = scene_api.create_scene_run(_payload(), _owner())["sceneRun"]
    with storage._connect() as connection:
        connection.execute(
            f"UPDATE scene_runs SET {column} = ? WHERE id = ?",  # noqa: S608 - frozen test columns
            (value, created["runId"]),
        )
    legacy = scene_api.get_scene_run(created["runId"], _owner())["sceneRun"]
    serialized = json.dumps(legacy, ensure_ascii=False)
    assert legacy["verdict"] == "LEGACY_UNVERIFIED"
    assert "PRIVATE-SNAPSHOT-MARKER-ONLY" not in serialized
    with storage._connect() as connection:
        stored = connection.execute(
            f"SELECT {column} FROM scene_runs WHERE id = ?",  # noqa: S608 - frozen test columns
            (created["runId"],),
        ).fetchone()[column]
    assert stored == value


def test_private_identity_material_never_crosses_public_projection():
    key = "123e4567-e89b-42d3-a456-426614174077"
    created = scene_api.create_scene_run(_payload(key=key), _owner())["sceneRun"]
    fetched = scene_api.get_scene_run(created["runId"], _owner())["sceneRun"]
    public = json.dumps([created, fetched], ensure_ascii=False, sort_keys=True)
    assert key not in public
    assert "PRIVATE-SNAPSHOT-MARKER-ONLY" not in public
    assert "serverInputDigest" not in public
    assert "clientRevisionFingerprint" not in public
    assert "source_snapshot" not in public.lower()


def test_request_key_is_required_canonical_uuid_v4_and_never_server_generated():
    bad = [
        None,
        "",
        "123e4567-e89b-12d3-a456-426614174000",
        "123E4567-E89B-42D3-A456-426614174000",
        "123e4567e89b42d3a456426614174000",
        "x" * 1000,
    ]
    for value in bad:
        payload = _payload()
        if value is None:
            payload.pop("requestKey")
        else:
            payload["requestKey"] = value
        response = scene_api.create_scene_run(payload, _owner())
        assert isinstance(response, JSONResponse)
        assert response.status_code == 422
    assert _counts() == (0, 0, 0)


def test_nfc_equivalent_input_replays_but_nfkc_only_change_conflicts():
    decomposed = _inputs(productName="Cafe\u0301 Pack")
    composed = _inputs(productName="Caf\u00e9 Pack")
    first = scene_api.create_scene_run(_payload(inputs=decomposed), _owner())["sceneRun"]
    second = scene_api.create_scene_run(_payload(inputs=composed), _owner())["sceneRun"]
    assert second["runId"] == first["runId"]
    with storage._connect() as connection:
        identity = connection.execute(
            "SELECT source_snapshot_json FROM scene_run_request_identities"
        ).fetchone()
    assert (
        json.loads(identity["source_snapshot_json"])["inputs"]["productName"]
        == decomposed["productName"]
    )

    different = scene_api.create_scene_run(
        _payload(inputs=_inputs(productName="Ｃafé Pack")), _owner()
    )
    assert isinstance(different, JSONResponse)
    assert different.status_code == 409
    assert _counts() == (1, 1, 1)


def test_private_relation_is_closed_and_cross_pack_reuse_fails_closed():
    scene_api.create_scene_run(_payload(), _owner())
    with storage._connect() as connection:
        columns = [
            row["name"]
            for row in connection.execute("PRAGMA table_info(scene_run_request_identities)")
        ]
    assert columns == [
        "tenant_id",
        "owner_user_id",
        "operation_scope",
        "request_key",
        "pack_slug",
        "canonicalization_version",
        "identity_schema_version",
        "truth_contract_version",
        "source_snapshot_json",
        "server_input_digest",
        "run_id",
        "created_at",
    ]
    cross_pack = scene_api.create_scene_run(
        {
            "packSlug": "proposal-quotation-tender",
            "requestKey": KEY,
            "inputs": {"projectName": "Synthetic", "customerRequirement": "Need quote"},
        },
        _owner(),
    )
    assert isinstance(cross_pack, JSONResponse)
    assert cross_pack.status_code == 409
    assert _counts() == (1, 1, 1)


def test_target_response_failure_rolls_back_all_three_relations():
    payload = SceneRunInput.model_validate(
        {
            "pack_slug": "single-product-export-diagnosis",
            "request_key": KEY,
            "inputs": _inputs(),
        }
    )

    def fail_serialization(*_args):
        raise ValueError("synthetic serialization failure")

    try:
        storage.create_scene_run(
            payload,
            owner_user_id="owner-a",
            tenant_id="tenant-a",
            validate_response=fail_serialization,
        )
    except storage.SceneUnavailableError:
        pass
    else:
        raise AssertionError("serialization failure must fail closed")
    assert _counts() == (0, 0, 0)


def test_corrupt_target_identity_degrades_v4_list_and_rejects_mutation():
    created = scene_api.create_scene_run(_payload(), _owner())["sceneRun"]
    with storage._connect() as connection:
        connection.execute(
            "UPDATE scene_run_request_identities SET server_input_digest = ? WHERE run_id = ?",
            ("sha256:" + "0" * 64, created["runId"]),
        )
    missions = storage.list_board_missions(owner_user_id="owner-a", tenant_id="tenant-a")
    assert len(missions) == 1
    assert missions[0].stage == "blocked"
    assert missions[0].risk_grade == "high"
    patched = storage.update_board_mission(
        created["missionId"],
        storage.MissionPatch(stage="done"),
        owner_user_id="owner-a",
        tenant_id="tenant-a",
    )
    assert patched is not None and patched.stage == "blocked"
    with storage._connect() as connection:
        stored = connection.execute(
            "SELECT stage FROM board_missions WHERE id = ?", (created["missionId"],)
        ).fetchone()
    assert stored["stage"] == "awaiting_input"


def test_valid_target_mission_rejects_patch_without_self_invalidating():
    created = scene_api.create_scene_run(_payload(), _owner())["sceneRun"]
    response = scene_api.patch_mission(
        created["missionId"],
        storage.MissionPatch(
            stage="done",
            owner="户部",
            next_milestone="直接成交",
            pinned=True,
        ),
        _owner(),
    )
    assert isinstance(response, JSONResponse)
    assert response.status_code == 409
    assert json.loads(response.body) == {
        "status": "error",
        "reason": "truth_mission_immutable",
    }
    reread = scene_api.get_scene_run(created["runId"], _owner())["sceneRun"]
    assert reread["verdict"] == "PRECHECK_ONLY"
    assert reread["boardMission"]["stage"] == "awaiting_input"
    with storage._connect() as connection:
        row = connection.execute(
            "SELECT stage, owner, next_milestone, pinned FROM board_missions WHERE id = ?",
            (created["missionId"],),
        ).fetchone()
    assert tuple(row) == (
        "awaiting_input",
        "丞相",
        "人工核对产品原文与参数出处",
        0,
    )
