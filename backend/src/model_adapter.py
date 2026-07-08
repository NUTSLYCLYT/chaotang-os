"""ModelAdapter: Agent → LiteLLM → Model 的统一封装层。"""

from __future__ import annotations

import contextvars
import os
import random
import time

import litellm

# 代理环境修复(2026-06-10):无直连出口的沙箱里,litellm 默认 aiohttp 传输 trust_env=False
# 会忽略 HTTP_PROXY 直连 → SSL 握手 60s 超时 → "Connection error"(蜂群并发下尤甚)。
# sync httpx 传输读环境代理已验证可靠(1.2s)。故在检测到代理时:① 让 aiohttp 也读环境代理
# ② 禁用 aiohttp 回退到 httpx(双保险)。非代理环境不触发,零影响。可用 LITELLM_FORCE_AIOHTTP=1 覆盖。
if (os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")) and os.environ.get(
    "LITELLM_FORCE_AIOHTTP"
) != "1":
    litellm.aiohttp_trust_env = True
    litellm.disable_aiohttp_transport = True

# python3.14 兼容(2026-07-06):litellm 的 async LoggingWorker 在 3.14 解释器关闭时抛
# "Task was destroyed but it is pending / coroutine never awaited",使 flow 在首个 LLM 调用后
# 静默退出(此前"户部零产出"真因之一)。本仓只用同步 litellm.completion、不依赖 litellm 回调,
# 故关掉一切异步日志回调,消除该 worker。可用 LITELLM_KEEP_CALLBACKS=1 恢复默认行为。
if os.environ.get("LITELLM_KEEP_CALLBACKS") != "1":
    for _cb in (
        "success_callback",
        "failure_callback",
        "callbacks",
        "_async_success_callback",
        "_async_failure_callback",
        "input_callback",
        "service_callback",
    ):
        try:
            setattr(litellm, _cb, [])
        except Exception:  # noqa: BLE001 — 版本差异下缺属性不阻断
            pass
    try:
        litellm.turn_off_message_logging = True
    except Exception:  # noqa: BLE001
        pass


class BudgetExceeded(RuntimeError):
    """当前 run 的 LLM 调用次数超过上限。"""


_BUDGET_VAR: contextvars.ContextVar["LLMCallBudget | None"] = contextvars.ContextVar(
    "llm_call_budget", default=None
)


class LLMCallBudget:
    """per-run LLM 调用预算。通过 ContextVar 透明传递，无需修改调用链签名。

    使用方式::

        budget = LLMCallBudget.set(max_calls=100)
        # ... run flow ...
        print(budget.used)

    若不设置（default=None），model_adapter 静默跳过预算检查，行为与旧版一致。
    """

    def __init__(self, max_calls: int) -> None:
        self.max_calls = max_calls
        self.used: int = 0

    def consume(self) -> None:
        self.used += 1
        if self.used > self.max_calls:
            raise BudgetExceeded(
                f"LLM 调用次数超限：已用 {self.used} 次，上限 {self.max_calls} 次"
            )

    @classmethod
    def set(cls, max_calls: int) -> "LLMCallBudget":
        budget = cls(max_calls)
        _BUDGET_VAR.set(budget)
        return budget

    @classmethod
    def current(cls) -> "LLMCallBudget | None":
        return _BUDGET_VAR.get()


class ModelAdapter:
    """封装 LiteLLM 调用，返回标准化结果。

    Args:
        merge_system_to_user: 如果为 True，将 system prompt 合并到 user message 中。
            某些代理 API 对长 system prompt 有限制，此选项可解决 502 问题。
    """

    def __init__(
        self,
        model: str = "anthropic/MiniMax-M2.7",
        api_base: str | None = None,
        api_key: str | None = None,
        merge_system_to_user: bool = False,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ):
        self.model = model
        self.api_base = api_base
        self.api_key = api_key
        self.merge_system_to_user = merge_system_to_user
        self.temperature = temperature
        self.max_tokens = max_tokens

    def call(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str | None = None,
        api_base: str | None = None,
        api_key: str | None = None,
        on_token=None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        fallback_models: list | None = None,
        messages: list[dict] | None = None,
        skip_budget: bool = False,
    ) -> dict:
        """调用模型，返回标准化结果。

        Returns:
            {
                "model": str,
                "prompt": str,      # system_prompt 内容
                "output": str,      # 模型输出文本
                "status": str,      # "success" / "error"
                "raw_response": dict,
            }
        """
        # 使用传入参数或实例默认值
        actual_model = model or self.model
        actual_api_base = api_base or self.api_base
        actual_api_key = api_key or self.api_key

        # token 护栏:超会话预算先刹车,不发 LLM(防跑飞)。失败/异常不阻断正常路。
        try:
            from src import token_monitor

            _g = token_monitor.check_session()
            if not _g["ok"]:
                return {
                    "model": actual_model,
                    "requested_model": actual_model,
                    "prompt": system_prompt,
                    "output": _g["reason"],
                    "status": "error",
                    "raw_response": {"token_guard": _g},
                }
        except Exception:
            pass

        if messages is not None:
            # 多轮对话模式：直接使用传入的消息列表（ReAct 多轮历史）
            if self.merge_system_to_user:
                # 将 system 消息合并到第一条 user 消息，适配不支持 system role 的 API
                system_parts = [m["content"] for m in messages if m["role"] == "system"]
                non_system = [m for m in messages if m["role"] != "system"]
                if system_parts and non_system:
                    merged_content = (
                        "\n\n".join(system_parts)
                        + "\n\n---\n\n"
                        + non_system[0]["content"]
                    )
                    non_system[0] = {**non_system[0], "content": merged_content}
                final_messages = non_system if non_system else messages
            else:
                final_messages = messages
        else:
            # 单轮模式（现有行为，向后兼容）
            if self.merge_system_to_user:
                final_messages = [
                    {"role": "system", "content": "你是一个专业助手。"},
                    {
                        "role": "user",
                        "content": system_prompt + "\n\n---\n\n" + user_prompt,
                    },
                ]
            else:
                final_messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ]

        actual_temperature = (
            temperature if temperature is not None else self.temperature
        )
        actual_max_tokens = max_tokens if max_tokens is not None else self.max_tokens

        kwargs: dict = {"model": actual_model, "messages": final_messages}
        if actual_api_base:
            kwargs["api_base"] = actual_api_base
        if actual_api_key:
            kwargs["api_key"] = actual_api_key
        if actual_temperature is not None:
            kwargs["temperature"] = actual_temperature
        if actual_max_tokens is not None:
            kwargs["max_tokens"] = actual_max_tokens
        # 单次 LLM 请求超时上限（秒）。LiteLLM 默认 6000s（100 分钟）会让大请求
        # 在出错时无限挂起；这里设 180s（3 分钟）让超时尽快回到外层 retry 循环。
        # 可用 LITELLM_REQUEST_TIMEOUT 环境变量覆盖。
        kwargs["timeout"] = float(os.environ.get("LITELLM_REQUEST_TIMEOUT", "180"))

        # 构造 LiteLLM fallbacks 列表（如果传入了 fallback_models）
        if fallback_models:
            litellm_fallbacks = []
            for fb in fallback_models:
                fb_entry: dict = {"model": fb["model"]}
                if fb.get("api_base"):
                    fb_entry["api_base"] = fb["api_base"]
                fb_api_key_env = fb.get("api_key_env")
                if fb_api_key_env:
                    fb_entry["api_key"] = os.environ.get(fb_api_key_env, "")
                litellm_fallbacks.append(fb_entry)
            kwargs["fallbacks"] = litellm_fallbacks

        # 消费预算（每次 model_adapter.call() 计为一次 LLM 调用，502/503 重试不额外计数）
        # skip_budget=True 用于元任务调用（如失败分析、反思生成），不应计入当前 Run 的预算
        if not skip_budget:
            _budget = LLMCallBudget.current()
            if _budget is not None:
                _budget.consume()

        # 带重试的调用（502/503/超时/连接/限流 等瞬时错误自动重试）
        # 可用 LLM_MAX_RETRIES 覆盖（默认 4 = 首发 + 3 次退避重试）
        max_retries = int(os.environ.get("LLM_MAX_RETRIES", "4"))
        last_error = None
        for attempt in range(max_retries):
            try:
                if on_token is not None:
                    # Some LiteLLM/OpenAI-compatible combinations return AsyncStream from sync completion(stream=True).
                    # This execution path is synchronous, so fall back to a non-streaming call instead of failing the step.
                    output_parts: list[str] = []
                    try:
                        stream_resp = litellm.completion(**kwargs, stream=True)
                        for chunk in stream_resp:
                            token = (
                                (chunk.choices[0].delta.content or "")
                                if chunk.choices
                                else ""
                            )
                            if token:
                                output_parts.append(token)
                                on_token(token)
                        output = "".join(output_parts)
                        return {
                            "model": actual_model,
                            "prompt": system_prompt,
                            "output": output,
                            "status": "success",
                            "raw_response": {"streamed": True},
                        }
                    except Exception as stream_error:
                        stream_error_text = str(stream_error).lower()
                        if (
                            "asyncstream" not in stream_error_text
                            and "not an iterator" not in stream_error_text
                        ):
                            raise
                        response = litellm.completion(**kwargs)
                        output = response.choices[0].message.content or ""
                        if output and not output_parts:
                            on_token(output)
                        return {
                            "model": getattr(response, "model", None) or actual_model,
                            "requested_model": actual_model,
                            "prompt": system_prompt,
                            "output": output,
                            "status": "success",
                            "raw_response": {
                                "streamed": False,
                                "stream_fallback": "sync_after_async_stream",
                                "response": response.model_dump(),
                            },
                        }
                else:
                    response = litellm.completion(**kwargs)
                    output = response.choices[0].message.content or ""
                    raw = response.model_dump()
                    # token 监控记账(纯增量,失败不阻断 LLM 调用)
                    try:
                        from src import token_monitor

                        token_monitor.record_from_usage(
                            raw.get("usage") or {},
                            model=getattr(response, "model", None) or actual_model,
                        )
                    except Exception:
                        pass
                    return {
                        # 真正出力的模型（fallback 生效时与请求模型不同）→ 观测性:分得清主力还是兜底
                        "model": getattr(response, "model", None) or actual_model,
                        "requested_model": actual_model,
                        "prompt": system_prompt,
                        "output": output,
                        "status": "success",
                        "raw_response": raw,
                    }
            except Exception as e:
                last_error = e
                err_str = str(e).lower()
                # 瞬时错误才重试：网关/超时/连接 + 限流(429)/过载。
                # 限流是 18 步并发压 deepseek 时的真实故障(2026-07-06 实跑暴露)，
                # 旧逻辑不含 429 → 直接判死；此处补齐并改指数退避+抖动，避免多步同时重试再撞。
                is_retryable = any(
                    k in err_str
                    for k in [
                        "502",
                        "503",
                        "504",
                        "badgateway",
                        "bad gateway",
                        "upstream",
                        "timeout",
                        "timed out",
                        "connection",
                        "apiconnection",
                        "429",
                        "rate limit",
                        "rate_limit",
                        "ratelimit",
                        "too many requests",
                        "overloaded",
                        "please try again",
                    ]
                )
                if is_retryable and attempt < max_retries - 1:
                    # 指数退避 2/4/8s(封顶 30s) + 抖动，散开并发重试避免二次限流
                    wait = min(30.0, 2.0 * (2**attempt)) + random.uniform(0.0, 1.5)
                    time.sleep(wait)
                    continue
                break

        return {
            "model": actual_model,
            "prompt": system_prompt,
            "output": f"[ERROR] model={actual_model}, error={last_error!s}",
            "status": "error",
            "raw_response": {"error": str(last_error)},
        }
