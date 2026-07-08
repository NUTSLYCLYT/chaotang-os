"""src/signoff_gate.py — "必须人签"门:把自动化档 × 人签留痕环接起来(不重造两边)。

闭合"决策权在客户"最后一环:automation_tier 判出"必须人签"的不可逆动作,交到人手里签;
签字(批/驳)经 signoff_learning 落库(带 signer=谁拍的板),reject 沉淀成该部教训,下次上奏前
recall 亮给签字人。本模块只做"连接",不重造:
- 谁需要签 → src.automation_tier.tier_for_doc(判 require_human_sign)
- 签字留痕 + 教训 → src.signoff_learning.record_signoff / recall_lessons

三个入口(给 API/前端/编排调):
- needs_signoff(doc)   → 这张判决要不要人签
- signoff_brief(doc)   → 签字人该看什么:自动化档 + 红线项 + 该部历史被驳教训(先规避)
- resolve_signoff(...) → 人签了,落库(who/批驳/理由),返回确认

诚实:本模块只提供机制,真正的批/驳由人做、signer 由调用方传真实身份——绝不代签、绝不默认通过。
"""

from __future__ import annotations

from src import automation_tier as at
from src import signoff_learning as sl


def needs_signoff(doc: dict) -> bool:
    """这张 court_doc 是否落在"必须人签"档(不可逆红/黑)。"""
    return at.tier_for_doc(doc).get("tier") == at.REQUIRE_HUMAN_SIGN


def signoff_brief(doc: dict) -> dict:
    """签字人决策前该看的一页:自动化档 + 红线项 + 该部历史被驳教训(自愈环)。
    不替人决定,只把"过去这类被驳过、因为X"摆出来,让这次人签更明白。"""
    tier = at.tier_for_doc(doc)
    dept_cn = _dept_cn(doc.get("dept", ""))
    items = doc.get("items") or []
    reds = [
        str(i.get("title", "")) for i in items if i.get("level") in ("red", "black")
    ]
    return {
        "required": tier["tier"] == at.REQUIRE_HUMAN_SIGN,
        "auto_action": tier["tier"],
        "auto_action_label": tier["label"],
        "reason": tier["reason"],
        "dept": dept_cn,
        "case_id": doc.get("case_id", ""),
        "headline": doc.get("headline", ""),
        "red_items": reds,
        "past_rejections": sl.recall_lessons(dept_cn) if dept_cn else [],
    }


def resolve_signoff(
    *,
    case_id: str,
    dept: str,
    decision: str,
    signer: str,
    reason: str = "",
) -> dict:
    """人签了 → 落库。decision: approve/reject;signer 必填(谁拍的板);reject 必给理由。
    这里不做任何"默认通过"——没有真人签字就没有这条记录。"""
    if not (signer or "").strip():
        raise ValueError("signer 不能为空:必须记下谁拍的板(决策权在客户,可追责)")
    dept_cn = _dept_cn(dept)
    return sl.record_signoff(
        case_id=case_id, decision=decision, dept=dept_cn, reason=reason, signer=signer
    )


# court_doc 的 dept slug → 中文部门名(signoff_learning 按中文部门隔离教训)。
_SLUG_CN = {
    "xingbu": "刑部",
    "hubu": "户部",
    "libu": "礼部",
    "libu_personnel": "吏部",
    "bingbu": "兵部",
    "gongbu": "工部",
    "jinyiwei": "锦衣卫",
    "qintianjian": "钦天监",
    "yushi": "御史",
}


def _dept_cn(dept: str) -> str:
    return _SLUG_CN.get(dept, dept or "")


if __name__ == "__main__":
    # 不可逆红(刑部合同)→ 需人签
    doc = {
        "dept": "xingbu",
        "light": "red",
        "case_id": "XB-demo-1",
        "headline": "建议驳回 —— 触合同红线",
        "items": [{"level": "red", "title": "违约金50%超红线"}],
    }
    assert needs_signoff(doc) is True
    b = signoff_brief(doc)
    assert b["required"] and b["dept"] == "刑部" and b["red_items"]
    print(
        "签字简报:",
        {k: b[k] for k in ("required", "auto_action_label", "dept", "red_items")},
    )

    # 可逆红(兵部线索)→ 不需人签(走一键放行)
    doc2 = {
        "dept": "bingbu",
        "light": "red",
        "items": [{"level": "red", "title": "评分算错"}],
    }
    assert needs_signoff(doc2) is False

    # resolve 必须有 signer
    try:
        resolve_signoff(case_id="x", dept="xingbu", decision="approve", signer="")
        raise AssertionError("空 signer 应被拒")
    except ValueError:
        pass
    print("signoff_gate 自检通过:不可逆需人签/可逆不需/空signer拒绝")
