"""TDD — Session-10 端点集成测试。

FastAPI TestClient + 隔离 in-memory SQLite。
测试:
  POST /decree/dispatch         → decrees+tasks 双写
  GET  /memorials               → DB 优先合并 + KP-8 riskLevel 保留
  GET  /tasks                   → 内存+DB 合并(内存优先)
  GET  /manor/projects          → 200 + shape
  GET  /manor/policy-funds      → 200 + shape
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

os.environ.setdefault("DB_URL", "sqlite:///:memory:")
os.environ.setdefault("FENGQUN_AUTH", "false")


# ── 伪 RunLog ─────────────────────────────────────────────────────────────


@dataclass
class _FakeStep:
    agent_name: str = "intel_hu_bu"
    status: str = "success"
    output: str = ""
    quality_score: Any = None


@dataclass
class _FakeRunLog:
    run_id: str = "run_ep_001"
    task_input: str = "测试分析"
    flow_name: str = "chaotang:intel"
    steps: list = field(default_factory=lambda: [_FakeStep()] * 3)
    final_output: dict = field(
        default_factory=lambda: {
            "title": "测试分析报告",
            "background": "背景",
            "recommendation": "建议",
            "objective": "目标",
            "risks": [],
            "opinions": [],
            "execution_path": [],
            "decisions_needed": [],
            "next_steps": [],
        }
    )
    qa_result: dict = field(default_factory=dict)
    quality_score: dict = field(default_factory=lambda: {"total_score": 4.0})
    run_status: str = "normal"


# ── TestClient 工厂 ───────────────────────────────────────────────────────


def _make_client():
    """每次调用重建 app,确保 lifespan 执行建表。"""
    from web.main import app

    return TestClient(app)


# ── POST /decree/dispatch — 双写 decrees+tasks ──────────────────────────


class TestDispatchDualWrite:
    """验证 dispatch 后 decrees 和 tasks 表都有初始行。"""

    _BODY = {
        "rawCommand": "分析低温电池市场",
        "intent": "市场分析",
        "selectedCategories": [
            {
                "taskType": "analysis",
                "ministers": ["hu_bu"],
                "groups": ["intel"],
                "label": "市场分析",
            }
        ],
        "budget": {"maxCalls": 5, "maxSubagentsPerGroup": 1},
    }

    def test_dispatch_returns_200_and_taskId(
        self, monkeypatch, isolated_session_local
    ):
        """dispatch 端点返回 200 + taskId。"""
        monkeypatch.setenv("FENGQUN_AUTH", "false")
        # mock _spawn_run 不真跑 LLM
        import web.routers.chaotang as ct

        monkeypatch.setattr(ct, "_spawn_run", lambda *a, **kw: None)

        c = _make_client()
        r = c.post("/api/chaotang/decree/dispatch", json=self._BODY)
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert "taskId" in body["data"]
        assert body["data"]["status"] == "running"

    def test_dispatch_writes_tasks_row(self, monkeypatch, isolated_session_local):
        """dispatch 后 flow_store.save_decree_and_task 被调用一次(tasks 行写入)。"""
        monkeypatch.setenv("FENGQUN_AUTH", "false")
        import web.routers.chaotang as ct

        monkeypatch.setattr(ct, "_spawn_run", lambda *a, **kw: None)

        written_tasks = []
        import src.db.flow_store as fs

        orig_save = fs.save_decree_and_task

        def capture_save(*, session, task_id, **kw):
            written_tasks.append({"task_id": task_id, **kw})
            orig_save(session=session, task_id=task_id, **kw)

        monkeypatch.setattr(fs, "save_decree_and_task", capture_save)

        c = _make_client()
        r = c.post("/api/chaotang/decree/dispatch", json=self._BODY)
        assert r.status_code == 200
        task_id = r.json()["data"]["taskId"]

        assert len(written_tasks) == 1
        assert written_tasks[0]["task_id"] == task_id
        assert written_tasks[0].get("departments") is not None

    def test_dispatch_decrees_row_has_ministers(
        self, monkeypatch, isolated_session_local
    ):
        """dispatch 后 decrees 表的 ministers_json 含 hu_bu。"""
        monkeypatch.setenv("FENGQUN_AUTH", "false")
        import web.routers.chaotang as ct

        monkeypatch.setattr(ct, "_spawn_run", lambda *a, **kw: None)

        written_decrees = []
        import src.db.flow_store as fs

        orig = fs.save_decree_and_task

        def capture_save(*, session, task_id, ministers=None, **kw):
            written_decrees.append({"task_id": task_id, "ministers": ministers})
            orig(session=session, task_id=task_id, ministers=ministers, **kw)

        monkeypatch.setattr(fs, "save_decree_and_task", capture_save)

        c = _make_client()
        c.post("/api/chaotang/decree/dispatch", json=self._BODY)

        assert written_decrees
        assert "hu_bu" in (written_decrees[0].get("ministers") or [])

    def test_dispatch_db_failure_blocks_execution(
        self, monkeypatch, isolated_session_local
    ):
        """正式事实无法落库时必须封驳，不能返回假成功。"""
        monkeypatch.setenv("FENGQUN_AUTH", "false")
        import web.routers.chaotang as ct

        monkeypatch.setattr(ct, "_spawn_run", lambda *a, **kw: None)

        import src.db.flow_store as fs

        monkeypatch.setattr(
            fs, "save_decree_and_task", MagicMock(side_effect=RuntimeError("DB故障"))
        )

        c = _make_client()
        r = c.post("/api/chaotang/decree/dispatch", json=self._BODY)
        assert r.status_code == 200
        assert r.json()["success"] is False
        assert "DB故障" in r.json()["error"]


# ── GET /memorials — DB 优先合并 + KP-8 ──────────────────────────────────


class TestMemorialsDbFirst:
    """验证 /memorials 读 DB 优先,且 riskLevel 从 JSON 路径保留(KP-8)。"""

    def _mock_build_memorial_list(self):
        """返回带 riskLevel 的完整 memorial dict。"""
        return [
            {
                "id": "run_mem_001",
                "title": "市场分析奏折",
                "sourceDepartment": "finance",
                "agentCode": "hu_bu",
                "priority": "high",
                "status": "running",  # JSON 派生状态
                "summary": "分析摘要",
                "createdAt": "2026-05-31T10:00:00",
                "riskLevel": "high",  # KP-8:riskLevel 在完整 dict 中
            }
        ]

    def test_memorials_returns_200(self, monkeypatch):
        monkeypatch.setenv("FENGQUN_AUTH", "false")
        import web.routers.throne as throne

        monkeypatch.setattr(
            throne, "_build_memorial_list", self._mock_build_memorial_list
        )
        c = _make_client()
        r = c.get("/api/chaotang/memorials")
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_memorials_db_status_overrides_json(self, monkeypatch):
        """DB 中 memorial_id 的 status=archived 应覆盖 JSON 派生的 status=running。"""
        monkeypatch.setenv("FENGQUN_AUTH", "false")
        import web.routers.throne as throne

        monkeypatch.setattr(
            throne, "_build_memorial_list", self._mock_build_memorial_list
        )

        from src.db.models import Memorial as DbMem

        fake_db_mem = MagicMock(spec=DbMem)
        fake_db_mem.memorial_id = "run_mem_001"
        fake_db_mem.title = "市场分析奏折"
        fake_db_mem.source_department = "finance"
        fake_db_mem.agent_code = "hu_bu"
        fake_db_mem.priority = "high"
        fake_db_mem.status = "archived"  # DB 持久终态
        fake_db_mem.summary = "分析摘要"
        fake_db_mem.created_at = "2026-05-31T10:00:00"

        fake_session = MagicMock()
        fake_query = MagicMock()
        fake_query.order_by.return_value.limit.return_value.all.return_value = [
            fake_db_mem
        ]
        fake_session.query.return_value = fake_query
        fake_session.__enter__ = lambda s: s
        fake_session.__exit__ = MagicMock(return_value=False)

        import importlib, src.db.engine as _eng_mod

        _eng_mod_real = importlib.import_module("src.db.engine")
        monkeypatch.setattr(
            _eng_mod_real, "SessionLocal", MagicMock(return_value=fake_session)
        )

        c = _make_client()
        r = c.get("/api/chaotang/memorials")
        assert r.status_code == 200
        data = r.json()["data"]
        mem = next((m for m in data if m["id"] == "run_mem_001"), None)
        assert mem is not None
        assert mem["status"] == "archived"

    def test_memorials_riskLevel_preserved_from_json(self, monkeypatch):
        """KP-8:DB 为空时走 JSON fallback,riskLevel 字段保留在合并结果中。"""
        monkeypatch.setenv("FENGQUN_AUTH", "false")
        import web.routers.throne as throne

        monkeypatch.setattr(
            throne, "_build_memorial_list", self._mock_build_memorial_list
        )

        # DB 返回空(fallback 到 JSON 纯路径)
        fake_session = MagicMock()
        fake_query = MagicMock()
        fake_query.order_by.return_value.limit.return_value.all.return_value = []
        fake_session.query.return_value = fake_query
        fake_session.__enter__ = lambda s: s
        fake_session.__exit__ = MagicMock(return_value=False)

        import importlib

        _eng_mod_real = importlib.import_module("src.db.engine")
        monkeypatch.setattr(
            _eng_mod_real, "SessionLocal", MagicMock(return_value=fake_session)
        )

        c = _make_client()
        r = c.get("/api/chaotang/memorials")
        assert r.status_code == 200
        data = r.json()["data"]
        mem = next((m for m in data if m["id"] == "run_mem_001"), None)
        assert mem is not None
        assert "riskLevel" in mem


# ── GET /tasks — 内存+DB 合并 ────────────────────────────────────────────


class TestTasksListMerge:
    """验证 /tasks 合并内存(在飞)+ DB(历史)。"""

    def test_tasks_includes_memory_tasks(self, monkeypatch):
        """内存中的在飞任务出现在 /tasks 列表中。"""
        monkeypatch.setenv("FENGQUN_AUTH", "false")
        import web.routers.chaotang as ct

        monkeypatch.setattr(
            ct,
            "task_snapshot",
            lambda: {
                "mem_t1": {
                    "status": "running",
                    "task_input": "内存任务",
                    "completed_steps": 2,
                    "total_steps": 5,
                }
            },
        )
        c = _make_client()
        r = c.get("/api/chaotang/tasks")
        assert r.status_code == 200
        ids = [t["taskId"] for t in r.json()["data"]]
        assert "mem_t1" in ids

    def _patch_session_local(self, monkeypatch, fake_session):
        """统一 patch src.db.engine.SessionLocal(importlib 方式避免模块别名歧义)。"""
        import importlib

        _m = importlib.import_module("src.db.engine")
        monkeypatch.setattr(_m, "SessionLocal", MagicMock(return_value=fake_session))

    def _make_fake_session(self, rows):
        """构造返回 rows 的假 Session。"""
        fake_session = MagicMock()
        fake_q = MagicMock()
        fake_q.order_by.return_value.limit.return_value.all.return_value = rows
        fake_session.query.return_value = fake_q
        fake_session.__enter__ = lambda s: s
        fake_session.__exit__ = MagicMock(return_value=False)
        return fake_session

    def test_tasks_memory_takes_priority_over_db(self, monkeypatch):
        """同一 task_id 在内存(running)和 DB(done)中同时存在时,内存状态优先。"""
        monkeypatch.setenv("FENGQUN_AUTH", "false")
        import web.routers.chaotang as ct

        monkeypatch.setattr(
            ct,
            "task_snapshot",
            lambda: {
                "conflict_t1": {
                    "status": "running",
                    "task_input": "冲突任务",
                    "completed_steps": 1,
                    "total_steps": 4,
                }
            },
        )
        fake_db_row = MagicMock()
        fake_db_row.task_id = "conflict_t1"
        fake_db_row.status = "done"
        fake_db_row.task_status = "report_ready"
        fake_db_row.task_input = "冲突任务"
        fake_db_row.completed_steps = 4
        fake_db_row.total_steps = 4
        fake_db_row.created_at = "2026-05-31T10:00:00"

        self._patch_session_local(monkeypatch, self._make_fake_session([fake_db_row]))

        c = _make_client()
        r = c.get("/api/chaotang/tasks")
        items = r.json()["data"]
        t = next((i for i in items if i["taskId"] == "conflict_t1"), None)
        assert t is not None
        assert t["status"] == "running"  # 内存优先

    def test_tasks_db_history_visible_after_restart(self, monkeypatch):
        """内存为空时 DB 历史任务出现在列表(模拟重启场景)。"""
        monkeypatch.setenv("FENGQUN_AUTH", "false")
        import web.routers.chaotang as ct

        monkeypatch.setattr(ct, "task_snapshot", lambda: {})

        fake_db_row = MagicMock()
        fake_db_row.task_id = "hist_t1"
        fake_db_row.status = "done"
        fake_db_row.task_status = "report_ready"
        fake_db_row.task_input = "历史任务"
        fake_db_row.completed_steps = 5
        fake_db_row.total_steps = 5
        fake_db_row.created_at = "2026-05-30T10:00:00"
        # 补全 nullable 契约:真实 Task row 这些列可为 None(result_json nullable=True);
        # 不设则为 MagicMock,task_record 里 json.loads(MagicMock) 抛 TypeError,
        # 被 tasks_list 的 except 吞掉 → 历史任务凭空消失。double 须 honor 真实 row 契约。
        fake_db_row.result_json = None
        fake_db_row.updated_at = "2026-05-30T10:00:00"
        fake_db_row.started_at = None
        fake_db_row.finished_at = None

        self._patch_session_local(monkeypatch, self._make_fake_session([fake_db_row]))

        c = _make_client()
        r = c.get("/api/chaotang/tasks")
        assert r.status_code == 200
        items = r.json()["data"]
        assert any(i["taskId"] == "hist_t1" for i in items)
        hist = next(i for i in items if i["taskId"] == "hist_t1")
        assert hist["status"] == "report_ready"
        assert hist["progressPct"] == 100

    def test_tasks_db_failure_falls_back_to_memory(self, monkeypatch):
        """DB 查询异常时仍返回内存任务,不崩溃。"""
        monkeypatch.setenv("FENGQUN_AUTH", "false")
        import web.routers.chaotang as ct

        monkeypatch.setattr(
            ct,
            "task_snapshot",
            lambda: {
                "fallback_t1": {
                    "status": "running",
                    "task_input": "兜底任务",
                    "completed_steps": 0,
                    "total_steps": 3,
                }
            },
        )
        import importlib

        _m = importlib.import_module("src.db.engine")
        monkeypatch.setattr(
            _m, "SessionLocal", MagicMock(side_effect=RuntimeError("DB 不可用"))
        )

        c = _make_client()
        r = c.get("/api/chaotang/tasks")
        assert r.status_code == 200
        ids = [t["taskId"] for t in r.json()["data"]]
        assert "fallback_t1" in ids


# ── GET /manor/projects — 200 + shape ────────────────────────────────────


class TestManorProjectsEndpoint:
    def test_returns_200_and_success(self, monkeypatch):
        monkeypatch.setenv("FENGQUN_AUTH", "false")
        c = _make_client()
        r = c.get("/api/chaotang/manor/projects")
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_projects_list_non_empty(self, monkeypatch):
        monkeypatch.setenv("FENGQUN_AUTH", "false")
        c = _make_client()
        data = c.get("/api/chaotang/manor/projects").json()["data"]
        assert "projects" in data
        assert len(data["projects"]) > 0

    def test_project_shape(self, monkeypatch):
        """每个 project 含契约必填字段。"""
        monkeypatch.setenv("FENGQUN_AUTH", "false")
        c = _make_client()
        projects = c.get("/api/chaotang/manor/projects").json()["data"]["projects"]
        for p in projects:
            assert "id" in p
            assert "name" in p
            assert "stage" in p
            assert "progressPct" in p
            assert "status" in p
            assert 0 <= p["progressPct"] <= 100
            assert p["status"] in ("active", "planning", "completed", "paused")

    def test_suggestions_list_present(self, monkeypatch):
        monkeypatch.setenv("FENGQUN_AUTH", "false")
        c = _make_client()
        data = c.get("/api/chaotang/manor/projects").json()["data"]
        assert "suggestions" in data
        assert isinstance(data["suggestions"], list)

    def test_generatedAt_present(self, monkeypatch):
        monkeypatch.setenv("FENGQUN_AUTH", "false")
        c = _make_client()
        data = c.get("/api/chaotang/manor/projects").json()["data"]
        assert "generatedAt" in data


# ── GET /manor/policy-funds — 200 + shape ────────────────────────────────


class TestManorPolicyFundsEndpoint:
    def test_returns_200_and_success(self, monkeypatch):
        monkeypatch.setenv("FENGQUN_AUTH", "false")
        c = _make_client()
        r = c.get("/api/chaotang/manor/policy-funds")
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_funds_list_non_empty(self, monkeypatch):
        monkeypatch.setenv("FENGQUN_AUTH", "false")
        c = _make_client()
        data = c.get("/api/chaotang/manor/policy-funds").json()["data"]
        assert "funds" in data
        assert len(data["funds"]) > 0

    def test_fund_shape(self, monkeypatch):
        """每个 fund 含契约必填字段。"""
        monkeypatch.setenv("FENGQUN_AUTH", "false")
        c = _make_client()
        funds = c.get("/api/chaotang/manor/policy-funds").json()["data"]["funds"]
        for f in funds:
            assert "id" in f
            assert "name" in f
            assert "type" in f
            assert "amount" in f
            assert "matchScore" in f
            assert 0 <= f["matchScore"] <= 100

    def test_funds_sorted_by_matchScore_desc(self, monkeypatch):
        """funds 按 matchScore 降序排列。"""
        monkeypatch.setenv("FENGQUN_AUTH", "false")
        c = _make_client()
        funds = c.get("/api/chaotang/manor/policy-funds").json()["data"]["funds"]
        scores = [f["matchScore"] for f in funds]
        assert scores == sorted(scores, reverse=True)

    def test_summary_shape(self, monkeypatch):
        """summary 含 totalCount / actionableCount / totalPotentialAmount。"""
        monkeypatch.setenv("FENGQUN_AUTH", "false")
        c = _make_client()
        data = c.get("/api/chaotang/manor/policy-funds").json()["data"]
        assert "summary" in data
        s = data["summary"]
        assert "totalCount" in s
        assert "actionableCount" in s
        assert "totalPotentialAmount" in s
        assert s["totalCount"] == len(data["funds"])
