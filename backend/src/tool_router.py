"""ToolRouter: Agent 工具调度中间件。

职责：
1. 从 mcp_servers.yaml 加载工具定义
2. 将工具 schema 转换为 LiteLLM/OpenAI function calling 格式
3. 解析模型的 tool_calls → 路由到对应 MCP Server → 返回结果
4. 结果截断（防 context 爆炸）
5. 错误反馈（喂回模型让它自修）
6. 草稿模式（写操作存草稿，不直接执行）
7. 轮次限制（防无限循环）

设计原则：
- 没有 tools 配置的 Agent 完全不受影响（向后兼容）
- 所有工具调用记录到 StepLog，可审计
- 写操作走"草稿-确认"模式，不做线程挂起
"""

from __future__ import annotations

import collections
import json
import os
import queue
import shlex
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml

# ---------------------------------------------------------------------------
# 数据结构
# ---------------------------------------------------------------------------

DRAFTS_DIR = Path(__file__).resolve().parent.parent / "drafts"


@dataclass
class ToolDef:
    """单个工具的定义。"""
    name: str
    description: str
    parameters: dict  # JSON Schema
    server: str  # 所属 MCP Server ID
    approval_level: str = "none"  # "none" | "draft"
    is_concurrency_safe: bool = True  # True=只读/幂等，可并发；False=有副作用，需串行

    def to_openai_schema(self) -> dict:
        """转换为 OpenAI function calling 格式。"""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }


@dataclass
class ToolCall:
    """一次工具调用的完整记录。"""
    round: int
    tool_name: str
    arguments: dict
    server: str
    approval_level: str
    result: str
    status: str  # "success" | "error" | "draft_created" | "truncated"
    draft_id: str | None = None
    elapsed_ms: int = 0


@dataclass
class ToolCallLog:
    """一个 Agent 步骤中的全部工具调用记录。"""
    calls: list[ToolCall] = field(default_factory=list)
    total_rounds: int = 0

    def to_dict(self) -> dict:
        return {
            "calls": [asdict(c) for c in self.calls],
            "total_rounds": self.total_rounds,
        }


# ---------------------------------------------------------------------------
# Mock Server（内置，开发测试用）
# ---------------------------------------------------------------------------


class MockToolServer:
    """内置 Mock 服务器，模拟外部工具的响应。"""

    def call_tool(self, name: str, arguments: dict) -> str:
        """模拟工具执行。"""
        if name == "search_contacts":
            query = arguments.get("query", "")
            limit = arguments.get("limit", 3)
            # 返回模拟数据
            contacts = []
            for i in range(min(limit, 5)):
                contacts.append({
                    "name": f"联系人_{query}_{i+1}",
                    "company": f"{query}科技有限公司",
                    "phone": f"138-0000-{1000+i}",
                    "email": f"contact{i+1}@{query.lower()}.com",
                    "industry": "新能源/储能",
                })
            return json.dumps(contacts, ensure_ascii=False, indent=2)

        elif name == "prepare_email_draft":
            # 草稿模式：返回确认信息（实际存储在 ToolRouter 层处理）
            return json.dumps({
                "status": "draft_created",
                "to": arguments.get("to", ""),
                "subject": arguments.get("subject", ""),
                "preview": arguments.get("body", "")[:100] + "...",
            }, ensure_ascii=False)

        else:
            return json.dumps({"error": f"Unknown tool: {name}"})


# ---------------------------------------------------------------------------
# ToolRouter 核心
# ---------------------------------------------------------------------------

# Server 实例缓存（懒加载，不预置 mock）
_SERVER_REGISTRY: dict[str, Any] = {}


def _normalize_stdio_argv(argv: list[str]) -> list[str]:
    """Use the current interpreter for Python stdio servers.

    On Windows, `python3` often resolves to the Microsoft Store alias instead of
    a usable interpreter, which makes MCP subprocesses exit before reading stdin.
    """
    if not argv:
        return argv
    executable = Path(argv[0]).name.lower()
    if executable in {"python", "python.exe", "python3", "python3.exe"}:
        return [sys.executable, *argv[1:]]
    return argv


class StdioToolServer:
    """通过 stdio 与外部 MCP Server 子进程通信。"""

    def __init__(self, command: str, timeout_seconds: float = 30.0):
        import subprocess
        self._command = command
        self._argv = _normalize_stdio_argv(shlex.split(command))
        self._timeout_seconds = timeout_seconds
        self._proc: subprocess.Popen | None = None
        self._stdout_queue: queue.Queue[str | None] = queue.Queue()
        self._stderr_lines: collections.deque[str] = collections.deque(maxlen=50)
        self._stream_threads_started = False
        self._request_lock = threading.Lock()

    def _ensure_started(self):
        import subprocess
        if self._proc is None or self._proc.poll() is not None:
            env = os.environ.copy()
            env.setdefault("PYTHONUTF8", "1")
            env.setdefault("PYTHONIOENCODING", "utf-8")
            self._proc = subprocess.Popen(
                self._argv,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1,
                env=env,
            )
            self._stdout_queue = queue.Queue()
            self._stderr_lines.clear()
            self._stream_threads_started = False
        if not self._stream_threads_started:
            self._start_stream_threads()

    def _start_stream_threads(self) -> None:
        if self._proc is None:
            return
        stdout = self._proc.stdout
        stderr = self._proc.stderr
        stdout_queue = self._stdout_queue
        stderr_lines = self._stderr_lines
        threading.Thread(
            target=self._pump_stdout,
            args=(stdout, stdout_queue),
            name=f"mcp-stdout-{id(self)}",
            daemon=True,
        ).start()
        threading.Thread(
            target=self._pump_stderr,
            args=(stderr, stderr_lines),
            name=f"mcp-stderr-{id(self)}",
            daemon=True,
        ).start()
        self._stream_threads_started = True

    def _pump_stdout(
        self,
        stdout,
        stdout_queue: queue.Queue[str | None],
    ) -> None:
        if stdout is None:
            return
        try:
            for line in stdout:
                stdout_queue.put(line.rstrip("\n"))
        finally:
            stdout_queue.put(None)

    def _pump_stderr(
        self,
        stderr,
        stderr_lines: collections.deque[str],
    ) -> None:
        if stderr is None:
            return
        for line in stderr:
            line = line.rstrip("\n")
            if line:
                stderr_lines.append(line)

    def _stderr_snapshot(self) -> str:
        if not self._stderr_lines:
            return ""
        return " | stderr: " + " | ".join(self._stderr_lines)

    def _read_response_line(self) -> str:
        try:
            response_line = self._stdout_queue.get(timeout=self._timeout_seconds)
        except queue.Empty as exc:
            self._restart_process()
            raise TimeoutError(
                f"MCP Server 响应超时（>{self._timeout_seconds:.1f}s）{self._stderr_snapshot()}"
            ) from exc

        if response_line is None:
            code = self._proc.poll() if self._proc is not None else "unknown"
            self._restart_process()
            raise RuntimeError(
                f"MCP Server 已退出（code={code}）{self._stderr_snapshot()}"
            )

        return response_line.strip()

    def _restart_process(self) -> None:
        if self._proc and self._proc.poll() is None:
            self._proc.terminate()
            try:
                self._proc.wait(timeout=1)
            except Exception:
                self._proc.kill()
        self._proc = None
        self._stream_threads_started = False

    def call_tool(self, name: str, arguments: dict) -> str:
        with self._request_lock:
            self._ensure_started()
            request = json.dumps({
                "method": "call_tool",
                "params": {"name": name, "arguments": arguments},
            }, ensure_ascii=False)

            try:
                self._proc.stdin.write(request + "\n")
                self._proc.stdin.flush()
                response_line = self._read_response_line()
                if not response_line:
                    return f"Error: MCP Server returned empty response{self._stderr_snapshot()}"
                resp = json.loads(response_line)
                result = resp.get("result", "No result")
                if isinstance(result, dict):
                    return json.dumps(result, ensure_ascii=False)
                return str(result)
            except Exception as e:
                return f"Error communicating with MCP Server: {e!s}"

    def list_tools(self) -> list[dict]:
        with self._request_lock:
            self._ensure_started()
            request = json.dumps({"method": "list_tools", "params": {}})
            try:
                self._proc.stdin.write(request + "\n")
                self._proc.stdin.flush()
                response_line = self._read_response_line()
                if not response_line:
                    return []
                resp = json.loads(response_line)
                return resp.get("result", [])
            except Exception:
                return []

    def __del__(self):
        if self._proc and self._proc.poll() is None:
            self._proc.terminate()


class SSEToolServer:
    """通过 SSE (Server-Sent Events) 与远程 MCP Server 通信。
    
    协议流程：
    1. GET {url} → 建立 SSE 连接，等待 endpoint 事件
    2. endpoint 事件携带 POST URL
    3. POST {endpoint} 发送 JSON-RPC 请求
    4. 响应通过 SSE 事件流返回
    """

    def __init__(self, url: str, timeout_seconds: float = 30.0, headers: dict | None = None):
        self._url = url
        self._timeout_seconds = timeout_seconds
        self._headers = headers or {}
        self._endpoint: str | None = None
        self._session_id: str | None = None
        self._sse_thread: threading.Thread | None = None
        self._sse_running = False
        self._message_queue: queue.Queue[dict | None] = queue.Queue()
        self._connected = False
        self._connect_lock = threading.Lock()
        self._request_lock = threading.Lock()

    def _ensure_connected(self):
        with self._connect_lock:
            if self._connected:
                return
            self._start_sse_connection()

    def _start_sse_connection(self):
        import urllib.request
        import urllib.error

        req = urllib.request.Request(
            self._url,
            headers={
                "Accept": "text/event-stream",
                "Cache-Control": "no-cache",
                **self._headers,
            },
            method="GET",
        )
        self._set_proxy(req)

        try:
            response = urllib.request.urlopen(req, timeout=self._timeout_seconds)
        except urllib.error.URLError as e:
            raise RuntimeError(f"SSE 连接失败: {e}")

        self._sse_running = True
        self._sse_thread = threading.Thread(
            target=self._pump_sse_stream,
            args=(response,),
            name=f"sse-stream-{id(self)}",
            daemon=True,
        )
        self._sse_thread.start()

        try:
            endpoint = self._message_queue.get(timeout=self._timeout_seconds)
            if endpoint is None:
                raise RuntimeError("SSE 连接意外关闭")
            if isinstance(endpoint, dict) and endpoint.get("type") == "endpoint":
                self._endpoint = endpoint["url"]
                self._session_id = endpoint.get("session_id")
                self._connected = True
            else:
                raise RuntimeError(f"未收到 endpoint 事件: {endpoint}")
        except queue.Empty as exc:
            self._sse_running = False
            raise RuntimeError(f"SSE 连接超时（>{self._timeout_seconds}s）") from exc

    def _set_proxy(self, req):
        import os
        proxy = os.environ.get("http_proxy") or os.environ.get("HTTP_PROXY")
        if proxy:
            req.set_proxy(proxy, "http")

    def _pump_sse_stream(self, response):
        try:
            for line in response:
                if not self._sse_running:
                    break
                line = line.decode("utf-8", errors="replace").strip()
                if not line:
                    continue
                if line.startswith("event:"):
                    event_type = line[6:].strip()
                elif line.startswith("data:"):
                    data = line[5:].strip()
                    if event_type == "endpoint":
                        import urllib.parse
                        base_url = self._url
                        endpoint_url = urllib.parse.urljoin(base_url, data)
                        self._message_queue.put({
                            "type": "endpoint",
                            "url": endpoint_url,
                            "session_id": None,
                        })
                    elif event_type == "message":
                        try:
                            msg = json.loads(data)
                            self._message_queue.put(msg)
                        except json.JSONDecodeError:
                            pass
        except Exception:
            pass
        finally:
            self._message_queue.put(None)

    def call_tool(self, name: str, arguments: dict) -> str:
        with self._request_lock:
            self._ensure_connected()
            if not self._endpoint:
                return "Error: SSE endpoint not established"

            import urllib.request
            import urllib.error
            import uuid

            request_id = str(uuid.uuid4())
            payload = json.dumps({
                "jsonrpc": "2.0",
                "id": request_id,
                "method": "tools/call",
                "params": {"name": name, "arguments": arguments},
            }, ensure_ascii=False).encode("utf-8")

            headers = {
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
                **self._headers,
            }
            if self._session_id:
                headers["mcp-session-id"] = self._session_id

            req = urllib.request.Request(
                self._endpoint,
                data=payload,
                headers=headers,
                method="POST",
            )
            self._set_proxy(req)

            try:
                response = urllib.request.urlopen(req, timeout=self._timeout_seconds)
                content_type = response.headers.get("Content-Type", "")
                body = response.read().decode("utf-8")

                if "application/json" in content_type:
                    resp = json.loads(body)
                    if "error" in resp:
                        return f"Error: {resp['error'].get('message', resp['error'])}"
                    result = resp.get("result", {})
                    if isinstance(result, dict):
                        content = result.get("content", [])
                        if isinstance(content, list) and content:
                            texts = [c.get("text", "") for c in content if c.get("type") == "text"]
                            if texts:
                                return "\n".join(texts)
                        return json.dumps(result, ensure_ascii=False)
                    return str(result)
                else:
                    return self._wait_for_sse_response(request_id)

            except urllib.error.URLError as e:
                return f"Error: SSE POST 失败: {e}"
            except json.JSONDecodeError as e:
                return f"Error: JSON 解析失败: {e}"

    def _wait_for_sse_response(self, request_id: str, timeout: float = 30.0) -> str:
        start_time = time.time()
        while time.time() - start_time < timeout:
            try:
                msg = self._message_queue.get(timeout=1.0)
                if msg is None:
                    return "Error: SSE connection closed"
                if isinstance(msg, dict):
                    if msg.get("id") == request_id:
                        if "error" in msg:
                            return f"Error: {msg['error'].get('message', msg['error'])}"
                        result = msg.get("result", {})
                        return json.dumps(result, ensure_ascii=False)
            except queue.Empty:
                continue
        return "Error: SSE response timeout"

    def list_tools(self) -> list[dict]:
        with self._request_lock:
            self._ensure_connected()
            if not self._endpoint:
                return []

            import urllib.request
            import urllib.error
            import uuid

            request_id = str(uuid.uuid4())
            payload = json.dumps({
                "jsonrpc": "2.0",
                "id": request_id,
                "method": "tools/list",
                "params": {},
            }).encode("utf-8")

            headers = {
                "Content-Type": "application/json",
                "Accept": "application/json",
                **self._headers,
            }
            if self._session_id:
                headers["mcp-session-id"] = self._session_id

            req = urllib.request.Request(
                self._endpoint,
                data=payload,
                headers=headers,
                method="POST",
            )
            self._set_proxy(req)

            try:
                response = urllib.request.urlopen(req, timeout=self._timeout_seconds)
                body = response.read().decode("utf-8")
                resp = json.loads(body)
                result = resp.get("result", {})
                return result.get("tools", [])
            except Exception:
                return []

    def close(self):
        self._sse_running = False
        self._connected = False

    def __del__(self):
        self.close()


def _get_server(server_id: str, server_config: dict | None = None) -> Any:
    """获取 MCP Server 实例（懒加载）。"""
    if server_id in _SERVER_REGISTRY:
        return _SERVER_REGISTRY[server_id]

    if not server_config:
        return None

    transport = server_config.get("transport", "")

    if transport == "mock":
        srv = MockToolServer()
        _SERVER_REGISTRY[server_id] = srv
        return srv

    if transport == "stdio":
        command = server_config.get("command", "")
        if not command:
            return None
        timeout_seconds = float(server_config.get("timeout_seconds", 30))
        srv = StdioToolServer(command, timeout_seconds=timeout_seconds)
        _SERVER_REGISTRY[server_id] = srv
        return srv

    if transport == "sse":
        url = server_config.get("url", "")
        if not url:
            return None
        timeout_seconds = float(server_config.get("timeout_seconds", 30))
        headers = server_config.get("headers", {})
        srv = SSEToolServer(url, timeout_seconds=timeout_seconds, headers=headers)
        _SERVER_REGISTRY[server_id] = srv
        return srv

    return None


def _partition_tool_calls(
    tool_calls: list, tool_defs: dict[str, ToolDef],
) -> tuple[list[tuple[int, Any]], list[tuple[int, Any]]]:
    """将 tool_calls 分为并发安全组和串行组。

    Returns:
        (safe_calls, unsafe_calls) — 每个 element 是 (原始索引, tool_call)
    """
    safe: list[tuple[int, Any]] = []
    unsafe: list[tuple[int, Any]] = []
    for i, tc in enumerate(tool_calls):
        fn_name = tc.function.name
        td = tool_defs.get(fn_name)
        if td and td.is_concurrency_safe and td.approval_level != "draft":
            safe.append((i, tc))
        else:
            unsafe.append((i, tc))
    return safe, unsafe


def _execute_tool_calls_concurrent(
    tool_calls: list,
    tool_defs: dict[str, ToolDef],
    available_tools: list[ToolDef],
    execute_fn,
    max_result_chars: int,
) -> list[tuple[Any, str, str, str | None, int]]:
    """分区执行 tool_calls：只读工具并发，写入工具串行。

    Returns:
        按 tool_calls 原始顺序排列的 (tc, result_str, status, draft_id, elapsed_ms) 元组。
    """
    if len(tool_calls) <= 1:
        results_map = {}
        for idx, tc in enumerate(tool_calls):
            results_map[idx] = _run_single_tool(
                tc, idx, tool_defs, available_tools, execute_fn, max_result_chars,
            )
        return [results_map[i] for i in range(len(tool_calls))]

    safe_calls, unsafe_calls = _partition_tool_calls(tool_calls, tool_defs)
    results_map: dict[int, tuple] = {}

    def _job(idx: int, tc: Any) -> tuple[int, tuple]:
        return idx, _run_single_tool(
            tc, idx, tool_defs, available_tools, execute_fn, max_result_chars,
        )

    max_workers = min(len(safe_calls), 4) or 1
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(_job, idx, tc): idx for idx, tc in safe_calls}
        for fut in as_completed(futures):
            idx, result = fut.result()
            results_map[idx] = result

    for idx, tc in unsafe_calls:
        results_map[idx] = _run_single_tool(
            tc, idx, tool_defs, available_tools, execute_fn, max_result_chars,
        )

    return [results_map[i] for i in range(len(tool_calls))]


def _run_single_tool(
    tc: Any,
    idx: int,
    tool_defs: dict[str, ToolDef],
    available_tools: list[ToolDef],
    execute_fn,
    max_result_chars: int,
) -> tuple[Any, str, str, str | None, int]:
    """执行单个 tool_call，返回 (tc, result_str, status, draft_id, elapsed_ms)。"""
    fn_name = tc.function.name
    try:
        fn_args = json.loads(tc.function.arguments) if isinstance(tc.function.arguments, str) else tc.function.arguments
    except json.JSONDecodeError:
        fn_args = {}

    tool_def = tool_defs.get(fn_name)
    t0 = time.time()

    if not tool_def:
        result_str = f"Error: Tool '{fn_name}' not found. Available tools: {[t.name for t in available_tools]}"
        status = "error"
        draft_id = None
    else:
        result_str, status, draft_id = execute_fn(tool_def, fn_args)

    elapsed_ms = int((time.time() - t0) * 1000)

    if len(result_str) > max_result_chars:
        result_str = (
            result_str[:max_result_chars]
            + f"\n\n[截断提示] 结果超过{max_result_chars}字符已截断。"
            "请使用更精确的参数过滤结果。"
        )
        if status == "success":
            status = "truncated"

    return (tc, result_str, status, draft_id, elapsed_ms)


class ToolRouter:
    """Agent 工具调度器。

    Usage:
        router = ToolRouter("config/mcp_servers.yaml")
        tools = router.get_tools_for_step(step_config)  # 从 YAML 解析
        result = router.call_with_tools(adapter, system, user, tools)
    """

    def __init__(self, config_path: str | None = None):
        self.config: dict = {}
        self.tools: dict[str, ToolDef] = {}  # name → ToolDef
        self.max_rounds: int = 5
        self.max_result_chars: int = 2000

        if config_path:
            path = Path(config_path)
            if path.exists():
                self.config = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
                self._load_tools()

                gbl = self.config.get("global", {})
                self.max_rounds = gbl.get("max_tool_rounds", 5)
                self.max_result_chars = gbl.get("result_max_chars", 2000)

    def _load_tools(self):
        """从配置加载所有工具定义。"""
        for server_id, server_cfg in self.config.get("servers", {}).items():
            if not isinstance(server_cfg, dict):
                continue
            for tool_cfg in server_cfg.get("tools", []):
                td = ToolDef(
                    name=tool_cfg["name"],
                    description=tool_cfg.get("description", ""),
                    parameters=tool_cfg.get("parameters", {"type": "object", "properties": {}}),
                    server=server_id,
                    approval_level=tool_cfg.get("approval_level", "none"),
                    is_concurrency_safe=tool_cfg.get("is_concurrency_safe", True),
                )
                self.tools[td.name] = td

    def get_global_tools(self) -> list[ToolDef]:
        """获取全局工具列表（所有 Agent 自动获得）。"""
        gbl = self.config.get("global", {})
        return self._resolve_tool_entries(gbl.get("global_tools", []))

    def get_flow_tools(self, flow_config: dict) -> list[ToolDef]:
        """获取蜂群级工具列表（该 Flow 所有 Agent 共享）。"""
        return self._resolve_tool_entries(flow_config.get("flow_tools", []))

    def get_tools_for_step(self, step_config: dict,
                           flow_config: dict | None = None) -> list[ToolDef]:
        """合并三级工具：global + flow + step，去重后返回。

        step_config 示例:
            tools:
              - server: "mock"
                capabilities: ["search_contacts", "prepare_email_draft"]
        """
        # 三级合并
        all_tools = []
        seen = set()

        # 全局
        for td in self.get_global_tools():
            if td.name not in seen:
                all_tools.append(td)
                seen.add(td.name)

        # 蜂群级
        if flow_config:
            for td in self.get_flow_tools(flow_config):
                if td.name not in seen:
                    all_tools.append(td)
                    seen.add(td.name)

        # 步骤级
        for td in self._resolve_tool_entries(step_config.get("tools", [])):
            if td.name not in seen:
                all_tools.append(td)
                seen.add(td.name)

        return all_tools

    def _resolve_tool_entries(self, entries: list) -> list[ToolDef]:
        """将工具配置解析为 ToolDef 列表。支持两种形态：

        - 字典形态：``{server, capabilities: [...]}`` —— 标准
        - 字符串形态：``"capability_name"`` —— 简写（按 capability 名直接定位 ToolDef）
        """
        result = []
        for entry in entries:
            if isinstance(entry, str):
                # 简写：直接按 capability 名查 ToolDef
                td = self.tools.get(entry)
                if td is not None:
                    result.append(td)
                continue
            server_id = entry.get("server", "")
            caps = entry.get("capabilities", [])
            for cap_name in caps:
                if cap_name in self.tools:
                    td = self.tools[cap_name]
                    if td.server == server_id:
                        result.append(td)
        return result

    def call_with_tools(
        self,
        adapter,
        system_prompt: str,
        user_input: str,
        available_tools: list[ToolDef],
        model: str | None = None,
        api_base: str | None = None,
        api_key: str | None = None,
        merge_system_to_user: bool = False,
        max_tokens: int | None = None,
        temperature: float | None = None,
    ) -> dict:
        """支持工具调用的模型交互循环。

        Returns:
            标准 Agent result dict + 额外的 "tool_calls_log" 字段。
        """
        import litellm

        actual_model = model or adapter.model
        actual_api_base = api_base or adapter.api_base
        actual_api_key = api_key or adapter.api_key

        if merge_system_to_user:
            messages = [
                {"role": "system", "content": "你是一个专业助手。"},
                {"role": "user", "content": system_prompt + "\n\n---\n\n" + user_input},
            ]
        else:
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_input},
            ]

        tools_param = [t.to_openai_schema() for t in available_tools]
        tool_log = ToolCallLog()

        kwargs: dict = {"model": actual_model, "messages": messages}
        if actual_api_base:
            kwargs["api_base"] = actual_api_base
        if actual_api_key:
            kwargs["api_key"] = actual_api_key
        if tools_param:
            kwargs["tools"] = tools_param
            kwargs["tool_choice"] = "auto"
        # 与 model_adapter 保持一致：限定单次请求最长 180s（默认 6000s 太长）
        # 超时后 ReAct 循环会因 exception 跳出，避免大请求无限挂起
        import os as _os
        kwargs["timeout"] = float(_os.environ.get("LITELLM_REQUEST_TIMEOUT", "180"))
        # max_tokens / temperature：minimax 等模型强制要求显式 max_tokens；
        # 不设会导致 "Range of max_tokens should be [1, 32768]" 错误
        actual_max_tokens = max_tokens if max_tokens is not None else getattr(adapter, "max_tokens", None)
        if actual_max_tokens is not None:
            kwargs["max_tokens"] = actual_max_tokens
        actual_temperature = temperature if temperature is not None else getattr(adapter, "temperature", None)
        if actual_temperature is not None:
            kwargs["temperature"] = actual_temperature

        for round_num in range(1, self.max_rounds + 1):
            try:
                response = litellm.completion(**kwargs)
            except Exception as e:
                return {
                    "model": actual_model,
                    "prompt": system_prompt,
                    "output": f"[ERROR] model={actual_model}, error={e!s}",
                    "status": "error",
                    "raw_response": {"error": str(e)},
                    "tool_calls_log": tool_log.to_dict(),
                }

            msg = response.choices[0].message

            # 如果模型没有调用工具 → 直接返回文本
            tool_calls = getattr(msg, "tool_calls", None)
            if not tool_calls:
                tool_log.total_rounds = round_num
                return {
                    "model": actual_model,
                    "prompt": system_prompt,
                    "output": msg.content or "",
                    "status": "success",
                    "raw_response": response.model_dump(),
                    "tool_calls_log": tool_log.to_dict(),
                }

            # 有工具调用 → 分区执行（只读并发，写入串行）
            messages.append(msg.model_dump())

            tool_results = _execute_tool_calls_concurrent(
                tool_calls, self.tools, available_tools,
                self._execute_tool, self.max_result_chars,
            )

            for tc, result_str, status, draft_id, elapsed_ms in tool_results:
                fn_name = tc.function.name
                fn_args_raw = tc.function.arguments
                try:
                    fn_args = json.loads(fn_args_raw) if isinstance(fn_args_raw, str) else fn_args_raw
                except json.JSONDecodeError:
                    fn_args = {}

                tool_def = self.tools.get(fn_name)

                tool_log.calls.append(ToolCall(
                    round=round_num,
                    tool_name=fn_name,
                    arguments=fn_args,
                    server=tool_def.server if tool_def else "unknown",
                    approval_level=tool_def.approval_level if tool_def else "none",
                    result=result_str[:500],
                    status=status,
                    draft_id=draft_id,
                    elapsed_ms=elapsed_ms,
                ))

                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": result_str,
                })

        # 超过最大轮次
        tool_log.total_rounds = self.max_rounds
        # 最后一轮拿到的 content 可能有值
        last_content = ""
        for m in reversed(messages):
            if isinstance(m, dict) and m.get("role") == "assistant" and m.get("content"):
                last_content = m["content"]
                break

        return {
            "model": actual_model,
            "prompt": system_prompt,
            "output": last_content or "[WARNING] 工具调用达到最大轮次限制，已强制停止",
            "status": "warning",
            "raw_response": {},
            "tool_calls_log": tool_log.to_dict(),
        }

    def _execute_tool(
        self, tool_def: ToolDef, arguments: dict
    ) -> tuple[str, str, str | None]:
        """执行单个工具调用。

        Returns:
            (result_str, status, draft_id | None)
        """
        try:
            from src.tool_sandbox import ToolSandbox
            sandbox = ToolSandbox()
            sandbox_result = sandbox.validate_tool_args(tool_def.name, arguments)
            if not sandbox_result.allowed:
                return (
                    f"[SANDBOX_BLOCKED] {sandbox_result.blocked_reason}",
                    "error",
                    None,
                )
        except ImportError:
            pass

        server_config = self.config.get("servers", {}).get(tool_def.server)
        server = _get_server(tool_def.server, server_config)
        if not server:
            return (
                f"Error: MCP Server '{tool_def.server}' not available. "
                "Please check server configuration.",
                "error",
                None,
            )

        # 草稿模式：写操作存草稿
        if tool_def.approval_level == "draft":
            draft_id = self._save_draft(tool_def, arguments)
            try:
                result = server.call_tool(tool_def.name, arguments)
            except Exception as e:
                result = f"Tool execution failed: {e!s}. Please correct your arguments and try again."
                return result, "error", draft_id
            return (
                f"{result}\n\n[草稿已创建] draft_id={draft_id}，需人工在 Web UI 确认后执行。",
                "draft_created",
                draft_id,
            )

        # 普通模式：直接执行
        try:
            result = server.call_tool(tool_def.name, arguments)
            return result, "success", None
        except Exception as e:
            # 错误反馈机制：把错误信息喂回模型
            error_msg = (
                f"Tool execution failed: {e!s}. "
                "Please correct your arguments and try again."
            )
            return error_msg, "error", None

    def _save_draft(self, tool_def: ToolDef, arguments: dict) -> str:
        """保存草稿到磁盘，返回 draft_id。"""
        DRAFTS_DIR.mkdir(parents=True, exist_ok=True)
        draft_id = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:20]
        draft = {
            "draft_id": draft_id,
            "tool_name": tool_def.name,
            "server": tool_def.server,
            "arguments": arguments,
            "status": "pending",  # pending → approved → executed / rejected
            "created_at": datetime.now().astimezone().isoformat(),
        }
        path = DRAFTS_DIR / f"{draft_id}.json"
        path.write_text(json.dumps(draft, ensure_ascii=False, indent=2), encoding="utf-8")
        return draft_id


# ---------------------------------------------------------------------------
# 草稿管理
# ---------------------------------------------------------------------------


def list_drafts(status: str | None = None) -> list[dict]:
    """列出所有草稿。"""
    if not DRAFTS_DIR.exists():
        return []
    results = []
    for f in sorted(DRAFTS_DIR.glob("*.json"), reverse=True):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            if status and data.get("status") != status:
                continue
            results.append(data)
        except (json.JSONDecodeError, KeyError):
            continue
    return results


def approve_draft(draft_id: str) -> dict | None:
    """审批通过草稿。"""
    path = DRAFTS_DIR / f"{draft_id}.json"
    if not path.exists():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    data["status"] = "approved"
    data["approved_at"] = datetime.now().astimezone().isoformat()
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return data


def reject_draft(draft_id: str, reason: str = "") -> dict | None:
    """驳回草稿。"""
    path = DRAFTS_DIR / f"{draft_id}.json"
    if not path.exists():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    data["status"] = "rejected"
    data["rejected_at"] = datetime.now().astimezone().isoformat()
    data["reject_reason"] = reason
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return data
