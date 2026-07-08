"""模型清单端点 — /api/models

优先从 LiteLLM /v1/models 拉取，失败回退到本地 provider 配置。
返回 ModelConfig[]，契约见 chaotang-os/src/types/extra.ts。
"""
from __future__ import annotations

import json as _json
import os
import urllib.request
from typing import Any

from fastapi import APIRouter, Depends

from web.deps import get_current_user
from web.schemas.auth import CurrentUser

router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("")
def api_models_list(
    _: CurrentUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    try:
        litellm_base = os.getenv("LITELLM_BASE", "http://127.0.0.1:4000")
        litellm_key = (
            os.getenv("LITELLM_API_KEY")
            or os.getenv("LITELLM_PROXY_KEY", "")
        )
        req = urllib.request.Request(
            f"{litellm_base}/v1/models",
            headers={"Authorization": f"Bearer {litellm_key}"} if litellm_key else {},
        )
        resp = urllib.request.urlopen(req, timeout=3)
        payload = _json.loads(resp.read().decode("utf-8"))
        data = payload.get("data", []) if isinstance(payload, dict) else []
        return [
            {
                "id": (item.get("id") or item.get("model") or "unknown"),
                "name": (item.get("id") or item.get("model") or "unknown"),
                "provider": "litellm",
                "status": "configured",
                "costPer1kIn": 0.0,
                "costPer1kOut": 0.0,
            }
            for item in data
        ]
    except Exception:
        fallback = []
        for mid, prov in [
            ("deepseek-chat", "deepseek"),
            ("deepseek-reasoner", "deepseek"),
            ("zhipu/glm-4.5", "zhipu"),
        ]:
            has_key = bool(
                os.getenv(f"{prov.upper()}_API_KEY")
                or os.getenv("LITELLM_PROXY_KEY")
            )
            fallback.append({
                "id": mid,
                "name": mid,
                "provider": prov,
                "status": "configured" if has_key else "missing",
                "costPer1kIn": 0.0,
                "costPer1kOut": 0.0,
            })
        return fallback
