"""src/jinyiwei_agent.py — 锦衣卫情报 agent(补执行原语短板:工具型 agent)。

补上审计点名的最弱一环:联网检索 + 情报可信度分级 + 异动。执行链:
  ① 检索(search_fn 可注入:接 WebSearch/爬虫/任意源,测试用 mock)
  ② 逐条过 vet 门(src/jinyiwei_vet:一手/二手多源/单源/未证实 → 入库/待核/拒)—— 确定性分级,脏情报挡门外
  ③ 装配成 court_doc(谍报 brief,deterministic 接地:vet 门是确定性规则,非 LLM)

锦衣卫铁律:可信度由确定性门算出,**脏情报/AI 硬声明标"待核",不自动过闸**(接 jinyiwei_vet)。
search_fn 缺失/失败 → 空态诚实,不编造情报。纯编排,可测。
"""

from __future__ import annotations

from typing import Callable

from src import dept_doc
from src.jinyiwei_vet import verdict_of, vet_intel

# vet 决策 → court_doc 灯
_DECISION_LIGHT = {"拒": "red", "待核": "yellow", "入库": "green"}

# docs/dept_design/jinyiwei.md §三:判官(bruce-schneier 治情报投毒/deming 判异动真伪)+
# 顾问(soros-perspective/charity-majors/taleb-perspective)。此前 gather_intel 没传,
# provenance.advisors 一直是空的(诸司能力核查挖出的同款洞)。
_INTEL_ADVISORS = [
    "bruce-schneier",
    "deming",
    "soros-perspective",
    "charity-majors",
    "taleb-perspective",
]


def _finding_to_item(claim: str, sources) -> dict:
    v = vet_intel(claim, sources)
    decision = v.get("decision", "待核")
    return {
        "level": _DECISION_LIGHT.get(decision, "yellow"),
        "title": claim[:60],
        "odds": v.get("grade"),  # 可信度等级(一手/二手/未证实)
        "impact": decision,  # 入库/待核/拒
        "evidence_ref": str(v.get("primary") or (sources[0] if sources else "")),
        "fix": ("补一手来源/多源印证再入库" if decision != "入库" else None),
    }


def gather_intel(
    query: str,
    *,
    search_fn: Callable[[str], list] | None = None,
    archive: bool = True,
) -> dict:
    """检索 → 逐条 vet 分级 → 谍报 court_doc。

    search_fn(query) -> [{"claim":..,"sources":[..]}]。缺失则空态(不编造情报)。
    """
    findings = []
    if search_fn is not None:
        try:
            findings = search_fn(query) or []
        except Exception:
            findings = []
    if not findings:
        # source_label="FALLBACK" 喂给 build_court_doc 自带的降级门(2026-07-06 修的
        # "空产出+非 live 来源≠确认没事")——不传则该门永远不触发,light 恒 green(见
        # docs/shiguan-jinyiwei-wiring-plan-2026-07-09.md 复审:路由层 sourceLabel 是
        # 事后贴的另一个字段,救不了这里已经算完的 light/gate)。
        return dept_doc.build_dept_doc(
            "jinyiwei",
            items=[],
            question=query,
            shielded="未获取到可核情报(不编造)",
            advisors=_INTEL_ADVISORS,
            deterministic_gated=True,
            archive=archive,
            source_label="FALLBACK",
        )
    items = [
        _finding_to_item(str(f.get("claim", "")), f.get("sources") or [])
        for f in findings
    ]
    dirty = sum(1 for i in items if i["level"] == "red")
    watch = sum(1 for i in items if i["level"] == "yellow")
    return dept_doc.build_dept_doc(
        "jinyiwei",
        items=items,
        question=query,
        shielded=f"挡门外 {dirty} 条脏情报 · {watch} 条待核",
        advisors=_INTEL_ADVISORS,
        deterministic_gated=True,  # vet 门是确定性分级,非 LLM
        archive=archive,
    )
