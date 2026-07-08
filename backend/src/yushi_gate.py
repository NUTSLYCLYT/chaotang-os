"""御史总判: 回奏入箱前的确定性质量闸 (替换字段存在性检查的戏服版).

判卷信号全部来自已有的确定性产物 (QA JSON 的 qa_result / hard_checks / 总分,
拟奏 meta 的 slots_used / findings), 本闸不调用任何 LLM —— LLM-judge 只能 advisory。

三态判决 (MEMORIAL_CARD_SPEC §2-②):
- verified  绿章「御史已验」: schema 全 + QA pass + 硬核查无 FAIL + 槽位真用上 + 凭据在
- reserved  黄章「御史有保留」: 结论可看但有保留 (槽位缺/凭据弱/QA 信号缺) —— Bezos 降级通道
- blocked   「办差受阻」: QA fail / 硬核查 FAIL / schema 残 —— 显式入箱, 禁静默吞

铁律: 未过闸禁入 done; 判决必须可追溯 (reasons + reason_codes 全记)。
"""

from __future__ import annotations

import logging
from typing import Any

from pydantic import ValidationError

from src.contracts.memorial_card import MemorialCard

logger = logging.getLogger(__name__)

# QA 总分门槛: 任一维度<3 QA 自身已判 fail; 总分守住 3.0 防漏网
_MIN_TOTAL_SCORE = 3.0


def _hard_check_failures(qa_result: dict[str, Any] | None) -> list[str]:
    hc = (qa_result or {}).get("hard_checks")
    if not isinstance(hc, dict):
        return []
    return [str(name) for name, v in hc.items() if str(v).strip().upper() == "FAIL"]


def judge_memorial(
    card: MemorialCard,
    *,
    qa_result: dict[str, Any] | None,
    total_score: float | None,
    draft_meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """对一张拟好的回奏卡做总判, 返回判决 dict (不修改入参卡)。

    返回: {seal, seal_label, reasons[], reason_codes[], human_signoff_required}
    """
    meta = draft_meta or {}
    reasons: list[str] = []
    codes: list[str] = []

    # ── 1. schema 完整性 (确定性, 最先) ──
    try:
        MemorialCard.model_validate(card.model_dump())
    except ValidationError as e:
        logger.warning("yushi_gate: 卡片 schema 校验失败 task=%s err=%s", card.task_id, e)
        reasons.append("回奏格式残缺，未达呈递标准")
        codes.append("schema_incomplete")
        return _verdict("blocked", reasons, codes)

    qa = qa_result or {}
    qa_verdict = str(qa.get("qa_result") or "").strip().lower()

    # ── 2. 硬核查 FAIL → 一票 blocked (可证伪检查不可越过) ──
    failed_hard = _hard_check_failures(qa)
    if failed_hard:
        reasons.append(f"硬核查未过：{('、'.join(failed_hard))[:60]}")
        codes.append("hard_check_fail")
        return _verdict("blocked", reasons, codes)

    # ── 3. QA 判决 ──
    if qa_verdict == "fail":
        reasons.append("御史复核未过（质量检验判不合格）")
        codes.append("qa_fail")
        return _verdict("blocked", reasons, codes)

    # ── 4. 总分门槛 ──
    if total_score is not None and total_score < _MIN_TOTAL_SCORE:
        reasons.append(f"质量总分 {total_score:.1f} 低于呈递线 {_MIN_TOTAL_SCORE}")
        codes.append("low_score")
        return _verdict("blocked", reasons, codes)

    # ── 5. 信号不足 / 取材有保留 → 黄章 (结论可看, 印章示警) ──
    reserved = False
    if qa_verdict != "pass":
        reserved = True
        reasons.append("御史复核信号缺失，暂以保留印呈递")
        codes.append("qa_missing")
    if not meta.get("slots_used", False):
        reserved = True
        reasons.append("判词未经槽位核定（兜底拼装）")
    if not card.key_findings:
        reserved = True
        reasons.append("凭据要点缺失")
        codes.append("evidence_missing")
    if any(str(f.evidence).startswith("final_output.") for f in card.key_findings):
        # 凭据未锚定快照哈希: 可看但弱
        reserved = True
        reasons.append("凭据未锚定检索快照")

    if reserved:
        return _verdict("reserved", reasons, codes)

    return _verdict("verified", ["schema 全、复核 pass、硬核查无 FAIL、判词经槽位核定、凭据锚定快照"], [])


def _verdict(seal: str, reasons: list[str], codes: list[str]) -> dict[str, Any]:
    from src.contracts.memorial_card import QUALITY_SEAL_LABELS

    return {
        "seal": seal,
        "seal_label": QUALITY_SEAL_LABELS.get(seal, seal),
        "reasons": reasons,
        "reason_codes": codes,
        "human_signoff_required": seal != "verified",
    }


def apply_verdict(card: MemorialCard, verdict: dict[str, Any]) -> MemorialCard:
    """把判决盖到卡上, 产出终态卡 (done / blocked); 这是唯一允许写 seal 的地方。"""
    data = card.model_dump()
    seal = verdict["seal"]
    data["quality_seal"] = seal
    if seal == "blocked":
        data["status"] = "blocked"
        data["blocked_reason_human"] = (verdict["reasons"][0] if verdict["reasons"] else "此差未办成，已记档")[:78]
        data["reason_codes"] = verdict.get("reason_codes", [])
        data["remedy_taken"] = data.get("remedy_taken") or "已记档待重办"
    else:
        data["status"] = "done"
    final = MemorialCard.model_validate(data)
    if seal != "blocked":
        final.require_done_complete()  # 未过闸禁入 done: 缺件在此 fail-fast
    return final
