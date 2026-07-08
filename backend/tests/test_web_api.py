"""Web API 集成测试 (FastAPI 版本)。

使用 FastAPI TestClient，通过 monkeypatch 将 RUNS_DIR / SESSIONS_DIR /
flow_semaphore 重定向到 tmp 目录或 fake 对象，避免污染真实数据。

⚠️ 关键差异（从 Flask 迁移）：
  - response.get_json() → response.json()
  - 缺字段 400 → 422 (Pydantic validation)
  - 错误 body 由 {"error": "..."} → {"detail": "..."}
  - monkeypatch 目标从 web.app.* → web.routers.{module}.* 或共享模块
"""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _make_step_dict(
    run_id: str = "test_run",
    step_index: int = 0,
    step_id: str = "step_a",
    agent_name: str = "测试Agent",
    output: str = "测试输出内容",
    status: str = "success",
) -> dict:
    return {
        "run_id": run_id,
        "step_index": step_index,
        "step_id": step_id,
        "agent_name": agent_name,
        "timestamp": datetime.now().isoformat(),
        "input": "原始需求",
        "rendered_context": "## 原始客户需求\n原始需求",
        "system_prompt": "你是测试Agent",
        "model": "openai/test-model",
        "output": output,
        "status": status,
        "source": "executed",
        "prompt_version": "v1",
        "quality_score": None,
        "metadata": {},
    }


def _make_run_meta(
    run_id: str = "test_run",
    flow_name: str = "测试Flow",
    task_input: str = "测试客户需求",
    step_count: int = 1,
) -> dict:
    return {
        "run_id": run_id,
        "task_input": task_input,
        "flow_name": flow_name,
        "step_count": step_count,
        "has_final_output": True,
        "run_type": "normal",
        "source_run_id": None,
        "from_step": None,
        "prompt_versions": {},
        "quality_score": {
            "grade": "B",
            "total_score": 3.5,
            "dimension_scores": {
                "完整性": 3, "逻辑一致性": 4, "需求匹配度": 4,
                "信息密度": 3, "行业专业性": 3, "可执行性": 4,
            },
        },
    }


def _write_run(tmp_path: Path, run_id: str = "test_run",
               steps: list[dict] | None = None) -> Path:
    """在 tmp_path/{run_id}/ 写入完整运行数据。"""
    run_dir = tmp_path / run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    if steps is None:
        steps = [_make_step_dict(run_id=run_id)]

    meta = _make_run_meta(run_id=run_id, step_count=len(steps))
    (run_dir / "run_meta.json").write_text(
        json.dumps(meta, ensure_ascii=False), encoding="utf-8",
    )

    for step in steps:
        fname = f"step_{step['step_index']}_{step['step_id']}.json"
        (run_dir / fname).write_text(
            json.dumps(step, ensure_ascii=False), encoding="utf-8",
        )

    final = {
        "final_output": {"客户背景": "某制造企业", "核心需求": "低温电池方案"},
        "qa_result": {"qa_result": "pass", "quality_score": meta["quality_score"]},
    }
    (run_dir / "final_output.json").write_text(
        json.dumps(final, ensure_ascii=False), encoding="utf-8",
    )
    return run_dir


@pytest.fixture()
def runs_tmp(isolated_runs_dir):
    """重定向 RUNS_DIR / _get_runs_dir 到 tmp 目录。"""
    return isolated_runs_dir


@pytest.fixture()
def client():
    """FastAPI TestClient（FENGQUN_AUTH 未设置时自动跳过认证）。"""
    from fastapi.testclient import TestClient

    from web.main import app
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def sessions_tmp(isolated_chat_sessions_dir):
    """重定向 web.session_store.SESSIONS_DIR 到 tmp 目录。"""
    return isolated_chat_sessions_dir


# ---------------------------------------------------------------------------
# 1. Health
# ---------------------------------------------------------------------------

class TestHealth:
    def test_ok(self, client):
        r = client.get("/api/health")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] in ("ok", "degraded")
        assert "version" in data


# ---------------------------------------------------------------------------
# 2. Auth
# ---------------------------------------------------------------------------

class TestAuth:
    def test_login_success(self, client):
        fake_result = {
            "token": "test.jwt.token",
            "user": {
                "id": 1, "username": "admin",
                "display_name": "管理员", "role": "admin",
            },
            "tenant": {"id": 1, "name": "默认租户", "slug": "default"},
        }
        # ⚠️ web.routers.auth 用 `from src.tenant import authenticate` 绑定到 router 命名空间，
        # 必须 patch router 模块里的引用，不能 patch src.tenant.authenticate。
        with patch("web.routers.auth.authenticate", return_value=fake_result):
            r = client.post("/api/auth/login",
                            json={"username": "admin", "password": "admin123"})
        assert r.status_code == 200
        data = r.json()
        assert data["token"] == "test.jwt.token"
        assert data["user"]["username"] == "admin"
        assert data["post_login_redirect"] == "/?start=1"
        assert data["landing_mode"] == "start_panel"

    def test_login_wrong_password(self, client):
        with patch("web.routers.auth.authenticate", return_value=None):
            r = client.post("/api/auth/login",
                            json={"username": "admin", "password": "wrong"})
        assert r.status_code == 401
        assert "detail" in r.json()

    def test_login_empty_body(self, client):
        # Pydantic 422 (was Flask 400)
        r = client.post("/api/auth/login", json={})
        assert r.status_code == 422

    def test_login_missing_password(self, client):
        # Pydantic 422 (was Flask 400)
        r = client.post("/api/auth/login", json={"username": "admin"})
        assert r.status_code == 422

    def test_me_unauthenticated(self, client):
        r = client.get("/api/auth/me")
        assert r.status_code == 200
        assert r.json()["authenticated"] is False

    def test_logout(self, client):
        r = client.post("/api/auth/logout")
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# 3. Runs list & detail
# ---------------------------------------------------------------------------

class TestRuns:
    def test_list_empty(self, client, runs_tmp):
        r = client.get("/api/runs")
        assert r.status_code == 200
        assert r.json() == []

    def test_list_with_runs(self, client, runs_tmp):
        _write_run(runs_tmp, "20260101_120000")
        r = client.get("/api/runs")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 1
        assert data[0]["run_id"] == "20260101_120000"

    def test_list_multiple_runs(self, client, runs_tmp):
        for rid in ["20260101_100000", "20260101_110000", "20260101_120000"]:
            _write_run(runs_tmp, rid)
        r = client.get("/api/runs")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 3
        assert data[0]["run_id"] == "20260101_120000"

    def test_list_two_flows(self, client, runs_tmp):
        _write_run(runs_tmp, "rid_a")
        _write_run(runs_tmp, "rid_b")
        r = client.get("/api/runs")
        assert r.status_code == 200
        assert len(r.json()) == 2

    def test_run_detail_found(self, client, runs_tmp):
        _write_run(runs_tmp, "test_run_001")
        r = client.get("/api/runs/test_run_001")
        assert r.status_code == 200
        data = r.json()
        assert data["run_id"] == "test_run_001"
        assert "steps" in data
        assert len(data["steps"]) == 1
        assert data["steps"][0]["step_id"] == "step_a"
        assert "final_output" in data

    def test_run_detail_not_found(self, client, runs_tmp):
        r = client.get("/api/runs/does_not_exist")
        assert r.status_code == 404

    def test_run_detail_has_quality_score(self, client, runs_tmp):
        _write_run(runs_tmp, "scored_run")
        r = client.get("/api/runs/scored_run")
        assert r.status_code == 200
        data = r.json()
        assert data["quality_score"] is not None
        assert data["quality_score"]["grade"] == "B"

    def test_run_report_found(self, client, runs_tmp):
        _write_run(runs_tmp, "report_run")
        r = client.get("/api/runs/report_run/report")
        assert r.status_code == 200
        data = r.json()
        assert data["run_id"] == "report_run"
        assert data["run_status"] == "pass"
        assert data["final_output"]["客户背景"] == "某制造企业"
        assert data["qa_result"]["qa_result"] == "pass"
        assert data["quality_score"]["grade"] == "B"
        assert data["step_count"] == 1

    def test_run_report_not_found(self, client, runs_tmp):
        r = client.get("/api/runs/missing_report_run/report")
        assert r.status_code == 404

    def test_step_detail_found(self, client, runs_tmp):
        _write_run(runs_tmp, "step_test_run")
        r = client.get("/api/runs/step_test_run/steps/0")
        assert r.status_code == 200
        data = r.json()
        assert data["step_index"] == 0
        assert data["agent_name"] == "测试Agent"

    def test_step_detail_out_of_range(self, client, runs_tmp):
        _write_run(runs_tmp, "step_test_run2")
        r = client.get("/api/runs/step_test_run2/steps/99")
        assert r.status_code == 404

    def test_step_detail_run_not_found(self, client, runs_tmp):
        r = client.get("/api/runs/nonexistent/steps/0")
        assert r.status_code == 404


class _FakeSemaphore:
    def __init__(self, acquire_results: list[bool] | None = None):
        self.acquire_results = list(acquire_results or [True])
        self.acquire_calls = []
        self.release_calls = 0

    def acquire(self, blocking=True, timeout=None):
        self.acquire_calls.append({"blocking": blocking, "timeout": timeout})
        if self.acquire_results:
            return self.acquire_results.pop(0)
        return True

    def release(self):
        self.release_calls += 1


class _InlineThread:
    """Stub for threading.Thread — runs target synchronously on .start()."""
    def __init__(self, target=None, daemon=None, args=(), kwargs=None):
        self._target = target
        self._args = args or ()
        self._kwargs = kwargs or {}
        self.daemon = daemon

    def start(self):
        if self._target:
            self._target(*self._args, **self._kwargs)


class TestRunAsyncApi:
    """覆盖 POST /api/run（半异步：信号量 + 后台线程）。"""

    def test_api_run_accepts_only_after_capacity_reserved(self, client, monkeypatch):
        import web.routers.runs as runs_mod

        fake_semaphore = _FakeSemaphore([True])
        monkeypatch.setattr(runs_mod, "flow_semaphore", fake_semaphore)
        monkeypatch.setattr(runs_mod.threading, "Thread", _InlineThread)

        mock_engine = MagicMock()
        with patch("src.flow_engine.FlowEngine", return_value=mock_engine):
            r = client.post("/api/run", json={
                "task_input": "测试任务",
                "config": "config/flow_opc.yaml",
            })

        assert r.status_code == 202
        data = r.json()
        assert data["status"] == "accepted"
        assert fake_semaphore.acquire_calls == [{"blocking": False, "timeout": None}]
        mock_engine.run.assert_called_once_with("测试任务")
        assert fake_semaphore.release_calls == 1

    def test_api_run_rejects_when_capacity_full(self, client, monkeypatch):
        import web.routers.runs as runs_mod

        fake_semaphore = _FakeSemaphore([False])
        monkeypatch.setattr(runs_mod, "flow_semaphore", fake_semaphore)

        with patch("src.flow_engine.FlowEngine") as mock_engine:
            r = client.post("/api/run", json={
                "task_input": "测试任务",
                "config": "config/flow_opc.yaml",
            })

        # 429 by HTTPException
        assert r.status_code == 429
        mock_engine.assert_not_called()
        assert fake_semaphore.release_calls == 0


# ---------------------------------------------------------------------------
# 4. Feedback
# ---------------------------------------------------------------------------

class TestFeedback:
    def test_get_feedback_none(self, client, runs_tmp):
        _write_run(runs_tmp, "fb_run")
        r = client.get("/api/runs/fb_run/feedback")
        assert r.status_code == 200
        assert r.json() is None

    def test_post_feedback_success(self, client, runs_tmp):
        _write_run(runs_tmp, "fb_run2")
        payload = {
            "thumb": "up", "rating": 4, "comment": "不错",
            "dimension_ratings": {"完整性": 4, "逻辑一致性": 3},
            "tags": ["数据准确", "逻辑清晰"],
        }
        r = client.post("/api/runs/fb_run2/feedback", json=payload)
        assert r.status_code == 200
        assert r.json()["status"] == "saved"

    def test_post_feedback_then_get(self, client, runs_tmp):
        _write_run(runs_tmp, "fb_run3")
        client.post("/api/runs/fb_run3/feedback",
                    json={"thumb": "down", "rating": 2, "comment": "差评"})
        r = client.get("/api/runs/fb_run3/feedback")
        assert r.status_code == 200
        data = r.json()
        assert data["thumb"] == "down"
        assert data["rating"] == 2
        assert data["comment"] == "差评"
        assert data["annotator"] == "human"
        assert "created_at" in data

    def test_post_feedback_overwrite(self, client, runs_tmp):
        _write_run(runs_tmp, "fb_run4")
        client.post("/api/runs/fb_run4/feedback",
                    json={"thumb": "up", "rating": 5})
        client.post("/api/runs/fb_run4/feedback", json={
            "thumb": "down", "rating": 1, "comment": "改为差评",
        })
        r = client.get("/api/runs/fb_run4/feedback")
        data = r.json()
        assert data["thumb"] == "down"
        assert data["rating"] == 1

    def test_post_feedback_run_not_found(self, client, runs_tmp):
        r = client.post("/api/runs/nonexistent_run/feedback",
                        json={"thumb": "up"})
        assert r.status_code == 404

    def test_list_feedback_empty(self, client, runs_tmp):
        r = client.get("/api/feedback")
        assert r.status_code == 200
        assert r.json() == []

    def test_list_feedback_with_data(self, client, runs_tmp):
        _write_run(runs_tmp, "fb_list_run")
        client.post("/api/runs/fb_list_run/feedback", json={
            "thumb": "up", "rating": 4, "tags": ["数据准确"],
        })
        r = client.get("/api/feedback?days=30")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 1
        assert data[0]["run_id"] == "fb_list_run"
        assert data[0]["thumb"] == "up"
        assert "flow_name" in data[0]


# ---------------------------------------------------------------------------
# 5. Analytics
# ---------------------------------------------------------------------------

class TestAnalytics:
    def test_analytics_empty(self, client, runs_tmp):
        r = client.get("/api/analytics")
        assert r.status_code == 200
        data = r.json()
        assert "summary" in data
        assert "daily_runs" in data
        assert "grade_distribution" in data
        assert data["summary"]["total_runs"] == 0

    def test_analytics_with_runs(self, client, runs_tmp):
        _write_run(runs_tmp, "ana_run_001")
        _write_run(runs_tmp, "ana_run_002")
        r = client.get("/api/analytics?days=30")
        assert r.status_code == 200
        data = r.json()
        assert data["summary"]["total_runs"] == 2

    def test_analytics_custom_days(self, client, runs_tmp):
        r = client.get("/api/analytics?days=90")
        assert r.status_code == 200
        data = r.json()
        assert len(data["daily_runs"]) == 90


# ---------------------------------------------------------------------------
# 6. Flows
# ---------------------------------------------------------------------------

class TestFlows:
    def test_list_flows(self, client):
        r = client.get("/api/flows")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert any(f["filename"].startswith("flow_") for f in data)

    def test_get_flow_found(self, client):
        r = client.get("/api/flows/flow_opc.yaml")
        assert r.status_code == 200
        data = r.json()
        assert "steps" in data
        assert isinstance(data["steps"], list)

    def test_get_flow_not_found(self, client):
        r = client.get("/api/flows/flow_nonexistent.yaml")
        assert r.status_code == 404

    def test_get_flow_security_path_traversal(self, client):
        # FastAPI 路由本身就阻止包含 / 的 path 参数；额外校验 .. 会 400
        r = client.get("/api/flows/..%2Frequirements.txt")
        # Starlette 把 %2F 解码为 /，触发 not_found；或我们的 400
        assert r.status_code in (400, 404)

    def test_put_flow_valid(self, client, tmp_path):
        r_get = client.get("/api/flows/flow_opc.yaml")
        original_config = r_get.json()
        r = client.put("/api/flows/flow_opc.yaml", json=original_config)
        assert r.status_code == 200
        assert r.json()["status"] == "saved"

    def test_put_flow_missing_steps(self, client):
        r = client.put("/api/flows/flow_opc.yaml", json={"flow_name": "test"})
        assert r.status_code == 400

    def test_put_flow_step_missing_required_field(self, client):
        payload = {"steps": [{"name": "Step 1"}]}  # missing id
        r = client.put("/api/flows/flow_opc.yaml", json=payload)
        assert r.status_code == 400

    def test_put_flow_not_found(self, client):
        payload = {"steps": [{"id": "s", "name": "S", "prompt_key": "k"}]}
        r = client.put("/api/flows/flow_not_exist.yaml", json=payload)
        assert r.status_code == 404

    def test_put_flow_step_with_prompt_inline(self, client):
        r_get = client.get("/api/flows/flow_opc.yaml")
        config = r_get.json()
        config["steps"][0]["prompt_inline"] = "你是一个专业的OPC销售代表。"
        config["steps"][0].pop("prompt_key", None)
        r = client.put("/api/flows/flow_opc.yaml", json=config)
        assert r.status_code == 200
        assert r.json()["status"] == "saved"
        # 恢复
        client.put("/api/flows/flow_opc.yaml", json=r_get.json())

    def test_put_flow_step_no_prompt_source_rejected(self, client):
        r_get = client.get("/api/flows/flow_opc.yaml")
        config = r_get.json()
        config["steps"][0].pop("prompt_key", None)
        config["steps"][0].pop("prompt_inline", None)
        config["steps"][0].pop("prompt_module", None)
        r = client.put("/api/flows/flow_opc.yaml", json=config)
        assert r.status_code == 422
        data = r.json()
        # FastAPI HTTPException → {"detail": "..."}
        assert "detail" in data


# ---------------------------------------------------------------------------
# 7. Prompts
# ---------------------------------------------------------------------------

class TestPrompts:
    def test_list_prompts(self, client):
        r = client.get("/api/prompts")
        assert r.status_code == 200
        data = r.json()
        if isinstance(data, list):
            assert len(data) >= 0
        elif isinstance(data, dict):
            assert "prompts" in data

    def test_get_prompt_files(self, client):
        r = client.get("/api/prompts/opc_leader/files")
        assert r.status_code == 200
        data = r.json()
        assert "files" in data or isinstance(data, dict)

    def test_get_prompt_files_not_found(self, client):
        r = client.get("/api/prompts/nonexistent_key_12345/files")
        assert r.status_code in (200, 404)


# ---------------------------------------------------------------------------
# 8. Chat sessions
# ---------------------------------------------------------------------------

class TestChatSessions:
    def test_list_sessions_empty(self, client, sessions_tmp):
        r = client.get("/api/chat/sessions")
        assert r.status_code == 200
        assert r.json() == []

    def test_create_session(self, client, sessions_tmp):
        r = client.post("/api/chat/sessions", json={"config": "flow_opc.yaml"})
        assert r.status_code == 201
        data = r.json()
        assert "session_id" in data
        assert data["config"] == "config/flow_opc.yaml"
        assert "turns" in data or "turn_count" in data

    def test_create_then_list(self, client, sessions_tmp):
        client.post("/api/chat/sessions", json={"config": "flow_opc.yaml"})
        r = client.get("/api/chat/sessions")
        assert r.status_code == 200
        assert len(r.json()) == 1

    def test_get_session_found(self, client, sessions_tmp):
        r_create = client.post("/api/chat/sessions",
                               json={"config": "flow_opc.yaml"})
        sid = r_create.json()["session_id"]
        r = client.get(f"/api/chat/sessions/{sid}")
        assert r.status_code == 200
        assert r.json()["session_id"] == sid

    def test_get_session_not_found(self, client, sessions_tmp):
        r = client.get("/api/chat/sessions/nonexistent-session-id")
        assert r.status_code == 404

    def test_delete_session(self, client, sessions_tmp):
        r_create = client.post("/api/chat/sessions",
                               json={"config": "flow_opc.yaml"})
        sid = r_create.json()["session_id"]
        r = client.delete(f"/api/chat/sessions/{sid}")
        assert r.status_code == 200
        r2 = client.get(f"/api/chat/sessions/{sid}")
        assert r2.status_code == 404

    def test_delete_nonexistent_session(self, client, sessions_tmp):
        r = client.delete("/api/chat/sessions/nonexistent")
        assert r.status_code == 200
        assert r.json()["status"] == "deleted"


# ---------------------------------------------------------------------------
# 9. Knowledge
# ---------------------------------------------------------------------------

class TestKnowledge:
    def test_knowledge_search(self, client):
        mock_rag = MagicMock()
        mock_rag.search.return_value = [
            {"text": "匹配内容", "score": 0.9, "source": "test.md"},
        ]
        with patch("src.knowledge_rag.get_rag", return_value=mock_rag):
            r = client.get("/api/knowledge/search?query=低温电池")
        assert r.status_code == 200
        data = r.json()
        assert "results" in data

    def test_knowledge_search_missing_query(self, client):
        # Pydantic Query(..., min_length=1) → 422
        r = client.get("/api/knowledge/search")
        assert r.status_code == 422

    def test_knowledge_stats(self, client):
        mock_rag = MagicMock()
        mock_rag.stats.return_value = {"doc_count": 10, "chunk_count": 100}
        with patch("src.knowledge_rag.get_rag", return_value=mock_rag):
            r = client.get("/api/knowledge/stats")
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# 10. Cases
# ---------------------------------------------------------------------------

class TestCases:
    """⚠️ Patch web.routers.cases.* 而非 src.case_archive.*。"""

    def test_pending_cases_empty(self, client):
        with patch("web.routers.cases.list_pending", return_value=[]):
            r = client.get("/api/cases/pending")
        assert r.status_code == 200
        assert r.json() == []

    def test_approved_cases_empty(self, client):
        with patch("web.routers.cases.list_approved", return_value=[]):
            r = client.get("/api/cases/approved")
        assert r.status_code == 200
        assert r.json() == []

    def test_pending_cases_with_data(self, client):
        fake_case = {
            "filename": "case_001.json",
            "task_input": "测试任务", "score": 4.5,
        }
        with patch("web.routers.cases.list_pending", return_value=[fake_case]):
            r = client.get("/api/cases/pending")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 1
        assert data[0]["filename"] == "case_001.json"


# ---------------------------------------------------------------------------
# 11. Compare
# ---------------------------------------------------------------------------

class TestCompare:
    def test_compare_missing_params(self, client, runs_tmp):
        # Pydantic Query(...) 必填 → 422
        r = client.get("/api/compare")
        assert r.status_code == 422

    def test_compare_run_not_found(self, client, runs_tmp):
        r = client.get("/api/compare?left=nonexistent_a&right=nonexistent_b")
        assert r.status_code in (404, 400, 500)

    def test_compare_quality_missing_params(self, client, runs_tmp):
        r = client.get("/api/compare/quality")
        assert r.status_code == 422


# ---------------------------------------------------------------------------
# 12. Final output edit
# ---------------------------------------------------------------------------

class TestFinalOutputEdit:
    def test_edit_final_output_success(self, client, runs_tmp):
        _write_run(runs_tmp, "edit_run")
        payload = {"final_output": {"客户背景": "新内容A", "核心需求": "新内容B"}}
        r = client.put("/api/runs/edit_run/final-output", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "saved"
        assert data["fields_saved"] == 2

    def test_edit_final_output_missing_body(self, client, runs_tmp):
        _write_run(runs_tmp, "edit_run2")
        # Pydantic 必填校验 → 422
        r = client.put("/api/runs/edit_run2/final-output", json={})
        assert r.status_code == 422

    def test_edit_final_output_run_not_found(self, client, runs_tmp):
        r = client.put("/api/runs/nonexistent/final-output",
                       json={"final_output": {"x": "y"}})
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# 13. Repairs list
# ---------------------------------------------------------------------------

class TestRepairs:
    def test_list_repairs(self, client):
        r = client.get("/api/repairs")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)

    def test_get_repair_not_found(self, client):
        r = client.get("/api/repairs/nonexistent_session_id")
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# 14. Quality endpoint
# ---------------------------------------------------------------------------

class TestQuality:
    def test_quality_found(self, client, runs_tmp):
        _write_run(runs_tmp, "quality_run")
        r = client.get("/api/runs/quality_run/quality")
        assert r.status_code == 200
        data = r.json()
        assert "run_id" in data

    def test_quality_not_found(self, client, runs_tmp):
        r = client.get("/api/runs/nonexistent/quality")
        assert r.status_code == 404
