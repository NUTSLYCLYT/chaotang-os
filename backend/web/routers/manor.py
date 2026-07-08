"""庄园端点(T1):manor/overview + opportunities + supply-chain + ai-advice。

字段严格按 .plans/chaotang-manor/docs/api-contracts.md。
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from web.deps import get_current_user
from web.schemas.auth import CurrentUser
from src.manor_data import load_opportunities, load_supply_chain, opportunity_funnel
from web.routers._envelope import ok, fail

router = APIRouter(prefix="/api/chaotang/manor", tags=["manor"])


# ──────────────── 资产分类 mock(API-契约标 [MOCK]) ────────────────

_ASSET_CATEGORIES = [
    {"key": "tech", "label": "技术资产", "count": 12,
     "items": ["LFP低温专利", "BMS固件v3", "NCM极寒配方", "PACK结构设计"]},
    {"key": "product", "label": "产品资产", "count": 8,
     "items": ["LFP-40C-100Ah", "LFP-25C-280Ah", "NCM-40C-50Ah", "LTO-50C-40Ah"]},
    {"key": "project", "label": "项目资产", "count": 5,
     "items": ["市政储能示范", "物流车队PACK", "光储一体化", "离网出口"]},
    {"key": "channel", "label": "渠道资产", "count": 7,
     "items": ["政府采购渠道", "地产开发商", "能源央企", "东南亚代理"]},
    {"key": "doc", "label": "文档资产", "count": 23,
     "items": ["技术白皮书", "认证报告", "客户案例集"]},
    {"key": "talent", "label": "人才资产", "count": 15,
     "items": ["电化学工程师", "BMS研发", "市场BD", "海外销售"]},
]

def _real_asset_categories() -> list[dict]:
    """企业核心资产中枢:用库里真实数据计数,无源诚实归 0(不伪装)。"""
    def _n(fn):
        try:
            return int(fn())
        except Exception:
            return 0

    def _memorials():
        from web.routers.throne import _build_memorial_list
        return len(_build_memorial_list())

    def _knowledge():
        from src.knowledge_rag import get_rag
        return int(get_rag().stats().get("total_chunks", 0))

    cats = [
        {"key": "memorial", "label": "决策资产·奏折", "count": _n(_memorials),
         "items": ["六部奏折", "御史复核", "丞相朝报"]},
        {"key": "opportunity", "label": "机会资产·商机", "count": _n(lambda: len(load_opportunities())),
         "items": ["商机漏斗", "招标线索"]},
        {"key": "supply", "label": "资源资产·供应链", "count": _n(lambda: len(load_supply_chain())),
         "items": ["电芯供应", "原料价格"]},
        {"key": "knowledge", "label": "知识资产·史馆", "count": _n(_knowledge),
         "items": ["技术文档", "行业标准", "客户样本"]},
    ]
    return cats


# 各部门 key metrics mock(dept code → metrics list)
_DEPT_KEY_METRICS: dict[str, list[dict]] = {
    "finance": [
        {"label": "本月营收", "value": "287", "unit": "万元"},
        {"label": "在谈商机总值", "value": "13650", "unit": "万元"},
        {"label": "预算执行率", "value": "78%"},
        {"label": "应收账款", "value": "430", "unit": "万元"},
    ],
    "legal": [
        {"label": "合同审查中", "value": "3", "unit": "份"},
        {"label": "风险预警", "value": "1", "unit": "项"},
        {"label": "合规通过率", "value": "96%"},
        {"label": "本月新签合同", "value": "2", "unit": "份"},
    ],
    "market": [
        {"label": "本月获客线索", "value": "18", "unit": "条"},
        {"label": "内容发布", "value": "7", "unit": "篇"},
        {"label": "品牌曝光", "value": "12.4", "unit": "万次"},
        {"label": "客户满意度", "value": "4.6 / 5.0"},
    ],
    "guard": [
        {"label": "风险预警", "value": "2", "unit": "项"},
        {"label": "舆情监控", "value": "正常"},
        {"label": "内控检查", "value": "通过"},
        {"label": "本月异常事件", "value": "0", "unit": "起"},
    ],
}


# ──────────────── /manor/opportunities ────────────────

@router.get("/opportunities")
def manor_opportunities(_: CurrentUser = Depends(get_current_user)) -> dict:
    return ok(load_opportunities())


# ──────────────── /manor/supply-chain ────────────────

@router.get("/supply-chain")
def manor_supply_chain(_: CurrentUser = Depends(get_current_user)) -> dict:
    return ok(load_supply_chain())


# ──────────────── /manor/overview ────────────────

@router.get("/overview")
def manor_overview(_: CurrentUser = Depends(get_current_user)) -> dict:
    from src.manor_groups import load_manor_groups
    from web.task_registry import task_snapshot

    opps = load_opportunities()
    _asset_cats = _real_asset_categories()
    supply = load_supply_chain()
    tasks = task_snapshot()

    running_projects = sum(
        1 for t in tasks.values() if t.get("status") == "running"
    )

    # 从奏折推断风险数
    risk_count = _count_risks()

    pulse = {
        "totalAssets": sum(c["count"] for c in _asset_cats),
        "activeOpportunities": sum(
            1 for o in opps if o.get("stage") not in ("wither",)
        ),
        "runningProjects": running_projects,
        "supplyItems": len(supply),
        "riskCount": risk_count,
        "aiAdviceCount": len(_build_ai_advice(opps, supply)),
    }

    groups = []
    for g in load_manor_groups():
        groups.append({
            "id": g.id,
            "name": g.name,
            "ministers": g.ministers,
            "runtime": g.resolved_runtime(),
            "subagentCount": g.subagent_max,
            "description": g.desc,
        })

    return ok({
        "pulse": pulse,
        "groups": groups,
        "assetCategories": _asset_cats,
        "opportunityFunnel": opportunity_funnel(opps),
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    })


# ──────────────── /manor/ai-advice ────────────────

@router.get("/ai-advice")
def manor_ai_advice(_: CurrentUser = Depends(get_current_user)) -> dict:
    opps = load_opportunities()
    supply = load_supply_chain()
    return ok(_build_ai_advice(opps, supply))


# ──────────────── 内部辅助 ────────────────

def _count_risks() -> int:
    """从奏折聚合推断当前风险数。"""
    try:
        from web.routers.throne import _build_memorial_list
        from src.chaotang_api import aggregate_risks
        memorials = _build_memorial_list()
        return len(aggregate_risks(memorials, limit=20))
    except Exception:
        return 0


def _briefing_pending_count() -> int:
    """从 study/briefing 拉取待裁决奏折数,失败静默返回 0。"""
    try:
        from web.routers.throne import _build_memorial_list
        mems = _build_memorial_list()
        return sum(1 for m in mems if m.get("status") in ("running", "pending"))
    except Exception:
        return 0


def _briefing_high_risk_count() -> int:
    """从奏折列表统计高风险(riskLevel critical/high)数,失败返回 0。"""
    try:
        from web.routers.throne import _build_memorial_list
        mems = _build_memorial_list()
        return sum(1 for m in mems if m.get("riskLevel") in ("critical", "high"))
    except Exception:
        return 0


def _build_ai_advice(opps: list[dict], supply: list[dict],
                     pending_count: int | None = None,
                     high_risk_count: int | None = None) -> list[dict]:
    """规则引擎派生 AI 经营建议,从 opportunities/supply-chain/briefing 三源派生。

    pending_count / high_risk_count 可由调用方注入(便于测试 monkeypatch)。
    """
    if pending_count is None:
        pending_count = _briefing_pending_count()
    if high_risk_count is None:
        high_risk_count = _briefing_high_risk_count()
    advices: list[dict] = []

    # 1. 商机热度分析
    bloom_harvest = [o for o in opps if o.get("stage") in ("bloom", "harvest")]
    if bloom_harvest:
        top = bloom_harvest[0]
        advices.append({
            "id": "adv_opp_1",
            "title": f"商机「{top.get('name', '未命名')}」进入关键阶段",
            "detail": f"当前处于 {top.get('stage', '')} 阶段,预估价值 {top.get('value') or '未知'} 万元。建议本周内安排高层拜访或推进合同谈判。",
            "source": "商机热度",
            "priority": "high",
            "actionHref": "/manors",
        })

    # 2. 供应链缺口提示
    long_lead = [s for s in supply if _parse_lead_weeks(s.get("leadTime", "")) >= 10]
    if long_lead:
        advices.append({
            "id": "adv_supply_1",
            "title": f"{len(long_lead)} 类物料交期≥10周,建议提前备货",
            "detail": f"受影响型号:{', '.join(s['model'] for s in long_lead[:3])}。建议提前 8-12 周下单锁量,规避交期风险。",
            "source": "供应链缺口",
            "priority": "medium",
            "actionHref": None,
        })

    # 3. 种子阶段商机盘活
    seeds = [o for o in opps if o.get("stage") == "seed" and o.get("owner") is None]
    if seeds:
        advices.append({
            "id": "adv_opp_2",
            "title": f"{len(seeds)} 个种子商机尚未指派负责人",
            "detail": "商机未指派将影响推进节奏。建议本周内为以下商机分配跟进大臣:" +
                      "、".join(o.get("name", "未命名") for o in seeds[:3]) + "。",
            "source": "商机热度",
            "priority": "medium",
            "actionHref": "/manors",
        })

    # 4. 枯萎商机复盘
    withered = [o for o in opps if o.get("stage") == "wither"]
    if withered:
        advices.append({
            "id": "adv_retro_1",
            "title": f"{len(withered)} 个商机已枯萎,建议复盘原因",
            "detail": "定期复盘流失商机有助于改进销售打法。建议史官整理客户反馈并沉淀到知识库。",
            "source": "项目进度",
            "priority": "low",
            "actionHref": "/archive",
        })

    # 5. 待裁决奏折积压(来自 study/briefing)
    if pending_count >= 3:
        advices.append({
            "id": "adv_briefing_1",
            "title": f"待裁决奏折积压 {pending_count} 件,建议尽快批阅",
            "detail": f"当前上书房有 {pending_count} 件奏折等待陛下裁决。积压过多将影响各部门推进节奏。建议优先处理高优先级项目。",
            "source": "项目进度",
            "priority": "high" if pending_count >= 5 else "medium",
            "actionHref": "/court-briefing",
        })

    # 6. 高风险奏折预警(来自 study/briefing)
    if high_risk_count >= 2:
        advices.append({
            "id": "adv_risk_1",
            "title": f"{high_risk_count} 件高风险奏折需重点关注",
            "detail": f"当前有 {high_risk_count} 件奏折标注为高风险或危急。建议在批阅前核查军机处执行日志,确认风险已被识别和应对。",
            "source": "项目进度",
            "priority": "high",
            "actionHref": "/archive",
        })

    # 7. 规则兜底:若以上均无输出,给一条通用建议
    if not advices:
        advices.append({
            "id": "adv_default_1",
            "title": "经营状态正常,建议持续维护商机漏斗",
            "detail": "当前商机漏斗各阶段均有项目推进,供应链状态稳定。建议每周更新商机进展。",
            "source": "项目进度",
            "priority": "low",
            "actionHref": "/manors",
        })

    return advices


def _parse_lead_weeks(lead_time: str) -> int:
    """'8-10周' → 取最大值 10。解析失败返回 0。"""
    import re
    nums = re.findall(r"\d+", lead_time)
    if not nums:
        return 0
    return max(int(n) for n in nums)


# ── P0-2: 项目经营盘 ──

@router.get("/projects")
def manor_projects(_: CurrentUser = Depends(get_current_user)) -> dict:
    """项目经营盘:展示重点项目+进度+负责人+AI建议。

    数据来源:opportunities + memorials + task_snapshot 聚合。
    """
    from web.task_registry import task_snapshot
    from web.routers.throne import _build_memorial_list

    opps = load_opportunities()
    memorials = _build_memorial_list()
    running_tasks = {
        tid: t for tid, t in task_snapshot().items() if t.get("status") == "running"
    }

    projects = [
        {
            "id": "proj_chaotang",
            "name": "朝堂 OS MVP",
            "department": "gong_bu",
            "stage": "grow",
            "progressPct": 85,
            "status": "active",
            "owner": "gong_bu",
            "description": "完成上书房、大殿、军机处、庄园、史馆五大空间及6个部门页",
            "nextMilestone": "OpenClaw 接入",
            "relatedMemorials": len([
                m for m in memorials
                if "朝堂" in (m.get("title", "") + m.get("summary", ""))
            ]),
        },
        {
            "id": "proj_battery",
            "name": "低温电池市场拓展",
            "department": "hu_bu",
            "stage": "bloom",
            "progressPct": 60,
            "status": "active",
            "owner": "hu_bu",
            "description": "低温电池技术-市场协同分析，规划北方十省落地路径",
            "nextMilestone": "联合攻关方案确认",
            "relatedMemorials": len([
                m for m in memorials
                if "电池" in (m.get("title", "") + m.get("summary", ""))
            ]),
        },
        {
            "id": "proj_xiamen",
            "name": "厦门 AI 样板间",
            "department": "li_bu_rites",
            "stage": "sprout",
            "progressPct": 30,
            "status": "active",
            "owner": "li_bu_rites",
            "description": "厦门 AI 公司合作方案设计与招商材料准备",
            "nextMilestone": "股权架构方案",
            "relatedMemorials": len([
                m for m in memorials
                if "厦门" in (m.get("title", "") + m.get("summary", ""))
            ]),
        },
        {
            "id": "proj_pack",
            "name": "PACK 智能体工作流",
            "department": "gong_bu",
            "stage": "seed",
            "progressPct": 15,
            "status": "planning",
            "owner": "gong_bu",
            "description": "新能源 PACK 智能体方案:需求分析→方案生成→报价→合同",
            "nextMilestone": "知识库搭建",
            "relatedMemorials": 0,
        },
        {
            "id": "proj_supply",
            "name": "供应链优化",
            "department": "bing_bu",
            "stage": "seed",
            "progressPct": 10,
            "status": "planning",
            "owner": "bing_bu",
            "description": "补齐 PACK 供应链报价库,建立供应商比价机制",
            "nextMilestone": "供应商名录",
            "relatedMemorials": 0,
        },
    ]

    # 计算活跃任务关联
    for proj in projects:
        proj["activeTaskCount"] = sum(
            1 for t in running_tasks.values()
            if proj["department"] in (t.get("departments") or [])
        )

    # AI 建议
    suggestions = []
    for proj in projects:
        if proj["progressPct"] < 20:
            suggestions.append({
                "projectId": proj["id"],
                "projectName": proj["name"],
                "advice": f"建议优先推进「{proj['name']}」,当前进度仅 {proj['progressPct']}%",
                "priority": "medium",
            })
        if proj["stage"] == "bloom" and proj["progressPct"] > 50:
            suggestions.append({
                "projectId": proj["id"],
                "projectName": proj["name"],
                "advice": f"「{proj['name']}」已进入关键阶段({proj['progressPct']}%),建议本周安排评审",
                "priority": "high",
            })

    return ok({
        "projects": projects,
        "suggestions": suggestions[:5],
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    })


# ── P0-3: 政策/资金池 ──

@router.get("/policy-funds")
def manor_policy_funds(_: CurrentUser = Depends(get_current_user)) -> dict:
    """政策/资金池:展示政府补贴/产业基金/园区资源/税收优惠/项目申报。

    当前为规则派生 mock,未来接锦衣卫/钦天监实时扫描。
    """
    funds = [
        {
            "id": "fund_fujian",
            "name": "福建省 AI 产业扶持基金",
            "type": "政府补贴",
            "amount": "最高 500 万元",
            "deadline": "2026-09-30",
            "status": "可申报",
            "matchScore": 85,
            "description": "面向 AI 企业的研发补贴,朝堂 OS 符合\"企业级 AI 平台\"申报方向",
        },
        {
            "id": "fund_beijing",
            "name": "中关村前沿技术企业补贴",
            "type": "政府补贴",
            "amount": "最高 300 万元",
            "deadline": "2026-08-15",
            "status": "可申报",
            "matchScore": 72,
            "description": "多智能体协同技术方向,需要技术白皮书和演示系统",
        },
        {
            "id": "fund_xiamen",
            "name": "厦门火炬高新区招商优惠",
            "type": "园区资源",
            "amount": "租金减免 + 税收返还",
            "deadline": "持续有效",
            "status": "可对接",
            "matchScore": 90,
            "description": "厦门 AI 样板间项目可享受高新区落地优惠政策",
        },
        {
            "id": "fund_energy",
            "name": "新能源汽车电池回收利用补贴",
            "type": "政府补贴",
            "amount": "按回收量补贴",
            "deadline": "2026-12-31",
            "status": "关注中",
            "matchScore": 60,
            "description": "低温电池/PACK 项目可能符合新能源政策方向",
        },
        {
            "id": "fund_vc",
            "name": "红杉中国 AI 基金",
            "type": "产业基金",
            "amount": "A轮 1000-3000 万",
            "deadline": "持续募资",
            "status": "关注中",
            "matchScore": 68,
            "description": "面向企业级 AI 应用的早期投资,需完善商业计划书",
        },
        {
            "id": "fund_local",
            "name": "地方数字经济专项资金",
            "type": "政府补贴",
            "amount": "100-500 万元",
            "deadline": "2026-10-31",
            "status": "准备中",
            "matchScore": 75,
            "description": "多地设有数字经济专项,可多城市联合申报",
        },
    ]

    # 按匹配度排序
    funds.sort(key=lambda f: f["matchScore"], reverse=True)

    return ok({
        "funds": funds,
        "summary": {
            "totalCount": len(funds),
            "actionableCount": sum(1 for f in funds if f["status"] == "可申报"),
            "totalPotentialAmount": "最高 4000+ 万元",
        },
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    })


# ── /manor/groups/{groupId}/subagents ──────────────────────────────────────

_VALID_GROUP_IDS = {"intel", "content", "finlaw", "rnd", "exec", "review"}

# 最多扫描最近 N 个 run 聚合 subagents
_RECENT_RUNS_LIMIT = 20


def _get_recent_run_ids(limit: int = _RECENT_RUNS_LIMIT) -> list[str]:
    """返回最近 N 个 run_id 列表(按 run_id 降序,即时间戳最新优先)。失败返回空列表。

    run_id 格式为 YYYYMMDD_HHMMSS_* 字符串排序即时间排序。
    """
    try:
        from src.step_log import list_runs
        runs = list_runs()
        # 按 run_id 降序(最新在前),取前 limit 个
        runs_sorted = sorted(runs, reverse=True)
        return runs_sorted[:limit] if runs_sorted else []
    except Exception:
        return []


def _snapshot_for_subagents() -> dict:
    """返回 task_snapshot()(task_id → task dict),包含 run_id 字段。"""
    try:
        from web.task_registry import task_snapshot
        return task_snapshot()
    except Exception:
        return {}


def _parse_dispatch_subtasks(output: str) -> list[str]:
    """从 group_{gid}_dispatch 步的 output 解析子任务文本列表。

    真实格式: JSON {"subtasks": ["子任务文本", ...]}
    失败返回空列表(KP-8 静默降级)。
    """
    import json
    if not output:
        return []
    try:
        parsed = json.loads(output)
        if isinstance(parsed, dict):
            subs = parsed.get("subtasks", [])
            if isinstance(subs, list):
                return [str(s) for s in subs if s]
    except Exception:
        pass
    return []


def _parse_result_summaries(output: str, count: int) -> list[str]:
    """从 group_{gid} 结果步的 output 按 '### 子任务 N' 切分摘要。

    真实格式: 自由文本,各段以 '### 子任务 N：' 开头。
    返回长度 = count 的摘要列表(不足补空字符串)。
    """
    import re
    if not output:
        return [""] * count
    # 按 ### 子任务 N 切段
    parts = re.split(r"(?=###\s*子任务\s*\d+)", output)
    # 过滤空段
    parts = [p.strip() for p in parts if p.strip()]
    summaries: list[str] = []
    for p in parts:
        # 取段内前 200 字作摘要
        summaries.append(p[:200])
    # 补齐到 count
    while len(summaries) < count:
        summaries.append("")
    return summaries[:count]


def _extract_subagents_from_run(
    run,
    groupId: str,
    task_id: str,
    task_title: str,
) -> list[dict]:
    """从一个 RunLog 里提取 group_{groupId} 的 subagent 列表。

    策略:
    1. 找 group_{groupId}_dispatch 步 → 解析 subtasks(子任务文本列表)
    2. 找 group_{groupId} 结果步 → 解析各子任务摘要 + 确定完成状态
    3. 两者按下标配对,生成 subagent 条目

    KP-8:任一步缺失时静默降级,不丢已有字段。
    """
    dispatch_step = None
    result_step = None
    for step in (run.steps or []):
        name = step.agent_name or ""
        if name == f"group_{groupId}_dispatch":
            dispatch_step = step
        elif name == f"group_{groupId}":
            result_step = step

    if dispatch_step is None and result_step is None:
        return []

    # 子任务文本从 dispatch 步提取
    subtasks: list[str] = []
    if dispatch_step is not None:
        subtasks = _parse_dispatch_subtasks(dispatch_step.output or "")

    if not subtasks:
        # fallback:若 dispatch 没有,从 result 步找嵌套 subtasks JSON
        if result_step is not None:
            subtasks = _parse_dispatch_subtasks(result_step.output or "")

    if not subtasks:
        return []

    # 结果摘要从 result 步切分
    summaries: list[str] = _parse_result_summaries(
        result_step.output if result_step else "", len(subtasks)
    )

    # 结果状态:result 步完成 → done;无 result 步或 running → running
    if result_step is None:
        step_status = "running"
    elif result_step.status in ("success", "done"):
        step_status = "done"
    else:
        step_status = "running"

    sas: list[dict] = []
    for i, task_text in enumerate(subtasks):
        sas.append({
            "id": f"{groupId}-{i + 1}",
            "task": task_text[:200],          # 子任务描述(截断)
            "status": step_status,
            "summary": summaries[i][:200],    # 摘要(截断)
            "taskId": task_id,
            "taskTitle": task_title,
        })
    return sas


@router.get("/groups/{groupId}/subagents")
def manor_group_subagents(groupId: str,
                          _: CurrentUser = Depends(get_current_user)) -> dict:
    """按组聚合真实 subagent 列表。

    从 ① 活跃任务(task_snapshot 在跑 run)+ ② 最近 N 个 run 里的 group_{groupId}
    dispatch+result 步对聚合 subagents,附所属 taskId + taskTitle。

    契约(D19):
      { groupId, groupName, ministers, subagentMax,
        subagents: [{id, task, status, summary, taskId, taskTitle}] }

    真实格式(已验证 data/default/runs/):
      dispatch 步 output = {"subtasks": ["子任务文本", ...]}
      result 步 output = 自由文本按 "### 子任务 N：" 分段
    """
    if groupId not in _VALID_GROUP_IDS:
        return fail(f"不支持的 groupId: {groupId!r},允许值: {sorted(_VALID_GROUP_IDS)}")

    # ── 读 group 元数据 ──────────────────────────────────────────────────
    from src.manor_groups import load_manor_groups as _load_manor_groups
    group_def = None
    for g in _load_manor_groups():
        if g.id == groupId:
            group_def = g
            break
    if group_def is None:
        return fail(f"groupId {groupId!r} 配置未找到")

    # ── 构建 run_id → (taskId, taskTitle) 映射 ──────────────────────────
    # ① 优先从内存 task_snapshot 取(在飞任务,最新)
    snapshot = _snapshot_for_subagents()
    run_id_to_task: dict[str, tuple[str, str]] = {}
    for tid, t in snapshot.items():
        rid = t.get("run_id")
        if rid:
            title = (t.get("task_input") or "")[:40] or "未命名"
            run_id_to_task[rid] = (tid, title)

    # ② DB fallback:重启后内存为空时,从 tasks 表补全 run_id→task_id 映射(D12)
    try:
        from src.db.engine import SessionLocal
        from src.db.models import Task as DbTask
        _db = SessionLocal()
        try:
            rows = _db.query(DbTask.task_id, DbTask.task_input, DbTask.run_id).filter(
                DbTask.run_id.isnot(None)
            ).all()
            for row in rows:
                rid = row.run_id
                if rid and rid not in run_id_to_task:
                    title = (row.task_input or "")[:40] or "未命名"
                    run_id_to_task[rid] = (row.task_id, title)
        finally:
            _db.close()
    except Exception:
        pass  # DB 不可用时静默降级,保持内存映射

    # ── 从最近 run 聚合 subagents ─────────────────────────────────────────
    from src.step_log import load_run
    subagents: list[dict] = []
    seen_run_ids: set[str] = set()

    # 活跃任务 run_id 优先(in-flight)
    active_run_ids = [
        t["run_id"]
        for t in snapshot.values()
        if t.get("status") == "running" and t.get("run_id")
    ]
    all_run_ids = list(dict.fromkeys(active_run_ids + _get_recent_run_ids()))

    for run_id in all_run_ids:
        if run_id in seen_run_ids:
            continue
        seen_run_ids.add(run_id)

        try:
            run = load_run(run_id)
            if run is None:
                continue
        except Exception:
            continue

        # 找所属 task(优先 task_snapshot,fallback run.task_input)
        task_id, task_title = run_id_to_task.get(run_id, ("", ""))
        if not task_title:
            task_title = (getattr(run, "task_input", "") or "")[:40] or "未命名"

        sas = _extract_subagents_from_run(run, groupId, task_id, task_title)
        subagents.extend(sas)

    return ok({
        "groupId": groupId,
        "groupName": group_def.name,
        "ministers": group_def.ministers,
        "subagentMax": group_def.subagent_max,
        "subagents": subagents,
    })

