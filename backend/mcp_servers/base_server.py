"""MCP Server 基类 — stdio transport 实现。

协议规范（简化版 MCP over stdio）：
- 通信格式：每行一个 JSON 对象，以换行符分隔
- Request:  {"method": "call_tool", "params": {"name": "xxx", "arguments": {...}}}
- Response: {"result": "...", "status": "success|error"}
- 特殊方法：
  - list_tools → 返回工具定义列表
  - call_tool  → 执行工具调用

用法：
    继承 BaseServer，实现 register_tools() 注册工具，然后 server.run()。

    class MyCRM(BaseServer):
        def register_tools(self):
            self.tool("search", "搜索客户", {...})(self.do_search)
        def do_search(self, query, limit=5):
            return [...]

    MyCRM().run()
"""

from __future__ import annotations

import json
import sys
from typing import Any, Callable


class BaseServer:
    """stdio MCP Server 基类。"""

    def __init__(self, name: str = "base", version: str = "1.0"):
        self.name = name
        self.version = version
        self._tools: dict[str, dict] = {}  # name → {schema, handler}
        self.register_tools()

    def register_tools(self):
        """子类重写，注册工具。"""
        pass

    def tool(
        self, name: str, description: str, parameters: dict
    ) -> Callable:
        """装饰器：注册一个工具。"""
        def decorator(fn: Callable) -> Callable:
            self._tools[name] = {
                "name": name,
                "description": description,
                "parameters": parameters,
                "handler": fn,
            }
            return fn
        return decorator

    def add_tool(
        self, name: str, description: str, parameters: dict, handler: Callable
    ):
        """直接注册一个工具（非装饰器方式）。"""
        self._tools[name] = {
            "name": name,
            "description": description,
            "parameters": parameters,
            "handler": handler,
        }

    def handle_request(self, request: dict) -> dict:
        """处理单个请求。"""
        method = request.get("method", "")
        params = request.get("params", {})

        if method == "list_tools":
            tools = []
            for t in self._tools.values():
                tools.append({
                    "name": t["name"],
                    "description": t["description"],
                    "parameters": t["parameters"],
                })
            return {"result": tools, "status": "success"}

        if method == "call_tool":
            tool_name = params.get("name", "")
            arguments = params.get("arguments", {})
            tool = self._tools.get(tool_name)
            if not tool:
                return {
                    "result": f"Tool '{tool_name}' not found. Available: {list(self._tools.keys())}",
                    "status": "error",
                }
            try:
                result = tool["handler"](**arguments)
                # 序列化结果
                if isinstance(result, (dict, list)):
                    result_str = json.dumps(result, ensure_ascii=False, indent=2)
                else:
                    result_str = str(result)
                return {"result": result_str, "status": "success"}
            except Exception as e:
                return {
                    "result": f"Tool execution failed: {e!s}",
                    "status": "error",
                }

        return {"result": f"Unknown method: {method}", "status": "error"}

    def run(self):
        """启动 stdio 事件循环：逐行读 JSON 请求，写 JSON 响应。"""
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                request = json.loads(line)
            except json.JSONDecodeError as e:
                response = {"result": f"JSON parse error: {e!s}", "status": "error"}
                sys.stdout.write(json.dumps(response, ensure_ascii=False) + "\n")
                sys.stdout.flush()
                continue

            response = self.handle_request(request)
            sys.stdout.write(json.dumps(response, ensure_ascii=False) + "\n")
            sys.stdout.flush()
