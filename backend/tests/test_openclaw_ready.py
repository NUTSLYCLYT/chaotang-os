# tests/test_openclaw_ready.py
"""T-be5: openclaw 可插拔运行时 pytest。

覆盖:
  1. openclaw_client.post_tasks() 成功/HTTP错误/响应格式错误
  2. ManorGroup.resolved_runtime() env 有/无/空字符串
  3. assemble_flow() spawn/openclaw env 切换,混合组
  4. FlowEngine openclaw_dispatch step:成功调用/error fallback/timeout fallback
"""
from __future__ import annotations

import json
import pytest
from unittest.mock import MagicMock, patch


# ──────────────── 1. openclaw_client ────────────────────────────────────────

class TestOpenclaw_Client:
    def test_post_tasks_returns_results(self, monkeypatch):
        """post_tasks 成功时返回与 subtasks 等长的结果列表。"""
        fake_resp = MagicMock()
        fake_resp.raise_for_status.return_value = None
        fake_resp.json.return_value = {"results": ["结果A", "结果B"]}

        monkeypatch.setattr("src.openclaw_client.httpx.post",
                            lambda url, json, timeout: fake_resp)
        from src.openclaw_client import post_tasks
        results = post_tasks("http://fake-openclaw", ["任务1", "任务2"])
        assert results == ["结果A", "结果B"]

    def test_post_tasks_uses_correct_endpoint(self, monkeypatch):
        """post_tasks 向 {base_url}/tasks 发 POST。"""
        called = {}
        fake_resp = MagicMock()
        fake_resp.raise_for_status.return_value = None
        fake_resp.json.return_value = {"results": ["r"]}

        def fake_post(url, json, timeout):
            called["url"] = url
            return fake_resp

        monkeypatch.setattr("src.openclaw_client.httpx.post", fake_post)
        from src.openclaw_client import post_tasks
        post_tasks("http://fake-openclaw:9000/", ["t"])
        assert called["url"] == "http://fake-openclaw:9000/tasks"

    def test_post_tasks_raises_on_http_error(self, monkeypatch):
        """HTTP 4xx/5xx 时 post_tasks 抛 OpenclawError。"""
        import httpx
        fake_resp = MagicMock()
        fake_resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            "500", request=MagicMock(), response=MagicMock()
        )
        monkeypatch.setattr("src.openclaw_client.httpx.post",
                            lambda url, json, timeout: fake_resp)
        from src.openclaw_client import post_tasks, OpenclawError
        with pytest.raises(OpenclawError):
            post_tasks("http://fake-openclaw", ["任务1"])

    def test_post_tasks_raises_on_missing_results_key(self, monkeypatch):
        """响应缺 results 字段时抛 OpenclawError。"""
        fake_resp = MagicMock()
        fake_resp.raise_for_status.return_value = None
        fake_resp.json.return_value = {"data": []}  # 格式不符

        monkeypatch.setattr("src.openclaw_client.httpx.post",
                            lambda url, json, timeout: fake_resp)
        from src.openclaw_client import post_tasks, OpenclawError
        with pytest.raises(OpenclawError):
            post_tasks("http://fake-openclaw", ["任务1"])

    def test_post_tasks_propagates_timeout(self, monkeypatch):
        """超时时 httpx.TimeoutException 向上传播(调用方负责 fallback)。"""
        import httpx
        monkeypatch.setattr("src.openclaw_client.httpx.post",
                            lambda url, json, timeout: (_ for _ in ()).throw(
                                httpx.TimeoutException("timeout")))
        from src.openclaw_client import post_tasks
        with pytest.raises(httpx.TimeoutException):
            post_tasks("http://fake-openclaw", ["任务1"])


# ──────────────── 2. ManorGroup.resolved_runtime() ──────────────────────────

class TestManorGroupResolvedRuntime:
    def _make_group(self, openclaw_base_url_env: str | None):
        from src.manor_groups import ManorGroup
        return ManorGroup(
            id="finlaw", name="财法组",
            ministers=["hu_bu", "xing_bu"],
            subagent_max=3, runtime="spawn",
            openclaw_base_url_env=openclaw_base_url_env,
            desc="财务/法务",
        )

    def test_no_env_key_returns_spawn(self):
        """openclaw_base_url_env=None → resolved_runtime=='spawn'。"""
        g = self._make_group(None)
        assert g.resolved_runtime() == "spawn"

    def test_env_key_set_returns_openclaw(self, monkeypatch):
        """环境变量有值 → resolved_runtime=='openclaw'。"""
        monkeypatch.setenv("OPENCLAW_FINLAW_URL", "http://openclaw:9000")
        g = self._make_group("OPENCLAW_FINLAW_URL")
        assert g.resolved_runtime() == "openclaw"

    def test_env_key_declared_but_not_set_returns_spawn(self, monkeypatch):
        """env key 声明了但环境变量未设 → resolved_runtime=='spawn'。"""
        monkeypatch.delenv("OPENCLAW_FINLAW_URL", raising=False)
        g = self._make_group("OPENCLAW_FINLAW_URL")
        assert g.resolved_runtime() == "spawn"

    def test_env_key_empty_string_returns_spawn(self, monkeypatch):
        """env var 为空字符串(falsy) → resolved_runtime=='spawn'。"""
        monkeypatch.setenv("OPENCLAW_FINLAW_URL", "")
        g = self._make_group("OPENCLAW_FINLAW_URL")
        assert g.resolved_runtime() == "spawn"


# ──────────────── 3. assemble_flow() openclaw step 输出 ─────────────────────

class TestAssembleFlowOpenclaw:
    def _plan(self, **kw):
        base = {"intent": "测试", "ministers": ["hu_bu"], "groups": ["finlaw"]}
        base.update(kw)
        return base

    def test_spawn_runtime_produces_spawn_step(self, monkeypatch, tmp_path):
        """env 未设 → group step step_type==spawn,无 openclaw_base_url。"""
        import yaml
        from src import chaotang_orchestrator as orch
        monkeypatch.delenv("OPENCLAW_FINLAW_URL", raising=False)
        path = orch.assemble_flow(self._plan(), task_id="t_spawn", out_dir=tmp_path)
        cfg = yaml.safe_load(open(path, encoding="utf-8"))
        group_step = next(s for s in cfg["steps"] if s["id"] == "group_finlaw")
        assert group_step.get("step_type") == "spawn"
        assert "openclaw_base_url" not in group_step

    def test_openclaw_runtime_produces_openclaw_dispatch_step(self, monkeypatch, tmp_path):
        """env 有值 → group step step_type==openclaw_dispatch + openclaw_base_url。"""
        import yaml
        from src import chaotang_orchestrator as orch
        monkeypatch.setenv("OPENCLAW_FINLAW_URL", "http://openclaw-finlaw:9000")
        path = orch.assemble_flow(self._plan(), task_id="t_oc", out_dir=tmp_path)
        cfg = yaml.safe_load(open(path, encoding="utf-8"))
        group_step = next(s for s in cfg["steps"] if s["id"] == "group_finlaw")
        assert group_step.get("step_type") == "openclaw_dispatch"
        assert group_step.get("openclaw_base_url") == "http://openclaw-finlaw:9000"
        # fallback 字段保留(供 FlowEngine fallback spawn 用)
        assert group_step.get("spawn_from_field") == "subtasks"
        assert group_step.get("spawn_agent_id") == "group_finlaw_dispatch"

    def test_mixed_groups_only_openclaw_env_set(self, monkeypatch, tmp_path):
        """部分组有 env(openclaw),部分无(spawn),各自正确。"""
        import yaml
        from src import chaotang_orchestrator as orch
        monkeypatch.setenv("OPENCLAW_INTEL_URL", "http://openclaw-intel:9000")
        monkeypatch.delenv("OPENCLAW_FINLAW_URL", raising=False)
        plan = {"intent": "测试", "ministers": ["hu_bu", "jin_yi_wei"],
                "groups": ["finlaw", "intel"]}
        path = orch.assemble_flow(plan, task_id="t_mix", out_dir=tmp_path)
        cfg = yaml.safe_load(open(path, encoding="utf-8"))
        finlaw_step = next(s for s in cfg["steps"] if s["id"] == "group_finlaw")
        intel_step = next(s for s in cfg["steps"] if s["id"] == "group_intel")
        assert finlaw_step.get("step_type") == "spawn"
        assert intel_step.get("step_type") == "openclaw_dispatch"
        assert intel_step.get("openclaw_base_url") == "http://openclaw-intel:9000"


# ──────────────── 4. FlowEngine openclaw_dispatch step ─────────────────────

class TestFlowEngineOpenclaw_Dispatch:
    """验证 FlowEngine 处理 step_type==openclaw_dispatch 的三条路径:
    成功 / OpenclawError fallback spawn / TimeoutException fallback spawn。
    """

    def _make_flow_yaml(self, tmp_path, openclaw_url: str = "http://fake:9000"):
        """最小 flow:dispatch(输出 subtasks JSON) → openclaw_dispatch group。"""
        import yaml as _yaml
        steps = [
            {
                "id": "dispatch", "name": "dispatch",
                "model": "openai/qwen-turbo",
                "api_base": "https://dashscope.aliyuncs.com/compatible-mode/v1",
                "api_key_env": "DASHSCOPE_API_KEY",
                "prompt_inline": '严格输出 JSON:{"subtasks":["任务A","任务B"]}',
            },
            {
                "id": "oc_group", "name": "oc_group",
                "step_type": "openclaw_dispatch",
                "openclaw_base_url": openclaw_url,
                "depends_on": ["dispatch"],
                "model": "openai/qwen-turbo",
                "api_base": "https://dashscope.aliyuncs.com/compatible-mode/v1",
                "api_key_env": "DASHSCOPE_API_KEY",
                "prompt_inline": "子代理执行",
                "spawn_from_field": "subtasks",
                "spawn_max_workers": 2,
                "spawn_merge": "numbered",
                "spawn_agent_id": "dispatch",
            },
        ]
        cfg = {
            "flow_name": "test_openclaw_dispatch",
            "default_model": "openai/qwen-turbo",
            "default_api_base": "https://dashscope.aliyuncs.com/compatible-mode/v1",
            "default_api_key_env": "DASHSCOPE_API_KEY",
            # qa_version 故意省略:避免 QA 步骤在 mock 环境下 KeyError
            "steps": steps,
        }
        p = tmp_path / "test_oc_dispatch.yaml"
        p.write_text(_yaml.safe_dump(cfg, allow_unicode=True), encoding="utf-8")
        return str(p)

    def test_openclaw_dispatch_calls_post_tasks(self, monkeypatch, tmp_path):
        """openclaw_dispatch step 调 post_tasks,结果写入 step_log.output。"""
        from src.flow_engine import FlowEngine

        dispatch_output = json.dumps({"subtasks": ["任务A", "任务B"]})

        def fake_call(self_inner, system_prompt="", user_prompt="", **kw):
            return {"output": dispatch_output, "status": "success",
                    "model": "fake", "prompt": "", "usage": {}}

        monkeypatch.setattr("src.model_adapter.ModelAdapter.call", fake_call)

        called_with: dict = {}

        def fake_post_tasks(base_url, subtasks, **kw):
            called_with["base_url"] = base_url
            called_with["subtasks"] = subtasks
            return ["openclaw结果A", "openclaw结果B"]

        monkeypatch.setattr("src.openclaw_client.post_tasks", fake_post_tasks)

        flow_path = self._make_flow_yaml(tmp_path)
        engine = FlowEngine(flow_path, qa_version="v2")
        run_log = engine.run("测试任务")

        assert called_with.get("base_url") == "http://fake:9000"
        assert called_with.get("subtasks") == ["任务A", "任务B"]

        oc_step = next(
            (s for s in (run_log.steps or []) if getattr(s, "agent_name", "") == "oc_group"),
            None,
        )
        assert oc_step is not None, "应有 oc_group step log"
        assert "openclaw结果A" in (oc_step.output or "")
        assert "openclaw结果B" in (oc_step.output or "")

    def test_openclaw_dispatch_fallback_on_openclaw_error(self, monkeypatch, tmp_path):
        """post_tasks 抛 OpenclawError → fallback spawn,flow 不崩溃。"""
        from src.flow_engine import FlowEngine
        from src.openclaw_client import OpenclawError

        dispatch_output = json.dumps({"subtasks": ["任务A"]})

        def fake_call(self_inner, system_prompt="", user_prompt="", **kw):
            return {"output": dispatch_output, "status": "success",
                    "model": "fake", "prompt": "", "usage": {}}

        monkeypatch.setattr("src.model_adapter.ModelAdapter.call", fake_call)

        def failing_post_tasks(base_url, subtasks, **kw):
            raise OpenclawError("服务不可达")

        monkeypatch.setattr("src.openclaw_client.post_tasks", failing_post_tasks)

        flow_path = self._make_flow_yaml(tmp_path)
        engine = FlowEngine(flow_path)
        # fallback 后 spawn 继续,run_log 不为 None
        run_log = engine.run("测试任务")
        assert run_log is not None

    def test_openclaw_dispatch_fallback_on_timeout(self, monkeypatch, tmp_path):
        """post_tasks 超时 → fallback spawn,flow 不崩溃。"""
        import httpx
        from src.flow_engine import FlowEngine

        dispatch_output = json.dumps({"subtasks": ["任务A"]})

        def fake_call(self_inner, system_prompt="", user_prompt="", **kw):
            return {"output": dispatch_output, "status": "success",
                    "model": "fake", "prompt": "", "usage": {}}

        monkeypatch.setattr("src.model_adapter.ModelAdapter.call", fake_call)

        def timeout_post_tasks(base_url, subtasks, **kw):
            raise httpx.TimeoutException("timeout")

        monkeypatch.setattr("src.openclaw_client.post_tasks", timeout_post_tasks)

        flow_path = self._make_flow_yaml(tmp_path)
        engine = FlowEngine(flow_path)
        run_log = engine.run("测试任务")
        assert run_log is not None
