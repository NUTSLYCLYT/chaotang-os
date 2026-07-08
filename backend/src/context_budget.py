"""ContextBudget: 上下文利用率监控与预算管理，Harness L1 信息边界 + L5 观测层。

核心原理：当上下文利用率超过 40% 时，模型输出质量显著下降。
本模块追踪每步的 token 消耗、利用率、成本，提供 zone 判断和压缩建议。
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


# 常见模型的上下文窗口大小（tokens）
MODEL_CONTEXT_LIMITS: dict[str, int] = {
    # 智谱 GLM 系列
    "openai/GLM-5.1": 128_000,
    "openai/GLM-4.7": 128_000,
    "openai/GLM-4-flash": 128_000,
    "openai/GLM-4-flashx": 128_000,
    "openai/GLM-4.5-air": 128_000,
    "openai/glm-5.1": 128_000,
    "openai/glm-4.7": 128_000,
    "openai/glm-4.5-air": 128_000,
    # OpenAI 系列
    "gpt-4o": 128_000,
    "gpt-4o-mini": 128_000,
    "gpt-4-turbo": 128_000,
    "gpt-3.5-turbo": 16_385,
    # Anthropic 系列
    "anthropic/claude-3-5-sonnet": 200_000,
    "anthropic/claude-3-haiku": 200_000,
    "anthropic/MiniMax-M2.7": 128_000,
    # 默认
    "_default": 128_000,
}

# 常见模型的每百万 token 价格（美元，输入/输出）
MODEL_PRICING: dict[str, tuple[float, float]] = {
    "openai/GLM-5.1": (0.50, 0.50),
    "openai/GLM-4.7": (0.50, 0.50),
    "openai/GLM-4-flash": (0.10, 0.10),
    "openai/glm-5.1": (0.50, 0.50),
    "openai/glm-4.7": (0.50, 0.50),
    "gpt-4o": (2.50, 10.00),
    "gpt-4o-mini": (0.15, 0.60),
    "_default": (0.50, 0.50),
}


@dataclass
class BudgetReport:
    """单步上下文预算报告。"""
    # 估算 token 数
    system_prompt_tokens: int = 0
    context_tokens: int = 0
    total_input_tokens: int = 0
    # 模型限制
    model_max_tokens: int = 128_000
    # 利用率
    utilization_ratio: float = 0.0
    # 区域判定
    zone: str = "smart"  # smart / warning / danger
    # 压缩建议
    compression_needed: bool = False
    compression_suggestion: str = ""
    # 实际用量（执行后填充）
    actual_prompt_tokens: int = 0
    actual_completion_tokens: int = 0
    # 成本估算
    cost_usd: float = 0.0
    # 模型名称
    model: str = ""

    def to_dict(self) -> dict:
        return {
            "system_prompt_tokens": self.system_prompt_tokens,
            "context_tokens": self.context_tokens,
            "total_input_tokens": self.total_input_tokens,
            "model_max_tokens": self.model_max_tokens,
            "utilization_ratio": round(self.utilization_ratio, 4),
            "zone": self.zone,
            "compression_needed": self.compression_needed,
            "compression_suggestion": self.compression_suggestion,
            "actual_prompt_tokens": self.actual_prompt_tokens,
            "actual_completion_tokens": self.actual_completion_tokens,
            "cost_usd": round(self.cost_usd, 6),
            "model": self.model,
        }


class ContextBudget:
    """上下文预算追踪器。

    在每步执行前估算 token 利用率，在执行后记录实际用量和成本。
    """

    WARNING_RATIO = 0.40   # 40% 警告线
    DANGER_RATIO = 0.60    # 60% 危险线

    def __init__(self, warning_ratio: float = 0.40, danger_ratio: float = 0.60):
        self.warning_ratio = warning_ratio
        self.danger_ratio = danger_ratio
        # 累计追踪（整个 run 生命周期）
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self.total_cost_usd = 0.0
        self.step_reports: list[BudgetReport] = []

    @staticmethod
    def estimate_tokens(text: str) -> int:
        """快速 token 估���。

        中文文本约 1.5 字/token，英文约 4 字符/token。
        混合内容取加权平均。
        """
        if not text:
            return 0

        chinese_chars = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
        other_chars = len(text) - chinese_chars

        # 中文: ~1.5 字/token, 英文/标点: ~4 字符/token
        chinese_tokens = chinese_chars / 1.5
        other_tokens = other_chars / 4.0

        return max(1, int(chinese_tokens + other_tokens))

    @staticmethod
    def get_model_limit(model: str) -> int:
        """获取模型的上下文窗口大小。"""
        return MODEL_CONTEXT_LIMITS.get(model, MODEL_CONTEXT_LIMITS["_default"])

    def pre_check(self, system_prompt: str, context: str, model: str) -> BudgetReport:
        """执行前检查：估算 token 利用率，返回预算报告。

        Args:
            system_prompt: 系统提示词
            context: 渲染后的上下文
            model: 模型名称

        Returns:
            BudgetReport: 预算报告（zone/compression建议）
        """
        sys_tokens = self.estimate_tokens(system_prompt)
        ctx_tokens = self.estimate_tokens(context)
        total = sys_tokens + ctx_tokens
        max_tokens = self.get_model_limit(model)
        ratio = total / max_tokens if max_tokens > 0 else 0.0

        # zone 判定
        if ratio >= self.danger_ratio:
            zone = "danger"
        elif ratio >= self.warning_ratio:
            zone = "warning"
        else:
            zone = "smart"

        # 压缩建议
        compression_needed = zone in ("warning", "danger")
        suggestion = ""
        if zone == "danger":
            suggestion = (
                f"上下文利用率 {ratio:.1%} 已超过危险线 ({self.danger_ratio:.0%})，"
                "建议压缩早期步骤输出或减少知识注入内容"
            )
        elif zone == "warning":
            suggestion = (
                f"上下文利用率 {ratio:.1%} 已超过警告线 ({self.warning_ratio:.0%})，"
                "建议关注后续步骤的上下文增长"
            )

        if compression_needed:
            logger.warning(
                "上下文预算 [%s zone]: %d/%d tokens (%.1f%%), model=%s",
                zone, total, max_tokens, ratio * 100, model,
            )

        report = BudgetReport(
            system_prompt_tokens=sys_tokens,
            context_tokens=ctx_tokens,
            total_input_tokens=total,
            model_max_tokens=max_tokens,
            utilization_ratio=ratio,
            zone=zone,
            compression_needed=compression_needed,
            compression_suggestion=suggestion,
            model=model,
        )
        return report

    def post_record(
        self,
        report: BudgetReport,
        raw_response: dict,
        model: str | None = None,
    ) -> BudgetReport:
        """执行后记录：从模型响应中提取实际 token 用量和成本。

        Args:
            report: pre_check 返回的预算报告
            raw_response: 模型调用的原始响应
            model: 模型名称（可选，用于成本计算）

        Returns:
            更新后的 BudgetReport
        """
        actual_model = model or report.model

        # 提取实际 token 用量
        usage = raw_response.get("usage", {})
        if not usage and isinstance(raw_response, dict):
            # LiteLLM 响应格式
            usage = raw_response.get("usage", {})

        prompt_tokens = usage.get("prompt_tokens", 0)
        completion_tokens = usage.get("completion_tokens", 0)

        report.actual_prompt_tokens = prompt_tokens
        report.actual_completion_tokens = completion_tokens

        # 成本估算
        pricing = MODEL_PRICING.get(actual_model, MODEL_PRICING["_default"])
        input_cost = (prompt_tokens / 1_000_000) * pricing[0]
        output_cost = (completion_tokens / 1_000_000) * pricing[1]
        report.cost_usd = input_cost + output_cost

        # 累计
        self.total_input_tokens += prompt_tokens
        self.total_output_tokens += completion_tokens
        self.total_cost_usd += report.cost_usd
        self.step_reports.append(report)

        return report

    def get_run_summary(self) -> dict:
        """获取整个 run 的预算汇总。"""
        return {
            "total_steps": len(self.step_reports),
            "total_input_tokens": self.total_input_tokens,
            "total_output_tokens": self.total_output_tokens,
            "total_tokens": self.total_input_tokens + self.total_output_tokens,
            "total_cost_usd": round(self.total_cost_usd, 6),
            "max_utilization": round(
                max((r.utilization_ratio for r in self.step_reports), default=0.0), 4
            ),
            "danger_steps": sum(1 for r in self.step_reports if r.zone == "danger"),
            "warning_steps": sum(1 for r in self.step_reports if r.zone == "warning"),
        }
