"""审计事件写入——tenant/task/input digest/provider/model/policy version 逐次记录。

只做 dict 组装，DB 写入由调用方（路由层）负责，保持这一层不依赖 SQLAlchemy session 生命周期。
"""

from __future__ import annotations

from typing import Literal, TypedDict

AuditEventType = Literal[
    "upload",
    "ticket_issued",
    "ticket_redeemed",
    "provider_call_allowed",
    "provider_call_denied",
]


class AuditEventFields(TypedDict):
    tenant_id: int
    user_id: str
    event_type: AuditEventType
    task_id: str | None
    artifact_id: str | None
    input_digest: str | None
    provider_id: str | None
    model_id: str | None
    policy_version: str | None
    purpose: str | None


def build_audit_event(
    *,
    tenant_id: int,
    user_id: str,
    event_type: AuditEventType,
    task_id: str | None = None,
    artifact_id: str | None = None,
    input_digest: str | None = None,
    provider_id: str | None = None,
    model_id: str | None = None,
    policy_version: str | None = None,
    purpose: str | None = None,
) -> AuditEventFields:
    return AuditEventFields(
        tenant_id=tenant_id,
        user_id=user_id,
        event_type=event_type,
        task_id=task_id,
        artifact_id=artifact_id,
        input_digest=input_digest,
        provider_id=provider_id,
        model_id=model_id,
        policy_version=policy_version,
        purpose=purpose,
    )
