# src/openclaw_client.py
"""openclaw 子任务派发客户端。

庄园 manor groups 在 resolved_runtime() == 'openclaw' 时,
由 FlowEngine 调此模块将 dispatch 步骤拆解出的 subtasks 批量投递给
openclaw HTTP 网关执行,结果按 numbered 格式合并后作为该组步骤输出。

协议:
  POST {base_url}/tasks
  Body:     {"tasks": ["子任务描述1", "子任务描述2", ...]}
  Response: {"results": ["结果1", "结果2", ...]}  (与 tasks 等长)

调用方示例:
  from src.openclaw_client import post_tasks, OpenclawError
  import httpx
  try:
      results = post_tasks(base_url, subtasks, timeout=30.0)
  except (OpenclawError, httpx.TimeoutException) as exc:
      # fallback to spawn
      ...

注意:超时抛 httpx.TimeoutException(调用方负责 fallback);
HTTP/响应格式错误抛 OpenclawError(调用方同样 fallback)。
"""
from __future__ import annotations

import httpx


class OpenclawError(Exception):
    """openclaw 网关返回 HTTP 错误或响应格式不符预期。"""


def post_tasks(base_url: str, subtasks: list[str], *,
               timeout: float = 30.0) -> list[str]:
    """POST subtasks 到 openclaw 网关,返回等长结果列表。

    Args:
        base_url: openclaw 服务根 URL,如 http://192.168.1.10:9000
        subtasks: 子任务描述字符串列表(来自 group dispatch 步骤输出的 subtasks 字段)
        timeout:  HTTP 超时秒数;超时时调用方应 fallback spawn

    Returns:
        与 subtasks 等长的结果字符串列表

    Raises:
        OpenclawError: HTTP 4xx/5xx 错误或响应缺少 "results" 字段
        httpx.TimeoutException: 请求超时(调用方捕获并 fallback spawn)
    """
    url = base_url.rstrip("/") + "/tasks"
    try:
        resp = httpx.post(url, json={"tasks": subtasks}, timeout=timeout)
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise OpenclawError(
            f"openclaw HTTP {exc.response.status_code}: {exc}"
        ) from exc
    # httpx.TimeoutException 不捕获,直接向上抛给调用方 fallback

    data = resp.json()
    if "results" not in data or not isinstance(data["results"], list):
        raise OpenclawError(
            f"openclaw 响应格式错误,期望 {{\"results\":[...]}},实得字段: {list(data.keys())}"
        )
    return data["results"]
