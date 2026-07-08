"""Flow 路由：先按 intent，再按 domain 关键词。

设计理由（2026-05-04）：
  老路由只看 domain 关键词。"用一句话评估当前小红书的电池价格波动趋势"
  命中 "小红书" 被路到 haolong（销售获客流），结果蜂群把信息查询当成
  低质量销售线索归档，答非所问。

  新策略：intent 优先。
    1. 先看用户在做什么（评估/分析/Q&A vs 操作/生成/流程）
    2. intent 是 "evaluate" → flow_evaluate（单 agent 直答），不论领域
    3. intent 不是 evaluate 才进 domain 关键词分流
"""

from __future__ import annotations

# 类型 → flow config 文件名
FLOW_MAP: dict[str, str] = {
    "evaluate": "flow_evaluate.yaml",
    "opc": "flow_opc.yaml",
    "haolong": "flow_haolong.yaml",
    "product": "flow_product.yaml",
    "legal": "flow_legal.yaml",
    "sdlc": "flow_sdlc.yaml",
    "finance": "flow_finance.yaml",
    "medical": "flow_medical.yaml",
    "court": "flow_court.yaml",
}

# Intent → "evaluate"：用户在问问题、要判断、要评估
# 命中任一即走 flow_evaluate。优先级最高。
_EVALUATE_INTENT_KEYWORDS: list[str] = [
    "用一句话",
    "一句话",
    "简评",
    "简单评",
    "快速看",
    "怎么看",
    "如何看",
    "评估",
    "分析一下",
    "分析下",
    "趋势",
    "走势",
    "是不是",
    "能不能",
    "为什么",
    "为啥",
    "多少",
    "几成",
    "几个点",
    "什么意思",
    "意味着",
    "看一下",
    "看看",
]

# Domain 关键词 → 行业流。Intent 不是 evaluate 才走这层。
_KEYWORD_RULES: list[tuple[list[str], str]] = [
    (["法律", "合同", "诉讼", "仲裁", "合规", "法规"], "legal"),
    (["产品", "功能", "需求", "规划", "路线图", "竞品"], "product"),
    (["获客", "营销", "内容", "小红书", "推文", "发布"], "haolong"),
    (["医疗", "医院", "诊断", "患者", "药品"], "medical"),
    (["财务", "财报", "估值", "投资", "融资"], "finance"),
    (["开发", "代码", "架构", "系统", "技术方案", "SDLC"], "sdlc"),
]

DEFAULT_FLOW = "opc"


def _is_evaluate_intent(user_input: str) -> bool:
    return any(kw in user_input for kw in _EVALUATE_INTENT_KEYWORDS)


def resolve_flow(type_hint: str, user_input: str) -> tuple[str, str]:
    """返回 (flow_type, config_filename)。

    显式 type_hint 最高优先级。否则：
      1. evaluate intent → flow_evaluate
      2. domain 关键词 → 对应行业流
      3. 兜底 → opc
    """
    if type_hint != "auto" and type_hint in FLOW_MAP:
        return type_hint, FLOW_MAP[type_hint]

    if _is_evaluate_intent(user_input):
        return "evaluate", FLOW_MAP["evaluate"]

    for keywords, flow_type in _KEYWORD_RULES:
        if any(kw in user_input for kw in keywords):
            return flow_type, FLOW_MAP[flow_type]

    return DEFAULT_FLOW, FLOW_MAP[DEFAULT_FLOW]
