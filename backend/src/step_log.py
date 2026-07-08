"""Step 级日志：记录每一步的完整执行信息。"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Optional

_LEGACY_RUNS_DIR = Path(__file__).resolve().parent.parent / "runs"
RUNS_DIR = _LEGACY_RUNS_DIR  # backward compat alias


def _get_runs_dir() -> Path:
    """获取当前租户的 runs 目录（向后兼容旧的 runs/ 目录）。"""
    try:
        from src.tenant import DEFAULT_TENANT_SLUG, get_current_tenant, get_tenant_data_dir
        slug = get_current_tenant()
        tenant_dir = get_tenant_data_dir("runs")
        # 默认租户时，如果旧目录存在，继续使用旧目录（向后兼容）
        if slug == DEFAULT_TENANT_SLUG and _LEGACY_RUNS_DIR.exists():
            return _LEGACY_RUNS_DIR
        return tenant_dir
    except ImportError:
        return _LEGACY_RUNS_DIR


@dataclass
class StepLog:
    run_id: str
    step_index: int
    step_id: str
    agent_name: str
    timestamp: str
    input: str  # 原始 task_input（仅首步）或上一步 output
    rendered_context: str  # 实际喂给模型的完整上下文
    system_prompt: str
    model: str
    output: str
    status: str  # "success" / "error" / "warning" / "skipped"
    source: str = "executed"  # "executed" / "inherited"（rerun 时复制的前序步骤）
    raw_response: dict = field(default_factory=dict)

    # 新增：Prompt版本记录
    prompt_version: str = "unknown"

    # 新增：质量评分（仅QA步骤有）
    quality_score: Optional[dict] = None

    input_tokens: int = 0   # 实际输入 token（执行后从模型响应填充）
    output_tokens: int = 0  # 实际输出 token

    # 实际执行耗时（秒），由 flow_engine 在落盘时写入
    duration_seconds: float = 0.0

    # 新增：元数据（扩展用）
    metadata: dict = field(default_factory=dict)


@dataclass
class RunLog:
    run_id: str
    task_input: str
    flow_name: str
    steps: list[StepLog] = field(default_factory=list)
    final_output: dict | None = None
    qa_result: dict | None = None

    prompt_versions: dict = field(default_factory=dict)

    quality_score: Optional[dict] = None

    run_status: str = "normal"

    config_path: str | None = None

    critic_result: dict | None = None

    metadata: dict = field(default_factory=dict)


def _run_dir(run_id: str) -> Path:
    runs_dir = _get_runs_dir()
    # Legacy fallback: if run exists in old location, use it
    legacy_path = _LEGACY_RUNS_DIR / run_id
    if legacy_path.exists() and runs_dir != _LEGACY_RUNS_DIR:
        return legacy_path
    return runs_dir / run_id


def get_run_dir(run_id: str) -> Path | None:
    """Resolve a run directory by exact id or unique prefix.

    Older API paths can expose ``YYYYMMDD_HHMMSS`` prefixes while FlowEngine
    persists microsecond-qualified ids. Exact matches win; prefix matches must
    be unique across the tenant and legacy run directories.
    """
    runs_dir = _get_runs_dir()
    bases: list[Path] = []
    for base in (runs_dir, _LEGACY_RUNS_DIR):
        if base not in bases:
            bases.append(base)

    for base in bases:
        exact = base / run_id
        if exact.is_dir():
            return exact

    matches: list[Path] = []
    seen: set[str] = set()
    for base in bases:
        if not base.exists():
            continue
        for item in base.iterdir():
            if not item.is_dir() or not item.name.startswith(run_id):
                continue
            key = str(item.resolve())
            if key not in seen:
                seen.add(key)
                matches.append(item)

    if len(matches) == 1:
        return matches[0]
    return None


def save_step(step_log: StepLog) -> Path:
    """将单步日志写入 runs/{run_id}/step_{i}_{step_id}.json。"""
    d = _run_dir(step_log.run_id)
    d.mkdir(parents=True, exist_ok=True)
    filename = f"step_{step_log.step_index}_{step_log.step_id}.json"
    path = d / filename
    path.write_text(
        json.dumps(asdict(step_log), ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return path


def save_final_output(run_id: str, final_output: dict, qa_result: dict) -> Path:
    """保存最终输出到 runs/{run_id}/final_output.json。"""
    d = _run_dir(run_id)
    d.mkdir(parents=True, exist_ok=True)
    path = d / "final_output.json"
    data = {"qa_result": qa_result, "final_output": final_output}
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def save_run_meta(
    run_log: RunLog,
    run_type: str = "normal",
    source_run_id: str | None = None,
    from_step: int | None = None,
    from_step_id: str | None = None,
    config_path: str | None = None,
) -> Path:
    """保存运行元信息到 runs/{run_id}/run_meta.json。

    from_step_id: DAG rerun 时目标节点的 step_id（可选）。
    """
    d = _run_dir(run_log.run_id)
    d.mkdir(parents=True, exist_ok=True)
    path = d / "run_meta.json"
    meta = {
        "run_id": run_log.run_id,
        "task_input": run_log.task_input,
        "flow_name": run_log.flow_name,
        "step_count": len(run_log.steps),
        "has_final_output": run_log.final_output is not None,
        "run_type": run_type,
        "source_run_id": source_run_id,
        "from_step": from_step,
        "from_step_id": from_step_id,
        "prompt_versions": run_log.prompt_versions,
        "quality_score": run_log.quality_score,
        "metadata": run_log.metadata,
    }
    if config_path is not None:
        meta["config_path"] = config_path
    path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def load_run(run_id: str) -> RunLog | None:
    """从 runs/{run_id}/ 加载完整运行日志。"""
    d = get_run_dir(run_id)
    if d is None or not d.exists():
        return None

    meta_path = d / "run_meta.json"
    if not meta_path.exists():
        return None
    meta = json.loads(meta_path.read_text(encoding="utf-8"))

    run_log = RunLog(
        run_id=meta["run_id"],
        task_input=meta["task_input"],
        flow_name=meta["flow_name"],
    )

    # 加载新增字段（兼容旧数据）
    run_log.prompt_versions = meta.get("prompt_versions", {})
    run_log.quality_score = meta.get("quality_score")
    run_log.config_path = meta.get("config_path")
    run_log.metadata = meta.get("metadata", {})

    # 按 step_index 数值排序，避免字典序把 step_10 排到 step_1 前面
    step_files = sorted(d.glob("step_*.json"), key=lambda f: int(f.stem.split("_")[1]))
    for sf in step_files:
        data = json.loads(sf.read_text(encoding="utf-8"))
        # 兼容旧数据：补 source 字段
        data.setdefault("source", "executed")
        # 兼容旧数据：补新增字段
        data.setdefault("prompt_version", "unknown")
        data.setdefault("quality_score", None)
        data.setdefault("input_tokens", 0)
        data.setdefault("output_tokens", 0)
        data.setdefault("duration_seconds", 0.0)
        data.setdefault("metadata", {})
        # 兼容旧数据：如果存在旧字段，转换为新字段
        if "prompt_key" in data and "prompt_version" not in data:
            data["prompt_version"] = "unknown"
        run_log.steps.append(StepLog(**data))

    final_path = d / "final_output.json"
    if final_path.exists():
        final_data = json.loads(final_path.read_text(encoding="utf-8"))
        run_log.final_output = final_data.get("final_output")
        run_log.qa_result = final_data.get("qa_result")
        # 从qa_result提取quality_score到run_log
        if run_log.qa_result and run_log.qa_result.get("quality_score"):
            run_log.quality_score = run_log.qa_result.get("quality_score")

    return run_log


def list_runs() -> list[str]:
    """列出所有 run_id（按时间倒序）。"""
    runs_dir = _get_runs_dir()
    seen = set()
    run_ids = []

    # 当前租户目录
    for d in [runs_dir, _LEGACY_RUNS_DIR]:
        if d.exists():
            for item in d.iterdir():
                if item.is_dir() and item.name not in seen:
                    seen.add(item.name)
                    run_ids.append(item.name)

    return sorted(run_ids, reverse=True)
