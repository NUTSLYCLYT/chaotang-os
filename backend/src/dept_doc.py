"""src/dept_doc.py — 通用部门文书桥(剩余部门升 L1,零重复)。

刑部/工部/户部有各自的确定性引擎;其余部门暂无专用重算,但同样要能产出 court_doc。
本模块给每部门一份**口吻**(headline_map)+ 一个薄 `build_dept_doc`,套全院 `court_doc_builder`——
一处登记,8 部门全 L1-ready,不写 8 份引擎。数据源(蜂群/LLM/确定性)由上游插入,本桥只负责装配口吻。
"""
from __future__ import annotations

from src import court_doc_builder as cdb

# 各部门口吻(灯→一句结论)。刑部/工部/户部由各自引擎覆盖;此处补其余 8 部门。
DEPT_HEADLINES: dict[str, dict] = {
    "libu": {"green": "可发 —— 表达稳妥", "yellow": "可发 —— 先改 {n} 处",
             "red": "勿发 —— 踩红线", "black": "高危 —— 重大舆情风险"},
    "bingbu": {"green": "可推进", "yellow": "可推进 —— 先拆 {n} 个异议",
               "red": "暂缓 —— 异议未解", "black": "高危 —— 客户将流失"},
    "libu_personnel": {"green": "可任免", "yellow": "可任免 —— 须补 {n} 项",
                       "red": "不予任免 —— 权责不清", "black": "高危 —— 越权/合规风险"},
    "qintianjian": {"green": "可开工", "yellow": "可开工 —— 先定 {n} 问",
                    "red": "暂不开工 —— 方向未明", "black": "高危 —— 不可逆,需签字"},
    "shiguan": {"green": "已归档", "yellow": "已归档 —— {n} 项待考",
                "red": "归档存疑 —— 证据不足", "black": "高危 —— 证据链断"},
    "jinyiwei": {"green": "情报可信", "yellow": "可参考 —— {n} 项待核",
                 "red": "勿信 —— 脏情报", "black": "高危 —— 异动预警"},
    "yushi": {"green": "放行", "yellow": "放行 —— 带 {n} 条件",
              "red": "驳回", "black": "封杀 —— 落刑部"},
    "prime_minister": {"green": "主线已定", "yellow": "主线已定 —— {n} 项待办",
                       "red": "主线受阻 —— 有红灯部门", "black": "高危 —— 不可逆,需圣裁"},
}

PENDING_NOTE = {
    "yushi": "暂缓放行", "jinyiwei": "情报待核", "shiguan": "归档待考",
    "qintianjian": "暂不开工", "libu_personnel": "暂不任免",
    "libu": "暂不发", "bingbu": "暂缓推进", "prime_minister": "主线待定",
}


def build_dept_doc(
    dept: str,
    items: list[dict],
    *,
    case_id: str | None = None,
    question: str = "",
    shielded: str | None = None,
    advisors: list[str] | None = None,
    rag_hit: bool = False,
    deterministic_gated: bool | None = None,
    escalate_black: bool = False,
    archive: bool = True,
    source_label: str = "MIXED",
) -> dict:
    """通用部门文书装配:套该部门口吻 + 全院 court_doc 骨架/接地门/C2/存证。"""
    return cdb.build_court_doc(
        dept,
        items=items,
        case_id=case_id,
        question=question,
        shielded=shielded,
        advisors=advisors,
        rag_hit=rag_hit,
        deterministic_gated=deterministic_gated,
        escalate_black=escalate_black,
        archive=archive,
        source_label=source_label,
        headline_map=DEPT_HEADLINES.get(dept),
        pending_note=PENDING_NOTE.get(dept, "需人工复核"),
    )
