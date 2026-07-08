"""src/bingbu_battlecard.py — 兵部战报引擎(最小可行片:haolong 单条 flow → court_doc)。

六部能力评估确认:haolong/报价/OPC/语音销售/售后都是真实、独立跑着的 swarm,但从没人让它们
产出 court_doc(dept="bingbu")。docs/dept_design/bingbu.md §五设计的是编排三条 flow +
四大神判官顾问入审 + 报价强制回链 + 售后回填史馆——那是好几天的活。这里先做能立刻验证、
不假装完整的最小片:接 flow_haolong 一条真实输出,证明链路通,老实标"未经战情复核"
(advisors 列出该来的判官但 rag_hit=False,不冒充已经审过)。

不做的(留给后续):竞品攻防(flow_opc)、报价强制回链(flow_quotation)、
售后回填史馆/钦天监(flow_storage_aftercare)、golden_case 晋升。
"""

from __future__ import annotations

from src import court_doc_builder as cdb

# 兵部战报口吻(覆盖通用灯→结论)
_BATTLECARD_HEADLINE = {
    "green": "可推进 —— 线索初判良好",
    "yellow": "可推进 —— 但先看 {n} 处再跟进",
    "red": "建议暂缓推进 —— 线索初判有明显风险,请复核(定夺在你)",
    "black": "高危 —— 移交深查",
}

# haolong final_output 的六个字段(顺序即展示顺序)
_HAOLONG_FIELDS = [
    "线索评分",
    "客户档案",
    "触达策略",
    "沟通话术",
    "营销内容",
    "分发计划",
]


def haolong_output_to_items(final_output: dict, *, run_id: str = "") -> list[dict]:
    """haolong 六字段(全为自由文本)→ court_doc items。

    老实做法:不去正则猜"综合评级"对应红黄绿(haolong_qa 的自由文本格式不保真,
    猜错等于编数据),六项统一标 yellow(线索初判,未经兵部战情团判官复核)。
    """
    items: list[dict] = []
    for field in _HAOLONG_FIELDS:
        content = str(final_output.get(field, "") or "")
        if not content:
            continue
        preview = content[:80] + ("…" if len(content) > 80 else "")
        items.append(
            {
                "level": "yellow",
                "title": f"{field}:{preview}",
                "fix": "未经战情团(neil-rackham/chris-voss)复核,先人工过一遍再对客户承诺",
                "evidence_ref": (
                    f"truth://haolong/{run_id}#{field}" if run_id else "truth://haolong"
                ),
            }
        )
    return items


def _determinism_items(final_output: dict) -> list[dict]:
    """兵部确定性真值门(2026-07-07 补第二个"司"):复用 scripts/haolong_check.py——
    C1 线索评分算术自洽(ΣN×M%≈综合评分,算错=红,同户部数字勾稽)、C2 推测/确认标注、
    C3 客户真实性(回链真实成交记录,抓"称新客户实为复购"的臆造)。这是兵部此前缺的真值门:
    haolong_check 早在 truth_ledger,但 battlecard 只跑了 LLM 六字段没用它(吏部同款闲置)。
    严重度我方定:C1评分算错/C3臆造客户→red(销售最危险的谎),C2→yellow,PASS→green,UNKNOWN跳过。"""
    import sys
    from pathlib import Path

    scripts = str(Path(__file__).resolve().parent.parent / "scripts")
    if scripts not in sys.path:
        sys.path.insert(0, scripts)
    try:
        import haolong_check  # noqa: E402
    except Exception:
        return []
    text = "\n".join(str(final_output.get(f, "") or "") for f in _HAOLONG_FIELDS)
    items: list[dict] = []
    for c in haolong_check.check(text):
        name, status, detail = c["check"], c["status"], c["detail"]
        ref = f"truth://bingbu/haolong_check#{name}"
        if status == "UNKNOWN":
            continue
        if status == "PASS":
            items.append(
                {
                    "level": "green",
                    "title": f"{name}:{detail}",
                    "fix": None,
                    "evidence_ref": ref,
                }
            )
        elif name.startswith(("C1", "C3")):  # 评分算错 / 臆造客户关系:销售红线
            items.append(
                {
                    "level": "red",
                    "title": f"{name}未过:{detail}",
                    "fix": None,
                    "evidence_ref": ref,
                }
            )
        else:
            items.append(
                {
                    "level": "yellow",
                    "title": f"{name}未过:{detail}",
                    "fix": "补实测/确认标注,区分事实与推测",
                    "evidence_ref": ref,
                }
            )
    return items


def build_bingbu_battlecard(
    final_output: dict,
    *,
    run_id: str = "",
    case_id: str | None = None,
    question: str = "",
    archive: bool = True,
) -> dict:
    """haolong final_output → 兵部战报 court_doc。

    诚实标注:advisors 列出 docs/dept_design/bingbu.md §三设计文档里该来的完整战情团
    (判官 neil-rackham/chris-voss + 顾问 aaron-ross/charity-majors),但 rag_hit=False——
    没有真的走大神会审门,不冒充"已复核"。gate 会因此降级 pending,headline 带"未经战情复核"。

    2026-07-07:确定性真值门(_determinism_items,复用 haolong_check)在前,LLM 线索初判在后——
    算术/客户真实性挡门是硬判据(可红),六字段初判仍诚实标 yellow(未经战情复核)。"""
    items = _determinism_items(final_output) + haolong_output_to_items(
        final_output, run_id=run_id
    )
    if not items:
        items = []
    return cdb.build_court_doc(
        "bingbu",
        items=items,
        case_id=case_id,
        question=question,
        shielded="为你挡了:线索初判还没过战情团复核,先别对客户报承诺",
        advisors=["neil-rackham", "chris-voss", "aaron-ross", "charity-majors"],
        rag_hit=False,
        archive=archive,
        headline_map=_BATTLECARD_HEADLINE,
        pending_note="线索初判 —— 未经战情复核",
        source_label="LIVE_SWARM",
    )


def run_bingbu_battlecard(task_input: str, *, archive: bool = True) -> dict:
    """端到端:跑真实 flow_haolong → 装配兵部战报 court_doc。真实 LLM 调用,非确定性。"""
    from pathlib import Path

    from src.flow_engine import FlowEngine

    config_path = str(
        Path(__file__).resolve().parent.parent / "config" / "flow_haolong.yaml"
    )
    engine = FlowEngine(config_path)
    run_log = engine.run(task_input)
    return build_bingbu_battlecard(
        run_log.final_output or {},
        run_id=run_log.run_id,
        question=task_input,
        archive=archive,
    )
