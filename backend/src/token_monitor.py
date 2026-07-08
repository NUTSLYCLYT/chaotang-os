"""src/token_monitor.py — Token 用量监控 + 预算护栏(防跑飞的意外开销)。

跨运行累计 token / 成本,设**单运行上限**和**会话总上限**;超限 guard 返回 block,
让调用方在下一次 LLM 调用前刹车——避免某个死循环/失控 agent 把 token 烧穿的意外。

接入点:model_adapter.call 返回 raw_response 含 usage → 调 record();
LLM 调用前调 guard(run_id) 检查是否还有预算。纯内存累计 + 可选 jsonl 落盘,确定性可测。
"""
from __future__ import annotations

import os
import threading

# 预算上限(token),env 可调;0/缺省=不限(但仍记账)
RUN_LIMIT = int(os.environ.get("FENGQUN_TOKEN_RUN_LIMIT", "200000"))      # 单次运行
SESSION_LIMIT = int(os.environ.get("FENGQUN_TOKEN_SESSION_LIMIT", "5000000"))  # 整会话

# 每百万 token 价格(美元,输入/输出)——估算成本,未知模型按 0
_PRICE = {
    "deepseek-chat": (0.27, 1.10), "deepseek-reasoner": (0.55, 2.19),
    "openai/deepseek-chat": (0.27, 1.10), "openai/deepseek-reasoner": (0.55, 2.19),
    "qwen3.6-35b-a3b-q4": (0.0, 0.0), "qwen3:4b": (0.0, 0.0),  # 本地免费
    # 火山引擎 豆包(约估 USD/百万token,以火山实际计费为准)
    "doubao-1-5-pro-32k": (0.11, 0.28), "openai/doubao-1-5-pro-32k": (0.11, 0.28),
    "doubao-1-5-lite-32k": (0.04, 0.08), "openai/doubao-1-5-lite-32k": (0.04, 0.08),
}

_lock = threading.Lock()
_runs: dict[str, dict] = {}     # run_id → {prompt, completion, cost}
_session = {"prompt": 0, "completion": 0, "cost": 0.0, "calls": 0}


def estimate_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    pin, pout = _PRICE.get(model, _PRICE.get(f"openai/{model}", (0.0, 0.0)))
    return round(prompt_tokens / 1e6 * pin + completion_tokens / 1e6 * pout, 6)


def record(model: str, prompt_tokens: int, completion_tokens: int, *,
           run_id: str = "default", tier: str | None = None) -> dict:
    """记一次 LLM 调用的 token 用量。返回该次的累计快照。"""
    cost = estimate_cost(model, prompt_tokens, completion_tokens)
    with _lock:
        r = _runs.setdefault(run_id, {"prompt": 0, "completion": 0, "cost": 0.0, "calls": 0})
        r["prompt"] += prompt_tokens
        r["completion"] += completion_tokens
        r["cost"] += cost
        r["calls"] += 1
        _session["prompt"] += prompt_tokens
        _session["completion"] += completion_tokens
        _session["cost"] += cost
        _session["calls"] += 1
        return {"run_id": run_id, "run_total": r["prompt"] + r["completion"],
                "run_cost": round(r["cost"], 6), "model": model, "tier": tier}


def record_from_usage(usage: dict, *, model: str = "?", run_id: str = "default",
                      tier: str | None = None) -> dict:
    """从 model_adapter raw_response 的 usage dict 直接记账(容错缺字段)。"""
    pt = int((usage or {}).get("prompt_tokens", 0) or 0)
    ct = int((usage or {}).get("completion_tokens", 0) or 0)
    return record(model, pt, ct, run_id=run_id, tier=tier)


def _run_total(run_id: str) -> int:
    r = _runs.get(run_id) or {}
    return r.get("prompt", 0) + r.get("completion", 0)


def _session_total() -> int:
    return _session["prompt"] + _session["completion"]


def guard(run_id: str = "default") -> dict:
    """LLM 调用前刹车检查。返回 {ok, reason, run_total, session_total}。

    单运行或会话总量超限 → ok=False,调用方应停止再调(防跑飞)。
    """
    rt, st = _run_total(run_id), _session_total()
    if RUN_LIMIT and rt >= RUN_LIMIT:
        return {"ok": False, "reason": f"单运行 token 超限 {rt}>={RUN_LIMIT}(防跑飞刹车)",
                "run_total": rt, "session_total": st}
    if SESSION_LIMIT and st >= SESSION_LIMIT:
        return {"ok": False, "reason": f"会话 token 超限 {st}>={SESSION_LIMIT}(防跑飞刹车)",
                "run_total": rt, "session_total": st}
    return {"ok": True, "reason": "预算充足", "run_total": rt, "session_total": st}


def check_session() -> dict:
    """会话级刹车(model_adapter 每次 LLM 调用前调)。超会话总上限 → ok=False,不发 LLM。"""
    st = _session_total()
    if SESSION_LIMIT and st >= SESSION_LIMIT:
        return {"ok": False, "reason": f"会话 token 超上限 {st}>={SESSION_LIMIT}(防跑飞·停发 LLM)",
                "session_total": st}
    return {"ok": True, "session_total": st}


def summary() -> dict:
    """用量总览(给监控面板/日报)。"""
    with _lock:
        return {
            "session": {**_session, "total_tokens": _session_total(),
                        "cost_usd": round(_session["cost"], 4)},
            "runs": {rid: {**r, "total_tokens": r["prompt"] + r["completion"],
                           "cost_usd": round(r["cost"], 4)} for rid, r in _runs.items()},
            "limits": {"run": RUN_LIMIT, "session": SESSION_LIMIT},
        }


def reset() -> None:
    """清账(测试/新会话用)。"""
    with _lock:
        _runs.clear()
        _session.update({"prompt": 0, "completion": 0, "cost": 0.0, "calls": 0})
