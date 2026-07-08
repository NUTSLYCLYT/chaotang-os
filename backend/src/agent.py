"""无状态 Agent：接收上下文，调用模型，返回结果。

支持两种模式：
1. 纯文本模式（默认）：text in → LLM → text out
2. 工具模式：text in → LLM → tool_calls → ToolRouter → LLM → text out
"""

from __future__ import annotations

from src.model_adapter import ModelAdapter


class Agent:
    """无状态 Agent，每次调用接收完整上下文。

    支持为每个 Agent 单独配置模型参数，实现多模型切换。
    当配置了 tools + tool_router 时，自动切换为工具模式。
    """

    def __init__(
        self,
        step_id: str,
        name: str,
        system_prompt: str,
        adapter: ModelAdapter,
        model: str | None = None,
        api_base: str | None = None,
        api_key: str | None = None,
        tools: list | None = None,
        tool_router: object | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        fallback_models: list | None = None,
    ):
        self.step_id = step_id
        self.name = name
        self.system_prompt = system_prompt
        self.adapter = adapter
        # 可选的模型配置（覆盖 adapter 的默认配置）
        self.model = model
        self.api_base = api_base
        self.api_key = api_key
        self.temperature = temperature
        self.max_tokens = max_tokens
        # 故障转移模型列表（可选）
        self.fallback_models = fallback_models
        # 工具配置（可选，None 时走纯文本模式）
        self.tools = tools
        self.tool_router = tool_router

    def run(self, user_input: str, on_token=None) -> dict:
        """执行 Agent，返回标准化结果。

        - 无 tools → 纯文本模式（原有路径，零改动）
        - 有 tools → 工具模式（通过 ToolRouter 调度，不支持 on_token）
        - on_token: 可选回调 (token: str) → None，流式输出时逐 token 调用
        """
        if self.tools and self.tool_router:
            return self.tool_router.call_with_tools(
                adapter=self.adapter,
                system_prompt=self.system_prompt,
                user_input=user_input,
                available_tools=self.tools,
                model=self.model,
                api_base=self.api_base,
                api_key=self.api_key,
                merge_system_to_user=self.adapter.merge_system_to_user,
                max_tokens=self.max_tokens,
                temperature=self.temperature,
            )
        return self.adapter.call(
            self.system_prompt,
            user_input,
            model=self.model,
            api_base=self.api_base,
            api_key=self.api_key,
            on_token=on_token,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            fallback_models=self.fallback_models,
        )
