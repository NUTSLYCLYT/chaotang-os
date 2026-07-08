"""src/lipu_vet.py — 礼部对外发布反幻觉复核(flow_lipu → 确定性硬声明回链 → court_doc)。

背景(2026-07-06 会审,补 real_department_engines.py 里点名"礼部没得接"的缺口):
礼部出版蜂群(lipu_compose→review→finalize)整篇卖点是"只用给定素材、严禁编造认证/数字/
绝对化排名",但此前这条铁律只活在 prompt 里 + LLM 自查,没有代码级挡门——模型嘴上说
"已核查通过"却编了个百分比,没有确定性代码拦得住。本文件补这一层,和户部 number_provenance、
御史 knowledge_vet 同级:把"防幻觉"从铁律变成真尺子。

确定性口径(素材diff为主 + 知识库兜底,2026-07-06 定):
1. 从成稿里正则抽"硬声明"(数字/百分比/带单位量/《认证名录》/绝对化用语)。
2. **素材回链**:硬声明的数字/书名号原文若在 task_input(给定素材)里出现 → 有据(green)。
3. **知识库兜底**:素材里找不到的,再走 knowledge_vet.vet_against_knowledge 查精华知识库;
   知识库有据 → yellow(素材外但库内有据,建议补出处);仍无据 → 编造嫌疑。
4. **绝对化合规**:"全球第一/唯一/遥遥领先"等一律 red(合规红线,与素材无关,礼部铁律#2)。
5. 编造嫌疑里:凭空认证/名录 = red(编资质最危险);裸数字无据 = yellow(待人核)。

诚实标注:素材回链是确定性字符串匹配(非 LLM);知识库兜底依赖 RAG 在线,离线/为空时
不兜底、按"待人核"处理,绝不因为兜底失败就放行,也绝不假装查过。
"""

from __future__ import annotations

import re
from pathlib import Path

from src import court_doc_builder as cdb

_LIPU_HEADLINE = {
    "green": "可发 —— 硬声明全部回链素材,无编造",
    "yellow": "可发草稿 —— 有 {n} 处待人核(素材外/绝对化)",
    "red": "建议暂缓发出 —— 检出编造认证/数字或绝对化违规,请复核(定夺在你)",
    "black": "高危 —— 移交御史深查",
}

# 绝对化用语(合规红线):与素材无关,出现即判 red。要求成词短语,避免"最低温度""全球合作
# 伙伴"这类中性表述误伤——只抓真正的夸大排名。
_SUPERLATIVE_RE = re.compile(
    r"全球第一|全球领先|全球唯一|世界第一|世界领先|行业第一|行业领先|遥遥领先|"
    r"绝对领先|市场第一|销量第一|独家首创|唯一一家|首屈一指|无人能及|最强|最先进|业界之最"
)

# 硬声明抽取:百分比 / 带单位量 / 书名号认证名录。
_PCT_RE = re.compile(r"[≥≤>＜<约]?\s*\d+(?:\.\d+)?\s*%")
_UNIT_RE = re.compile(
    r"-?\d+(?:\.\d+)?\s*(?:℃|°C|kWh|Wh|mAh|Ah|V|A|mm|cm|kg|吨|次|年|个月|"
    r"万|亿|元|万元|亿元|km|W|kW|Hz|C)"
)
_CERT_RE = re.compile(r"《[^》]{2,40}》")


def _norm(text: str) -> str:
    """归一化:去空白,便于"≥90%"与"≥ 90 %"这类等价写法做子串匹配。"""
    return re.sub(r"\s+", "", text or "")


def extract_hard_claims(text: str) -> list[tuple[str, str]]:
    """从稿件抽硬声明,返回 [(kind, 原文片段)]。kind: pct/unit/cert。"""
    claims: list[tuple[str, str]] = []
    seen: set[str] = set()
    for kind, rx in (("pct", _PCT_RE), ("unit", _UNIT_RE), ("cert", _CERT_RE)):
        for m in rx.finditer(text or ""):
            frag = m.group(0).strip()
            key = f"{kind}:{_norm(frag)}"
            if key not in seen:
                seen.add(key)
                claims.append((kind, frag))
    return claims


def _grounded_in_source(claim: str, source_norm: str) -> bool:
    """硬声明原文(归一化后)是否为素材子串。"""
    return _norm(claim) in source_norm


def _knowledge_fallback(claim: str) -> str:
    """知识库兜底:'grounded' / 'ungrounded' / 'unavailable'(离线/为空/出错都算不可兜底)。"""
    try:
        from src.knowledge_vet import vet_against_knowledge

        r = vet_against_knowledge(claim)
    except Exception:
        return "unavailable"
    if r.get("decision", "").startswith("无据·知识库为空") or r.get(
        "decision", ""
    ).startswith("无据·检索失败"):
        return "unavailable"
    return "grounded" if r.get("grounded") else "ungrounded"


def vet_publication(draft: str, source_material: str) -> list[dict]:
    """确定性复核:成稿 draft 的每条硬声明 × 素材回链 + 知识库兜底 → court_doc items。"""
    source_norm = _norm(source_material)
    items: list[dict] = []

    # 1) 绝对化合规红线(与素材无关)
    for m in dict.fromkeys(_SUPERLATIVE_RE.findall(draft or "")):
        items.append(
            {
                "level": "red",
                "title": f"绝对化用语违规:「{m}」——礼部铁律禁绝对化排名,须删除或改为可证表述",
                "fix": None,  # 合规红线,不挂 fix 免得被 compute_light 软成 yellow
                "evidence_ref": "truth://lipu/compliance#superlative",
            }
        )

    # 2) 硬声明素材回链 + 知识库兜底
    for kind, claim in extract_hard_claims(draft):
        if _grounded_in_source(claim, source_norm):
            items.append(
                {
                    "level": "green",
                    "title": f"硬声明有据(素材回链):{claim}",
                    "fix": None,
                    "evidence_ref": "truth://lipu/source",
                }
            )
            continue
        fb = _knowledge_fallback(claim)
        if fb == "grounded":
            items.append(
                {
                    "level": "yellow",
                    "title": f"素材外但知识库有据:{claim} —— 发布前补上出处",
                    "fix": "在稿件标注该数据来源,或改为素材内已有表述",
                    "evidence_ref": "truth://lipu/knowledge",
                }
            )
        elif kind == "cert":
            items.append(
                {
                    "level": "red",
                    "title": f"疑编造认证/名录:{claim} —— 素材与知识库均无支撑,严禁凭空写资质",
                    "fix": None,
                    "evidence_ref": "truth://lipu/hallucination#cert",
                }
            )
        else:
            items.append(
                {
                    "level": "yellow",
                    "title": f"数字无据待人核:{claim} —— 素材未见,不得直接对外发布",
                    "fix": "回到素材核对该数字,核不到则删除或改为'未公开'",
                    "evidence_ref": "truth://lipu/hallucination#number",
                }
            )

    if not items:
        items.append(
            {
                "level": "yellow",
                "title": "未抽到硬声明 —— 稿件无可校验的数字/认证,人工确认是否为纯观点稿",
                "fix": "确认稿件不含需回链的事实声明",
                "evidence_ref": "truth://lipu",
            }
        )
    return items


def build_lipu_verdict(
    draft: str,
    source_material: str,
    *,
    case_id: str | None = None,
    question: str = "",
    archive: bool = True,
) -> dict:
    items = vet_publication(draft, source_material)
    return cdb.build_court_doc(
        "libu",  # court_doc_builder 命名空间:libu = 礼部(礼器印/青),libu_personnel 才是吏部
        items=items,
        case_id=case_id,
        question=question,
        shielded="为你拦下了:编造认证/数字、或绝对化夸大的稿件直接对外发布",
        archive=archive,
        headline_map=_LIPU_HEADLINE,
        pending_note="礼部发布复核 —— 有待人核硬声明",
        source_label="LIVE_SWARM",
    )


def _run_flow_and_vet(config_filename: str, task_input: str, *, archive: bool) -> dict:
    """通用:跑指定 flow → 对成稿硬声明做素材回链复核 → 礼部 court_doc。
    礼部出版(flow_lipu)与品牌战略(flow_brand_strategy)共用同一把反幻觉门(素材回链),
    不为品牌战略另造引擎(2026-07-06 会审:同源反幻觉,复用不重造)。"""
    from src.flow_engine import FlowEngine

    config_path = str(
        Path(__file__).resolve().parent.parent / "config" / config_filename
    )
    engine = FlowEngine(config_path)
    run_log = engine.run(task_input)
    draft = run_log.final_output
    if isinstance(draft, dict):  # 品牌战略 final_output 可能是分段 dict
        draft = "\n".join(str(v) for v in draft.values())
    return build_lipu_verdict(
        str(draft or ""), task_input, question=task_input, archive=archive
    )


def run_lipu_vet(task_input: str, *, archive: bool = True) -> dict:
    """端到端:跑真实 flow_lipu(成稿)→ 硬声明素材回链复核 → 礼部 court_doc。真实LLM,非确定性。"""
    return _run_flow_and_vet("flow_lipu.yaml", task_input, archive=archive)


def run_brand_strategy_vet(task_input: str, *, archive: bool = True) -> dict:
    """端到端:跑真实 flow_brand_strategy(品牌定位/文化叙事/VI/资产手册)→ 复用礼部素材回链门
    → 礼部 court_doc。品牌叙事里的数字/认证/绝对化排名同样必须回链素材,不得编造。"""
    return _run_flow_and_vet("flow_brand_strategy.yaml", task_input, archive=archive)


if __name__ == "__main__":
    # 确定性自检:不打网络,只验素材diff + 绝对化规则(知识库兜底另测)。
    src_material = "18650电芯-40℃下0.2C容量保持率≥90%;入选《先进技术成果转化名录》;每年减少140吨二氧化碳。"

    # 全部回链素材 → 应无 red/yellow(全 green)
    good = "本司18650电芯在-40℃下0.2C容量保持率≥90%,入选《先进技术成果转化名录》,每年减少140吨二氧化碳。"
    gi = vet_publication(good, src_material)
    assert all(it["level"] == "green" for it in gi), gi

    # 编造素材外认证 → red
    bad_cert = "本司产品通过《国家超低温电池认证》。"
    assert any(
        it["level"] == "red" and "编造" in it["title"]
        for it in vet_publication(bad_cert, src_material)
    ), "编造认证应判 red"

    # 素材外裸数字 → yellow 待人核(离线时知识库兜底不可用)
    bad_num = "容量保持率高达99.9%。"
    bn = vet_publication(bad_num, src_material)
    assert any(
        it["level"] in ("yellow", "red") and "99.9%" in it["title"] for it in bn
    ), bn

    # 绝对化用语 → red 合规
    sup = "本司技术全球第一,遥遥领先。"
    si = vet_publication(sup, src_material)
    assert sum(it["level"] == "red" for it in si) >= 2, si

    print("lipu_vet 自检通过:素材回链/编造认证/裸数字/绝对化 四类判定正确")
