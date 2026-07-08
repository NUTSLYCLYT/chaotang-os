"""prompt_composer.py 测试。

覆盖：
- compose_prompt() 从目录读取 5 个文件，正确组合
- 某文件缺失时不崩溃、不包含空内容
- compose_prompt() 目录不存在时返回 None
- 仅含空内容的文件不计入组合
- person_id 注入：存在/不存在时行为
- _content_hash() 对标准化文本稳定
- _normalize_text() 去首尾空白并统一换行符
- split_prompt_to_files() 拆分到对应分区
- generate_tools_md() 工具列表 / 空列表
- upgrade_prompts() 三态逻辑：unchanged / needs_upgrade / upgraded
- accept_proposal() / reject_proposal() 提案操作
- list_prompt_agents() 目录不存在时返回空列表
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import src.prompt_composer as pc


# ---------------------------------------------------------------------------
# fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def agent_dir(tmp_path: Path) -> Path:
    """在 tmp_path 下创建一个最小化 agent 目录（带全部5个文件）。"""
    d = tmp_path / "test_agent"
    d.mkdir()
    (d / "IDENTITY.md").write_text("我是角色定位", encoding="utf-8")
    (d / "SOUL.md").write_text("这是铁律", encoding="utf-8")
    (d / "AGENTS.md").write_text("这是工作流", encoding="utf-8")
    (d / "USER.md").write_text("这是输出规范", encoding="utf-8")
    (d / "TOOLS.md").write_text("这是工具", encoding="utf-8")
    return d


@pytest.fixture()
def patch_runtime(tmp_path: Path):
    """将 RUNTIME_PROMPTS_DIR 重定向到 tmp_path，避免读写真实目录。"""
    with patch.object(pc, "RUNTIME_PROMPTS_DIR", tmp_path):
        yield tmp_path


# ---------------------------------------------------------------------------
# 1. compose_prompt — 正常路径：5 个文件全部存在
# ---------------------------------------------------------------------------


def test_compose_prompt_all_files(tmp_path: Path, agent_dir: Path):
    """所有 5 个文件都存在时，输出应包含各文件内容。"""
    with patch.object(pc, "RUNTIME_PROMPTS_DIR", tmp_path):
        result = pc.compose_prompt("test_agent")

    assert result is not None
    assert "我是角色定位" in result
    assert "这是铁律" in result
    assert "这是工作流" in result
    assert "这是输出规范" in result
    assert "这是工具" in result


# ---------------------------------------------------------------------------
# 2. compose_prompt — 目录不存在时返回 None
# ---------------------------------------------------------------------------


def test_compose_prompt_missing_dir(tmp_path: Path):
    """目录不存在时应返回 None，不抛异常。"""
    with patch.object(pc, "RUNTIME_PROMPTS_DIR", tmp_path):
        result = pc.compose_prompt("nonexistent_agent")
    assert result is None


# ---------------------------------------------------------------------------
# 3. compose_prompt — 部分文件缺失时不崩溃，只包含存在的文件
# ---------------------------------------------------------------------------


def test_compose_prompt_partial_files(tmp_path: Path):
    """只有 IDENTITY.md 和 SOUL.md 时，输出仅含这两部分，不崩溃。"""
    d = tmp_path / "partial_agent"
    d.mkdir()
    (d / "IDENTITY.md").write_text("角色", encoding="utf-8")
    (d / "SOUL.md").write_text("铁律", encoding="utf-8")

    with patch.object(pc, "RUNTIME_PROMPTS_DIR", tmp_path):
        result = pc.compose_prompt("partial_agent")

    assert result is not None
    assert "角色" in result
    assert "铁律" in result
    # 缺失的文件不应在输出中留下空白节
    assert result.count("\n\n") <= 1  # 两部分之间只有一个分隔符


# ---------------------------------------------------------------------------
# 4. compose_prompt — 文件内容为空时，该文件被跳过
# ---------------------------------------------------------------------------


def test_compose_prompt_empty_file_skipped(tmp_path: Path):
    """内容为空的文件不应被计入最终 prompt。"""
    d = tmp_path / "empty_agent"
    d.mkdir()
    (d / "IDENTITY.md").write_text("有内容", encoding="utf-8")
    (d / "SOUL.md").write_text("   \n  ", encoding="utf-8")  # 纯空白

    with patch.object(pc, "RUNTIME_PROMPTS_DIR", tmp_path):
        result = pc.compose_prompt("empty_agent")

    assert result is not None
    assert "有内容" in result
    # 空白文件内容不应出现
    assert result.strip() == "有内容"


# ---------------------------------------------------------------------------
# 5. compose_prompt — 所有文件都为空目录时返回 None
# ---------------------------------------------------------------------------


def test_compose_prompt_all_empty_returns_none(tmp_path: Path):
    """所有文件内容均为空时，应返回 None。"""
    d = tmp_path / "all_empty"
    d.mkdir()
    (d / "IDENTITY.md").write_text("", encoding="utf-8")

    with patch.object(pc, "RUNTIME_PROMPTS_DIR", tmp_path):
        result = pc.compose_prompt("all_empty")

    assert result is None


# ---------------------------------------------------------------------------
# 6. compose_prompt — person_id 注入
# ---------------------------------------------------------------------------


def test_compose_prompt_with_person_id(tmp_path: Path, agent_dir: Path):
    """传入 person_id 且文件存在时，人格快照应被追加。"""
    person_dir = tmp_path / "memory" / "persons"
    person_dir.mkdir(parents=True)
    (person_dir / "alice.md").write_text("Alice 是一个技术决策者", encoding="utf-8")

    with patch.object(pc, "RUNTIME_PROMPTS_DIR", tmp_path):
        with patch.object(pc, "MEMORY_PERSONS_DIR", person_dir):
            result = pc.compose_prompt("test_agent", person_id="alice")

    assert result is not None
    assert "Alice 是一个技术决策者" in result
    assert "USER_PROFILE" in result


def test_compose_prompt_person_id_missing_file(tmp_path: Path, agent_dir: Path):
    """person_id 对应文件不存在时，compose_prompt 不崩溃，照常返回 prompt。"""
    person_dir = tmp_path / "memory" / "persons"
    person_dir.mkdir(parents=True)

    with patch.object(pc, "RUNTIME_PROMPTS_DIR", tmp_path):
        with patch.object(pc, "MEMORY_PERSONS_DIR", person_dir):
            result = pc.compose_prompt("test_agent", person_id="nobody")

    assert result is not None
    assert "USER_PROFILE" not in result


# ---------------------------------------------------------------------------
# 7. _content_hash 和 _normalize_text
# ---------------------------------------------------------------------------


def test_content_hash_stable():
    """相同内容的 hash 应一致，即使末尾有不同换行符。"""
    h1 = pc._content_hash("hello world\n")
    h2 = pc._content_hash("hello world\r\n")
    assert h1 == h2
    assert len(h1) == 12


def test_content_hash_different_for_different_content():
    """不同内容的 hash 应不同。"""
    h1 = pc._content_hash("内容A")
    h2 = pc._content_hash("内容B")
    assert h1 != h2


def test_normalize_text_strips_and_unifies_newlines():
    """_normalize_text 应去首尾空白并将 CRLF 统一为 LF。"""
    result = pc._normalize_text("  line1\r\nline2\r  ")
    assert result == "line1\nline2"


# ---------------------------------------------------------------------------
# 8. split_prompt_to_files — 拆分逻辑
# ---------------------------------------------------------------------------


FULL_PROMPT_SAMPLE = """你是一个AI助手，负责市场分析。

## 铁律
- 禁止捏造数据

## 你的任务
分析竞争对手并输出报告

## 输出规范
输出为Markdown格式
"""


def test_split_prompt_has_sections():
    """split_prompt_to_files 应将内容拆分到对应的 key 中。"""
    result = pc.split_prompt_to_files("test_key", FULL_PROMPT_SAMPLE)
    assert isinstance(result, dict)
    # 至少有部分分区
    assert len(result) >= 1


def test_split_prompt_soul_section_detected():
    """含'铁律'标记时，SOUL.md 应有内容。"""
    result = pc.split_prompt_to_files("test_key", FULL_PROMPT_SAMPLE)
    soul_content = result.get("SOUL.md", "")
    assert "铁律" in soul_content


def test_split_prompt_user_section_detected():
    """含'输出规范'标记时，USER.md 应有内容。"""
    result = pc.split_prompt_to_files("test_key", FULL_PROMPT_SAMPLE)
    user_content = result.get("USER.md", "")
    assert "输出规范" in user_content


# ---------------------------------------------------------------------------
# 9. generate_tools_md
# ---------------------------------------------------------------------------


class _FakeTool:
    def __init__(self, name, description, approval_level="auto", parameters=None):
        self.name = name
        self.description = description
        self.approval_level = approval_level
        self.parameters = parameters or {"properties": {}, "required": []}


def test_generate_tools_md_empty():
    """空工具列表应返回空字符串。"""
    result = pc.generate_tools_md([])
    assert result == ""


def test_generate_tools_md_with_tools():
    """有工具时，输出应包含工具名称和描述。"""
    tools = [
        _FakeTool("search_web", "搜索互联网"),
        _FakeTool("send_email", "发送邮件（草稿模式）", approval_level="draft"),
    ]
    result = pc.generate_tools_md(tools)
    assert "search_web" in result
    assert "搜索互联网" in result
    assert "send_email" in result
    assert "草稿模式" in result  # draft 工具应有提示


def test_generate_tools_md_with_parameters():
    """有参数定义时，参数应出现在输出中。"""
    tools = [
        _FakeTool(
            "query_db",
            "查询数据库",
            parameters={
                "properties": {
                    "sql": {"description": "SQL语句"}
                },
                "required": ["sql"],
            },
        )
    ]
    result = pc.generate_tools_md(tools)
    assert "sql" in result
    assert "SQL语句" in result
    assert "必填" in result


# ---------------------------------------------------------------------------
# 10. upgrade_prompts() 三态逻辑
# ---------------------------------------------------------------------------


def _make_versioned_reg(content: str, version: str = "v1"):
    """构造一个最小化的版本注册对象。"""
    ver = type("Ver", (), {"content": content, "version": version})()
    reg = type("Reg", (), {"_versions": [ver]})()
    return reg


def test_upgrade_prompts_skipped_when_no_change(tmp_path: Path):
    """出厂版本未变化时，该 agent 应归入 skipped。"""
    agent_dir = tmp_path / "unchanged_agent"
    agent_dir.mkdir()

    content = "## 铁律\n不变的内容\n## 输出规范\n规范"
    files = pc.split_prompt_to_files("unchanged_agent", content)
    file_hashes = {}
    for fname, fcontent in files.items():
        (agent_dir / fname).write_text(fcontent, encoding="utf-8")
        file_hashes[fname] = pc._content_hash(fcontent)

    # 写 .factory，hash 与文件一致
    factory_data = {"initialized_from": "v1", "hashes": file_hashes}
    (agent_dir / ".factory").write_text(
        json.dumps(factory_data, ensure_ascii=False), encoding="utf-8"
    )

    reg = _make_versioned_reg(content, "v1")
    fake_prompts = {"unchanged_agent": reg}

    with patch.object(pc, "RUNTIME_PROMPTS_DIR", tmp_path):
        with patch("src.prompt_composer._VERSIONED_PROMPTS", fake_prompts, create=True):
            with patch("src.prompts_versioned._VERSIONED_PROMPTS", fake_prompts):
                result = pc.upgrade_prompts()

    assert "unchanged_agent" in result["skipped"]
    assert not result["auto_upgraded"]
    assert not result["proposals"]


def test_upgrade_prompts_auto_upgrade_when_user_unchanged(tmp_path: Path):
    """用户未修改文件，且代码新版本存在时，应自动升级（auto_upgraded）。"""
    agent_dir = tmp_path / "auto_upgrade_agent"
    agent_dir.mkdir()

    old_content = "## 铁律\n旧版内容\n## 输出规范\n旧规范"
    new_content = "## 铁律\n新版内容（出厂更新）\n## 输出规范\n新规范"

    # 当前文件与 v1 hash 一致（用户没改）
    old_files = pc.split_prompt_to_files("auto_upgrade_agent", old_content)
    file_hashes = {}
    for fname, fcontent in old_files.items():
        (agent_dir / fname).write_text(fcontent, encoding="utf-8")
        file_hashes[fname] = pc._content_hash(fcontent)

    factory_data = {"initialized_from": "v1", "hashes": file_hashes}
    (agent_dir / ".factory").write_text(
        json.dumps(factory_data, ensure_ascii=False), encoding="utf-8"
    )

    # 注册对象使用新内容
    reg = _make_versioned_reg(new_content, "v2")
    fake_prompts = {"auto_upgrade_agent": reg}

    with patch.object(pc, "RUNTIME_PROMPTS_DIR", tmp_path):
        with patch("src.prompts_versioned._VERSIONED_PROMPTS", fake_prompts):
            result = pc.upgrade_prompts()

    # 至少有一个文件被自动升级
    auto_keys = [r["key"] for r in result["auto_upgraded"]]
    assert "auto_upgrade_agent" in auto_keys


def test_upgrade_prompts_proposal_when_user_modified(tmp_path: Path):
    """用户修改了文件，且代码也出了新版，应生成 .upgrade_proposal 而不直接覆盖。"""
    agent_dir = tmp_path / "proposal_agent"
    agent_dir.mkdir()

    old_content = "## 铁律\n原始内容\n## 输出规范\n规范"
    new_content = "## 铁律\n出厂新内容\n## 输出规范\n新规范"

    # factory hash 记录 old_content
    old_files = pc.split_prompt_to_files("proposal_agent", old_content)
    factory_hashes = {
        fname: pc._content_hash(fcontent) for fname, fcontent in old_files.items()
    }
    factory_data = {"initialized_from": "v1", "hashes": factory_hashes}
    (agent_dir / ".factory").write_text(
        json.dumps(factory_data, ensure_ascii=False), encoding="utf-8"
    )

    # 但当前文件内容是用户自定义内容（hash 与 factory 不同）
    for fname in old_files:
        (agent_dir / fname).write_text("用户自定义内容（与factory不同）", encoding="utf-8")

    reg = _make_versioned_reg(new_content, "v2")
    fake_prompts = {"proposal_agent": reg}

    with patch.object(pc, "RUNTIME_PROMPTS_DIR", tmp_path):
        with patch("src.prompts_versioned._VERSIONED_PROMPTS", fake_prompts):
            result = pc.upgrade_prompts()

    proposal_keys = [r["key"] for r in result["proposals"]]
    assert "proposal_agent" in proposal_keys
    # 同时确认 .upgrade_proposal 文件被创建
    proposals = list(agent_dir.glob("*.upgrade_proposal"))
    assert len(proposals) >= 1


# ---------------------------------------------------------------------------
# 11. accept_proposal / reject_proposal
# ---------------------------------------------------------------------------


def test_accept_proposal(tmp_path: Path):
    """accept_proposal 应用提案内容覆盖当前文件，并删除提案文件。"""
    agent_dir = tmp_path / "accept_agent"
    agent_dir.mkdir()

    (agent_dir / "SOUL.md").write_text("原始内容", encoding="utf-8")
    proposal_path = agent_dir / "SOUL.md.upgrade_proposal"
    proposal_path.write_text("提案新内容", encoding="utf-8")

    # 写一个 .factory
    factory = {"initialized_from": "v1", "hashes": {"SOUL.md": pc._content_hash("原始内容")}}
    (agent_dir / ".factory").write_text(json.dumps(factory), encoding="utf-8")

    with patch.object(pc, "RUNTIME_PROMPTS_DIR", tmp_path):
        ok = pc.accept_proposal("accept_agent", "SOUL.md")

    assert ok is True
    assert (agent_dir / "SOUL.md").read_text(encoding="utf-8") == "提案新内容"
    assert not proposal_path.exists()


def test_accept_proposal_missing_returns_false(tmp_path: Path):
    """提案文件不存在时应返回 False，不抛异常。"""
    agent_dir = tmp_path / "no_proposal"
    agent_dir.mkdir()

    with patch.object(pc, "RUNTIME_PROMPTS_DIR", tmp_path):
        result = pc.accept_proposal("no_proposal", "SOUL.md")

    assert result is False


def test_reject_proposal(tmp_path: Path):
    """reject_proposal 应删除提案文件，保留用户版本不变。"""
    agent_dir = tmp_path / "reject_agent"
    agent_dir.mkdir()

    user_content = "用户版本"
    (agent_dir / "USER.md").write_text(user_content, encoding="utf-8")
    proposal_path = agent_dir / "USER.md.upgrade_proposal"
    proposal_path.write_text("提案内容（将被拒绝）", encoding="utf-8")

    factory = {"initialized_from": "v1", "hashes": {}}
    (agent_dir / ".factory").write_text(json.dumps(factory), encoding="utf-8")

    with patch.object(pc, "RUNTIME_PROMPTS_DIR", tmp_path):
        ok = pc.reject_proposal("reject_agent", "USER.md")

    assert ok is True
    assert not proposal_path.exists()
    assert (agent_dir / "USER.md").read_text(encoding="utf-8") == user_content


# ---------------------------------------------------------------------------
# 12. list_prompt_agents
# ---------------------------------------------------------------------------


def test_list_prompt_agents_empty(tmp_path: Path):
    """RUNTIME_PROMPTS_DIR 不存在时返回空列表。"""
    with patch.object(pc, "RUNTIME_PROMPTS_DIR", tmp_path / "nonexistent"):
        result = pc.list_prompt_agents()
    assert result == []


def test_list_prompt_agents_lists_dirs(tmp_path: Path):
    """有 agent 目录时，应列出它们。"""
    (tmp_path / "agent_alpha").mkdir()
    (tmp_path / "agent_alpha" / "IDENTITY.md").write_text("alpha", encoding="utf-8")
    (tmp_path / "agent_beta").mkdir()
    (tmp_path / "agent_beta" / "SOUL.md").write_text("beta", encoding="utf-8")

    with patch.object(pc, "RUNTIME_PROMPTS_DIR", tmp_path):
        result = pc.list_prompt_agents()

    keys = [r["key"] for r in result]
    assert "agent_alpha" in keys
    assert "agent_beta" in keys
