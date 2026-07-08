"""src/qintianjian_brief.py — 钦天监简报(SEALED_BRIEF)落地存储。

见 docs/qintianjian.md。简报本身不新建表/API，复用已有 truth_ledger 台账(append-only，
court_doc_builder 同款基础设施)，checker="qintianjian_brief"。

不做的：不校验/不阻断任何执行路径(那是代码层门禁，本次改进范围之外，见 docs/qintianjian.md
"优缺点"章节的诚实记录)——这里只负责"简报有没有地方存、存不存得住、查不查得到"。
"""

from __future__ import annotations

from typing import Any

from src import truth_ledger


def seal_brief(
    original_goal: str,
    *,
    must_decide_now: list[dict[str, Any]],
    defer: list[str] | None = None,
    personas: list[str] | None = None,
    human_signoff_required: bool = False,
    execution_boundary: str = "",
    target_swarm: str = "",
    case_id: str = "",
) -> dict[str, Any]:
    """把用户选择封装成 SEALED_BRIEF，写进 truth_ledger，返回带归档引用的简报 dict。"""
    brief: dict[str, Any] = {
        "mode": "qintianjian",
        "status": "SEALED_BRIEF",
        "original_goal": original_goal,
        "must_decide_now": must_decide_now,
        "defer": defer or [],
        "personas": personas or [],
        "human_signoff_required": human_signoff_required,
        "execution_boundary": execution_boundary,
        "target_swarm": target_swarm,
    }
    entry = truth_ledger.record(
        swarm=target_swarm or "qintianjian",
        checker="qintianjian_brief",
        verdict="signoff_pending" if human_signoff_required else "sealed",
        detail=original_goal[:200],
        case_id=case_id,
        evidence=f"{len(must_decide_now)} must_decide_now",
        provenance="qintianjian_protocol",
    )
    brief["archive_hash"] = entry["hash"]
    brief["archived_at"] = entry["ts"]
    return brief


def latest_brief_for(target_swarm: str, case_id: str) -> dict[str, Any] | None:
    """查某任务是否已有钦天监简报(供 court_doc 的 qintianjian_reviewed 诚实标注消费)。"""
    return truth_ledger.latest_verdict(
        target_swarm, case_id, checker="qintianjian_brief"
    )


def check_outcome(
    target_swarm: str,
    case_id: str,
    *,
    predicted_probability: float,
    actual_outcome: float,
) -> dict[str, Any]:
    """记录预测的真实结果,算 Brier score(越低越准,0=完美,1=最差),写进 truth_ledger。

    这是唯一能回答"钦天监预测得准不准"的证据——不是靠更多数据,是靠攒够这类记录。
    predicted_probability/actual_outcome 都是 0-1(actual_outcome 通常是 0 或 1,真实发生与否)。
    """
    brier = (predicted_probability - actual_outcome) ** 2
    return truth_ledger.record(
        swarm=target_swarm,
        checker="qintianjian_calibration",
        verdict="scored",
        score=brier,
        case_id=case_id,
        detail=f"predicted={predicted_probability} actual={actual_outcome} brier={brier:.4f}",
        provenance="qintianjian_protocol",
    )
