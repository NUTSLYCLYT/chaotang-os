"""健康检查端点 — 等价于旧 /api/health。"""

from __future__ import annotations

import os
import re
import time
import urllib.request
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from src.production_events import record_event, timed_ms
from web.schemas.health import HealthResponse

router = APIRouter(prefix="/api", tags=["health"])

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_JWT_KEY_ID_RE = re.compile(r"^[A-Za-z0-9._-]{1,64}$")


def _auth_identity() -> dict:
    enabled = os.getenv("FENGQUN_AUTH", "false").lower() in ("1", "true", "yes")
    candidate = os.getenv("FENGQUN_JWT_KEY_ID", "")
    key_id = candidate if _JWT_KEY_ID_RE.fullmatch(candidate) else None
    return {"enabled": enabled, "jwt_key_id": key_id}


def _check_model_gateway() -> tuple[str, dict]:
    """Probe LiteLLM/OpenAI-compatible model gateway without leaking secrets."""
    started = time.monotonic()
    base = os.getenv("LITELLM_BASE", "http://127.0.0.1:4000")
    key = os.getenv("LITELLM_API_KEY", "")
    timeout = float(os.getenv("FENGQUN_HEALTH_TIMEOUT_SECONDS", "1.5"))
    detail = {"base": base, "timeout_seconds": timeout, "latency_ms": None}
    try:
        req = urllib.request.Request(
            f"{base}/v1/models",
            headers={"Authorization": f"Bearer {key}"},
        )
        urllib.request.urlopen(req, timeout=timeout)
        detail["latency_ms"] = timed_ms(started)
        return "up", detail
    except Exception as exc:  # noqa: BLE001
        detail["latency_ms"] = timed_ms(started)
        detail["error"] = exc.__class__.__name__
        return "down", detail


def _health_payload(*, schema_identity=None) -> HealthResponse:
    checks: dict[str, str] = {}
    details: dict[str, dict] = {}

    try:
        web_search_path = _PROJECT_ROOT / "mcp_servers" / "web_search_server.py"
        checks["mcp_web_search"] = "up" if web_search_path.exists() else "down"
    except Exception:
        checks["mcp_web_search"] = "error"

    checks["litellm"], details["litellm"] = _check_model_gateway()

    checks["deepseek_key"] = "configured" if os.getenv("DEEPSEEK_API_KEY") else "missing"
    details["auth"] = _auth_identity()
    if schema_identity is None:
        checks["schema"] = "unknown"
        details["schema"] = {"mode": None, "current": None, "head": None}
    else:
        checks["schema"] = (
            "at_head"
            if schema_identity.ready and schema_identity.current == schema_identity.head
            else "test_bootstrap"
            if schema_identity.ready and schema_identity.mode == "test"
            else "drifted"
        )
        details["schema"] = {
            "mode": schema_identity.mode,
            "current": schema_identity.current,
            "head": schema_identity.head,
        }

    healthy_states = {"up", "configured", "at_head", "test_bootstrap"}
    overall = "ok" if all(v in healthy_states for v in checks.values()) else "degraded"
    record_event(
        "health_probe",
        status=overall,
        gate_status="clear" if overall == "ok" else "blocked",
        gate_reason=";".join(f"{k}={v}" for k, v in checks.items() if v not in healthy_states),
        model="litellm",
        latency_ms=details.get("litellm", {}).get("latency_ms"),
    )
    return HealthResponse(status=overall, version="1.0", checks=checks, details=details)


def _readiness_blockers(payload: HealthResponse) -> list[str]:
    blockers: list[str] = []
    require_gateway = os.getenv("FENGQUN_REQUIRE_MODEL_GATEWAY", "true").lower() in ("1", "true", "yes")
    if require_gateway and payload.checks.get("litellm") != "up" and payload.checks.get("deepseek_key") != "configured":
        blockers.append("model_gateway_unavailable")
    if payload.checks.get("schema") not in {"at_head", "test_bootstrap"}:
        blockers.append("schema_not_ready")
    return blockers


@router.get("/health", response_model=HealthResponse)
def api_health(request: Request) -> HealthResponse:
    """Health check for UI status: degraded is visible but still HTTP 200."""
    return _health_payload(schema_identity=getattr(request.app.state, "schema_identity", None))


@router.get("/ready")
def api_ready(request: Request) -> JSONResponse:
    """Release readiness check: fail securely when required deps are down."""
    payload = _health_payload(schema_identity=getattr(request.app.state, "schema_identity", None))
    blockers = _readiness_blockers(payload)
    if blockers:
        record_event(
            "release_readiness",
            status="blocked",
            gate_status="blocked",
            gate_reason=";".join(blockers),
            model="litellm",
        )
        return JSONResponse(
            status_code=503,
            content={**payload.model_dump(), "ready": False, "blockers": blockers},
        )
    record_event("release_readiness", status="ready", gate_status="clear", model="litellm")
    return JSONResponse(content={**payload.model_dump(), "ready": True, "blockers": []})
