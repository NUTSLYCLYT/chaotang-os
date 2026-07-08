"""部门端点(T1+T-be3):dept/{code}/overview。

支持 6 个部门 code:finance / legal / market / guard / ops / physician。
字段严格按 .plans/chaotang-manor/docs/api-contracts.md。
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from web.deps import get_current_user
from web.schemas.auth import CurrentUser
from web.routers._envelope import ok, fail

router = APIRouter(prefix="/api/chaotang/dept", tags=["dept"])

# 允许的 dept code(T-be3 扩至 6 个；2026-06-11 增 works 别名)
_VALID_CODES = {"finance", "legal", "market", "guard", "ops", "physician", "works", "hr", "personnel"}

# 跨仓码别名：chaotang-web-lyt 前端把工部叫 "works"（REAL_AGENT_DEPTS / dept-registry），
# 本仓 MINISTER_DEFS 叫 "product"。此前 works 不在白名单 → 前端 overview 必 fail →
# 部门 agent 静默回落种子数据却仍计入"真司"覆盖率。数据查询统一走 product。
_CODE_ALIASES = {"works": "product", "personnel": "hr"}


def _build_key_metrics(
    code: str,
    full_dept_memorials: list[dict],
    active_tasks: list[dict],
) -> list[dict]:
    """从奏折/任务计数动态派生 keyMetrics(恒 4 项,永不为空)。

    值:有真源(奏折/任务计数)就用真值,无数据时为 0/"暂无"/演示值(标[演示])。
    标签集固定,不因数据为空而整条删除。
    full_dept_memorials 须为完整 memorial dict(含 riskLevel 字段),不是投影后的 Brief。
    """
    total = len(full_dept_memorials)
    pending = sum(1 for m in full_dept_memorials if m.get("status") == "pending")
    approved = sum(1 for m in full_dept_memorials if m.get("status") in ("approved", "archived"))
    running_count = len(active_tasks)
    risk_count = sum(
        1 for m in full_dept_memorials if m.get("riskLevel") in ("critical", "high")
    )

    if code == "finance":
        # 真实财报(来源:H:/各部门备份/财务部 本司202512财务报表.xls,2025年报)。
        # 新财报到位后更新此处数值;深科技初创真实画像,不美化。
        return [
            {"label": "营业收入(2025)", "value": "152.8", "unit": "万元"},
            {"label": "净利润(2025)", "value": "-153.7", "unit": "万元"},
            {"label": "资产总计", "value": "673.9", "unit": "万元"},
            {"label": "负债合计", "value": "1168.0", "unit": "万元"},
        ]
    if code == "legal":
        pass_rate = f"{round(approved / total * 100)}%" if total else "—"
        return [
            {"label": "合同/合规奏折", "value": str(total), "unit": "件"},
            {"label": "风险预警", "value": str(risk_count), "unit": "项"},
            {"label": "合规通过率", "value": pass_rate},
            {"label": "在跑任务", "value": str(running_count), "unit": "个"},
        ]
    if code == "market":
        return [
            {"label": "市场奏折", "value": str(total), "unit": "件"},
            {"label": "待批阅", "value": str(pending), "unit": "件"},
            {"label": "在跑任务", "value": str(running_count), "unit": "个"},
            {"label": "风险预警", "value": str(risk_count), "unit": "项"},
        ]
    if code == "guard":
        # 风险预警 = 高/危急奏折数(真实); 本月异常事件 = archived risk 奏折数(已处置,语义不同)
        resolved_risk = sum(
            1 for m in full_dept_memorials
            if m.get("riskLevel") in ("critical", "high")
            and m.get("status") in ("approved", "archived")
        )
        return [
            {"label": "风险预警", "value": str(risk_count), "unit": "项"},
            {"label": "舆情监控", "value": "正常[演示]"},
            {"label": "内控检查", "value": "通过[演示]"},
            {"label": "本月异常事件", "value": str(resolved_risk), "unit": "起"},
        ]
    if code == "ops":
        # 兵部:战局/交付语义标签,值:能计算的用真值,领域指标标[演示]
        risk_label = "高" if risk_count >= 2 else ("中" if risk_count == 1 else "低")
        return [
            {"label": "今日战况", "value": "推进中[演示]" if running_count == 0 else f"{running_count}项推进中"},
            {"label": "待决事项", "value": str(pending), "unit": "项"},
            {"label": "资源占用率", "value": "73%[演示]"},
            {"label": "当前风险等级", "value": risk_label},
        ]
    if code == "physician":
        # 太医:健康诊断语义标签
        exec_rate = f"{round(approved / total * 100)}%" if total else "91%[演示]"
        return [
            {"label": "主体健康指数", "value": "86[演示]", "unit": "/100"},
            {"label": "高层负荷", "value": "偏高[演示]"},
            {"label": "团队执行达成率", "value": exec_rate},
            {"label": "异常风险点", "value": str(risk_count), "unit": "处"},
        ]
    # 兜底(其他 code 不应走到这里)
    return [
        {"label": "奏折总量", "value": str(total), "unit": "件"},
        {"label": "待批阅", "value": str(pending), "unit": "件"},
        {"label": "在跑任务", "value": str(running_count), "unit": "个"},
        {"label": "风险预警", "value": str(risk_count), "unit": "项"},
    ]


# MemorialBrief 契约字段(8 个):id/title/sourceDepartment/agentCode/priority/status/summary/createdAt
_MEMORIAL_BRIEF_KEYS = (
    "id", "title", "sourceDepartment", "agentCode",
    "priority", "status", "summary", "createdAt",
)


def _to_memorial_brief(m: dict) -> dict:
    """将完整 memorial dict 投影为 MemorialBrief(8 字段),避免超出契约。"""
    return {k: m.get(k) for k in _MEMORIAL_BRIEF_KEYS}


@router.get("/{code}/overview")
def dept_overview(code: str, _: CurrentUser = Depends(get_current_user)) -> dict:
    if code not in _VALID_CODES:
        return fail(f"不支持的部门 code: {code!r},允许值: {sorted(_VALID_CODES)}")
    # 别名归一：响应仍回显请求方的 code，数据按本仓码查询
    requested_code = code
    code = _CODE_ALIASES.get(code, code)

    from src.chaotang_api import (
        MINISTER_DEFS, aggregate_ministers, aggregate_risks, enrich_memorial
    )
    from src.chaotang_agents import agent_code_of
    from web.task_registry import task_snapshot

    # ── 奏折(真实数据)──
    try:
        from web.routers.throne import _build_memorial_list
        all_memorials = _build_memorial_list()
    except Exception:
        all_memorials = []

    # 该部门近期奏折 — 投影为 MemorialBrief(8 字段)
    dept_memorials = [
        _to_memorial_brief(m)
        for m in all_memorials if m.get("sourceDepartment") == code
    ][:10]

    # ── 运行中任务(从 task_snapshot 按部门过滤,P1-10)──
    active_tasks = []
    all_running_depts: list[str] = []
    for tid, t in task_snapshot().items():
        if t.get("status") != "running":
            continue
        task_depts: list[str] = t.get("departments") or []
        all_running_depts.extend(task_depts)
        if code in task_depts:
            active_tasks.append({
                "taskId": tid,
                "title": (t.get("task_input") or "")[:40] or "未命名",
                "progressPct": _progress(t),
            })
    active_tasks = active_tasks[:6]

    # ── 部门状态(从 aggregate_ministers 推断,注入在跑任务部门,P1-2)──
    ministers_status = aggregate_ministers(all_memorials, all_running_depts)
    dept_status_entry = next(
        (m for m in ministers_status if m["department"] == code), None
    )
    status = dept_status_entry["status"] if dept_status_entry else "idle"

    # ── 风险列表(过滤出该部门相关)──
    dept_risks_raw = [
        m for m in all_memorials
        if m.get("sourceDepartment") == code and m.get("riskLevel") in ("critical", "high")
    ]
    risks = [
        {"label": r["title"], "level": r.get("riskLevel", "medium")}
        for r in dept_risks_raw[:5]
    ]

    # ── 部门定义信息(从 MINISTER_DEFS)──
    minister_def = next(
        (d for d in MINISTER_DEFS if d["department"] == code), None
    )
    minister_info = {}
    if minister_def:
        minister_info = {
            "id": minister_def["id"],
            "name": minister_def["name"],
            "role": minister_def["role"],
            "iconKey": minister_def["iconKey"],
            "description": minister_def["description"],
        }

    return ok({
        "code": requested_code,
        "agentCode": agent_code_of(code),
        "minister": minister_info,
        "status": status,
        "recentMemorials": dept_memorials,
        "activeTasks": active_tasks,
        # 传入完整 memorial dict(含 riskLevel)而非投影后的 Brief
        "keyMetrics": _build_key_metrics(
            code,
            [m for m in all_memorials if m.get("sourceDepartment") == code],
            active_tasks,
        ),
        "risks": risks,
    })


def _progress(t: dict) -> int:
    done = t.get("completed_steps", 0) or 0
    total = t.get("total_steps") or 0
    return int(done / total * 100) if total else (100 if t.get("status") == "done" else 0)
