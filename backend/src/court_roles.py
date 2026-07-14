"""src/court_roles.py — 把关人角色解析(修洞B:让御史放行有人能点)。

从 config/court_roles.yaml 白名单把用户名 → 治理角色(yushi/harness)。
schneier:授御史是权限升级,只认白名单(git 可审计),不信运行时自封。

effective_role:登录身份 + 白名单 → 传给 court_action.dispatch 的 actor_role。
白名单里 → 提升为 yushi/harness;否则保持原 role。
"""
from __future__ import annotations

from pathlib import Path

import yaml

from src.department_identity import validate_authority_role_keys

_ROLES_PATH = Path(__file__).resolve().parent.parent / "config" / "court_roles.yaml"


def _load(path: Path | None = None) -> dict:
    config = yaml.safe_load((path or _ROLES_PATH).read_text(encoding="utf-8")) or {}
    if not isinstance(config, dict):
        raise ValueError("court_roles must be a mapping")
    validate_authority_role_keys("court_roles", config)
    for role, principals in config.items():
        if not isinstance(principals, list) or not all(isinstance(item, str) for item in principals):
            raise ValueError(f"court_roles.{role} must be a list of usernames")
    return config


def effective_role(username: str | None, base_role: str | None, *, path: Path | None = None) -> str:
    """登录用户名 + 白名单 → 有效治理角色。命中白名单则提升,否则原样。"""
    cfg = _load(path)
    uname = (username or "").strip()
    if uname and uname in (cfg.get("yushi") or []):
        return "yushi"
    if uname and uname in (cfg.get("harness") or []):
        return "harness"
    return base_role or "user"
