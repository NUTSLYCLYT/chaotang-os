"""评估 KPI 模块 — 业务成功率追踪、回归测试集、延迟百分位、SLO 监控、人工标定。

集成点：
- web/app.py: 添加 /api/kpi/* 端点
- flow_engine.py: 在 run() 完成后调用 KPITracker.record_run()
- quality.py: 人工标定与 LLM 自评对比
"""

from __future__ import annotations

import json
import logging
import sqlite3
import time
from collections import defaultdict
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from src.runtime_paths import resolve_runtime_paths

logger = logging.getLogger(__name__)

_KPI_DB_PATH = resolve_runtime_paths().data / "kpi.db"


@dataclass
class LatencyRecord:
    step_id: str
    flow_name: str
    elapsed_ms: int
    model: str
    timestamp: str
    run_id: str = ""
    success: bool = True


@dataclass
class SLOConfig:
    name: str
    target: float
    window_hours: int = 24
    metric: str = "success_rate"
    description: str = ""


@dataclass
class SLOStatus:
    name: str
    current_value: float
    target: float
    status: str
    samples: int
    window_hours: int
    burn_rate: float = 0.0


@dataclass
class BusinessOutcome:
    run_id: str
    flow_name: str
    task_input: str
    quality_score: float
    outcome: str = ""
    outcome_metadata: dict = field(default_factory=dict)
    recorded_at: str = ""
    recorded_by: str = ""


@dataclass
class RegressionTestCase:
    test_id: str
    name: str
    task_input: str
    flow_config: str
    expected_min_score: float = 3.5
    expected_keywords: list[str] = field(default_factory=list)
    forbidden_patterns: list[str] = field(default_factory=list)
    last_run_at: str = ""
    last_score: float = 0.0
    last_passed: bool = False
    enabled: bool = True


@dataclass
class HumanCalibration:
    run_id: str
    step_id: str
    llm_score: float
    human_score: float
    dimensions_llm: dict = field(default_factory=dict)
    dimensions_human: dict = field(default_factory=dict)
    reviewer: str = ""
    reviewed_at: str = ""
    notes: str = ""


CREATE_KPI_SCHEMA = """
CREATE TABLE IF NOT EXISTS latency_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    step_id TEXT,
    flow_name TEXT,
    elapsed_ms INTEGER,
    model TEXT,
    timestamp TEXT,
    run_id TEXT,
    success INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS business_outcomes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT UNIQUE,
    flow_name TEXT,
    task_input TEXT,
    quality_score REAL,
    outcome TEXT,
    outcome_metadata TEXT,
    recorded_at TEXT,
    recorded_by TEXT
);

CREATE TABLE IF NOT EXISTS regression_tests (
    test_id TEXT PRIMARY KEY,
    name TEXT,
    task_input TEXT,
    flow_config TEXT,
    expected_min_score REAL,
    expected_keywords TEXT,
    forbidden_patterns TEXT,
    last_run_at TEXT,
    last_score REAL,
    last_passed INTEGER,
    enabled INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS human_calibrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT,
    step_id TEXT,
    llm_score REAL,
    human_score REAL,
    dimensions_llm TEXT,
    dimensions_human TEXT,
    reviewer TEXT,
    reviewed_at TEXT,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_latency_flow ON latency_records(flow_name, timestamp);
CREATE INDEX IF NOT EXISTS idx_latency_step ON latency_records(step_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_outcomes_flow ON business_outcomes(flow_name);
CREATE INDEX IF NOT EXISTS idx_calibrations_run ON human_calibrations(run_id);
"""


class KPIStore:
    """KPI 数据存储（SQLite）。"""

    def __init__(self, db_path: Path | None = None):
        self.db_path = db_path or _KPI_DB_PATH
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _init_db(self) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.executescript(CREATE_KPI_SCHEMA)

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn


class LatencyTracker:
    """延迟百分位追踪器 — P50/P90/P95/P99。"""

    def __init__(self, store: KPIStore | None = None):
        self.store = store or KPIStore()

    def record(self, record: LatencyRecord) -> None:
        with self.store._conn() as conn:
            conn.execute(
                "INSERT INTO latency_records (step_id, flow_name, elapsed_ms, model, timestamp, run_id, success) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (record.step_id, record.flow_name, record.elapsed_ms,
                 record.model, record.timestamp, record.run_id, int(record.success)),
            )

    def get_percentiles(
        self,
        flow_name: str | None = None,
        step_id: str | None = None,
        hours: int = 24,
    ) -> dict[str, float]:
        """获取延迟百分位（P50/P90/P95/P99）。"""
        cutoff = (datetime.now() - timedelta(hours=hours)).isoformat()

        conditions = ["timestamp >= ?"]
        params: list[Any] = [cutoff]

        if flow_name:
            conditions.append("flow_name = ?")
            params.append(flow_name)
        if step_id:
            conditions.append("step_id = ?")
            params.append(step_id)

        where = " AND ".join(conditions)

        with self.store._conn() as conn:
            rows = conn.execute(
                f"SELECT elapsed_ms FROM latency_records WHERE {where} ORDER BY elapsed_ms",
                params,
            ).fetchall()

        if not rows:
            return {"p50": 0, "p90": 0, "p95": 0, "p99": 0, "avg": 0, "count": 0}

        values = [r["elapsed_ms"] for r in rows]
        n = len(values)

        return {
            "p50": values[int(n * 0.50)],
            "p90": values[min(int(n * 0.90), n - 1)],
            "p95": values[min(int(n * 0.95), n - 1)],
            "p99": values[min(int(n * 0.99), n - 1)],
            "avg": round(sum(values) / n, 1),
            "count": n,
        }

    def get_error_rate(
        self,
        flow_name: str | None = None,
        hours: int = 24,
    ) -> float:
        """获取错误率。"""
        cutoff = (datetime.now() - timedelta(hours=hours)).isoformat()
        conditions = ["timestamp >= ?"]
        params: list[Any] = [cutoff]
        if flow_name:
            conditions.append("flow_name = ?")
            params.append(flow_name)
        where = " AND ".join(conditions)

        with self.store._conn() as conn:
            total = conn.execute(
                f"SELECT COUNT(*) FROM latency_records WHERE {where}", params
            ).fetchone()[0]
            if total == 0:
                return 0.0
            errors = conn.execute(
                f"SELECT COUNT(*) FROM latency_records WHERE {where} AND success = 0", params
            ).fetchone()[0]
        return errors / total

    def get_sample_count(
        self,
        flow_name: str | None = None,
        hours: int = 24,
    ) -> int:
        """窗口内样本数(0 时调用方不该把 get_error_rate 的兜底 0.0 当"零错误率"来用)。"""
        cutoff = (datetime.now() - timedelta(hours=hours)).isoformat()
        conditions = ["timestamp >= ?"]
        params: list[Any] = [cutoff]
        if flow_name:
            conditions.append("flow_name = ?")
            params.append(flow_name)
        where = " AND ".join(conditions)
        with self.store._conn() as conn:
            return conn.execute(
                f"SELECT COUNT(*) FROM latency_records WHERE {where}", params
            ).fetchone()[0]


class SLOMonitor:
    """SLO 监控器。"""

    DEFAULT_SLOS = [
        SLOConfig(name="step_success_rate", target=0.95, window_hours=24,
                  metric="success_rate", description="步骤执行成功率"),
        SLOConfig(name="p95_latency_ms", target=15000, window_hours=24,
                  metric="latency_p95", description="P95 延迟（毫秒）"),
        SLOConfig(name="qa_pass_rate", target=0.80, window_hours=24,
                  metric="qa_pass_rate", description="QA 评分通过率（≥3.5）"),
    ]

    def __init__(self, store: KPIStore | None = None):
        self.store = store or KPIStore()
        self.slos = list(self.DEFAULT_SLOS)

    def check_all(self) -> list[SLOStatus]:
        results = []
        for slo in self.slos:
            status = self._check_slo(slo)
            results.append(status)
        return results

    def _check_slo(self, slo: SLOConfig) -> SLOStatus:
        # court_doc_builder 那次真实合同暴露的同款洞:0 样本时各分支曾经默认"满分/零错误率",
        # 跟"未接地却挂绿灯"是同一类病——没数据不该看起来像"健康",得诚实标 no_data。
        # samples 按各指标真实查的那张表算,不能都借用 latency_records 的计数(qa_pass_rate
        # 查的是 business_outcomes,张冠李戴的话 samples 字段本身就在撒谎)。
        if slo.metric == "success_rate":
            error_rate = LatencyTracker(self.store).get_error_rate(hours=slo.window_hours)
            current = 1.0 - error_rate
            samples = LatencyTracker(self.store).get_sample_count(hours=slo.window_hours)
        elif slo.metric == "latency_p95":
            percentiles = LatencyTracker(self.store).get_percentiles(hours=slo.window_hours)
            current = percentiles["p95"]
            samples = percentiles["count"]
        elif slo.metric == "qa_pass_rate":
            current, samples = self._get_qa_pass_rate(slo.window_hours)
        else:
            current, samples = 0.0, 0

        if samples == 0:
            return SLOStatus(
                name=slo.name, current_value=round(current, 4), target=slo.target,
                status="no_data", samples=0, window_hours=slo.window_hours, burn_rate=0.0,
            )

        if slo.metric in ("success_rate", "qa_pass_rate"):
            is_ok = current >= slo.target
            burn_rate = max(0, (slo.target - current) / slo.target) if slo.target > 0 else 0
        else:
            is_ok = current <= slo.target
            burn_rate = max(0, (current - slo.target) / slo.target) if slo.target > 0 else 0

        return SLOStatus(
            name=slo.name,
            current_value=round(current, 4),
            target=slo.target,
            status="healthy" if is_ok else "violated",
            samples=samples,
            window_hours=slo.window_hours,
            burn_rate=round(burn_rate, 4),
        )

    def _get_qa_pass_rate(self, hours: int) -> tuple[float, int]:
        with self.store._conn() as conn:
            cutoff = (datetime.now() - timedelta(hours=hours)).isoformat()
            total = conn.execute(
                "SELECT COUNT(*) FROM business_outcomes WHERE recorded_at >= ?",
                (cutoff,),
            ).fetchone()[0]
            if total == 0:
                return 0.0, 0
            passed = conn.execute(
                "SELECT COUNT(*) FROM business_outcomes WHERE recorded_at >= ? AND quality_score >= 3.5",
                (cutoff,),
            ).fetchone()[0]
        return passed / total, total


class BusinessOutcomeTracker:
    """业务级成功率追踪。"""

    def __init__(self, store: KPIStore | None = None):
        self.store = store or KPIStore()

    def record(self, outcome: BusinessOutcome) -> None:
        with self.store._conn() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO business_outcomes "
                "(run_id, flow_name, task_input, quality_score, outcome, outcome_metadata, recorded_at, recorded_by) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (outcome.run_id, outcome.flow_name, outcome.task_input, outcome.quality_score,
                 outcome.outcome, json.dumps(outcome.outcome_metadata, ensure_ascii=False),
                 outcome.recorded_at, outcome.recorded_by),
            )

    def get_stats(self, flow_name: str | None = None, days: int = 30) -> dict:
        cutoff = (datetime.now() - timedelta(days=days)).isoformat()
        conditions = ["recorded_at >= ?"]
        params: list[Any] = [cutoff]
        if flow_name:
            conditions.append("flow_name = ?")
            params.append(flow_name)
        where = " AND ".join(conditions)

        with self.store._conn() as conn:
            total = conn.execute(f"SELECT COUNT(*) FROM business_outcomes WHERE {where}", params).fetchone()[0]
            if total == 0:
                return {"total": 0, "success_rate": 0, "avg_score": 0, "outcome_distribution": {}}

            avg_score = conn.execute(
                f"SELECT AVG(quality_score) FROM business_outcomes WHERE {where}", params
            ).fetchone()[0] or 0

            outcomes = conn.execute(
                f"SELECT outcome, COUNT(*) as cnt FROM business_outcomes WHERE {where} GROUP BY outcome",
                params,
            ).fetchall()
            distribution = {r["outcome"] or "未标记": r["cnt"] for r in outcomes}

            success_outcomes = {"accepted", "approved", "converted", "completed", "成功"}
            success_count = sum(v for k, v in distribution.items() if k in success_outcomes)

        return {
            "total": total,
            "success_rate": round(success_count / total, 4) if total > 0 else 0,
            "avg_score": round(avg_score, 2),
            "outcome_distribution": distribution,
        }


class RegressionTestSuite:
    """回归测试集 — 自动化基准测试。"""

    def __init__(self, store: KPIStore | None = None):
        self.store = store or KPIStore()

    def add_test(self, test: RegressionTestCase) -> None:
        with self.store._conn() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO regression_tests "
                "(test_id, name, task_input, flow_config, expected_min_score, expected_keywords, "
                "forbidden_patterns, last_run_at, last_score, last_passed, enabled) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (test.test_id, test.name, test.task_input, test.flow_config,
                 test.expected_min_score, json.dumps(test.expected_keywords, ensure_ascii=False),
                 json.dumps(test.forbidden_patterns, ensure_ascii=False),
                 test.last_run_at, test.last_score, int(test.last_passed), int(test.enabled)),
            )

    def run_test(self, test_id: str, engine_factory=None) -> dict:
        """执行单个回归测试。"""
        with self.store._conn() as conn:
            row = conn.execute(
                "SELECT * FROM regression_tests WHERE test_id = ? AND enabled = 1",
                (test_id,),
            ).fetchone()
        if not row:
            return {"test_id": test_id, "status": "not_found"}

        test = RegressionTestCase(
            test_id=row["test_id"],
            name=row["name"],
            task_input=row["task_input"],
            flow_config=row["flow_config"],
            expected_min_score=row["expected_min_score"],
            expected_keywords=json.loads(row["expected_keywords"] or "[]"),
            forbidden_patterns=json.loads(row["forbidden_patterns"] or "[]"),
        )

        if engine_factory:
            try:
                from src.flow_engine import FlowEngine
                engine = FlowEngine(test.flow_config)
                run_log = engine.run(test.task_input)

                score = 0.0
                if run_log.quality_score:
                    score = run_log.quality_score.get("total_score", 0)

                output_text = " ".join(s.output or "" for s in run_log.steps)

                keyword_pass = all(kw in output_text for kw in test.expected_keywords)
                forbidden_pass = all(fp not in output_text for fp in test.forbidden_patterns)
                score_pass = score >= test.expected_min_score
                passed = keyword_pass and forbidden_pass and score_pass

                details = {
                    "score": score,
                    "score_pass": score_pass,
                    "keyword_pass": keyword_pass,
                    "forbidden_pass": forbidden_pass,
                    "missing_keywords": [kw for kw in test.expected_keywords if kw not in output_text],
                    "found_forbidden": [fp for fp in test.forbidden_patterns if fp in output_text],
                }

                with self.store._conn() as conn:
                    conn.execute(
                        "UPDATE regression_tests SET last_run_at=?, last_score=?, last_passed=? WHERE test_id=?",
                        (datetime.now().astimezone().isoformat(), score, int(passed), test_id),
                    )

                return {"test_id": test_id, "name": test.name, "passed": passed, "details": details}
            except Exception as e:
                return {"test_id": test_id, "name": test.name, "passed": False, "error": str(e)}

        return {"test_id": test_id, "status": "no_engine_factory"}

    def run_all(self, engine_factory=None) -> list[dict]:
        with self.store._conn() as conn:
            rows = conn.execute("SELECT test_id FROM regression_tests WHERE enabled = 1").fetchall()
        return [self.run_test(r["test_id"], engine_factory) for r in rows]

    def list_tests(self) -> list[dict]:
        with self.store._conn() as conn:
            rows = conn.execute("SELECT * FROM regression_tests ORDER BY test_id").fetchall()
        return [dict(r) for r in rows]


class HumanCalibrationManager:
    """人工标定管理 — LLM 自评 vs 人工评分对比。"""

    def __init__(self, store: KPIStore | None = None):
        self.store = store or KPIStore()

    def add_calibration(self, cal: HumanCalibration) -> None:
        with self.store._conn() as conn:
            conn.execute(
                "INSERT INTO human_calibrations "
                "(run_id, step_id, llm_score, human_score, dimensions_llm, dimensions_human, reviewer, reviewed_at, notes) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (cal.run_id, cal.step_id, cal.llm_score, cal.human_score,
                 json.dumps(cal.dimensions_llm, ensure_ascii=False),
                 json.dumps(cal.dimensions_human, ensure_ascii=False),
                 cal.reviewer, cal.reviewed_at, cal.notes),
            )

    def get_calibration_stats(self) -> dict:
        """返回 LLM 自评与人工评分的对比统计。"""
        with self.store._conn() as conn:
            rows = conn.execute(
                "SELECT llm_score, human_score FROM human_calibrations"
            ).fetchall()

        if not rows:
            return {"samples": 0, "correlation": 0, "avg_delta": 0, "llm_bias": 0}

        llm_scores = [r["llm_score"] for r in rows]
        human_scores = [r["human_score"] for r in rows]
        n = len(llm_scores)

        mean_llm = sum(llm_scores) / n
        mean_human = sum(human_scores) / n

        deltas = [llm_scores[i] - human_scores[i] for i in range(n)]

        correlation = 0.0
        if n >= 2:
            std_llm = (sum((x - mean_llm) ** 2 for x in llm_scores) / n) ** 0.5
            std_human = (sum((x - mean_human) ** 2 for x in human_scores) / n) ** 0.5
            if std_llm > 0 and std_human > 0:
                covariance = sum(
                    (llm_scores[i] - mean_llm) * (human_scores[i] - mean_human)
                    for i in range(n)
                ) / n
                correlation = covariance / (std_llm * std_human)

        return {
            "samples": n,
            "correlation": round(correlation, 4),
            "avg_delta": round(sum(deltas) / n, 4),
            "llm_bias": round(mean_llm - mean_human, 4),
            "mean_llm_score": round(mean_llm, 2),
            "mean_human_score": round(mean_human, 2),
        }

    def list_calibrations(self, limit: int = 50) -> list[dict]:
        with self.store._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM human_calibrations ORDER BY reviewed_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [dict(r) for r in rows]
