"""Skill 包管理器：安装、列出、删除外部 Skill 包。

Skill 包格式（本地目录或远程 URL）：
    skills/{skill_name}/
    ├── skill.yaml      ← 元信息（名字、描述、工具列表、transport、hooks）
    ├── server.py       ← MCP Server 实现（继承 BaseServer）
    ├── hooks/          ← Hook 脚本（可选）
    │   ├── pre_prompt.py    ← Agent 执行前调用，返回额外 prompt 片段
    │   └── post_output.py   ← Agent 输出后调用，可后处理/校验输出
    └── requirements.txt← 额外依赖（可选）

hooks 字段（skill.yaml）：
    hooks:
      pre_prompt: "hooks/pre_prompt.py"   # 执行前注入额外上下文
      post_output: "hooks/post_output.py" # 输出后校验/增强

Hook 脚本接口：
    pre_prompt(context: dict) -> str
        context = {"task_input": ..., "step_id": ..., "flow_id": ...}
        返回要注入到 prompt 末尾的文本（空字符串表示无注入）
    post_output(context: dict) -> dict
        context = {"output": ..., "step_id": ..., "flow_id": ...}
        返回 {"output": str, "approved": bool, "annotations": str}

安装流程：
    1. 下载/复制 Skill 包到 skills/{name}/
    2. 自动注册到 config/mcp_servers.yaml
    3. 验证 Server 可启动

技术选型：
    - 本地安装：从目录或 .tar.gz 文件
    - 远程安装：从 URL 下载（支持 GitHub/SkillHub）
"""

from __future__ import annotations

import importlib.util
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any, Callable

import yaml

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SKILLS_DIR = PROJECT_ROOT / "skills"
MCP_SERVERS_CONFIG = PROJECT_ROOT / "config" / "mcp_servers.yaml"


def _load_hook_fn(script_path: Path, fn_name: str) -> Callable | None:
    """动态加载 hook 脚本中的指定函数。

    Returns:
        函数对象，或 None（脚本不存在或函数不存在）
    """
    if not script_path.exists():
        return None
    try:
        spec = importlib.util.spec_from_file_location(
            f"skill_hook_{script_path.stem}", str(script_path),
        )
        if spec is None or spec.loader is None:
            return None
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return getattr(mod, fn_name, None)
    except Exception:
        return None


def load_skill_hooks(skill_name: str) -> dict[str, Callable]:
    """加载指定 Skill 的 hooks。

    Returns:
        {"pre_prompt": fn | None, "post_output": fn | None}
    """
    skill_dir = SKILLS_DIR / skill_name
    skill_yaml = skill_dir / "skill.yaml"
    if not skill_yaml.exists():
        return {"pre_prompt": None, "post_output": None}

    meta = yaml.safe_load(skill_yaml.read_text(encoding="utf-8")) or {}
    hooks_cfg = meta.get("hooks", {})

    result: dict[str, Callable | None] = {"pre_prompt": None, "post_output": None}

    pre_path = hooks_cfg.get("pre_prompt")
    if pre_path:
        fn = _load_hook_fn(skill_dir / pre_path, "pre_prompt")
        if fn:
            result["pre_prompt"] = fn

    post_path = hooks_cfg.get("post_output")
    if post_path:
        fn = _load_hook_fn(skill_dir / post_path, "post_output")
        if fn:
            result["post_output"] = fn

    return result


def run_pre_prompt_hooks(
    step_tools: list[dict], context: dict,
) -> str:
    """执行所有相关 Skill 的 pre_prompt hooks，拼接结果。

    Args:
        step_tools: 当前步骤的工具列表（来自 YAML step.tools 或 ToolRouter 解析结果）
                    每项含 "server" 字段，格式 "skill_{name}" 表示外部 Skill
        context: {"task_input": str, "step_id": str, "flow_id": str}

    Returns:
        拼接后的额外 prompt 文本（空字符串表示无注入）
    """
    parts: list[str] = []
    for entry in step_tools:
        server_id = entry.get("server", "")
        if not server_id.startswith("skill_"):
            continue
        skill_name = server_id[len("skill_"):]
        hooks = load_skill_hooks(skill_name)
        fn = hooks.get("pre_prompt")
        if fn:
            try:
                result = fn(context)
                if result and isinstance(result, str):
                    parts.append(result)
            except Exception:
                pass
    return "\n\n".join(parts)


def run_post_output_hooks(
    step_tools: list[dict], context: dict,
) -> dict:
    """执行所有相关 Skill 的 post_output hooks。

    Args:
        step_tools: 同 run_pre_prompt_hooks
        context: {"output": str, "step_id": str, "flow_id": str}

    Returns:
        {"approved": bool, "annotations": list[str], "output_override": str | None}
    """
    approved = True
    annotations: list[str] = []
    output_override: str | None = None

    for entry in step_tools:
        server_id = entry.get("server", "")
        if not server_id.startswith("skill_"):
            continue
        skill_name = server_id[len("skill_"):]
        hooks = load_skill_hooks(skill_name)
        fn = hooks.get("post_output")
        if fn:
            try:
                result = fn(context)
                if isinstance(result, dict):
                    if not result.get("approved", True):
                        approved = False
                    ann = result.get("annotations", "")
                    if ann:
                        annotations.append(str(ann))
                    if "output" in result and output_override is None:
                        output_override = result["output"]
            except Exception:
                pass

    return {
        "approved": approved,
        "annotations": annotations,
        "output_override": output_override,
    }

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SKILLS_DIR = PROJECT_ROOT / "skills"
MCP_SERVERS_CONFIG = PROJECT_ROOT / "config" / "mcp_servers.yaml"


def install_skill(source: str, name: str | None = None) -> dict:
    """安装 Skill 包。

    Args:
        source: 本地目录路径、.tar.gz 文件路径、或远程 URL
        name: Skill 名称（可选，从 skill.yaml 读取）

    Returns:
        {"status": "installed", "name": ..., "tools": [...]}
    """
    # 远程 URL
    if source.startswith("http://") or source.startswith("https://"):
        return _install_from_url(source, name)

    # 本地路径
    source_path = Path(source)
    if not source_path.is_absolute():
        source_path = PROJECT_ROOT / source_path
    if source_path.is_dir():
        return _install_from_dir(source_path, name)

    raise ValueError(f"无法识别的安装源: {source}（路径不存在: {source_path}）")


def _install_from_dir(source_dir: Path, name: str | None = None) -> dict:
    """从本地目录安装。"""
    skill_yaml = source_dir / "skill.yaml"
    if not skill_yaml.exists():
        raise FileNotFoundError(f"skill.yaml 不存在: {skill_yaml}")

    meta = yaml.safe_load(skill_yaml.read_text(encoding="utf-8"))
    skill_name = name or meta.get("name", source_dir.name)

    # 复制到 skills/ 目录（如果源和目标不同）
    target_dir = SKILLS_DIR / skill_name
    if source_dir.resolve() != target_dir.resolve():
        if target_dir.exists():
            shutil.rmtree(target_dir)
        shutil.copytree(source_dir, target_dir)

    # 安装额外依赖
    req_file = target_dir / "requirements.txt"
    if req_file.exists():
        subprocess.run(
            ["pip", "install", "-r", str(req_file)],
            capture_output=True, text=True,
        )

    # 注册到 mcp_servers.yaml
    _register_skill(skill_name, meta, target_dir)

    tools = [t["name"] for t in meta.get("tools", [])]
    return {"status": "installed", "name": skill_name, "tools": tools}


def _install_from_url(url: str, name: str | None = None) -> dict:
    """从远程 URL 安装。"""
    import tempfile
    import urllib.request

    # 下载到临时目录
    tmp_dir = Path(tempfile.mkdtemp())
    try:
        # 判断是 GitHub repo 还是直接下载
        if "github.com" in url:
            # git clone
            subprocess.run(
                ["git", "clone", "--depth", "1", url, str(tmp_dir / "repo")],
                capture_output=True, text=True, check=True,
            )
            repo_dir = tmp_dir / "repo"
            # 如果 repo 根目录有 skill.yaml，直接用；否则找子目录
            if (repo_dir / "skill.yaml").exists():
                return _install_from_dir(repo_dir, name)
            for d in repo_dir.iterdir():
                if d.is_dir() and (d / "skill.yaml").exists():
                    return _install_from_dir(d, name)
            raise FileNotFoundError("Git 仓库中未找到 skill.yaml")
        else:
            # 直接下载 tar.gz 或 zip
            archive_path = tmp_dir / "skill.tar.gz"
            urllib.request.urlretrieve(url, str(archive_path))
            shutil.unpack_archive(str(archive_path), str(tmp_dir / "unpacked"))
            unpacked = tmp_dir / "unpacked"
            for d in unpacked.rglob("skill.yaml"):
                return _install_from_dir(d.parent, name)
            raise FileNotFoundError("下载包中未找到 skill.yaml")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def _register_skill(skill_name: str, meta: dict, skill_dir: Path):
    """将 Skill 注册到 mcp_servers.yaml。"""
    if not MCP_SERVERS_CONFIG.exists():
        config = {"servers": {}, "global": {}}
    else:
        config = yaml.safe_load(MCP_SERVERS_CONFIG.read_text(encoding="utf-8")) or {}

    servers = config.setdefault("servers", {})

    # 构建 server 配置
    transport = meta.get("transport", "stdio")
    command = meta.get("command", "python3 server.py")
    # 将命令路径改为相对于项目根目录
    if not command.startswith("/"):
        command = f"python3 skills/{skill_name}/{command.split()[-1]}"

    server_cfg = {
        "transport": transport,
        "command": command,
        "description": meta.get("description", f"外部 Skill: {skill_name}"),
        "tools": [],
    }

    for tool_meta in meta.get("tools", []):
        server_cfg["tools"].append({
            "name": tool_meta["name"],
            "description": tool_meta.get("description", ""),
            "approval_level": tool_meta.get("approval_level", "none"),
            "parameters": tool_meta.get("parameters", {"type": "object", "properties": {}}),
        })

    servers[f"skill_{skill_name}"] = server_cfg

    # 写回配置
    MCP_SERVERS_CONFIG.write_text(
        yaml.dump(config, allow_unicode=True, default_flow_style=False, sort_keys=False),
        encoding="utf-8",
    )


def list_skills() -> list[dict]:
    """列出所有已安装的 Skill 包。"""
    if not SKILLS_DIR.exists():
        return []
    result = []
    for d in sorted(SKILLS_DIR.iterdir()):
        if not d.is_dir() or d.name.startswith("."):
            continue
        skill_yaml = d / "skill.yaml"
        if skill_yaml.exists():
            meta = yaml.safe_load(skill_yaml.read_text(encoding="utf-8"))
            result.append({
                "name": meta.get("name", d.name),
                "version": meta.get("version", "?"),
                "description": meta.get("description", ""),
                "author": meta.get("author", ""),
                "tools": [t["name"] for t in meta.get("tools", [])],
                "hooks": list(meta.get("hooks", {}).keys()),
                "path": str(d),
            })
        else:
            result.append({"name": d.name, "version": "?", "description": "(缺少 skill.yaml)", "tools": [], "path": str(d)})
    return result


def remove_skill(skill_name: str) -> bool:
    """删除已安装的 Skill 包。"""
    skill_dir = SKILLS_DIR / skill_name
    if not skill_dir.exists():
        return False

    # 从 mcp_servers.yaml 移除
    if MCP_SERVERS_CONFIG.exists():
        config = yaml.safe_load(MCP_SERVERS_CONFIG.read_text(encoding="utf-8")) or {}
        servers = config.get("servers", {})
        key = f"skill_{skill_name}"
        if key in servers:
            del servers[key]
            MCP_SERVERS_CONFIG.write_text(
                yaml.dump(config, allow_unicode=True, default_flow_style=False, sort_keys=False),
                encoding="utf-8",
            )

    # 删除目录
    shutil.rmtree(skill_dir)
    return True
