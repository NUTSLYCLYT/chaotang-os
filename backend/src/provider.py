"""Provider 管理: API 供应商注册、切换、查询。

providers.yaml 是唯一的配置源。切换 provider 时：
1. 更新 providers.yaml 的 active 字段
2. 所有 Flow 配置自动读取 active provider 的 api_base / api_key / model
"""

from __future__ import annotations

import os
from pathlib import Path

import yaml

PROVIDERS_PATH = Path(__file__).resolve().parent.parent / "config" / "providers.yaml"


def _load_config() -> dict:
    with open(PROVIDERS_PATH, encoding="utf-8") as f:
        return yaml.safe_load(f)


def _save_config(config: dict) -> None:
    with open(PROVIDERS_PATH, "w", encoding="utf-8") as f:
        yaml.dump(
            config, f, allow_unicode=True, default_flow_style=False, sort_keys=False
        )


def list_providers() -> list[dict]:
    """列出所有 provider 及其状态。"""
    config = _load_config()
    active = config.get("active", "")
    result = []
    for pid, p in config.get("providers", {}).items():
        result.append(
            {
                "id": pid,
                "name": p.get("name", pid),
                "api_base": p.get("api_base", ""),
                "models": p.get("models", []),
                "default_model": p.get("default_model", ""),
                "active": pid == active,
            }
        )
    return result


def get_active_provider() -> dict | None:
    """获取当前激活的 provider 配置。"""
    config = _load_config()
    active_id = config.get("active", "")
    if not active_id:
        return None
    p = config.get("providers", {}).get(active_id)
    if not p:
        return None
    return {
        "id": active_id,
        "name": p.get("name", active_id),
        "api_base": p.get("api_base", ""),
        "api_key_env": p.get("api_key_env", ""),
        "models": p.get("models", []),
        "default_model": p.get("default_model", ""),
    }


def switch_provider(provider_id: str) -> dict:
    """切换到指定 provider。返回新的 active provider 信息。"""
    config = _load_config()
    providers = config.get("providers", {})
    if provider_id not in providers:
        available = ", ".join(providers.keys())
        raise ValueError(f"Provider '{provider_id}' 不存在。可用: {available}")

    config["active"] = provider_id
    _save_config(config)
    return get_active_provider()


def get_provider_env(provider_id: str | None = None) -> dict:
    """获取 provider 的运行时配置（解析环境变量）。

    Returns:
        {"model": str, "api_base": str, "api_key": str}
    """
    config = _load_config()
    pid = provider_id or config.get("active", "")
    p = config.get("providers", {}).get(pid, {})

    api_key_env = p.get("api_key_env", "")
    api_key = os.environ.get(api_key_env, "") if api_key_env else ""

    return {
        "model": p.get("default_model", ""),
        "api_base": p.get("api_base", ""),
        "api_key": api_key,
        "api_key_env": api_key_env,
        "merge_system_to_user": p.get("merge_system_to_user", False),
    }


def active_fallback_models(provider_id: str | None = None) -> list[dict]:
    """active(或指定) provider 声明的 fallback_provider → [{model,api_base,api_key_env}]。

    给"直连 model_adapter"的路径(军机处会审、单点判词)复用同一套兜底,
    避免主力无 key 时静默退回规则 mock。无声明/兜底不完整 → 空列表。
    """
    cfg = _load_config()
    pid = provider_id or cfg.get("active", "")
    fb_pid = cfg.get("providers", {}).get(pid, {}).get("fallback_provider")
    if not (fb_pid and fb_pid in cfg.get("providers", {})):
        return []
    fb = get_provider_env(fb_pid)
    if fb.get("model") and fb.get("api_base"):
        return [
            {
                "model": fb["model"],
                "api_base": fb["api_base"],
                "api_key_env": fb.get("api_key_env", ""),
            }
        ]
    return []


def check_active_provider_key(cfg: "dict | None" = None) -> "tuple[bool, str]":
    """#1 启动 key 校验:active provider 的 key 是否已加载(不网络探活)。

    返回 (ok, message)。ok=False → 调用方应 loud 告警:服务能起但首次 LLM
    调用才哑,反脆弱要求失败在启动就可见。本地 provider(localhost)免 key。
    纯 cfg + env,可确定性测试。
    """
    cfg = cfg if cfg is not None else _load_config()
    active = cfg.get("active", "")
    if not active:
        return False, "providers.yaml 未设 active provider"
    p = cfg.get("providers", {}).get(active, {})
    api_base = str(p.get("api_base", ""))
    if "localhost" in api_base or "127.0.0.1" in api_base:
        return True, f"active provider '{active}' 为本地服务,免 key"
    key_env = p.get("api_key_env", "")
    if not key_env or not os.environ.get(key_env):
        return False, (
            f"active provider '{active}' 的 key 未加载"
            f"(env {key_env or '未配置'} 为空,检查 .env)"
        )
    return True, f"active provider '{active}' key 已加载"


def apply_provider_to_flow_config(
    flow_config: dict, provider_id: str | None = None
) -> dict:
    """将 provider 配置注入 Flow 配置（不修改原文件，返回新 dict）。

    高可用：若 active provider 声明了 fallback_provider，则给每个未自带
    fallback_models 的 step 自动挂上"主力挂了落到兜底 provider"的 fallback
    （如 DeepSeek 主力拿质量 + 本地 Ollama 兜底防外部掐断）。复用 flow_engine
    既有的 per-step fallback_models 机制，不改 god-file。
    """
    env = get_provider_env(provider_id)
    flow_config = dict(flow_config)  # shallow copy
    flow_config["default_model"] = env["model"]
    flow_config["default_api_base"] = env["api_base"]
    flow_config["default_api_key_env"] = env["api_key_env"]

    fb_list = active_fallback_models(provider_id)
    if fb_list:
        steps = flow_config.get("steps")
        if isinstance(steps, list):
            flow_config["steps"] = [
                (
                    {**s, "fallback_models": s.get("fallback_models") or fb_list}
                    if isinstance(s, dict)
                    else s
                )
                for s in steps
            ]
    return flow_config
