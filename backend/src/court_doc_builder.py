"""src/court_doc_builder.py — 全院文书共享装配器(钦天监方案A·#4 泛化)。

把刑部判决引擎泛化成**部门无关**的 court_doc 装配器:一个模块让 11 部门全到 L1,零重复
(避免 11×2 维护债)。各部门只给一份薄配置(印章/doc_type),逻辑共用一处。

焊死两条宪法护栏(写一遍,全院共享):
- C6 接地门:观点席/律师未命中 RAG → 降级'需人工',gate=pending(`gate_conclusion`)。
- C2 大神不放行:`assert_not_gating(advisors)` —— 参谋名单混入放行人即抛。
确定性:不调 LLM。灯/装配/存证全可测;findings 由上游(蜂群/LLM)供。
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from src import persona_registry as pr

# 部门薄配置:slug → 文书身份(印章品牌系统,见 docs/dept_design/README.md)
# 各部门:doc_type/印章/主色 + 专属 actions(收口 actions 命名漂移:前端不再维护别名表)
DEPT_REGISTRY: dict[str, dict] = {
    "xingbu": {
        "doc_type": "verdict",
        "stamp": "天平印",
        "color": "朱砂红",
        "actions": ["apply_fixes", "escalate_court", "archive_amulet"],
    },
    "hubu": {
        "doc_type": "memorial",
        "stamp": "算盘印",
        "color": "金",
        "actions": ["approve_preview", "escalate_court", "archive_amulet"],
    },
    "libu": {
        "doc_type": "brief",
        "stamp": "礼器印",
        "color": "青",
        "actions": ["adopt_copy", "escalate_court", "archive_amulet"],
    },
    "bingbu": {
        "doc_type": "brief",
        "stamp": "令旗印",
        "color": "赤橙",
        "actions": ["take_next_action", "escalate_court", "archive_amulet"],
    },
    "gongbu": {
        "doc_type": "review",
        "stamp": "规矩印",
        "color": "钢蓝",
        "actions": ["apply_fixes", "run_release_gate", "archive_amulet"],
    },
    "libu_personnel": {
        "doc_type": "edict",
        "stamp": "印绶印",
        "color": "紫",
        "actions": ["confirm_appointment", "escalate_court", "archive_amulet"],
    },
    "qintianjian": {
        "doc_type": "forecast",
        "stamp": "星盘印",
        "color": "靛蓝",
        "actions": ["confirm_start", "escalate_court", "archive_amulet"],
    },
    "shiguan": {
        "doc_type": "archive",
        "stamp": "史笔印",
        "color": "墨",
        "actions": ["trace_evidence", "feed_flywheel", "export_amulet"],
    },
    "jinyiwei": {
        "doc_type": "brief",
        "stamp": "绣春刀印",
        "color": "玄黑暗红",
        "actions": ["verify_source", "escalate_court", "archive_amulet"],
    },
    "yushi": {
        "doc_type": "review",
        "stamp": "獬豸印",
        "color": "黑金",
        "actions": ["release", "block_escalate", "archive_amulet"],
    },
    "prime_minister": {
        "doc_type": "edict",
        "stamp": "相印",
        "color": "朱紫",
        "actions": ["confirm_start", "reorder", "escalate_court"],
    },
}

_DEPT_ABBR = {
    "xingbu": "XB",
    "hubu": "HB",
    "libu": "LB",
    "bingbu": "BB",
    "gongbu": "GB",
    "libu_personnel": "LR",
    "qintianjian": "QTJ",
    "shiguan": "SG",
    "jinyiwei": "JYW",
    "yushi": "YS",
    "prime_minister": "XX",
}

# 通用灯→一句结论(部门可用 headline_map 覆盖成自己的口吻)
_GENERIC_HEADLINE = {
    "green": "可放行 —— 未见致命风险",
    "yellow": "可行 —— 但先改 {n} 处",
    "red": "暂不可行 —— 有未解风险",
    "black": "高危 —— 移交深查 / 会审",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ── 丞相主线聚合(上书房收口:多部门 court_doc → 一条主线)─────────────────────
# 铁律(munger 警告):丞相只调序,**物理上不得改写**各部门的灯/原文,否则软化红灯=护身符失效。
_LIGHT_SEVERITY = {"black": 0, "red": 1, "yellow": 2, "green": 3}


def assemble_mainline(docs: list[dict], *, archive: bool = True) -> dict:
    """把各部门 court_doc 压成丞相主线(doc_type=edict,相印)。

    按灯严重度排序(黑>红>绿),主线第一句=最严重那条;**逐条复制各部门原灯/headline,不改写**。
    供上书房 shangshufang_loop.draft_edict 消费。
    """
    ordered = sorted(docs, key=lambda d: _LIGHT_SEVERITY.get(d.get("light"), 9))
    thread = [
        {
            "dept": d.get("dept"),
            "light": d.get("light"),
            "headline": d.get("headline"),
            "ref": (d.get("provenance") or {}).get("archive_id") or d.get("dept"),
        }
        for d in ordered
    ]
    lead = ordered[0] if ordered else None
    worst = lead.get("light") if lead else "green"
    headline = (
        f"先办:{lead.get('dept')} — {lead.get('headline')}" if lead else "无待办事项"
    )
    # 主线总灯 = 最严重部门的灯(不得比最差的更乐观)
    items = [
        {
            "level": t["light"] if t["light"] in ("red", "yellow", "green") else "red",
            "title": f"{t['dept']}: {t['headline']}",
            "evidence_ref": t["ref"],
        }
        for t in thread
    ]
    return build_court_doc(
        "prime_minister",
        items=items,
        headline_map={
            "green": headline,
            "yellow": headline,
            "red": headline,
            "black": headline,
        },
        escalate_black=(worst == "black"),
        actions=["confirm_start", "reorder", "escalate_court"],
        archive=archive,
    )


def assert_mainline_preserves(original_docs: list[dict], mainline: dict) -> None:
    """守 munger 铁律:丞相主线里每条的灯必须等于源部门原灯,软化即抛(绝不静默)。"""
    orig = {}
    for d in original_docs:
        key = (d.get("provenance") or {}).get("archive_id") or d.get("dept")
        orig[key] = d.get("light")
    for t in mainline.get("items") or []:
        key = t.get("evidence_ref")
        if (
            key in orig
            and t.get("level") != orig[key]
            and orig[key] in ("red", "yellow", "green")
        ):
            raise ValueError(
                f"丞相违规:软化了 {key} 的灯 {orig[key]}→{t.get('level')}(只准调序不准改原文)"
            )


def compute_light(items: list[dict], *, escalate_black: bool = False) -> str:
    """确定性灯:黑>红>黄>绿。红且无解→红;红/黄但都有改法→黄。"""
    if escalate_black:
        return "black"
    reds = [i for i in items if i.get("level") == "red"]
    if [i for i in reds if not i.get("fix")]:
        return "red"
    if reds or [i for i in items if i.get("level") == "yellow"]:
        return "yellow"
    return "green"


def _headline(light: str, items: list[dict], headline_map: dict | None) -> str:
    table = {**_GENERIC_HEADLINE, **(headline_map or {})}
    if light == "yellow":
        n = sum(
            1 for i in items if i.get("level") in ("red", "yellow") and i.get("fix")
        )
        return table["yellow"].format(n=n)
    return table[light]


def _grounding(
    advisors: list[str], rag_hit: bool, deterministic_gated: bool | None
) -> dict:
    """两种接地源(借工部):RAG 命中(法务/参谋)或确定性重算过(工程/财务)。

    deterministic_gated: None=非重算类;True=重算对得上;False=重算 UNKNOWN(禁假 PASS,降级)。
    """
    can = [a for a in advisors if pr.gate_conclusion(a, rag_hit)["can_conclude"]]
    rag_ground = rag_hit and bool(can)
    det_ground = deterministic_gated is True
    grounded = rag_ground or det_ground
    # 需要接地的场景:有参谋,或这是一个声明走了重算门的文书
    needs = bool(advisors) or (deterministic_gated is not None)
    mode = "deterministic" if det_ground else ("rag" if rag_ground else "none")
    return {
        "grounded": grounded,
        "needs": needs,
        "mode": mode,
        "rag_grounded": rag_ground,
        "deterministic_gated": det_ground,
    }


def build_court_doc(
    dept: str,
    *,
    items: list[dict],
    case_id: str | None = None,
    question: str = "",
    advisors: list[str] | None = None,
    shielded: str | None = None,
    adversarial: dict | None = None,
    actions: list[str] | None = None,
    escalate_black: bool = False,
    rag_hit: bool = False,
    deterministic_gated: bool | None = None,
    archive: bool = True,
    source_label: str = "MIXED",
    headline_map: dict | None = None,
    pending_note: str = "需人工复核",
    qintianjian_reviewed: bool = False,
) -> dict:
    """部门无关装配:findings(items)→ 一张符合 schemas/court_doc.json 的文书。

    接地两选一(借工部):rag_hit(法务/参谋命中法条)或 deterministic_gated(工程/财务重算对得上)。
    deterministic_gated=False 表示重算 UNKNOWN → 禁假 PASS,降级 pending。

    qintianjian_reviewed:此文书对应的任务是否经过钦天监前置参谋封成过 SEALED_BRIEF
    (见 src/qintianjian_brief.py)。默认 False——诚实标注"未经钦天监"，不冒充已经问过关键问题；
    调用方若已调 qintianjian_brief.seal_brief() 且拿到了 archive_hash，应显式传 True。
    """
    cfg = DEPT_REGISTRY.get(dept)
    if cfg is None:
        raise ValueError(f"未注册部门:{dept}(请在 DEPT_REGISTRY 登记印章/doc_type)")
    advisors = list(advisors or [])
    pr.assert_not_gating(advisors)  # C2:参谋名单不得混入放行人(否则抛)

    items = list(items or [])
    light = compute_light(items, escalate_black=escalate_black)
    ground = _grounding(advisors, rag_hit, deterministic_gated)
    headline = _headline(light, items, headline_map)
    gate = "passed"
    if ground["needs"] and not ground["grounded"]:
        why = (
            "重算 UNKNOWN" if deterministic_gated is False else "参谋未接地(RAG 未命中)"
        )
        headline = f"{pending_note} —— {why};初判:{headline}"
        gate = "pending"
        # 真实扫描件合同(H 盘双章合同,pypdf 抽不出文字)暴露:items 空时 compute_light
        # 恒定返回 green,即便 gate 已经 pending。green 是"确认没事"的强承诺,消费方
        # (前端/仪表盘)大概率只读 light 这个红绿灯字段,不会点开 headline 细节文本——
        # 未接地就不该继续挂绿灯,同 F 项"未接地不冒充权威"一个原则,这里补上 light 本身。
        if light == "green":
            light = "yellow"

    # 空产出 + 非 live 来源 ≠ 确认没事(2026-07-06 独立会审 HIGH 修复)。
    # 上面的接地降级只在 needs=True(有参谋/走重算门)时触发;无参谋文书 needs=False,
    # 整段被跳过——蜂群超时/全失败 → items 空 → compute_light([]) 恒 green + headline "可推进"。
    # 但来源是 FALLBACK/DEMO,根本没真跑。空结果是"没产出",不是"审过没风险",最不该发绿灯。
    # 与 F/H/N 一个原则:未真跑不冒充"确认没事"。三字段(light/headline/gate)一致降级。
    if not items and str(source_label).upper() in ("FALLBACK", "DEMO"):
        if light == "green":
            light = "yellow"
        if gate == "passed":
            gate = "pending"
            headline = f"{pending_note} —— 蜂群无产出({source_label}),未真跑不发绿灯;初判:{headline}"

    abbr = _DEPT_ABBR.get(dept, dept[:3].upper())
    # 随机后缀替代固定 "-000"(2026-07-09 复审修复):固定后缀 + 日期粒度下,同一天两次
    # 未显式传 case_id 的调用会撞同一个 case_id,truth_ledger 按 case_id 查询时可能读到
    # 不相关的另一条判决。调用方需要稳定 case_id 时应显式传,不依赖这里的自动生成。
    case_id = (
        case_id or f"{abbr}-{_now_iso()[:10].replace('-', '')}-{uuid.uuid4().hex[:6]}"
    )
    archive_id = case_id if archive else None
    if archive:
        try:
            from src import truth_ledger

            truth_ledger.record(
                swarm=dept,
                checker="court_doc_builder",
                verdict=light,
                case_id=case_id,
                detail=headline,
                evidence=str(question)[:200],
                provenance="LIVE_SWARM" if ground["rag_grounded"] else "FALLBACK",
            )
        except Exception:
            archive_id = None

    return {
        "doc_type": cfg["doc_type"],
        "dept": dept,
        "case_id": case_id,
        "light": light,
        "headline": headline,
        "shielded": shielded,
        "items": items,
        "adversarial": adversarial,
        "actions": actions
        or cfg.get("actions")
        or ["apply_fixes", "escalate_court", "archive_amulet"],
        "provenance": {
            "advisors": advisors,
            "archive_id": archive_id,
            "gate": gate,
            "rag_grounded": ground["rag_grounded"],
            "deterministic_gated": ground["deterministic_gated"],
            "grounding": ground["mode"],  # rag | deterministic | none
            "qintianjian_reviewed": qintianjian_reviewed,
        },
        "source_label": source_label,
        "signed": False,
        "seal": {
            "stamp": cfg["stamp"],
            "color": cfg["color"],
            "sealed_archive": archive_id,
        },
    }
