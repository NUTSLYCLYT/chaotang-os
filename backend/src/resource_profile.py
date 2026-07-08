"""Resource profile policy for logged-in users.

The policy is intentionally conservative: Chaotang resources are available by
default, but user-owned resources are never silently replaced.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


ResourceMode = Literal["chaotang_default", "user_own", "hybrid"]


@dataclass(frozen=True)
class ResourceOption:
    mode: ResourceMode
    label: str
    description: str
    recommended: bool = False


RESOURCE_OPTIONS: tuple[ResourceOption, ...] = (
    ResourceOption(
        mode="chaotang_default",
        label="使用朝堂默认资源",
        description="登录后立即可用朝堂内置协议、史馆、蜂群、收口护栏和默认提示词。",
        recommended=True,
    ),
    ResourceOption(
        mode="hybrid",
        label="混合模式",
        description="朝堂默认资源做底座，叠加用户自己的 provider、知识库、偏好和私有材料。",
    ),
    ResourceOption(
        mode="user_own",
        label="只用我的资源",
        description="仅使用用户显式接入的资源；朝堂资源只作为可选参考，不自动注入。",
    ),
)

DEFAULT_RESOURCE_MODE: ResourceMode = "chaotang_default"


def valid_resource_modes() -> set[str]:
    return {option.mode for option in RESOURCE_OPTIONS}


def normalize_resource_mode(mode: str | None) -> ResourceMode:
    if mode in valid_resource_modes():
        return mode  # type: ignore[return-value]
    return DEFAULT_RESOURCE_MODE


def resource_profile_payload(
    mode: str | None = None,
    *,
    user_has_own_resources: bool = False,
) -> dict:
    selected = normalize_resource_mode(mode)
    return {
        "selectedMode": selected,
        "defaultMode": DEFAULT_RESOURCE_MODE,
        "userHasOwnResources": user_has_own_resources,
        "neverReplaceUserResources": True,
        "requiresExplicitSwitchForUserOwn": True,
        "options": [
            {
                "mode": option.mode,
                "label": option.label,
                "description": option.description,
                "recommended": option.recommended,
            }
            for option in RESOURCE_OPTIONS
        ],
        "activeResources": active_resources_for(selected),
    }


def active_resources_for(mode: ResourceMode) -> list[str]:
    if mode == "user_own":
        return [
            "user_providers",
            "user_knowledge",
            "user_preferences",
        ]
    if mode == "hybrid":
        return [
            "chaotang_protocols",
            "shiguan_archive",
            "qintianjian",
            "commit_closeout_guardrail",
            "user_providers",
            "user_knowledge",
            "user_preferences",
        ]
    return [
        "chaotang_protocols",
        "shiguan_archive",
        "qintianjian",
        "commit_closeout_guardrail",
        "default_swarms",
    ]
