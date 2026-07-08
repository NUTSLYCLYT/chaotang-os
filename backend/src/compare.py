"""质量对比引擎 —— 判断变好还是变坏"""

from __future__ import annotations

from typing import Optional

from src.quality import QUALITY_DIMENSIONS, QualityScore, ScoreDiff
from src.step_log import RunLog


def compare_quality(left: RunLog, right: RunLog) -> ScoreDiff:
    """对比两次运行的质量"""

    left_score = _extract_quality_score(left)
    right_score = _extract_quality_score(right)

    if not left_score or not right_score:
        return ScoreDiff(
            left_run_id=left.run_id,
            right_run_id=right.run_id,
            analysis="无法对比：缺少质量评分数据",
        )

    # 计算各维度差异
    diffs = {}
    for dim in QUALITY_DIMENSIONS:
        left_val = left_score.scores.get(dim.name, 0)
        right_val = right_score.scores.get(dim.name, 0)
        diffs[dim.name] = round(right_val - left_val, 1)

    total_diff = round(right_score.total_score - left_score.total_score, 2)

    # 判断winner
    winner = None
    if total_diff > 0.5:
        winner = right.run_id
    elif total_diff < -0.5:
        winner = left.run_id

    # 生成分析文本
    analysis = _generate_analysis(
        left.run_id, right.run_id, left_score, right_score, diffs, winner
    )

    return ScoreDiff(
        left_run_id=left.run_id,
        right_run_id=right.run_id,
        score_diffs=diffs,
        total_diff=total_diff,
        winner=winner,
        analysis=analysis,
    )


def _extract_quality_score(run: RunLog) -> Optional[QualityScore]:
    """从RunLog中提取质量评分"""
    if not run.qa_result:
        return None

    qs_data = run.qa_result.get("quality_score")
    if not qs_data:
        return None

    return QualityScore.from_dict(qs_data)


def _generate_analysis(
    left_run_id: str,
    right_run_id: str,
    left_score: QualityScore,
    right_score: QualityScore,
    diffs: dict,
    winner: Optional[str],
) -> str:
    """生成对比分析文本"""
    parts = []

    # 总体变化
    if winner == right_run_id:
        parts.append(
            f"右侧运行质量更优（总分提升 {abs(right_score.total_score - left_score.total_score):.1f} 分）"
        )
    elif winner == left_run_id:
        parts.append(
            f"左侧运行质量更优（总分领先 {abs(left_score.total_score - right_score.total_score):.1f} 分）"
        )
    elif abs(right_score.total_score - left_score.total_score) < 0.3:
        parts.append("两次运行质量相当")
    else:
        parts.append(
            f"左侧运行质量略优（总分领先 {abs(left_score.total_score - right_score.total_score):.1f} 分）"
        )

    # 具体维度变化
    improved = [k for k, v in diffs.items() if v >= 1]
    degraded = [k for k, v in diffs.items() if v <= -1]

    if improved:
        parts.append(f"提升维度：{', '.join(improved)}")
    if degraded:
        parts.append(f"下降维度：{', '.join(degraded)}")

    # 建议
    if right_score.improvement_suggestions:
        parts.append(f"有 {len(right_score.improvement_suggestions)} 条改进建议待处理")

    return "；".join(parts)


def analyze_optimization_opportunity(run: RunLog) -> dict:
    """分析单次运行的优化机会"""
    if not run.qa_result:
        return {"has_data": False, "message": "无QA数据，无法分析"}

    qs_data = run.qa_result.get("quality_score")
    if not qs_data:
        return {"has_data": False, "message": "无质量评分数据"}

    score = QualityScore.from_dict(qs_data)

    # 找出最低分项
    sorted_scores = sorted(score.scores.items(), key=lambda x: x[1])
    weakest_dims = [name for name, s in sorted_scores if s < 3]

    # 按target_step分组建议
    suggestions_by_step = {}
    for sug in score.improvement_suggestions:
        step = sug.get("target_step", "unknown")
        if step not in suggestions_by_step:
            suggestions_by_step[step] = []
        suggestions_by_step[step].append(sug)

    # 触发阈值检测
    # 核心维度：完整性、逻辑一致性、需求匹配度
    core_dimensions = ["完整性", "逻辑一致性", "需求匹配度"]
    core_scores = [score.scores.get(d, 0) for d in core_dimensions]
    min_core_score = min(core_scores) if core_scores else 0

    # 触发条件：任一核心维度 < 3 或 平均分 < 3.5
    needs_optimization = min_core_score < 3 or score.total_score < 3.5

    return {
        "has_data": True,
        "run_id": run.run_id,
        "grade": score.grade,
        "total_score": score.total_score,
        "scores": score.scores,
        "weakest_dimensions": weakest_dims,
        "weakest_fields": score.weakest_fields,
        "improvement_targets": score.improvement_targets,
        "issues_count": len(score.issues),
        "suggestions_count": len(score.improvement_suggestions),
        "suggestions_by_step": suggestions_by_step,
        "overall_comment": score.overall_comment,
        # 触发阈值相关信息
        "needs_optimization": needs_optimization,
        "trigger_reason": _get_trigger_reason(
            min_core_score, score.total_score, core_dimensions, score.scores
        ),
        "core_dimensions": {
            "dimensions": core_dimensions,
            "scores": {d: score.scores.get(d, 0) for d in core_dimensions},
            "min_score": min_core_score,
        },
    }


def _get_trigger_reason(
    min_core_score: float, total_score: float, core_dims: list, all_scores: dict
) -> str:
    """生成触发优化原因说明"""
    reasons = []

    if min_core_score < 3:
        # 找出哪个核心维度低于3分
        low_cores = [d for d in core_dims if all_scores.get(d, 0) < 3]
        reasons.append(f"核心维度低于3分: {', '.join(low_cores)}")

    if total_score < 3.5:
        reasons.append(f"总平均分低于3.5 (当前: {total_score:.2f})")

    return "; ".join(reasons) if reasons else "质量良好，无需优化"
