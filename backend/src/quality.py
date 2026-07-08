"""质量评估核心模块 —— 定义评分维度和评估逻辑"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class QualityDimension:
    """评分维度定义"""

    name: str  # 维度名称
    description: str  # 维度说明
    weight: float = 1.0  # 权重
    max_score: int = 5  # 满分


# 新能源/锂电储能行业解决方案的6维评分体系
QUALITY_DIMENSIONS = [
    QualityDimension(
        name="完整性", description="7个输出字段是否齐全，内容是否充实无遗漏", weight=1.2
    ),
    QualityDimension(
        name="逻辑一致性", description="各字段之间逻辑自洽，无矛盾", weight=1.0
    ),
    QualityDimension(
        name="需求匹配度",
        description="输出是否准确回应客户原始需求",
        weight=1.5,  # 最高权重
    ),
    QualityDimension(
        name="信息密度", description="内容有价值，无废话，信息充实", weight=1.0
    ),
    QualityDimension(
        name="行业专业性", description="术语使用准确，技术深度符合行业标准", weight=1.3
    ),
    QualityDimension(
        name="可执行性", description="建议具体可落地，有明确行动指引", weight=1.0
    ),
]


@dataclass
class QualityScore:
    """单次运行的质量评分结果"""

    # 各维度得分 (0-5)
    scores: Dict[str, int] = field(default_factory=dict)

    # 问题列表（v2: List[str], v3: List[Dict] 结构化）
    issues: List = field(default_factory=list)

    # 改进建议（关键！）
    improvement_suggestions: List[Dict] = field(default_factory=list)

    # 最弱字段（v3 新增）
    weakest_fields: List[str] = field(default_factory=list)

    # 优化目标Agent（v3 新增）
    improvement_targets: List[Dict] = field(default_factory=list)

    # 总体评价
    overall_comment: str = ""

    # 计算总分 (加权平均)
    @property
    def total_score(self) -> float:
        total_weight = sum(d.weight for d in QUALITY_DIMENSIONS)
        weighted_sum = sum(
            self.scores.get(d.name, 0) * d.weight for d in QUALITY_DIMENSIONS
        )
        return round(weighted_sum / total_weight, 2)

    # 质量等级
    @property
    def grade(self) -> str:
        score = self.total_score
        if score >= 4.5:
            return "A+"
        if score >= 4.0:
            return "A"
        if score >= 3.5:
            return "B+"
        if score >= 3.0:
            return "B"
        if score >= 2.0:
            return "C"
        return "D"

    def to_dict(self) -> dict:
        result = {
            "scores": self.scores,
            "total_score": self.total_score,
            "grade": self.grade,
            "issues": self.issues,
            "improvement_suggestions": self.improvement_suggestions,
            "overall_comment": self.overall_comment,
        }
        if self.weakest_fields:
            result["weakest_fields"] = self.weakest_fields
        if self.improvement_targets:
            result["improvement_targets"] = self.improvement_targets
        return result

    @classmethod
    def from_dict(cls, data: dict) -> "QualityScore":
        """从字典创建QualityScore"""
        return cls(
            scores=data.get("scores", {}),
            issues=data.get("issues", []),
            improvement_suggestions=data.get("improvement_suggestions", []),
            weakest_fields=data.get("weakest_fields", []),
            improvement_targets=data.get("improvement_targets", []),
            overall_comment=data.get("overall_comment", ""),
        )


@dataclass
class ScoreDiff:
    """两次运行的评分对比"""

    left_run_id: str
    right_run_id: str
    score_diffs: Dict[str, float] = field(default_factory=dict)  # 各维度变化
    total_diff: float = 0.0
    winner: Optional[str] = None  # 哪个run更好
    analysis: str = ""  # 变化分析

    def to_dict(self) -> dict:
        return {
            "left_run_id": self.left_run_id,
            "right_run_id": self.right_run_id,
            "score_diffs": self.score_diffs,
            "total_diff": self.total_diff,
            "winner": self.winner,
            "analysis": self.analysis,
        }
