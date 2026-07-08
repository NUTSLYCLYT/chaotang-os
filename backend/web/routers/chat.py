"""聊天会话端点 —

  GET    /api/chat/sessions
  POST   /api/chat/sessions
  GET    /api/chat/sessions/{session_id}
  DELETE /api/chat/sessions/{session_id}
  POST   /api/chat/sessions/{session_id}/turns

⚠️ turns 端点是整个项目最复杂的 handler：4 类 Flow 分支
   （medical-appointment / medical-triage / 通用槽位 / 非槽位）
   + 槽位提取 + FlowEngine + 人工审批 + OpenClaw + token streaming，
   全部沿用 web/slot_filling.py 抽出的常量。
"""
from __future__ import annotations

import queue
import secrets
import threading
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from src.tenant import with_tenant
from src.step_log import load_run

from web.deps import get_current_user
from web.schemas.auth import CurrentUser
from web.schemas.chat import (
    ChatSessionCreateRequest,
    ChatSessionTurnRequest,
    ChatSessionTurnResponse,
)
from web.schemas.common import StatusResponse
from web.session_store import (
    delete_session,
    list_sessions_meta,
    load_session,
    save_session,
)
from web.slot_filling import (
    APPT_SLOT_CONV_SYSTEM,
    APPT_SLOT_EXTRACT_SYSTEM,
    APPT_SLOT_LABELS,
    APPT_SLOT_ORDER,
    MEDICAL_SLOT_CONV_SYSTEM,
    MEDICAL_SLOT_EXTRACT_SYSTEM,
    MEDICAL_SLOT_LABELS,
    MEDICAL_SLOT_ORDER,
    OPS_SLOT_EXTRACT_SYSTEM,
    OPS_SLOT_LABELS,
    OPS_SLOT_ORDER,
    SLOT_CONV_SYSTEM,
    SLOT_EXTRACT_SYSTEM,
    SLOT_LABELS,
    SLOT_ORDER,
    build_conv_history,
    extract_slots_llm,
    is_medical_flow,
    is_ops_flow,
    is_slot_flow,
    send_appointment_email,
)
from web.task_registry import (
    consume_approval,
    consume_openclaw,
    get_or_create_auto_queue,
    mark_status,
    register_approval,
    register_openclaw_wait,
    register_task,
)

router = APIRouter(prefix="/api/chat", tags=["chat"])


# ── 会话 CRUD ───────────────────────────────────────────

@router.get("/sessions")
def api_list_chat_sessions(
    _: CurrentUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    return list_sessions_meta()


@router.post("/sessions", status_code=201)
def api_create_chat_session(
    body: ChatSessionCreateRequest,
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    session_id = secrets.token_hex(8)
    raw_config = body.config or body.flow or "config/flow_opc.yaml"
    if raw_config and not raw_config.startswith("config/"):
        raw_config = f"config/{raw_config}"
    session = {
        "session_id": session_id,
        "config": raw_config,
        "created_at": datetime.now().isoformat(),
        "turns": [],
    }
    save_session(session)
    return session


@router.get("/sessions/{session_id}")
def api_get_chat_session(
    session_id: str,
    _: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    s = load_session(session_id)
    if s is None:
        raise HTTPException(status_code=404, detail="Session not found")

    # 旧 turn 补 assistant_output（避免前端 N 个并发 HTTP）
    changed = False
    for turn in s.get("turns", []) or []:
        if turn.get("assistant_output") or not turn.get("run_id"):
            continue
        try:
            run_log = load_run(turn["run_id"])
            if run_log is None:
                continue
            if run_log.final_output and isinstance(run_log.final_output, dict):
                content = "\n\n".join(
                    f"## {k}\n{v}" for k, v in run_log.final_output.items()
                )
            elif run_log.steps:
                out = run_log.steps[-1].output
                content = str(out) if out else ""
            else:
                content = ""
            if content:
                turn["assistant_output"] = content[:2000]
                changed = True
        except Exception:
            pass
    if changed:
        save_session(s)

    return s


@router.delete("/sessions/{session_id}", response_model=StatusResponse)
def api_delete_chat_session(
    session_id: str,
    _: CurrentUser = Depends(get_current_user),
) -> StatusResponse:
    delete_session(session_id)
    return StatusResponse(status="deleted")


# ── 内部辅助 ───────────────────────────────────────────

def _llm_call(system_prompt: str, user_content: str, fallback: str) -> str:
    """槽位对话用的轻量 LLM 调用。"""
    import os as _os

    from src.model_adapter import ModelAdapter
    adapter = ModelAdapter(
        model="openai/glm-4.5-air",
        api_base=_os.environ.get(
            "LITELLM_API_BASE", "http://127.0.0.1:4000/v1"
        ),
        api_key=_os.environ.get("LITELLM_PROXY_KEY", ""),
    )
    result = adapter.call(system_prompt, user_content)
    if result.get("status") == "success":
        return result.get("output", "").strip()
    return fallback


# ── POST /api/chat/sessions/{session_id}/turns ──────────

@router.post(
    "/sessions/{session_id}/turns",
    response_model=ChatSessionTurnResponse,
)
def api_chat_session_turn(
    session_id: str,
    body: ChatSessionTurnRequest,
    _: CurrentUser = Depends(get_current_user),
) -> ChatSessionTurnResponse:
    """异步发起新一轮对话，返回 task_id，前端订阅 /api/runs/stream/{task_id}。"""
    s = load_session(session_id)
    if s is None:
        raise HTTPException(status_code=404, detail="Session not found")

    user_input = body.user_input.strip()
    config_path = body.config or s.get("config", "config/flow_opc.yaml")
    qa_version = body.qa_version

    task_id = secrets.token_hex(8)
    q = register_task(task_id)

    def _quick_reply(reply: str, agent_name: str, fake_run_id: str) -> None:
        """发送槽位对话回复（不走 FlowEngine）。"""
        q.put({
            "type": "step", "step": 1, "total": 1,
            "name": agent_name, "elapsed": 0.1, "status": "done",
            "output": reply,
        })
        turn = {
            "user": user_input,
            "run_id": None,
            "timestamp": datetime.now().isoformat(),
            "final_output": None,
            "assistant_output": reply,
            "summary": None,
        }
        s_fresh = load_session(session_id) or s
        s_fresh.setdefault("turns", []).append(turn)
        save_session(s_fresh)
        mark_status(task_id, "done", run_id=fake_run_id, run_index_required=False)
        q.put({
            "type": "done", "run_id": fake_run_id,
            "session_id": session_id, "assistant_output": reply,
        })

    def _run() -> None:
        try:
            # ── 医疗导诊两阶段流程 ──
            if is_medical_flow(config_path):
                conv_history = build_conv_history(s)
                conv_history = (
                    (conv_history + f"\n用户：{user_input}")
                    if conv_history else f"用户：{user_input}"
                )
                phase = s.get("phase", "triage")

                # 阶段二：预约信息收集
                if phase == "appointment":
                    if _handle_medical_appointment(
                        s, conv_history, session_id,
                        task_id, q, _quick_reply,
                    ):
                        return

                # 阶段一：导诊信息收集
                current_slots = s.get("slots", {}) or {}
                updated_slots = extract_slots_llm(
                    conv_history, current_slots,
                    extract_system=MEDICAL_SLOT_EXTRACT_SYSTEM,
                    slot_order=MEDICAL_SLOT_ORDER,
                )
                s["slots"] = updated_slots

                if not all(updated_slots.get(sl) for sl in MEDICAL_SLOT_ORDER):
                    missing = [
                        MEDICAL_SLOT_LABELS[sl]
                        for sl in MEDICAL_SLOT_ORDER
                        if not updated_slots.get(sl)
                    ]
                    reply = _llm_call(
                        MEDICAL_SLOT_CONV_SYSTEM.format(
                            missing_info="、".join(missing)
                        ),
                        conv_history, "好的，能具体说说症状吗？",
                    )
                    s_fresh = load_session(session_id) or s
                    s_fresh["slots"] = updated_slots
                    save_session(s_fresh)
                    _quick_reply(
                        reply, "导诊顾问",
                        f"slot_{secrets.token_hex(6)}",
                    )
                    return
                # 槽位全填满 → 落入 FlowEngine

            # ── 通用槽位 flow（非医疗）──
            elif is_slot_flow(config_path):
                conv_history = build_conv_history(s)
                conv_history = (
                    (conv_history + f"\n用户：{user_input}")
                    if conv_history else f"用户：{user_input}"
                )
                current_slots = s.get("slots", {}) or {}
                updated_slots = extract_slots_llm(
                    conv_history, current_slots,
                    extract_system=SLOT_EXTRACT_SYSTEM,
                    slot_order=SLOT_ORDER,
                )
                s["slots"] = updated_slots

                if not all(updated_slots.get(sl) for sl in SLOT_ORDER):
                    missing = [
                        SLOT_LABELS[sl] for sl in SLOT_ORDER
                        if not updated_slots.get(sl)
                    ]
                    reply = _llm_call(
                        SLOT_CONV_SYSTEM.format(
                            missing_info="、".join(missing)
                        ),
                        conv_history, "好的，能再说说具体是什么场景吗？",
                    )
                    s_fresh = load_session(session_id) or s
                    s_fresh["slots"] = updated_slots
                    turn = {
                        "user": user_input, "run_id": None,
                        "timestamp": datetime.now().isoformat(),
                        "final_output": None,
                        "assistant_output": reply, "summary": None,
                    }
                    s_fresh.setdefault("turns", []).append(turn)
                    save_session(s_fresh)
                    _quick_reply(
                        reply, "想法分析师",
                        f"slot_{secrets.token_hex(6)}",
                    )
                    return

            # ── FlowEngine 真正执行 ──
            _run_flow_for_turn(
                s, user_input, config_path, qa_version,
                session_id, task_id, q,
            )

        except Exception as e:
            q.put({"type": "error", "message": str(e)})
            mark_status(task_id, "error", error=str(e))

    threading.Thread(target=with_tenant(_run), daemon=True).start()
    return ChatSessionTurnResponse(task_id=task_id, status="running")


# ── 私有：医疗预约阶段 ─────────────────────────────────

def _handle_medical_appointment(
    s: dict, conv_history: str, session_id: str,
    task_id: str, q: queue.Queue, quick_reply,
) -> bool:
    """已在预约阶段时的处理。返回 True 表示已处理（return），False 表示需要继续。"""
    current_appt = s.get("appt_slots", {}) or {}
    updated_appt = extract_slots_llm(
        conv_history, current_appt,
        extract_system=APPT_SLOT_EXTRACT_SYSTEM,
        slot_order=APPT_SLOT_ORDER,
    )
    s_fresh = load_session(session_id) or s
    s_fresh["appt_slots"] = updated_appt

    if not all(updated_appt.get(sl) for sl in APPT_SLOT_ORDER):
        missing = [
            APPT_SLOT_LABELS[sl] for sl in APPT_SLOT_ORDER
            if not updated_appt.get(sl)
        ]
        reply = _llm_call(
            APPT_SLOT_CONV_SYSTEM.format(missing_info="、".join(missing)),
            conv_history, "请问您方便告知姓名吗？",
        )
        save_session(s_fresh)
        quick_reply(reply, "预约助手", f"slot_{secrets.token_hex(6)}")
        return True

    # 三个预约槽位全填满 → 跑 flow_appointment 生成预约单
    triage_output = s.get("triage_output", "")
    appt_input = (
        f"患者姓名：{updated_appt['slot_patient_name']}\n"
        f"联系邮箱：{updated_appt['slot_contact_email']}\n"
        f"希望就诊日期：{updated_appt['slot_appt_date']}\n\n"
        f"导诊结果：\n{triage_output}"
    )
    s_fresh["phase"] = "done"
    save_session(s_fresh)

    from src.flow_engine import FlowEngine
    appt_engine = FlowEngine("config/flow_appointment.yaml")

    def on_step_done(i, total, name, elapsed, status, output=""):
        q.put({
            "type": "step", "step": i, "total": total, "name": name,
            "elapsed": round(elapsed, 1), "status": status,
            "output": output[:4000] if output else "",
        })

    user_input = (s.get("turns", [])[-1]["user"]
                  if s.get("turns") else "")
    appt_log = appt_engine.run(appt_input, on_step_done=on_step_done)
    appt_record = appt_log.steps[-1].output if appt_log.steps else ""

    email_sent = send_appointment_email(
        updated_appt["slot_contact_email"],
        updated_appt["slot_patient_name"],
        appt_record,
    )
    email_tip = (
        "\n\n📧 预约确认邮件已发送到您的邮箱。"
        if email_sent
        else "\n\n（提示：邮件发送功能暂未配置，请截图保存以上预约信息。）"
    )

    final_text = appt_record + email_tip
    turn = {
        "user": user_input,
        "run_id": appt_log.run_id,
        "timestamp": datetime.now().isoformat(),
        "final_output": appt_log.final_output,
        "assistant_output": final_text[:2000],
        "summary": None,
    }
    s_fresh2 = load_session(session_id) or s_fresh
    s_fresh2.setdefault("turns", []).append(turn)
    save_session(s_fresh2)
    mark_status(task_id, "done", run_id=appt_log.run_id)
    q.put({
        "type": "done", "run_id": appt_log.run_id,
        "session_id": session_id, "assistant_output": final_text,
    })
    return True


# ── 私有：标准 FlowEngine 执行（含 token / 审批 / openclaw）

def _run_flow_for_turn(
    s: dict,
    user_input: str,
    config_path: str,
    qa_version: str | None,
    session_id: str,
    task_id: str,
    q: queue.Queue,
) -> None:
    from src.flow_engine import FlowEngine
    engine = FlowEngine(config_path, qa_version=qa_version)

    # 构建多轮对话历史 context
    prev_turns = s.get("turns", []) or []
    context_extra: dict = {}
    if prev_turns:
        if is_ops_flow(config_path):
            existing_slots = s.get("ops_slots", {}) or {}
            slot_lines = []
            for k in OPS_SLOT_ORDER:
                v = existing_slots.get(k)
                if v:
                    slot_lines.append(f"- {OPS_SLOT_LABELS[k]}：{v}")
            recent_parts = []
            for t in prev_turns[-2:]:
                recent_parts.append(f"用户：{t['user']}")
                ao = t.get("assistant_output", "")
                if ao:
                    recent_parts.append(f"助手：{ao[:600]}")
            parts = []
            if slot_lines:
                parts.append("【已确认需求】\n" + "\n".join(slot_lines))
            if recent_parts:
                parts.append("【最近对话】\n" + "\n".join(recent_parts))
            if parts:
                context_extra["conversation_history"] = "\n\n".join(parts)
        else:
            history_parts = []
            for t in prev_turns[-6:]:
                history_parts.append(f"用户：{t['user']}")
                if t.get("assistant_output"):
                    history_parts.append(f"助手：{t['assistant_output'][:800]}")
                elif t.get("summary"):
                    history_parts.append(f"助手摘要：{t['summary']}")
                elif t.get("final_output"):
                    fo = t["final_output"]
                    if isinstance(fo, dict):
                        summary_fields = list(fo.items())[:3]
                        history_parts.append(
                            "助手输出（摘要）："
                            + "；".join(
                                f"{k}={str(v)[:200]}"
                                for k, v in summary_fields
                            )
                        )
            if history_parts:
                context_extra["conversation_history"] = "\n".join(history_parts)

    def on_step_done(i, total, name, elapsed, status, output=""):
        q.put({
            "type": "step", "step": i, "total": total, "name": name,
            "elapsed": round(elapsed, 1), "status": status,
            "output": output[:4000] if output else "",
        })

    def on_token(step_idx, token):
        q.put({"type": "token", "step": step_idx, "content": token})

    def on_approval_required(step_idx, step_name, context):
        steps = context.get("steps", [])
        prev_output = steps[-1]["output"] if steps else ""
        evt = register_approval(task_id)
        q.put({
            "type": "approval_required",
            "step": step_idx, "step_name": step_name,
            "preview": prev_output[:3000], "task_id": task_id,
        })
        evt.wait(timeout=600)
        return consume_approval(task_id)

    def on_openclaw_turn(step_idx, step_name, current_output):
        step_cfg = (
            engine.step_configs[step_idx]
            if step_idx < len(engine.step_configs) else {}
        )
        is_auto = step_cfg.get("openclaw_auto_loop", False)
        q.put({
            "type": "openclaw_turn", "auto_mode": is_auto,
            "step": step_idx, "step_name": step_name,
            "output": current_output[:6000], "task_id": task_id,
        })
        if is_auto:
            uq = get_or_create_auto_queue(task_id)
            try:
                return uq.get_nowait()
            except queue.Empty:
                return ""
        else:
            evt = register_openclaw_wait(task_id)
            evt.wait(timeout=600)
            return consume_openclaw(task_id)

    run_log = engine.run(
        user_input,
        on_step_done=on_step_done,
        on_token=on_token,
        context_extra=context_extra,
        on_approval_required=on_approval_required,
        on_openclaw_turn=on_openclaw_turn,
    )

    # 更新会话历史
    last_step_output = ""
    if run_log.steps:
        raw = run_log.steps[-1].output
        last_step_output = raw if isinstance(raw, str) else str(raw or "")
    turn = {
        "user": user_input,
        "run_id": run_log.run_id,
        "timestamp": datetime.now().isoformat(),
        "final_output": run_log.final_output,
        "assistant_output": last_step_output[:2000],
        "summary": None,
    }
    s_fresh = load_session(session_id) or s
    s_fresh.setdefault("turns", []).append(turn)
    if is_slot_flow(config_path) and "slots" in s:
        s_fresh["slots"] = s["slots"]
    # 运维蜂群：每轮后异步更新 ops_slots
    if is_ops_flow(config_path):
        full_history = build_conv_history(s_fresh)
        updated_ops = extract_slots_llm(
            full_history,
            s_fresh.get("ops_slots", {}) or {},
            extract_system=OPS_SLOT_EXTRACT_SYSTEM,
            slot_order=OPS_SLOT_ORDER,
        )
        s_fresh["ops_slots"] = updated_ops

    # 医疗：导诊完成切到预约阶段
    if is_medical_flow(config_path) and s.get("phase", "triage") == "triage":
        s_fresh["phase"] = "appointment"
        s_fresh["triage_output"] = last_step_output
        appt_prompt = (
            "\n\n---\n为您整理完就诊建议。"
            "接下来可以帮您登记预约，请问您的姓名是？"
        )
        last_step_output = last_step_output + appt_prompt
        turn["assistant_output"] = last_step_output[:2000]
        s_fresh["turns"][-1] = turn
        done_event = {
            "type": "done", "run_id": run_log.run_id,
            "session_id": session_id, "assistant_output": last_step_output,
        }
    else:
        done_event = {
            "type": "done", "run_id": run_log.run_id,
            "session_id": session_id,
        }
    save_session(s_fresh)
    mark_status(task_id, "done", run_id=run_log.run_id)
    q.put(done_event)
