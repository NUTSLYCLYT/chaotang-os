"""三档风险评估：low / medium / high。用 DeepSeek flash 极速判断，<0.2s $0.0003/次。"""

from __future__ import annotations

import json
import os
import re

_SYSTEM = (
    "你是风险评估官。根据任务描述判断风险等级。\n"
    '严格输出JSON: {"stakes":"low"|"medium"|"high","reason":"一句话原因"}\n\n'
    "low:   信息查询/市场调研/内容创作/知识整理/小红书策略/行业分析\n"
    "medium: 产品规划/报价方案/市场策略/选型建议/采购询价/财务分析\n"
    "high:  合同签署/重大财务承诺/PACK研发决策/法律风险/Stage Gate/人事决策"
)


def _call_llm(raw_command: str) -> str:
    from src.model_adapter import ModelAdapter

    adapter = ModelAdapter(
        model="openai/deepseek-chat",
        api_base="https://api.deepseek.com/v1",
        api_key=os.getenv("DEEPSEEK_API_KEY", ""),
        max_tokens=80,
    )
    res = adapter.call(system_prompt=_SYSTEM, user_prompt=raw_command[:300])
    return res.get("output", "")


def assess_stakes(raw_command: str) -> dict:
    """返回 {"stakes": "low"|"medium"|"high", "reason": str}。失败时保守返回 medium。"""
    try:
        raw = _call_llm(raw_command)
        m = re.search(r"\{[^}]+\}", raw, re.DOTALL)
        if m:
            parsed = json.loads(m.group())
            if parsed.get("stakes") in ("low", "medium", "high"):
                return parsed
    except Exception:
        pass
    return {"stakes": "medium", "reason": "评估失败，保守设为中等风险"}
