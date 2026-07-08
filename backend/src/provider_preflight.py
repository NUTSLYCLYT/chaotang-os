"""开跑前 provider 探活——秒级确认供应商在线，避免蜂群挂数分钟才发现离线。

天才设计沉淀(2026-06-10 大神视角)：今天踩的坑——active provider 是 deepseek 但 key 没加载/
代理方向反了，蜂群跑到 timeout(分钟级)才暴露，且管道缓冲把诊断输出也吞了。
预检把"等超时"变成"秒级失败快报"：开跑前打一个 1-token 廉价调用，不通立即报清楚原因并终止，
不进蜂群空耗。

设计要点：
- 决策逻辑(preflight)与真实探活(_default_probe)解耦——probe 可注入，决策逻辑可确定性测试。
- 探活用极短 timeout + max_tokens=1，秒级返回，不烧 token。
- 失败返回结构化原因(可观测，Charity)，绝不静默吞掉。
"""

from __future__ import annotations

import time
from collections.abc import Callable


def preflight(
    provider_id: str,
    *,
    probe: Callable[[str, float], None] | None = None,
    timeout: float = 8.0,
) -> dict:
    """开跑前探活。返回 {ok, latency_s, error}。

    probe(provider_id, timeout): 真实探活回调；抛异常=不通。可注入用于测试。
    默认 _default_probe 用 litellm 打一个 1-token 廉价调用。
    """
    probe = probe or _default_probe
    t0 = time.monotonic()
    try:
        probe(provider_id, timeout)
        return {"ok": True, "latency_s": round(time.monotonic() - t0, 2), "error": None}
    except Exception as e:  # noqa: BLE001 探活失败一律捕获并结构化上报,绝不静默
        return {"ok": False, "latency_s": round(time.monotonic() - t0, 2), "error": str(e)[:200]}


def _default_probe(provider_id: str, timeout: float) -> None:
    """真实探活：raw httpx GET {api_base}/models(与 curl 同款可靠路径)。不通则抛异常。

    刻意不用 litellm：litellm 在飘代理上会叠加内部重试(8s×3≈26s),把"慢一下"误判成"离线",
    且 aiohttp 传输还可能绕过代理。httpx 默认 trust_env=True 读环境代理,单发 + 1 次重试,
    判定更接近真实连通性(curl GET /models 0.13s)。
    """
    import httpx

    from src.provider import get_provider_env

    env = get_provider_env(provider_id)
    if not env.get("api_key"):
        raise RuntimeError(f"provider '{provider_id}' 的 key 未加载(env {env.get('api_key_env')} 为空,检查 .env)")
    base = (env.get("api_base") or "").rstrip("/")
    if not base:
        raise RuntimeError(f"provider '{provider_id}' 无 api_base(检查 providers.yaml)")
    url = f"{base}/models"
    headers = {"Authorization": f"Bearer {env['api_key']}"}
    last_err: Exception | None = None
    for _ in range(2):  # 单发 + 1 次重试,扛代理瞬时抖动而不叠加成假离线
        try:
            r = httpx.get(url, headers=headers, timeout=timeout)  # trust_env 默认读环境代理
            if r.status_code < 500:  # 2xx/4xx 都算"连得上"(401 是 key 问题,另报)
                if r.status_code in (401, 403):
                    raise RuntimeError(f"鉴权失败 http={r.status_code}(检查 key)")
                return
            last_err = RuntimeError(f"http={r.status_code}")
        except Exception as e:  # noqa: BLE001
            last_err = e
    raise last_err or RuntimeError("探活失败")


def format_result(provider_id: str, result: dict) -> str:
    """把探活结果格式化成一行人话(可观测)。"""
    if result["ok"]:
        return f"✅ provider '{provider_id}' 在线 ({result['latency_s']}s)"
    return (
        f"❌ provider '{provider_id}' 离线 ({result['latency_s']}s) — {result['error']}\n"
        f"   → 终止,不进蜂群(免挂起)。请检查 key/代理(参见 .env 与 NO_PROXY),或换 --provider。"
    )
