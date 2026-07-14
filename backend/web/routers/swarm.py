"""蜂群编排端点 — /api/swarm/*

⚠️ /api/swarm/run 仍按"半异步"行为（后台线程，立即返回 session_id）。
"""

from __future__ import annotations

import logging
import threading
import time
from datetime import datetime
import json
import os
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from src.tenant import with_tenant
from src.decree_swarm_router import is_light_health_check
from src.finance_intel_loop_contract import (
    build_finance_intel_session,
    is_finance_intel_loop_request,
)
from src.production_events import record_event, task_fingerprint, timed_ms
from src.swarm_orchestrator import (
    SESSIONS_DIR,
    SwarmOrchestrator,
    list_sessions,
    load_session,
    new_session_id,
)

from web.deps import get_current_user
from web.schemas.auth import CurrentUser
from web.schemas.swarm import (
    SwarmRosterItem,
    LipuComplianceRequest,
    SwarmConfigBinding,
    SwarmConfigResponse,
    SwarmConfigSwarm,
    SwarmRunRequest,
    SwarmRunResponse,
    SwarmSessionSummary,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/swarm", tags=["swarm"])

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_swarm_threads: dict[str, threading.Thread] = {}
_swarm_threads_lock = threading.Lock()
# 并发上限：每个后台线程跑一整条 LLM 蜂群链，无上限会把进程/LLM 网关压垮（实测压测打挂过）。
# 可经 env SWARM_MAX_CONCURRENT 调；默认 4 保守。超限返回 503，让调用方稍后重试（诚实拒绝，不假装受理）。
_MAX_CONCURRENT_SWARMS = max(1, int(os.environ.get("SWARM_MAX_CONCURRENT", "4")))


def _derive_release_gate(swarm_runs: list[dict[str, Any]]) -> str:
    """顶尖高手会审顺手扫出的同款洞(court_doc_builder green 病的另一个变种):
    swarm_runs 为空时以前直接落 "clear"——一个 session 如果在任何 run 落盘前就崩了
    (orchestrator 初始化异常),持久化下来的就是 status=failed 但 swarm_runs=[],
    读出来 release_gate 却显示"clear",冒充"已审过没问题"。没有 run 记录就没法
    宣称"清白",诚实返回 unknown,不跟"真的审过、确认没问题"的 clear 混在一起。
    """
    if not swarm_runs:
        return "unknown"
    for run in swarm_runs:
        qa_result = run.get("qa_result")
        if isinstance(qa_result, dict):
            if (
                qa_result.get("qa_result") == "fail"
                or qa_result.get("pass") is False
                or qa_result.get("status") == "fail"
            ):
                return "blocked"
        if run.get("status") == "failed":
            return "blocked"
    return "clear"


def _write_light_health_session(session_id: str, task_input: str) -> None:
    """Write a completed synthetic session for read-only connectivity checks."""
    now = datetime.now().astimezone().isoformat()
    run_id = f"{session_id}_health"
    data = {
        "session_id": session_id,
        "task_input": task_input,
        "synthetic": True,
        "session_type": "health_check",
        "status": "completed",
        "start_time": now,
        "end_time": now,
        "swarm_runs": [
            {
                "swarm_id": "health_check",
                "run_id": run_id,
                "task_input": task_input,
                "status": "completed",
                "triggered_by": "manual",
                "quality_score": 5.0,
                "qa_result": {
                    "qa_result": "pass",
                    "mode": "light_health_check",
                    "checks": {
                        "api": "up",
                        "session": "created",
                        "llm_required": False,
                    },
                },
                "start_time": now,
                "end_time": now,
                "error": "",
            }
        ],
        "events": [
            {
                "topic": "health_check_completed",
                "source": "health_check",
                "payload": {
                    "session_id": session_id,
                    "run_id": run_id,
                    "status": "completed",
                    "message": "链路健康：OK",
                    "llm_required": False,
                },
                "event_id": run_id,
                "timestamp": now,
                "session_id": session_id,
            }
        ],
    }
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
    path = SESSIONS_DIR / f"{session_id}.json"
    tmp = path.with_suffix(f".{os.getpid()}.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, path)


def _write_session_json(session_id: str, data: dict[str, Any]) -> None:
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
    path = SESSIONS_DIR / f"{session_id}.json"
    tmp = path.with_suffix(f".{os.getpid()}.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, path)


# ── 静态路由优先 ────────────────────────────────────────


@router.get("/sessions", response_model=list[SwarmSessionSummary])
def api_swarm_sessions(
    _: CurrentUser = Depends(get_current_user),
) -> list[SwarmSessionSummary]:
    result: list[SwarmSessionSummary] = []
    for sid in list_sessions():
        data = load_session(sid)
        if not data:
            continue
        runs = data.get("swarm_runs", []) or []
        completed = sum(1 for r in runs if r.get("status") == "completed")
        duration = ""
        if data.get("start_time") and data.get("end_time"):
            try:
                st = datetime.fromisoformat(data["start_time"])
                et = datetime.fromisoformat(data["end_time"])
                duration = f"{(et - st).total_seconds():.0f}s"
            except Exception:
                pass
        result.append(
            SwarmSessionSummary(
                session_id=sid,
                task_input=data.get("task_input", "") or "",
                status=data.get("status", "unknown") or "unknown",
                release_gate=_derive_release_gate(runs),
                synthetic=bool(data.get("synthetic", False)),
                session_type=data.get("session_type", "swarm") or "swarm",
                swarm_count=len(runs),
                completed_count=completed,
                start_time=data.get("start_time", "") or "",
                end_time=data.get("end_time", "") or "",
                duration=duration,
            )
        )
    return result


@router.post(
    "/run",
    response_model=SwarmRunResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def api_swarm_run(
    body: SwarmRunRequest,
    user: CurrentUser = Depends(get_current_user),
) -> SwarmRunResponse:
    # config_path 白名单：只允许项目 config/ 目录下的 YAML，杜绝任意文件加载
    config_path = Path(body.config_path)
    if not config_path.is_absolute():
        config_path = _PROJECT_ROOT / config_path
    config_path = config_path.resolve()
    config_dir = (_PROJECT_ROOT / "config").resolve()
    if not (
        config_path.is_relative_to(config_dir)
        and config_path.suffix in (".yaml", ".yml")
    ):
        raise HTTPException(
            status_code=422, detail="config_path 必须是 config/ 目录下的 YAML 文件"
        )

    try:
        orch = SwarmOrchestrator(str(config_path), provider=body.provider)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"编排配置加载失败: {e}") from e

    light_health = is_light_health_check(body.task_input)
    selected_entry = (body.entry_swarm or "").strip() or None
    route_reason = "explicit_entry_swarm"
    route_matched: bool | None = None
    if selected_entry:
        if selected_entry == "health_check":
            light_health = True
            route_reason = "explicit_light_health_check"
            route_matched = True
        elif selected_entry not in orch.swarms:
            raise HTTPException(
                status_code=422,
                detail=f"入口蜂群 '{selected_entry}' 未注册，可用: {sorted(orch.swarms)}",
            )
    else:
        if light_health:
            selected_entry = "health_check"
            route_reason = "light_health_check (只读联通自检, 跳过重型蜂群)"
            route_matched = True
        else:
            # 计划收口(2026-07-14):红线预检+选路由 build_plan 一次完成;
            # force_mode="direct" 保持本端点单入口语义,选路与旧 precheck 逐字节同选
            from src.orchestration_plan import build_plan

            plan = build_plan(body.task_input, orch.swarms, force_mode="direct")
            selected_entry = (plan["entry_swarms"] or [None])[0]
            route_reason = str(plan.get("reason") or "")
            route_matched = bool(plan.get("route_matched"))
        if not selected_entry:
            raise HTTPException(status_code=422, detail="没有可用入口蜂群")

    session_id = new_session_id()
    started = time.monotonic()
    record_event(
        "swarm_api_requested",
        session_id=session_id,
        run_id=session_id,
        config=body.config_path,
        swarm=selected_entry,
        status="running",
        route_reason=route_reason,
        route_matched=route_matched,
        gate_status="pending",
        tenant_slug=user.tenant_slug,
        user_role=user.role or "",
        **task_fingerprint(body.task_input),
    )

    if is_finance_intel_loop_request(body):
        session_data = build_finance_intel_session(
            session_id=session_id,
            task_input=body.task_input,
            body=body,
        )
        _write_session_json(session_id, session_data)
        gate = _derive_release_gate(session_data.get("swarm_runs", []) or [])
        record_event(
            "swarm_api_completed",
            session_id=session_id,
            run_id=session_id,
            config=body.config_path,
            swarm=selected_entry,
            status="done",
            route_reason="finance_intel_loop_contract",
            route_matched=True,
            gate_status="clear" if gate == "clear" else "blocked",
            gate_reason="" if gate == "clear" else "release_gate_blocked",
            latency_ms=timed_ms(started),
            tenant_slug=user.tenant_slug,
            user_role=user.role or "",
            **task_fingerprint(body.task_input),
        )
        return SwarmRunResponse(
            success=True,
            session_id=session_id,
            message="finance-intel-loop session completed",
            entry_swarm=selected_entry,
            route_reason="finance_intel_loop_contract",
            route_matched=True,
        )

    if light_health and selected_entry == "health_check":
        _write_light_health_session(session_id, body.task_input)
        record_event(
            "swarm_api_completed",
            session_id=session_id,
            run_id=session_id,
            config=body.config_path,
            swarm=selected_entry,
            status="done",
            route_reason=route_reason,
            route_matched=route_matched,
            gate_status="clear",
            gate_reason="",
            latency_ms=timed_ms(started),
            tenant_slug=user.tenant_slug,
            user_role=user.role or "",
            **task_fingerprint(body.task_input),
        )
        return SwarmRunResponse(
            success=True,
            session_id=session_id,
            message="轻量联通自检已完成",
            entry_swarm=selected_entry,
            route_reason=route_reason,
            route_matched=route_matched,
        )

    def _run() -> None:
        try:
            session = orch.run(
                task_input=body.task_input,
                entry_swarm=selected_entry,
                session_id=session_id,
                project_id=body.project_id,
            )
            swarm_runs = [
                r if isinstance(r, dict) else r.__dict__
                for r in getattr(session, "swarm_runs", [])
            ]
            gate = _derive_release_gate(swarm_runs)
            record_event(
                "swarm_api_completed",
                session_id=session_id,
                run_id=session_id,
                config=body.config_path,
                swarm=selected_entry,
                status="done",
                route_reason=route_reason,
                route_matched=route_matched,
                gate_status="clear" if gate == "clear" else "blocked",
                gate_reason="" if gate == "clear" else "release_gate_blocked",
                latency_ms=timed_ms(started),
                tenant_slug=user.tenant_slug,
                user_role=user.role or "",
                **task_fingerprint(body.task_input),
            )
        except Exception as exc:  # noqa: BLE001
            record_event(
                "swarm_api_failed",
                session_id=session_id,
                run_id=session_id,
                config=body.config_path,
                swarm=selected_entry,
                status="error",
                route_reason=route_reason,
                route_matched=route_matched,
                gate_status="blocked",
                gate_reason="swarm_exception",
                latency_ms=timed_ms(started),
                error=str(exc),
                tenant_slug=user.tenant_slug,
                user_role=user.role or "",
                **task_fingerprint(body.task_input),
            )
            # daemon 线程内 re-raise 没有接收者，只会刷 stderr；
            # 失败状态已由 record_event + orchestrator 会话落盘承载。
            logger.exception("蜂群编排后台线程失败 session=%s", session_id)

    # 并发守卫：清理已结束线程，在册存活数达上限则诚实拒绝(503)，不无限开线程压垮进程。
    with _swarm_threads_lock:
        for _sid in [s for s, th in _swarm_threads.items() if not th.is_alive()]:
            _swarm_threads.pop(_sid, None)
        active = len(_swarm_threads)
        if active >= _MAX_CONCURRENT_SWARMS:
            record_event(
                "swarm_api_rejected",
                session_id=session_id,
                run_id=session_id,
                config=body.config_path,
                swarm=selected_entry,
                status="rejected",
                gate_status="blocked",
                gate_reason="swarm_concurrency_full",
                tenant_slug=user.tenant_slug,
                user_role=user.role or "",
                **task_fingerprint(body.task_input),
            )
            raise HTTPException(
                status_code=503,
                detail=f"蜂群并发已满({active}/{_MAX_CONCURRENT_SWARMS})，稍后重试",
            )
        t = threading.Thread(target=with_tenant(_run), daemon=True)
        _swarm_threads[session_id] = t
        t.start()

    return SwarmRunResponse(
        success=True,
        session_id=session_id,
        message="编排已启动",
        entry_swarm=selected_entry,
        route_reason=route_reason,
        route_matched=route_matched,
    )


@router.get("/config", response_model=SwarmConfigResponse)
def api_swarm_config(
    _: CurrentUser = Depends(get_current_user),
) -> SwarmConfigResponse:
    config_path = str(_PROJECT_ROOT / "config" / "swarm_orchestrator.yaml")
    try:
        orch = SwarmOrchestrator(config_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    swarms = [
        SwarmConfigSwarm(
            id=sid,
            name=s.name,
            config=s.config_path,
            qa_version=s.qa_version,
        )
        for sid, s in orch.swarms.items()
    ]
    bindings = [
        SwarmConfigBinding(
            topic=b.topic,
            target_swarm=b.target_swarm,
            transform=b.transform,
            min_quality_score=b.min_quality_score,
            enabled=b.enabled,
        )
        for b in orch.bindings
    ]
    return SwarmConfigResponse(swarms=swarms, bindings=bindings)


@router.get("/timeline")
def api_swarm_timeline(
    _: CurrentUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """朝堂军机处链路时间轴。

    返回 SwarmTimelineNode[]，契约见 chaotang-os/src/types/extra.ts。
    """
    try:
        session_ids = list_sessions()
        if not session_ids:
            return []
        latest_data = load_session(session_ids[0])
        if not latest_data:
            return []
        runs = latest_data.get("swarm_runs", []) or []
        nodes = []
        for r in runs:
            swarm_id = r.get("swarm_id") or "unknown"
            run_id = r.get("run_id") or swarm_id
            nodes.append(
                {
                    "id": f"{swarm_id}_{run_id}",
                    "swarmId": swarm_id,
                    "status": r.get("status") or "running",
                    "qualityScore": r.get("quality_score"),
                    "triggeredBy": r.get("triggered_by") or "manual",
                    "startedAt": r.get("started_at")
                    or latest_data.get("start_time")
                    or "",
                }
            )
        return nodes
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# ── 动态路由 ────────────────────────────────────────────


@router.get("/sessions/{session_id}")
def api_swarm_session_detail(
    session_id: str,
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    data = load_session(session_id)
    if not data:
        raise HTTPException(
            status_code=404,
            detail=f"会话 '{session_id}' 不存在",
        )

    swarm_runs = data.get("swarm_runs", []) or []
    events = data.get("events", []) or []

    nodes = [
        {
            "id": f"{r['swarm_id']}_{r.get('run_id', r['swarm_id'])}",
            "swarm_id": r["swarm_id"],
            "run_id": r.get("run_id", ""),
            "status": r.get("status", "unknown"),
            "quality_score": r.get("quality_score"),
            "triggered_by": r.get("triggered_by", ""),
            "error": r.get("error", ""),
        }
        for r in swarm_runs
    ]

    edges = []
    for i in range(len(swarm_runs) - 1):
        src = swarm_runs[i]
        tgt = swarm_runs[i + 1]
        if tgt.get("triggered_by") and tgt["triggered_by"] != "manual":
            matching = [e for e in events if e.get("event_id") == tgt["triggered_by"]]
            topic = matching[0]["topic"] if matching else f"{src['swarm_id']}_completed"
        else:
            topic = f"{src['swarm_id']}_completed"
        edges.append(
            {
                "source": f"{src['swarm_id']}_{src.get('run_id', src['swarm_id'])}",
                "target": f"{tgt['swarm_id']}_{tgt.get('run_id', tgt['swarm_id'])}",
                "topic": topic,
            }
        )

    data["release_gate"] = _derive_release_gate(swarm_runs)
    data["synthetic"] = bool(data.get("synthetic", False))
    data["session_type"] = data.get("session_type", "swarm") or "swarm"
    data["graph"] = {"nodes": nodes, "edges": edges}
    record_event(
        "swarm_session_replayed",
        session_id=session_id,
        run_id=session_id,
        status=data.get("status", "unknown"),
        gate_status="clear" if data["release_gate"] == "clear" else "blocked",
        gate_reason="" if data["release_gate"] == "clear" else "release_gate_blocked",
        tenant_slug=user.tenant_slug,
        user_role=user.role or "",
        **task_fingerprint(data.get("task_input", "")),
    )
    return data


@router.get("/projects/{project_id}/quality-report")
def api_project_quality_report(
    project_id: str,
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    """工部质量司四闸聚合 — 按 project_id 聚合同一客户项目下 pack_rd(sizing/cost
    确定性闸)+ hardware_design(DFM)+ process_manufacturing(工艺FMEA)的质量视图。

    触发 /api/swarm/run 时传入相同 project_id 才能被这里聚合识别为同一项目;
    不传 project_id 的历史 session 无法被此端点关联。
    """
    from src.project_quality_report import build_project_quality_report

    return build_project_quality_report(project_id)


@router.post("/lipu/compliance-report")
def api_lipu_compliance_report(
    body: LipuComplianceRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    """礼部合规审核司三源聚合 — lipu_vet(确定性素材回链硬闸)+ lipu_review(LLM 软意见)
    + 可选 xhs_monitor(舆情第三源,需 project_id 关联已完成的 xiaohongshu 蜂群)。

    真实执行一次 flow_lipu(非幂等,每次调用都是新的 LLM 稿件+核验);硬灯只由
    lipu_vet 决定,review_opinion/xhs_monitor_opinion 均为附加软意见,不参与判定。
    """
    from src.lipu_compliance_report import build_lipu_compliance_report

    return build_lipu_compliance_report(
        body.task_input, archive=body.archive, project_id=body.project_id
    )


@router.get("/sessions/{session_id}/pack-report")
def api_swarm_pack_report(
    session_id: str,
    user: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    """工部 PACK 完整方案报告 — 补上 2026-07-06 查明的缺口:flow_pack_rd 蜂群
    (11 专业角色 + 双确定性闸 sizing/cost + 五维度评审)产出完整,但此前前端
    reverify 只回读 session_id/status/source_label,11 个 output_fields 全被
    丢弃。本端点把该次 pack_rd run 的完整产出(确定性闸 verdict + 叙事段落 +
    各专业角色 sections)聚合返回,不重新发明确定性门,只做取数 + 诚实标源。
    """
    data = load_session(session_id)
    if not data:
        raise HTTPException(status_code=404, detail=f"会话 '{session_id}' 不存在")

    swarm_runs = data.get("swarm_runs", []) or []
    pack_run = next(
        (r for r in swarm_runs if r.get("swarm_id") == "pack_rd" and r.get("run_id")),
        None,
    )
    if not pack_run:
        return {
            "found": False,
            "session_id": session_id,
            "headline": "该会话未含 pack_rd(工部 PACK 研发)运行",
            "source_label": "NOT_APPLICABLE",
        }

    from src.pack_rd_report import build_pack_report

    report = build_pack_report(pack_run["run_id"])
    report["session_id"] = session_id
    return report


# ── 庄园·蜂群聚集地:21 蜂群 × 各自最近一次 run 的 join(B1) ──
_MINISTER_SWARM = {
    "jin_yi_wei": "jinyiwei",
    "qin_tian_jian": "tianjian",
    "li_bu_rites": "lipu",
    "hu_bu": "finance",
    "xing_bu": "legal",
    "gong_bu": "gongbu_review",
    "bing_bu": "haolong",
    "li_bu": "libu",
    "scribe": "shiguan_archive",
}


def _swarm_group_map() -> dict[str, str]:
    import yaml

    p = _PROJECT_ROOT / "config" / "manor_groups.yaml"
    out: dict[str, str] = {}
    try:
        doc = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
    except Exception:
        return out
    for g in doc.get("groups") or []:
        gid = g.get("id") or ""
        for m in g.get("ministers") or []:
            sw = _MINISTER_SWARM.get(m)
            if sw:
                out[sw] = gid
    return out


@router.get("/roster", response_model=list[SwarmRosterItem])
def api_swarm_roster(
    _: CurrentUser = Depends(get_current_user),
) -> list[SwarmRosterItem]:
    """蜂群聚集地:全部已注册蜂群 × 各自最近一次 run(没跑过=idle)。"""
    config_path = str(_PROJECT_ROOT / "config" / "swarm_orchestrator.yaml")
    try:
        orch = SwarmOrchestrator(config_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    latest: dict[str, dict] = {}
    for sid in list_sessions():
        data = load_session(sid)
        if not data:
            continue
        for r in data.get("swarm_runs") or []:
            swid = r.get("swarm_id")
            if not swid:
                continue
            st = r.get("start_time") or ""
            prev = latest.get(swid)
            if prev is None or st >= (prev.get("start_time") or ""):
                latest[swid] = r
    gmap = _swarm_group_map()
    roster: list[SwarmRosterItem] = []
    for swid, sw in orch.swarms.items():
        run = latest.get(swid)
        roster.append(
            SwarmRosterItem(
                id=swid,
                name=sw.name,
                group=gmap.get(swid, "unassigned"),
                status=(run.get("status") if run else None) or "idle",
                source_label=(run.get("source_label") if run else None) or "LIVE_SWARM",
                last_run_id=(run or {}).get("run_id"),
                last_quality_score=(run or {}).get("quality_score"),
                last_run_at=(run or {}).get("start_time"),
                latest_title=((run.get("task_input") or "")[:60] if run else None),
            )
        )
    return roster
