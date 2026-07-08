"""输出结构定义与校验。"""

from __future__ import annotations

from typing import Dict, List, Tuple

OUTPUT_FIELDS = [
    "客户背景",
    "核心需求",
    "市场分析",
    "竞品情况",
    "解决方案",
    "客户价值",
    "风险与建议",
]

# 质量评分维度定义
QUALITY_DIMENSIONS = [
    "完整性",
    "逻辑一致性",
    "需求匹配度",
    "信息密度",
    "行业专业性",
    "可执行性",
]


def validate_output(
    data: dict, fields: list[str] | None = None
) -> tuple[bool, list[str]]:
    """校验输出是否包含全部指定字段且非空。

    Args:
        data: 待校验的输出字典。
        fields: 期望的字段列表。默认使用 OUTPUT_FIELDS（OPC 7 字段）。

    Returns:
        (is_valid, issues) — is_valid 为 True 时 issues 为空列表。
    """
    issues: list[str] = []

    if not isinstance(data, dict):
        return False, ["输出不是字典类型"]

    check_fields = fields if fields is not None else OUTPUT_FIELDS
    for field in check_fields:
        if field not in data:
            issues.append(f"缺少字段: {field}")
        elif not data[field] or not str(data[field]).strip():
            issues.append(f"字段为空: {field}")

    return (len(issues) == 0, issues)


def validate_quality_score(data: dict) -> Tuple[bool, List[str]]:
    """校验质量评分结构是否完整。

    Returns:
        (is_valid, issues)
    """
    issues: List[str] = []

    if not isinstance(data, dict):
        return False, ["quality_score 不是字典类型"]

    # 检查必需字段
    if "scores" not in data:
        issues.append("缺少 scores 字段")
    else:
        scores = data["scores"]
        # 检查各维度是否都有评分
        for dim in QUALITY_DIMENSIONS:
            if dim not in scores:
                issues.append(f"缺少维度评分: {dim}")
            elif not isinstance(scores[dim], (int, float)):
                issues.append(f"维度评分类型错误: {dim}")
            elif not 0 <= scores[dim] <= 5:
                issues.append(f"维度评分超出范围 [0-5]: {dim}={scores[dim]}")

    # 可选字段检查（兼容 v2 字符串列表和 v3 结构化对象列表）
    if "issues" in data and not isinstance(data["issues"], list):
        issues.append("issues 字段类型错误，应为列表")

    if "improvement_suggestions" in data:
        if not isinstance(data["improvement_suggestions"], list):
            issues.append("improvement_suggestions 字段类型错误，应为列表")
        else:
            for i, sug in enumerate(data["improvement_suggestions"]):
                if not isinstance(sug, dict):
                    issues.append(f"改进建议[{i}] 不是字典类型")
                elif "target_step" not in sug:
                    issues.append(f"改进建议[{i}] 缺少 target_step")
                elif "suggestion" not in sug:
                    issues.append(f"改进建议[{i}] 缺少 suggestion")

    return (len(issues) == 0, issues)


def calculate_total_score(scores: Dict[str, float]) -> float:
    """计算加权总分。

    权重配置：
    - 完整性: 1.2
    - 逻辑一致性: 1.0
    - 需求匹配度: 1.5 (最高)
    - 信息密度: 1.0
    - 行业专业性: 1.3
    - 可执行性: 1.0
    """
    # 修复(铁律2 SSOT 漂移):此前权重表只认 OPC 旧维度名(完整性/逻辑一致性/信息密度/行业专业性),
    # 而动态 QA prompt(非OPC蜂群)吐的是 结构完整性/数据一致性/风险识别质量——名字对不上 → 这些维度
    # 被 scores.get(dim,0) 当 0 算 + 仍除以全权重,总分被腰斩(libu 分项 4-5 却算出 1.64)。
    # 改为只对「实际出现的维度」加权平均,兼容两套命名;未来新维度默认权重 1.0,不再静默归零。
    weights = {
        # OPC/产品旧命名
        "完整性": 1.2,
        "逻辑一致性": 1.0,
        "信息密度": 1.0,
        "行业专业性": 1.3,
        # 动态 QA prompt 命名(非OPC蜂群)
        "结构完整性": 1.2,
        "数据一致性": 1.0,
        "风险识别质量": 1.0,
        # 两套共用
        "需求匹配度": 1.5,
        "可执行性": 1.0,
    }

    present = {d: s for d, s in scores.items() if isinstance(s, (int, float))}
    if not present:
        return 0.0
    total_weight = sum(weights.get(d, 1.0) for d in present)
    weighted_sum = sum(s * weights.get(d, 1.0) for d, s in present.items())
    return round(weighted_sum / total_weight, 2) if total_weight else 0.0


def get_grade(total_score: float) -> str:
    """根据总分获取质量等级。"""
    if total_score >= 4.5:
        return "A+"
    if total_score >= 4.0:
        return "A"
    if total_score >= 3.5:
        return "B+"
    if total_score >= 3.0:
        return "B"
    if total_score >= 2.0:
        return "C"
    return "D"
