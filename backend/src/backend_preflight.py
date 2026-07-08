"""Backend preflight gate for model gateway, swarm governance, and eval safety."""
from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent


def _load_env_file(env_path: Path) -> None:
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        if key and key not in os.environ:
            os.environ[key] = value.strip()


_load_env_file(ROOT / ".env")


def _load_registered_swarms() -> list[str]:
    try:
        import yaml

        cfg_path = ROOT / "config" / "swarm_orchestrator.yaml"
        if not cfg_path.exists():
            return []
        cfg = yaml.safe_load(cfg_path.read_text(encoding="utf-8")) or {}
        return [str(s["id"]) for s in cfg.get("swarms", []) if s.get("id")]
    except Exception:
        return []


def _level_counts(rows: list[dict[str, Any]]) -> dict[str, int]:
    counts = {"active": 0, "watch": 0, "downgraded": 0, "suspended": 0, "unknown": 0}
    for row in rows:
        level = str(row.get("level") or "unknown")
        counts[level] = counts.get(level, 0) + 1
    return counts


def build_preflight_report(window: int = 30) -> dict[str, Any]:
    """Return a release-facing preflight report without mutating governance state."""
    from src.governance import collect_scores, evaluate_swarm
    from web.routers.health import _health_payload

    now_iso = datetime.now(tz=timezone.utc).isoformat()
    health = _health_payload().model_dump()
    blockers: list[str] = []
    warnings: list[str] = []

    litellm_status = health.get("checks", {}).get("litellm")
    deepseek_status = health.get("checks", {}).get("deepseek_key")
    if litellm_status != "up" and deepseek_status != "configured":
        blockers.append("model_gateway_unavailable")
    elif litellm_status != "up":
        warnings.append("litellm_down_using_deepseek_direct")

    swarm_rows: list[dict[str, Any]] = []
    for swarm_id in _load_registered_swarms():
        scores, irreversible = collect_scores(swarm_id, window=window)
        rec = evaluate_swarm(swarm_id, scores, irreversible, now_iso)
        swarm_rows.append(
            {
                "swarmId": swarm_id,
                "level": rec.level.value,
                "passRate": rec.pass_rate,
                "sampleCount": rec.sample_count,
                "irreversibleErrors": rec.irreversible_errors,
                "reason": rec.reason,
            }
        )

    counts = _level_counts(swarm_rows)
    if counts.get("suspended", 0) > 0:
        blockers.append("suspended_swarms_present")
    if counts.get("watch", 0) > 0:
        warnings.append("watch_swarms_present")
    if counts.get("downgraded", 0) > 0:
        warnings.append("downgraded_swarms_present")

    timeout_seconds = float(os.getenv("SCORE_SWARM_CASE_TIMEOUT_SECONDS", "120") or 0)
    score_swarm = {
        "caseTimeoutSeconds": timeout_seconds,
        "status": "ok" if timeout_seconds > 0 else "fail",
    }
    if timeout_seconds <= 0:
        blockers.append("score_swarm_timeout_disabled")

    try:
        from src.local_ai_bridge import fusion_status

        local_ai = fusion_status()
    except Exception as exc:  # noqa: BLE001
        local_ai = {"enabled": False, "error": str(exc)}

    if not local_ai.get("enabled"):
        warnings.append("local_ai_bridge_unavailable")
    if not local_ai.get("courtos_brain_exists", False):
        warnings.append("courtos_brain_vault_unavailable")

    overall = "fail" if blockers else "warn" if warnings else "pass"
    return {
        "overallStatus": overall,
        "generatedAt": now_iso,
        "blockers": blockers,
        "warnings": warnings,
        "health": health,
        "swarmAdmission": {
            "window": window,
            "counts": counts,
            "rows": swarm_rows,
        },
        "scoreSwarm": score_swarm,
        "localAI": local_ai,
    }
