"""REQ-002：抽取文本的启发式注入扫描。

硬红线：返回值只含命中的**类别名**，绝不含匹配到的原文片段——正文/匹配文本绝不能落进
持久化字段或日志（W03 packet card 硬性禁止合同正文进入日志/trace）。

# ponytail: 关键词/正则启发式列表，天花板是"已知模式覆盖率"，不是语义理解；发现漏检时
# 扩充列表或换分类器，不是本轮要解决的问题。
"""

from __future__ import annotations

import re

_INJECTION_PATTERNS: dict[str, re.Pattern[str]] = {
    "INSTRUCTION_OVERRIDE": re.compile(
        r"ignore (all )?(previous|prior|above) instructions|忽略(之前|上述|以上)(的)?指令",
        re.IGNORECASE,
    ),
    "ROLE_HIJACK": re.compile(
        r"you are now|从现在开始你是|system\s*:|系统\s*[:：]",
        re.IGNORECASE,
    ),
    "ZERO_WIDTH_OBFUSCATION": re.compile(
        "[\N{ZERO WIDTH SPACE}\N{ZERO WIDTH NON-JOINER}\N{ZERO WIDTH JOINER}\N{ZERO WIDTH NO-BREAK SPACE}]"
    ),
}


def scan_for_injection(text: str) -> list[str]:
    """返回命中的类别名列表（去重、有序），从不返回匹配到的原文。"""
    hits: list[str] = []
    for category, pattern in _INJECTION_PATTERNS.items():
        if pattern.search(text):
            hits.append(category)
    return hits
