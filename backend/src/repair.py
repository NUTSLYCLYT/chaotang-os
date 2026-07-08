"""QA 驱动的自动修复循环：定位问题 → 生成修复指令 → 局部重跑 → 评估改善。"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Callable

import yaml

from src.model_adapter import BudgetExceeded
from src.schema import calculate_total_score
from src.step_log import RunLog

# ---------------------------------------------------------------------------
# 持久化目录
# ---------------------------------------------------------------------------
REPAIRS_DIR = Path(__file__).resolve().parent.parent / "repairs"

# ---------------------------------------------------------------------------
# 默认维度 → 责任步骤 映射表（OPC，向后兼容）
# ---------------------------------------------------------------------------
_DEFAULT_DIMENSION_STEP_MAP: dict[str, list[str]] = {
    "完整性": ["qa_tech_support", "opc_leader"],
    "逻辑一致性": ["solution_architect", "opc_leader"],
    "需求匹配度": ["opc_leader"],
    "信息密度": ["market_intel", "solution_architect"],
    "行业专业性": ["market_intel", "solution_architect"],
    "可执行性": ["customer_success", "solution_architect"],
}

_DEFAULT_STEP_INDEX_MAP: dict[str, int] = {
    "opc_leader": 0,
    "market_intel": 1,
    "solution_architect": 2,
    "customer_success": 3,
    "qa_tech_support": 4,
}

_NON_RERUNABLE_STEPS = {"qa_tech_support"}


def build_step_index_map(step_configs: list[dict]) -> dict[str, int]:
    """从 flow 配置的 steps 列表构建 step_id → index 映射。"""
    return {sc["id"]: i for i, sc in enumerate(step_configs)}


# ---------------------------------------------------------------------------
# 维度 → agent 角色关键词表（覆盖全部 14 个生产蜂群的中文/英文步骤名）
#
# 历史 bug：旧版关键词仅含通用词（经理/架构/竞品/客户），领域蜂群的中文 agent 名
# （电芯/失效/现金流/合同/供应商/方案/中书/六部 …）全部落空 → fallback 永远命中
# non_qa_steps[0]，导致 repair 反复重跑错误的第一步。下表按维度性质归类角色关键词，
# 配合 build_dimension_step_map 的位置兜底，确保任何蜂群都能正确归因。
# ---------------------------------------------------------------------------
_DIM_KEYWORDS: dict[str, list[str]] = {
    "完整性": [
        "负责人",
        "经理",
        "leader",
        "manager",
        "汇总",
        "摘要",
        "整合",
        "synthe",
        "summary",
        "调度",
        "dispatch",
        "协调",
        "intake",
        "归档",
        "curator",
        "太子",
        "尚书",
        "决策官",
        "gate",
    ],
    "逻辑一致性": [
        "架构",
        "规划",
        "architect",
        "planning",
        "方案",
        "solution",
        "清洗",
        "normaliz",
        "检查",
        "checker",
        "一致",
        "失效",
        "failure",
        "中书",
        "复核",
        "评审",
        "门控",
        "feasibility",
        "仲裁",
        "resolver",
    ],
    "需求匹配度": [
        "负责人",
        "经理",
        "leader",
        "manager",
        "需求",
        "requirement",
        "调度",
        "dispatch",
        "intake",
        "太子",
        "项目",
        "想法",
        "analyst",
        "分析师",
    ],
    "信息密度": [
        "情报",
        "竞品",
        "研究",
        "intel",
        "research",
        "采集",
        "collector",
        "参数",
        "现金流",
        "cashflow",
        "庄园",
        "监测",
        "monitor",
        "openclaw",
        "检索",
        "searcher",
        "询价",
        "inquir",
    ],
    "行业专业性": [
        "情报",
        "竞品",
        "研究",
        "intel",
        "research",
        "架构",
        "工程",
        "engineer",
        "电芯",
        "cell",
        "bms",
        "技术",
        "tech",
        "财务",
        "finance",
        "法务",
        "legal",
        "合同",
        "contract",
        "合规",
        "compliance",
        "制造",
        "manufactur",
        "评审",
        "review",
        "热设计",
        "可靠性",
        "spec",
        "供应",
        "supply",
        "supplier",
    ],
    "可执行性": [
        "客户",
        "成功",
        "触达",
        "outreach",
        "执行",
        "execute",
        "落地",
        "商务",
        "commercial",
        "策略",
        "strategy",
        "发布",
        "publish",
        "六部",
        "liubu",
        "代码",
        "code",
        "测试",
        "tester",
        "成本",
        "cost",
        "运维",
        "质疑",
        "critic",
        "安全",
        "security",
    ],
}


def build_dimension_step_map(step_configs: list[dict]) -> dict[str, list[str]]:
    """根据 flow 步骤自动构建维度→步骤映射（稳健版）。

    两层策略：
      1. **关键词匹配（高精度）**：用 _DIM_KEYWORDS 覆盖全库 14 蜂群的角色名。
      2. **位置兜底（高召回，永不塌缩到 step0）**：关键词全落空时，按维度性质
         从 early/mid/late 三段桶取步骤，而非把所有未匹配维度都指向第一步。

    匹配同时看 name + id（小写），兼容只配 id 不配中文 name 的步骤。
    """
    non_qa_steps = [sc for sc in step_configs if sc["id"] not in _NON_RERUNABLE_STEPS]
    if not non_qa_steps:
        return {dim: [] for dim in _DIM_KEYWORDS}

    dim_map: dict[str, list[str]] = {}

    # ── 第1层：关键词匹配 ──
    for dim, keywords in _DIM_KEYWORDS.items():
        candidates: list[str] = []
        for sc in non_qa_steps:
            haystack = (sc.get("name", "") + " " + sc.get("id", "")).lower()
            if any(kw in haystack for kw in keywords):
                candidates.append(sc["id"])
            if len(candidates) >= 2:
                break
        dim_map[dim] = candidates

    # ── 第2层：位置兜底（按 early/mid/late 分桶，避免全部命中 step0）──
    ids = [sc["id"] for sc in non_qa_steps]
    n = len(ids)
    early = ids[: max(1, n // 3)]  # 接入/统筹层
    mid = ids[max(1, n // 3) : max(2, 2 * n // 3)] or ids  # 研究/分析层
    late = ids[max(2, 2 * n // 3) :] or ids[-1:]  # 执行/汇总层
    positional = {
        "完整性": late + early,  # 字段齐全 → 汇总 + 统筹
        "逻辑一致性": late + mid,  # 数字自洽 → 汇总/仲裁 + 分析
        "需求匹配度": early,  # 对题 → 接入/统筹
        "信息密度": mid,  # 有料 → 研究/采集
        "行业专业性": mid + late,  # 专业 → 专家 + 汇总
        "可执行性": late,  # 可落地 → 执行/汇总
    }
    for dim in _DIM_KEYWORDS:
        if dim_map.get(dim):
            continue
        picked: list[str] = []
        seen: set[str] = set()
        for sid in positional.get(dim) or ids:
            if sid not in seen:
                seen.add(sid)
                picked.append(sid)
            if len(picked) >= 2:
                break
        dim_map[dim] = picked

    return dim_map


def _load_step_configs_from_run(run_log: RunLog) -> list[dict]:
    """从 run_meta.json 加载 flow 配置中的 step_configs。"""
    config_path = run_log.config_path
    if not config_path:
        from src.step_log import load_run

        persisted_run = load_run(run_log.run_id)
        config_path = persisted_run.config_path if persisted_run else None
    if not config_path:
        return []

    project_root = Path(__file__).resolve().parent.parent
    path = Path(config_path)
    if not path.is_absolute():
        path = project_root / path
    if not path.exists():
        return []
    config = yaml.safe_load(path.read_text(encoding="utf-8"))
    return config.get("steps", [])


def _get_maps_for_run(run_log: RunLog) -> tuple[dict[str, int], dict[str, list[str]]]:
    """获取 run 对应的 step_index_map 和 dimension_step_map。"""
    step_configs = _load_step_configs_from_run(run_log)
    if step_configs:
        step_index_map = build_step_index_map(step_configs)
        dim_step_map = build_dimension_step_map(step_configs)
    else:
        step_index_map = _DEFAULT_STEP_INDEX_MAP
        dim_step_map = _DEFAULT_DIMENSION_STEP_MAP
    return step_index_map, dim_step_map


# 向后兼容：模块级变量（OPC 默认值）
DIMENSION_STEP_MAP = _DEFAULT_DIMENSION_STEP_MAP
STEP_INDEX_MAP = _DEFAULT_STEP_INDEX_MAP


# ---------------------------------------------------------------------------
# 数据结构
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class RepairInstruction:
    """单条结构化修复指令，指向一个具体 step。"""

    target_step: str  # step_id
    failure_dimensions: tuple[str, ...]  # 触发修复的 QA 维度
    symptoms: tuple[str, ...]  # 具体问题（从 QA issues 提取）
    repair_goals: tuple[str, ...]  # 修复目标
    constraints: tuple[str, ...]  # 保护已有高分内容的约束
    source: str = "merged"  # "deterministic" | "qa_attributed" | "merged"
    # 预留：未来工具层
    evidence: tuple[dict, ...] | None = None
    artifacts: tuple[dict, ...] | None = None


@dataclass
class RepairRound:
    """一轮修复的完整记录。"""

    round_number: int
    source_run_id: str
    new_run_id: str
    from_step: int
    instructions: list[dict]  # RepairInstruction 序列化后的列表
    scores_before: dict[str, float]
    scores_after: dict[str, float]
    total_before: float
    total_after: float
    delta: float
    outcome: str  # "improved" | "no_change" | "regressed"


@dataclass
class RepairHistory:
    """跨多轮修复的完整会话记录。"""

    session_id: str
    original_run_id: str
    task_input: str
    rounds: list[RepairRound] = field(default_factory=list)
    final_run_id: str | None = None
    stop_reason: str | None = None

    def to_dict(self) -> dict:
        return {
            "session_id": self.session_id,
            "original_run_id": self.original_run_id,
            "task_input": self.task_input,
            "rounds": [asdict(r) for r in self.rounds],
            "final_run_id": self.final_run_id,
            "stop_reason": self.stop_reason,
        }

    @classmethod
    def from_dict(cls, data: dict) -> RepairHistory:
        rounds = [RepairRound(**r) for r in data.get("rounds", [])]
        return cls(
            session_id=data["session_id"],
            original_run_id=data["original_run_id"],
            task_input=data["task_input"],
            rounds=rounds,
            final_run_id=data.get("final_run_id"),
            stop_reason=data.get("stop_reason"),
        )


@dataclass
class RepairConfig:
    """修复循环参数，可从 YAML 配置或 CLI 参数构造。"""

    enabled: bool = False
    max_retries: int = 3
    min_score: float = 3.5
    min_delta: float = 0.2
    min_dimension_score: float = 3.0
    regression_tolerance: float = -0.1


# ---------------------------------------------------------------------------
# 核心函数
# ---------------------------------------------------------------------------


def needs_repair(run_log: RunLog, config: RepairConfig) -> bool:
    """检查一次运行是否需要修复。"""
    if not run_log.qa_result:
        return False
    qs = run_log.qa_result.get("quality_score")
    if not qs:
        return False

    scores = qs.get("scores", {})
    if not scores:
        return False

    total = calculate_total_score(scores)

    # 条件 1: 总分未达标
    if total < config.min_score:
        return True

    # 条件 2: 任一维度低于最低要求
    for dim_score in scores.values():
        if isinstance(dim_score, (int, float)) and dim_score < config.min_dimension_score:
            return True

    return False


def resolve_repair_targets(
    qa_result: dict,
    config: RepairConfig,
    step_index_map: dict[str, int] | None = None,
    dimension_step_map: dict[str, list[str]] | None = None,
) -> list[RepairInstruction]:
    """从 QA 结构化结果生成修复指令列表。

    交叉对照三个信息源：
    1. dimension_step_map（启发式映射）
    2. QA v3 issues 中的 source_agent 归因
    3. QA v3 improvement_targets

    返回去重后的 RepairInstruction 列表，按 step 执行顺序排列。
    """
    if step_index_map is None:
        step_index_map = _DEFAULT_STEP_INDEX_MAP
    if dimension_step_map is None:
        dimension_step_map = _DEFAULT_DIMENSION_STEP_MAP

    qs = qa_result.get("quality_score", {})
    scores = qs.get("scores", {})
    issues = qs.get("issues", [])
    targets = qs.get("improvement_targets", [])

    if not scores:
        return []

    weak_dimensions: list[str] = []
    for dim, score in scores.items():
        if isinstance(score, (int, float)) and score < config.min_dimension_score:
            weak_dimensions.append(dim)

    if not weak_dimensions:
        total = calculate_total_score(scores)
        if total < config.min_score:
            sorted_dims = sorted(
                [(d, s) for d, s in scores.items() if isinstance(s, (int, float))],
                key=lambda x: x[1],
            )
            weak_dimensions = [d for d, _ in sorted_dims[:2]]

    if not weak_dimensions:
        return []

    step_info: dict[str, dict] = {}

    for dim in weak_dimensions:
        candidate_steps = dimension_step_map.get(dim, [])
        for step_id in candidate_steps:
            if step_id in _NON_RERUNABLE_STEPS:
                continue
            if step_id not in step_index_map:
                continue
            if step_id not in step_info:
                step_info[step_id] = {
                    "dimensions": set(),
                    "symptoms": [],
                    "source": "deterministic",
                }
            step_info[step_id]["dimensions"].add(dim)

    for issue in issues:
        if not isinstance(issue, dict):
            continue
        agent = issue.get("source_agent", "")
        dim = issue.get("dimension", "")
        if agent in _NON_RERUNABLE_STEPS:
            continue
        if dim in weak_dimensions and agent and agent in step_index_map:
            if agent not in step_info:
                step_info[agent] = {
                    "dimensions": set(),
                    "symptoms": [],
                    "source": "qa_attributed",
                }
            step_info[agent]["dimensions"].add(dim)
            problem = issue.get("problem", "")
            if problem:
                step_info[agent]["symptoms"].append(problem)
            if step_info[agent]["source"] == "deterministic":
                step_info[agent]["source"] = "merged"

    for target in targets:
        if not isinstance(target, dict):
            continue
        agent = target.get("agent", "")
        if agent in _NON_RERUNABLE_STEPS:
            continue
        if agent and agent in step_index_map and agent in step_info:
            reason = target.get("reason", "")
            if reason:
                step_info[agent]["symptoms"].append(reason)

    strong_dimensions = [dim for dim, score in scores.items() if isinstance(score, (int, float)) and score >= 4]

    instructions: list[RepairInstruction] = []
    for step_id, info in step_info.items():
        dims = sorted(info["dimensions"])
        symptoms = list(dict.fromkeys(info["symptoms"]))
        goals = _generate_repair_goals(dims, scores)
        constraints = _generate_constraints(strong_dimensions, step_id)

        instructions.append(
            RepairInstruction(
                target_step=step_id,
                failure_dimensions=tuple(dims),
                symptoms=tuple(symptoms[:5]),
                repair_goals=tuple(goals),
                constraints=tuple(constraints),
                source=info["source"],
            )
        )

    instructions.sort(key=lambda i: step_index_map.get(i.target_step, 99))
    return instructions


def _generate_repair_goals(dimensions: list[str], scores: dict) -> list[str]:
    """根据弱维度生成具体的修复目标。"""
    goals: list[str] = []
    goal_templates = {
        "完整性": "确保所有输出字段内容充实，每个字段至少包含3个要点",
        "逻辑一致性": "检查各字段数据是否相互印证，消除矛盾点",
        "需求匹配度": "逐条对照客户原始需求，确保每个约束条件都有明确响应",
        "信息密度": "每个论述必须包含具体数据或事实支撑，消除模糊表述",
        "行业专业性": "使用准确的行业术语，技术参数需标注依据和来源",
        "可执行性": "每条建议必须包含具体行动步骤、负责方和时间节点",
    }
    for dim in dimensions:
        template = goal_templates.get(dim)
        if template:
            current = scores.get(dim, 0)
            goals.append(f"[{dim} 当前{current}分] {template}")
    return goals


def _generate_constraints(strong_dimensions: list[str], step_id: str) -> list[str]:
    """生成约束条件，保护已有高分内容。"""
    constraints = ["不要删除或弱化已有的有效内容"]
    if strong_dimensions:
        dims_str = "、".join(strong_dimensions[:3])
        constraints.append(f"以下维度已评分良好，不得退化：{dims_str}")
    return constraints


def build_context_overlay(
    instructions: list[RepairInstruction],
    round_num: int,
    scores_before: dict[str, float] | None = None,
) -> str:
    """将修复指令渲染为注入上下文的结构化文本块。"""
    repair_data: dict = {
        "repair_round": round_num,
        "instructions": [],
    }

    for inst in instructions:
        entry = {
            "target_step": inst.target_step,
            "failure_dimensions": list(inst.failure_dimensions),
            "symptoms": list(inst.symptoms),
            "repair_goals": list(inst.repair_goals),
            "constraints": list(inst.constraints),
        }
        repair_data["instructions"].append(entry)

    if scores_before:
        # 只展示弱维度的分数
        weak_scores = {}
        target_scores = {}
        for inst in instructions:
            for dim in inst.failure_dimensions:
                if dim in scores_before:
                    weak_scores[dim] = scores_before[dim]
                    target_scores[dim] = ">=3"
        repair_data["previous_scores"] = weak_scores
        repair_data["target_scores"] = target_scores

    json_str = json.dumps(repair_data, ensure_ascii=False, indent=2)

    return (
        f"## [AUTO-REPAIR] 修复指令 (Round {round_num})\n\n"
        f"你在本轮输出中必须满足以下修复要求。这些要求基于上一轮QA评估结果。\n\n"
        f"{json_str}"
    )


def evaluate_round(
    before_run: RunLog,
    after_run: RunLog,
    config: RepairConfig,
    round_num: int,
    instructions: list[RepairInstruction],
    step_index_map: dict[str, int] | None = None,
) -> tuple[str | None, RepairRound]:
    """评估一轮修复的效果，返回 (stop_reason | None, RepairRound)。"""
    if step_index_map is None:
        step_index_map = _DEFAULT_STEP_INDEX_MAP

    before_scores = _extract_scores(before_run)
    after_scores = _extract_scores(after_run)
    total_before = calculate_total_score(before_scores) if before_scores else 0.0
    total_after = calculate_total_score(after_scores) if after_scores else 0.0
    delta = round(total_after - total_before, 2)

    if delta > config.min_delta:
        outcome = "improved"
    elif delta < config.regression_tolerance:
        outcome = "regressed"
    else:
        outcome = "no_change"

    round_record = RepairRound(
        round_number=round_num,
        source_run_id=before_run.run_id,
        new_run_id=after_run.run_id,
        from_step=min(step_index_map.get(inst.target_step, 0) for inst in instructions),
        instructions=[asdict(inst) for inst in instructions],
        scores_before=before_scores,
        scores_after=after_scores,
        total_before=total_before,
        total_after=total_after,
        delta=delta,
        outcome=outcome,
    )

    if total_after >= config.min_score:
        all_above = all(s >= config.min_dimension_score for s in after_scores.values() if isinstance(s, (int, float)))
        if all_above:
            return "threshold_met", round_record

    if outcome == "regressed":
        return "regression", round_record

    if outcome == "no_change":
        return "no_improvement", round_record

    return None, round_record


def repair_cycle(
    engine: object,
    run_log: RunLog,
    config: RepairConfig,
    on_round_done: Callable[[int, RepairRound], None] | None = None,
    on_round_start: Callable[[int, int, int], None] | None = None,  # round_num, from_step, n_instructions
    on_step_done: Callable[[int, int, str, float, str], None] | None = None,
) -> RepairHistory:
    """主修复循环：检查 → 生成指令 → 重跑 → 评估 → 继续/停止。"""
    session_id = datetime.now().strftime("%Y%m%d_%H%M%S") + "_repair"
    history = RepairHistory(
        session_id=session_id,
        original_run_id=run_log.run_id,
        task_input=run_log.task_input,
    )

    current_run = run_log
    step_index_map, dimension_step_map = _get_maps_for_run(run_log)

    stale_output_hashes: set[int] = set()
    consecutive_stale_count = 0

    for round_num in range(1, config.max_retries + 1):
        if not needs_repair(current_run, config):
            history.stop_reason = "threshold_met"
            history.final_run_id = current_run.run_id
            break

        instructions = resolve_repair_targets(
            current_run.qa_result,
            config,
            step_index_map=step_index_map,
            dimension_step_map=dimension_step_map,
        )
        if not instructions:
            history.stop_reason = "no_actionable_issues"
            history.final_run_id = current_run.run_id
            break

        earliest_step = min(step_index_map.get(inst.target_step, 0) for inst in instructions)

        before_scores = _extract_scores(current_run)
        overlay = build_context_overlay(instructions, round_num, before_scores)

        if on_round_start:
            on_round_start(round_num, earliest_step, len(instructions))

        try:
            new_run = engine.rerun_from(
                run_id=current_run.run_id,
                from_step=earliest_step,
                context_overlay=overlay,
                on_step_done=on_step_done,
            )
        except BudgetExceeded as _be:
            import logging as _log

            _log.getLogger(__name__).warning("repair_cycle 触发 LLM 调用预算上限，提前停止修复: %s", _be)
            history.stop_reason = "budget_exceeded"
            history.final_run_id = current_run.run_id
            break

        # Stale output detection: hash the final output to detect no-change reruns
        output_hash = hash(new_run.final_output.get("final_output", "")[:2000]) if new_run.final_output else 0
        if output_hash in stale_output_hashes:
            consecutive_stale_count += 1
            if consecutive_stale_count >= 2:
                stop_reason, round_record = evaluate_round(
                    current_run,
                    new_run,
                    config,
                    round_num,
                    instructions,
                    step_index_map=step_index_map,
                )
                history.rounds.append(round_record)
                if on_round_done:
                    on_round_done(round_num, round_record)
                history.stop_reason = "stale_output"
                history.final_run_id = current_run.run_id
                break
        else:
            stale_output_hashes.add(output_hash)
            consecutive_stale_count = 0

        stop_reason, round_record = evaluate_round(
            current_run,
            new_run,
            config,
            round_num,
            instructions,
            step_index_map=step_index_map,
        )
        history.rounds.append(round_record)

        if on_round_done:
            on_round_done(round_num, round_record)

        if stop_reason:
            history.stop_reason = stop_reason
            if stop_reason == "regression":
                history.final_run_id = current_run.run_id
            else:
                history.final_run_id = new_run.run_id
            break

        current_run = new_run
    else:
        history.stop_reason = "max_retries"
        history.final_run_id = current_run.run_id

    save_repair_history(history)
    return history


# ---------------------------------------------------------------------------
# 辅助函数
# ---------------------------------------------------------------------------


def _extract_scores(run_log: RunLog) -> dict[str, float]:
    """从 RunLog 中提取维度分数字典。"""
    if not run_log.qa_result:
        return {}
    qs = run_log.qa_result.get("quality_score", {})
    return qs.get("scores", {})


# ---------------------------------------------------------------------------
# 持久化
# ---------------------------------------------------------------------------


def save_repair_history(history: RepairHistory) -> Path:
    """保存修复历史到 repairs/{session_id}.json。"""
    REPAIRS_DIR.mkdir(parents=True, exist_ok=True)
    path = REPAIRS_DIR / f"{history.session_id}.json"
    path.write_text(
        json.dumps(history.to_dict(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return path


def load_repair_history(session_id: str) -> RepairHistory | None:
    """加载修复历史。"""
    path = REPAIRS_DIR / f"{session_id}.json"
    if not path.exists():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    return RepairHistory.from_dict(data)


def list_repair_sessions() -> list[dict]:
    """列出所有修复会话（按时间倒序）。"""
    if not REPAIRS_DIR.exists():
        return []
    results = []
    for f in sorted(REPAIRS_DIR.glob("*.json"), reverse=True):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            results.append(
                {
                    "session_id": data.get("session_id", f.stem),
                    "original_run_id": data.get("original_run_id", "?"),
                    "rounds": len(data.get("rounds", [])),
                    "stop_reason": data.get("stop_reason", "?"),
                    "final_run_id": data.get("final_run_id", "?"),
                }
            )
        except (json.JSONDecodeError, KeyError):
            continue
    return results
