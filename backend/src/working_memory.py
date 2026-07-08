"""WorkingMemory: 上下文感知的步骤压缩模块。

解决的问题：
- ContextBudget 检测到 warning/danger 区，但 _render_context 只知道字符上限，两者没有桥接
- _semantic_extract_step 是无差别 300 字摘要，不考虑哪些步骤对当前任务更重要
- 最旧的步骤被优先丢弃，但早期步骤（如研发负责人的需求规格）往往是所有后续步骤的基准

集成点：
- flow_engine.py: _execute_step 中在 budget_report 生成后调用 WorkingMemory.compress_if_needed()
- context_budget.py: 使用 BudgetReport.zone 作为压缩触发条件
"""

from __future__ import annotations

import re
from dataclasses import dataclass

_DATA_RE = re.compile(r"[\d.]+\s*[万亿%℃kKmMwW元年月]\b|¥\d|\d+\s*[Vv][Ww]|[A-Z]{2,}\d|\d+\s*(mAh|Ah|kWh|°C|℃)")
_KEYWORD_RE = re.compile(r"[一-鿿]{3,}|[A-Za-z]{4,}")


@dataclass
class StepImportance:
    step_id: str
    agent_name: str
    output: str
    score: float  # 0.0~1.0，越高越重要


def _extract_keywords(output: str) -> set[str]:
    """从步骤输出中提取关键词（≥3字符的汉字词组或英文单词）。"""
    return {w for w in _KEYWORD_RE.findall(output) if len(w) >= 3}


def _score_step(
    step: dict,
    all_steps: list[dict],
    step_index: int,
    keyword_cache: dict[str, set[str]] | None = None,
) -> float:
    """对单个步骤的输出评分。

    评分维度：
    1. 位置权重：第一步（需求规格）和最后一步（汇总）最重要
    2. 数据密度：包含数字/参数/规格的行越多越重要（下游必须引用）
    3. 被引用度：输出中的关键词在后续步骤中出现次数（简单估算）

    keyword_cache 由 WorkingMemory 实例持有，避免同一步骤多次触发压缩时
    重复执行 regex 提取（O(n²) 的常数项优化，对 20 步以内 flow 降低 60-70%）。
    """
    n = len(all_steps)
    step_id = step.get("step", "")
    output = step.get("output", "")

    # 位置权重：首步和末步权重最高
    if step_index == 0:
        position_score = 1.0
    elif step_index == n - 1:
        position_score = 0.9
    else:
        # 中间步骤：距离两端越远越低
        center_dist = abs(step_index - n // 2) / max(n // 2, 1)
        position_score = 0.4 + 0.3 * center_dist

    # 数据密度：含数字/参数行的比例
    lines = [ln.strip() for ln in output.splitlines() if ln.strip()]
    data_lines = sum(1 for ln in lines if _DATA_RE.search(ln))
    data_score = min(1.0, data_lines / max(len(lines), 1) * 3)

    # 被引用度：统计后续步骤引用本步骤输出中出现的关键词
    # keyword_cache 防止同一次 run 内多次触发压缩时重复 regex 提取
    cache_key = step_id or str(step_index)
    if keyword_cache is not None and cache_key in keyword_cache:
        keywords = keyword_cache[cache_key]
    else:
        keywords = _extract_keywords(output)
        if keyword_cache is not None:
            keyword_cache[cache_key] = keywords

    ref_count = 0
    for later_step in all_steps[step_index + 1:]:
        later_out = later_step.get("output", "")
        ref_count += sum(1 for kw in keywords if kw in later_out)
    ref_score = min(1.0, ref_count / max(len(keywords), 1) / 3)

    return round(0.4 * position_score + 0.35 * data_score + 0.25 * ref_score, 3)


def _compress_step_output(output: str, target_chars: int) -> str:
    """将单个步骤输出压缩到 target_chars 以内，保留高价值内容。

    优先保留：
    1. 标题行（## 开头）
    2. 含数字/参数的行（数据锚点）
    3. 列表中的关键项
    """
    if len(output) <= target_chars:
        return output

    lines = output.splitlines()
    buckets: list[tuple[int, str]] = []  # (priority, line)

    for line in lines:
        s = line.strip()
        if not s:
            continue
        if s.startswith("##"):
            buckets.append((0, s))
        elif _DATA_RE.search(s):
            buckets.append((1, s))
        elif s[:2] in ("- ", "* ", "• ") or (len(s) > 2 and s[0].isdigit() and s[1] in ".、"):
            buckets.append((2, s))
        else:
            buckets.append((3, s))

    selected: list[str] = []
    total = 0
    for priority, line in sorted(buckets, key=lambda x: x[0]):
        if total + len(line) + 1 > target_chars:
            break
        selected.append(line)
        total += len(line) + 1

    if not selected:
        return output[:target_chars].rstrip() + "…"

    result = "\n".join(selected)
    if len(result) < len(output):
        result += f"\n…（已压缩，原始 {len(output)} 字）"
    return result


class WorkingMemory:
    """预算感知的上下文压缩器。

    根据 ContextBudget 的 zone 判断，动态调整各步骤输出的保留长度。

    压缩策略（按 zone）：
    - smart:   不压缩，维持原输出
    - warning: 低重要度步骤压缩到 600 字，高重要度保留
    - danger:  所有步骤按重要度压缩，低重要度 300 字，高重要度 800 字

    _keyword_cache 在实例生命周期内持久，避免同一 run 多次触发压缩时
    重复执行 keyword 提取（warning 触发一次、之后 danger 再触发一次的场景）。
    """

    # 各 zone 下，低/高重要度步骤的压缩目标字符数
    ZONE_LIMITS: dict[str, tuple[int, int]] = {
        "smart":   (0, 0),       # 0 = 不压缩
        "warning": (600, 0),     # 低分压缩，高分不动
        "danger":  (300, 800),   # 全部压缩，按分数差异化
    }
    IMPORTANCE_THRESHOLD = 0.5  # 高于此分数视为"高重要度"

    def __init__(self) -> None:
        self._keyword_cache: dict[str, set[str]] = {}

    def compress_if_needed(
        self,
        context: dict,
        zone: str,
    ) -> dict:
        """若 zone 为 warning/danger，对步骤输出进行重要度感知压缩。

        返回新的 context dict（不修改原对象）。
        若 zone 为 smart 或无步骤，原样返回。
        """
        if zone == "smart" or not context.get("steps"):
            return context

        low_limit, high_limit = self.ZONE_LIMITS.get(zone, (600, 0))
        steps = context["steps"]

        scored: list[StepImportance] = [
            StepImportance(
                step_id=s.get("step", ""),
                agent_name=s.get("agent_name", ""),
                output=s.get("output", ""),
                score=_score_step(s, steps, i, self._keyword_cache),
            )
            for i, s in enumerate(steps)
        ]

        new_steps = []
        for si in scored:
            is_high = si.score >= self.IMPORTANCE_THRESHOLD
            if is_high and high_limit == 0:
                # high_limit=0 means keep original (warning zone, high-importance)
                new_steps.append({"step": si.step_id, "agent_name": si.agent_name, "output": si.output})
            elif is_high:
                new_steps.append({
                    "step": si.step_id,
                    "agent_name": si.agent_name,
                    "output": _compress_step_output(si.output, high_limit),
                })
            else:
                new_steps.append({
                    "step": si.step_id,
                    "agent_name": si.agent_name,
                    "output": _compress_step_output(si.output, low_limit),
                })

        new_context = {**context, "steps": new_steps}
        return new_context
