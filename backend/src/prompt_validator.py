"""Prompt 文件边界校验器 — 确保 Agent 4 文件结构的内容符合边界约束。

每个 Agent 目录下有 4 个标准文件，各有明确的内容职责：
- IDENTITY.md — 角色定位、性格、能力边界（不应含业务逻辑）
- SOUL.md     — 核心使命、价值观、行为原则（不应含工作流程）
- AGENTS.md  — 工作流程、功能模块、输出格式（主要业务逻辑）
- USER.md    — 用户角色、权限矩阵、交互流程（不应含技术实现）

校验规则：
- MUST_CONTAIN: 至少命中其中一项关键词，否则 WARNING（文件可能放错内容）
- MUST_NOT_CONTAIN: 命中则 WARNING（内容越界到错误文件）
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass
class ValidationIssue:
    """校验问题。"""
    level: str      # "warning" | "error"
    file: str       # 文件名，如 "IDENTITY.md"
    message: str
    hint: str = ""  # 修复建议

    def __str__(self):
        prefix = "WARN" if self.level == "warning" else "ERROR"
        hint = f" — 建议: {self.hint}" if self.hint else ""
        return f"[{prefix}] {self.file}: {self.message}{hint}"


# ── 文件边界规则 ──────────────────────────────────────────────────────

# (关键词列表, 规则描述, 修复建议)
_RULES: dict[str, dict] = {
    "IDENTITY.md": {
        "must_contain": [
            (
                ["角色", "定位", "能力", "性格", "身份", "简介",
                 "负责人", "专家", "工程师", "经理", "你是", "专注", "职责"],
                "应包含角色定位或能力描述",
            ),
        ],
        "must_not_contain": [
            (
                ["第一步", "第二步", "步骤一", "步骤二", "工作流程", "处理流程"],
                "不应包含详细工作流程",
                "工作流程请移至 AGENTS.md",
            ),
            (
                ["元/Wh", "元/kWh", "万元", "报价单", "BOM清单"],
                "不应包含具体价格数据",
                "价格数据属于业务数据，不应硬编码在 prompt 文件中",
            ),
        ],
    },
    "SOUL.md": {
        "must_contain": [
            (
                ["使命", "价值观", "原则", "信念", "底线", "准则",
                 "信条", "宗旨", "目标", "承诺", "边界", "方向", "核心"],
                "应包含使命/价值观描述",
            ),
        ],
        "must_not_contain": [
            (
                ["第一步", "第二步", "步骤一", "步骤二", "具体流程", "操作步骤"],
                "不应包含操作步骤",
                "操作步骤请移至 AGENTS.md",
            ),
            (
                ["输出格式", "JSON格式", "输出模板", "```json"],
                "不应包含输出格式定义",
                "输出格式请移至 AGENTS.md",
            ),
        ],
    },
    "AGENTS.md": {
        "must_contain": [
            (
                ["工作流程", "功能", "输出", "步骤", "处理", "分析", "流程"],
                "应包含工作流程或功能描述",
            ),
        ],
        "must_not_contain": [],  # AGENTS.md 内容最自由
    },
    "USER.md": {
        "must_contain": [
            (
                ["用户", "角色", "权限", "交互", "请求", "输入", "使用",
                 "输出", "规范", "格式", "要求", "对接", "调用"],
                "应包含用户交互/输出规范描述",
            ),
        ],
        "must_not_contain": [
            (
                ["技术实现", "代码示例", "import ", "def ", "class "],
                "不应包含技术实现细节",
                "技术实现不属于用户交互定义",
            ),
        ],
    },
}


# ── 校验函数 ──────────────────────────────────────────────────────────


def validate_prompt_files(
    agent_dir: str | Path,
    agent_name: str | None = None,
) -> list[ValidationIssue]:
    """校验 Agent 目录下的 4 文件是否符合边界约束。

    Args:
        agent_dir: Agent 目录路径（含 IDENTITY.md / SOUL.md / AGENTS.md / USER.md）
        agent_name: Agent 名称（用于报告，可选）

    Returns:
        问题列表（空列表 = 全部通过）
    """
    agent_dir = Path(agent_dir)
    name = agent_name or agent_dir.name
    issues = []

    for filename, rules in _RULES.items():
        file_path = agent_dir / filename
        if not file_path.exists():
            # 缺少文件只是 warning（部分 Agent 可以没有 USER.md）
            issues.append(ValidationIssue(
                level="warning",
                file=f"{name}/{filename}",
                message="文件不存在",
                hint=f"建议创建 {filename} 以完善 Agent 定义",
            ))
            continue

        content = file_path.read_text(encoding="utf-8")

        # must_contain 校验
        for keywords, desc in rules.get("must_contain", []):
            if not any(kw in content for kw in keywords):
                issues.append(ValidationIssue(
                    level="warning",
                    file=f"{name}/{filename}",
                    message=f"{desc}（未找到关键词: {', '.join(keywords[:3])}...）",
                    hint="请检查文件内容是否放错位置",
                ))

        # must_not_contain 校验
        for rule in rules.get("must_not_contain", []):
            keywords, desc = rule[0], rule[1]
            hint = rule[2] if len(rule) > 2 else ""
            found = [kw for kw in keywords if kw in content]
            if found:
                issues.append(ValidationIssue(
                    level="warning",
                    file=f"{name}/{filename}",
                    message=f"{desc}（发现: {', '.join(found[:2])}）",
                    hint=hint,
                ))

    return issues


def validate_runtime_prompts_dir(
    runtime_dir: str | Path | None = None,
) -> dict[str, list[ValidationIssue]]:
    """校验 runtime_prompts/ 下所有 Agent 目录。

    Returns:
        {agent_name: [ValidationIssue, ...]} — 只包含有问题的 Agent
    """
    if runtime_dir is None:
        runtime_dir = Path(__file__).resolve().parent.parent / "runtime_prompts"
    runtime_dir = Path(runtime_dir)

    results = {}
    if not runtime_dir.exists():
        return results

    for agent_dir in sorted(runtime_dir.iterdir()):
        if not agent_dir.is_dir():
            continue
        issues = validate_prompt_files(agent_dir, agent_name=agent_dir.name)
        if issues:
            results[agent_dir.name] = issues

    return results


def format_validation_report(
    results: dict[str, list[ValidationIssue]],
    show_hints: bool = True,
) -> str:
    """格式化校验报告。"""
    if not results:
        return "✅ 所有 Prompt 文件校验通过"

    lines = [f"Prompt 文件校验报告 — 共 {len(results)} 个 Agent 有问题\n"]
    total_issues = 0

    for agent_name, issues in sorted(results.items()):
        lines.append(f"── {agent_name} ({len(issues)} 项) ──")
        for issue in issues:
            prefix = "⚠" if issue.level == "warning" else "✗"
            lines.append(f"  {prefix} {issue.file}: {issue.message}")
            if show_hints and issue.hint:
                lines.append(f"    → {issue.hint}")
        total_issues += len(issues)

    lines.append(f"\n共 {total_issues} 项警告/错误")
    return "\n".join(lines)
