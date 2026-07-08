"""OutputLinter: 规则引擎校验 Agent 输出，Harness L6 约束/验证/恢复层。

generate → lint → fix 自愈循环的核心组件。
用规则（非LLM）在 Agent 输出后立即校验格式，不达标则生成修复提示让 Agent 重新生成。
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class LintIssue:
    """单条校验问题。"""
    rule_type: str
    message: str
    severity: str = "error"  # error / warning


@dataclass
class LintResult:
    """校验结果。"""
    passed: bool
    issues: list[LintIssue] = field(default_factory=list)

    @property
    def errors(self) -> list[LintIssue]:
        return [i for i in self.issues if i.severity == "error"]

    @property
    def warnings(self) -> list[LintIssue]:
        return [i for i in self.issues if i.severity == "warning"]


class OutputLinter:
    """基于规则的 Agent 输出校验器。

    支持的规则类型：
    - required_sections: 必须包含的章节标题
    - min_length / max_length: 输出字数范围
    - required_fields: 必须出现的关键字段/关键���
    - forbidden_patterns: 禁止出现的模式（如模糊表述、AI自称等）
    - format_regex: 自定义正则匹配
    - number_consistency: 数字引用必须与上下文 data_anchors 一致
    """

    def lint(self, output: str, rules: list[dict], context: str = "") -> LintResult:
        """执行所有规则校验。

        Args:
            output: Agent 的输出文本
            rules: 规则列表，每个规则是 dict，至少包含 type 字段
            context: 渲染后的上下文文本（用于 number_consistency 等规则）

        Returns:
            LintResult: 校验结果
        """
        if not rules:
            return LintResult(passed=True)

        issues: list[LintIssue] = []

        for rule in rules:
            rule_type = rule.get("type", "")
            rule_severity = rule.get("severity")  # None = 使用规则处理器的默认值
            checker = _RULE_HANDLERS.get(rule_type)
            if checker is None:
                logger.warning("未知的 lint 规则类型: %s，跳过", rule_type)
                continue
            rule_issues = checker(output, rule, context)
            for issue in rule_issues:
                # 规则配置的 severity 优先，否则保留处理器设置的默认值
                if rule_severity is not None:
                    issue.severity = rule_severity
                issues.append(issue)

        passed = not any(i.severity == "error" for i in issues)
        return LintResult(passed=passed, issues=issues)

    def build_fix_prompt(self, output: str, lint_result: LintResult) -> str:
        """根据 lint 错误生成修复提示，注入到重试的 user message 中。

        Args:
            output: 原始输出
            lint_result: 校验结果

        Returns:
            修复提示文本
        """
        if lint_result.passed:
            return ""

        error_lines = []
        for issue in lint_result.errors:
            error_lines.append(f"- [{issue.rule_type}] {issue.message}")

        warning_lines = []
        for issue in lint_result.warnings:
            warning_lines.append(f"- [{issue.rule_type}] {issue.message}")

        parts = ["你上一次输出未通过格式校验，请修正以下问题后重新输出完整内容：\n"]
        if error_lines:
            parts.append("### 必须修正（错误）：")
            parts.extend(error_lines)
        if warning_lines:
            parts.append("\n### 建议修正（警告）：")
            parts.extend(warning_lines)
        parts.append("\n请严格按要求重新输出，不要解释修改原因。")

        return "\n".join(parts)


# ─── 规则处理器 ──────────────────────────────────────────────


def _check_required_sections(output: str, rule: dict, _ctx: str) -> list[LintIssue]:
    """检查输出中是否包含所有必需的章节标题。"""
    sections = rule.get("sections", [])
    if not sections:
        return []

    issues = []
    for section in sections:
        # 匹配 markdown 标题或加粗标题（含中文序号前缀）
        CJK_NUM = r"[零一二三四五六七八九十百千]+"
        patterns = [
            rf"#+\s*{re.escape(section)}",                              # ## 客户画像
            rf"#+\s*\d+[\.\、]\s*.*{re.escape(section)}",               # ### 1. 客户画像
            rf"#+\s*{CJK_NUM}[\.\、]\s*.*{re.escape(section)}",         # ### 一、客户画像
            rf"\*\*{re.escape(section)}\*\*",                           # **客户画像**
            rf"^{re.escape(section)}\s*[:：]",                          # 客户画像：
            rf"^\d+[\.\、]\s*.*{re.escape(section)}",                   # 1. 客户画像
            rf"^{CJK_NUM}[\.\、]\s*.*{re.escape(section)}",             # 一、客户画像
            re.escape(section),                                         # 兜底：纯子串匹配
        ]
        found = any(re.search(p, output, re.MULTILINE) for p in patterns)
        if not found:
            issues.append(LintIssue(
                rule_type="required_sections",
                message=f"缺少必需章节「{section}」",
            ))
    return issues


def _check_min_length(output: str, rule: dict, _ctx: str) -> list[LintIssue]:
    """检查输出最小字数。"""
    min_chars = rule.get("chars", 0)
    if min_chars <= 0:
        return []

    # 去除空白字符后计算实际内容长度
    content_len = len(output.replace(" ", "").replace("\n", ""))
    if content_len < min_chars:
        return [LintIssue(
            rule_type="min_length",
            message=f"输出内容过短（{content_len}字），最少要求{min_chars}字",
        )]
    return []


def _check_max_length(output: str, rule: dict, _ctx: str) -> list[LintIssue]:
    """检查输出最大字数。"""
    max_chars = rule.get("chars", 0)
    if max_chars <= 0:
        return []

    content_len = len(output.replace(" ", "").replace("\n", ""))
    if content_len > max_chars:
        return [LintIssue(
            rule_type="max_length",
            message=f"输出内容过长（{content_len}字），最多允许{max_chars}字",
        )]
    return []


def _check_required_fields(output: str, rule: dict, _ctx: str) -> list[LintIssue]:
    """检查输出中是否包含所有必需的关键词/字段。"""
    fields = rule.get("fields", [])
    issues = []
    for f in fields:
        if f not in output:
            issues.append(LintIssue(
                rule_type="required_fields",
                message=f"输出缺少必需字段/关键词「{f}」",
            ))
    return issues


def _check_forbidden_patterns(output: str, rule: dict, _ctx: str) -> list[LintIssue]:
    """检查输出中是否包含禁止的模式。"""
    patterns = rule.get("patterns", [])
    issues = []
    for p in patterns:
        label = p if isinstance(p, str) else p.get("pattern", "")
        desc = p.get("description", label) if isinstance(p, dict) else label
        if re.search(label if isinstance(p, str) else p.get("pattern", ""), output):
            issues.append(LintIssue(
                rule_type="forbidden_patterns",
                message=f"输出包含禁止的模式：{desc}",
            ))
    return issues


def _check_format_regex(output: str, rule: dict, _ctx: str) -> list[LintIssue]:
    """检查输出是否匹配自定义正则。"""
    pattern = rule.get("pattern", "")
    if not pattern:
        return []

    must_match = rule.get("must_match", True)
    description = rule.get("description", pattern)
    found = bool(re.search(pattern, output, re.MULTILINE))

    if must_match and not found:
        return [LintIssue(
            rule_type="format_regex",
            message=f"输出未匹配要求的格式：{description}",
        )]
    if not must_match and found:
        return [LintIssue(
            rule_type="format_regex",
            message=f"输出不应包含的格式：{description}",
        )]
    return []


def _check_number_consistency(output: str, rule: dict, context: str) -> list[LintIssue]:
    """检查输出中的关键数字是否与上下文数据锚点一致。

    只检查上下文中出现的"数据锚点"区域的数字，看输出中是否引用了这些数字。
    """
    # 提取上下文中数据锚点区域
    anchor_section = ""
    anchor_marker = "数据锚点"
    idx = context.find(anchor_marker)
    if idx >= 0:
        anchor_section = context[idx:]

    if not anchor_section:
        return []  # 没有锚点数据，跳过

    # 提取锚点中的关键数字（带单位）
    number_pattern = re.compile(
        r'([\d.]+)\s*(?:[-~～至到]\s*[\d.]+\s*)?'
        r'(元/[Ww][Hh]|万元?|亿元?|元|%|次|℃|[Ww][Hh]|[Aa][Hh]|年|个?月|周)'
    )
    anchor_numbers = set()
    for m in number_pattern.finditer(anchor_section):
        anchor_numbers.add(m.group(1))

    if not anchor_numbers:
        return []

    # 检查输出中是否引用了锚点数字（宽松匹配：至少引用一半）
    output_numbers = set()
    for m in number_pattern.finditer(output):
        output_numbers.add(m.group(1))

    referenced = anchor_numbers & output_numbers
    if len(anchor_numbers) > 0 and len(referenced) == 0:
        return [LintIssue(
            rule_type="number_consistency",
            message="输出未引用任何数据锚点中的关键数字，可能存在数据编造风险",
            severity="warning",
        )]
    return []


def _check_not_empty(output: str, _rule: dict, _ctx: str) -> list[LintIssue]:
    """检查输出不为空。"""
    stripped = output.strip()
    if not stripped or stripped.startswith("[ERROR]"):
        return [LintIssue(
            rule_type="not_empty",
            message="输出为空或为错误信息",
        )]
    return []


def _check_no_refusal(output: str, _rule: dict, _ctx: str) -> list[LintIssue]:
    """检查模型是否拒绝回答。"""
    refusal_markers = [
        "作为AI", "作为一个AI", "我无法", "I cannot", "I'm sorry",
        "作为语言模型", "作为人工智能",
    ]
    for marker in refusal_markers:
        if marker in output[:200]:  # 只检查开头
            return [LintIssue(
                rule_type="no_refusal",
                message=f"模型可能拒绝回答（检测到「{marker}」）",
            )]
    return []


def _check_cell_params_consistency(output: str, _rule: dict, _ctx: str) -> list[LintIssue]:
    """校验 cell_engineer 输出中电芯参数的数学自洽性。

    提取输出文本中的关键参数，做三条数学校验：
    A. 容量×串×并×3.7V 与宣称系统能量偏差 >15% → error
    B. 系统能量/整包重量 与宣称电芯能量密度偏差 >20% → warning（提示系统级vs电芯级区别）
    C. 整包总重量 与 S×P×单体重量 偏差 >20% → warning（仅在能提取单体重量时）
    """
    issues: list[LintIssue] = []

    # ── 1 & 2. 优先从 "XS XP" / "XSxP" / "XS5P" 组合格式同时提取 S 和 P ──
    # 要求前面是非字母非数字（排除型号名如 INR21700-50S 中的 50S）
    s_val: float | None = None
    p_val: float = 1.0

    m = re.search(r'(?<![A-Za-z0-9\-])(\d{1,3})\s*[Ss串]\s*(\d{1,3})\s*[Pp并]', output)
    if m:
        s_val = float(m.group(1))
        p_val = float(m.group(2))
    else:
        # 独立提取串数：前面须为非字母非数字
        m = re.search(r'(?<![A-Za-z0-9\-])(\d{1,3})\s*[Ss串](?![A-Za-z0-9\-])', output)
        if m:
            s_val = float(m.group(1))
        # 独立提取并数：前面须为非字母非数字
        m = re.search(r'(?<![A-Za-z0-9\-])(\d{1,3})\s*[Pp并](?![A-Za-z0-9\-])', output)
        if m:
            p_val = float(m.group(1))

    # ── 3. 提取单体标称容量 Ah ───────────────────────────────
    ah_val: float | None = None
    m = re.search(r'([\d.]+)\s*[Aa][Hh]', output)
    if m:
        ah_val = float(m.group(1))

    # ── 4. 提取系统能量 Wh（文中第一个明确写 Wh 的数字）────
    wh_val: float | None = None
    m = re.search(r'([\d.]+)\s*[Ww][Hh](?!/)', output)
    if m:
        wh_val = float(m.group(1))

    # ── 5. 提取整包总重量（g 或 kg）─────────────────────────
    pack_g: float | None = None
    # 优先匹配 kg
    m = re.search(r'([\d.]+)\s*[Kk][Gg]', output)
    if m:
        pack_g = float(m.group(1)) * 1000.0
    else:
        # 匹配 g（数字后紧跟 g，排除 Wh/kg 等单位）
        m = re.search(r'([\d]{3,6})\s*[Gg](?![Hh/])', output)
        if m:
            pack_g = float(m.group(1))

    # ── 6. 提取宣称电芯能量密度 Wh/kg ───────────────────────
    claimed_density: float | None = None
    m = re.search(r'([\d.]+)\s*[Ww][Hh]\s*/\s*[Kk][Gg]', output)
    if m:
        claimed_density = float(m.group(1))

    # ── 7. 提取单体重量 g（用于校验 C）──────────────────────
    cell_g: float | None = None
    # 形如 "78g" / "约78g" / "单体重量78g" / "70 g"，排除整包重量行
    for pat in [
        r'单体[重质量]*\s*[约≈]?\s*([\d.]+)\s*[Gg](?![Hh/])',
        r'[约≈]?\s*([\d.]+)\s*[Gg](?![Hh/])\s*/\s*(?:cell|颗|个)',
        r'(?:cell|电芯)\s*[重量质]*\s*[约≈]?\s*([\d.]+)\s*[Gg](?![Hh/])',
    ]:
        m = re.search(pat, output)
        if m:
            cell_g = float(m.group(1))
            break

    # ── 校验 A：容量×S×P×3.7 与宣称系统能量 ────────────────
    if s_val is not None and ah_val is not None and wh_val is not None:
        calc_wh = ah_val * s_val * p_val * 3.7
        if calc_wh > 0:
            deviation_a = abs(calc_wh - wh_val) / calc_wh
            if deviation_a > 0.15:
                issues.append(LintIssue(
                    rule_type="cell_params_consistency",
                    message=(
                        f"[校验A] 系统能量数据矛盾：按 {ah_val}Ah × {int(s_val)}S × {int(p_val)}P × 3.7V "
                        f"= {calc_wh:.0f}Wh，但文中宣称 {wh_val:.0f}Wh，"
                        f"偏差 {deviation_a * 100:.1f}%（阈值15%）。请核查容量/串并方案/能量数值。"
                    ),
                    severity="error",
                ))

    # ── 校验 B：系统能量/整包重量 与宣称电芯能量密度 ────────
    if wh_val is not None and pack_g is not None and claimed_density is not None:
        if pack_g > 0:
            system_density = wh_val / (pack_g / 1000.0)
            deviation_b = abs(system_density - claimed_density) / claimed_density
            if deviation_b > 0.20:
                issues.append(LintIssue(
                    rule_type="cell_params_consistency",
                    message=(
                        f"[校验B] 注意：电芯能量密度(Wh/kg)按系统能量/整包重量计算，"
                        f"这是系统级别（{system_density:.0f} Wh/kg），通常低于电芯级别。"
                        f"文中宣称 {claimed_density:.0f} Wh/kg，偏差 {deviation_b * 100:.1f}%（阈值20%）。"
                        "请确认你表述的是电芯级别还是系统级别的数据。"
                    ),
                    severity="warning",
                ))

    # ── 校验 C：整包总重量 与 S×P×单体重量 ─────────────────
    if s_val is not None and cell_g is not None and pack_g is not None:
        if cell_g > 0:
            calc_pack_g = s_val * p_val * cell_g
            deviation_c = abs(calc_pack_g - pack_g) / calc_pack_g
            if deviation_c > 0.20:
                issues.append(LintIssue(
                    rule_type="cell_params_consistency",
                    message=(
                        f"[校验C] 整包重量存疑：{int(s_val)}S × {int(p_val)}P × {cell_g:.0f}g/cell "
                        f"= {calc_pack_g:.0f}g（纯电芯），但文中整包总重量为 {pack_g:.0f}g，"
                        f"偏差 {deviation_c * 100:.1f}%（阈值20%）。请确认整包重量是否包含结构件BOM。"
                    ),
                    severity="warning",
                ))

    return issues


# ─── 规则注册表 ──────────────────────────────────────────────

_RULE_HANDLERS = {
    "required_sections": _check_required_sections,
    "min_length": _check_min_length,
    "max_length": _check_max_length,
    "required_fields": _check_required_fields,
    "forbidden_patterns": _check_forbidden_patterns,
    "format_regex": _check_format_regex,
    "number_consistency": _check_number_consistency,
    "not_empty": _check_not_empty,
    "no_refusal": _check_no_refusal,
    "cell_params_consistency": _check_cell_params_consistency,
}
