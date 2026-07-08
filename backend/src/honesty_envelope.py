"""御史诚实线(2026-07-07 · 三层递归架构第3步):honesty_envelope 三层各产一次,worst-of 冒泡,收口三句。

两轴分开(会审纪律,合并必吞掉一方):
- **灯轴 light**(green/yellow/red):这一层的判断本身多可信(证据强度),供渲染与冒泡。
- **签字轴 needs_sign**(bool):是否踩"必须人签"的不可逆档。红灯不等于要签(可逆红走一键放行),
  绿灯也可能要签(高权限任免)。needs_sign 只由 signoff_gate/automation_tier 判,不从灯推导。

三层各产一次(与三层递归选择一一对应):
- route(丞相 decide):路由判断可信度——关键词打分,非语义理解,诚实标出来。
- pick(尚书 select_dept_swarm):窄集选择可信度——弃权=诚实降级,不冒充选对。
- execution(蜂群真跑):结果可信度——court_doc 有灯直接用(不重判),否则从 session 运行状态推。

bubble() 收口三句(普通人语言,不堆术语):凭什么信 / 你要拍板的一件事 / 我不确定的地方。
draft 租户(bootstrap 未人工确认)top_light 地板 yellow:day-1 没历史没确认,不给自信绿。
纯确定性,不调 LLM——诚实线自己先得诚实(可测可复现)。
"""

from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

_SEVERITY = {"green": 0, "yellow": 1, "red": 2}


def _worst(lights: list[str]) -> str:
    return max(lights, key=lambda x: _SEVERITY.get(x, 2)) if lights else "yellow"


def _env(
    tier: str, light: str, basis: str, uncertainty: str, *, needs_sign: bool = False
) -> dict[str, Any]:
    return {
        "tier": tier,
        "light": light,
        "needs_sign": needs_sign,  # 签字轴独立:不从灯推导
        "basis": basis,
        "uncertainty": uncertainty,
    }


# ── 三层各产一次 ─────────────────────────────────────────────────────


def envelope_route(plan: dict[str, Any]) -> dict[str, Any]:
    """顶层丞相 route 的诚实信封。显式人选(explicit)由调用方用 envelope_explicit。"""
    ministries = plan.get("ministries") or []
    if not ministries:
        light, basis = "yellow", "关键词没打中任何部,走了默认路由"
    else:
        names = "、".join(m.get("name", "") for m in ministries if m.get("name"))
        light = "green"
        basis = f"密旨关键词命中 {names}({plan.get('reason', '')})"
    return _env(
        "route",
        light,
        basis,
        "路由靠关键词打分,不是语义理解;换个措辞可能换部",
    )


def envelope_pick(plan: dict[str, Any]) -> dict[str, Any]:
    """中层尚书 pick 的诚实信封:弃权=诚实降级(部分 yellow / 全弃 red)。"""
    entries = plan.get("entry_swarms") or []
    abstained = plan.get("abstained") or []
    if not entries:
        return _env(
            "pick",
            "red",
            "各部尚书均无自信命中,全体弃权(没硬选,这是诚实不是故障)",
            "任务描述可能太泛或超出六部能力面,需要补充说明",
        )
    basis = f"选定入口蜂群: {'、'.join(entries)}"
    if abstained:
        why = ";".join(a.get("reason", "") for a in abstained)
        return _env("pick", "yellow", basis, f"有尚书弃权未参与: {why}")
    return _env("pick", "green", basis, "窄集内关键词命中,同路由一样非语义理解")


def envelope_explicit(swarm_id: str) -> list[dict[str, Any]]:
    """用户显式指定入口蜂群:route/pick 两层折叠为人选(人拍板=绿,但诚实标明没经过三层判断)。"""
    return [
        _env(
            "route",
            "green",
            f"用户显式指定入口蜂群 {swarm_id}",
            "未经丞相路由判断,选错部自负",
        ),
        _env("pick", "green", "人选优先,尚书层跳过", "未经尚书窄集核对"),
    ]


def envelope_execution(
    session: Any = None, court_doc: dict[str, Any] | None = None
) -> dict[str, Any]:
    """底层执行的诚实信封。court_doc 优先(灯已由确定性门判过,不重判);否则从 session 运行状态推。"""
    if court_doc is not None:
        light = court_doc.get("light", "yellow")
        if light == "black":
            light = "red"  # 灯轴只有三色;black 的"移交深查"语义走签字轴+basis
        from src.signoff_gate import needs_signoff  # 签字轴:唯一判定来源

        return _env(
            "execution",
            light if light in _SEVERITY else "yellow",
            f"确定性门判定: {court_doc.get('headline', '')}",
            "门只核查已建规则覆盖的红线,规则外的问题看不见",
            needs_sign=needs_signoff(court_doc),
        )

    runs = list(getattr(session, "swarm_runs", []) or [])
    if not runs:
        return _env("execution", "red", "没有任何蜂群真跑", "未执行,无结果可信度可言")
    failed = [r for r in runs if getattr(r, "status", "") == "failed"]
    unscored = [
        r
        for r in runs
        if getattr(r, "status", "") == "completed"
        and getattr(r, "quality_score", None) is None
    ]
    if failed:
        names = "、".join(getattr(r, "swarm_id", "?") for r in failed)
        return _env(
            "execution",
            "red",
            f"蜂群执行失败: {names}",
            "失败原因见运行日志,结果不可用",
        )
    if unscored:
        return _env(
            "execution",
            "yellow",
            f"{len(runs)} 个蜂群跑完,但 {len(unscored)} 个没有质量分",
            "没验过质量的产出,只能当草稿看",
        )
    return _env(
        "execution",
        "green",
        f"{len(runs)} 个蜂群跑完且过质量评分",
        "评分是流程质量,不担保业务结论正确",
    )


# ── draft 租户地板 ────────────────────────────────────────────────────


def is_draft_tenant() -> bool:
    """当前租户是否 draft:bootstrap 能力卡从未人工确认(confirm_capability_cards 没跑过)。

    default 租户豁免——它是多租户之前的存量主租户,不存在 day-1 问题;
    真租户没确认过部门映射,系统对它一无所知,不配给自信绿。
    """
    from src.tenant import DEFAULT_TENANT_SLUG, get_current_tenant, get_tenant_data_dir

    if get_current_tenant() == DEFAULT_TENANT_SLUG:
        return False
    path = get_tenant_data_dir("bootstrap") / "capability_cards.json"
    if not path.exists():
        return True
    try:
        return not json.loads(path.read_text(encoding="utf-8")).get("confirmed", False)
    except (json.JSONDecodeError, OSError):
        return True  # 读不出=当没确认,宁黄勿假绿


# ── worst-of 冒泡 + 收口三句 ─────────────────────────────────────────


def bubble(envelopes: list[dict[str, Any]]) -> dict[str, Any]:
    """三层信封 worst-of 冒泡,收口三句普通人语言。灯轴取最差,签字轴取任一(两轴独立)。"""
    tiers = [e for e in envelopes if e]
    top_light = _worst([e["light"] for e in tiers])
    needs_sign = any(e.get("needs_sign") for e in tiers)

    floored = False
    if top_light == "green" and is_draft_tenant():
        top_light, floored = "yellow", True  # day-1 地板:没确认过的租户不给自信绿

    worst_tier = (
        max(tiers, key=lambda e: _SEVERITY.get(e["light"], 2)) if tiers else None
    )

    # 会审(张小龙 2026-07-08):三句只说 worst 层那一句——全量分号拼接=四张部门小票钉一起,
    # 固定免责声明每单必现会训练用户忽略整行(真警告跟着陪葬)。全量明细在 tiers 里供展开。
    why_trust = (worst_tier or {}).get("basis", "")
    unsure_parts = [(worst_tier or {}).get("uncertainty", "")]
    if floored:
        unsure_parts.append("这家企业还没确认过部门映射(day-1),整体结论压到黄灯观察")
    unsure = ";".join(p for p in unsure_parts if p) or "无(但没有不确定项本身就值得怀疑)"

    if needs_sign:
        signer_tiers = "、".join(e["tier"] for e in tiers if e.get("needs_sign"))
        decide = f"这单踩了不可逆红线({signer_tiers}层),必须你亲自批或驳,系统不代签"
    elif top_light == "red" and worst_tier is not None:
        decide = f"先处理卡住的一环: {worst_tier['basis']}"
    elif top_light == "yellow" and worst_tier is not None:
        decide = f"可以推进,但拍板前看一眼: {worst_tier['uncertainty'] or worst_tier['basis']}"
    else:
        decide = "无需拍板,可自动推进(可逆,出错能回滚)"

    return {
        "top_light": top_light,  # 灯轴
        "needs_sign": needs_sign,  # 签字轴(独立)
        "tenant_floored": floored,
        "tiers": tiers,
        "three_lines": {
            "why_trust": why_trust,  # 凭什么信
            "decide_one_thing": decide,  # 你要拍板的一件事
            "unsure": unsure,  # 我不确定的地方
        },
    }
