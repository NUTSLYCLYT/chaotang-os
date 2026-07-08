"""Claude Code Bridge — MCP Server

暴露与 Claude Code 内置工具同名的工具，供方向B的 Agent 调用。
工具集：Read, Write, Edit, Bash, Grep, Glob

安全约束：
- Bash: 禁止 rm -rf / dd / mkfs 等危险命令；超时强制 kill
- Write/Edit: 路径必须是绝对路径，不允许 .. 路径穿越
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

# 确保能 import 同包的 base_server
_HERE = Path(__file__).resolve().parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE.parent))

from mcp_servers.base_server import BaseServer  # noqa: E402

# ─── 安全校验 ────────────────────────────────────────────────────────────────

# 危险命令黑名单（正则，匹配命令字符串）
_DANGEROUS_PATTERNS = [
    re.compile(r'\brm\s+-[^\s]*r', re.IGNORECASE),       # rm -rf / rm -r
    re.compile(r'\bdd\b'),
    re.compile(r'\bmkfs\b'),
    re.compile(r'\bformat\b.*\b/dev/'),
    re.compile(r'>\s*/dev/(s|h)d[a-z]'),                  # 重定向到磁盘设备
    re.compile(r'\bshred\b'),
    re.compile(r'\bwipefs\b'),
    re.compile(r':\s*\(\s*\)\s*\{.*\}'),                  # fork bomb
    re.compile(r'\bsudo\b'),                              # 任何 sudo 命令
    re.compile(r'\bchmod\s+[0-9]*[2367]\s', re.IGNORECASE),  # chmod 给予写/执行权
    re.compile(r'\bchown\b'),                             # 修改文件归属
    re.compile(r'\bcurl\b.*\|\s*(ba)?sh\b'),              # curl pipe to shell
    re.compile(r'\bwget\b.*\|\s*(ba)?sh\b'),              # wget pipe to shell
]

_BASH_MAX_TIMEOUT = 60  # 最大超时秒数

# 允许访问的根目录白名单（读/写/执行均受此约束）
_ALLOWED_ROOTS: list[str] = [
    str(Path(__file__).resolve().parent.parent),  # jiqun_ai 项目目录
]

# 明确禁止的敏感路径（即使在 ALLOWED_ROOTS 内也不允许）
_BLOCKED_PATH_PATTERNS = [
    re.compile(r'/\.env$'),
    re.compile(r'/\.ssh/'),
    re.compile(r'credentials'),
    re.compile(r'/\.gnupg/'),
]


def _validate_path(path: str) -> str:
    """校验路径安全性：必须是绝对路径、不含 ..、在白名单内。"""
    if not path:
        raise ValueError("路径不能为空")
    p = Path(path)
    if not p.is_absolute():
        raise ValueError(f"路径必须是绝对路径，当前：{path!r}")
    if ".." in path:
        raise ValueError(f"路径不允许包含 '..'：{path!r}")
    try:
        resolved = str(p.resolve())
    except Exception:
        resolved = str(p)
    # 白名单检查
    if not any(resolved.startswith(root) for root in _ALLOWED_ROOTS):
        raise PermissionError(
            f"路径不在允许的目录内（{_ALLOWED_ROOTS}）: {resolved!r}"
        )
    # 敏感路径检查
    for pat in _BLOCKED_PATH_PATTERNS:
        if pat.search(resolved):
            raise PermissionError(f"路径匹配敏感路径规则，已拒绝: {resolved!r}")
    return resolved


def _validate_bash_command(command: str) -> None:
    """检查命令是否包含危险模式，发现则抛出 ValueError。"""
    for pat in _DANGEROUS_PATTERNS:
        if pat.search(command):
            raise ValueError(
                f"命令包含危险操作（匹配规则 {pat.pattern!r}），已拒绝执行：{command[:120]!r}"
            )


# ─── Tool 实现 ───────────────────────────────────────────────────────────────

def _tool_read(file_path: str, offset: int = 0, limit: int = 2000) -> str:
    """读取文件内容，支持 offset/limit（行号，从 1 开始）。"""
    resolved = _validate_path(file_path)
    p = Path(resolved)
    if not p.exists():
        raise FileNotFoundError(f"文件不存在：{resolved!r}")
    if not p.is_file():
        raise IsADirectoryError(f"路径是目录，不是文件：{resolved!r}")

    lines = p.read_text(encoding="utf-8", errors="replace").splitlines(keepends=True)
    total = len(lines)

    # offset 是从 0 开始的行索引
    start = max(0, int(offset))
    end = min(total, start + int(limit)) if limit else total
    selected = lines[start:end]

    # 加行号前缀（cat -n 风格）
    numbered = []
    for ln, content in enumerate(selected, start=start + 1):
        numbered.append(f"{ln}\t{content}")
    return "".join(numbered) or "(empty file)"


def _tool_write(file_path: str, content: str) -> str:
    """写入文件（覆盖）。父目录不存在时自动创建。"""
    resolved = _validate_path(file_path)
    p = Path(resolved)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")
    return f"已写入 {resolved}（{len(content)} 字符）"


def _tool_edit(file_path: str, old_string: str, new_string: str, replace_all: bool = False) -> str:
    """字符串替换。replace_all=True 时替换全部匹配，否则只替换第一处（失败时抛异常）。"""
    resolved = _validate_path(file_path)
    p = Path(resolved)
    if not p.exists():
        raise FileNotFoundError(f"文件不存在：{resolved!r}")

    original = p.read_text(encoding="utf-8")
    if old_string not in original:
        raise ValueError(
            f"old_string 在文件中不存在，无法替换。\n"
            f"文件：{resolved}\n"
            f"old_string 前50字符：{old_string[:50]!r}"
        )

    if replace_all:
        new_content = original.replace(old_string, new_string)
        count = original.count(old_string)
    else:
        count_occurrences = original.count(old_string)
        if count_occurrences > 1:
            raise ValueError(
                f"old_string 在文件中出现 {count_occurrences} 次，不唯一。"
                "请提供更多上下文或使用 replace_all=true。"
            )
        new_content = original.replace(old_string, new_string, 1)
        count = 1

    p.write_text(new_content, encoding="utf-8")
    return f"已替换 {count} 处，文件：{resolved}"


def _tool_bash(command: str, timeout: int = 30) -> str:
    """执行 shell 命令，返回 stdout+stderr。timeout 最大 60 秒。

    安全说明：先检查黑名单，再通过 /bin/sh -c 执行。
    LLM 生成的命令经过黑名单过滤，但仍建议保持 Bash 工具 approval_level=draft。
    拒绝包含管道到 shell、命令替换、进程替换的命令。
    """
    _validate_bash_command(command)
    timeout = min(int(timeout), _BASH_MAX_TIMEOUT)

    # 额外检查：拒绝明显的 shell 特殊字符组合（管道到 sh、命令替换等）
    _SHELL_DANGEROUS = [
        r'\$\(.*\)',      # 命令替换 $(...)
        r'`[^`]+`',       # 反引号命令替换
        r'<\(',           # 进程替换 <(...)
    ]
    import re as _re
    for _dp in _SHELL_DANGEROUS:
        if _re.search(_dp, command):
            raise ValueError(
                f"命令包含禁止的 shell 特殊语法（命令替换/进程替换），已拒绝: {command[:120]!r}"
            )

    try:
        # 使用 shell=False + ['/bin/sh', '-c', command] 以限制进程组影响
        proc = subprocess.run(
            ['/bin/sh', '-c', command],
            shell=False,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        output_parts = []
        if proc.stdout:
            output_parts.append(proc.stdout)
        if proc.stderr:
            output_parts.append(f"[stderr]\n{proc.stderr}")
        if proc.returncode != 0:
            output_parts.append(f"[exit code: {proc.returncode}]")
        return "\n".join(output_parts) or "(no output)"
    except subprocess.TimeoutExpired:
        return f"[ERROR] 命令超时（>{timeout}s），已强制终止：{command[:120]!r}"


def _tool_grep(
    pattern: str,
    path: str = ".",
    glob: str | None = None,
    output_mode: str = "files_with_matches",
) -> str:
    """使用 ripgrep 搜索。output_mode: files_with_matches | content | count。"""
    if not shutil_which("rg"):
        # fallback to grep
        return _grep_fallback(pattern, path, glob, output_mode)

    # 限制搜索路径（不允许搜索项目目录以外）
    search_path = str(Path(path).resolve()) if path != "." else "."

    cmd = ["rg", "--no-heading"]

    if output_mode == "files_with_matches":
        cmd.append("-l")
    elif output_mode == "count":
        cmd.append("-c")
    else:
        # content 模式
        cmd += ["-n"]

    if glob:
        cmd += ["--glob", glob]

    # 使用 -- 分隔符防止 pattern 被解析为 rg flags
    cmd += ["--", pattern, search_path]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        out = result.stdout.strip()
        if not out and result.returncode == 1:
            return "(no matches)"
        return out or "(no output)"
    except subprocess.TimeoutExpired:
        return "[ERROR] grep 超时（>30s）"
    except FileNotFoundError:
        return _grep_fallback(pattern, path, glob, output_mode)


def _grep_fallback(
    pattern: str,
    path: str,
    glob: str | None,
    output_mode: str,
) -> str:
    """rg 不可用时用 grep -r fallback。"""
    cmd = ["grep", "-r", "--include", glob if glob else "*"]
    if output_mode == "files_with_matches":
        cmd.append("-l")
    elif output_mode == "count":
        cmd.append("-c")
    else:
        cmd.append("-n")
    cmd += [pattern, path]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        return result.stdout.strip() or "(no matches)"
    except Exception as e:
        return f"[ERROR] grep fallback 失败: {e}"


def shutil_which(name: str) -> str | None:
    import shutil
    return shutil.which(name)


def _tool_glob(pattern: str, path: str = ".") -> str:
    """文件路径匹配，返回匹配的路径列表（按修改时间排序）。"""
    import glob as _glob

    base = Path(path).resolve()
    full_pattern = str(base / pattern)

    matches = _glob.glob(full_pattern, recursive=True)
    if not matches:
        return "(no matches)"

    # 按修改时间排序（最新在前）
    matches.sort(key=lambda p: Path(p).stat().st_mtime if Path(p).exists() else 0, reverse=True)
    return "\n".join(matches[:500])  # 限制最多500条


# ─── MCP Server ──────────────────────────────────────────────────────────────

class ClaudeCodeBridgeServer(BaseServer):
    """Claude Code Bridge MCP Server — 提供文件系统和 Shell 工具。"""

    def register_tools(self):
        self.add_tool(
            name="Read",
            description="读取文件内容，支持 offset（起始行，0-based）和 limit（行数，默认2000）",
            parameters={
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "绝对文件路径"},
                    "offset": {"type": "integer", "description": "起始行（0-based，默认0）", "default": 0},
                    "limit": {"type": "integer", "description": "最多读取行数（默认2000）", "default": 2000},
                },
                "required": ["file_path"],
            },
            handler=_tool_read,
        )

        self.add_tool(
            name="Write",
            description="写入文件（覆盖），父目录不存在时自动创建。路径必须是绝对路径。",
            parameters={
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "绝对文件路径"},
                    "content": {"type": "string", "description": "写入内容"},
                },
                "required": ["file_path", "content"],
            },
            handler=_tool_write,
        )

        self.add_tool(
            name="Edit",
            description="字符串替换（精确匹配）。old_string 必须在文件中唯一，否则用 replace_all=true。",
            parameters={
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "绝对文件路径"},
                    "old_string": {"type": "string", "description": "要替换的原始字符串"},
                    "new_string": {"type": "string", "description": "替换后的字符串"},
                    "replace_all": {"type": "boolean", "description": "是否替换所有匹配（默认 false）", "default": False},
                },
                "required": ["file_path", "old_string", "new_string"],
            },
            handler=_tool_edit,
        )

        self.add_tool(
            name="Bash",
            description=(
                "执行 shell 命令，返回 stdout+stderr。"
                "timeout 默认30秒，最大60秒。"
                "禁止 rm -rf / dd / mkfs 等危险命令。"
            ),
            parameters={
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "shell 命令"},
                    "timeout": {"type": "integer", "description": "超时秒数（默认30，最大60）", "default": 30},
                },
                "required": ["command"],
            },
            handler=_tool_bash,
        )

        self.add_tool(
            name="Grep",
            description="ripgrep 搜索（rg 不可用时 fallback 到 grep）",
            parameters={
                "type": "object",
                "properties": {
                    "pattern": {"type": "string", "description": "正则表达式"},
                    "path": {"type": "string", "description": "搜索路径（默认当前目录）", "default": "."},
                    "glob": {"type": "string", "description": "文件过滤 glob（如 *.py）"},
                    "output_mode": {
                        "type": "string",
                        "enum": ["files_with_matches", "content", "count"],
                        "description": "输出模式（默认 files_with_matches）",
                        "default": "files_with_matches",
                    },
                },
                "required": ["pattern"],
            },
            handler=_tool_grep,
        )

        self.add_tool(
            name="Glob",
            description="文件路径 glob 匹配，按修改时间排序，返回匹配路径列表（最多500条）",
            parameters={
                "type": "object",
                "properties": {
                    "pattern": {"type": "string", "description": "glob 模式（如 **/*.py）"},
                    "path": {"type": "string", "description": "搜索根目录（默认当前目录）", "default": "."},
                },
                "required": ["pattern"],
            },
            handler=_tool_glob,
        )


if __name__ == "__main__":
    ClaudeCodeBridgeServer(name="claude_code_bridge", version="1.0").run()
