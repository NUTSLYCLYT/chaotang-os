"""Prompt 组装器：从 4 个结构化 .md 文件组装最终 system prompt。

文件结构：
    runtime_prompts/{prompt_key}/
        IDENTITY.md  — 角色定位、核心信条、能力边界
        SOUL.md      — 铁律、行为准则
        AGENTS.md    — 工作流程、输出模块定义
        USER.md      — 输出规范、交互约束
        .factory     — 出厂指纹（JSON，记录初始化时的文件 hash）

组装顺序：IDENTITY → SOUL → AGENTS → USER
运行时优先从文件读取；文件不存在时 fallback 到代码中的注册 prompt。

升级机制（三态对比）：
    factory_v1（.factory 中记录的 hash）
    factory_v2（代码中的新版 prompt 拆分后的 hash）
    user_current（runtime_prompts/ 当前文件的 hash）

    user == v1 → 用户没改 → 安全覆盖
    user != v1 → 用户改过 → 生成 .upgrade_proposal，不覆盖
    v1 == v2   → 出厂没变 → 跳过
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from src.runtime_paths import BACKEND_ROOT, resolve_runtime_paths

RUNTIME_PROMPTS_DIR = Path(__file__).resolve().parent.parent / "runtime_prompts"
MEMORY_PERSONS_DIR = resolve_runtime_paths().memory / "persons"
MEMORY_PERSON_SEEDS_DIR = BACKEND_ROOT / "resources" / "memory_profiles" / "persons"


def load_person_profile(person_id: str) -> str:
    """加载指定人物的人格快照 profile。

    Args:
        person_id: 人物 ID，对应 memory/persons/{person_id}.md 文件名（不含扩展名）。

    Returns:
        profile 文件内容字符串；找不到文件时返回空字符串，不抛异常。
    """
    profile_path = MEMORY_PERSONS_DIR / f"{person_id}.md"
    if not profile_path.exists():
        profile_path = MEMORY_PERSON_SEEDS_DIR / f"{person_id}.md"
    if not profile_path.exists():
        return ""
    try:
        return profile_path.read_text(encoding="utf-8").strip()
    except (OSError, IOError):
        return ""

# 5 个标准文件，按组装顺序
PROMPT_FILES = ["IDENTITY.md", "SOUL.md", "AGENTS.md", "USER.md", "TOOLS.md"]

FACTORY_FILE = ".factory"
UPGRADE_SUFFIX = ".upgrade_proposal"


def _normalize_text(text: str) -> str:
    """文本标准化：去首尾空白 + 统一换行符。防止空白符陷阱导致误判 hash。"""
    return text.strip().replace("\r\n", "\n").replace("\r", "\n")


def _content_hash(text: str) -> str:
    """计算标准化后文本的 hash（前 12 位 sha256）。"""
    normalized = _normalize_text(text)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:12]


def _read_factory(agent_dir: Path) -> dict | None:
    """读取 .factory 指纹文件。"""
    path = agent_dir / FACTORY_FILE
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, KeyError):
        return None


def _write_factory(agent_dir: Path, version: str, file_hashes: dict[str, str]):
    """写入 .factory 指纹文件。"""
    data = {
        "initialized_from": version,
        "hashes": file_hashes,
    }
    path = agent_dir / FACTORY_FILE
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def generate_tools_md(tools: list) -> str:
    """根据工具定义列表自动生成 TOOLS.md 内容。

    Args:
        tools: ToolDef 列表（来自 ToolRouter.get_tools_for_step）

    Returns:
        TOOLS.md 的 Markdown 文本
    """
    if not tools:
        return ""

    lines = [
        "## 可用工具",
        "",
        "你有以下工具可以在需要时主动调用。模型会自动判断是否需要使用工具。",
        "",
    ]
    for t in tools:
        approval = "（草稿模式：生成草稿后需人工确认）" if t.approval_level == "draft" else ""
        lines.append(f"### {t.name}{approval}")
        lines.append(f"- **功能**：{t.description}")
        # 从 parameters 提取参数说明
        props = t.parameters.get("properties", {})
        required = t.parameters.get("required", [])
        if props:
            lines.append("- **参数**：")
            for pname, pdef in props.items():
                req = "（必填）" if pname in required else "（可选）"
                lines.append(f"  - `{pname}` {req}：{pdef.get('description', '')}")
        lines.append("")

    lines.append("**使用原则**：只在确实需要外部数据或执行外部操作时才调用工具。"
                 "如果输入信息已经足够完成任务，不要为了调用而调用。")
    return "\n".join(lines)


def compose_prompt(
    prompt_key: str,
    person_id: str | None = None,
    skip_tools: bool = False,
    extra_context: str | None = None,
) -> str | None:
    """从 runtime_prompts/{prompt_key}/ 读取文件，组装为完整 prompt。

    Args:
        prompt_key: Agent 的 prompt 目录名。
        person_id: 可选。若指定，则从 memory/persons/{person_id}.md 加载人格快照。
        skip_tools: 若为 True，跳过 TOOLS.md 文件（用于 no_tools: true 的步骤）。
        extra_context: 可选。Skill pre_prompt hook 产出的额外上下文，追加到 prompt 末尾。

    Returns:
        组装后的 prompt 字符串，如果目录不存在或为空则返回 None。
    """
    agent_dir = RUNTIME_PROMPTS_DIR / prompt_key
    if not agent_dir.is_dir():
        return None

    parts = []
    for filename in PROMPT_FILES:
        if skip_tools and filename == "TOOLS.md":
            continue
        filepath = agent_dir / filename
        if filepath.exists():
            content = filepath.read_text(encoding="utf-8").strip()
            if content:
                parts.append(content)

    if not parts:
        return None

    if person_id:
        profile = load_person_profile(person_id)
        if profile:
            parts.append(f"## 用户人格快照（USER_PROFILE）\n\n{profile}")

    if extra_context:
        parts.append(extra_context)

    return "\n\n".join(parts)


def get_prompt_file(prompt_key: str, filename: str) -> str:
    """读取单个 prompt 文件内容。"""
    filepath = RUNTIME_PROMPTS_DIR / prompt_key / filename
    if not filepath.exists():
        return ""
    return filepath.read_text(encoding="utf-8")


def save_prompt_file(prompt_key: str, filename: str, content: str) -> Path:
    """保存单个 prompt 文件。"""
    agent_dir = RUNTIME_PROMPTS_DIR / prompt_key
    agent_dir.mkdir(parents=True, exist_ok=True)
    filepath = agent_dir / filename
    filepath.write_text(content, encoding="utf-8")
    return filepath


def list_prompt_agents() -> list[dict]:
    """列出所有有 runtime_prompts 目录的 agent。"""
    if not RUNTIME_PROMPTS_DIR.exists():
        return []
    result = []
    for d in sorted(RUNTIME_PROMPTS_DIR.iterdir()):
        if d.is_dir() and not d.name.startswith("."):
            files = {f.name: len(f.read_text(encoding="utf-8"))
                     for f in d.iterdir() if f.suffix == ".md"}
            result.append({"key": d.name, "files": files})
    return result


def split_prompt_to_files(prompt_key: str, full_prompt: str) -> dict[str, str]:
    """将一个完整的 prompt 字符串智能拆分为 4 个文件。

    拆分规则：
    - IDENTITY.md: 开头到第一个"## 必须遵守"或"## 铁律"之前（角色 + 信条 + 边界）
    - SOUL.md: "## 必须遵守"/"## 铁律"部分（行为准则）
    - AGENTS.md: "## 必须输出"/"## 你的任务"到"## 输出规范"之前（工作流 + 输出模板）
    - USER.md: "## 输出规范"及之后（交互约束）
    """
    lines = full_prompt.split("\n")
    sections = {"IDENTITY.md": [], "SOUL.md": [], "AGENTS.md": [], "USER.md": []}
    current = "IDENTITY.md"

    for line in lines:
        stripped = line.strip().lower()

        # 检测 SOUL 开始标记
        if any(k in stripped for k in ["## 必须遵守", "## 铁律", "铁律"]) and current == "IDENTITY.md":
            current = "SOUL.md"
            sections[current].append(line)
            continue

        # 检测 AGENTS 开始标记
        if any(k in stripped for k in ["## 你的任务", "## 必须输出", "## 你的输入"]) and current in ("IDENTITY.md", "SOUL.md"):
            current = "AGENTS.md"
            sections[current].append(line)
            continue

        # 检测 USER 开始标记
        if "## 输出规范" in stripped and current in ("SOUL.md", "AGENTS.md"):
            current = "USER.md"
            sections[current].append(line)
            continue

        sections[current].append(line)

    result = {}
    for filename, content_lines in sections.items():
        content = "\n".join(content_lines).strip()
        if content:
            result[filename] = content

    return result


def init_runtime_prompts_from_code():
    """从代码中的注册 prompt 批量初始化 runtime_prompts/ 目录。

    仅在目录不存在时执行，不覆盖已有文件。
    同时写入 .factory 指纹文件。
    """
    from src.prompts_versioned import _VERSIONED_PROMPTS

    created = 0
    for key, reg in _VERSIONED_PROMPTS.items():
        agent_dir = RUNTIME_PROMPTS_DIR / key
        if agent_dir.exists():
            # 目录已存在但缺 .factory → 补写（防御性）
            if not (agent_dir / FACTORY_FILE).exists():
                _rebuild_factory_for_existing(key, reg)
            continue

        current_content = reg._versions[-1].content if reg._versions else ""
        if not current_content:
            continue

        files = split_prompt_to_files(key, current_content)
        if not files:
            continue

        agent_dir.mkdir(parents=True, exist_ok=True)
        file_hashes = {}
        for filename, content in files.items():
            (agent_dir / filename).write_text(content, encoding="utf-8")
            file_hashes[filename] = _content_hash(content)

        version = reg._versions[-1].version if reg._versions else "v1"
        _write_factory(agent_dir, version, file_hashes)
        created += 1

    return created


def _rebuild_factory_for_existing(key: str, reg):
    """为已存在但缺 .factory 的目录补建指纹（防御性悲观）。"""
    agent_dir = RUNTIME_PROMPTS_DIR / key
    current_content = reg._versions[-1].content if reg._versions else ""
    if not current_content:
        return

    factory_files = split_prompt_to_files(key, current_content)
    file_hashes = {}
    for filename, content in factory_files.items():
        file_hashes[filename] = _content_hash(content)

    version = reg._versions[-1].version if reg._versions else "v1"
    _write_factory(agent_dir, version, file_hashes)


# ---------------------------------------------------------------------------
# 三态升级引擎
# ---------------------------------------------------------------------------


def upgrade_prompts() -> dict:
    """检查所有 Agent 的 runtime_prompts，对比代码中的最新版，生成升级报告。

    Returns:
        {
            "auto_upgraded": [...],     # 用户没改，已自动覆盖
            "proposals": [...],         # 用户改过，生成了 .upgrade_proposal
            "skipped": [...],           # 出厂版没变，跳过
            "no_factory": [...],        # 缺 .factory，走防御性路径
        }
    """
    from src.prompts_versioned import _VERSIONED_PROMPTS

    result = {
        "auto_upgraded": [],
        "proposals": [],
        "skipped": [],
        "no_factory": [],
    }

    for key, reg in _VERSIONED_PROMPTS.items():
        agent_dir = RUNTIME_PROMPTS_DIR / key
        if not agent_dir.exists():
            continue

        current_content = reg._versions[-1].content if reg._versions else ""
        if not current_content:
            continue

        # 拆分代码中的新版
        new_files = split_prompt_to_files(key, current_content)
        if not new_files:
            continue

        factory = _read_factory(agent_dir)

        # 先清理历史 .upgrade_proposal（GC）
        for f in agent_dir.glob(f"*{UPGRADE_SUFFIX}"):
            f.unlink()

        if factory is None:
            # 缺 .factory → 防御性悲观：假设用户改过，全部生成提案
            result["no_factory"].append(key)
            _generate_proposals(agent_dir, new_files)
            # 补建 .factory（基于新版，方便下次对比）
            new_hashes = {f: _content_hash(c) for f, c in new_files.items()}
            version = reg._versions[-1].version if reg._versions else "v1"
            _write_factory(agent_dir, version, new_hashes)
            continue

        old_hashes = factory.get("hashes", {})
        agent_auto = []
        agent_proposals = []
        agent_skipped = []

        for filename in PROMPT_FILES:
            new_content = new_files.get(filename, "")
            new_hash = _content_hash(new_content) if new_content else ""
            old_hash = old_hashes.get(filename, "")

            # 读取用户当前文件
            user_path = agent_dir / filename
            user_content = user_path.read_text(encoding="utf-8") if user_path.exists() else ""
            user_hash = _content_hash(user_content) if user_content else ""

            # 三态对比
            if old_hash == new_hash:
                # 出厂版没变 → 跳过
                agent_skipped.append(filename)
            elif user_hash == old_hash:
                # 用户没改 → 安全覆盖
                if new_content:
                    user_path.write_text(new_content, encoding="utf-8")
                agent_auto.append(filename)
            else:
                # 用户改过 + 出厂也变了 → 生成提案
                if new_content:
                    proposal_path = agent_dir / f"{filename}{UPGRADE_SUFFIX}"
                    proposal_path.write_text(new_content, encoding="utf-8")
                agent_proposals.append(filename)

        # 更新 .factory 指纹（记录新版 hash）
        new_hashes = {f: _content_hash(c) for f, c in new_files.items() if c}
        version = reg._versions[-1].version if reg._versions else "v1"
        _write_factory(agent_dir, version, new_hashes)

        if agent_auto:
            result["auto_upgraded"].append({"key": key, "files": agent_auto})
        if agent_proposals:
            result["proposals"].append({"key": key, "files": agent_proposals})
        if agent_skipped and not agent_auto and not agent_proposals:
            result["skipped"].append(key)

    return result


def _generate_proposals(agent_dir: Path, new_files: dict[str, str]):
    """为所有文件生成 .upgrade_proposal。"""
    for filename, content in new_files.items():
        if content:
            proposal_path = agent_dir / f"{filename}{UPGRADE_SUFFIX}"
            proposal_path.write_text(content, encoding="utf-8")


def list_upgrade_proposals() -> list[dict]:
    """列出所有待处理的升级提案。"""
    if not RUNTIME_PROMPTS_DIR.exists():
        return []
    proposals = []
    for agent_dir in sorted(RUNTIME_PROMPTS_DIR.iterdir()):
        if not agent_dir.is_dir() or agent_dir.name.startswith("."):
            continue
        agent_proposals = []
        for f in agent_dir.glob(f"*{UPGRADE_SUFFIX}"):
            base_name = f.name.replace(UPGRADE_SUFFIX, "")
            current_path = agent_dir / base_name
            current = current_path.read_text(encoding="utf-8") if current_path.exists() else ""
            proposed = f.read_text(encoding="utf-8")
            agent_proposals.append({
                "filename": base_name,
                "current_length": len(current),
                "proposed_length": len(proposed),
            })
        if agent_proposals:
            proposals.append({"key": agent_dir.name, "files": agent_proposals})
    return proposals


def accept_proposal(prompt_key: str, filename: str) -> bool:
    """采纳升级提案：用提案内容覆盖当前文件。"""
    agent_dir = RUNTIME_PROMPTS_DIR / prompt_key
    proposal_path = agent_dir / f"{filename}{UPGRADE_SUFFIX}"
    if not proposal_path.exists():
        return False
    target_path = agent_dir / filename
    content = proposal_path.read_text(encoding="utf-8")
    target_path.write_text(content, encoding="utf-8")
    proposal_path.unlink()

    # 更新 .factory 中该文件的 hash
    factory = _read_factory(agent_dir)
    if factory:
        factory["hashes"][filename] = _content_hash(content)
        _write_factory(agent_dir, factory.get("initialized_from", "?"), factory["hashes"])
    return True


def reject_proposal(prompt_key: str, filename: str) -> bool:
    """驳回升级提案：删除提案文件，保留用户版本。"""
    agent_dir = RUNTIME_PROMPTS_DIR / prompt_key
    proposal_path = agent_dir / f"{filename}{UPGRADE_SUFFIX}"
    if not proposal_path.exists():
        return False
    proposal_path.unlink()

    # 更新 .factory hash 为当前用户版本（避免下次重复提案）
    factory = _read_factory(agent_dir)
    target_path = agent_dir / filename
    if factory and target_path.exists():
        user_content = target_path.read_text(encoding="utf-8")
        factory["hashes"][filename] = _content_hash(user_content)
        _write_factory(agent_dir, factory.get("initialized_from", "?"), factory["hashes"])
    return True
