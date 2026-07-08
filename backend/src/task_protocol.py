"""Chaotang task protocol classification for UI and API."""

from __future__ import annotations

from dataclasses import dataclass


QINTIANJIAN_KEYWORDS = (
    "开钦天监",
    "钦天监",
    "上线",
    "发布",
    "生产",
    "客户承诺",
    "报价",
    "合同",
    "自动执行",
    "不可逆",
    "架构分叉",
    "花钱",
    "API",
)
REVIEW_KEYWORDS = (
    "审查",
    "review",
    "为什么",
    "效率低",
    "很乱",
    "偏移",
    "风险",
    "怎么做",
)
EXPLAIN_KEYWORDS = (
    "解释",
    "小白",
    "概念",
    "什么意思",
    "教我",
)
BUILD_KEYWORDS = (
    "实现",
    "修复",
    "加",
    "改",
    "提交",
    "推送",
    "测试",
    "脚本",
    "系统",
)


@dataclass(frozen=True)
class TaskProtocol:
    mode: str
    reason: str
    next_steps: tuple[str, ...]
    signoff_required: bool


def contains_any(text: str, keywords: tuple[str, ...]) -> bool:
    lowered = text.lower()
    return any(keyword.lower() in lowered for keyword in keywords)


def classify_task(text: str) -> TaskProtocol:
    if contains_any(text, QINTIANJIAN_KEYWORDS):
        return TaskProtocol(
            mode="开钦天监",
            reason="需求涉及上线、客户承诺、不可逆、花钱或架构分叉，需要先做少量关键选择。",
            next_steps=(
                "提出最多 3 个现在必须定的问题。",
                "让两位相关大神给选项和推荐项。",
                "用户确认后生成钦天监简报，再交给蜂群或 Codex 执行。",
            ),
            signoff_required=True,
        )
    if contains_any(text, EXPLAIN_KEYWORDS):
        return TaskProtocol(
            mode="只解释",
            reason="用户主要在学习概念或理解系统，默认不改代码。",
            next_steps=(
                "用通俗语言解释。",
                "给一个朝堂项目里的具体例子。",
                "如果用户追加同意，再落成规则、脚本或测试。",
            ),
            signoff_required=False,
        )
    if contains_any(text, REVIEW_KEYWORDS):
        return TaskProtocol(
            mode="先审查",
            reason="需求可能还没定位到具体改动点，先找最小有效修复路径。",
            next_steps=(
                "读取 git 状态和相关文件。",
                "列出最高风险、最小修复路径和本轮不做什么。",
                "用户已说按推荐来时，直接实现最小修复并收口。",
            ),
            signoff_required=False,
        )
    if contains_any(text, BUILD_KEYWORDS):
        return TaskProtocol(
            mode="直接做",
            reason="需求可以进入实现闭环。",
            next_steps=(
                "读现状，按现有风格改代码或文档。",
                "补最小测试并跑验证。",
                "运行 commit_closeout_check，精确提交，按需推送。",
            ),
            signoff_required=False,
        )
    return TaskProtocol(
        mode="先审查",
        reason="需求模式不明确，先用低风险审查避免偏移。",
        next_steps=(
            "确认目标、成功标准和边界。",
            "给出最小下一步。",
            "必要时升级为钦天监。",
        ),
        signoff_required=False,
    )


def human_hint(protocol: TaskProtocol) -> str:
    if protocol.mode == "开钦天监":
        return "这件事风险较高，建议先问 3 个关键问题。"
    if protocol.mode == "只解释":
        return "这件事适合先讲清楚，我会先用人话解释。"
    if protocol.mode == "直接做":
        return "这件事可以直接进入执行，我会边做边验证。"
    return "这件事先别急着做，我会先帮你看清楚最小下一步。"
