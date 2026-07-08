"""src/quotation_verdict.py — 报价红线复核(flow_quotation → court_doc,最小可行片)。

背景(2026-07-04会审,纠正一个错误假设):原以为报价没有任何红线检查,打算复用工部
pack_rd_sizing 接线——实测读了 src/prompts_quotation.py 才发现假设错了:quotation 自己的
qa_tech_support 步骤(PROMPT_QUOTATION_QA)已经有 C1-C10 硬核查,其中 C7"实际毛利率≥目标
毛利率(毛利生命线)"就是红线本身,C6/C8/C10 是报价/付款/BOM的数字一致性检查。pack_rd_sizing
检查的是电芯串并联电气参数,跟报价的BOM成本/毛利完全不是一回事,硬接会产出假红灯,不能用。

真正缺的不是"红线检查"(已经有),是"红线检查结果没有court_doc包装"——没有红黄绿灯、
没有签字门、没有provenance,只是flow内部一段QA JSON,外部看不到。这份文件补这一层。

诚实标注:C7毛利率红线是LLM自评(quotation_qa prompt让模型自己算毛利率判PASS/FAIL),
不是像pack_rd_sizing那样的确定性重算——advisors不放行,不冒充比实际更可信。
按 docs/chaotang_workflow_swarm_upgrade_2026-06-07.md 的设计意图("报价低于红线时必须转
户部复核"),挂在户部(hubu)名下,跟户部真实现金流引擎(hubu_memorial_verdict.py)区分开
靠 case_id 前缀和 headline 措辞,不是新建一个衙门身份。
"""

from __future__ import annotations

from src import court_doc_builder as cdb

_QUOTATION_HEADLINE = {
    "green": "可发 —— 报价数字自洽、毛利达标",
    "yellow": "可发 —— 但先核实 {n} 处QA数据缺失",
    "red": "暂缓发出 —— 毛利/数字一致性未过硬核查",
    "black": "高危 —— 移交户部深查",
}

# C7 是毛利红线本身,其余是数字一致性(任一 FAIL 都不该放行发给客户)
_HARD_CHECK_LABELS = {
    "C1数字勾稽": "报价/付款数字勾稽",
    "C6报价明细加总与总报价一致性": "报价明细加总",
    "C7实际毛利率≥目标毛利率": "毛利率红线",
    "C8付款节点加总等于合同总额": "付款节点加总",
    "C9质保期与成本预留年限一致": "质保期一致性",
    "C10BOM单价×数量=小计可复算": "BOM算术",
}


def quotation_qa_to_items(qa_result: dict | None, *, run_id: str = "") -> list[dict]:
    """qa_tech_support 步骤产出的 hard_checks(C1-C10) → court_doc items。

    C7(毛利率)FAIL 直接标 red(红线击穿);其余数字一致性 FAIL 也标 red(报价不能自相矛盾);
    全 PASS 才 green,且 C7 标注"LLM自评非确定性重算"不冒充已核实到位。
    """
    hard_checks = (qa_result or {}).get("hard_checks") or {}
    notes = (qa_result or {}).get("hard_check_notes", "")
    items: list[dict] = []
    for code, label in _HARD_CHECK_LABELS.items():
        verdict = hard_checks.get(code)
        ref = f"truth://quotation/{run_id}#{code}" if run_id else "truth://quotation"
        if verdict == "FAIL":
            # 红线击穿(如毛利率FAIL)不挂 fix——挂了 fix 会被 compute_light 软成 yellow
            # (同 gongbu_review_verdict.py 的做法:推荐值写进标题,不挂 fix,不软化真红灯)。
            reason = notes or f"{label}不一致,需商务经理/户部重新核算后再发"
            items.append(
                {
                    "level": "red",
                    "title": f"{label}未过硬核查({code}):{reason}",
                    "fix": None,
                    "evidence_ref": ref,
                }
            )
        elif verdict == "PASS":
            fix = (
                "LLM自评,非确定性重算(不同于工部pack_rd_sizing)"
                if code.startswith("C7")
                else None
            )
            items.append(
                {
                    "level": "green",
                    "title": f"{label}达标({code})",
                    "fix": fix,
                    "evidence_ref": ref,
                }
            )
        # NA/缺失:不生成条目,不假装检查过
    if not items:
        items.append(
            {
                "level": "yellow",
                "title": "QA硬核查数据缺失",
                "fix": "未获取到 hard_checks,需人工复核后再发",
                "evidence_ref": "truth://quotation",
            }
        )
    return items


def build_quotation_verdict(
    qa_result: dict | None,
    *,
    run_id: str = "",
    case_id: str | None = None,
    question: str = "",
    archive: bool = True,
) -> dict:
    items = quotation_qa_to_items(qa_result, run_id=run_id)
    # 不传 advisors/rag_hit/deterministic_gated:没有具体大神在这里签字放行,
    # 灯完全由 hard_checks 的 item 颜色决定(compute_light),不额外触发接地门下压。
    return cdb.build_court_doc(
        "hubu",
        items=items,
        case_id=case_id,
        question=question,
        shielded="为你拦下了:毛利击穿或数字对不上的报价直接发给客户",
        archive=archive,
        headline_map=_QUOTATION_HEADLINE,
        pending_note="报价复核 —— QA数据不全",
        source_label="LIVE_SWARM",
    )


def run_quotation_verdict(task_input: str, *, archive: bool = True) -> dict:
    """端到端:跑真实 flow_quotation → 装配报价红线复核 court_doc。真实 LLM 调用,非确定性。"""
    from pathlib import Path

    from src.flow_engine import FlowEngine

    config_path = str(
        Path(__file__).resolve().parent.parent / "config" / "flow_quotation.yaml"
    )
    engine = FlowEngine(config_path)
    run_log = engine.run(task_input)
    return build_quotation_verdict(
        run_log.qa_result,
        run_id=run_log.run_id,
        question=task_input,
        archive=archive,
    )
