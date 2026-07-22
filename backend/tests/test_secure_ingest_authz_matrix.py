"""REQ-019：tenant/user/object/purpose 任一缺失仍放行必须失败——越权矩阵、短时下载、审计。"""

from __future__ import annotations

import importlib
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.secure_ingest.provider_policy import (
    ProviderPolicyV1,
    UnknownOrUnapprovedProvider,
    assert_provider_allowed_for_body_access,
)
from src.secure_ingest.purpose_authz import authorize_body_access
from web.schemas.auth import CurrentUser

app = importlib.import_module("web.main").app
deps = importlib.import_module("web.deps")
client = TestClient(app)


# ── 纯逻辑层：purpose_authz ─────────────────────────────────────────────


def test_missing_purpose_denied() -> None:
    result = authorize_body_access(
        user_id=1, role="user", requester_tenant_id=1, artifact_tenant_id=1, purpose=None
    )
    assert result == (False, "MISSING_PURPOSE")


def test_unknown_purpose_denied() -> None:
    result = authorize_body_access(
        user_id=1, role="user", requester_tenant_id=1, artifact_tenant_id=1, purpose="steal_data"
    )
    assert result == (False, "UNKNOWN_PURPOSE")


def test_anonymous_user_denied() -> None:
    result = authorize_body_access(
        user_id=None, role="user", requester_tenant_id=1, artifact_tenant_id=1, purpose="contract_review"
    )
    assert result == (False, "ANONYMOUS_USER")


def test_cross_tenant_denied() -> None:
    result = authorize_body_access(
        user_id=1, role="user", requester_tenant_id=2, artifact_tenant_id=1, purpose="contract_review"
    )
    assert result == (False, "CROSS_TENANT")


def test_admin_role_denied_body_access_by_default() -> None:
    """R0 零破玻璃例外(已批准):admin 即使 purpose/tenant 都对,依然默认拒绝。"""
    result = authorize_body_access(
        user_id=1, role="admin", requester_tenant_id=1, artifact_tenant_id=1, purpose="contract_review"
    )
    assert result == (False, "INTERNAL_OPS_DEFAULT_DENY")


def test_correct_purpose_tenant_non_admin_user_allowed() -> None:
    result = authorize_body_access(
        user_id=1, role="user", requester_tenant_id=1, artifact_tenant_id=1, purpose="contract_review"
    )
    assert result == (True, None)


def test_purpose_authz_source_guards_admin_default_deny_branch() -> None:
    """源码回归哨兵:防止未来有人悄悄删掉 admin 默认拒绝分支。"""
    src = Path("src/secure_ingest/purpose_authz.py").read_text(encoding="utf-8")
    assert 'role == "admin"' in src
    assert "INTERNAL_OPS_DEFAULT_DENY" in src


# ── provider policy gate ────────────────────────────────────────────────


def test_provider_present_but_undeclared_fields_denied() -> None:
    with pytest.raises(UnknownOrUnapprovedProvider):
        assert_provider_allowed_for_body_access("deepseek", "deepseek-chat")


def test_unknown_provider_id_denied() -> None:
    with pytest.raises(UnknownOrUnapprovedProvider):
        assert_provider_allowed_for_body_access("some-unlisted-provider", "x")


def test_explicit_false_no_training_denied_not_just_none(monkeypatch) -> None:
    """回归:no_training 显式为 False(声明"会用于训练")必须拒绝,不能只挡 None。"""
    import src.secure_ingest.provider_policy as provider_policy_module

    policy = ProviderPolicyV1(
        provider_id="bad-provider",
        region="CN",
        retention="ZERO_RETENTION",
        no_training=False,
        subprocessors_declared=True,
        approved_for_synthetic_data=True,
    )
    monkeypatch.setattr(provider_policy_module, "load_provider_policies", lambda: {"bad-provider": policy})
    with pytest.raises(UnknownOrUnapprovedProvider):
        assert_provider_allowed_for_body_access("bad-provider", "x")


def test_explicit_false_subprocessors_declared_denied_not_just_none(monkeypatch) -> None:
    import src.secure_ingest.provider_policy as provider_policy_module

    policy = ProviderPolicyV1(
        provider_id="bad-provider-2",
        region="CN",
        retention="ZERO_RETENTION",
        no_training=True,
        subprocessors_declared=False,
        approved_for_synthetic_data=True,
    )
    monkeypatch.setattr(provider_policy_module, "load_provider_policies", lambda: {"bad-provider-2": policy})
    with pytest.raises(UnknownOrUnapprovedProvider):
        assert_provider_allowed_for_body_access("bad-provider-2", "x")


def test_all_fields_genuinely_true_and_declared_is_allowed(monkeypatch) -> None:
    """正例对照:真正全部声明齐全且 True 时应放行,防止把拒绝逻辑改过头变成永远拒绝。"""
    import src.secure_ingest.provider_policy as provider_policy_module

    policy = ProviderPolicyV1(
        provider_id="good-provider",
        region="CN",
        retention="ZERO_RETENTION",
        no_training=True,
        subprocessors_declared=True,
        approved_for_synthetic_data=True,
    )
    monkeypatch.setattr(provider_policy_module, "load_provider_policies", lambda: {"good-provider": policy})
    assert assert_provider_allowed_for_body_access("good-provider", "x") is policy


# ── 路由层：TestClient 集成(隔离 DB) ─────────────────────────────────────


def _as_user(user_id: int, tenant_id: int, role: str = "user", tenant_slug: str = "default"):
    def _override() -> CurrentUser:
        return CurrentUser(user_id=user_id, username=f"u{user_id}", role=role, tenant_slug=tenant_slug, tenant_id=tenant_id)

    return _override


def _with_identity(override):
    original = app.dependency_overrides.get(deps.get_current_user)
    app.dependency_overrides[deps.get_current_user] = override
    return original


def _restore_identity(original):
    if original is None:
        app.dependency_overrides.pop(deps.get_current_user, None)
    else:
        app.dependency_overrides[deps.get_current_user] = original


def _upload_golden(mission_contract_id: str = "mission-authz-1", purpose: str = "contract_review"):
    from tests.fixtures.secure_ingest_fixtures import golden_docx_bytes

    return client.post(
        "/api/secure-ingest/upload",
        data={"mission_contract_id": mission_contract_id, "purpose": purpose},
        files={"file": ("contract.docx", golden_docx_bytes(), "application/octet-stream")},
    )


def test_cross_tenant_status_lookup_denied(isolated_session_local, tmp_path, monkeypatch):
    import src.secure_ingest.storage as storage_module

    monkeypatch.setattr(storage_module, "SECURE_INGEST_ROOT", tmp_path / "secure_ingest")

    original = _with_identity(_as_user(1, tenant_id=1))
    try:
        upload = _upload_golden()
        assert upload.status_code == 200
        artifact_id = upload.json()["artifact_id"]
    finally:
        _restore_identity(original)

    original = _with_identity(_as_user(2, tenant_id=2))
    try:
        resp = client.get(f"/api/secure-ingest/{artifact_id}/status")
        assert resp.status_code == 404, "跨租户不应该看到别人的 artifact,连存在与否都不该暴露"
    finally:
        _restore_identity(original)


def test_missing_purpose_at_ticket_issuance_denied(isolated_session_local, tmp_path, monkeypatch):
    import src.secure_ingest.storage as storage_module

    monkeypatch.setattr(storage_module, "SECURE_INGEST_ROOT", tmp_path / "secure_ingest")

    original = _with_identity(_as_user(1, tenant_id=1))
    try:
        upload = _upload_golden()
        artifact_id = upload.json()["artifact_id"]
        resp = client.post(f"/api/secure-ingest/{artifact_id}/ticket", params={"purpose": ""})
        assert resp.status_code == 403
        assert resp.json()["detail"] == "MISSING_PURPOSE"
    finally:
        _restore_identity(original)


def test_admin_denied_ticket_issuance_by_default(isolated_session_local, tmp_path, monkeypatch):
    import src.secure_ingest.storage as storage_module

    monkeypatch.setattr(storage_module, "SECURE_INGEST_ROOT", tmp_path / "secure_ingest")

    original = _with_identity(_as_user(1, tenant_id=1))
    try:
        upload = _upload_golden()
        artifact_id = upload.json()["artifact_id"]
    finally:
        _restore_identity(original)

    original = _with_identity(_as_user(1, tenant_id=1, role="admin"))
    try:
        resp = client.post(
            f"/api/secure-ingest/{artifact_id}/ticket", params={"purpose": "contract_review"}
        )
        assert resp.status_code == 403
        assert resp.json()["detail"] == "INTERNAL_OPS_DEFAULT_DENY"
    finally:
        _restore_identity(original)


def test_ticket_single_use_replay_denied(isolated_session_local, tmp_path, monkeypatch):
    import src.secure_ingest.storage as storage_module

    monkeypatch.setattr(storage_module, "SECURE_INGEST_ROOT", tmp_path / "secure_ingest")

    original = _with_identity(_as_user(1, tenant_id=1))
    try:
        upload = _upload_golden()
        artifact_id = upload.json()["artifact_id"]
        ticket = client.post(
            f"/api/secure-ingest/{artifact_id}/ticket", params={"purpose": "contract_review"}
        ).json()
        first = client.get(
            f"/api/secure-ingest/download/{ticket['ticket_id']}", params={"token": ticket["token"]}
        )
        assert first.status_code == 200
        second = client.get(
            f"/api/secure-ingest/download/{ticket['ticket_id']}", params={"token": ticket["token"]}
        )
        assert second.status_code == 409
    finally:
        _restore_identity(original)


def test_ticket_issuance_denied_for_rejected_artifact_not_500(
    isolated_session_local, tmp_path, monkeypatch
):
    """回归:REJECTED 的 artifact(从未落盘)申请票据必须是受控 409,不能穿透成未处理异常。"""
    import src.secure_ingest.storage as storage_module
    from tests.fixtures.secure_ingest_fixtures import plain_text_bytes

    monkeypatch.setattr(storage_module, "SECURE_INGEST_ROOT", tmp_path / "secure_ingest")

    original = _with_identity(_as_user(1, tenant_id=1))
    try:
        upload = client.post(
            "/api/secure-ingest/upload",
            data={"mission_contract_id": "mission-authz-rejected", "purpose": "contract_review"},
            files={"file": ("fake.docx", plain_text_bytes(), "application/octet-stream")},
        )
        assert upload.json()["status"] == "REJECTED"
        artifact_id = upload.json()["artifact_id"]

        resp = client.post(
            f"/api/secure-ingest/{artifact_id}/ticket", params={"purpose": "contract_review"}
        )
        assert resp.status_code == 409
    finally:
        _restore_identity(original)


def test_object_substitution_digest_mismatch_denied_at_redemption(
    isolated_session_local, tmp_path, monkeypatch
):
    """发票据后底层文件被换掉(模拟对象替换)，兑换时重新算摘要，对不上就拒绝。"""
    import src.secure_ingest.storage as storage_module

    monkeypatch.setattr(storage_module, "SECURE_INGEST_ROOT", tmp_path / "secure_ingest")

    original = _with_identity(_as_user(1, tenant_id=1))
    try:
        upload = _upload_golden()
        artifact_id = upload.json()["artifact_id"]
        ticket = client.post(
            f"/api/secure-ingest/{artifact_id}/ticket", params={"purpose": "contract_review"}
        ).json()

        # 模拟对象替换:直接改磁盘上的字节。
        storage_module.write_artifact_bytes("default", artifact_id, b"substituted bytes, not the original")

        resp = client.get(
            f"/api/secure-ingest/download/{ticket['ticket_id']}", params={"token": ticket["token"]}
        )
        assert resp.status_code == 409
        assert "digest mismatch" in resp.json()["detail"]
    finally:
        _restore_identity(original)
