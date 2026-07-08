"""SLO 监控"零样本假健康"修复(顶尖高手会审 → Explore 扫出的洞,同款 court_doc_builder green 病)。

修前:窗口内 0 条记录时,qa_pass_rate 兜底 1.0(满分)、error_rate 兜底 0.0(零错误)、
p95 兜底 0(零延迟),三者都让 SLOStatus.status 判成 "healthy"——仪表盘显示"健康",
实际是没有任何数据在跑,可能是记录链路本身断了。/api/kpi/slo 之前也不返回 samples,
调用方连"到底有没有数据"都无从判断。
"""
from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path

from src.kpi_tracker import (
    BusinessOutcome,
    BusinessOutcomeTracker,
    KPIStore,
    LatencyRecord,
    LatencyTracker,
    SLOMonitor,
)


def _store(tmp_path: Path) -> KPIStore:
    return KPIStore(db_path=tmp_path / "kpi.db")


def test_qa_pass_rate_no_data_is_not_healthy(tmp_path: Path):
    store = _store(tmp_path)
    monitor = SLOMonitor(store)
    statuses = {s.name: s for s in monitor.check_all()}
    qa = statuses["qa_pass_rate"]
    assert qa.samples == 0
    assert qa.status == "no_data"          # 不是 healthy——没数据不等于零缺陷


def test_success_rate_no_data_is_not_healthy(tmp_path: Path):
    store = _store(tmp_path)
    statuses = {s.name: s for s in SLOMonitor(store).check_all()}
    sr = statuses["step_success_rate"]
    assert sr.samples == 0
    assert sr.status == "no_data"          # 不是 healthy——没数据不等于零错误


def test_latency_p95_no_data_is_not_healthy(tmp_path: Path):
    store = _store(tmp_path)
    statuses = {s.name: s for s in SLOMonitor(store).check_all()}
    lat = statuses["p95_latency_ms"]
    assert lat.samples == 0
    assert lat.status == "no_data"         # 不是 healthy——没数据不等于零延迟


def test_qa_pass_rate_with_real_data_still_correct(tmp_path: Path):
    """有真实数据时,行为不能被这次改动动到。"""
    store = _store(tmp_path)
    tracker = BusinessOutcomeTracker(store)
    now = datetime.now().isoformat()
    for i in range(10):
        tracker.record(BusinessOutcome(
            run_id=f"r{i}", flow_name="f", task_input="x",
            quality_score=4.0 if i < 8 else 2.0, recorded_at=now,
        ))
    statuses = {s.name: s for s in SLOMonitor(store).check_all()}
    qa = statuses["qa_pass_rate"]
    assert qa.samples == 10
    assert qa.current_value == 0.8         # 8/10 达标(≥3.5)
    assert qa.status == "healthy"          # 0.8 >= target 0.80


def test_success_rate_with_real_failures_still_violates(tmp_path: Path):
    store = _store(tmp_path)
    tracker = LatencyTracker(store)
    now = datetime.now().isoformat()
    for i in range(10):
        tracker.record(LatencyRecord(
            step_id="s", flow_name="f", elapsed_ms=100, model="m",
            timestamp=now, run_id=f"r{i}", success=(i < 5),   # 50% 成功率
        ))
    statuses = {s.name: s for s in SLOMonitor(store).check_all()}
    sr = statuses["step_success_rate"]
    assert sr.samples == 10
    assert sr.status == "violated"         # 50% << 95% 目标,不该被误判 healthy


def test_get_sample_count_matches_window(tmp_path: Path):
    store = _store(tmp_path)
    tracker = LatencyTracker(store)
    old = (datetime.now() - timedelta(hours=48)).isoformat()
    recent = datetime.now().isoformat()
    tracker.record(LatencyRecord(step_id="s", flow_name="f", elapsed_ms=1,
                                  model="m", timestamp=old, run_id="old"))
    tracker.record(LatencyRecord(step_id="s", flow_name="f", elapsed_ms=1,
                                  model="m", timestamp=recent, run_id="new"))
    assert tracker.get_sample_count(hours=24) == 1   # 只数窗口内的
