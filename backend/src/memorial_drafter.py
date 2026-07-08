"""拟奏节点: 蜂群产出 → MemorialCard 的确定性整理器 (替换截断式提取).

天才设计 (2026-06-10 已批): 判词不让 LLM 另写 —— QA 步骤顺手填「判词槽位表」
(verdict_slots), 本节点只做槽位拼装; 零新增 LLM 调用, 零新增幻觉面。
凭据指针走 retrieved_snapshot 哈希引用, 不上向量检索 (天才建议)。

职责分离: 蜂群答题 (本节点产出结构卡), 御史判卷 (yushi_gate 独立放行)。
本模块禁止 import 任何 LLM 客户端。
"""

from __future__ import annotations

import logging
import re
from typing import Any

from src.contracts.memorial_card import (
    NEXT_ACTION_LABELS,
    KeyFinding,
    MemorialCard,
    Provenance,
)

logger = logging.getLogger(__name__)

# 槽位表建议动作 → 枚举的容错映射 (中文/英文均收)
_ACTION_ALIASES: dict[str, str] = {
    "approve_archive": "approve_archive",
    "return_rework": "return_rework",
    "escalate_junjichu": "escalate_junjichu",
    "escalate": "escalate_junjichu",
    "准奏归档": "approve_archive",
    "准奏": "approve_archive",
    "归档": "approve_archive",
    "打回重办": "return_rework",
    "打回": "return_rework",
    "重办": "return_rework",
    "移交军机处": "escalate_junjichu",
    "上奏": "escalate_junjichu",
}

# 无槽位时判词兜底的取材优先级 (结论性字段优先; 确定性, 非 LLM)
_VERDICT_FALLBACK_KEYS = ("风险与建议", "决策建议", "解决方案", "核心需求", "项目概要", "议题")

_NUM_PATTERN = re.compile(r"[¥￥$]?\d[\d,，.]*\s*[%％万亿元台所份件天日分秒条个]?")


def _first_sentence(text: str, limit: int) -> str:
    text = " ".join(str(text).split())
    for sep in ("。", "；", ";", "!", "！"):
        idx = text.find(sep)
        if 0 < idx < limit:
            return text[: idx + 1]
    return text[:limit]


def _normalize_action(raw: Any, qa_pass: bool | None) -> tuple[str, list[str]]:
    """槽位建议动作 → 枚举; 失配按 QA 信号定, 并记录 fallback 原因。"""
    notes: list[str] = []
    key = str(raw or "").strip()
    if key in _ACTION_ALIASES:
        return _ACTION_ALIASES[key], notes
    if key:
        notes.append(f"action_alias_miss:{key[:20]}")
        logger.warning("memorial_drafter: 建议动作未命中枚举 %r, 按 QA 信号回退", key[:40])
    if qa_pass is True:
        return "approve_archive", notes
    if qa_pass is False:
        return "return_rework", notes
    notes.append("action_from_unknown_qa")
    return "escalate_junjichu", notes


def _verdict_from_slots(slots: dict[str, Any]) -> str:
    """槽位拼装: 已{做了什么}{对象}: {关键数字}。纯模板, 禁自由发挥。"""
    did = str(slots.get("做了什么") or slots.get("did_what") or "").strip()[:14]
    obj = str(slots.get("对象") or slots.get("object") or "").strip()[:12]
    nums = slots.get("关键数字") or slots.get("key_numbers") or []
    if isinstance(nums, str):
        nums = [nums]
    num_part = "、".join(str(n).strip()[:14] for n in nums[:2] if str(n).strip())
    head = f"已{did}{obj}" if did else obj
    verdict = f"{head}：{num_part}" if num_part else head
    return verdict[:46]


def _verdict_fallback(final_output: dict[str, Any] | None, task_input: str) -> str:
    """无槽位时的确定性兜底: 结论性字段首句 (仍非 LLM); 御史闸会因 slots_missing 降级黄章。"""
    if isinstance(final_output, dict):
        for key in _VERDICT_FALLBACK_KEYS:
            v = final_output.get(key)
            if v and str(v).strip():
                return _first_sentence(str(v), 44)
        for v in final_output.values():
            if v and str(v).strip():
                return _first_sentence(str(v), 44)
    return _first_sentence(task_input or "", 44)


def _build_findings(
    final_output: dict[str, Any] | None,
    snapshot_sha256: str | None,
) -> list[KeyFinding]:
    """凭据要点 ≤3 条, 每条挂证据指针 (snapshot 哈希优先, 否则 final_output 字段路径)。"""
    findings: list[KeyFinding] = []
    if not isinstance(final_output, dict):
        return findings
    for key, value in final_output.items():
        if len(findings) >= 3:
            break
        text = " ".join(str(value or "").split())
        if not text:
            continue
        nums = _NUM_PATTERN.findall(text)
        excerpt = _first_sentence(text, 100)
        if nums and nums[0] not in excerpt:
            excerpt = f"{excerpt[:80]}（{nums[0].strip()}）"
        evidence = f"snapshot:{snapshot_sha256[:12]}#{key}" if snapshot_sha256 else f"final_output.{key}"
        findings.append(KeyFinding(label=str(key)[:24], excerpt=excerpt[:120], evidence=evidence))
    return findings


def draft_memorial_card(
    *,
    task_id: str,
    task_input: str,
    final_output: dict[str, Any] | None,
    qa_result: dict[str, Any] | None,
    department: str,
    swarm_id: str = "",
    run_id: str = "",
    duration_ms: int | None = None,
    archive_path: str | None = None,
    snapshot_sha256: str | None = None,
) -> tuple[MemorialCard, dict[str, Any]]:
    """蜂群产出 → 回奏卡 (status 暂为 running, seal 留空待御史判卷).

    返回 (card, draft_meta); draft_meta.slots_used / fallback_notes 供御史闸定印参考。
    抽取彻底失败不静默 —— 由调用方依 meta 走 blocked 路径 (抽取失败本身=不及格)。
    """
    qa = qa_result or {}
    qa_verdict = str(qa.get("qa_result") or "").strip().lower()
    qa_pass: bool | None = True if qa_verdict == "pass" else False if qa_verdict == "fail" else None

    slots = qa.get("verdict_slots") if isinstance(qa.get("verdict_slots"), dict) else None
    fallback_notes: list[str] = []

    if slots:
        verdict = _verdict_from_slots(slots)
        if not verdict.strip():
            fallback_notes.append("slots_empty_assembly")
            verdict = _verdict_fallback(final_output, task_input)
        action_raw = slots.get("建议动作") or slots.get("suggested_action")
    else:
        fallback_notes.append("slots_missing")
        verdict = _verdict_fallback(final_output, task_input)
        action_raw = None

    next_action, action_notes = _normalize_action(action_raw, qa_pass)
    fallback_notes.extend(action_notes)

    findings = _build_findings(final_output, snapshot_sha256)
    if not findings:
        fallback_notes.append("findings_empty")

    origin = _first_sentence((task_input or "").strip().splitlines()[0] if task_input else "", 58)

    card = MemorialCard(
        task_id=task_id,
        status="running",  # 终态由御史闸判定后改写, 拟奏节点无权定 done
        origin_echo=origin or "（无旨意原文）",
        verdict_summary=verdict,
        key_findings=findings,
        quality_seal=None,
        next_action=next_action,  # type: ignore[arg-type]
        provenance=Provenance(
            department=department or "未署衙门",
            duration_ms=duration_ms,
            archive_path=archive_path,
            swarm_id=swarm_id,
            run_id=run_id,
        ),
    )
    meta = {
        "slots_used": bool(slots),
        "fallback_notes": fallback_notes,
        "next_action_label": NEXT_ACTION_LABELS.get(next_action, next_action),
    }
    return card, meta
