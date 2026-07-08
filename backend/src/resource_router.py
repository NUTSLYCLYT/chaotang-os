"""src/resource_router.py — 资源路由(分档跳过重型层,重器只为大事出鞘)。

把 pipeline_tier 的 P0–P3 翻成"这次该开哪些层、用哪档模型",让 90% 琐碎事**根本不惊动**
三省/御史深审/钦天监/蜂群——这是省资源的总开关(组织架构图怎么画都不如这刀实在)。

- P0 直答:只单模型答,啥重型层都不开,用 lite 模型。
- P1 单参谋:1 大神 + lite。
- P2 部门蜂群:开蜂群 + 三省成形 + 御史门 + smart 模型。
- P3 会审:全开 + 钦天监 + 皇帝签字 + smart。
御史的**抽查**独立于此(对已放行采样),不在每次路由里开。
"""
from __future__ import annotations

from src.pipeline_tier import select_pipeline_tier

# 每档开哪些层(True=开)
_ENGAGE = {
    "P0": {"swarm": False, "sanxing": False, "yushi_gate": False,
           "qintianjian": False, "signoff": False, "model_tier": "lite"},
    "P1": {"swarm": False, "sanxing": False, "yushi_gate": False,
           "qintianjian": False, "signoff": False, "model_tier": "lite"},
    "P2": {"swarm": True, "sanxing": True, "yushi_gate": True,
           "qintianjian": False, "signoff": False, "model_tier": "smart"},
    "P3": {"swarm": True, "sanxing": True, "yushi_gate": True,
           "qintianjian": True, "signoff": True, "model_tier": "smart"},
}


def route(command: str, *, decision_class: str | None = None,
          involved_depts=None, entry_swarm: str | None = None,
          uncertain: bool = False) -> dict:
    """给一个任务,定档 + 该开哪些层 + 用哪档模型。

    返回 {tier, reason, needs_signoff, engage:{swarm,sanxing,yushi_gate,qintianjian,signoff},
          model_tier, skipped:[...被跳过的重型层]}
    """
    t = select_pipeline_tier(
        command, decision_class=decision_class, involved_depts=involved_depts,
        entry_swarm=entry_swarm, uncertain=uncertain,
    )
    eng = dict(_ENGAGE[t["tier"]])
    model_tier = eng.pop("model_tier")
    skipped = [k for k, v in eng.items() if not v]
    return {
        "tier": t["tier"], "reason": t["reason"], "needs_signoff": t["needs_signoff"],
        "engage": eng, "model_tier": model_tier, "skipped": skipped,
    }


def should_engage(command: str, layer: str, **kw) -> bool:
    """便捷:这次该不该开某层(swarm/sanxing/yushi_gate/qintianjian/signoff)。"""
    return bool(route(command, **kw)["engage"].get(layer, False))
