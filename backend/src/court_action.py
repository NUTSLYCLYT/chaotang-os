"""src/court_action.py — 统一动作 dispatch(洞① P0:court_doc 的按钮点了有后端)。

钦天监 2026-07-02 三决:统一端点 + 全闸(auth+C2+二次确认)+ 状态机。
court_doc 已给前端下发每个按钮的动词,后端一处 dispatch 认所有动词 → 路由 handler。
前端只发 action 字段,不用记 11 部门×N 按钮的 URL 映射。

四道闸(全闸):
  ① 合法性:action 必须在该 court_doc 的 actions 白名单里(越权动词拒)
  ② C2 权限:放行类动作(release)只有合法把关人(yushi/harness)能发 —— 复用 persona_registry
  ③ 不可逆二次确认:archive/escalate/release 等不可逆动作,无 confirm → requires_confirm
  ④ 幂等:同 idempotency_key 重放 → 返回上次结果,不重复执行(防误点/网络重试双发)

纯函数:doc 进、结果出,不碰 web/DB。web 层负责 actor 鉴权 + 落库 + 信封。
"""
from __future__ import annotations

from src.persona_registry import is_valid_gatekeeper

# 工作流状态机(建议③):按钮点击驱动状态,前端据 state 灰化/高亮
STATE_DRAFT = "草拟"
STATE_PENDING = "待审"
STATE_APPROVED = "已准奏"
STATE_REJECTED = "已驳回"
STATE_ESCALATED = "已升阶"
STATE_ARCHIVED = "已归档"

# 动作注册表:每个 court_doc 动词的语义。irreversible→二次确认;gatekeeper_only→C2;to_state→状态转移
# to_state=None 表示不改状态(读/侧动作,如查证据、喂飞轮)
_ACTIONS: dict[str, dict] = {
    # 通用三键
    "apply_fixes":        {"label": "采纳修改", "irreversible": False, "gatekeeper_only": False, "to_state": STATE_PENDING},
    "escalate_court":     {"label": "呈丞相/皇帝", "irreversible": True,  "gatekeeper_only": False, "to_state": STATE_ESCALATED},
    "archive_amulet":     {"label": "归档护身符", "irreversible": True,  "gatekeeper_only": False, "to_state": STATE_ARCHIVED},
    "export_amulet":      {"label": "导出护身符", "irreversible": True,  "gatekeeper_only": False, "to_state": STATE_ARCHIVED},
    # 部门专属
    "approve_preview":    {"label": "准奏预览", "irreversible": False, "gatekeeper_only": False, "to_state": STATE_APPROVED},
    "adopt_copy":         {"label": "采用文案", "irreversible": False, "gatekeeper_only": False, "to_state": STATE_APPROVED},
    "take_next_action":   {"label": "执行下一步", "irreversible": False, "gatekeeper_only": False, "to_state": STATE_APPROVED},
    "run_release_gate":   {"label": "跑发布门禁", "irreversible": False, "gatekeeper_only": False, "to_state": STATE_PENDING},
    "confirm_appointment":{"label": "确认任命", "irreversible": True,  "gatekeeper_only": False, "to_state": STATE_APPROVED},
    "confirm_start":      {"label": "确认启动", "irreversible": False, "gatekeeper_only": False, "to_state": STATE_APPROVED},
    "reorder":            {"label": "调整顺序", "irreversible": False, "gatekeeper_only": False, "to_state": None},
    "trace_evidence":     {"label": "追溯证据", "irreversible": False, "gatekeeper_only": False, "to_state": None},
    "feed_flywheel":      {"label": "喂飞轮复盘", "irreversible": False, "gatekeeper_only": False, "to_state": None},
    "verify_source":      {"label": "核验信源", "irreversible": False, "gatekeeper_only": False, "to_state": None},
    # 御史专属:C2 只有把关人能放行/驳回升阶
    "release":            {"label": "放行", "irreversible": True,  "gatekeeper_only": True,  "to_state": STATE_APPROVED},
    "block_escalate":     {"label": "拦截升阶", "irreversible": True,  "gatekeeper_only": True,  "to_state": STATE_ESCALATED},
}


def action_meta(action: str) -> dict | None:
    return _ACTIONS.get(action)


def _err(code: str, msg: str) -> dict:
    return {"status": "error", "code": code, "reason": msg}


def dispatch(
    doc: dict,
    action: str,
    *,
    actor_role: str = "",
    confirm: bool = False,
    idempotency_key: str | None = None,
    seen: dict | None = None,
) -> dict:
    """执行一个 court_doc 动作。doc 需含 actions(白名单)与可选 workflow.state。

    返回 {status: ok|error|needs_confirm, ...}。全闸不通过一律拒,绝不静默放行。
    """
    meta = _ACTIONS.get(action)
    if meta is None:
        return _err("unknown_action", f"未知动作:{action}")

    # 闸① 合法性:必须在该 doc 下发的按钮白名单里
    allowed = doc.get("actions") or []
    if action not in allowed:
        return _err("not_allowed_here", f"动作 {action} 不在该文书按钮白名单({allowed})")

    # 闸② C2:放行类只有合法把关人能发(复用宪法 C2,防任何人 POST 就放行)
    if meta["gatekeeper_only"] and not is_valid_gatekeeper(actor_role):
        return _err("forbidden_gatekeeper",
                    f"动作 {action} 需御史/harness 把关人,当前 actor='{actor_role}' 无权")

    # 闸④ 幂等:同 key 重放直接返回上次结果(先于执行,防双发)
    if idempotency_key and seen is not None and idempotency_key in seen:
        return {**seen[idempotency_key], "idempotent_replay": True}

    # 闸③ 不可逆二次确认:未确认 → 不执行,要前端弹确认
    if meta["irreversible"] and not confirm:
        return {"status": "needs_confirm", "action": action, "label": meta["label"],
                "message": f"「{meta['label']}」不可逆,请二次确认后重发(带 confirm=true)"}

    cur = (doc.get("workflow") or {}).get("state") or STATE_PENDING
    new_state = meta["to_state"] or cur
    result = {
        "status": "ok",
        "action": action,
        "label": meta["label"],
        "prev_state": cur,
        "new_state": new_state,
        "irreversible": meta["irreversible"],
    }
    if idempotency_key and seen is not None:
        seen[idempotency_key] = result
    return result
