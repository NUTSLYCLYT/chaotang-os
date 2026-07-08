"""AB 测试引擎 —— 同一任务、不同配置、自动对比。"""

from __future__ import annotations

import json
import threading
import time
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional

from src.compare import compare_quality
from src.flow_engine import FlowEngine
from src.step_log import RunLog

AB_TESTS_DIR = Path(__file__).resolve().parent.parent / "ab_tests"


@dataclass
class ABVariant:
    """AB 测试中的一个变体配置。"""

    label: str  # "A" or "B"
    config_path: str
    qa_version: Optional[str] = None
    # 运行结果（执行后填充）
    run_id: Optional[str] = None
    run_time: float = 0.0
    grade: Optional[str] = None
    total_score: float = 0.0
    status: str = "pending"  # pending / running / success / error


@dataclass
class ABTestResult:
    """AB 测试结果。"""

    test_id: str
    task_input: str
    created_at: str
    variant_a: ABVariant
    variant_b: ABVariant
    comparison: Optional[dict] = None
    winner: Optional[str] = None  # "A" / "B" / "tie"
    summary: str = ""

    def to_dict(self) -> dict:
        return {
            "test_id": self.test_id,
            "task_input": self.task_input,
            "created_at": self.created_at,
            "variant_a": asdict(self.variant_a),
            "variant_b": asdict(self.variant_b),
            "comparison": self.comparison,
            "winner": self.winner,
            "summary": self.summary,
        }


def run_ab_test(
    task_input: str,
    config_a: str,
    config_b: str,
    qa_version_a: str | None = None,
    qa_version_b: str | None = None,
    on_progress=None,
) -> ABTestResult:
    """执行 AB 测试：同一任务用两套配置分别跑，然后对比。

    Args:
        task_input: 客户需求描述
        config_a: Flow A 的配置文件路径
        config_b: Flow B 的配置文件路径
        qa_version_a: A 的 QA 版本覆盖
        qa_version_b: B 的 QA 版本覆盖
        on_progress: 回调 (variant_label, step_index, total, agent_name, elapsed, status)
    """
    test_id = "ab_" + datetime.now().strftime("%Y%m%d_%H%M%S")

    variant_a = ABVariant(label="A", config_path=config_a, qa_version=qa_version_a)
    variant_b = ABVariant(label="B", config_path=config_b, qa_version=qa_version_b)

    result = ABTestResult(
        test_id=test_id,
        task_input=task_input,
        created_at=datetime.now().astimezone().isoformat(),
        variant_a=variant_a,
        variant_b=variant_b,
    )

    # 并行执行两个变体
    run_logs: dict[str, RunLog | None] = {"A": None, "B": None}
    errors: dict[str, str] = {}

    def _run_variant(variant: ABVariant, key: str):
        variant.status = "running"
        try:
            engine = FlowEngine(variant.config_path, qa_version=variant.qa_version)

            def _cb(si, total, name, elapsed, status, output=None):
                # FlowEngine 现在传 6 个参数 (含 output)，老回调只接 5 个会抛
                # "takes 5 positional arguments but 6 were given"。output 在 AB
                # 进度上不需要展示，仅做参数对齐。
                if on_progress:
                    on_progress(variant.label, si, total, name, elapsed, status)

            t0 = time.time()
            run_log = engine.run(task_input, on_step_done=_cb)
            variant.run_time = round(time.time() - t0, 1)
            variant.run_id = run_log.run_id
            variant.status = "success"

            if run_log.quality_score:
                variant.grade = run_log.quality_score.get("grade")
                variant.total_score = run_log.quality_score.get("total_score", 0)

            run_logs[key] = run_log
        except Exception as e:
            variant.status = "error"
            errors[key] = str(e)

    thread_a = threading.Thread(target=_run_variant, args=(variant_a, "A"))
    thread_b = threading.Thread(target=_run_variant, args=(variant_b, "B"))

    thread_a.start()
    thread_b.start()
    thread_a.join()
    thread_b.join()

    # 对比质量
    log_a, log_b = run_logs["A"], run_logs["B"]
    if log_a and log_b:
        diff = compare_quality(log_a, log_b)
        result.comparison = {
            "score_diffs": diff.score_diffs,
            "total_diff": diff.total_diff,
            "analysis": diff.analysis,
        }
        if diff.winner:
            result.winner = "A" if diff.winner == log_a.run_id else "B"
        else:
            result.winner = "tie"
        result.summary = _build_summary(result)
    else:
        result.summary = f"对比失败：A={variant_a.status}, B={variant_b.status}"
        if errors:
            result.summary += f" errors={errors}"

    # 持久化结果
    _save_ab_result(result)
    return result


def _build_summary(r: ABTestResult) -> str:
    """生成一句话总结。"""
    a, b = r.variant_a, r.variant_b
    diff = r.comparison["total_diff"] if r.comparison else 0

    config_a_name = Path(a.config_path).stem
    config_b_name = Path(b.config_path).stem

    if r.winner == "A":
        return f"A胜({config_a_name}) {a.grade}({a.total_score}) vs B({config_b_name}) {b.grade}({b.total_score})，总分差{abs(diff):+.2f}"
    elif r.winner == "B":
        return f"B胜({config_b_name}) {b.grade}({b.total_score}) vs A({config_a_name}) {a.grade}({a.total_score})，总分差{abs(diff):+.2f}"
    return f"平局 A({config_a_name}) {a.grade}({a.total_score}) vs B({config_b_name}) {b.grade}({b.total_score})"


def _save_ab_result(result: ABTestResult) -> Path:
    """保存 AB 测试结果。"""
    AB_TESTS_DIR.mkdir(parents=True, exist_ok=True)
    path = AB_TESTS_DIR / f"{result.test_id}.json"
    path.write_text(
        json.dumps(result.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return path


def load_ab_result(test_id: str) -> ABTestResult | None:
    """加载 AB 测试结果。"""
    path = AB_TESTS_DIR / f"{test_id}.json"
    if not path.exists():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    return ABTestResult(
        test_id=data["test_id"],
        task_input=data["task_input"],
        created_at=data["created_at"],
        variant_a=ABVariant(**data["variant_a"]),
        variant_b=ABVariant(**data["variant_b"]),
        comparison=data.get("comparison"),
        winner=data.get("winner"),
        summary=data.get("summary", ""),
    )


def list_ab_tests() -> list[dict]:
    """列出所有 AB 测试结果摘要。

    返回 shape 与 GET /api/ab-tests/<id> 详情端点一致（含完整 variant_a / variant_b
    对象），让前端 AbTestResult 类型能复用，列表上的 grade Badge 才能正常渲染。
    """
    if not AB_TESTS_DIR.exists():
        return []
    results = []
    for f in sorted(AB_TESTS_DIR.glob("ab_*.json"), reverse=True):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            results.append({
                "test_id": data["test_id"],
                "task_input": data["task_input"][:60],
                "created_at": data["created_at"],
                "winner": data.get("winner"),
                "summary": data.get("summary", ""),
                "variant_a": data.get("variant_a", {}),
                "variant_b": data.get("variant_b", {}),
            })
        except Exception:
            pass
    return results
