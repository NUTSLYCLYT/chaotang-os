"""钦天监横切风险镜片(2026-07-07 · 三层递归架构第4步)。**非第四层**——丞相调一次的镜片。

SSOT 拍板(本步骤首个决策):computeCycleHeat/assessRuin 的**决策语义真身在后端本模块**
(Python 单 owner,门控/签字/诚实线全吃这里的输出)。前端 chaotang-web-lyt 的
src/core/courtos/qintian/tail-audit.ts 保留仅作**呈现**(渲染热度表盘),不得用于门控——
前端 frontend-only 禁造第二 runtime。两处口径漂移时,以本模块为准。

对 TS 版的一处**语义修正**(会审点):TS clamp01 把 NaN/缺失信号压成 0=「安全」,
未知被渲染成绿。本版 UNKNOWN 信号**剔出分母**(只按已知信号加权),
未知权重过半→强制保守(tier 至少 warm,不渲染成安全)。

镜片三件事(纯确定性,不预测不调 LLM):
1. **ruin 结构否决**:decision_guard 不可逆登记(结构) OR assessRuin 敞口红线,OR-merge。
   veto ≠ 不许跑——蜂群照跑出建议;veto = **不许自动生效**,签字轴强制人签(via negativa,
   AI 永远不单独签不可逆,同 decision_guard 一个宪法)。
2. **热度旋钮**:5 路后视镜信号 → 0-100 → 审查旋钮(越顺越热越紧)。旋钮调审查严格度,
   不直接染灯轴——灯轴只反映 ruin 结构(否则热度未知会把所有任务染黄,狼来了)。
3. **可证伪触发器**:每次判定都带"若 X 发生本判断作废"——钦天监不算命,给的每个结论
   都留可证伪的翻案条件(依据过 jinyiwei_vet 的纪律延续)。
"""

from __future__ import annotations

import math
from typing import Any

from src.decision_guard import IRREVERSIBLE_FLOWS, is_irreversible

# 五神交集权重(与前端 tail-audit.ts SIGNAL_WEIGHTS 同源;漂移以本处为准)。
SIGNAL_WEIGHTS: dict[str, int] = {
    "correlation_to_one": 25,  # 相关性奔1:证据塌缩到同一信源
    "win_streak_danger": 25,  # 连胜危险度(用 streak_to_danger 算)
    "replication_accel": 20,  # 复制速度
    "valuation_heat": 15,  # 估值热度
    "evidence_deficit": 15,  # 缺证率倒挂:信心涨得比证据快
}

# 2026-07-08 会审(Taleb):blast_radius_over_threshold 已拆除——无真实度量源、恒 False,
# 不能响的警报比没有警报更危险(卖虚假安心)。真度量源(governance blast-radius)建成再加回。
_RUIN_REDLINES = {
    "irreversible_payment": "亏不起(不可逆付款/违约金)",
    "external_commitment": "传得开(对外承诺/独家锁定)",
}


def streak_to_danger(win_streak: float, tau: float = 4) -> float:
    """连胜链长→饱和危险度(0-1)。tau=4:连胜4≈0.63,8≈0.86。"""
    n = win_streak if isinstance(win_streak, (int, float)) and win_streak > 0 else 0
    return 1 - math.exp(-n / tau)


def _knobs_for_tier(tier: str) -> dict[str, Any]:
    """2026-07-08 会审(Karpathy)后减法:原5个旋钮全仓零消费者=界面说收紧、系统没收紧,
    比没有旋钮更不诚实。删4留1,唯一保留的 manual_gate_shift_down **真接线**到签字轴
    (lens_envelope:hot 档强制人签)。warm 不拉闸——冷启动账本空时 warm 是"不知道"的地板,
    因无知罚用户签字=训练用户无视签字轴;hot 才是真信号。其余旋钮谁要用,先写消费者再加回。"""
    return {"manual_gate_shift_down": tier == "hot"}


def compute_cycle_heat(signals: dict[str, float | None] | None) -> dict[str, Any]:
    """逆周期温度计。UNKNOWN(None/非有限数/缺 key)剔出分母,只按已知信号加权。

    保守规则(不渲染成安全):已知权重 < 总权重一半 → tier 地板 warm;
    全未知 → score=None + tier=warm(没有后视镜数据时收紧审查,而非假装 normal)。
    """
    signals = signals or {}
    weighted = 0.0
    known_weight = 0
    unknown: list[str] = []
    for key, w in SIGNAL_WEIGHTS.items():
        v = signals.get(key)
        if isinstance(v, (int, float)) and math.isfinite(v):
            weighted += max(0.0, min(1.0, float(v))) * w
            known_weight += w
        else:
            unknown.append(key)

    total = sum(SIGNAL_WEIGHTS.values())
    if known_weight == 0:
        return {
            "score": None,
            "tier": "warm",
            "knobs": _knobs_for_tier("warm"),
            "unknown_signals": unknown,
            "reason": "5路信号全未知:按 warm 档收紧审查,未知不渲染成安全",
        }

    score = round(weighted / known_weight * 100)
    tier = "hot" if score >= 70 else "warm" if score >= 40 else "normal"
    reason = f"已知信号加权 {score}/100(分母只含已知权重 {known_weight}/{total})"
    if tier == "normal" and known_weight * 2 < total:
        tier = "warm"
        reason += ";未知权重过半,地板 warm(不渲染成安全)"
    return {
        "score": score,
        "tier": tier,
        "knobs": _knobs_for_tier(tier),
        "unknown_signals": unknown,
        "reason": reason,
    }


def assess_ruin(
    death_conditions: list[dict[str, Any]] | None,
    exposure: dict[str, bool] | None,
) -> dict[str, Any]:
    """死法地图:correlation 取最坏=1,任一 ruin 红线命中即否决(不看期望收益)。"""
    exposure = exposure or {}
    redlines_hit = [label for key, label in _RUIN_REDLINES.items() if exposure.get(key)]
    conditions = death_conditions or []
    met = sum(1 for c in conditions if c.get("already_true"))
    total = len(conditions)
    veto = bool(redlines_hit)
    reason = (
        f"触 ruin 红线 [{' / '.join(redlines_hit)}],一票否决(后果不可逆,不看期望收益);"
        f"致死条件已成立 {met}/{total}"
        if veto
        else f"无 ruin 红线;致死条件已成立 {met}/{total}(离死越近越该备对冲)"
    )
    return {
        "verdict": "veto" if veto else "pass",
        "redlines_hit": redlines_hit,
        "conditions_already_met": met,
        "total_conditions": total,
        "reason": reason,
    }


def qintianjian_lens(
    plan: dict[str, Any],
    *,
    signals: dict[str, float | None] | None = None,
    exposure: dict[str, bool] | None = None,
    death_conditions: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """丞相调一次的横切镜片:结构否决 OR-merge + 热度旋钮 + 可证伪触发器。

    结构否决不可被显式人选旁路——只看 entry_swarms 里有没有 decision_guard 登记的
    不可逆蜂群,不管入口是三层选的还是用户点的。
    """
    entries = list(plan.get("entry_swarms") or [])
    # 会审(Schneier):结构否决看**绑定闭包**不只入口——不可逆蜂群哪怕在自动链第二跳
    # 也要拉签字轴(reachable_swarms 由调用方按有效绑定 BFS 算出,缺省退化为只看入口)。
    scope = list(dict.fromkeys(entries + list(plan.get("reachable_swarms") or [])))
    structural = [s for s in scope if is_irreversible(s)]
    ruin = assess_ruin(death_conditions, exposure)

    veto = bool(structural) or ruin["verdict"] == "veto"
    veto_reasons: list[str] = []
    if structural:
        veto_reasons.extend(
            f"结构不可逆:{s}({IRREVERSIBLE_FLOWS[s]})"
            + ("" if s in entries else "——经自动绑定链可达")
            for s in structural
        )
    if ruin["verdict"] == "veto":
        veto_reasons.append(ruin["reason"])

    heat = compute_cycle_heat(signals)

    # 可证伪触发器:每个结论都带翻案条件,永不为空(钦天监不算命)。
    triggers: list[str] = []
    route_trigger = plan.get("qintianjian_trigger")
    if route_trigger:
        triggers.append(str(route_trigger))
    for c in death_conditions or []:
        if not c.get("already_true"):
            triggers.append(f"若「{c.get('description', '')}」成立,立即重开镜片复判")
    if veto:
        triggers.append(
            "若签字人补齐对冲(拆分敞口/撤对外承诺/改可逆条款),可重开镜片复判"
        )
    else:
        triggers.append(
            "若新增不可逆付款/对外承诺/blast-radius 超阈,本放行作废,必须重开镜片"
        )

    return {
        "verdict": "veto" if veto else "pass",
        "veto_reasons": veto_reasons,
        "structural_irreversible": structural,
        "ruin": ruin,
        "heat": heat,
        "falsifiable_triggers": triggers,
    }


def lens_envelope(lens: dict[str, Any]) -> dict[str, Any]:
    """镜片结果 → 诚实信封(横切层,进 bubble 一起冒泡)。

    灯轴只反映 ruin 结构(veto→red);热度只进不确定性文本+旋钮,不染灯(防狼来了)。
    签字轴:veto=必须人签(AI 不单独签不可逆),与灯轴独立。
    """
    heat = lens.get("heat") or {}
    # 逆周期收紧的物理接线(会审后唯一真旋钮):hot 档一切判定不许自动生效,强制人过目。
    veto = lens.get("verdict") == "veto" or bool(
        (heat.get("knobs") or {}).get("manual_gate_shift_down")
    )
    uncertainty = heat.get("reason", "")
    if heat.get("unknown_signals"):
        uncertainty += f";未知信号: {'、'.join(heat['unknown_signals'])}"
    # 空油箱自招供:从未吃过真实输入的维度必须在界面招认,不许长得像"查过没事"
    virgin = [
        k
        for k, v in (lens.get("data_provenance") or {}).items()
        if v.get("samples", 0) == 0
    ]
    if virgin:
        uncertainty += f";以下维度 0 次真实输入(未在守你): {'、'.join(virgin)}"
    return {
        "tier": "qintianjian",
        "light": "red" if lens.get("verdict") == "veto" else "green",
        "needs_sign": veto,
        "basis": (
            ";".join(lens.get("veto_reasons") or [])
            or (
                "热度 hot:逆周期收紧,本单必须人过目(不是你错了,是最近太顺/证据太薄)"
                if (heat.get("knobs") or {}).get("manual_gate_shift_down")
                else ""
            )
            or lens.get("ruin", {}).get("reason", "无 ruin 红线")
        ),
        "uncertainty": uncertainty,
    }
