"""src/shangshufang_entry.py — 上书房单一入口(丞相门面,把 35 个模块藏在一个函数后)。

用户/前端只调 handle(command)。内部一条龙,后台全藏:
  ① 难度评判(difficulty_assessor:旨意×自动化×军机处,用户可改档)
  ② token 护栏(token_monitor.guard:超限先刹车,防跑飞)
  ③ 分档路由(resource_router:P0 直答不开层;P2/P3 走蜂群出 court_doc)
  ④ 统一结果 + 军机处面板行(panel_row)返回,御史/史馆/六部经此门抵达,不做成用户逐个对话的衙门。

这是"第 3+4 件事"合一:把建好待接的三件焊进真实入口 + 做出丞相单门面。
纯编排,LLM 部分可注入(测试无需网络);P2/P3 复用 run_swarm_execution_loop(其确定性 mock 可离线跑)。
"""
from __future__ import annotations

from typing import Any, Callable

from src import difficulty_assessor, token_monitor


def handle(
    command: str,
    *,
    run_id: str = "default",
    automation_level: str = "L0",
    council_confidence: str = "中",
    council_conflicts: int = 0,
    user_force_tier: str | None = None,
    involved_depts=None,
    department: str = "prime_minister",
    swarm_runner: Callable[[dict], dict] | None = None,
) -> dict:
    """上书房单一入口。返回统一结果 + 面板行,后台机器全藏。

    swarm_runner 可注入(测试);默认走 run_swarm_execution_loop。
    """
    # ① 难度评判(用户可改档)
    a = difficulty_assessor.assess(
        command, involved_depts=involved_depts, automation_level=automation_level,
        council_confidence=council_confidence, council_conflicts=council_conflicts,
        user_force_tier=user_force_tier,
    )
    panel = difficulty_assessor.panel_row(
        run_id, command, involved_depts=involved_depts, automation_level=automation_level,
        council_confidence=council_confidence, council_conflicts=council_conflicts,
        user_force_tier=user_force_tier,
    )

    # ② token 护栏:超限先刹车(防跑飞),不进重型层
    g = token_monitor.guard(run_id)
    if not g["ok"]:
        return _result(a, panel, guard=g, court_doc=None, status="budget_blocked")

    # ③ 分档路由
    if not a["engage"].get("swarm"):
        # P0/P1:不开蜂群/御史/三省,轻量(直答由调用方用 model_tier=lite 生成)
        return _result(a, panel, guard=g, court_doc=None, status="light")

    # P2/P3:走蜂群 → court_doc(深焊已让 loop 产出 court_doc)
    runner = swarm_runner or _default_swarm_runner
    try:
        loop_out = runner({
            "task_id": run_id, "review_id": run_id,
            "confirmed_edict": {"raw_command": command, "source_label": "MIXED",
                                "department": department},
        })
        court_doc = (loop_out or {}).get("court_doc")
    except Exception as e:  # noqa: BLE001
        return _result(a, panel, guard=g, court_doc=None, status="swarm_error",
                       error=str(e)[:120])
    return _result(a, panel, guard=g, court_doc=court_doc, status="ok")


def _default_swarm_runner(params: dict) -> dict:
    from src.swarm_execution_loop import run_swarm_execution_loop
    return run_swarm_execution_loop(params)


def _result(a: dict, panel: dict, *, guard: dict, court_doc: Any,
            status: str, error: str | None = None) -> dict:
    return {
        "status": status,                  # ok|light|budget_blocked|swarm_error
        "tier": a["tier"],
        "needs_signoff": a["needs_signoff"],
        "model_tier": a["model_tier"],
        "engaged_layers": [k for k, v in a["engage"].items() if v],
        "court_doc": court_doc,            # P2/P3 才有;御史灯/证据在这张脸里
        "panel": panel,                    # 军机处进度面板一行
        "guard": {"ok": guard["ok"], "session_total": guard.get("session_total")},
        "error": error,
        "hidden": "六部/御史/三省/史馆均在后台,经丞相门面呈现",
    }
