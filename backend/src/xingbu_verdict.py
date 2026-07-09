"""src/xingbu_verdict.py — 刑部判决书引擎(钦天监方案A)。

现已收成全院共享装配器 `court_doc_builder` 的**薄包装**(#4 泛化:逻辑共用一处,零重复):
刑部只提供自己的口吻(判决式 headline + "需人工律师复核")+ 默认判官(posner/schneier)。
灯计算/接地门/C2/存证全在 court_doc_builder,刑部不再各写一套。

接地铁律不变:posner/schneier 是观点席,未命中 RAG → 降级"需人工律师复核"。
"""

from __future__ import annotations

import re

from src import court_doc_builder as cdb

SEAL = {"stamp": "天平印", "color": "朱砂红"}
DEFAULT_ADVISORS = ["richard-posner", "bruce-schneier"]

# 刑部判决口吻(覆盖装配器的通用灯→结论)
_VERDICT_HEADLINE = {
    "green": "可放行 —— 未见致命风险",
    "yellow": "可签 —— 但先改 {n} 处,否则有风险",
    "red": "暂不可签 —— 有致命风险未解",
    "black": "高危 —— 移交刑部深查 / 需开庭",
}

# 向后兼容:旧调用点仍可用 xingbu_verdict.compute_light
compute_light = cdb.compute_light


def build_verdict(
    case: dict,
    *,
    rag_hit: bool = False,
    archive: bool = True,
    source_label: str = "MIXED",
) -> dict:
    """组装一张刑部判决(court_doc verdict)。委托共享装配器,只注入刑部口吻。

    case = {case_id, question, items:[...], adversarial?, advisors?, shielded?, escalate_black?}
    """
    return cdb.build_court_doc(
        "xingbu",
        items=case.get("items") or [],
        case_id=case.get("case_id"),
        question=case.get("question", ""),
        advisors=list(case.get("advisors") or DEFAULT_ADVISORS),
        shielded=case.get("shielded"),
        adversarial=case.get("adversarial"),
        escalate_black=bool(case.get("escalate_black")),
        rag_hit=rag_hit,
        archive=archive,
        source_label=source_label,
        headline_map=_VERDICT_HEADLINE,
        pending_note="需人工律师复核",
    )


_EXTRACT_SYS = (
    "你是资深合同/合规律师。审查给定文本,找出对客户不利的风险点。"
    "每个风险点**必须给出法律依据(法名+条号)**填入 basis 字段,如《民法典》第621条;"
    "**没有明确法条依据的风险,basis 留空字符串,不要杜撰不存在的条号**(禁编造)。"
    '只输出 JSON 数组,每项 {"level":"red|yellow|green","title":"风险",'
    '"impact":"影响/金额","fix":"一句话怎么改","basis":"《民法典》第X条 或 空"}。'
    "不要任何解释、不要 markdown。"
)


def _parse_findings(raw: str) -> list[dict]:
    """从 LLM 输出抠出 findings 数组(容忍 ```json 包裹/前后废话/{findings:[]} 包裹)。"""
    import json
    import re

    s = re.sub(
        r"^```(?:json)?|```$", "", (raw or "").strip(), flags=re.MULTILINE
    ).strip()
    m = re.search(r"\[.*\]", s, re.DOTALL)
    try:
        data = json.loads(m.group(0)) if m else json.loads(s)
    except (json.JSONDecodeError, ValueError):
        return []  # 抽不出有效 JSON → 空,不崩不编造(由接地门降级)
    if isinstance(data, dict):
        data = data.get("findings") or data.get("items") or []
    out = []
    for d in data if isinstance(data, list) else []:
        if isinstance(d, dict) and d.get("title"):
            lvl = str(d.get("level", "yellow")).lower()
            out.append(
                {
                    "level": lvl if lvl in ("red", "yellow", "green") else "yellow",
                    "title": str(d["title"]),
                    "impact": d.get("impact"),
                    "fix": d.get("fix"),
                    "basis": d.get("basis")
                    or d.get("依据")
                    or "",  # G:法条依据(条号),供接地判定+前端展示
                }
            )
    return out


def _annotate_citations(findings: list[dict]) -> list[dict]:
    """给每条 finding 标 basis_verified:引的条号在法条库核到了没(schneier:AI 引证→可核引证)。"""
    from src.lawyer_rag import verify_citation

    out = []
    for f in findings:
        v = verify_citation(str(f.get("basis") or ""))
        out.append(
            {
                **f,
                "basis_verified": bool(v["has_citation"] and v["verified"]),
                "basis_unverified_arts": v["unverified"],
            }
        )
    return out


def _findings_grounded(findings: list[dict]) -> bool:
    """H+核验:接地 = 红/黄风险项里至少一条引到**法条库能核到**的条号。

    只引了条号但库里核不到(LLM 可能引错/编造)→ 不算接地,交门降级(禁假)。全无引证 → 未接地。
    """
    risk = [f for f in findings if f.get("level") in ("red", "yellow")]
    return any(f.get("basis_verified") for f in risk)


def _active_call(system: str, user: str) -> str:
    """走 active provider(默认 DeepSeek,见 config/providers.yaml)做确定性抽取。"""
    import os
    from src.model_adapter import ModelAdapter
    from src.provider import get_active_provider

    p = get_active_provider() or {}
    adapter = ModelAdapter(
        model=p.get("default_model", "openai/deepseek-chat"),
        api_base=p.get("api_base", "https://api.deepseek.com/v1"),
        api_key=os.environ.get(p.get("api_key_env", "DEEPSEEK_API_KEY"), ""),
        temperature=0,
    )
    res = adapter.call(system, user, skip_budget=True)
    if res.get("status") != "success":
        raise RuntimeError(f"抽取模型调用失败: {res.get('output', '')[:120]}")
    return res["output"]


def extract_findings_via_llm(raw_text: str, *, call_fn=None) -> list[dict]:
    """原始合同/承诺文本 → 结构化 findings(走 active provider LLM)。

    call_fn(system,user)->str 可注入(测试用 mock);默认走 _active_call。
    抽不出 → 返回 [](由 build_verdict 的接地门处理,不编造)。
    """
    call = call_fn or _active_call
    return _parse_findings(call(_EXTRACT_SYS, raw_text[:8000]))


def run_verdict_from_text(
    raw_text: str,
    *,
    case_id: str | None = None,
    rag_hit: bool | None = None,
    archive: bool = True,
    call_fn=None,
) -> dict:
    """端到端:合同全文 → LLM 抽 findings → 刑部判决 court_doc。

    rag_hit 默认 None = **由系统检索律师法条库算出**(lawyer_rag,堵自报洞 schneier);
    仅测试可显式传 True/False 覆盖。文本"够不够长/是不是扫描件"不是这层的事——
    这里只管"给什么文本就判什么",抽取质量问题留给抽取那一层(pdf→text 的调用方)判断。
    """
    findings = _annotate_citations(extract_findings_via_llm(raw_text, call_fn=call_fn))
    if rag_hit is None:
        # H+核验:接地看"findings 引的条号库里核得到",不是"输入含不含法律词"(修假接地信号)
        rag_hit = _findings_grounded(findings)
    # 这条路径真调了 LLM 抽 findings(extract_findings_via_llm),跟 legal.py /verdict 那条
    # "调用方已给结构化 items,本函数不清楚数据来路"的路径不一样,该标 LIVE_SWARM；
    # 未接地(rag_hit=False)时 build_court_doc 自己会把 gate 降 pending，不靠 source_label
    # 兜底(2026-07-09 复审修复:此前不传 source_label，恒落回默认 MIXED，真判决也显示"未验真")。
    return build_verdict(
        {"case_id": case_id, "question": raw_text[:120], "items": findings},
        rag_hit=rag_hit,
        archive=archive,
        source_label="LIVE_SWARM",
    )
