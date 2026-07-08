"""src/dispute_escalation.py — 异议上诉阶梯(部门↔御史 异议 → 丞相 → 皇帝,钦天监随时参谋)。

天才设计:三权分立的上诉梯,每一级一种独立权力,谁也不能干别人的活——
  - 御史:定灯(规则),不调解不终审。
  - 丞相:调解(找带条件放行/补证据),**不得推翻御史的红/黑**(C8);调不动就上交,不私了。
  - 皇帝:终审(唯一能 override 御史一票否决的人),且必须**签字留痕**。
  - 钦天监:随时参谋(不可逆自动触发),只进言不定灯。

既无死锁(异议总有下一级,最高到皇帝),又无独裁(只有皇帝签字能 override,且留痕)。
纯状态机,不调 LLM,可测。落地接 decision_guard.sign(皇帝签字)/ shangshufang(丞相拟旨)。
"""
from __future__ import annotations

_SEV = {"green": 0, "yellow": 1, "red": 2, "black": 3}


def detect_dispute(dept_light: str, yushi_light: str) -> bool:
    """异议 = 部门比御史乐观(部门想放,御史不让)。同灯或部门更保守不算异议。"""
    return _SEV.get(dept_light, 9) < _SEV.get(yushi_light, 9)


def escalation_step(
    dept_light: str,
    yushi_light: str,
    *,
    hard_veto: bool = False,
    chancellor_resolved: bool | None = None,
    irreversible: bool = False,
    qintianjian: bool = False,
) -> dict:
    """给出当前应在哪一级、谁决、下一步动作。

    参数:
      hard_veto            御史硬核查 FAIL(一票否决)→ 越过丞相直上皇帝
      chancellor_resolved  None=丞相还没调 / True=丞相找到带条件放行 / False=丞相调不动
      irreversible         不可逆动作 → 必签字 + 自动触发钦天监
      qintianjian          是否已请钦天监参谋(不可逆时自动 True)
    返回 {rung, decider, action, needs_signoff, qintianjian_engaged, reason}
    """
    dispute = detect_dispute(dept_light, yushi_light)
    qtj_on = qintianjian or irreversible  # 不可逆自动请钦天监

    def out(rung, decider, action, needs_signoff, reason):
        return {
            "rung": rung, "decider": decider, "action": action,
            "needs_signoff": needs_signoff or irreversible,
            "qintianjian_engaged": qtj_on, "reason": reason,
        }

    # 无异议且可逆 → 御史定灯即终,无需上诉
    if not dispute and not irreversible:
        return out("御史定灯", "rules", "放行/按御史灯执行", False,
                   "部门与御史无异议,御史规则定灯即终")

    # 一票否决:丞相无权,直上皇帝(只有皇帝签字例外能过)
    if hard_veto:
        return out("皇帝终审", "emperor", "皇帝签字例外才可过,否则维持 block", True,
                   "御史硬核查 FAIL 一票否决,丞相无权调解,只有皇帝签字 override")

    # 丞相还没调 → 先交丞相调解
    if chancellor_resolved is None:
        return out("丞相调解", "chancellor", "找带条件放行/补证据消解异议(不得推翻红黑)", False,
                   "部门与御史异议 → 丞相调解;调不动须上交皇帝,不得私了或软化御史灯")

    # 丞相调成 → 异议消解(带条件放行)
    if chancellor_resolved:
        return out("已解·丞相", "chancellor", "按带条件放行执行", False,
                   "丞相找到带条件放行,异议消解(御史灯未被软化)")

    # 丞相调不动 → 皇帝终审签字
    return out("皇帝终审", "emperor", "皇帝裁决并签字,留痕史馆", True,
               "丞相调解未果 → 皇帝终审;不可逆/override 必签字")
