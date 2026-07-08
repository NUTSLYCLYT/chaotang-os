"""src/libu_appointment_vet.py — 吏部任免/权限复核(责任图红线 + agent分席 → court_doc)。

2026-07-06 会审落地(zhangxiaolong:吏部真正独有的是"任免",招聘只是投影)。吏部双身份:
既管**人**的任免/权限/追责,也管 **agent/大神**的分席/升席。本引擎把设计文档
docs/dept_design/libu_personnel.md 的"五个震撼点"里的确定性部分落成 court_doc:

  ① 责任图红线(人):无 owner 的任务不准往下走;L4/L5自动化/资金/客户承诺缺人类 owner→red;
     reviewer 与 owner 同人(自审)/无替补 → yellow。对齐协议 gate/function_upgrades。
  ② agent 分席(大神):复用 persona_registry(证据厚度分判官/观点席)+ persona_eval.promotion_gate
     (纯函数硬棘轮:无判例/分不够一律不升席)。幻觉式任命比不任命更危险——离线不能升席时
     诚实判"需配网关跑 eval",绝不凭空给判官权。

deming 铁律:考功评系统不评人;merit_record 只记真实结果,不奖自评分(协议明文)。
# ponytail: owner/自审用关键词presence判(可证伪足够);"reviewer是否真独立"需人工,不在此层。
"""

from __future__ import annotations

from src import court_doc_builder as cdb

# 高权限动作:命中则必须有人类 owner(协议 gate:L4/L5自动化/资金/客户承诺须人类负责人)。
_HIGH_POWER = (
    "L4",
    "L5",
    "自动化",
    "自动执行",
    "自动报价",
    "资金",
    "付款",
    "打款",
    "客户承诺",
    "自动发布",
)
_HUMAN_OWNER = ("人类", "由人", "指派", "负责人", "owner", "签字", "审批人")
_OWNER_KW = ("owner", "负责人", "负责", "谁负责", "归属", "责任人")
_REVIEWER_KW = ("复核", "reviewer", "审核", "审批")
_BACKUP_KW = ("替补", "backup", "备份责任", "AB角")
_SELF_REVIEW = ("自审", "自己复核", "同一人", "owner 兼", "既是owner又是")

# 触发 agent/大神任免路的词(否则走人的责任图路)。
_PERSONA_KW = (
    "判官",
    "观点席",
    "升席",
    "升判官",
    "降席",
    "大神",
    "persona",
    "agent",
    "分席",
    "任命.*席",
)


def accountability_items(task_text: str) -> list[dict]:
    """人的任免/权限责任图红线。无 owner→red;高权限缺人类 owner→red;自审/无替补→yellow。"""
    t = task_text or ""
    items: list[dict] = []

    has_owner = any(k in t for k in _OWNER_KW)
    if not has_owner:
        items.append(
            {
                "level": "red",
                "title": "责任图缺 owner:未指定谁负责 —— 没有 owner 的任务不准往下走(协议 function_upgrades)",
                "fix": None,
                "evidence_ref": "truth://libu/accountability#owner",
            }
        )

    if any(k in t for k in _HIGH_POWER):
        if any(k in t for k in _HUMAN_OWNER):
            items.append(
                {
                    "level": "green",
                    "title": "高权限动作已挂人类 owner(L4/L5/资金/客户承诺)",
                    "fix": None,
                    "evidence_ref": "truth://libu/accountability#high_power",
                }
            )
        else:
            items.append(
                {
                    "level": "red",
                    "title": "高权限动作缺人类 owner:L4/L5自动化/资金/客户承诺必须人类负责人(协议 gate),否则 signed=false 卡死",
                    "fix": None,
                    "evidence_ref": "truth://libu/accountability#high_power",
                }
            )

    if any(k in t for k in _SELF_REVIEW):
        items.append(
            {
                "level": "yellow",
                "title": "reviewer 与 owner 同人(自审):复核形同虚设,拆分为独立角色",
                "fix": "指派独立 reviewer,owner 不得自审",
                "evidence_ref": "truth://libu/accountability#self_review",
            }
        )

    if has_owner and not any(k in t for k in _BACKUP_KW):
        items.append(
            {
                "level": "yellow",
                "title": "缺替补责任人(backup):owner 缺位时无人接手",
                "fix": "补 backup/AB 角",
                "evidence_ref": "truth://libu/accountability#backup",
            }
        )

    if not items:
        items.append(
            {
                "level": "green",
                "title": "责任图完整:owner 已定、无高权限越权、有替补",
                "fix": None,
                "evidence_ref": "truth://libu/accountability",
            }
        )
    return items


def persona_appointment_items(
    persona_name: str, *, seek_judge: bool = True
) -> list[dict]:
    """agent/大神分席:复用 persona_registry(证据厚度分席)+ persona_eval.promotion_gate。
    seek_judge=是否申请升/坐判官席。离线不能升席时诚实判待核,绝不凭空给判官权。"""
    try:
        from src import persona_eval, persona_registry
    except Exception:
        return [
            {
                "level": "yellow",
                "title": "分席模块不可用,人工定席",
                "fix": None,
                "evidence_ref": "truth://libu/persona",
            }
        ]

    p = persona_registry.get_persona(persona_name)
    if p is None:
        return [
            {
                "level": "yellow",
                "title": f"未登记大神「{persona_name}」:无语料无法定席,先入役登记(skills/personas/)",
                "fix": "补 SKILL.md/references 后自动分席",
                "evidence_ref": "truth://libu/persona#unregistered",
            }
        ]

    seat = "判官席" if p.can_conclude else "观点席"
    items = [
        {
            "level": "green" if p.can_conclude else "yellow",
            "title": f"「{persona_name}」当前 {seat}(证据 {p.total_bytes}B):{'可下结论' if p.can_conclude else 'RAG强制,不可下结论'}",
            "fix": None if p.can_conclude else "观点席发言须命中RAG,否则只提视角",
            "evidence_ref": "truth://libu/persona#tier",
        }
    ]

    if seek_judge and not p.can_conclude:
        # 观点席申请升判官:过 persona_eval 硬棘轮。离线无 LLM 打分 → eval_score=None → 不升。
        try:
            cases = persona_eval.load_cases(persona_name)
            case_count = len(cases)
        except Exception:
            case_count = 0
        gate = persona_eval.promotion_gate(
            persona_name, eval_score=None, case_count=case_count
        )
        items.append(
            {
                "level": "red" if not gate["promote"] else "green",
                "title": f"升判官申请:{'驳回' if not gate['promote'] else '准'} —— {gate['reason']}",
                "fix": (
                    "配 LLM 网关跑 persona_eval 真打分后再申请"
                    if not gate["promote"]
                    else None
                ),
                "evidence_ref": "truth://libu/persona#promotion_gate",
            }
        )
    return items


def build_appointment_verdict(
    task_text: str,
    *,
    persona_name: str | None = None,
    case_id: str | None = None,
    archive: bool = True,
) -> dict:
    """任免书 court_doc(doc_type=edict,印绶印)。指定 persona_name 走 agent 分席,否则走责任图。"""
    if persona_name:
        items = persona_appointment_items(persona_name)
        shielded = "为你拦下了:给证据不足的大神凭空判官权(幻觉式任命)"
    else:
        items = accountability_items(task_text)
        shielded = "为你拦下了:无人负责的任务往下走、高权限动作无人类追责"
    return cdb.build_court_doc(
        "libu_personnel",
        items=items,
        case_id=case_id,
        question=task_text,
        shielded=shielded,
        archive=archive,
        headline_map={
            "green": "可任命 —— 责任/席位已锚定",
            "yellow": "可任命草稿 —— 有 {n} 处待补(替补/RAG/独立复核)",
            "red": "建议驳回 —— 无 owner/高权限越权/证据不足升席,请复核(定夺在你)",
            "black": "高危 —— 移交御史/三省深查",
        },
        pending_note="任免复核 —— 有待补项",
        source_label="LIVE_SWARM",
    )


def run_libu_appointment(task_text: str, *, archive: bool = True) -> dict:
    """确定性任免复核(无 LLM flow:责任图/分席都是规则+registry,纯确定性)。
    task 命中大神/席位词且能提取 persona 名 → agent 分席;否则 → 人的责任图。"""
    persona = _extract_persona(task_text)
    return build_appointment_verdict(task_text, persona_name=persona, archive=archive)


def _extract_persona(task_text: str) -> str | None:
    """从任免任务里抽 persona 名:命中席位词 + 匹配已登记大神名。抽不到→None(走责任图)。"""
    import re

    if not re.search("|".join(_PERSONA_KW), task_text or ""):
        return None
    try:
        from src import persona_registry

        for p in persona_registry.list_personas():
            if p.name and p.name in task_text:
                return p.name
    except Exception:
        return None
    return None


if __name__ == "__main__":
    # 责任图:无 owner → red
    r = accountability_items("这个报价流程该怎么走")
    assert any(it["level"] == "red" and "owner" in it["title"] for it in r), r

    # 高权限缺人类 owner → red
    r2 = accountability_items("让系统 L4 自动报价并自动付款")
    assert any(it["level"] == "red" and "高权限" in it["title"] for it in r2), r2

    # 高权限 + 人类 owner → 无高权限red
    r3 = accountability_items(
        "L4 自动报价,指派张经理为人类 owner 并签字审批,李工为替补"
    )
    assert not any("高权限" in it["title"] and it["level"] == "red" for it in r3), r3

    # 责任图完整 → green
    r4 = accountability_items("owner 张三,reviewer 李四,替补王五,approval 走三省")
    assert any(it["level"] == "green" for it in r4), r4

    # court_doc 形状
    doc = build_appointment_verdict("谁负责这块,owner 张三,替补李四", archive=False)
    assert doc["dept"] == "libu_personnel" and doc["seal"]["stamp"] == "印绶印", doc

    print(
        "libu_appointment_vet 自检通过:责任图红线(owner/高权限/自审/替补)+ court_doc 正确"
    )
