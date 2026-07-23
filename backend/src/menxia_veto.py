"""门下省路由前置审议：只审路由决定，不执行部门任务。"""

from __future__ import annotations

from typing import Any

from src.department_identity import CANONICAL_MINISTRY_IDS, canonical_name, runtime_code_for, runtime_projection, specialist_routing_projection


# chancellor_decide_route 自己判定"整理/草拟/初判类轻量任务"时写进 reason 的
# 固定短语(shangshufang_loop.py:709)。这类任务是丞相自己的确定性分类,不是
# 关键词碰撞,门下省没必要用比丞相更严的关键词表二次否决——那只会把丞相已经
# 判定安全的轻量任务错杀(黄金案例 simple_02/simple_03 就是这么被误封驳的)。
_LIGHTWEIGHT_TASK_MARKER = "原问属于整理/草拟/初判类轻量任务"

# 注意:override 写入 reason 的固定短语("兼容入口明确指定参审部门")**不是**范围
# 证据——P16 review-v1 HIGH:把它当范围证据会让任何职责外请求(世界杯请求)附带
# ministers=['hu_bu'] 就绕过封驳。客户端指定参审部门只能约束派给谁,不能证明
# 任务属于六部职责;合法 override(如低温电池分析指定户部)靠任务文本自身的
# 关键词范围证据通过,不靠 marker。
def _route_has_scope_evidence(route: dict[str, Any], task_text: str) -> bool:
    reason = str(route.get("reason") or "")
    if _LIGHTWEIGHT_TASK_MARKER in reason:
        return True
    keywords = runtime_projection("routing_keywords")
    specialist_keywords = specialist_routing_projection()
    selected = route.get("departments") or []
    # 用户原文直接点名了某个部门(PKT-2"显式部门点名优先"),不该被关键词表
    # 缺失连累(黄金案例 ambiguity_03:"刑部最近的工作氛围怎么样"没有命中刑部
    # 专业关键词,但用户明确点名了刑部)。
    if any(dept in task_text for dept in selected):
        return True
    selected_runtime = {
        runtime_code_for(canonical_id)
        for canonical_id in CANONICAL_MINISTRY_IDS
        if canonical_name(canonical_id) in selected
    } | set(selected)
    if any(any(str(keyword).lower() in task_text.lower() for keyword in specialist_keywords.get(dept, [])) for dept in selected):
        return True
    return any(
        any(str(keyword).lower() in task_text.lower() for keyword in keywords.get(code, []))
        for code in selected_runtime
    )


def review_route(route: dict[str, Any], task_text: str) -> dict[str, Any]:
    """Return a structured 封驳/准奏 decision for a proposed route.

    R0-REQ-013: as long as any veto reason applies, the route stays 封驳 —
    there is no round count or max-rounds fail-open exception. A vetoed route
    already surfaces humanSignoffRequired via routing_service.py; that is the
    only sanctioned way past a persistent veto. No department execution
    occurs here.
    """
    departments = list(route.get("departments") or [])
    scope_ok = _route_has_scope_evidence(route, task_text)
    reasons: list[str] = []
    if not departments:
        reasons.append("路由没有任何候选部门")
    if departments and not scope_ok:
        reasons.append("不属于任何部门真实职责范围，不能顶着部门人设执行")
    dimensions = {
        "可行性": {"passed": bool(departments), "reason": "存在可执行候选部门" if departments else "缺少候选部门"},
        "完整性": {"passed": bool(task_text.strip()), "reason": "已收到原始任务文本" if task_text.strip() else "任务文本为空"},
        "风险": {"passed": not reasons, "reason": "未发现职责外派单" if not reasons else reasons[0]},
        "资源": {"passed": bool(departments), "reason": "候选部门具备统一能力注册" if departments else "无可用资源"},
    }
    veto = bool(reasons)
    return {
        "verdict": "封驳" if veto else "准奏",
        "dimensions": dimensions,
        "reroute_suggestion": "请丞相重新判断任务是否超出六部职责" if veto else None,
        "veto_reasons": reasons,
    }
