"""治理层：凭良率收敛蜂群 — 整改#2。

核心逻辑：
  - 从飞轮历史(run_logger)读取每个蜂群的 qa_score 分布
  - 计算 良率(pass_rate) = qa_score ≥ PASS_THRESHOLD 的比例
  - 根据良率 + 不可逆风险错误率，为每个蜂群确定治理等级
  - 治理等级影响 EventBinding 的有效值（min_quality_score / enabled）
  - 治理状态持久化到 data/governance_state.json（不改 YAML）

等级规则（从严到宽）:
  SUSPENDED  — 良率<40% 或存在不可逆风险错误 → 所有下游 binding enabled=False
  DOWNGRADED — 良率<60%                        → 下游 binding min_quality_score 升至 GOV_FLOOR
  WATCH      — 良率<70% 或样本<MIN_SAMPLES      → 仅警告，不限流
  ACTIVE     — 良率≥70% 且样本充足               → 无附加限制

整合点：SwarmOrchestrator 在 _setup_bindings() 前调用
  apply_governance_to_bindings(bindings, governance_state)
  以只读方式叠加治理约束，不修改 YAML。
"""

from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass
from enum import Enum
from pathlib import Path

from src.runtime_paths import resolve_runtime_paths

logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parent.parent
GOV_STATE_PATH = resolve_runtime_paths().data / "governance_state.json"
QUALITY_EVAL_LOG = resolve_runtime_paths().data / "quality_eval_log.jsonl"

# ── 阈值常数 ──────────────────────────────────────────────────────────
PASS_THRESHOLD = 3.0  # qa_score ≥ 此值算"良"（与 score_swarm 1-5 及 QA step 0-5 对齐）
MIN_SAMPLES = 3  # 低于此数认为数据不足，定 WATCH（而非 ACTIVE）
GOV_FLOOR = 4.0  # DOWNGRADED 蜂群触发的下游，最低质量门控阈值


class GovernanceLevel(str, Enum):
    ACTIVE = "active"
    WATCH = "watch"
    DOWNGRADED = "downgraded"
    SUSPENDED = "suspended"


@dataclass
class GovernanceRecord:
    swarm_id: str
    level: GovernanceLevel
    pass_rate: float  # 0.0–1.0
    sample_count: int
    irreversible_errors: int  # 不可逆风险错误次数
    updated_at: str  # ISO-8601 字符串（由调用方传入）
    reason: str


GovernanceState = dict[str, GovernanceRecord]


# ── 等级判定 ─────────────────────────────────────────────────────────


def _compute_level(pass_rate: float, sample_count: int, irreversible_errors: int) -> tuple[GovernanceLevel, str]:
    if irreversible_errors > 0:
        return GovernanceLevel.SUSPENDED, f"存在 {irreversible_errors} 次不可逆风险错误，无论良率立即停用"
    if sample_count < MIN_SAMPLES:
        return GovernanceLevel.WATCH, f"样本量不足（{sample_count}<{MIN_SAMPLES}），数据待积累"
    if pass_rate < 0.40:
        return GovernanceLevel.SUSPENDED, f"良率 {pass_rate:.0%} < 40%，停用所有下游触发"
    if pass_rate < 0.60:
        return GovernanceLevel.DOWNGRADED, f"良率 {pass_rate:.0%} < 60%，下游触发门槛升至 {GOV_FLOOR}"
    if pass_rate < 0.70:
        return GovernanceLevel.WATCH, f"良率 {pass_rate:.0%} < 70%，仅警告"
    return GovernanceLevel.ACTIVE, f"良率 {pass_rate:.0%} ≥ 70%，正常"


def evaluate_swarm(
    swarm_id: str,
    scores: list[float],
    irreversible_errors: int,
    now_iso: str,
) -> GovernanceRecord:
    """给定一批 qa_score 和不可逆错误数，计算治理等级。"""
    n = len(scores)
    passing = sum(1 for s in scores if s >= PASS_THRESHOLD)
    pass_rate = passing / n if n > 0 else 0.0
    level, reason = _compute_level(pass_rate, n, irreversible_errors)
    return GovernanceRecord(
        swarm_id=swarm_id,
        level=level,
        pass_rate=round(pass_rate, 4),
        sample_count=n,
        irreversible_errors=irreversible_errors,
        updated_at=now_iso,
        reason=reason,
    )


# ── 持久化 ────────────────────────────────────────────────────────────


def load_governance_state() -> GovernanceState:
    """从磁盘读取治理状态。

    文件不存在时返回空 dict（正常首次启动）。
    文件存在但解析失败时：记录 ERROR 并返回空 dict（fail-open），
    调用方负责在日志/告警中捕捉「governance disabled」字样。
    """
    if not GOV_STATE_PATH.exists():
        return {}
    try:
        raw = json.loads(GOV_STATE_PATH.read_text(encoding="utf-8"))
    except Exception as e:
        logger.error(
            "[governance disabled] 治理状态文件解析失败，本次运行无治理约束: %s — 请检查 %s",
            e,
            GOV_STATE_PATH,
        )
        return {}
    try:
        state: GovernanceState = {}
        for k, v in raw.items():
            state[k] = GovernanceRecord(
                swarm_id=v["swarm_id"],
                level=GovernanceLevel(v["level"]),
                pass_rate=float(v["pass_rate"]),
                sample_count=int(v["sample_count"]),
                irreversible_errors=int(v.get("irreversible_errors", 0)),
                updated_at=v.get("updated_at", ""),
                reason=v.get("reason", ""),
            )
        return state
    except Exception as e:
        logger.error(
            "[governance disabled] 治理状态 schema 校验失败，本次运行无治理约束: %s",
            e,
        )
        return {}


def save_governance_state(state: GovernanceState) -> None:
    """原子写入治理状态到磁盘（先写 .tmp，再 os.replace，防中断损坏）。"""
    import os

    GOV_STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    serialized = {k: asdict(v) for k, v in state.items()}
    tmp = GOV_STATE_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(serialized, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, GOV_STATE_PATH)


# ── 飞轮数据源 ────────────────────────────────────────────────────────


def _build_swarm_flow_name_map() -> dict[str, str]:
    """从 config/swarm_orchestrator.yaml 和各 flow YAML 构建 swarm_id → flow_name 映射。
    swarm_orchestrator 的 id（如 "pack_rd"）对应 flow YAML 的 flow_name 字段
    （如 "PACK研发蜂群流程"），两者不同，需要通过 config 路径桥接。
    """
    import yaml

    orch_path = ROOT / "config" / "swarm_orchestrator.yaml"
    if not orch_path.exists():
        return {}
    try:
        with open(orch_path, encoding="utf-8") as f:
            orch = yaml.safe_load(f) or {}
    except Exception:
        return {}

    result: dict[str, str] = {}
    for swarm in orch.get("swarms", []):
        swarm_id = swarm.get("id", "")
        config_path = swarm.get("config", "")
        if not swarm_id or not config_path:
            continue
        flow_cfg_path = ROOT / config_path
        try:
            with open(flow_cfg_path, encoding="utf-8") as f:
                flow_cfg = yaml.safe_load(f) or {}
            flow_name = flow_cfg.get("flow_name", "")
            if flow_name:
                result[swarm_id] = flow_name
        except Exception:
            pass
    return result


def _scores_from_flywheel(swarm_id: str, window: int = 30) -> tuple[list[float], int]:
    """从 run_logger 飞轮读取最近 window 次该蜂群的 qa_score。
    使用 swarm_id → flow_name 映射（从 YAML 动态构建），精确匹配飞轮记录。
    返回 (scores, irreversible_errors_count)。
    注: flywheel RunRecord 无 irreversible_error 字段 → 0。
    """
    try:
        from src.run_logger import load_flywheel

        records = load_flywheel(flow_name=None, limit=window * 4)
    except Exception as e:
        logger.debug("load_flywheel 失败: %s", e)
        return [], 0

    # 通过 YAML 构建的映射查找该 swarm 对应的 flow_name
    swarm_map = _build_swarm_flow_name_map()
    flow_name = swarm_map.get(swarm_id, swarm_id)  # 未找到时以 swarm_id 原值兜底
    matching = [r for r in records if (r.flow_name or "") == flow_name and r.flow_name]
    matching = matching[:window]
    scores = [r.qa_score for r in matching if r.qa_score is not None]
    return scores, 0


def _scores_from_eval_log(swarm_id: str, window: int = 30) -> tuple[list[float], int]:
    """从 score_swarm.py 写入的 quality_eval_log.jsonl 读取评估记录。"""
    if not QUALITY_EVAL_LOG.exists():
        return [], 0
    scores: list[float] = []
    irreversible = 0
    lines = QUALITY_EVAL_LOG.read_text(encoding="utf-8").splitlines()
    for line in reversed(lines):
        line = line.strip()
        if not line:
            continue
        try:
            rec = json.loads(line)
        except Exception:
            continue
        if rec.get("swarm_id") != swarm_id:
            continue
        if len(scores) >= window:
            break
        ov = float(rec.get("overall", 0) or 0)
        scores.append(ov)
        if rec.get("irreversible_risk_error"):
            irreversible += 1
    return scores, irreversible


def collect_scores(swarm_id: str, window: int = 30) -> tuple[list[float], int]:
    """合并飞轮 + 独立评估日志的 qa_score，去重后取最近 window 条。"""
    fw_scores, fw_irr = _scores_from_flywheel(swarm_id, window)
    ev_scores, ev_irr = _scores_from_eval_log(swarm_id, window)
    combined = (fw_scores + ev_scores)[:window]
    return combined, fw_irr + ev_irr


# ── 叠加治理约束到 EventBinding ───────────────────────────────────────


def apply_governance_to_bindings(bindings: list, state: GovernanceState) -> list:
    """在不修改 YAML 的前提下，根据治理状态叠加约束到 EventBinding 列表。

    SUSPENDED 蜂群 → 以该蜂群为 target 的 binding 全部 enabled=False
    DOWNGRADED 蜂群 → 以该蜂群为 target 的 binding min_quality_score 升至 GOV_FLOOR
    WATCH/ACTIVE    → 无变化
    """
    from dataclasses import replace

    effective = []
    for b in bindings:
        rec = state.get(b.target_swarm)
        if rec is None:
            effective.append(b)
            continue
        if rec.level == GovernanceLevel.SUSPENDED:
            b = replace(b, enabled=False)
            logger.info(
                "[治理] %s SUSPENDED → binding %s→%s 已禁用: %s",
                b.target_swarm,
                b.topic,
                b.target_swarm,
                rec.reason,
            )
        elif rec.level == GovernanceLevel.DOWNGRADED:
            if b.min_quality_score < GOV_FLOOR:
                b = replace(b, min_quality_score=GOV_FLOOR)
                logger.info(
                    "[治理] %s DOWNGRADED → binding %s→%s min_quality_score 升至 %.1f: %s",
                    b.target_swarm,
                    b.topic,
                    b.target_swarm,
                    GOV_FLOOR,
                    rec.reason,
                )
        effective.append(b)
    return effective
