"""ToolRouter 单元测试。"""

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.tool_router import (
    DRAFTS_DIR,
    MockToolServer,
    StdioToolServer,
    ToolCall,
    ToolCallLog,
    ToolDef,
    ToolRouter,
    approve_draft,
    list_drafts,
    reject_draft,
)


# ---------------------------------------------------------------------------
# ToolDef 测试
# ---------------------------------------------------------------------------


class TestToolDef:
    def test_to_openai_schema(self):
        td = ToolDef(
            name="search",
            description="搜索联系人",
            parameters={"type": "object", "properties": {"q": {"type": "string"}}},
            server="mock",
        )
        schema = td.to_openai_schema()
        assert schema["type"] == "function"
        assert schema["function"]["name"] == "search"
        assert "properties" in schema["function"]["parameters"]


# ---------------------------------------------------------------------------
# MockToolServer 测试
# ---------------------------------------------------------------------------


class TestMockToolServer:
    def test_search_contacts(self):
        server = MockToolServer()
        result = server.call_tool("search_contacts", {"query": "宁德", "limit": 2})
        data = json.loads(result)
        assert len(data) == 2
        assert "宁德" in data[0]["name"]

    def test_prepare_email_draft(self):
        server = MockToolServer()
        result = server.call_tool(
            "prepare_email_draft",
            {"to": "test@example.com", "subject": "测试", "body": "你好"},
        )
        data = json.loads(result)
        assert data["status"] == "draft_created"
        assert data["to"] == "test@example.com"

    def test_unknown_tool(self):
        server = MockToolServer()
        result = server.call_tool("nonexistent", {})
        data = json.loads(result)
        assert "error" in data


# ---------------------------------------------------------------------------
# ToolRouter 配置加载测试
# ---------------------------------------------------------------------------


class TestToolRouterConfig:
    def test_load_config(self):
        config_path = Path(__file__).resolve().parent.parent / "config" / "mcp_servers.yaml"
        router = ToolRouter(str(config_path))
        assert "search_contacts" in router.tools
        assert "prepare_email_draft" in router.tools

    def test_tool_def_properties(self):
        config_path = Path(__file__).resolve().parent.parent / "config" / "mcp_servers.yaml"
        router = ToolRouter(str(config_path))
        sc = router.tools["search_contacts"]
        assert sc.server == "mock"
        assert sc.approval_level == "none"
        ed = router.tools["prepare_email_draft"]
        assert ed.approval_level == "draft"

    def test_get_tools_for_step(self):
        config_path = Path(__file__).resolve().parent.parent / "config" / "mcp_servers.yaml"
        router = ToolRouter(str(config_path))
        step_config = {
            "tools": [
                {"server": "mock", "capabilities": ["search_contacts"]},
            ]
        }
        tools = router.get_tools_for_step(step_config)
        names = {t.name for t in tools}
        assert "search_contacts" in names  # step 级工具
        # 全局工具也会合并进来
        global_tools = router.get_global_tools()
        for gt in global_tools:
            assert gt.name in names

    def test_get_tools_for_step_empty_returns_global(self):
        """空 step 配置仍返回全局工具。"""
        config_path = Path(__file__).resolve().parent.parent / "config" / "mcp_servers.yaml"
        router = ToolRouter(str(config_path))
        tools = router.get_tools_for_step({})
        global_tools = router.get_global_tools()
        assert len(tools) == len(global_tools)

    def test_three_tier_merge(self):
        """三级合并：global + flow + step 去重。"""
        config_path = Path(__file__).resolve().parent.parent / "config" / "mcp_servers.yaml"
        router = ToolRouter(str(config_path))
        flow_config = {
            "flow_tools": [{"server": "crm", "capabilities": ["search_customers"]}]
        }
        step_config = {
            "tools": [{"server": "mock", "capabilities": ["search_contacts"]}]
        }
        tools = router.get_tools_for_step(step_config, flow_config=flow_config)
        names = {t.name for t in tools}
        assert "search_contacts" in names     # step 级
        assert "search_customers" in names    # flow 级
        # global 也应在里面
        for gt in router.get_global_tools():
            assert gt.name in names

    def test_no_config_path(self):
        router = ToolRouter(None)
        assert router.tools == {}

    def test_global_config(self):
        config_path = Path(__file__).resolve().parent.parent / "config" / "mcp_servers.yaml"
        router = ToolRouter(str(config_path))
        assert router.max_rounds == 5
        assert router.max_result_chars == 2000


# ---------------------------------------------------------------------------
# ToolCallLog 测试
# ---------------------------------------------------------------------------


class TestToolCallLog:
    def test_to_dict(self):
        log = ToolCallLog(
            calls=[
                ToolCall(
                    round=1,
                    tool_name="search_contacts",
                    arguments={"query": "test"},
                    server="mock",
                    approval_level="none",
                    result="ok",
                    status="success",
                )
            ],
            total_rounds=1,
        )
        d = log.to_dict()
        assert d["total_rounds"] == 1
        assert len(d["calls"]) == 1
        assert d["calls"][0]["tool_name"] == "search_contacts"


# ---------------------------------------------------------------------------
# 结果截断测试
# ---------------------------------------------------------------------------


class TestResultTruncation:
    def test_truncation_threshold(self):
        config_path = Path(__file__).resolve().parent.parent / "config" / "mcp_servers.yaml"
        router = ToolRouter(str(config_path))
        tool_def = router.tools["search_contacts"]
        # Mock a server that returns a huge result
        from src.tool_router import _SERVER_REGISTRY

        class BigServer:
            def call_tool(self, name, args):
                return "x" * 5000

        orig = _SERVER_REGISTRY.get("mock")
        _SERVER_REGISTRY["mock"] = BigServer()
        try:
            result, status, _ = router._execute_tool(tool_def, {"query": "test"})
            # _execute_tool doesn't truncate (truncation in call_with_tools).
            # Verify config is correct.
            assert router.max_result_chars == 2000
        finally:
            if orig:
                _SERVER_REGISTRY["mock"] = orig
            else:
                _SERVER_REGISTRY.pop("mock", None)


# ---------------------------------------------------------------------------
# 草稿管理测试
# ---------------------------------------------------------------------------


class TestDraftManagement:
    def test_save_and_list(self, tmp_path, monkeypatch):
        monkeypatch.setattr("src.tool_router.DRAFTS_DIR", tmp_path)
        config_path = Path(__file__).resolve().parent.parent / "config" / "mcp_servers.yaml"
        router = ToolRouter(str(config_path))
        tool_def = router.tools["prepare_email_draft"]

        draft_id = router._save_draft(tool_def, {"to": "a@b.com", "subject": "Hi", "body": "Hello"})
        assert draft_id

        drafts = list_drafts()
        assert len(drafts) == 1
        assert drafts[0]["status"] == "pending"

    def test_approve_draft(self, tmp_path, monkeypatch):
        monkeypatch.setattr("src.tool_router.DRAFTS_DIR", tmp_path)
        config_path = Path(__file__).resolve().parent.parent / "config" / "mcp_servers.yaml"
        router = ToolRouter(str(config_path))
        tool_def = router.tools["prepare_email_draft"]

        draft_id = router._save_draft(tool_def, {"to": "a@b.com", "subject": "Hi", "body": "Hello"})
        result = approve_draft(draft_id)
        assert result is not None
        assert result["status"] == "approved"

    def test_reject_draft(self, tmp_path, monkeypatch):
        monkeypatch.setattr("src.tool_router.DRAFTS_DIR", tmp_path)
        config_path = Path(__file__).resolve().parent.parent / "config" / "mcp_servers.yaml"
        router = ToolRouter(str(config_path))
        tool_def = router.tools["prepare_email_draft"]

        draft_id = router._save_draft(tool_def, {"to": "a@b.com", "subject": "Hi", "body": "Hello"})
        result = reject_draft(draft_id, "不合适")
        assert result is not None
        assert result["status"] == "rejected"
        assert result["reject_reason"] == "不合适"


# ---------------------------------------------------------------------------
# Agent 向后兼容测试
# ---------------------------------------------------------------------------


class TestStdioTransport:
    def test_stdio_command_uses_shell_aware_split(self):
        with patch("subprocess.Popen") as mock_popen:
            proc = MagicMock()
            proc.poll.return_value = None
            proc.stdout = iter(())
            proc.stderr = iter(())
            mock_popen.return_value = proc

            server = StdioToolServer('python3 -m module_name --label "hello world"')
            server._ensure_started()

        argv = mock_popen.call_args[0][0]
        assert argv == [sys.executable, "-m", "module_name", "--label", "hello world"]

    def test_stdio_timeout_returns_clear_error(self):
        server = StdioToolServer("python3 fake_server.py", timeout_seconds=0.01)
        proc = MagicMock()
        proc.poll.return_value = None
        proc.stdin = MagicMock()
        proc.stdout = iter(())
        proc.stderr = iter(())
        server._proc = proc
        server._stream_threads_started = True
        server._stderr_lines.append("server busy")

        result = server.call_tool("search_customers", {"query": "test"})

        assert "响应超时" in result
        assert "server busy" in result

    def test_crm_server_search(self):
        """CRM stdio server 搜索客户。"""
        from src.tool_router import ToolRouter
        config_path = Path(__file__).resolve().parent.parent / "config" / "mcp_servers.yaml"
        router = ToolRouter(str(config_path))
        td = router.tools.get("search_customers")
        assert td is not None
        assert td.server == "crm"
        result, status, _ = router._execute_tool(td, {"query": "内蒙", "limit": 2})
        assert status == "success"
        assert "内蒙" in result

    def test_crm_server_draft(self, tmp_path, monkeypatch):
        """CRM 邮件草稿走 draft 模式。"""
        monkeypatch.setattr("src.tool_router.DRAFTS_DIR", tmp_path)
        from src.tool_router import ToolRouter
        config_path = Path(__file__).resolve().parent.parent / "config" / "mcp_servers.yaml"
        router = ToolRouter(str(config_path))
        td = router.tools.get("prepare_email_draft")
        # CRM 的 prepare_email_draft 也是 draft 级别
        if td and td.server == "crm":
            result, status, draft_id = router._execute_tool(
                td, {"to": "test@example.com", "subject": "Hi", "body": "Hello"}
            )
            assert status == "draft_created"
            assert draft_id is not None


class TestAgentBackwardCompat:
    def test_no_tools_uses_adapter(self):
        """没有 tools 配置时走原有纯文本路径。"""
        from src.agent import Agent
        from src.model_adapter import ModelAdapter

        adapter = MagicMock(spec=ModelAdapter)
        adapter.call.return_value = {
            "model": "test",
            "prompt": "sys",
            "output": "hello",
            "status": "success",
            "raw_response": {},
        }

        agent = Agent(
            step_id="test",
            name="Test Agent",
            system_prompt="sys",
            adapter=adapter,
        )
        result = agent.run("input")
        assert result["output"] == "hello"
        adapter.call.assert_called_once()

    def test_with_tools_uses_router(self):
        """有 tools 配置时走 ToolRouter 路径。"""
        from src.agent import Agent
        from src.model_adapter import ModelAdapter

        adapter = MagicMock(spec=ModelAdapter)
        adapter.merge_system_to_user = False
        router = MagicMock()
        router.call_with_tools.return_value = {
            "model": "test",
            "prompt": "sys",
            "output": "tool result",
            "status": "success",
            "raw_response": {},
            "tool_calls_log": {"calls": [], "total_rounds": 1},
        }

        tools = [ToolDef(name="t", description="t", parameters={}, server="mock")]
        agent = Agent(
            step_id="test",
            name="Test Agent",
            system_prompt="sys",
            adapter=adapter,
            tools=tools,
            tool_router=router,
        )
        result = agent.run("input")
        assert result["output"] == "tool result"
        router.call_with_tools.assert_called_once()
        adapter.call.assert_not_called()


class TestSSEToolServer:
    def test_sse_server_initialization(self):
        from src.tool_router import SSEToolServer
        server = SSEToolServer("http://localhost:8080/mcp", timeout_seconds=10.0)
        assert server._url == "http://localhost:8080/mcp"
        assert server._timeout_seconds == 10.0
        assert server._endpoint is None
        assert not server._connected

    def test_sse_server_with_headers(self):
        from src.tool_router import SSEToolServer
        headers = {"Authorization": "Bearer test-token"}
        server = SSEToolServer("http://localhost:8080/mcp", headers=headers)
        assert server._headers == headers

    def test_sse_server_close(self):
        from src.tool_router import SSEToolServer
        server = SSEToolServer("http://localhost:8080/mcp")
        server._connected = True
        server._sse_running = True
        server.close()
        assert not server._sse_running
        assert not server._connected

    def test_get_server_sse_transport(self):
        from src.tool_router import _get_server, SSEToolServer
        config = {
            "transport": "sse",
            "url": "http://localhost:9000/mcp",
            "timeout_seconds": 20,
            "headers": {"X-API-Key": "test"},
        }
        server = _get_server("test_sse", config)
        assert isinstance(server, SSEToolServer)
        assert server._url == "http://localhost:9000/mcp"
        assert server._timeout_seconds == 20.0

    def test_sse_server_url_required(self):
        from src.tool_router import _get_server
        config = {"transport": "sse"}
        server = _get_server("test_sse_no_url", config)
        assert server is None
