"""人格快照（memory/persons/）加载与 Prompt 注入测试。"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.prompt_composer import load_person_profile, compose_prompt, MEMORY_PERSONS_DIR


class TestLoadPersonProfile:
    """load_person_profile() 单元测试。"""

    def test_load_person_profile_existing(self):
        """能正确加载存在的 profile 文件。"""
        result = load_person_profile("halong")
        assert isinstance(result, str)
        assert len(result) > 50, f"profile 内容过短，实际长度: {len(result)}"
        # 验证文件包含预期内容
        assert "郝龙" in result or "halong" in result.lower() or "人格快照" in result

    def test_load_person_profile_guo_yunhui(self):
        """能正确加载郭云辉的 profile 文件。"""
        result = load_person_profile("guo_yunhui")
        assert len(result) > 50
        assert "郭云辉" in result or "人格快照" in result

    def test_load_person_profile_opc_team(self):
        """能正确加载 OPC 团队集体画像。"""
        result = load_person_profile("opc_team")
        assert len(result) > 50
        assert "OPC" in result or "人格快照" in result

    def test_load_person_profile_missing(self):
        """找不到 profile 时返回空字符串，不抛异常。"""
        result = load_person_profile("nonexistent_person_xyz_123")
        assert result == "", f"期望空字符串，实际: {repr(result)}"

    def test_load_person_profile_missing_does_not_raise(self):
        """找不到文件不应抛出任何异常（包括 FileNotFoundError）。"""
        try:
            result = load_person_profile("__definitely_not_exists__")
            assert result == ""
        except Exception as e:
            pytest.fail(f"load_person_profile 不应抛出异常，但抛出了: {type(e).__name__}: {e}")

    def test_load_person_profile_returns_string(self):
        """返回值类型始终是 str（包括找不到文件时）。"""
        result_existing = load_person_profile("halong")
        result_missing = load_person_profile("__no_such_person__")
        assert isinstance(result_existing, str)
        assert isinstance(result_missing, str)

    def test_load_person_profile_with_tmp_file(self, tmp_path, monkeypatch):
        """使用临时文件验证加载逻辑，隔离真实文件系统。"""
        import src.prompt_composer as pc
        # 临时替换 MEMORY_PERSONS_DIR
        tmp_persons = tmp_path / "persons"
        tmp_persons.mkdir()
        (tmp_persons / "test_person.md").write_text(
            "## 测试人物 · 人格快照\n### 沟通风格\n- 直接简洁",
            encoding="utf-8"
        )
        monkeypatch.setattr(pc, "MEMORY_PERSONS_DIR", tmp_persons)

        result = pc.load_person_profile("test_person")
        assert "测试人物" in result
        assert "直接简洁" in result

        missing = pc.load_person_profile("no_such")
        assert missing == ""


class TestComposePromptWithPersonId:
    """compose_prompt() person_id 注入测试。"""

    def test_prompt_composer_with_person_id(self, tmp_path, monkeypatch):
        """传入 person_id 时，profile 内容出现在组装结果中。"""
        import src.prompt_composer as pc

        # 创建临时 runtime_prompts 目录
        runtime = tmp_path / "runtime_prompts" / "test_agent"
        runtime.mkdir(parents=True)
        (runtime / "IDENTITY.md").write_text("## 角色定位\n测试Agent", encoding="utf-8")
        (runtime / "SOUL.md").write_text("## 核心使命\n负责测试", encoding="utf-8")
        (runtime / "AGENTS.md").write_text("## 工作流程\n执行测试任务", encoding="utf-8")
        (runtime / "USER.md").write_text("## 用户角色\n开发者", encoding="utf-8")

        # 创建临时 memory/persons 目录
        persons = tmp_path / "persons"
        persons.mkdir()
        (persons / "test_user.md").write_text(
            "## 测试用户 · 人格快照\n### 沟通风格\n- 喜欢简洁",
            encoding="utf-8"
        )

        monkeypatch.setattr(pc, "RUNTIME_PROMPTS_DIR", tmp_path / "runtime_prompts")
        monkeypatch.setattr(pc, "MEMORY_PERSONS_DIR", persons)

        result = pc.compose_prompt("test_agent", person_id="test_user")

        assert result is not None
        assert "USER_PROFILE" in result, "组装结果中应包含 USER_PROFILE 标记"
        assert "测试用户" in result, "组装结果中应包含 profile 的人名"
        assert "喜欢简洁" in result, "组装结果中应包含 profile 的沟通风格"

    def test_prompt_composer_without_person_id(self, tmp_path, monkeypatch):
        """不传 person_id 时，行为与原来一致（向后兼容）。"""
        import src.prompt_composer as pc

        # 创建临时 runtime_prompts 目录
        runtime = tmp_path / "runtime_prompts" / "test_agent2"
        runtime.mkdir(parents=True)
        (runtime / "IDENTITY.md").write_text("## 角色定位\n测试Agent2", encoding="utf-8")
        (runtime / "SOUL.md").write_text("## 核心使命\n负责测试2", encoding="utf-8")
        (runtime / "AGENTS.md").write_text("## 工作流程\n执行任务", encoding="utf-8")
        (runtime / "USER.md").write_text("## 用户角色\n管理员", encoding="utf-8")

        monkeypatch.setattr(pc, "RUNTIME_PROMPTS_DIR", tmp_path / "runtime_prompts")

        result = pc.compose_prompt("test_agent2")

        assert result is not None
        assert "USER_PROFILE" not in result, "不传 person_id 时不应有 USER_PROFILE 注入"
        assert "测试Agent2" in result
        assert "管理员" in result

    def test_prompt_composer_with_missing_person_id(self, tmp_path, monkeypatch):
        """传入不存在的 person_id 时，不注入 profile，正常返回 prompt（不报错）。"""
        import src.prompt_composer as pc

        runtime = tmp_path / "runtime_prompts" / "test_agent3"
        runtime.mkdir(parents=True)
        (runtime / "IDENTITY.md").write_text("## 角色定位\n测试Agent3", encoding="utf-8")
        (runtime / "USER.md").write_text("## 用户角色\n普通用户", encoding="utf-8")

        persons = tmp_path / "persons"
        persons.mkdir()

        monkeypatch.setattr(pc, "RUNTIME_PROMPTS_DIR", tmp_path / "runtime_prompts")
        monkeypatch.setattr(pc, "MEMORY_PERSONS_DIR", persons)

        result = pc.compose_prompt("test_agent3", person_id="nonexistent_profile")

        assert result is not None, "即使 person_id 对应文件不存在，也应正常返回 prompt"
        assert "USER_PROFILE" not in result
        assert "测试Agent3" in result

    def test_prompt_composer_person_id_appended_after_user(self, tmp_path, monkeypatch):
        """person_id profile 应该追加在 USER 部分之后，而不是前面。"""
        import src.prompt_composer as pc

        runtime = tmp_path / "runtime_prompts" / "test_agent4"
        runtime.mkdir(parents=True)
        (runtime / "IDENTITY.md").write_text("IDENTITY内容", encoding="utf-8")
        (runtime / "USER.md").write_text("USER内容", encoding="utf-8")

        persons = tmp_path / "persons"
        persons.mkdir()
        (persons / "sample.md").write_text("PROFILE内容", encoding="utf-8")

        monkeypatch.setattr(pc, "RUNTIME_PROMPTS_DIR", tmp_path / "runtime_prompts")
        monkeypatch.setattr(pc, "MEMORY_PERSONS_DIR", persons)

        result = pc.compose_prompt("test_agent4", person_id="sample")

        assert result is not None
        user_pos = result.find("USER内容")
        profile_pos = result.find("PROFILE内容")
        assert user_pos != -1 and profile_pos != -1
        assert profile_pos > user_pos, "profile 应追加在 USER 内容之后"
