"""工具沙箱模块 — 进程级隔离、资源限制、危险命令强制拦截、网络出站过滤。

集成点：
- tool_router.py: 在 _execute_tool() 中调用 ToolSandbox.execute()
- mcp_servers.yaml: 新增 sandbox 配置段
"""

from __future__ import annotations

import ipaddress
import json
import logging
import os
import re
import resource
import socket
import subprocess
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_DANGEROUS_COMMANDS = [
    re.compile(r'\brm\s+(-[rf]+\s+|.*--no-preserve-root)', re.I),
    re.compile(r'\bdd\s+if=', re.I),
    re.compile(r'\bmkfs\b', re.I),
    re.compile(r'\bformat\b', re.I),
    re.compile(r'>\s*/dev/sd', re.I),
    re.compile(r'\bshutdown\b', re.I),
    re.compile(r'\breboot\b', re.I),
    re.compile(r'\binit\s+[06]', re.I),
    re.compile(r'\b(systemctl|service)\s+(stop|disable|mask)\s+(ssh|nginx|docker|firewall)', re.I),
    re.compile(r'\bcurl\s+.*\|\s*(bash|sh|zsh)', re.I),
    re.compile(r'\bwget\s+.*\|\s*(bash|sh|zsh)', re.I),
    re.compile(r'\b(pip|npm|gem)\s+install\s+.*\|\s*(bash|sh)', re.I),
    re.compile(r'\bchmod\s+([0-7]*7[0-7]*)\s+/(etc|usr|bin|sbin|boot)', re.I),
    re.compile(r'\bchown\s+.*\s+/(etc|usr|bin|sbin|boot)', re.I),
    re.compile(r'\bmount\b', re.I),
    re.compile(r'\bumount\b', re.I),
    re.compile(r'\biptables\b', re.I),
    re.compile(r'\bcrontab\b', re.I),
    re.compile(r'\b(?:sudo|su)\s+', re.I),
    re.compile(r'\bnc\s+.*-[le]', re.I),
    re.compile(r'\b/dev/tcp/', re.I),
    re.compile(r'\b(eval|exec)\s+\$', re.I),
    re.compile(r'\bgit\s+(push\s+--force|reset\s+--hard|clean\s+-fd)', re.I),
    re.compile(r'\bdocker\s+(rm|rmi|system\s+prune|volume\s+prune)', re.I),
    re.compile(r'\bkubectl\s+(delete|scale\s+--replicas=0)', re.I),
]

_SENSITIVE_PATHS = [
    "/etc/shadow", "/etc/passwd", "/etc/ssh/", "/root/.ssh/",
    "/etc/nginx/", "/etc/systemd/", "/etc/fstab",
    "/boot/", "/proc/sys/", "/sys/",
]

_ALLOWED_NETWORK_DOMAINS: set[str] = set()

_NETWORK_BLACKLIST_PORTS = {25, 465, 587}

_SANDBOX_CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "sandbox.yaml"


def _is_blocked_ip(ip_str: str) -> bool:
    """判断单个 IP(v4/v6)是否落在内网/回环/链路本地/保留段(含云元数据 169.254.x)。"""
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return True  # 解析不出的地址一律当危险处理
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


def _blocked_internal_target(hostname: str) -> str:
    """解析 hostname 到全部 IP 并逐个检查;命中内网/保留段返回原因串,否则返回空串。

    2026-07-03 对抗复审抓到:restricted 模式此前是字面量 `pass`,内网/元数据地址
    完全不设防(与前端 SSRF 洞是同一类问题的第二个独立面)。
    """
    if not hostname:
        return "空主机名"
    try:
        infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        return f"域名解析失败: {hostname}"
    for info in infos:
        ip_str = info[4][0]
        if _is_blocked_ip(ip_str):
            return f"{hostname} 解析到内网/保留地址 {ip_str}"
    return ""


@dataclass
class SandboxConfig:
    enabled: bool = True
    max_cpu_seconds: int = 30
    max_memory_mb: int = 512
    max_output_bytes: int = 1_000_000
    max_file_size_mb: int = 10
    allowed_write_paths: list[str] = field(default_factory=list)
    blocked_commands: list[str] = field(default_factory=list)
    network_mode: str = "restricted"
    allowed_domains: list[str] = field(default_factory=list)
    working_dir: str | None = None


@dataclass
class SandboxResult:
    allowed: bool = True
    output: str = ""
    exit_code: int = 0
    blocked_reason: str = ""
    resource_usage: dict = field(default_factory=dict)
    execution_time_ms: int = 0


class ToolSandbox:
    """工具执行沙箱。

    三层防护：
    1. 命令预检：拦截危险命令和路径
    2. 参数扫描：检查敏感数据泄露
    3. 资源限制：CPU/内存/输出大小
    """

    def __init__(self, config: SandboxConfig | None = None):
        self.config = config or self._load_config()
        self._injection_detector = None

    def _load_config(self) -> SandboxConfig:
        if _SANDBOX_CONFIG_PATH.exists():
            try:
                import yaml
                data = yaml.safe_load(_SANDBOX_CONFIG_PATH.read_text(encoding="utf-8")) or {}
                return SandboxConfig(
                    enabled=data.get("enabled", True),
                    max_cpu_seconds=data.get("max_cpu_seconds", 30),
                    max_memory_mb=data.get("max_memory_mb", 512),
                    max_output_bytes=data.get("max_output_bytes", 1_000_000),
                    max_file_size_mb=data.get("max_file_size_mb", 10),
                    allowed_write_paths=data.get("allowed_write_paths", []),
                    blocked_commands=data.get("blocked_commands", []),
                    network_mode=data.get("network_mode", "restricted"),
                    allowed_domains=data.get("allowed_domains", []),
                    working_dir=data.get("working_dir"),
                )
            except Exception as e:
                logger.warning("沙箱配置加载失败，使用默认: %s", e)
        return SandboxConfig()

    def validate_command(self, command: str) -> SandboxResult:
        """预检验证命令是否安全执行。"""
        if not self.config.enabled:
            return SandboxResult(allowed=True)

        for pattern in _DANGEROUS_COMMANDS:
            match = pattern.search(command)
            if match:
                reason = f"危险命令被拦截: 匹配规则 '{match.group()[:30]}...'"
                logger.warning("ToolSandbox: %s", reason)
                return SandboxResult(allowed=False, blocked_reason=reason)

        for sensitive_path in _SENSITIVE_PATHS:
            if sensitive_path in command:
                reason = f"访问敏感路径被拦截: {sensitive_path}"
                logger.warning("ToolSandbox: %s", reason)
                return SandboxResult(allowed=False, blocked_reason=reason)

        for blocked in self.config.blocked_commands:
            if blocked in command:
                reason = f"自定义黑名单命令被拦截: {blocked}"
                return SandboxResult(allowed=False, blocked_reason=reason)

        from src.security import scan_sensitive_data
        scan = scan_sensitive_data(command, strict=True)
        if scan.risk_level == "high":
            reason = f"命令参数包含敏感数据: {', '.join(f['type'] for f in scan.findings)}"
            logger.warning("ToolSandbox: %s", reason)
            return SandboxResult(allowed=False, blocked_reason=reason)

        return SandboxResult(allowed=True)

    def validate_file_path(self, file_path: str, operation: str = "read") -> SandboxResult:
        """验证文件操作路径是否安全。"""
        if not self.config.enabled:
            return SandboxResult(allowed=True)

        abs_path = os.path.abspath(file_path)

        if ".." in Path(abs_path).parts:
            return SandboxResult(allowed=False, blocked_reason="路径包含 '..' 目录穿越")

        for sp in _SENSITIVE_PATHS:
            if abs_path.startswith(sp):
                return SandboxResult(allowed=False, blocked_reason=f"禁止访问系统路径: {sp}")

        if operation == "write":
            project_root = str(Path(__file__).resolve().parent.parent)
            allowed = [project_root] + self.config.allowed_write_paths
            if not any(abs_path.startswith(p) for p in allowed):
                return SandboxResult(
                    allowed=False,
                    blocked_reason=f"写入路径超出允许范围: {abs_path}",
                )

        return SandboxResult(allowed=True)

    def validate_network(self, url: str) -> SandboxResult:
        """验证网络请求目标是否被允许。"""
        if not self.config.enabled:
            return SandboxResult(allowed=True)

        if self.config.network_mode == "open":
            return SandboxResult(allowed=True)

        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            port = parsed.port

            if port and port in _NETWORK_BLACKLIST_PORTS:
                return SandboxResult(
                    allowed=False,
                    blocked_reason=f"禁止访问端口 {port}",
                )

            if self.config.network_mode == "whitelist":
                domain = parsed.hostname or ""
                if self.config.allowed_domains and domain not in self.config.allowed_domains:
                    return SandboxResult(
                        allowed=False,
                        blocked_reason=f"域名不在白名单: {domain}",
                    )

            if self.config.network_mode == "restricted":
                blocked = _blocked_internal_target(parsed.hostname or "")
                if blocked:
                    return SandboxResult(
                        allowed=False,
                        blocked_reason=f"禁止访问内网/保留地址: {blocked}",
                    )

        except Exception as e:
            logger.warning("网络验证异常: %s", e)

        return SandboxResult(allowed=True)

    def execute_sandboxed(
        self,
        command: str,
        timeout: int | None = None,
        cwd: str | None = None,
        env: dict | None = None,
    ) -> SandboxResult:
        """在受限环境中执行命令。"""
        validation = self.validate_command(command)
        if not validation.allowed:
            return validation

        cpu_limit = timeout or self.config.max_cpu_seconds
        work_dir = cwd or self.config.working_dir or str(Path(__file__).resolve().parent.parent)

        safe_env = {
            k: v for k, v in (env or os.environ).items()
            if not any(s in k.upper() for s in ["PASSWORD", "SECRET", "TOKEN", "PRIVATE_KEY", "AWS_SECRET"])
        }
        safe_env["PATH"] = os.environ.get("PATH", "")

        t0 = time.monotonic()
        try:
            proc = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=cpu_limit,
                cwd=work_dir,
                env=safe_env,
            )
            elapsed_ms = int((time.monotonic() - t0) * 1000)

            stdout = proc.stdout
            if len(stdout.encode('utf-8', errors='replace')) > self.config.max_output_bytes:
                stdout = stdout[:self.config.max_output_bytes] + "\n[输出被截断]"

            return SandboxResult(
                allowed=True,
                output=stdout,
                exit_code=proc.returncode,
                execution_time_ms=elapsed_ms,
                resource_usage={
                    "timeout_seconds": cpu_limit,
                    "max_output_bytes": self.config.max_output_bytes,
                },
            )
        except subprocess.TimeoutExpired:
            elapsed_ms = int((time.monotonic() - t0) * 1000)
            return SandboxResult(
                allowed=True,
                output=f"[TIMEOUT] 命令在 {cpu_limit}s 后被强制终止",
                exit_code=-1,
                execution_time_ms=elapsed_ms,
                resource_usage={"timeout": True},
            )
        except Exception as e:
            return SandboxResult(
                allowed=True,
                output=f"[ERROR] {e}",
                exit_code=-1,
            )

    def validate_tool_args(self, tool_name: str, arguments: dict) -> SandboxResult:
        """验证工具调用参数安全性。"""
        if not self.config.enabled:
            return SandboxResult(allowed=True)

        all_text = json.dumps(arguments, ensure_ascii=False)

        if tool_name in ("Bash",) and "command" in arguments:
            return self.validate_command(arguments["command"])

        if tool_name in ("Write", "Edit") and "file_path" in arguments:
            return self.validate_file_path(arguments["file_path"], "write")

        if tool_name in ("Read", "Grep", "Glob") and "file_path" in arguments:
            return self.validate_file_path(arguments.get("file_path", arguments.get("path", ".")), "read")

        if tool_name in ("fetch_url",) and "url" in arguments:
            return self.validate_network(arguments["url"])

        from src.security import scan_sensitive_data
        scan = scan_sensitive_data(all_text, strict=True)
        if scan.risk_level == "high":
            return SandboxResult(
                allowed=False,
                blocked_reason=f"工具参数包含敏感数据: {[f['type'] for f in scan.findings]}",
            )

        return SandboxResult(allowed=True)
