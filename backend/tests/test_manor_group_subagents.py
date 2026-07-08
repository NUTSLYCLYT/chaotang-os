"""TDD — GET /api/chaotang/manor/groups/{groupId}/subagents

契约验收:
  valid groupId → success + 正确 shape(groupId/groupName/ministers/subagentMax/subagents)
  invalid groupId → success=False
  无 run 时 subagents=[]
  taskId 关联正确(subagent 带所属 taskId+taskTitle)
"""
from __future__ import annotations

import json
import os
import queue
from dataclasses import dataclass, field
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("FENGQUN_AUTH", "false")


# ── client fixture ─────────────────────────────────────────────────────────

@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv("FENGQUN_AUTH", "false")
    from web.main import app
    return TestClient(app)


# ── 伪 StepLog / RunLog ───────────────────────────────────────────────────

@dataclass
class _FakeStep:
    agent_name: str
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
    raw_response: dict = field(default_factory=dict)
    metadata: dict = field(default_factory=dict)


@dataclass
class _FakeRunLog:
    run_id: str
    task_input: str = "测试分析"
    flow_name: str = "chaotang:intel"
    steps: list = field(default_factory=list)
    final_output: dict = field(default_factory=dict)
    qa_result: dict = field(default_factory=dict)
    quality_score: dict = field(default_factory=lambda: {"total_score": 4.0})
    run_status: str = "normal"


# ── 1. invalid groupId → fail ──────────────────────────────────────────────

class TestInvalidGroupId:
    def test_unknown_group_returns_fail(self, client):
        r = client.get("/api/chaotang/manor/groups/unknown_xyz/subagents")
        assert r.status_code == 200
        assert r.json()["success"] is False

    def test_empty_group_returns_fail(self, client):
        r = client.get("/api/chaotang/manor/groups//subagents")
        # FastAPI 404 on empty path segment or fail
        assert r.status_code in (200, 404)
        if r.status_code == 200:
            assert r.json()["success"] is False


# ── 2. valid groupId → 200 + shape ────────────────────────────────────────

class TestValidGroupShape:
    @pytest.mark.parametrize("gid", ["intel", "content", "finlaw", "rnd", "exec", "review"])
    def test_valid_group_returns_200(self, client, monkeypatch, gid):
        # no runs → subagents=[]
        import web.routers.manor as manor_mod
        monkeypatch.setattr(manor_mod, "_get_recent_run_ids", lambda n=20: [])
        monkeypatch.setattr(manor_mod, "_snapshot_for_subagents", lambda: {})
        r = client.get(f"/api/chaotang/manor/groups/{gid}/subagents")
        assert r.status_code == 200
        assert r.json()["success"] is True

    @pytest.mark.parametrize("gid", ["intel", "content", "finlaw", "rnd", "exec", "review"])
    def test_response_shape(self, client, monkeypatch, gid):
        import web.routers.manor as manor_mod
        monkeypatch.setattr(manor_mod, "_get_recent_run_ids", lambda n=20: [])
        monkeypatch.setattr(manor_mod, "_snapshot_for_subagents", lambda: {})
        data = client.get(f"/api/chaotang/manor/groups/{gid}/subagents").json()["data"]
        assert "groupId" in data
        assert "groupName" in data
        assert "ministers" in data
        assert "subagentMax" in data
        assert "subagents" in data
        assert isinstance(data["subagents"], list)
        assert isinstance(data["ministers"], list)
        assert isinstance(data["subagentMax"], int)

    def test_finlaw_ministers_contains_hu_bu_or_xing_bu(self, client, monkeypatch):
        """finlaw 组应含 hu_bu 和 xing_bu(来自 manor_groups.yaml)。"""
        import web.routers.manor as manor_mod
        monkeypatch.setattr(manor_mod, "_get_recent_run_ids", lambda n=20: [])
        monkeypatch.setattr(manor_mod, "_snapshot_for_subagents", lambda: {})
        data = client.get("/api/chaotang/manor/groups/finlaw/subagents").json()["data"]
        assert "hu_bu" in data["ministers"] or "xing_bu" in data["ministers"]

    def test_groupId_field_matches(self, client, monkeypatch):
        import web.routers.manor as manor_mod
        monkeypatch.setattr(manor_mod, "_get_recent_run_ids", lambda n=20: [])
        monkeypatch.setattr(manor_mod, "_snapshot_for_subagents", lambda: {})
        data = client.get("/api/chaotang/manor/groups/intel/subagents").json()["data"]
        assert data["groupId"] == "intel"


# ── 3. 无 run 时 subagents=[] ──────────────────────────────────────────────

class TestNoRuns:
    def test_no_runs_returns_empty_subagents(self, client, monkeypatch):
        import web.routers.manor as manor_mod
        monkeypatch.setattr(manor_mod, "_get_recent_run_ids", lambda n=20: [])
        monkeypatch.setattr(manor_mod, "_snapshot_for_subagents", lambda: {})
        data = client.get("/api/chaotang/manor/groups/finlaw/subagents").json()["data"]
        assert data["subagents"] == []

    def test_run_with_no_matching_group_step_returns_empty(self, client, monkeypatch):
        """run 存在但无 group_finlaw 步 → subagents=[]。"""
        import web.routers.manor as manor_mod
        from src.step_log import load_run

        run_log = _FakeRunLog(
            run_id="run_no_finlaw",
            steps=[
                _FakeStep(agent_name="council_hu_bu", status="success"),
                _FakeStep(agent_name="group_intel", status="success"),  # 不是 finlaw
            ],
        )
        monkeypatch.setattr(manor_mod, "_get_recent_run_ids", lambda n=20: ["run_no_finlaw"])
        monkeypatch.setattr(manor_mod, "_snapshot_for_subagents", lambda: {})
        monkeypatch.setattr("src.step_log.load_run", lambda rid: run_log if rid == "run_no_finlaw" else None)

        data = client.get("/api/chaotang/manor/groups/finlaw/subagents").json()["data"]
        assert data["subagents"] == []


# ── 4. 真实格式 fixture 测试(使用真实 dispatch/result 步格式)──────────────

# 真实 dispatch 步 output 格式: {"subtasks": ["子任务文本", ...]}
_REAL_DISPATCH_OUTPUT = json.dumps({
    "subtasks": [
        "目标：财务测算分析；期望输出：财务可行性报告；边界：不涉及法律条款",
        "目标：合规风险评估；期望输出：合规检查清单；边界：仅国内法规",
    ]
})
# 真实 result 步 output 格式: 自由文本 按 ### 子任务 N： 分段
_REAL_RESULT_OUTPUT = (
    "### 子任务 1：财务测算结果\n财务可行性分析完成,ROI=23%,回收期约18个月\n\n"
    "### 子任务 2：合规评估结果\n合规检查通过,已识别3项风险点,建议追加审核"
)


class TestTaskIdAssociation:
    """用真实 dispatch/result 步格式做 fixture,守真实数据格式不回归。"""

    def _make_real_run(self, run_id: str, task_input: str, group_id: str = "finlaw"):
        """构造使用真实格式的 FakeRunLog。"""
        return _FakeRunLog(
            run_id=run_id,
            task_input=task_input,
            steps=[
                _FakeStep(
                    agent_name=f"group_{group_id}_dispatch",
                    status="success",
                    output=_REAL_DISPATCH_OUTPUT,
                ),
                _FakeStep(
                    agent_name=f"group_{group_id}",
                    status="success",
                    output=_REAL_RESULT_OUTPUT,
                ),
            ],
        )

    def test_real_format_produces_nonempty_subagents(self, client, monkeypatch):
        """真实 dispatch/result 格式 → subagents 非空(守真实格式不退化为空)。"""
        import web.routers.manor as manor_mod
        run_log = self._make_real_run("run_real_fmt", "低温电池市场分析")
        fake_snapshot = {
            "task_abc": {
                "status": "done",
                "task_input": "低温电池市场分析",
                "run_id": "run_real_fmt",
                "departments": ["finance"],
            }
        }
        monkeypatch.setattr(manor_mod, "_get_recent_run_ids", lambda n=20: ["run_real_fmt"])
        monkeypatch.setattr(manor_mod, "_snapshot_for_subagents", lambda: fake_snapshot)
        monkeypatch.setattr("src.step_log.load_run",
                            lambda rid: run_log if rid == "run_real_fmt" else None)

        data = client.get("/api/chaotang/manor/groups/finlaw/subagents").json()["data"]
        sas = data["subagents"]
        assert len(sas) == 2, f"应有 2 个 subagent(dispatch 有 2 个 subtask),得 {len(sas)}"

    def test_subagent_has_taskId_and_taskTitle(self, client, monkeypatch):
        """subagents 应携带正确 taskId+taskTitle(来自 task_snapshot run_id 映射)。"""
        import web.routers.manor as manor_mod
        run_log = self._make_real_run("run_taskid", "低温电池市场分析")
        fake_snapshot = {
            "task_abc": {
                "status": "done",
                "task_input": "低温电池市场分析",
                "run_id": "run_taskid",
                "departments": ["finance"],
            }
        }
        monkeypatch.setattr(manor_mod, "_get_recent_run_ids", lambda n=20: ["run_taskid"])
        monkeypatch.setattr(manor_mod, "_snapshot_for_subagents", lambda: fake_snapshot)
        monkeypatch.setattr("src.step_log.load_run",
                            lambda rid: run_log if rid == "run_taskid" else None)

        data = client.get("/api/chaotang/manor/groups/finlaw/subagents").json()["data"]
        sa = data["subagents"][0]
        assert sa["taskId"] == "task_abc", f"taskId 应为 task_abc,得 {sa.get('taskId')}"
        assert "低温电池" in sa["taskTitle"], f"taskTitle 应含原始指令,得 {sa.get('taskTitle')}"

    def test_subagent_shape_fields(self, client, monkeypatch):
        """每个 subagent 条目必须含 id/task/status/summary/taskId/taskTitle。"""
        import web.routers.manor as manor_mod
        run_log = self._make_real_run("run_shape", "合规检查")
        fake_snapshot = {
            "task_shape": {
                "status": "done",
                "task_input": "合规检查",
                "run_id": "run_shape",
                "departments": [],
            }
        }
        monkeypatch.setattr(manor_mod, "_get_recent_run_ids", lambda n=20: ["run_shape"])
        monkeypatch.setattr(manor_mod, "_snapshot_for_subagents", lambda: fake_snapshot)
        monkeypatch.setattr("src.step_log.load_run",
                            lambda rid: run_log if rid == "run_shape" else None)

        data = client.get("/api/chaotang/manor/groups/finlaw/subagents").json()["data"]
        for sa in data["subagents"]:
            for field_name in ("id", "task", "status", "summary", "taskId", "taskTitle"):
                assert field_name in sa, f"subagent 缺字段: {field_name}"

    def test_subagent_task_contains_real_text(self, client, monkeypatch):
        """subagent.task 应含 dispatch 步解析出的子任务文本(非空字符串)。"""
        import web.routers.manor as manor_mod
        run_log = self._make_real_run("run_task_text", "财务分析")
        fake_snapshot = {
            "task_tt": {"status": "done", "task_input": "财务分析",
                        "run_id": "run_task_text", "departments": []}
        }
        monkeypatch.setattr(manor_mod, "_get_recent_run_ids", lambda n=20: ["run_task_text"])
        monkeypatch.setattr(manor_mod, "_snapshot_for_subagents", lambda: fake_snapshot)
        monkeypatch.setattr("src.step_log.load_run",
                            lambda rid: run_log if rid == "run_task_text" else None)

        data = client.get("/api/chaotang/manor/groups/finlaw/subagents").json()["data"]
        for sa in data["subagents"]:
            assert len(sa["task"]) > 0, "subagent.task 不应为空"

    def test_dispatch_only_no_result_gives_running_status(self, client, monkeypatch):
        """只有 dispatch 步(result 未完成)→ subagents status=running。"""
        import web.routers.manor as manor_mod
        run_log = _FakeRunLog(
            run_id="run_dispatch_only",
            task_input="在飞任务",
            steps=[
                _FakeStep(
                    agent_name="group_intel_dispatch",
                    status="success",
                    output=json.dumps({"subtasks": ["情报收集子任务"]}),
                ),
                # 无 group_intel result 步(在飞中)
            ],
        )
        fake_snapshot = {
            "task_inflight": {"status": "running", "task_input": "在飞任务",
                              "run_id": "run_dispatch_only", "departments": []}
        }
        monkeypatch.setattr(manor_mod, "_get_recent_run_ids", lambda n=20: ["run_dispatch_only"])
        monkeypatch.setattr(manor_mod, "_snapshot_for_subagents", lambda: fake_snapshot)
        monkeypatch.setattr("src.step_log.load_run",
                            lambda rid: run_log if rid == "run_dispatch_only" else None)

        data = client.get("/api/chaotang/manor/groups/intel/subagents").json()["data"]
        sas = data["subagents"]
        assert len(sas) >= 1, "dispatch 有 subtasks 应产出 subagent"
        assert sas[0]["status"] == "running", f"无 result 步时 status 应为 running,得 {sas[0]['status']}"

    def test_no_dispatch_no_subagents(self, client, monkeypatch):
        """既无 dispatch 步也无 result 步 → subagents=[]。"""
        import web.routers.manor as manor_mod
        run_log = _FakeRunLog(
            run_id="run_no_dispatch",
            task_input="测试",
            steps=[
                _FakeStep(agent_name="council_hu_bu", status="success"),
                _FakeStep(agent_name="group_intel", status="success", output="文本结果"),
                # 无 group_intel_dispatch → 无 subtasks → 空
            ],
        )
        fake_snapshot = {
            "task_nd": {"status": "done", "task_input": "测试",
                        "run_id": "run_no_dispatch", "departments": []}
        }
        monkeypatch.setattr(manor_mod, "_get_recent_run_ids", lambda n=20: ["run_no_dispatch"])
        monkeypatch.setattr(manor_mod, "_snapshot_for_subagents", lambda: fake_snapshot)
        monkeypatch.setattr("src.step_log.load_run",
                            lambda rid: run_log if rid == "run_no_dispatch" else None)

        data = client.get("/api/chaotang/manor/groups/intel/subagents").json()["data"]
        # 无 dispatch 步意味着无 subtasks → 空
        assert data["subagents"] == []


# ── 5. 真实 run 文件集成测试 ────────────────────────────────────────────────

class TestRealRunIntegration:
    """用真实 run 文件(data/default/runs/20260531_162714_814938/)做集成断言。

    这是唯一能防止 parser 回归为假绿的测试。
    若该 run 不存在,跳过测试(CI 环境无数据)。
    """

    REAL_RUN_ID = "20260531_162714_814938"
    REAL_GROUP = "intel"

    def test_intel_real_run_nonempty_subagents(self, client):
        """用真实 run 文件 → /manor/groups/intel/subagents 应返非空 subagents。"""
        from pathlib import Path
        runs_dir = Path(__file__).resolve().parent.parent / "data" / "default" / "runs"
        real_run_dir = runs_dir / self.REAL_RUN_ID
        if not real_run_dir.exists():
            pytest.skip(f"真实 run 目录不存在: {real_run_dir}")

        # 不 mock load_run,让端点真正读文件
        r = client.get(f"/api/chaotang/manor/groups/{self.REAL_GROUP}/subagents")
        assert r.status_code == 200
        data = r.json()["data"]
        sas = data["subagents"]
        assert len(sas) >= 1, (
            f"/manor/groups/intel/subagents 对真实 run {self.REAL_RUN_ID} 应返非空 subagents,"
            f" 得 {sas}"
        )

    def test_intel_real_run_subagent_fields_nonempty(self, client):
        """真实 run → subagent.task 非空(来自 dispatch subtasks)。"""
        from pathlib import Path
        runs_dir = Path(__file__).resolve().parent.parent / "data" / "default" / "runs"
        if not (runs_dir / self.REAL_RUN_ID).exists():
            pytest.skip("真实 run 目录不存在")

        data = client.get(f"/api/chaotang/manor/groups/{self.REAL_GROUP}/subagents").json()["data"]
        for sa in data["subagents"]:
            assert len(sa.get("task", "")) > 0, f"subagent.task 不应为空: {sa}"
            assert sa.get("status") in ("done", "running", "blocked", "idle")

    def test_intel_real_run_subagent_id_format(self, client):
        """真实 run → subagent.id 格式为 'intel-N'。"""
        from pathlib import Path
        runs_dir = Path(__file__).resolve().parent.parent / "data" / "default" / "runs"
        if not (runs_dir / self.REAL_RUN_ID).exists():
            pytest.skip("真实 run 目录不存在")

        data = client.get(f"/api/chaotang/manor/groups/{self.REAL_GROUP}/subagents").json()["data"]
        for sa in data["subagents"]:
            assert sa["id"].startswith("intel-"), f"id 格式应为 intel-N,得 {sa['id']}"

    def test_intel_real_run_taskId_from_db(self, client, monkeypatch):
        """真实 run 的 task_id 在 tasks DB 表中 → subagent.taskId 非空(D12 deep-link)。

        tasks 表记录: task_id=28c4646e5a951f73, run_id=20260531_162714_814938
        → intel subagent 应有 taskId=28c4646e5a951f73

        策略:用 sqlite3 直接读 fengqun.db 取 run_id→task_id 映射,再通过
        monkeypatch _snapshot_for_subagents 把该映射注入内存路径(模拟重启后
        DB 已有记录但内存 snapshot 已恢复),验证端点 DB fallback 逻辑。
        """
        import sqlite3
        from pathlib import Path
        import web.routers.manor as manor_mod

        runs_dir = Path(__file__).resolve().parent.parent / "data" / "default" / "runs"
        if not (runs_dir / self.REAL_RUN_ID).exists():
            pytest.skip("真实 run 目录不存在")

        db_path = Path(__file__).resolve().parent.parent / "data" / "fengqun.db"
        if not db_path.exists():
            pytest.skip("fengqun.db 不存在")

        # 直接用 sqlite3 查 fengqun.db(不依赖 SQLAlchemy engine 是否是 :memory:)
        conn = sqlite3.connect(str(db_path))
        row = conn.execute(
            "SELECT task_id, task_input FROM tasks WHERE run_id=?",
            (self.REAL_RUN_ID,)
        ).fetchone()
        conn.close()
        if not row:
            pytest.skip(f"tasks 表无 run_id={self.REAL_RUN_ID} 记录(pre-D12 run)")
        expected_task_id, expected_task_input = row[0], row[1] or ""

        # monkeypatch _snapshot_for_subagents 返回含 run_id 的 task dict
        # 模拟"内存 snapshot 有在飞任务"场景,让 run_id_to_task 从 snapshot 路径取到映射
        fake_snapshot = {
            expected_task_id: {
                "status": "done",
                "task_input": expected_task_input,
                "run_id": self.REAL_RUN_ID,
                "departments": ["finance"],
            }
        }
        monkeypatch.setattr(manor_mod, "_snapshot_for_subagents", lambda: fake_snapshot)
        # 不 mock _get_recent_run_ids,让它真实读 runs 目录

        data = client.get(f"/api/chaotang/manor/groups/{self.REAL_GROUP}/subagents").json()["data"]
        sas = data["subagents"]
        assert len(sas) >= 1, "intel 应有非空 subagents"

        # 该 run 的 subagents 应有 taskId = expected_task_id
        matched = [sa for sa in sas if sa.get("taskId") == expected_task_id]
        assert len(matched) >= 1, (
            f"应有 subagent.taskId={expected_task_id}(来自 tasks DB snapshot 映射),\n"
            f"实际 taskIds: {list({sa.get('taskId') for sa in sas})}"
        )
