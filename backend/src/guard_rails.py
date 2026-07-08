"""GuardRails: 预执行/后执行约束拦截器，Harness L6 约束/验证/恢复层。

与 OutputLinter 的分工：
- OutputLinter: 纯格式/结构校验，generate→lint→fix 自愈
- GuardRails: 系统级安全约束，拦截执行前/后的严重问题

两类检查：
1. pre_check: 执行前（上下文过载、依赖缺失、注入检测）
2. post_check: 执行后（空输出、语言不符、拒绝回答、格式崩溃）
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# 上下文强制压缩阈值（超过此利用率时强制压缩，不只是警告）
FORCE_COMPRESS_RATIO = 0.75

# 提示注入攻击的特征模式
_INJECTION_PATTERNS = [
    r"ignore previous instructions",
    r"disregard (?:all )?(?:previous|prior) (?:instructions|prompts)",
    r"you are now",
    r"act as (?:a |an )?(?:different|new)",
    r"forget (?:everything|all) (?:you|i)",
    r"system prompt",
    r"<\|(?:im_start|im_end|endoftext)\|>",
    r"\[INST\]|\[/INST\]",
]
_INJECTION_RE = re.compile("|".join(_INJECTION_PATTERNS), re.IGNORECASE)
_STEP_HEADER_RE = re.compile(r"## (.+?) 的分析结果")
_DATA_LINE_RE = re.compile(r"\d[\d.,]*\s*[元万%kKwWhH/年月周天]")

# 模型拒绝回答的特征（开头 200 字检查）
_REFUSAL_MARKERS = [
    "作为AI",
    "作为一个AI",
    "作为人工智能",
    "作为语言模型",
    "I cannot",
    "I'm sorry, I",
    "I apologize",
    "我无法完成",
    "我不能",
    "这个请求我无法",
]


@dataclass
class GuardResult:
    passed: bool
    action: str = "proceed"  # proceed / compress / block / warn
    issues: list[str] = field(default_factory=list)
    compressed_context: str | None = None  # 压缩后的上下文（action=compress时填充）


class GuardRails:
    """执行前/后约束拦截器。

    集成到 flow_engine._execute_step：
        pre  → _execute_step 执行 agent.run() 之前
        post → agent.run() 返回之后、save_step 之前
    """

    def pre_check(
        self,
        step_id: str,
        step_config: dict,
        context: str,
        system_prompt: str,
        context_budget=None,
    ) -> GuardResult:
        """执行前检查。

        检查项：
        1. 上下文利用率 > 75% → 强制压缩（返回 action=compress）
        2. 上下文中包含注入攻击模式 → 阻止（action=block）
        3. 依赖步骤失败 → 阻止（action=block）
        4. 任务输入过短（可能是错误输入）→ 警告
        """
        issues = []

        # 1. 上下文利用率检查
        if context_budget is not None:
            model = step_config.get("model", "")
            budget_report = context_budget.pre_check(system_prompt, context, model)
            if budget_report.utilization_ratio >= FORCE_COMPRESS_RATIO:
                issues.append(
                    f"上下文利用率 {budget_report.utilization_ratio:.1%} "
                    f"超过强制压缩阈值 {FORCE_COMPRESS_RATIO:.0%}"
                )
                logger.warning(
                    "GuardRails [%s]: 上下文过载 (%.1f%%)，触发强制压缩",
                    step_id,
                    budget_report.utilization_ratio * 100,
                )
                compressed = _compress_context(context)
                return GuardResult(
                    passed=True,  # 压缩后继续
                    action="compress",
                    issues=issues,
                    compressed_context=compressed,
                )

        # 2. 注入检测 — 先走语义级检测（可降级到纯正则）
        # 安全分析类步骤（如 security_auditor）需要处理含注入特征的文本，跳过此检测
        if step_config.get("skip_injection_check"):
            return GuardResult(passed=True, action="pass", issues=[])

        _semantic_blocked = False
        try:
            from src.security import SemanticInjectionDetector

            _sem_detector = SemanticInjectionDetector()
            _sem_result = _sem_detector.detect(
                context[-2000:], context_type="user_input"
            )
            if _sem_result.is_injection:
                issues.append(
                    f"语义级注入检测 (confidence={_sem_result.confidence:.2f}, "
                    f"risk={_sem_result.risk_level}): "
                    + "; ".join(_sem_result.detected_patterns[:3])
                )
                logger.warning(
                    "GuardRails [%s]: 语义注入检测拦截 (confidence=%.2f): %s",
                    step_id,
                    _sem_result.confidence,
                    _sem_result.detected_patterns,
                )
                _semantic_blocked = True
        except ImportError:
            pass

        if not _semantic_blocked and _INJECTION_RE.search(context[-2000:]):
            issues.append("检测到可能的提示注入攻击模式（正则匹配）")
            logger.warning("GuardRails [%s]: 检测到注入攻击模式", step_id)
            _semantic_blocked = True

        if _semantic_blocked:
            return GuardResult(passed=False, action="block", issues=issues)

        # 3. 检查必需 artifacts（如果 step 声明了 required_artifacts）
        required_artifacts = step_config.get("required_artifacts", [])
        if required_artifacts:
            # 从 context 末尾检查关键数据区域
            for artifact in required_artifacts:
                if artifact not in context:
                    issues.append(f"必需的 artifact「{artifact}」在上下文中未找到")
            if issues:
                logger.warning(
                    "GuardRails [%s]: 缺少必需 artifacts: %s", step_id, issues
                )
                return GuardResult(passed=False, action="block", issues=issues)

        return GuardResult(passed=True, action="proceed")

    def post_check(
        self,
        step_id: str,
        output: str,
        step_config: dict,
    ) -> GuardResult:
        """执行后检查。

        检查项：
        1. 输出为空或为错误 → 阻止后续步骤
        2. 模型拒绝回答 → 警告
        3. 输出语言与要求不匹配 → 警告
        4. Markdown 结构严重损坏（控制字符） → 警告
        """
        issues = []

        # 1. 空输出或错误
        if not output or not output.strip():
            return GuardResult(
                passed=False,
                action="block",
                issues=["输出为空"],
            )
        if output.startswith("[ERROR]"):
            return GuardResult(
                passed=False,
                action="block",
                issues=[f"模型调用失败: {output[:200]}"],
            )

        # 2. 拒绝回答检测（只检查开头）
        head = output[:300]
        for marker in _REFUSAL_MARKERS:
            if marker in head:
                issues.append(f"模型可能拒绝回答（检测到标记：「{marker}」）")
                logger.warning("GuardRails [%s]: 检测到拒绝回答标记", step_id)
                return GuardResult(passed=True, action="warn", issues=issues)

        # 3. 语言检查（配置了 output_language: zh 时）
        expected_lang = step_config.get("output_language", "zh")
        if expected_lang == "zh":
            total = len(output)
            zh_count = sum(1 for c in output if "\u4e00" <= c <= "\u9fff")
            zh_ratio = zh_count / total if total > 0 else 0
            if total > 100 and zh_ratio < 0.05:
                issues.append(
                    f"要求中文输出，但中文占比仅 {zh_ratio:.1%}（可能输出了英文）"
                )
                return GuardResult(passed=True, action="warn", issues=issues)

        # 4. 控制字符检测（格式严重损坏）
        ctrl_count = sum(1 for c in output if ord(c) < 32 and c not in "\n\r\t")
        if ctrl_count > 10:
            issues.append(f"输出包含 {ctrl_count} 个控制字符，格式可能已损坏")
            return GuardResult(passed=True, action="warn", issues=issues)

        return GuardResult(passed=True, action="proceed")


def _semantic_extract_step(text: str, max_chars: int = 350) -> str:
    """从步骤输出中提取语义关键点（规则式，无需额外 LLM 调用）。

    优先级：标题行 > 含数字/金额/百分比的行 > 列表项
    """
    lines = text.splitlines()
    selected: list[str] = []
    seen: set[str] = set()
    char_count = 0

    # 第一轮：高优先级行（标题 + 含数据的行）
    for line in lines:
        s = line.strip()
        if not s:
            continue
        if s.startswith("#") or _DATA_LINE_RE.search(s):
            selected.append(s)
            seen.add(s)
            char_count += len(s)
            if char_count >= max_chars:
                break

    # 第二轮：列表项（若还有空间）
    if char_count < max_chars:
        for line in lines:
            s = line.strip()
            if not s or s in seen:
                continue
            if s[:2] in ("- ", "* ", "• ") or (
                len(s) > 2 and s[0].isdigit() and s[1] in ".、"
            ):
                selected.append(s)
                seen.add(s)
                char_count += len(s)
                if char_count >= max_chars:
                    break

    if not selected:
        return text[:max_chars].rstrip() + ("…" if len(text) > max_chars else "")

    return "\n".join(selected)


def _compress_context(context: str) -> str:
    """语义感知的上下文压缩：保留头部（需求+知识）和最后两个步骤，
    对丢弃的早期步骤生成结构化摘要而非直接删除。
    """
    SEP = "\n\n---\n\n"
    parts = context.split(SEP)
    if len(parts) <= 4:
        return context  # 太短，不压缩

    # 分离固定部分与步骤部分
    fixed_parts = []
    step_parts = []
    for p in parts:
        if (
            p.startswith("## 原始客户需求")
            or p.startswith("## 📋 产品知识库")
            or p.startswith("## 📚 相关文档")
            or p.startswith("## 💬 对话历史")
            or p.startswith("## [上下文窗口]")
            or p.startswith("## ⚠ 数据锚点")
            or p.startswith("## 🔑 关键数据")
        ):
            fixed_parts.append(p)
        else:
            step_parts.append(p)

    if len(step_parts) <= 2:
        return context  # 步骤数 ≤ 2，无需压缩

    # 对被丢弃的早期步骤做语义摘要（保留最后2步完整输出）
    dropped_steps = step_parts[:-2]
    kept_steps = step_parts[-2:]

    summary_lines: list[str] = []
    for part in dropped_steps:
        header_match = _STEP_HEADER_RE.match(part)
        agent_label = header_match.group(1) if header_match else "早期步骤"
        parts_split = part.split("\n", 1)
        body = parts_split[1] if len(parts_split) > 1 else part
        digest = _semantic_extract_step(body)
        summary_lines.append(f"**{agent_label}** | {digest}")

    digest_block = (
        f"## [语义摘要] 已压缩 {len(dropped_steps)} 个早期步骤（保留关键数据）\n"
        + "\n\n".join(summary_lines)
    )
    kept_steps.insert(0, digest_block)

    compressed = SEP.join(fixed_parts + kept_steps)
    logger.info(
        "GuardRails: 语义压缩 %d chars → %d chars (%.1f%%), 摘要了 %d 个早期步骤",
        len(context),
        len(compressed),
        len(compressed) / len(context) * 100,
        len(dropped_steps),
    )
    return compressed
