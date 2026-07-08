"""src/gongbu_review_verdict.py — 工部验收引擎(借工部自有重算门 + 全院装配器)。

工部不靠 RAG 接地,靠**确定性重算**:`pack_rd_sizing.run_sizing_gate` 重新推导串并数,
对不上标偏差,抽不到 → UNKNOWN(禁假 PASS)。本引擎把重算 verdict 接成全院 court_doc(review),
deterministic_gated 由"是否成功重算(extracted)"决定 —— 这是工部借给全院的第二接地模式。

薄包装:逻辑全在 court_doc_builder,工部只提供验收口吻 + 重算→items 映射。
"""
from __future__ import annotations

from src import court_doc_builder as cdb

# 工部验收口吻(覆盖通用灯→结论)
_REVIEW_HEADLINE = {
    "green": "验收通过 —— 重算一致",
    "yellow": "可收 —— 须先修 {n} 处",
    "red": "不予验收 —— 重算对不上 / 不自洽",
    "black": "高危 —— 移交深查",
}

# docs/dept_design/gongbu.md §三:工程分支判官(kent-beck/charity-majors/martin-fowler)+
# 顾问(karpathy/elon-musk-perspective/sam-altman)。此前 build_gongbu_review 没传,
# provenance.advisors 一直是空的——审计追不到"设计上该谁看"。deterministic_gated 已经
# 独立保证禁假 PASS,这里补的是透明度(谁该看),不是修门禁本身。
_ENGINEERING_ADVISORS = [
    "kent-beck", "charity-majors", "martin-fowler",
    "karpathy", "elon-musk-perspective", "sam-altman",
]


def sizing_verdict_to_items(v: dict) -> list[dict]:
    """把 pack_rd 重算 verdict 的偏差 → court_doc items(确定性证据,非 LLM)。"""
    items: list[dict] = []
    devs = v.get("deviations") or {}
    if not v.get("extracted"):
        items.append({"level": "red", "title": "精算输出无法解析(UNKNOWN)",
                      "fix": "补可解析 fenced JSON 再审", "evidence_ref": "pack_rd_sizing"})
        return items
    det = v.get("deterministic") or {}
    for key, truth_key, rec_key in (
        ("series", "seriesTruth", "series"), ("parallel", "parallelTruth", "parallel")
    ):
        if v.get(truth_key) == "FAIL":
            # 重算不自洽 = 不予验收(红);推荐值写进标题,不挂 fix(不软成黄)
            items.append({
                "level": "red",
                "title": f"{key} 串并数与确定性重算不符(偏差 {devs.get(key)},应为 {det.get(rec_key)})",
                "odds": "确定性", "impact": f"偏差 {devs.get(key)}",
                "evidence_ref": "pack_rd_sizing",
            })
    if v.get("green"):
        items.append({"level": "green", "title": "串并数与确定性重算一致",
                      "evidence_ref": "pack_rd_sizing"})
    return items


def build_gongbu_review(
    sizing_verdict: dict,
    *,
    case_id: str | None = None,
    question: str = "",
    shielded: str | None = None,
    archive: bool = True,
) -> dict:
    """工部验收 court_doc:重算 verdict → review 文书,确定性接地(extracted=True 才算接地)。"""
    return cdb.build_court_doc(
        "gongbu",
        items=sizing_verdict_to_items(sizing_verdict),
        case_id=case_id,
        question=question,
        shielded=shielded,
        advisors=_ENGINEERING_ADVISORS,
        deterministic_gated=bool(sizing_verdict.get("extracted")),  # UNKNOWN→False→禁假PASS
        archive=archive,
        headline_map=_REVIEW_HEADLINE,
        pending_note="不予验收",
    )


def run_gongbu_review(presale_output: str, task_input: str, **kw) -> dict:
    """端到端:跑工部重算门 → 装配成 review court_doc。"""
    from src.pack_rd_sizing import run_sizing_gate
    v, _rendered = run_sizing_gate(presale_output, task_input)
    return build_gongbu_review(v, question=task_input, **kw)
