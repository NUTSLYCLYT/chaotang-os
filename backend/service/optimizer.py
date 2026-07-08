"""Prompt优化器：将用户原始需求结构化，提升下游Agent效果。"""

from __future__ import annotations
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from src.model_adapter import ModelAdapter

_SYSTEM_PROMPT = """你是一个专业的需求分析师。用户会给你一段原始需求描述，你需要将其结构化整理。

输出格式（严格按照此格式，不要额外解释）：

【背景】
（用户/项目的基本背景）

【核心目标】
（最重要的1-3个目标）

【具体需求】
（详细的需求描述）

【约束条件】
（时间、预算、技术或其他限制）

【期望输出】
（用户希望得到什么形式的结果）

如果原始需求已经比较清晰，直接按格式整理即可，不要过度发挥。"""


def optimize(raw_input: str, model_adapter: ModelAdapter) -> str:
    """将原始用户输入优化为结构化需求。失败时返回原始输入。"""
    try:
        result = model_adapter.call(
            system_prompt=_SYSTEM_PROMPT,
            user_prompt=f"原始需求：\n{raw_input}",
            skip_budget=True,
        )
        if result["status"] == "success":
            return result["output"]
    except Exception:
        pass
    return raw_input
