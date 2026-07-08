"""src/tianjian_verdict.py — 钦天监天象策(flow_tianjian → court_doc,最小可行片)。

ponytail: 镜像 bingbu_battlecard.py 的模式——flow_tianjian 蜂群本来就真实存在且已被
decree_swarm_router 路由(实测跑过),缺的只是"老实装配成 court_doc"这一步,不新建蜂群/
不新建 step_type。flow_tianjian.yaml 的 knowledge_pre_retrieval 已经在查 knowledge/docs
真实 KB(见 knowledge_rag.py)，只是里面文档还很薄——加真实文档进 knowledge/docs 会让
"依据"更可信，不用改这份代码。

"态势与驱动因素"里的"依据：xxx数据"是 LLM 生成的内联引用，逐条抽出来源名过
jinyiwei_vet.vet_intel 判一手/二手/未证实(与锦衣卫入库把关同一套确定性规则，非 LLM 自评)，
而不是笼统标"未核实"——命中官网/公告/年报等一手来源才给 green，否则老实降级。
"""

from __future__ import annotations

import re

from src import court_doc_builder as cdb
from src.jinyiwei_vet import vet_intel

_CITATION_RE = re.compile(r"依据[:：]\s*([^,，。;；)\)]+)")
_DECISION_LIGHT = {"拒": "red", "待核": "yellow", "入库": "green"}

_FORECAST_HEADLINE = {
    "green": "建议开工 —— 情景推演已完成",
    "yellow": "建议开工 —— 但先核实 {n} 处依据来源",
    "red": "暂缓 —— 情景推演显示重大下行风险",
    "black": "高危 —— 移交深查",
}

_FORECAST_FIELDS = [
    "态势与驱动因素(含依据)",
    "多情景预测(乐观/基准/悲观+概率区间)",
    "影响传导路径与时间维度",
    "主要不确定因素与下行风险",
    "可选行动与推荐顺序",
    "不可逆动作的人类签字点",
]


def forecast_output_to_items(final_output: dict, *, run_id: str = "") -> list[dict]:
    """六字段(自由文本)→ court_doc items。逐条抽"依据：xxx"来源名过 jinyiwei_vet,
    一手来源(官网/公告/年报…)才给 green,否则老实降级(待核=yellow/拒=red)。"""
    items: list[dict] = []
    for field in _FORECAST_FIELDS:
        content = str(final_output.get(field, "") or "")
        if not content:
            continue
        preview = content[:80] + ("…" if len(content) > 80 else "")
        sources = _CITATION_RE.findall(content)
        vet = vet_intel(content, sources)
        level = _DECISION_LIGHT.get(vet["decision"], "yellow")
        fix = (
            f"来源「{'/'.join(sources)}」评级{vet['grade']}:{vet['reason']}"
            if sources
            else f"未标注具体来源:{vet['reason']}"
        )
        items.append(
            {
                "level": level,
                "title": f"{field}:{preview}",
                "fix": fix,
                "evidence_ref": (
                    f"truth://tianjian/{run_id}#{field}"
                    if run_id
                    else "truth://tianjian"
                ),
            }
        )
    return items


def polymarket_items(markets: list[dict]) -> list[dict]:
    """真实 Polymarket 市场(已查好,传进来的是 src.polymarket_lookup.search_markets 的结果)
    → court_doc items。真金白银定的价格,直接给 green,不用过 jinyiwei_vet(它本身就是原始来源,
    不是待核实的转述)。"""
    items: list[dict] = []
    for m in markets:
        odds = ", ".join(f"{o}:{p}" for o, p in zip(m["outcomes"], m["outcome_prices"]))
        status = "已结算" if m["closed"] else "进行中"
        items.append(
            {
                "level": "green",
                "title": f"Polymarket真实市场({status}):{m['question']} — {odds}",
                "fix": None,
                "evidence_ref": m["url"],
            }
        )
    return items


# 库内资料回链门槛:sqlite-vec 相似度分(1/(1+距离)),实测库内真相关文档 ~0.47-0.49,
# 无关查询 <0.4。0.45 是保守下限——宁可少挂回链,不把弱相关冒充"有支撑"。
_GROUNDING_FLOOR = 0.45


def grounding_items(question: str, top_k: int = 3) -> tuple[list[dict], bool]:
    """查真实知识库(sqlite-vec),命中≥门槛的文档挂成可回链 items。

    返回 (items, rag_hit)。green 的含义是"这条回链引用真实存在、可点开核查的库内文档"
    (与 polymarket_items 同理:引用本身是原始可核对象),不是"该文档证实了 LLM 的推断"——
    推断的可信度仍由逐条依据过 jinyiwei_vet 决定,两轴不混。
    库空/检索失败 → ([], False),老实回"未接地",不冒充。
    """
    try:
        from src.knowledge_rag import get_rag

        hits = get_rag().search(question, top_k=top_k)
    except Exception:
        return [], False
    strong = [h for h in hits if h.get("score", 0) >= _GROUNDING_FLOOR]
    items = [
        {
            "level": "green",
            "title": f"库内资料回链:{h.get('source', '?')}(相关度{h.get('score', 0):.2f})",
            "fix": None,
            "evidence_ref": f"knowledge://{h.get('source', '?')}",
        }
        for h in strong
    ]
    return items, bool(strong)


def build_tianjian_forecast(
    final_output: dict,
    *,
    run_id: str = "",
    case_id: str | None = None,
    question: str = "",
    archive: bool = True,
    extra_items: list[dict] | None = None,
    rag_hit: bool = False,
) -> dict:
    items = forecast_output_to_items(final_output, run_id=run_id) + (extra_items or [])
    return cdb.build_court_doc(
        "qintianjian",
        items=items,
        case_id=case_id,
        question=question,
        shielded="为你拦下了:把模型推断当成真实数据来源直接决策",
        advisors=["taleb-perspective", "munger-perspective"],
        rag_hit=rag_hit,  # 2026-07-08 起真查库(grounding_items),不再写死"未接地"
        archive=archive,
        headline_map=_FORECAST_HEADLINE,
        pending_note="情景推演 —— 依据未经核实",
        source_label="LIVE_SWARM",
    )


def run_tianjian_forecast(task_input: str, *, archive: bool = True) -> dict:
    """端到端:跑真实 flow_tianjian → 查 Polymarket 真实市场(有就当 green 证据)→
    装配钦天监天象策 court_doc。真实 LLM 调用,非确定性。"""
    from pathlib import Path

    from src.flow_engine import FlowEngine
    from src.polymarket_lookup import search_markets

    config_path = str(
        Path(__file__).resolve().parent.parent / "config" / "flow_tianjian.yaml"
    )
    engine = FlowEngine(config_path)
    run_log = engine.run(task_input)
    markets = search_markets(task_input, limit=3)
    ground, rag_hit = grounding_items(task_input)
    return build_tianjian_forecast(
        run_log.final_output or {},
        run_id=run_log.run_id,
        question=task_input,
        archive=archive,
        extra_items=polymarket_items(markets) + ground,
        rag_hit=rag_hit,
    )
