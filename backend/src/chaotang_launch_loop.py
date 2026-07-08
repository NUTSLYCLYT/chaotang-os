"""Launch-loop case contract for Chaotang OS.

This module owns the first durable boundary for:

    input -> evidence -> recommendation -> action -> run_id -> decision -> archive -> learning

It intentionally uses pure dict-producing functions plus append-only JSONL so the
contract can be tested before it is promoted into a SQL table.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_ARCHIVE_PATH = PROJECT_ROOT / "data" / "chaotang" / "launch_loop_cases.jsonl"

TERMINAL_STATUSES = {"reviewed", "archived"}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def launch_loop_archive_path() -> Path:
    configured = os.environ.get("CHAOTANG_LAUNCH_LOOP_ARCHIVE", "").strip()
    return Path(configured) if configured else DEFAULT_ARCHIVE_PATH


def _short_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:16]


def _slug(value: str) -> str:
    allowed = [ch.lower() if ch.isalnum() else "_" for ch in value.strip()]
    compact = "".join(allowed).strip("_")
    while "__" in compact:
        compact = compact.replace("__", "_")
    return compact[:48] or "case"


def _quality_gate(edict: dict[str, Any]) -> dict[str, Any]:
    raw = edict.get("quality_gate")
    if not isinstance(raw, dict) or not raw:
        # 铁律2：缺门不得静默回退成 needs_review（否则缺数据被当成"可决策"）。
        logger.warning(
            "launch_loop_case: edict missing quality_gate, marking status=missing (run_id=%s)",
            edict.get("run_id", ""),
        )
        return {"status": "missing", "score": 0.0, "reasons": ["missing_quality_gate"], "humanSignoffRequired": True}
    status = str(raw.get("status") or "").strip()
    if not status:
        logger.warning(
            "launch_loop_case: quality_gate present but status empty, marking missing (run_id=%s)",
            edict.get("run_id", ""),
        )
        status = "missing"
    return {
        "status": status,
        "score": float(raw.get("score") or 0.0),
        "reasons": [str(item) for item in raw.get("reasons", []) if str(item).strip()],
        "humanSignoffRequired": bool(raw.get("human_signoff_required", True)),
    }


def _evidence_ids(edict: dict[str, Any]) -> list[str]:
    evidence = edict.get("evidence") if isinstance(edict.get("evidence"), list) else []
    ids: list[str] = []
    for index, item in enumerate(evidence):
        if not isinstance(item, dict):
            continue
        source = str(item.get("source") or "")
        label = str(item.get("label") or "")
        value = str(item.get("value") or "")
        seed = f"{source}:{label}:{value}" if value else f"{source}:{label}:{index}"
        ids.append(_short_hash(seed))
    return ids


def _archive(edict: dict[str, Any], task_id: str) -> dict[str, Any]:
    adapter = edict.get("run_adapter") if isinstance(edict.get("run_adapter"), dict) else {}
    replay = adapter.get("replay_artifact") if isinstance(adapter.get("replay_artifact"), dict) else {}
    session_id = str(adapter.get("session_id") or edict.get("run_id") or task_id)
    replay_explicit = bool(replay)
    replay_api = str(replay.get("api_path") or f"/api/swarm/sessions/{session_id}")
    retrospective = f"/api/chaotang/archive/{task_id}/retrospective"
    return {
        "owner": str(replay.get("owner") or "shiguan"),
        "store": str(launch_loop_archive_path()),
        "replayApiPath": replay_api,
        "replayPath": str(replay.get("path") or ""),
        "artifactPath": str(replay.get("path") or "") or None,
        "replayExplicit": replay_explicit,
        "retrospectiveApiPath": retrospective,
        "archiveId": f"archive_{_short_hash(task_id + ':' + session_id)}",
        "learningStatus": "ready_for_shiguan_review",
    }


def _next_action(edict: dict[str, Any]) -> dict[str, str]:
    actions = edict.get("next_actions") if isinstance(edict.get("next_actions"), list) else []
    first = next((item for item in actions if isinstance(item, dict)), {})
    return {
        "owner": str(first.get("owner") or "user"),
        "label": str(first.get("label") or "补齐证据后再推进"),
        "target": str(first.get("target") or "/court-briefing"),
        "type": str(first.get("type") or "request_evidence"),
    }


def _status(edict: dict[str, Any]) -> str:
    status = _quality_gate(edict)["status"]
    if status == "blocked":
        return "reviewed"
    if status == "missing":
        # 缺门 = 资料不全，停在 drafted，不进 decision_ready。
        return "drafted"
    if status in {"passed", "needs_review"}:
        return "decision_ready"
    return "running"


def _infer_target_dept(edict: dict[str, Any], target_dept: str | None, run_id: str) -> str:
    if target_dept:
        return target_dept
    departments = edict.get("departments") if isinstance(edict.get("departments"), list) else []
    if departments and isinstance(departments[0], dict) and departments[0].get("dept"):
        return str(departments[0]["dept"])
    # 铁律2：部门缺失是漂移信号，warn 出来而不是静默 ?? command_center。
    logger.warning(
        "launch_loop_case: edict has no department, defaulting targetDept=command_center (run_id=%s)", run_id
    )
    return "command_center"


def _source_mode(edict: dict[str, Any], run_id: str) -> str:
    raw = edict.get("source_mode")
    if not raw:
        logger.warning("launch_loop_case: edict missing source_mode, defaulting MIXED (run_id=%s)", run_id)
        return "MIXED"
    return str(raw)


def build_launch_loop_case(
    *,
    command: str,
    edict: dict[str, Any],
    source_id: str | None = None,
    source: str = "shangshufang",
    owner: str = "shangshufang",
    target_dept: str | None = None,
    prior_context: dict[str, Any] | None = None,
    tenant_slug: str = "default",
    idempotency_key: str | None = None,
) -> dict[str, Any]:
    """Create the canonical launch-loop case from a study edict.

    ``prior_context`` (from :func:`build_prior_context`) closes the loop: prior
    runs of the same task are read back and demonstrably change this output
    (attempt number, score delta, goldenCandidate). Without it the case is
    treated as the first attempt.

    ``tenant_slug`` scopes the case for row-level isolation (recall and reads
    must filter by it); ``idempotency_key`` lets a client mark a replay so it is
    recorded exactly once.
    """
    tenant = str(tenant_slug or "default").strip() or "default"
    run_id = str(edict.get("run_id") or source_id or _short_hash(command))
    task_id = str(source_id or run_id)
    now = utc_now()
    title = str(edict.get("title") or command[:80] or "未命名真案")
    inferred_dept = _infer_target_dept(edict, target_dept, run_id)
    evidence_ids = _evidence_ids(edict)
    case_id = f"llc_{_slug(source)}_{_short_hash(tenant + ':' + task_id + ':' + command + ':' + run_id)}"
    archive = _archive(edict, task_id)
    gate = _quality_gate(edict)

    prior = prior_context or build_prior_context([])
    score_delta: float | None = None
    improving = False
    if prior.get("lastScore") is not None:
        score_delta = round(gate["score"] - float(prior["lastScore"]), 4)
        improving = score_delta > 0
    prior_view = {
        "attempt": int(prior.get("attempt", 1)),
        "priorRuns": int(prior.get("priorRuns", 0)),
        "lastStatus": str(prior.get("lastStatus") or ""),
        "lastScore": prior.get("lastScore"),
        "scoreDelta": score_delta,
        "improving": improving,
        "carriedNextAction": prior.get("carriedNextAction"),
        "unresolved": bool(prior.get("unresolved")),
    }

    return {
        "case_id": case_id,
        "schemaVersion": "launch_loop_case.v1",
        "tenantSlug": tenant,
        "idempotencyKey": str(idempotency_key or ""),
        "source": source,
        "sourceId": task_id,
        "title": title,
        "command": command,
        "owner": owner,
        "targetDept": inferred_dept,
        "evidenceIds": evidence_ids,
        "evidence": edict.get("evidence", []),
        "taskId": task_id,
        "runId": run_id,
        "decisionId": "",
        "attempt": prior_view["attempt"],
        "prior": prior_view,
        "status": _status(edict),
        "sourceMode": _source_mode(edict, run_id),
        "qualityGate": gate,
        "nextAction": _next_action(edict),
        "archive": archive,
        "learning": {
            "owner": "shiguan",
            "target": "chaotang_operating_memory",
            "status": "ready_for_shiguan_review",
            "summary": str(edict.get("summary") or ""),
            "riskCount": len(edict.get("risks", []) if isinstance(edict.get("risks"), list) else []),
            # 复利信号：本次质量优于上一次同案，才是 golden 候选。
            "goldenCandidate": improving,
            "repeatUnresolved": bool(prior_view["unresolved"]) and prior_view["attempt"] > 1,
        },
        "createdAt": now,
        "updatedAt": now,
    }


def evaluate_launch_loop_case(case: dict[str, Any]) -> dict[str, Any]:
    """Deterministic gate for launch-loop truthfulness."""
    reasons: list[str] = []
    if not str(case.get("command") or "").strip():
        reasons.append("missing_command")
    if not case.get("evidenceIds"):
        reasons.append("missing_evidence")
    archive = case.get("archive") if isinstance(case.get("archive"), dict) else {}
    if archive.get("owner") != "shiguan":
        reasons.append("archive_owner_not_shiguan")
    if case.get("sourceMode") == "LIVE_SWARM" and not archive.get("replayExplicit"):
        reasons.append("missing_shiguan_archive_path")
    if not archive.get("replayApiPath") or "/api/swarm/sessions/" not in str(archive.get("replayApiPath")):
        reasons.append("missing_shiguan_archive_path")
    if not archive.get("retrospectiveApiPath"):
        reasons.append("missing_retrospective_path")
    next_action = case.get("nextAction") if isinstance(case.get("nextAction"), dict) else {}
    if not next_action.get("owner") or not next_action.get("label"):
        reasons.append("missing_next_action")
    gate = case.get("qualityGate") if isinstance(case.get("qualityGate"), dict) else {}
    if not gate.get("status") or gate.get("status") == "missing":
        reasons.append("missing_quality_gate")
    if case.get("status") in TERMINAL_STATUSES and not archive.get("archiveId"):
        reasons.append("terminal_case_missing_archive_id")
    # 同一缺陷可能被两条规则各命中一次，去重保持理由集稳定。
    deduped = list(dict.fromkeys(reasons))
    return {
        "passed": not deduped,
        "reasons": deduped,
        "case_id": case.get("case_id", ""),
    }


def write_launch_loop_archive(case: dict[str, Any], path: Path | None = None) -> dict[str, Any]:
    """Append a launch-loop case to durable JSONL storage."""
    target = path or launch_loop_archive_path()
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(case, ensure_ascii=False, sort_keys=True) + "\n")
    return {
        "archivePath": str(target),
        "case_id": case.get("case_id", ""),
    }


def read_launch_loop_cases(
    limit: int = 100, path: Path | None = None, tenant_slug: str | None = None
) -> list[dict[str, Any]]:
    target = path or launch_loop_archive_path()
    if not target.exists():
        return []
    tenant = str(tenant_slug).strip() if tenant_slug is not None else None
    records: list[dict[str, Any]] = []
    for line in target.read_text(encoding="utf-8").splitlines():
        try:
            record = json.loads(line)
        except json.JSONDecodeError:
            continue
        # 租户隔离：行级过滤，调用方拿不到别的租户的真案。
        if tenant is not None and str(record.get("tenantSlug") or "default") != tenant:
            continue
        records.append(record)
    return records[-max(1, min(limit, 500)) :]


def recall_prior_cases(
    source_id: str | None, tenant_slug: str | None = None, path: Path | None = None, limit: int = 200
) -> list[dict[str, Any]]:
    """Read side of the loop: prior launch-loop cases for the same source/task.

    This is what makes the flywheel actually turn — the archive is read back so
    the next case can be shaped by what earlier runs of the same task produced.
    ``tenant_slug`` must be passed in multi-tenant paths so recall never crosses
    tenants. Returned in chronological (append) order.
    """
    sid = str(source_id or "").strip()
    if not sid:
        return []
    return [
        case
        for case in read_launch_loop_cases(limit=limit, path=path, tenant_slug=tenant_slug)
        if str(case.get("sourceId")) == sid or str(case.get("taskId")) == sid
    ]


def find_by_idempotency_key(
    tenant_slug: str, key: str, path: Path | None = None, limit: int = 500
) -> dict[str, Any] | None:
    """Return the case already recorded under this (tenant, idempotency key), if any.

    This is the exactly-once guard: a client that replays a request with the same
    key gets the original case back instead of a duplicate write/event.
    """
    k = str(key or "").strip()
    if not k:
        return None
    for case in read_launch_loop_cases(limit=limit, path=path, tenant_slug=tenant_slug):
        if str(case.get("idempotencyKey") or "") == k:
            return case
    return None


def build_prior_context(prior_cases: list[dict[str, Any]]) -> dict[str, Any]:
    """Summarize prior runs of a task into the context that shapes the next case."""
    if not prior_cases:
        return {
            "attempt": 1,
            "priorRuns": 0,
            "lastStatus": "",
            "lastScore": None,
            "carriedNextAction": None,
            "unresolved": False,
        }
    last = prior_cases[-1]
    last_gate = last.get("qualityGate") if isinstance(last.get("qualityGate"), dict) else {}
    last_next = last.get("nextAction") if isinstance(last.get("nextAction"), dict) else {}
    last_score = last_gate.get("score")
    # 上一次仍在要证据 / 尚未走到终态 = 未结，带进下一次。
    unresolved = str(last_next.get("type")) == "request_evidence" or str(last.get("status")) not in TERMINAL_STATUSES
    return {
        "attempt": len(prior_cases) + 1,
        "priorRuns": len(prior_cases),
        "lastStatus": str(last.get("status") or ""),
        "lastScore": float(last_score) if isinstance(last_score, (int, float)) else None,
        "carriedNextAction": last_next if (unresolved and last_next) else None,
        "unresolved": bool(unresolved),
    }
