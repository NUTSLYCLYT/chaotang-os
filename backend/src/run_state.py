"""RunState: 结构化运行状态管理，Harness L4 记忆与状态层。

将累积上下文从文本 blob 升级为结构化 state，支持：
- artifacts 提取（从 Agent 输出中正则提取关键数字/字段）
- 显式依赖声明（step 声明需要哪些上游步骤的完整输出）
- 智能渲染（依赖步骤完整保留，非依赖步骤可摘要化）
- 与现有 context dict 完全兼容（可导出为标准 context）
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class StepOutput:
    """单步骤的输出记录。"""
    step_id: str
    agent_name: str
    output: str
    status: str = "success"
    summary: str | None = None  # 压缩摘要（P2 智能压缩时填充）


@dataclass
class RunState:
    """结构化运行状态。

    替代原有的纯文本 context dict，提供结构化的状态追踪。
    通过 to_context() 可随时导出为 flow_engine 兼容的 context dict。
    """
    task_input: str
    knowledge: str | None = None
    rag_docs: str | None = None
    conversation_history: str | None = None

    # {step_id: StepOutput}
    step_outputs: dict[str, StepOutput] = field(default_factory=dict)

    # 结构化产出物 {field_name: value}（从 Agent 输出中提取）
    artifacts: dict[str, Any] = field(default_factory=dict)

    # 关键数字锚点（从 flow_engine._extract_data_anchors 同步）
    data_anchors: list[str] = field(default_factory=list)

    # 步骤执行顺序（保持插入顺序）
    _step_order: list[str] = field(default_factory=list)

    def add_step(self, step_id: str, agent_name: str, output: str, status: str = "success") -> None:
        """记录一步执行结果，同时更新步骤顺序。"""
        self.step_outputs[step_id] = StepOutput(
            step_id=step_id,
            agent_name=agent_name,
            output=output,
            status=status,
        )
        if step_id not in self._step_order:
            self._step_order.append(step_id)

    def extract_artifacts(self, step_id: str, output: str, rules: list[dict]) -> None:
        """从 Agent 输出中提取结构化 artifacts。

        YAML 配置示例：
            artifacts_extract:
              - field: "客户等级"
                pattern: "等级[：:]\\s*(S|A|B|C)"
              - field: "预算金额"
                pattern: "(\\d+[.\\d]*)\\s*(万元|亿元|元)"
        """
        for rule in rules:
            fname = rule.get("field", "")
            pattern = rule.get("pattern", "")
            if not fname or not pattern:
                continue
            m = re.search(pattern, output)
            if m:
                value = m.group(1) if m.lastindex and m.lastindex >= 1 else m.group(0)
                self.artifacts[fname] = value
                logger.debug("artifacts[%s] = %s (from step %s)", fname, value, step_id)

    def to_context(self) -> dict:
        """导出为 flow_engine 兼容的 context dict（向后兼容）。"""
        ctx: dict = {"task_input": self.task_input, "steps": []}
        if self.knowledge:
            ctx["knowledge"] = self.knowledge
        if self.rag_docs:
            ctx["rag_docs"] = self.rag_docs
        if self.conversation_history:
            ctx["conversation_history"] = self.conversation_history

        for step_id in self._step_order:
            so = self.step_outputs[step_id]
            ctx["steps"].append({
                "step": so.step_id,
                "agent_name": so.agent_name,
                "output": so.output,
            })
        return ctx

    def render_for_step(
        self,
        step_id: str,
        deps: list[str] | None = None,
        context_mode: str = "full",
        max_chars: int = 0,
    ) -> str:
        """为指定步骤智能渲染上下文。

        Args:
            step_id: 当前要执行的步骤 ID
            deps: 显式依赖的上游步骤 ID 列表（None = 全部）
            context_mode: full / summary / artifacts_only
            max_chars: 最大字符数（0 = 不限制）

        渲染优先级：
        1. 固定部分：task_input / knowledge / rag_docs
        2. 依赖步骤：完整输出
        3. 非依赖步骤：摘要（如有）或完整输出（context_mode=full时）
        4. artifacts：结构化产出物摘要
        """
        SEP = "\n\n---\n\n"
        parts = [f"## 原始客户需求\n{self.task_input}"]

        if self.knowledge:
            parts.append(
                "## 📋 产品知识库（公司内部数据，必须优先引用）\n"
                "以下数据来自公司产品参数库，涉及产品选型和报价时必须引用这些数据，"
                "不得凭空编造与下列数据矛盾的价格或参数。\n\n"
                + self.knowledge
            )

        if self.rag_docs:
            parts.append(
                "## 📚 相关文档参考（知识库检索结果）\n"
                + self.rag_docs
            )

        if self.conversation_history:
            parts.append(
                "## 💬 对话历史\n" + self.conversation_history
            )

        if context_mode == "artifacts_only":
            # 只注入 artifacts，不含步骤输出
            if self.artifacts:
                parts.append(self._render_artifacts())
            return SEP.join(parts)

        # 渲染步骤输出
        for sid in self._step_order:
            so = self.step_outputs[sid]
            is_dep = deps is None or sid in (deps or [])

            if context_mode == "full" or is_dep:
                parts.append(f"## {so.agent_name} 的分析结果\n{so.output}")
            elif context_mode == "summary" and so.summary:
                parts.append(f"## {so.agent_name} 的分析摘要\n{so.summary}")
            # non-dep + no summary + summary mode → skip（节省 tokens）

        # artifacts 注入（永不省略）
        if self.artifacts:
            parts.append(self._render_artifacts())

        rendered = SEP.join(parts)

        # 硬截断
        if max_chars > 0 and len(rendered) > max_chars:
            rendered = rendered[:max_chars] + "\n\n...[上下文已截断]"

        return rendered

    def _render_artifacts(self) -> str:
        lines = [f"- **{k}**: {v}" for k, v in self.artifacts.items()]
        return (
            "## 🔑 关键数据（结构化提取，必须引用）\n"
            "以下数据由上游步骤分析得出，引用时不得擅自修改：\n\n"
            + "\n".join(lines)
        )

    def get_artifact(self, key: str, default: Any = None) -> Any:
        return self.artifacts.get(key, default)
