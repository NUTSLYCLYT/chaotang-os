"""证券红线 · 入口预检(2026-07-07 · 三层架构会审头号跨模块 CRITICAL 的红灯尺子)。

病根(会审四模块独立复现):证券红线原本内嵌在 decree_swarm_router.select_entry_swarm 里,
靠"每层复用同一个 select_entry_swarm"做纵深防御。但丞相把候选集窄化到某个部的 calls_swarms 后,
_securities_redline_target 的安全落点(compliance/legal/yushi)几乎不在窄集里,红线跌进
sorted(available)[0] 兜底,选了个业务蜂群却仍挂 redline='securities_advice' 标签谎称"转合规"。
实测:select_entry_swarm('用现金流加仓这只股票', {finance,quotation,product,ima}) → 落 ima,谎报转合规。
这是 confident-wrong 戴着红线徽章——比"没有红线"更危险。

架构定律(会审逼出来):全局硬门不能被分解成 N 个局部复用——窄化候选集会破坏门的不变量。
证券红线必须在**分解之前、丞相入口、对原始未改写的密旨跑一次**,短路到人工门,绝不下放给窄化集。

开关(用户需求 2026-07-07):红线可按租户关(创始人自己要用投资分析)。默认开=保护普通客户;
fail-safe——读配置出任何错都默认开,绝不因配置读失败而静默放行证券问题。

本模块纯函数、可独立测试、不接线(第一步只建尺子);复用 decree_swarm_router 的关键词与 reframe,不重造。
"""

from __future__ import annotations

import json
from typing import Any

from src.decree_swarm_router import (
    _SECURITIES_TARGET_PREFERENCE,
    select_entry_swarm,
)

# 合规安全落点白名单:证券问题只能落这些(合规/法务/风控),绝不业务蜂群。
COMPLIANCE_SAFE: frozenset[str] = frozenset(_SECURITIES_TARGET_PREFERENCE)


def securities_redline_enabled(tenant_slug: str | None = None) -> bool:
    """该租户是否开证券红线。默认 True(保护普通客户);创始人自己的租户可关。

    fail-safe:读配置出任何异常一律返回 True——绝不因配置读失败而放行证券问题。
    配置位置:data/<tenant>/redline_config.json 的 {"securities_redline_enabled": bool}。
    tenant_slug=None 时读当前租户上下文。
    """
    try:
        from src.tenant import get_tenant_data_dir, tenant_context

        def _read() -> bool:
            cfg = get_tenant_data_dir() / "redline_config.json"
            if not cfg.exists():
                return True
            data = json.loads(cfg.read_text(encoding="utf-8"))
            val = data.get("securities_redline_enabled", True)
            return bool(val) if isinstance(val, bool) else True

        if tenant_slug is None:
            return _read()
        with tenant_context(tenant_slug):
            return _read()
    except Exception:
        return True  # fail-safe:任何读取失败都默认开红线


def route_with_redline_precheck(
    command: str,
    available_swarms: Any,
    *,
    tenant_slug: str | None = None,
) -> dict[str, Any]:
    """所有 live 派单入口的统一咽喉(B 方案:2026-07-07 用户选定,不新增响应形状/不碰 UI)。

    保证两件事,返回形状与 select_entry_swarm 完全一致(swarm/reason/matched[/redline]):
    - 开关关(创始人自己的租户):跳过证券红线,证券密旨照常路由(可达 finance 分析)。
    - 开关开(普通客户):证券密旨**保证落合规蜂群,绝不业务蜂群**——即使 select_entry_swarm 的落点
      因候选集窄化跌进业务蜂群(会审头号旁路),这里纠回白名单内的合规落点;窄集内无任何合规落点时
      拒绝落业务(swarm=None + needs_compliance),由调用方兜底(要全局合规蜂群或人工),绝不静默谎报。
    """
    enabled = securities_redline_enabled(tenant_slug)
    routed = select_entry_swarm(
        command, available_swarms, apply_securities_redline=enabled
    )
    if not enabled:
        return routed
    if routed.get("redline") != "securities_advice":
        return routed  # 非证券密旨,原样返回

    available = set(available_swarms)
    if routed.get("swarm") in COMPLIANCE_SAFE:
        return routed  # 已落合规,B 满足
    # 落点跌进业务蜂群(窄集旁路):纠回白名单内首选合规落点
    safe = next((s for s in _SECURITIES_TARGET_PREFERENCE if s in available), None)
    if safe:
        return {
            **routed,
            "swarm": safe,
            "reason": f"securities_redline→纠回合规落点 '{safe}'(防业务蜂群旁路,B保证)",
            "matched": True,
            "redline": "securities_advice",
        }
    # 窄集内无任何合规落点:拒绝落业务,标 needs_compliance 让调用方兜底(绝不静默谎报转合规)
    return {
        "swarm": None,
        "reason": "securities_redline:候选集内无合规落点,拒绝落业务蜂群,需全局合规蜂群或转人工",
        "matched": True,
        "redline": "securities_advice",
        "needs_compliance": True,
    }


def set_securities_redline(tenant_slug: str, enabled: bool) -> None:
    """给某租户设证券红线开关(创始人给自己的租户关,给客户租户保持开)。"""
    from src.tenant import get_tenant_data_dir, tenant_context

    with tenant_context(tenant_slug):
        cfg = get_tenant_data_dir() / "redline_config.json"
        existing: dict[str, Any] = {}
        if cfg.exists():
            try:
                existing = json.loads(cfg.read_text(encoding="utf-8"))
            except Exception:
                existing = {}
        existing["securities_redline_enabled"] = bool(enabled)
        cfg.write_text(
            json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8"
        )
