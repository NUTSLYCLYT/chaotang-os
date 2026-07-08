"""太医院 —— 环境/依赖/端口基础体检(最小可行版,2026-07-07)。

背景:整肃令文档(docs/chaotang_rectification_court_order_2026-06-07.md)定位太医院
"体检:环境、依赖、端口、build artifact",config/advisor_protocols.yaml 也登记了
owner=太医院,但从未有过真实代码——只是治理配置里的占位符。本脚本补上最小可行版:
一条命令跑完就知道本地环境行不行,不需要真的先起服务才发现哪里配置漏了。

用法: python scripts/taiyiyuan_checkup.py
退出码: 0=全绿, 1=有 FAIL(阻断级), 2=只有 WARN(能跑但有隐患)
"""

from __future__ import annotations

import importlib
import os
import socket
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ROOT))

_CORE_MODULES = [
    "litellm",
    "yaml",
    "fastapi",
    "uvicorn",
    "sqlalchemy",
    "alembic",
    "pypdf",
    "httpx",
]

_REQUIRED_ENV_VARS = ["FENGQUN_JWT_SECRET"]

_PORTS_TO_CHECK = [
    (8081, "jiqun_ai 后端(web.main)"),
    (4444, "litellm proxy"),
]


def _load_env_file() -> None:
    env_path = _ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())


def check_dependencies() -> list[tuple[str, str, str]]:
    """返回 (level, name, detail) 列表。level: FAIL/WARN/OK。"""
    results = []
    for mod in _CORE_MODULES:
        try:
            importlib.import_module(mod)
            results.append(("OK", mod, "已安装"))
        except ImportError as e:
            results.append(("FAIL", mod, f"未安装或导入失败: {e}"))
    return results


def check_ports() -> list[tuple[str, str, str]]:
    results = []
    for port, desc in _PORTS_TO_CHECK:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(0.5)
        try:
            in_use = sock.connect_ex(("127.0.0.1", port)) == 0
        finally:
            sock.close()
        if in_use:
            results.append(("OK", f"port:{port}", f"{desc} 正在监听"))
        else:
            results.append(("WARN", f"port:{port}", f"{desc} 未监听(如需服务先起它)"))
    return results


def check_env_vars() -> list[tuple[str, str, str]]:
    results = []
    for var in _REQUIRED_ENV_VARS:
        val = os.environ.get(var, "")
        if not val:
            results.append(("FAIL", var, "未设置(见 .env.example)"))
        elif var == "FENGQUN_JWT_SECRET" and len(val) < 32:
            results.append(("WARN", var, f"已设置但长度仅 {len(val)},建议 >=32"))
        else:
            results.append(("OK", var, "已设置"))
    return results


def check_provider_key() -> list[tuple[str, str, str]]:
    try:
        from src.provider import check_active_provider_key

        ok, message = check_active_provider_key()
        return [("OK" if ok else "FAIL", "active_provider_key", message)]
    except Exception as e:
        return [("WARN", "active_provider_key", f"检查本身失败: {e}")]


def main() -> int:
    _load_env_file()

    sections = [
        ("依赖", check_dependencies()),
        ("端口", check_ports()),
        ("环境变量", check_env_vars()),
        ("Provider Key", check_provider_key()),
    ]

    icons = {"OK": "✅", "WARN": "⚠️", "FAIL": "❌"}
    has_fail = False
    has_warn = False

    print("=== 太医院体检 ===\n")
    for title, results in sections:
        print(f"[{title}]")
        for level, name, detail in results:
            print(f"  {icons[level]} {name}: {detail}")
            has_fail = has_fail or level == "FAIL"
            has_warn = has_warn or level == "WARN"
        print()

    if has_fail:
        print("诊断结论: ❌ 有阻断级问题,服务可能起不来或首次调用才炸")
        return 1
    if has_warn:
        print("诊断结论: ⚠️ 能跑但有隐患,建议处理")
        return 2
    print("诊断结论: ✅ 环境健康")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
