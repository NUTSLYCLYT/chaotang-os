"""可选的丞相 LLM 路由建议层；确定性风险硬门永远拥有最终裁决权。"""

from __future__ import annotations

import json
from typing import Any, Callable


LEVELS = {"D0": 0, "D1": 1, "D2": 2}


def merge_decision_level(hard_gate: str, llm_level: str | None, user_level: str | None) -> str:
    # `llm_level or "D0"` 会把空字符串也当成"没传"静默降成 D0——空字符串跟
    # None 不是一回事,前者是明确传了个无效值,后者才是真的"没提供"。只有
    # None 才该走默认值,空字符串跟别的乱码字符串一样必须在下面炸出来。
    candidates = [
        hard_gate,
        "D0" if llm_level is None else llm_level,
        "D0" if user_level is None else user_level,
    ]
    for level in candidates:
        if level not in LEVELS:
            # LEVELS.get(level, 0) 曾经把不认识的等级静默当 D0(最低级)处理——
            # 一旦 hard_gate 本身传错,"硬门永远拥有最终裁决权"这句承诺就悄悄失效,
            # 而不是报错。确定性门必须要么给出正确答案,要么直接炸,不能猜。
            raise ValueError(f"unrecognized decision level: {level!r}")
    return max(candidates, key=lambda level: LEVELS[level])


def recommend_route(
    task_text: str,
    *,
    call_fn: Callable[[str], str] | None = None,
) -> dict[str, Any]:
    """Ask an injected provider for a strict JSON route recommendation.

    Provider absence, invalid JSON, or invalid schema is an explicit deterministic
    fallback rather than a silent keyword-routing success.
    """
    if call_fn is None:
        return {"status": "degraded", "reason": "推荐层不可用，降级为确定性规则", "unsupported_scope": False}
    try:
        raw = call_fn(task_text)
        payload = json.loads(raw)
        departments = payload.get("candidate_departments")
        level = payload.get("d_level")
        if not isinstance(departments, list) or not all(isinstance(item, str) for item in departments):
            raise ValueError("candidate_departments must be a string list")
        if level not in LEVELS:
            raise ValueError("d_level must be D0/D1/D2")
        unsupported = payload.get("unsupported_scope") is True
        return {
            "status": "ok",
            "candidate_departments": departments,
            "d_level": level,
            "confidence": payload.get("confidence"),
            "unsupported_scope": unsupported,
            "reason": payload.get("reason", ""),
        }
    except (TypeError, ValueError, json.JSONDecodeError) as exc:
        return {"status": "degraded", "reason": f"推荐层不可用，降级为确定性规则：{exc}", "unsupported_scope": False}
