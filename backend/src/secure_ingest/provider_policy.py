"""OQ-06：R0 合成数据最小 provider policy——未声明字段一律拒绝出站。

独立文件 `backend/config/provider_policy.yaml`，不并入 `providers.yaml`——路由配置和合规
签署配置分开管理。上线时全部 provider 字段 UNKNOWN/None/false（已获批准的 fail-closed
空白态），真实合规值留给 Product/Security 后续对每个实际使用的 provider 逐一签署。
"""

from __future__ import annotations

from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field

POLICY_PATH = Path(__file__).resolve().parent.parent.parent / "config" / "provider_policy.yaml"

Region = Literal["CN", "US", "EU", "SELF_HOSTED", "UNKNOWN"]
Retention = Literal["ZERO_RETENTION", "TRANSIENT_LT_24H", "STANDARD_RETAINED", "UNKNOWN"]


class ProviderPolicyV1(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["ProviderPolicyV1"] = "ProviderPolicyV1"
    provider_id: str = Field(min_length=1)
    region: Region = "UNKNOWN"
    retention: Retention = "UNKNOWN"
    no_training: bool | None = None
    subprocessors_declared: bool | None = None
    policy_version: str = "UNSET"
    approved_for_synthetic_data: bool = False
    approved_by: str = ""
    approved_at: str = ""


class UnknownOrUnapprovedProvider(Exception):
    """未在 policy 表登记、或任一字段未声明、或未标记 approved_for_synthetic_data 的 provider。"""


def load_provider_policies() -> dict[str, ProviderPolicyV1]:
    if not POLICY_PATH.exists():
        return {}
    with open(POLICY_PATH, encoding="utf-8") as f:
        raw = yaml.safe_load(f) or {}
    return {
        provider_id: ProviderPolicyV1(provider_id=provider_id, **(entry or {}))
        for provider_id, entry in (raw.get("providers") or {}).items()
    }


def assert_provider_allowed_for_body_access(provider_id: str, model_id: str) -> ProviderPolicyV1:
    """fail closed：缺行、任一字段 UNKNOWN/None/False、或未标 approved，一律拒绝。"""
    policies = load_provider_policies()
    policy = policies.get(provider_id)
    if policy is None:
        raise UnknownOrUnapprovedProvider(f"provider '{provider_id}' 未在 provider_policy.yaml 登记")
    if (
        policy.region == "UNKNOWN"
        or policy.retention == "UNKNOWN"
        or not policy.no_training
        or not policy.subprocessors_declared
        or not policy.approved_for_synthetic_data
    ):
        raise UnknownOrUnapprovedProvider(
            f"provider '{provider_id}' model '{model_id}' 合规字段未完整声明或未获批准，拒绝出站"
        )
    return policy
