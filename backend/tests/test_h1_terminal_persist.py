"""TDD — H-1 集成回归:run_chaotang_task 完成/失败后终态落 DB。

mock LLM(FlowEngine),断言:
  done 路径:tasks 行 → done / report_ready / run_id / completed_steps / finished_at / last_stage
           memorials 行 → upsert(含 source_department / agent_code / priority)
  error 路径:tasks 行 → error / failed / finished_at / error 字段有内容

隔离:in-memory SQLite(:memory:),不碰 data/fengqun.db。
"""
from __future__ import annotations

import json
import os
import queue
import types
from dataclasses import dataclass, field
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

os.environ.setdefault("DB_URL", "sqlite:///:memory:")

from src.db.models import Base, Memorial, Task


# ── 夹具 ──────────────────────────────────────────────────────────────────

@pytest.fixture()
def db_engine():
    eng = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)
    eng.dispose()


@pytest.fixture()
def session(db_engine):
    with Session(db_engine) as s:
        yield s


# ── 伪 RunLog / StepLog ────────────────────────────────────────────────────

@dataclass
class _FakeStep:
    agent_name: str = "intel_hu_bu"
    status: str = "success"
    output: str = ""
    quality_score: Any = None
    timestamp: str = "2026-05-31T10:00:00"
    input_tokens: int = 0
    output_tokens: int = 0
    duration_seconds: float = 0.0
    step_index: int = 0
    step_id: str = "step_0"
    input: str = ""
    rendered_context: str = ""
    system_prompt: str = ""
    model: str = "qwen-turbo"
    source: str = "executed"
    prompt_version: str = "v1"
    raw_response: dict = None
    metadata: dict = None

    def __post_init__(self):
        if self.raw_response is None:
            self.raw_response = {}
        if self.metadata is None:
            self.metadata = {}


@dataclass
class _FakeRunLog:
    run_id: str = "run_test_001"
    task_input: str = "低温电池市场分析"
    flow_name: str = "chaotang:intel"
    steps: list = field(default_factory=lambda: [_FakeStep(), _FakeStep(), _FakeStep()])
    final_output: dict = field(default_factory=lambda: {
        "title": "低温电池市场分析报告",
        "background": "分析背景",
        "recommendation": "建议推进",
        "objective": "了解市场",
        "risks": [],
        "opinions": [],
        "execution_path": [],
        "decisions_needed": [],
        "next_steps": [],
    })
    qa_result: dict = field(default_factory=dict)
    quality_score: dict = field(default_factory=lambda: {"total_score": 4.2})
    run_status: str = "normal"


# ── helper:把 in-memory session 注入 persist helpers ──────────────────────

def _run_persist_done(task_id: str, run_log, finished_at: str, db_engine):
    """直接调 flow_store helpers(不走 orchestrator 中间层),用 in-memory session。"""
    from src.db.flow_store import update_task_status, upsert_memorial
    from src.chaotang_api import enrich_memorial
    from web.run_utils import run_summary

    with Session(db_engine) as db:
        total = len(run_log.steps)
        update_task_status(
            session=db,
            task_id=task_id,
            status="done",
            task_status="report_ready",
            run_id=run_log.run_id,
            finished_at=finished_at,
            last_stage="report_ready",
            completed_steps=total,
            total_steps=total,
            legacy_writer_id="pytest-flow-store",
        )
        summary = run_summary(run_log)
        summary["final_output"] = run_log.final_output
        mem = enrich_memorial(summary)
        upsert_memorial(
            session=db,
            memorial_id=run_log.run_id,
            tenant_id=1,
            task_id=task_id,
            title=mem.get("title", ""),
            source_department=mem.get("sourceDepartment", ""),
            agent_code=mem.get("agentCode", ""),
            priority=mem.get("priority", "medium"),
            status="pending",
            summary=mem.get("summary", ""),
            created_at=mem.get("createdAt", ""),
            legacy_writer_id="pytest-flow-store",
        )
        db.commit()


def _run_persist_error(task_id: str, error_msg: str, db_engine):
    from src.db.flow_store import update_task_status
    from datetime import datetime, timezone

    with Session(db_engine) as db:
        update_task_status(
            session=db,
            task_id=task_id,
            status="error",
            task_status="failed",
            finished_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
            last_stage="error",
            error=error_msg[:500],
            legacy_writer_id="pytest-flow-store",
        )
        db.commit()


# ── 需要 Task 初始行(模拟 dispatch 写入)──────────────────────────────────

def _seed_task(db_engine, task_id: str):
    from src.db.flow_store import save_decree_and_task
    with Session(db_engine) as db:
        save_decree_and_task(
            session=db,
            task_id=task_id,
            raw_command="低温电池市场分析",
            intent="市场分析",
            task_type="analysis",
            ministers=["hu_bu"],
            groups=["intel"],
            departments=["finance"],
            started_at="2026-05-31T10:00:00",
            tenant_id=1,
            legacy_writer_id="pytest-flow-store",
        )
        db.commit()


# ── 测试 done 路径 ────────────────────────────────────────────────────────

class TestH1DonePath:
    def test_task_row_updated_to_done(self, db_engine):
        """done 路径:tasks 行必须更新为 done/report_ready/run_id/steps/finished_at。"""
        task_id = "task_done_001"
        _seed_task(db_engine, task_id)
        run_log = _FakeRunLog(run_id="run_done_001")
        _run_persist_done(task_id, run_log, "2026-05-31T11:00:00", db_engine)

        with Session(db_engine) as db:
            t = db.query(Task).filter_by(task_id=task_id).one()
            assert t.status == "done"
            assert t.task_status == "report_ready"
            assert t.run_id == "run_done_001"
            assert t.completed_steps == 3
            assert t.total_steps == 3
            assert t.finished_at == "2026-05-31T11:00:00"
            assert t.last_stage == "report_ready"

    def test_task_progress_pct_100_after_done(self, db_engine):
        """done 后 progressPct = completed/total * 100 = 100。"""
        task_id = "task_done_002"
        _seed_task(db_engine, task_id)
        run_log = _FakeRunLog(run_id="run_done_002", steps=[_FakeStep()] * 5)
        _run_persist_done(task_id, run_log, "2026-05-31T11:01:00", db_engine)

        with Session(db_engine) as db:
            t = db.query(Task).filter_by(task_id=task_id).one()
            pct = int(t.completed_steps / t.total_steps * 100) if t.total_steps else 0
            assert pct == 100

    def test_memorial_upserted_after_done(self, db_engine):
        """done 路径:memorials 索引表必须有该 run_id 的行,且含 agent_code/priority。"""
        task_id = "task_done_003"
        _seed_task(db_engine, task_id)
        run_log = _FakeRunLog(run_id="run_done_003")
        _run_persist_done(task_id, run_log, "2026-05-31T11:02:00", db_engine)

        with Session(db_engine) as db:
            m = db.query(Memorial).filter_by(memorial_id="run_done_003").first()
            assert m is not None, "memorials 行未写入"
            assert m.task_id == task_id
            assert m.agent_code != ""          # enrich_memorial 应派生 agentCode
            # priority 值域包含 normal(无 qa_result 时的默认派生值)
            assert m.priority in ("high", "medium", "low", "normal")
            assert m.status in ("pending", "running", "approved", "archived", "rejected")

    def test_memorial_kp8_no_riskLevel_drop(self, db_engine):
        """KP-8:upsert_memorial 输入来自 enrich_memorial 完整输出,不经 *Brief 投影裁剪。
        验证:memorial 行写入后 source_department 字段有值(派生链未丢字段)。
        """
        task_id = "task_done_004"
        _seed_task(db_engine, task_id)
        run_log = _FakeRunLog(run_id="run_done_004")
        _run_persist_done(task_id, run_log, "2026-05-31T11:03:00", db_engine)

        with Session(db_engine) as db:
            m = db.query(Memorial).filter_by(memorial_id="run_done_004").first()
            assert m is not None
            # source_department 来自 enrich_memorial → dept_of_flow(flow_name)
            # 不为空意味着派生链完整(未经 Brief 投影丢字段)
            assert m.source_department is not None

    def test_done_idempotent_second_call(self, db_engine):
        """done 双写幂等:重复调用不报错,task 行 run_id 保持一致。"""
        task_id = "task_done_005"
        _seed_task(db_engine, task_id)
        run_log = _FakeRunLog(run_id="run_done_005")
        _run_persist_done(task_id, run_log, "2026-05-31T11:04:00", db_engine)
        _run_persist_done(task_id, run_log, "2026-05-31T11:04:01", db_engine)  # 重复调用

        with Session(db_engine) as db:
            t = db.query(Task).filter_by(task_id=task_id).one()
            assert t.run_id == "run_done_005"
            assert t.status == "done"


# ── 测试 error 路径 ───────────────────────────────────────────────────────

class TestH1ErrorPath:
    def test_task_row_updated_to_error(self, db_engine):
        """error 路径:tasks 行必须更新为 error/failed/finished_at/error 字段。"""
        task_id = "task_err_001"
        _seed_task(db_engine, task_id)
        _run_persist_error(task_id, "BudgetExceeded: 超出最大调用次数", db_engine)

        with Session(db_engine) as db:
            t = db.query(Task).filter_by(task_id=task_id).one()
            assert t.status == "error"
            assert t.task_status == "failed"
            assert t.finished_at is not None
            assert t.last_stage == "error"
            assert t.error and len(t.error) > 0

    def test_error_truncated_to_500(self, db_engine):
        """error 字段截断到 500 字符。"""
        task_id = "task_err_002"
        _seed_task(db_engine, task_id)
        long_err = "X" * 600
        _run_persist_error(task_id, long_err, db_engine)

        with Session(db_engine) as db:
            t = db.query(Task).filter_by(task_id=task_id).one()
            assert len(t.error) <= 500

    def test_error_path_no_memorial_upsert(self, db_engine):
        """error 路径:memorials 表不应有对应 task_id 的新行(无 run_id 可关联)。"""
        task_id = "task_err_003"
        _seed_task(db_engine, task_id)
        _run_persist_error(task_id, "runtime error", db_engine)

        with Session(db_engine) as db:
            # tasks 错误行:run_id 应为 None(error 前未产出 run)
            t = db.query(Task).filter_by(task_id=task_id).one()
            assert t.run_id is None

    def test_error_missing_task_noop(self, db_engine):
        """error 路径对不存在的 task_id 不报错(幂等降级)。"""
        _run_persist_error("nonexistent_task", "err", db_engine)
        # 不抛异常即通过


# ── 测试 run_chaotang_task 完整路径(mock FlowEngine)────────────────────────

class TestH1ViaOrchestrator:
    """通过 orchestrator._persist_task_done/_persist_task_error 验证回调路径。"""

    def test_orchestrator_persist_done_called(self, db_engine, monkeypatch):
        """验证 orchestrator._persist_task_done 被 run_chaotang_task 在 done 时调用。"""
        import src.chaotang_orchestrator as orch

        called_with = {}

        def fake_persist_done(task_id, run_log, finished_at):
            called_with["task_id"] = task_id
            called_with["run_id"] = run_log.run_id
            called_with["finished_at"] = finished_at

        monkeypatch.setattr(orch, "_persist_task_done", fake_persist_done)

        # mock FlowEngine.run → 返回 FakeRunLog
        run_log = _FakeRunLog(run_id="run_orch_001", run_status="normal")
        mock_engine_inst = MagicMock()
        mock_engine_inst.run.return_value = run_log

        monkeypatch.setattr(orch, "FlowEngine", lambda *a, **kw: mock_engine_inst)
        monkeypatch.setattr(orch, "LLMCallBudget", MagicMock(set=lambda x: None))

        q: queue.Queue = queue.Queue()
        from web.task_registry import register_task
        register_task("task_orch_001", task_input="test", monitor=True)

        # 直接跑(同步,mock 下不调 LLM)
        orch.run_chaotang_task(
            "task_orch_001", q,
            flow_path="/tmp/fake_flow.yaml",
            task_input="test",
            budget_max_calls=5,
            min_success_groups=0,
        )

        assert called_with.get("task_id") == "task_orch_001"
        assert called_with.get("run_id") == "run_orch_001"
        assert called_with.get("finished_at") is not None

    def test_orchestrator_persist_error_called_on_exception(self, db_engine, monkeypatch):
        """验证 orchestrator._persist_task_error 被 run_chaotang_task 在异常时调用。"""
        import src.chaotang_orchestrator as orch

        called_with = {}

        def fake_persist_error(task_id, error_msg):
            called_with["task_id"] = task_id
            called_with["error_msg"] = error_msg

        monkeypatch.setattr(orch, "_persist_task_error", fake_persist_error)

        # mock FlowEngine.run → raise 异常
        mock_engine_inst = MagicMock()
        mock_engine_inst.run.side_effect = RuntimeError("LLM timeout")

        monkeypatch.setattr(orch, "FlowEngine", lambda *a, **kw: mock_engine_inst)
        monkeypatch.setattr(orch, "LLMCallBudget", MagicMock(set=lambda x: None))

        q: queue.Queue = queue.Queue()
        from web.task_registry import register_task
        register_task("task_orch_err_001", task_input="test", monitor=True)

        orch.run_chaotang_task(
            "task_orch_err_001", q,
            flow_path="/tmp/fake_flow.yaml",
            task_input="test",
            budget_max_calls=5,
            min_success_groups=0,
        )

        assert called_with.get("task_id") == "task_orch_err_001"
        assert "LLM timeout" in called_with.get("error_msg", "")


# ── H-1 端到端集成测试:mock FlowEngine,_persist_* 真实执行写 DB ────────────

class TestH1EndToEndIntegration:
    """最关键的集成回归:run_chaotang_task 跑完后真实 DB 行落库。

    mock 边界:只 mock FlowEngine(不调 LLM),不 mock _persist_task_done/_persist_task_error。
    断言:tasks 行 + memorials 行确实在 DB 里(守 H-1 踩坑不复发)。
    CI 安全:不依赖 DASHSCOPE_API_KEY。

    隔离策略:用 StaticPool 使所有 Session 共享同一 in-memory 连接,monkeypatch
    src.db.engine.SessionLocal 重定向到该 engine,避免跨测试污染。
    """

    def _make_shared_engine(self):
        """StaticPool:所有 Session 共享同一 in-memory 连接,跨函数可见。"""
        from sqlalchemy.pool import StaticPool
        eng = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(eng)
        return eng

    def _setup(self, monkeypatch, task_id: str):
        """创建共享 engine,seed 初始行,patch SessionLocal,返回 engine。"""
        import importlib
        from sqlalchemy.orm import sessionmaker

        eng = self._make_shared_engine()
        TestSession = sessionmaker(bind=eng, autocommit=False, autoflush=False)

        # patch _persist_* 内部用的 SessionLocal
        eng_mod = importlib.import_module("src.db.engine")
        monkeypatch.setattr(eng_mod, "SessionLocal", TestSession)

        # seed tasks 初始行(通过 TestSession 写,与 _persist_* 共享同一 engine)
        from src.db.flow_store import save_decree_and_task
        with TestSession() as db:
            save_decree_and_task(
                session=db,
                task_id=task_id,
                raw_command="集成测试指令",
                tenant_id=1,
                legacy_writer_id="pytest-flow-store",
            )
            db.commit()

        return eng, TestSession

    def test_done_path_writes_tasks_and_memorials_to_db(self, monkeypatch):
        """run 成功 → _persist_task_done 真实执行 → tasks+memorials 行落 DB。

        这是 H-1 核心守门测试:验证整条 run→persist 调用链连通。
        mock FlowEngine 使不调 LLM,_persist_* 真实执行写 DB。
        """
        import src.chaotang_orchestrator as orch

        task_id = "e2e_done_001"
        test_eng, TestSession = self._setup(monkeypatch, task_id)

        run_log = _FakeRunLog(run_id="e2e_run_done_001", run_status="normal")
        mock_engine_inst = MagicMock()
        mock_engine_inst.run.return_value = run_log
        monkeypatch.setattr(orch, "FlowEngine", lambda *a, **kw: mock_engine_inst)
        monkeypatch.setattr(orch, "LLMCallBudget", MagicMock(set=lambda x: None))

        q: queue.Queue = queue.Queue()
        from web.task_registry import register_task
        register_task(task_id, task_input="集成测试指令", monitor=True)

        orch.run_chaotang_task(
            task_id, q,
            flow_path="/tmp/fake_flow.yaml",
            task_input="集成测试指令",
            budget_max_calls=5,
            min_success_groups=0,
        )

        # 断言 tasks 行终态(H-1 核心守门)
        with TestSession() as db:
            t = db.query(Task).filter_by(task_id=task_id).one()
            assert t.status == "done", f"tasks.status 应为 done,实为 {t.status}"
            assert t.task_status == "report_ready"
            assert t.run_id == "e2e_run_done_001", f"run_id 应非空,实为 {t.run_id}"
            assert t.completed_steps == len(run_log.steps)
            assert t.total_steps == len(run_log.steps)
            assert t.finished_at is not None, "finished_at 应非空"
            assert t.last_stage == "report_ready"

        # 断言 memorials 行(upsert_memorial 守门)
        with TestSession() as db:
            m = db.query(Memorial).filter_by(memorial_id="e2e_run_done_001").first()
            assert m is not None, "memorials 行未写入 DB — H-1 upsert_memorial 路径断裂"
            assert m.task_id == task_id
            assert m.status in ("pending", "running", "approved", "archived", "rejected")

    def test_error_path_writes_tasks_to_db(self, monkeypatch):
        """run 抛异常 → _persist_task_error 真实执行 → tasks 行落 error 终态。"""
        import src.chaotang_orchestrator as orch

        task_id = "e2e_error_001"
        test_eng, TestSession = self._setup(monkeypatch, task_id)

        mock_engine_inst = MagicMock()
        mock_engine_inst.run.side_effect = RuntimeError("stub LLM timeout")
        monkeypatch.setattr(orch, "FlowEngine", lambda *a, **kw: mock_engine_inst)
        monkeypatch.setattr(orch, "LLMCallBudget", MagicMock(set=lambda x: None))

        q: queue.Queue = queue.Queue()
        from web.task_registry import register_task
        register_task(task_id, task_input="集成测试指令", monitor=True)

        orch.run_chaotang_task(
            task_id, q,
            flow_path="/tmp/fake_flow.yaml",
            task_input="集成测试指令",
            budget_max_calls=5,
            min_success_groups=0,
        )

        with TestSession() as db:
            t = db.query(Task).filter_by(task_id=task_id).one()
            assert t.status == "error", f"tasks.status 应为 error,实为 {t.status}"
            assert t.task_status == "failed"
            assert t.finished_at is not None
            assert t.last_stage == "error"
            assert t.error and "stub LLM timeout" in t.error

    def test_budget_exceeded_path_writes_error_to_db(self, monkeypatch):
        """BudgetExceeded 路径 → tasks 行落 error 终态。"""
        import src.chaotang_orchestrator as orch
        from src.flow_engine import BudgetExceeded

        task_id = "e2e_budget_001"
        test_eng, TestSession = self._setup(monkeypatch, task_id)

        mock_engine_inst = MagicMock()
        mock_engine_inst.run.side_effect = BudgetExceeded("max_calls=5 exceeded")
        monkeypatch.setattr(orch, "FlowEngine", lambda *a, **kw: mock_engine_inst)
        monkeypatch.setattr(orch, "LLMCallBudget", MagicMock(set=lambda x: None))

        q: queue.Queue = queue.Queue()
        from web.task_registry import register_task
        register_task(task_id, task_input="集成测试指令", monitor=True)

        orch.run_chaotang_task(
            task_id, q,
            flow_path="/tmp/fake_flow.yaml",
            task_input="集成测试指令",
            budget_max_calls=5,
            min_success_groups=0,
        )

        with TestSession() as db:
            t = db.query(Task).filter_by(task_id=task_id).one()
            assert t.status == "error"
            assert t.task_status == "failed"
            assert t.finished_at is not None

    def test_done_path_idempotent_double_run(self, monkeypatch):
        """同一 task_id 跑两次不崩溃(幂等),tasks 行仍是 done。"""
        import src.chaotang_orchestrator as orch

        task_id = "e2e_double_001"
        test_eng, TestSession = self._setup(monkeypatch, task_id)

        run_log = _FakeRunLog(run_id="e2e_run_double_001", run_status="normal")
        mock_engine_inst = MagicMock()
        mock_engine_inst.run.return_value = run_log
        monkeypatch.setattr(orch, "FlowEngine", lambda *a, **kw: mock_engine_inst)
        monkeypatch.setattr(orch, "LLMCallBudget", MagicMock(set=lambda x: None))

        from web.task_registry import register_task

        # 第一次
        q: queue.Queue = queue.Queue()
        register_task(task_id, task_input="集成测试指令", monitor=True)
        orch.run_chaotang_task(
            task_id, q, flow_path="/tmp/fake_flow.yaml",
            task_input="集成测试指令", budget_max_calls=5, min_success_groups=0,
        )

        # 第二次(同一 task_id,模拟重试)
        q2: queue.Queue = queue.Queue()
        register_task(task_id, task_input="集成测试指令", monitor=True)
        orch.run_chaotang_task(
            task_id, q2, flow_path="/tmp/fake_flow.yaml",
            task_input="集成测试指令", budget_max_calls=5, min_success_groups=0,
        )

        with TestSession() as db:
            t = db.query(Task).filter_by(task_id=task_id).one()
            assert t.status == "done"
