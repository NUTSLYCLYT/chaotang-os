"""朝堂 OS 前端聚合接口。

承接 chaotang-os/docs/API_CONTRACT.md §3.1 / §3.2 契约：
  - throne_overview(): 朝堂大殿首屏聚合
  - enrich_memorial(run_summary): 把 _run_summary 转译为 Memorial 形态
  - filter_runs_query(runs, params): 多维筛选 + 分页

设计原则：
  - 不修改 jiqun_ai 既有数据结构，仅做 view 层翻译
  - 后端 flow_name → 朝堂部门 slug 的映射在这里维护，避免散落
"""

from __future__ import annotations

from datetime import datetime
from typing import Iterable

from src.chaotang_agents import agent_code_of

# ───────── flow → 朝堂部门映射 ─────────
# 一个 flow 默认归一个部门；丞相只承接 OPC 总调度
FLOW_TO_DEPT: dict[str, str] = {
    # 丞相 / 总调度
    "flow_opc.yaml": "chancellor",
    "flow_court.yaml": "chancellor",
    # 户部 / 财务
    "flow_finance.yaml": "finance",
    "flow_quotation.yaml": "finance",
    # 刑部 / 法务
    "flow_legal.yaml": "legal",
    # 工部 / 研发
    "flow_product.yaml": "product",
    "flow_pack_rd.yaml": "product",
    "flow_battery_stage_gate.yaml": "product",
    "flow_sourcing.yaml": "product",
    "flow_sdlc.yaml": "product",
    "flow_hardware_design.yaml": "product",
    "flow_process_manufacturing.yaml": "product",
    # 礼部 / 市场
    "flow_xiaohongshu.yaml": "market",
    "flow_haolong.yaml": "market",
    "flow_voice_sales.yaml": "market",
    "flow_brand_strategy.yaml": "market",
    # 兵部 / 运营
    "flow_ai_ops.yaml": "ops",
    # 史官 / 记忆
    "flow_ima.yaml": "historian",
    # 太医 / 诊断 (评估/复核)
    "flow_evaluate.yaml": "physician",
    "flow_medical.yaml": "physician",
    "flow_appointment.yaml": "physician",
    "flow_demo.yaml": "physician",
    "flow_demo_spawn.yaml": "physician",
    "flow_requirements.yaml": "physician",
}


def dept_of_flow(flow_name: str | None) -> str:
    """flow 文件名 → 朝堂部门 slug。无匹配走丞相。"""
    if not flow_name:
        return "chancellor"
    return FLOW_TO_DEPT.get(flow_name, "chancellor")


# ───────── QA → 朝堂优先级/风险 ─────────
def _derive_priority(qa_result: dict | None, quality_info: dict | None) -> str:
    """六维度最低分 + pass/fail → urgent / high / normal / low"""
    if not qa_result and not quality_info:
        return "normal"
    qa_pass = (
        (qa_result or {}).get("qa_result") if isinstance(qa_result, dict) else None
    )
    scores = (quality_info or {}).get("scores") or {}
    min_dim = min(scores.values()) if scores else 5
    if qa_pass == "fail" or min_dim < 2.5:
        return "urgent"
    if min_dim < 3.5:
        return "high"
    if min_dim < 4.5:
        return "normal"
    return "low"


def _derive_risk(qa_result: dict | None, quality_info: dict | None) -> str:
    """同优先级，但映射到 risk level"""
    p = _derive_priority(qa_result, quality_info)
    return {"urgent": "critical", "high": "high", "normal": "medium", "low": "low"}[p]


def _derive_status(run_status: str | None) -> str:
    """run_status (pass/fail/running) → memorial status"""
    if run_status == "pass":
        return "approved"
    if run_status == "fail":
        return "pending"  # 失败的留给陛下批阅
    if run_status == "running":
        return "running"
    return "pending"


def _summary_text(final_output: dict | None, task_input: str) -> str:
    """从 final_output 第一字段或 task_input 派生 200 字以内摘要。"""
    if not final_output:
        return (task_input or "").strip()[:200]
    for k in ("核心需求", "客户背景", "项目概要", "需求规格说明", "需求分析", "议题"):
        if k in final_output:
            v = str(final_output[k] or "").strip()
            if v:
                return v[:200]
    # 取第一个非空字段
    for v in final_output.values():
        if v:
            return str(v).strip()[:200]
    return (task_input or "")[:200]


def _suggested_action(final_output: dict | None) -> str | None:
    if not final_output:
        return None
    for k in ("风险与建议", "决策建议", "建议行动", "下一步行动", "实施建议"):
        v = final_output.get(k)
        if v:
            return str(v).strip()[:300]
    return None


# ───────── 主翻译函数 ─────────
def enrich_memorial(summary: dict) -> dict:
    """_run_summary 输出 → 朝堂 Memorial 形态。

    2026-06-10 拟奏节点接线: summary/suggestedAction 改由 MemorialCard 槽位拼装
    单源派生(memorial_drafter + yushi_gate), 截断式提取仅作 drafter 异常时的显式
    降级(带 logger.warning, 禁静默)。卡片全文挂 memorialCard 字段供回奏箱消费。
    """
    import logging

    from src.contracts.memorial_card import NEXT_ACTION_LABELS
    from src.memorial_drafter import draft_memorial_card
    from src.yushi_gate import apply_verdict, judge_memorial

    logger = logging.getLogger(__name__)

    qa = summary.get("qa_result")
    quality = summary.get("quality_score") or {}
    final_output = summary.get("final_output")  # 若由调用方拼入
    title = (summary.get("task_input") or "").strip().splitlines()[0][
        :120
    ] or "（无标题奏折）"
    dept = dept_of_flow(summary.get("flow_name"))

    # 拟奏 + 御史判卷 (确定性, 无 LLM)
    card_payload: dict | None = None
    seal_info: dict | None = None
    card_summary: str | None = None
    card_action: str | None = None
    try:
        card, draft_meta = draft_memorial_card(
            task_id=str(summary.get("run_id") or ""),
            task_input=summary.get("task_input") or "",
            final_output=final_output if isinstance(final_output, dict) else None,
            qa_result=qa if isinstance(qa, dict) else None,
            department=dept,
            swarm_id=str(summary.get("flow_name") or ""),
            run_id=str(summary.get("run_id") or ""),
            snapshot_sha256=summary.get("retrieved_snapshot_sha256"),
        )
        verdict = judge_memorial(
            card,
            qa_result=qa if isinstance(qa, dict) else None,
            total_score=summary.get("total_score"),
            draft_meta=draft_meta,
        )
        final_card = apply_verdict(card, verdict)
        card_payload = final_card.model_dump()
        seal_info = verdict
        card_summary = final_card.verdict_summary or None
        if final_card.next_action:
            card_action = NEXT_ACTION_LABELS.get(
                final_card.next_action, final_card.next_action
            )
    except Exception as e:  # 拟奏失败显式降级到截断器, 禁静默 (铁律2)
        logger.warning(
            "enrich_memorial: 拟奏节点失败, 显式降级截断提取 run_id=%s err=%s",
            summary.get("run_id"),
            e,
        )

    return {
        "id": summary["run_id"],
        "title": title,
        "sourceDepartment": dept,
        "agentCode": agent_code_of(dept),
        "submittedBy": (summary.get("step_summaries") or [{}])[0].get(
            "agent_name", "未署名"
        ),
        "priority": _derive_priority(qa if isinstance(qa, dict) else None, quality),
        "riskLevel": _derive_risk(qa if isinstance(qa, dict) else None, quality),
        "status": _derive_status(summary.get("run_status")),
        "summary": card_summary
        or _summary_text(final_output, summary.get("task_input") or ""),
        "suggestedAction": card_action or _suggested_action(final_output),
        "deadline": None,
        "createdAt": summary.get("created_at"),
        "qualityScore": summary.get("total_score"),
        "grade": summary.get("grade"),
        # 回奏卡全文 + 御史判决 (回奏箱 UI 的数据源; 原始 final_output 不外露)
        "memorialCard": card_payload,
        "qualitySeal": (seal_info or {}).get("seal"),
        "qualitySealLabel": (seal_info or {}).get("seal_label"),
        "sealReasons": (seal_info or {}).get("reasons", []),
    }


# ───────── 列表筛选 ─────────
def filter_runs_query(items: Iterable[dict], params: dict) -> list[dict]:
    """前端 /api/runs?status=&dept=&priority=&q=&limit=&offset= 的实现。"""
    status = params.get("status")
    dept = params.get("dept")
    priority = params.get("priority")
    q = (params.get("q") or "").strip().lower()

    out: list[dict] = []
    for m in items:
        if status and m.get("status") != status:
            continue
        if dept and m.get("sourceDepartment") != dept:
            continue
        if priority and m.get("priority") != priority:
            continue
        if q:
            hay = (
                str(m.get("title") or "") + " " + str(m.get("summary") or "")
            ).lower()
            if q not in hay:
                continue
        out.append(m)

    try:
        limit = int(params.get("limit") or 0)
    except Exception:
        limit = 0
    try:
        offset = int(params.get("offset") or 0)
    except Exception:
        offset = 0

    total = len(out)
    if limit > 0:
        out = out[offset : offset + limit]
    elif offset > 0:
        out = out[offset:]
    return total, out


# ───────── 朝堂 11 群臣 ─────────
MINISTER_DEFS = [
    {
        "id": "minister_chancellor",
        "name": "丞相",
        "role": "总调度",
        "department": "chancellor",
        "iconKey": "crown",
        "route": "/app/chancellor",
        "description": "总调度 / 战略中枢",
    },
    {
        "id": "minister_finance",
        "name": "户部",
        "role": "财务",
        "department": "finance",
        "iconKey": "coins",
        "route": "/app/departments/finance",
        "description": "财务 / 预算 / 成本",
    },
    {
        "id": "minister_hr",
        "name": "吏部",
        "role": "人事",
        "department": "hr",
        "iconKey": "users",
        "route": "/app/departments/hr",
        "description": "人事 / 组织 / 招聘",
    },
    {
        "id": "minister_legal",
        "name": "刑部",
        "role": "法务",
        "department": "legal",
        "iconKey": "scale",
        "route": "/app/departments/legal",
        "description": "法务 / 合同 / 风险",
    },
    {
        "id": "minister_product",
        "name": "工部",
        "role": "研发",
        "department": "product",
        "iconKey": "wrench",
        "route": "/app/departments/product",
        "description": "研发 / 产品 / 技术",
    },
    {
        "id": "minister_market",
        "name": "礼部",
        "role": "市场",
        "department": "market",
        "iconKey": "megaphone",
        "route": "/app/departments/market",
        "description": "市场 / 品牌 / 客户",
    },
    {
        "id": "minister_ops",
        "name": "兵部",
        "role": "运营",
        "department": "ops",
        "iconKey": "shield",
        "route": "/app/departments/ops",
        "description": "项目 / 交付 / 执行",
    },
    {
        "id": "minister_historian",
        "name": "史官",
        "role": "记忆",
        "department": "historian",
        "iconKey": "book-open",
        "route": "/app/archive",
        "description": "会议纪要 / 企业记忆",
    },
    {
        "id": "minister_guard",
        "name": "锦衣卫",
        "role": "风控",
        "department": "guard",
        "iconKey": "shield-alert",
        "route": "/app/war-room",
        "description": "风控 / 舆情 / 内控",
    },
    {
        "id": "minister_astronomer",
        "name": "钦天监",
        "role": "预测",
        "department": "astronomer",
        "iconKey": "telescope",
        "route": "/app/war-room",
        "description": "预测 / 情报 / 趋势",
    },
    {
        "id": "minister_physician",
        "name": "太医",
        "role": "诊断",
        "department": "physician",
        "iconKey": "stethoscope",
        "route": "/app/departments/hr",
        "description": "组织健康 / 经营体检",
    },
]


def aggregate_ministers(
    memorials: list[dict],
    running_task_depts: "list[str] | None" = None,
) -> list[dict]:
    """根据近期奏折 + 在跑任务反推 11 群臣状态。

    Args:
        memorials: 全部奏折列表(enrich_memorial 格式)
        running_task_depts: 当前有进行中任务的部门 slug 列表(P1-2);
                            传入后,该部门如本无 running 奏折,状态提升为 processing。
    """
    _running_task_dept_set: set[str] = set(running_task_depts or [])

    # 部门 → 该部门最近一条 memorial 的状态/风险
    dept_memo: dict[str, dict] = {}
    dept_pending: dict[str, int] = {}
    for m in memorials:
        d = m.get("sourceDepartment", "chancellor")
        dept_pending[d] = dept_pending.get(d, 0) + (
            1 if m.get("status") == "pending" else 0
        )
        if d not in dept_memo:
            dept_memo[d] = m

    out = []
    for defn in MINISTER_DEFS:
        d = defn["department"]
        recent = dept_memo.get(d)
        pending = dept_pending.get(d, 0)
        risk = recent.get("riskLevel", "low") if recent else "low"
        has_running_task = d in _running_task_dept_set

        if risk in ("critical", "high"):
            status = "risk"
        elif (recent and recent.get("status") == "running") or has_running_task:
            # 有进行中奏折 OR 有进行中 task_snapshot 任务 → processing
            status = "processing"
        elif pending > 0:
            status = "pending_review"
        elif recent and recent.get("status") in ("approved", "archived"):
            status = "done"
        else:
            status = "idle"

        out.append(
            {
                **defn,
                "status": status,
                "pendingCount": pending,
                "riskLevel": risk,
                "lastAction": recent.get("createdAt") if recent else None,
                "lastRunId": recent.get("id") if recent else None,
            }
        )
    return out


def aggregate_risks(memorials: list[dict], limit: int = 5) -> list[dict]:
    """从 memorials 派生 Risk 列表（无独立 risk 表时用这个）。"""
    risks = []
    for m in memorials:
        if m.get("riskLevel") in ("critical", "high"):
            risks.append(
                {
                    "id": f"risk_{m['id']}",
                    "title": m["title"],
                    "level": m["riskLevel"],
                    "source": m["sourceDepartment"],
                    "description": m.get("summary", ""),
                    "suggestedAction": m.get("suggestedAction") or "等待陛下批阅",
                    "createdAt": m.get("createdAt"),
                }
            )
    return risks[:limit]


def build_memorial_sections(final_output: dict | None) -> dict:
    """final_output → 奏折八段式(缺字段安全补默认)。"""
    fo = final_output or {}
    return {
        "background": str(fo.get("background", "")),
        "objective": str(fo.get("objective", "")),
        "opinions": list(fo.get("opinions", [])),
        "risks": list(fo.get("risks", [])),
        "recommendation": str(fo.get("recommendation", "")),
        "executionPath": list(fo.get("executionPath", [])),
        "decisionsNeeded": list(fo.get("decisionsNeeded", [])),
        "nextSteps": list(fo.get("nextSteps", [])),
    }
